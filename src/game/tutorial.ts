// NEWS BOT coach (spec §8b): each part of the screen is explained the moment the player first has to use it, and the
// yellow frame marks only that part. Tips never block trading (spec §6b): the game is turn-based, and FAST-FORWARD
// stops when a new tip shows up.
// Everything here is pure except loadSeen/saveSeen (localStorage, every call wrapped in try/catch).
import { halfHearts } from "../engine";
import type { GameEvent } from "../engine";
import {
  BOND,
  COIN,
  GOBLIN_GRIN,
  GOLD,
  HEART_FULL,
  PIG,
  ROCKET,
  SKULL,
  type Sprite,
} from "./sprites";
import type { Phase, UiState } from "./store";

export const TIP_IDS = [
  "welcome",
  "watchlist",
  "bag",
  "pickBag",
  "nextDay",
  "topBar",
  "chart",
  "fastForward",
  "trade",
  "shield",
  "hearts",
  "fear",
  "dividend",
  "locked",
] as const;
export type TipId = (typeof TIP_IDS)[number];

/** The day-0 tips that explain the screen before the first decision. */
const INTRO: readonly TipId[] = ["welcome", "watchlist", "bag"];

/** One line of a tip: an optional pixel icon, an optional bold label, then the plain-words explanation. */
export interface Bullet {
  icon?: Sprite;
  label?: string;
  text: string;
}

export interface Tip {
  /** Short heading shown above the text. */
  title?: string;
  /** The lead line (typed out). */
  text: string;
  bullets?: Bullet[];
  /** data-tut keys of the elements to spotlight (only these); the first one is the primary (bubble anchors to it). */
  targets: string[];
  /** Gated tips have no GOT IT: they close when the player does the thing. */
  gated?: boolean;
}

export const TIPS: Record<TipId, Tip> = {
  welcome: {
    text: "Hi! I'm NEWS BOT. It's 10 Feb 2020 and you have $10,000. Let's survive what's coming.",
    targets: ["money"],
  },
  watchlist: {
    title: "WATCHLIST",
    text: "These are the things you can invest in, plus a fear gauge.",
    targets: ["watch"],
    bullets: [
      {
        icon: ROCKET,
        label: "SPY = stocks.",
        text: "One share holds a tiny slice of the 500 biggest US companies. Big gains, big crashes.",
      },
      {
        icon: BOND,
        label: "TLT = bonds.",
        text: "Loans to the US government. They often rise when people panic.",
      },
      {
        icon: GOLD,
        label: "GLD = gold.",
        text: "The old-school 'safe place'.",
      },
      {
        icon: SKULL,
        label: "VIX = fear.",
        text: "How scared the market is. You can't buy it, just watch it.",
      },
      {
        text: "The % is today's change. Tap a row to choose what BUY and SELL trade.",
      },
    ],
  },
  bag: {
    title: "YOUR BAG",
    text: "This is your money, split up. Right now it's all cash.",
    targets: ["bag"],
    bullets: [
      { text: "Each bar shows how much of your money sits in that thing." },
      {
        icon: PIG,
        label: "CASH",
        text: "is safe, but earns almost nothing.",
      },
      {
        label: "'paper'",
        text: "is how much you're up or down on it right now. It's only real once you sell.",
      },
    ],
  },
  pickBag: {
    title: "PICK YOUR BAG",
    text: "Pick how to split your $10,000. One tap sets your whole bag.",
    targets: ["presets"],
    gated: true,
    bullets: [
      { label: "ALL IN", text: "= everything in stocks (riskiest)." },
      { label: "50-50", text: "= half stocks, half bonds." },
      {
        label: "BALANCED",
        text: "= 60% stocks, 20% bonds, 10% gold, 10% cash.",
      },
      { label: "ALL CASH", text: "= keep it all as cash." },
    ],
  },
  nextDay: {
    title: "NEXT DAY",
    text: "Your order is queued. It fills tomorrow morning at the opening price. Press NEXT DAY to go to tomorrow.",
    targets: ["play"],
    gated: true,
  },
  topBar: {
    title: "TOP BAR",
    text: "",
    targets: ["money", "hearts", "ghost", "fees"],
    bullets: [
      { icon: COIN, text: "= all your money added up." },
      {
        icon: HEART_FULL,
        label: "Hearts",
        text: "show how far you've fallen from your best day (each heart = 5%).",
      },
      {
        label: "GHOST",
        text: "= what you'd have if you never traded after day 1. Beat it.",
      },
      {
        icon: GOBLIN_GRIN,
        label: "The goblin",
        text: "eats 0.1% of every trade (fees).",
      },
    ],
  },
  chart: {
    title: "CHART",
    text: "SPY's price, one bar ('candle') per day.",
    targets: ["chart"],
    bullets: [
      { text: "Green = it went up that day. Red = it went down." },
      { text: "The fog is the future. No peeking." },
    ],
  },
  fastForward: {
    title: "FAST-FORWARD",
    text: "Quiet day. FAST-FORWARD zips through quiet days and stops by itself when something big happens.",
    targets: ["ff"],
  },
  trade: {
    title: "TRADE",
    text: "Big day! Read the news, then decide. Small moves on the one you picked in the watchlist.",
    targets: ["trade"],
    bullets: [
      {
        label: "BUY",
        text: "= put 10% of your money into it. You need cash for this.",
      },
      {
        label: "SELL",
        text: "= take 10% of your money out of it, back to cash.",
      },
      { icon: PIG, label: "CASH", text: "= panic button: sell everything." },
      {
        text: "Orders happen tomorrow morning at the opening price, and every trade costs 0.1%.",
      },
    ],
  },
  shield: {
    title: "SHIELD (insurance)",
    text: "Insurance on your stocks.",
    targets: ["shield"],
    bullets: [
      { text: "Covers drops below -5% for 1 month." },
      { text: "You pay a small price up front (the 'premium')." },
      { text: "The price follows FEAR: cheap when calm, expensive in a panic." },
      { text: "If stocks crash, it pays you the difference." },
    ],
  },
  hearts: {
    text: "Hearts = how far you've fallen from your best day. Each heart is 5%. Lose them all and you're in deep trouble.",
    targets: ["hearts"],
  },
  fear: {
    text: "This is the FEAR meter (the VIX). It shows how scared the whole market is.",
    targets: ["mood"],
  },
  dividend: {
    text: "A dividend! Some funds pay you cash just for holding them.",
    targets: ["bag"],
  },
  locked: {
    text: "LOCKED: you sold, so that gain or loss is now permanent. 'paper' numbers can still change.",
    targets: ["bag"],
  },
};


