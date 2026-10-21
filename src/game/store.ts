// UI state for one run. A pure reducer around the engine: all money math stays in src/engine.
import {
  advance,
  buy,
  buyShield,
  canShield,
  canTrade,
  cancelPending,
  newGame,
  queueOrder,
  runGhost,
  sell,
  setTarget,
  type Asset,
  type DayRecord,
  type GameState,
  type Order,
  type Weights,
} from "../engine";
import { ACHIEVEMENTS, XP_PER_ACHIEVEMENT, XP_PER_DAY } from "./achievements";
import { breakingFor, isHero, type Breaking } from "./events";
import { SCENARIO, spyMove } from "./scenario";
import {
  snapshot,
  tutorialClose,
  tutorialInit,
  tutorialLoad,
  tutorialReplay,
  tutorialSkip,
  tutorialShow,
  tutorialStep,
  tutorialStoryDone,
  type SavedProgress,
  type TipId,
  type TutorialState,
} from "./tutorial";

export type Phase = "pick" | "play" | "end";
/** FAST-FORWARD pace: one quiet day per this many ms (spec §4). */
export const FF_MS = 400;

export interface Toast {
  id: number;
  title: string;
  /** "warn" = a blocked action (e.g. BUY with no cash), not an achievement: no trophy, no XP. */
  kind?: "warn";
}
export interface DamageFx {
  id: number;
  amount: number;
}
export interface GoblinFx {
  id: number;
  fee: number;
}
export interface DividendFx {
  id: number;
  amount: number;
}
/** SHIELD pop-up: bought ("up"), paid at expiry ("payout", amount > 0) or expired worthless ("expired"). */
export interface ShieldFx {
  id: number;
  kind: "up" | "payout" | "expired";
  amount: number;
}
/** "LOCKED" stamp for a sell fill: realized P&L of the shares sold. */
export interface StampFx {
  id: number;
  asset: Asset;
  amount: number;
}

export interface UiState {
  game: GameState;
  phase: Phase;
  /** FAST-FORWARD is running (spec §4). Turn-based otherwise: a day only passes on NEXT DAY. */
  ff: boolean;
  selected: Asset;
  /** "Did nothing" ghost: full series, computed at PLAY. Only ghost[0..t] may be shown. */
  ghost: DayRecord[] | null;
  xp: number;
  unlocked: string[];
  toasts: Toast[];
  damage: DamageFx[];
  goblin: GoblinFx | null;
  dividend: DividendFx | null;
  stamps: StampFx[];
  shieldFx: ShieldFx | null;
  /** Bumped on SPY <= -4% days to restart the shake/flash animation; 0 = none yet. */
  shakeId: number;
  /** True on a big day (event, |SPY| > 3% or circuit breaker) until the player moves on. */
  bigDay: boolean;
  /** The merged BREAKING card on screen (spec §6b: one card per day, max); null when none or dismissed. */
  breaking: Breaking | null;
  /** Last day reached and the MISSION COMPLETE panel is open. */
  endOpen: boolean;
  nextId: number;
  /** NEWS BOT coach (spec §8b). Survives "restart"; FAST-FORWARD stops when a new tip shows up. */
  tut: TutorialState;
  /** The orders the ghost copied at PLAY (its day-1 bag). Saved so CONTINUE rebuilds the same ghost. */
  ghostOrders: Order[];
  /** log[d] = the orders that were pending at close d and filled at the open of d + 1. Saved for CONTINUE. */
  log: Order[][];
  /** Last day a hero (Fed/Congress) card fired; the virus bosses recoil right after it. -1 = none yet. */
  heroT: number;
}

export type Action =
  | { type: "select"; asset: Asset }
  | { type: "buy" }
  | { type: "sell" }
  /** SHIELD button: queue a 1-month cover, or warn why not. */
  | { type: "shield" }
  | { type: "target"; weights: Weights }
  | { type: "cancel" }
  | { type: "start" }
  /** NEXT DAY: one day forward (on the pick screen it also locks in the day-1 bag). Stops FAST-FORWARD. */
  | { type: "next" }
  /** FAST-FORWARD button: start it, or stop it if it is running. */
  | { type: "ff" }
  /** Any click or key while fast-forwarding. */
  | { type: "ffStop" }
  /** One fast-forward day (timer). */
  | { type: "ffTick" }
  | { type: "toastDone"; id: number }
  | { type: "damageDone"; id: number }
  | { type: "goblinDone"; id: number }
  | { type: "dividendDone"; id: number }
  | { type: "stampDone"; id: number }
  | { type: "shieldDone"; id: number }
  | { type: "closeEnd" }
  | { type: "openEnd" }
  | { type: "restart" }
  | { type: "tutLoad"; saved: SavedProgress }
  | { type: "tutClose" }
  | { type: "tutShow"; id: TipId }
  | { type: "tutSkip" }
  | { type: "tutReplay" }
  | { type: "storyDone" }
  /** DISMISS the BREAKING card: the player stays on that day and can trade. Never advances anything. */
  | { type: "breakingClose" }
  /** REREAD: open today's BREAKING card again. */
  | { type: "breakingOpen" };

export function initialState(): UiState {
  return {
    game: newGame(SCENARIO),
    phase: "pick",
    ff: false,
    selected: "SPY",
    ghost: null,
    xp: 0,
    unlocked: [],
    toasts: [],
    damage: [],
    goblin: null,
    dividend: null,
    stamps: [],
    shieldFx: null,
    shakeId: 0,
    bigDay: false,
    breaking: null,
    endOpen: false,
    nextId: 1,
    tut: tutorialInit(),
    ghostOrders: [],
    log: [],
    heroT: -1,
  };
}

/** Advance one day and derive all the juice (damage numbers, goblin, coins, shake, XP, toasts). */
function stepDay(s: UiState): UiState {
  if (!canTrade(s.game)) return s;
  const log = [...s.log, s.game.pending];
  const game = advance(s.game);
  const t = game.t;
  const rec = game.history[t];
  const prev = game.history[t - 1];
  const last = !canTrade(game);
  let id = s.nextId;

  const delta = rec.value - prev.value;
  const damage =
    Math.round(delta) !== 0
      ? [...s.damage.slice(-3), { id: id++, amount: delta }]
      : s.damage;

  let fee = 0;
  let divs = 0;
  // One stamp per asset (newest wins), so a re-target that sells two assets stamps two rows.
  let stamps = s.stamps;
  let shieldFx = s.shieldFx;
  for (const e of rec.events) {
    if (e.kind === "fill") {
      fee += e.fee;
      if (e.side === "sell" && e.realized !== undefined) {
        stamps = [
          ...stamps.filter((x) => x.asset !== e.asset),
          { id: id++, asset: e.asset, amount: e.realized },
        ];
      }
    } else if (e.kind === "dividend") divs += e.amount;
    else if (e.kind === "shieldBuy")
      shieldFx = { id: id++, kind: "up", amount: e.premium };
    else if (e.kind === "shieldPayout")
      shieldFx = { id: id++, kind: e.amount > 0 ? "payout" : "expired", amount: e.amount };
  }
  const goblin = rec.events.some((e) => e.kind === "fill")
    ? { id: id++, fee }
    : s.goblin;
  const dividend = divs > 0 ? { id: id++, amount: divs } : s.dividend;
  const shakeId = spyMove(t) <= -0.04 ? id++ : s.shakeId;

  let xp = s.xp + XP_PER_DAY;
  const unlocked = [...s.unlocked];
  const toasts = [...s.toasts];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.includes(a.id)) continue;
    if (
      a.check({
        scenario: SCENARIO,
        history: game.history,
        rec,
        isLastDay: last,
      })
    ) {
      unlocked.push(a.id);
      xp += XP_PER_ACHIEVEMENT;
      toasts.push({ id: id++, title: a.title });
    }
  }

  const card = last ? null : breakingFor(t);
  // FAST-FORWARD stops ON a big day (spec §4): a BREAKING card (event, |SPY| > 3%, circuit breaker) or the
  // first dividend. A new tutorial tip stops it too (see reducer). The end stops everything.
  const firstDividend =
    divs > 0 &&
    !game.history
      .slice(0, t)
      .some((h) => h.events.some((e) => e.kind === "dividend"));
  return {
    ...s,
    game,
    phase: last ? "end" : s.phase,
    ff: s.ff && !card && !firstDividend && !last,
    bigDay: !!card,
    breaking: card,
    endOpen: last,
    xp,
    unlocked,
    toasts: toasts.slice(-3),
    damage,
    goblin,
    dividend,
    stamps,
    shieldFx,
    shakeId,
    nextId: id,
    log,
    heroT: card?.events.some(isHero) ? t : s.heroT,
  };
}