/** The slice of game state the tip rules look at. */
export interface TutorialSnap {
  phase: Phase;
  t: number;
  pendingCount: number;
  events: readonly GameEvent[];
  ghostVisible: boolean;
  halfHearts: number;
  bigDay: boolean;
  vix: number;
  /** Holds (or has bought) SPY shares: the only thing a SHIELD can cover. */
  hasStocks: boolean;
}

export function snapshot(st: UiState): TutorialSnap {
  const { game } = st;
  const rec = game.history[game.t];
  return {
    phase: st.phase,
    t: game.t,
    pendingCount: game.pending.length,
    events: rec.events,
    ghostVisible: !!st.ghost?.[game.t],
    halfHearts: halfHearts(rec.drawdown),
    bigDay: st.bigDay,
    vix: game.scenario.days[game.t].vix,
    hasStocks: game.holdings.shares.SPY > 1e-9,
  };
}

/**
 * Which tips to show for the move prev -> next, in tip order, skipping any in `seen`.
 * prev = null means a fresh look (page load or "?" replay): only the welcome and state-based tips fire.
 * Event tips (fills, dividends, new days) need the day to have advanced, so a replay never re-fires today's.
 */
export function tipsToShow(
  prev: TutorialSnap | null,
  next: TutorialSnap,
  seen: ReadonlySet<TipId>,
): TipId[] {
  if (next.phase === "end") return [];
  const newDay = !!prev && next.t > prev.t;
  const fills = next.events.filter((e) => e.kind === "fill");
  const want: Record<TipId, boolean> = {
    welcome: prev === null,
    watchlist: prev === null,
    bag: prev === null,
    pickBag: next.phase === "pick" && next.pendingCount === 0,
    // Right after the bag is picked (day 0): the one thing left is pressing NEXT DAY.
    nextDay: next.phase === "pick" && next.pendingCount > 0,
    // Day 1: the first fill just happened, so the goblin line belongs here.
    topBar: newDay && next.t >= 1,
    chart: newDay && next.t >= 2,
    // First quiet day after day 3.
    fastForward: newDay && next.t > 3 && !next.bigDay,
    trade: newDay && next.bigDay,
    // First time the player holds stocks on a big day or a nervous market: insurance is now worth knowing.
    shield: newDay && next.hasStocks && (next.bigDay || next.vix > 25),
    hearts: newDay && next.halfHearts < 10,
    fear: newDay && next.vix > 30,
    dividend: newDay && next.events.some((e) => e.kind === "dividend"),
    locked: newDay && fills.some((e) => e.kind === "fill" && e.side === "sell"),
  };
  return TIP_IDS.filter((id) => want[id] && !seen.has(id));
}

/** True when the player already did what the tip asks, so it closes by itself. */
export function tipDone(
  id: TipId,
  prev: TutorialSnap,
  next: TutorialSnap,
): boolean {
  const nextDay = next.t > prev.t;
  switch (id) {
    case "pickBag":
      // Done when a bag is queued, or when the player starts anyway (all cash): nothing left to pick.
      return next.pendingCount > 0 || next.phase !== "pick";
    case "nextDay":
    case "trade":
      return nextDay;
    default:
      return false;
  }
}