/** Wraps an engine call that queues orders; ignores it if trading is closed. */
/** Show a red warning toast instead of queueing an order that would silently do nothing at the next open. */
function warn(s: UiState, title: string): UiState {
  return {
    ...s,
    toasts: [...s.toasts, { id: s.nextId, title, kind: "warn" as const }].slice(-3),
    nextId: s.nextId + 1,
  };
}

function trade(s: UiState, f: (g: GameState) => GameState): UiState {
  if (s.phase === "end" || !canTrade(s.game)) return s;
  return { ...s, game: f(s.game) };
}

/** True while the coach (story or a tip) is on screen. */
export const coachOpen = (s: UiState) =>
  s.tut.storyOpen || s.tut.queue.length > 0;

/** True while something must be read before the next day can pass (story intro, BREAKING card, end panel). */
export const blocked = (s: UiState) =>
  s.tut.storyOpen || !!s.breaking || s.endOpen;

export function reducer(s: UiState, a: Action): UiState {
  switch (a.type) {
    case "tutLoad":
      return s.tut.ready
        ? s
        : { ...s, tut: tutorialLoad(a.saved, snapshot(s)) };
    case "tutClose":
      return { ...s, tut: tutorialClose(s.tut) };
    case "tutShow":
      return { ...s, tut: tutorialShow(s.tut, a.id) };
    case "tutSkip":
      return { ...s, tut: tutorialSkip(s.tut) };
    case "tutReplay":
      return { ...s, tut: tutorialReplay(s.tut, snapshot(s)) };
    case "storyDone":
      return { ...s, tut: tutorialStoryDone(s.tut) };
  }
  const next = gameReducer(s, a);
  if (next === s) return s;
  const tut = tutorialStep(s.tut, snapshot(s), snapshot(next));
  // A tip that just showed up is a "tutorial moment": FAST-FORWARD stops on it (spec §4).
  const newTip = tut.queue.some((id) => !s.tut.queue.includes(id));
  return { ...next, tut, ff: next.ff && !newTip };
}

function gameReducer(s: UiState, a: Action): UiState {
  switch (a.type) {
    case "select":
      return { ...s, selected: a.asset };
    case "buy": {
      // A buy only fills from cash; with none on hand (and no queued sell/re-target to raise it) it would be skipped.
      const g = s.game;
      const funded = g.holdings.cash >= 1 || g.pending.some((o) => o.kind !== "buy");
      if (!funded && s.phase !== "end" && canTrade(g)) return warn(s, "NO CASH! SELL SOMETHING FIRST");
      return trade(s, (g) => buy(g, s.selected));
    }
    case "sell": {
      const g = s.game;
      const owned =
        g.holdings.shares[s.selected] > 0 ||
        g.pending.some((o) => o.kind === "target" || (o.kind === "buy" && o.asset === s.selected));
      if (!owned && s.phase !== "end" && canTrade(g)) return warn(s, `YOU DON'T OWN ANY ${s.selected}`);
      return trade(s, (g) => sell(g, s.selected));
    }
    case "shield": {
      const g = s.game;
      if (s.phase === "end" || !canTrade(g)) return s;
      const c = canShield(g);
      if (c.ok) return { ...s, game: buyShield(g) };
      const why = {
        active: "SHIELD ALREADY ACTIVE",
        queued: "SHIELD ALREADY QUEUED",
        noStocks: "BUY SOME STOCKS FIRST - SHIELD COVERS SPY",
        lastDays: "TOO LATE - LESS THAN A MONTH LEFT",
      }[c.reason!];
      return warn(s, why);
    }
    case "target":
      // A preset re-targets the whole bag, so earlier queued orders would only add fees: replace them.
      return trade(s, (g) => setTarget(cancelPending(g), a.weights));
    case "cancel":
      return { ...s, game: cancelPending(s.game) };
    case "start":
      if (s.phase !== "pick") return s;
      return {
        ...s,
        phase: "play",
        ghost: runGhost(SCENARIO, s.game.pending),
        ghostOrders: s.game.pending,
      };
    case "next": {
      if (s.phase === "end" || blocked(s)) return s;
      const begun = s.phase === "pick" ? gameReducer(s, { type: "start" }) : s;
      return stepDay({ ...begun, ff: false, bigDay: false, breaking: null });
    }
    case "ff":
      if (s.ff) return { ...s, ff: false };
      if (s.phase === "end" || blocked(s)) return s;
      return {
        ...(s.phase === "pick" ? gameReducer(s, { type: "start" }) : s),
        ff: true,
      };
    case "ffStop":
      return s.ff ? { ...s, ff: false } : s;
    case "ffTick":
      if (s.phase !== "play" || !s.ff) return s;
      if (blocked(s)) return { ...s, ff: false };
      return stepDay({ ...s, bigDay: false, breaking: null });
    case "breakingClose":
      return s.breaking ? { ...s, breaking: null } : s;
    case "breakingOpen": {
      if (s.breaking || s.phase !== "play") return s;
      const card = breakingFor(s.game.t);
      return card ? { ...s, ff: false, breaking: card } : s;
    }
    case "toastDone":
      return { ...s, toasts: s.toasts.filter((x) => x.id !== a.id) };
    case "damageDone":
      return { ...s, damage: s.damage.filter((x) => x.id !== a.id) };
    case "goblinDone":
      return s.goblin?.id === a.id ? { ...s, goblin: null } : s;
    case "dividendDone":
      return s.dividend?.id === a.id ? { ...s, dividend: null } : s;
    case "openEnd":
      return s.phase === "end" ? { ...s, endOpen: true } : s;
    case "stampDone":
      return { ...s, stamps: s.stamps.filter((x) => x.id !== a.id) };
    case "shieldDone":
      return s.shieldFx?.id === a.id ? { ...s, shieldFx: null } : s;
    case "closeEnd":
      return { ...s, endOpen: false };
    case "restart":
      return initialState();
    default:
      return s;
  }
}

/** What CONTINUE needs to rebuild a run exactly: the engine is pure, so orders + days replay to the same state. */
export interface RunInputs {
  t: number;
  ghostOrders: Order[];
  /** log[d] for d < t. */
  log: Order[][];
  /** Orders queued at close t, not filled yet. */
  pending: Order[];
}

/**
 * Rebuild a paused run by replaying its orders through the same day logic as live play (XP, achievements and
 * the ghost come back too). Throws if the inputs don't fit the scenario; one-shot effects are cleared.
 */
export function replayRun(r: RunInputs): UiState {
  const last = SCENARIO.days.length - 1;
  if (!Number.isInteger(r.t) || r.t < 0 || r.t >= last) throw new Error("Bad day");
  if (r.log.length !== r.t) throw new Error("Log length does not match the day");
  const queue = (g: GameState, orders: Order[]) =>
    orders.reduce(queueOrder, cancelPending(g));
  let s = initialState();
  s = gameReducer({ ...s, game: queue(s.game, r.ghostOrders) }, { type: "start" });
  for (const orders of r.log) {
    s = stepDay({ ...s, game: queue(s.game, orders) });
  }
  return {
    ...s,
    game: queue(s.game, r.pending),
    ff: false,
    bigDay: false,
    breaking: null,
    endOpen: false,
    toasts: [],
    damage: [],
    goblin: null,
    dividend: null,
    stamps: [],
    shieldFx: null,
    shakeId: 0,
    heroT: -1,
  };
}