export interface TutorialState {
  /** False until progress is loaded from storage; no tips fire before that. */
  ready: boolean;
  seen: TipId[];
  /** queue[0] is the tip on screen (held back while the story is open). */
  queue: TipId[];
  /** The story intro has been played through or skipped on this device. */
  storySeen: boolean;
  /** Story cards are on screen; tips wait behind them. */
  storyOpen: boolean;
}

export const tutorialInit = (): TutorialState => ({
  ready: false,
  seen: [],
  queue: [],
  storySeen: false,
  storyOpen: false,
});

const addSeen = (seen: TipId[], ids: TipId[]) =>
  TIP_IDS.filter((id) => seen.includes(id) || ids.includes(id));

/** Fold one game transition into the tutorial: close tips the player acted on, queue new ones. */
export function tutorialStep(
  tut: TutorialState,
  prev: TutorialSnap,
  next: TutorialSnap,
): TutorialState {
  if (!tut.ready) return tut;
  if (next.phase === "end")
    return tut.queue.length ? { ...tut, queue: [] } : tut;
  const done = tut.queue.filter((id) => tipDone(id, prev, next));
  const seen = done.length ? addSeen(tut.seen, done) : tut.seen;
  const queue = tut.queue.filter((id) => !done.includes(id));
  const fresh = tipsToShow(prev, next, new Set([...seen, ...queue]));
  if (!done.length && !fresh.length) return tut;
  if (fresh.includes("nextDay")) {
    // The player picked a bag. Pressing NEXT DAY is the only thing left to do, so that prompt goes first. The
    // intro tips still waiting behind it are moot (their panels were never blocked), so they count as seen
    // instead of burying the prompt (they used to, which is why NEXT DAY was never pointed out).
    const skipped = queue.filter((id) => INTRO.includes(id));
    return {
      ...tut,
      seen: addSeen(seen, skipped),
      queue: [
        "nextDay",
        ...queue.filter((id) => !INTRO.includes(id)),
        ...fresh.filter((id) => id !== "nextDay"),
      ],
    };
  }
  return { ...tut, seen, queue: [...queue, ...fresh] };
}

export interface SavedProgress {
  seen: TipId[];
  storySeen: boolean;
}

export function tutorialLoad(
  saved: SavedProgress,
  now: TutorialSnap,
): TutorialState {
  const seen = TIP_IDS.filter((id) => saved.seen.includes(id));
  return {
    ready: true,
    seen,
    queue: tipsToShow(null, now, new Set(seen)),
    storySeen: saved.storySeen,
    storyOpen: !saved.storySeen && now.phase === "pick",
  };
}

/** An ⓘ button: bring that tip up now, ahead of anything queued. Doesn't touch what was seen or the game. */
export function tutorialShow(tut: TutorialState, id: TipId): TutorialState {
  if (!tut.ready || tut.storyOpen || tut.queue[0] === id) return tut;
  return { ...tut, queue: [id, ...tut.queue.filter((q) => q !== id)] };
}

/** GOT IT: the tip on screen is done. */
export function tutorialClose(tut: TutorialState): TutorialState {
  const [head, ...rest] = tut.queue;
  if (!head) return tut;
  return { ...tut, seen: addSeen(tut.seen, [head]), queue: rest };
}

export function tutorialSkip(tut: TutorialState): TutorialState {
  return { ...tut, seen: [...TIP_IDS], queue: [], storyOpen: false };
}

/** Story finished or skipped: the queued tips (welcome first) take over. */
export function tutorialStoryDone(tut: TutorialState): TutorialState {
  return { ...tut, storySeen: true, storyOpen: false };
}

/** "?" button: forget everything and start again from the story, then the welcome. */
export function tutorialReplay(
  tut: TutorialState,
  now: TutorialSnap,
): TutorialState {
  return {
    ready: true,
    seen: [],
    queue: tipsToShow(null, now, new Set()),
    storySeen: tut.storySeen,
    storyOpen: now.phase !== "end",
  };
}

// ---------- Storage (this device only) ----------
export const STORAGE_KEY = "stc.tutorial.v2";

export function loadProgress(): SavedProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { seen: [], storySeen: false };
    const p = parsed as { seen?: unknown; storySeen?: unknown };
    const seen = Array.isArray(p.seen) ? p.seen : [];
    return {
      seen: TIP_IDS.filter((id) => seen.includes(id)),
      storySeen: p.storySeen === true,
    };
  } catch {
    return { seen: [], storySeen: false };
  }
}

export function saveProgress(p: SavedProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked or full: the tutorial still works, it just won't remember.
  }
}
