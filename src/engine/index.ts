// Game engine: pure functions, no React. Every function returns a new state; inputs are never mutated.
// Contract is fixed; implementations are filled in by the engine task. See docs/superpowers/specs (§3).
import { ASSETS } from "./types";
import { bsPut } from "./options";
import type {
  Asset,
  GameEvent,
  DayRecord,
  GameState,
  Holdings,
  Order,
  Scenario,
  Weights,
} from "./types";


export * from "./types";
export { bsPut, normCdf } from "./options";

export const START_CASH = 10_000;
export const FEE_RATE = 0.001;
export const TRADE_STEP = 0.1;
/** One half-heart = 2.5% drawdown (10 half-hearts = 25% drawdown = dead). */
export const HEART_STEP = 0.025;
/** SHIELD (spec §5): strike = 95% of SPY at the fill, 21 trading days to expiry. */
export const SHIELD_MONEYNESS = 0.95;
export const SHIELD_DAYS = 21;


const EPS_USD = 1e-9;
const EPS_SH = 1e-12;

const cloneHoldings = (h: Holdings): Holdings => ({
  cash: h.cash,
  shares: { SPY: h.shares.SPY, TLT: h.shares.TLT, GLD: h.shares.GLD },
  cost: { SPY: h.cost.SPY, TLT: h.cost.TLT, GLD: h.cost.GLD },
  shield: h.shield ? { ...h.shield } : null,
});

/** New game at t = 0 (first day's close), all cash, history = [record for t = 0]. */
export function newGame(
  scenario: Scenario,
  startCash: number = START_CASH,
): GameState {
  const holdings: Holdings = {
    cash: startCash,
    shares: { SPY: 0, TLT: 0, GLD: 0 },
    cost: { SPY: 0, TLT: 0, GLD: 0 },
    shield: null,
  };
  return {
    scenario,
    t: 0,
    holdings,
    pending: [],
    history: [
      {
        t: 0,
        date: scenario.days[0].date,
        holdings: cloneHoldings(holdings),
        value: startCash,
        peak: startCash,
        drawdown: 0,
        feesPaid: 0,
        dividendsReceived: 0,
        interestEarned: 0,
        realizedPnl: 0,
        shieldValue: 0,
        shieldPremiums: 0,
        shieldPayouts: 0,
        events: [],
      },
    ],
    feesPaid: 0,
    dividendsReceived: 0,
    interestEarned: 0,
    realizedPnl: 0,
    peak: startCash,
    shieldValue: 0,
    shieldPremiums: 0,
    shieldPayouts: 0,
  };
}

/** False on the last day (no next open to fill at). */
export function canTrade(state: GameState): boolean {
  return state.t < state.scenario.days.length - 1;
}

/** Append an order to pending. Throws if !canTrade(state). */
export function queueOrder(state: GameState, order: Order): GameState {
  if (!canTrade(state)) throw new Error("Cannot trade on the last day");
  return { ...state, pending: [...state.pending, order] };
}

/** Total value at close t: cash + shares × close + SHIELD mark. */
const totalValue = (state: GameState): number =>
  valueAt(state.holdings, state.scenario, state.t, "c") + state.shieldValue;

const tenPercent = (state: GameState): number => TRADE_STEP * totalValue(state);

/** Queue a buy of 10% of total value (SHIELD mark included) at the current close. */
export function buy(state: GameState, asset: Asset): GameState {
  return queueOrder(state, { kind: "buy", asset, dollars: tenPercent(state) });
}

/** Queue a sell of 10% of total value (SHIELD mark included) at the current close (capped at shares held when it fills). */
export function sell(state: GameState, asset: Asset): GameState {
  return queueOrder(state, { kind: "sell", asset, dollars: tenPercent(state) });
}

/** Queue a re-target of the whole bag. Weights split cash + stocks/bonds/gold; an active SHIELD is left as is. */
export function setTarget(state: GameState, weights: Weights): GameState {
  const keys: (Asset | "CASH")[] = [...ASSETS, "CASH"];
  let sum = 0;
  for (const k of keys) {
    const w = weights[k];
    if (!(w >= 0 && w <= 1)) throw new Error(`Weight for ${k} must be in [0, 1]`);
    sum += w;
  }
  if (Math.abs(sum - 1) > 1e-9) throw new Error("Weights must sum to 1");
  return queueOrder(state, {
    kind: "target",
    weights: { SPY: weights.SPY, TLT: weights.TLT, GLD: weights.GLD, CASH: weights.CASH },
  });
}

/** Panic button: queue 100% cash. */
export function panic(state: GameState): GameState {
  return setTarget(state, { SPY: 0, TLT: 0, GLD: 0, CASH: 1 });
}

export type ShieldBlock = "active" | "queued" | "noStocks" | "lastDays";

/**
 * Whether a SHIELD can be queued at close t. Checked in this order:
 * active (one already running), queued (one already pending), noStocks (0 SPY shares held now; pending
 * buys are not counted), lastDays (fill at t+1 + 21 trading days would expire past the last day).
 */
export function canShield(state: GameState): { ok: boolean; reason?: ShieldBlock } {
  if (state.holdings.shield) return { ok: false, reason: "active" };
  if (state.pending.some((o) => o.kind === "shield")) return { ok: false, reason: "queued" };
  if (!(state.holdings.shares.SPY > EPS_SH)) return { ok: false, reason: "noStocks" };
  if (state.t + 1 + SHIELD_DAYS > state.scenario.days.length - 1) return { ok: false, reason: "lastDays" };
  return { ok: true };
}

/**
 * Price ESTIMATE shown before buying, from close t: S = today's SPY close, K = 0.95·S, σ = today's VIX/100,
 * r = max(IRX, 0)/100, T = 21/252, contracts = SPY shares held now (shares a pending BUY would add are not
 * counted). The real premium is set at the next open (S = SPY open), so it differs a little.
 */
export function shieldQuote(state: GameState): {
  strike: number;
  premium: number;
  contracts: number;
  perShare: number;
} {
  const d = state.scenario.days[state.t];
  const S = d.SPY.c;
  const strike = SHIELD_MONEYNESS * S;
  const perShare = bsPut(S, strike, d.vix / 100, Math.max(d.irx, 0) / 100, SHIELD_DAYS / 252);
  const contracts = state.holdings.shares.SPY;
  return { strike, premium: contracts * perShare, contracts, perShare };
}

/** Queue a SHIELD. Throws with the canShield reason if it isn't allowed. */
export function buyShield(state: GameState): GameState {
  const c = canShield(state);
  if (!c.ok) throw new Error(`Cannot buy SHIELD: ${c.reason}`);
  return queueOrder(state, { kind: "shield" });
}

/** Drop all pending orders. */
export function cancelPending(state: GameState): GameState {
  return { ...state, pending: [] };
}

/**
 * Move to t + 1: interest on overnight cash, dividends for shares held at the previous close, fills at the open
 * (in queue order, then any SHIELD last, selling SPY to fund it if cash is short), SHIELD expiry payout,
 * mark at the close. Throws on the last day.
 */
export function advance(state: GameState): GameState {
  const { scenario } = state;
  if (state.t >= scenario.days.length - 1) {
    throw new Error("Cannot advance past the last day");
  }
  const prev = scenario.days[state.t];
  const d = scenario.days[state.t + 1];
  const h = cloneHoldings(state.holdings);
  const events: GameEvent[] = [];
  let feesPaid = state.feesPaid;
  let dividendsReceived = state.dividendsReceived;
  let interestEarned = state.interestEarned;
  let realizedPnl = state.realizedPnl;
  let shieldPremiums = state.shieldPremiums;
  let shieldPayouts = state.shieldPayouts;
  const t = state.t + 1;

  // 1. Interest on cash held overnight. Floored at 0: IRX dips slightly negative in Mar 2020 and cash never pays to hold.
  const interest = h.cash * (prev.irx / 100 / 252);
  if (interest > 0) {
    h.cash += interest;
    interestEarned += interest;
    events.push({ kind: "interest", amount: interest });
  }

  // 2. Dividends on shares held at the previous close.
  for (const a of ASSETS) {
    const perShare = d[a].div;
    if (perShare > 0 && h.shares[a] > 0) {
      const amount = h.shares[a] * perShare;
      h.cash += amount;
      dividendsReceived += amount;
      events.push({ kind: "dividend", asset: a, perShare, shares: h.shares[a], amount });
    }
  }

  // 3. Fills at the open.
  const doBuy = (a: Asset, dollars: number) => {
    let D = dollars;
    if (h.cash < D * (1 + FEE_RATE)) D = h.cash / (1 + FEE_RATE);
    if (D <= EPS_USD) return;
    const price = d[a].o;
    const sh = D / price;
    const fee = D * FEE_RATE;
    h.shares[a] += sh;
    h.cost[a] += D * (1 + FEE_RATE);
    h.cash -= D * (1 + FEE_RATE);
    if (h.cash < 0 && h.cash > -EPS_USD) h.cash = 0;
    feesPaid += fee;
    events.push({ kind: "fill", asset: a, side: "buy", shares: sh, price, dollars: D, fee });
  };
  const doSell = (a: Asset, dollars: number) => {
    const price = d[a].o;
    const sh = Math.min(h.shares[a], dollars / price);
    if (sh <= EPS_SH) return;
    const proceeds = sh * price;
    const fee = proceeds * FEE_RATE;
    const basisSold = (h.cost[a] / h.shares[a]) * sh;
    const realized = proceeds - fee - basisSold;
    h.cash += proceeds - fee;
    h.cost[a] -= basisSold;
    h.shares[a] -= sh;
    if (h.shares[a] < 1e-9) {
      h.shares[a] = 0;
      h.cost[a] = 0;
    }
    feesPaid += fee;
    realizedPnl += realized;
    events.push({ kind: "fill", asset: a, side: "sell", shares: sh, price, dollars: proceeds, fee, realized });
  };

  for (const order of state.pending) {
    if (order.kind === "shield") continue; // handled after every other fill
    if (order.kind === "buy") doBuy(order.asset, order.dollars);
    else if (order.kind === "sell") doSell(order.asset, order.dollars);
    else {
      let V = h.cash;
      for (const a of ASSETS) V += h.shares[a] * d[a].o;
      const diffs = {} as Record<Asset, number>;
      for (const a of ASSETS) diffs[a] = order.weights[a] * V - h.shares[a] * d[a].o;
      for (const a of ASSETS) if (diffs[a] < 0) doSell(a, -diffs[a]);
      let needed = 0;
      for (const a of ASSETS) if (diffs[a] > 0) needed += diffs[a] * (1 + FEE_RATE);
      const scale = needed > h.cash ? h.cash / needed : 1;
      for (const a of ASSETS) if (diffs[a] > 0) doBuy(a, diffs[a] * scale);
    }
  }

  // 3b. SHIELD fills last, on the SPY shares held after the other fills. Priced with Black-Scholes at
  // S = today's open, σ and r from the previous close (the latest known), T = 21/252. No fee on the premium.
  // Short of cash (e.g. ALL IN): first sell just enough SPY at this open to pay the premium on the shares
  // that are left. Solved exactly: with n shares, cash c, put price p and fee f, selling
  // x = (n·p − c) / (S·(1 − f) + p) shares leaves c + x·S·(1 − f) = (n − x)·p, so cash ends at 0, never below.
  // x < n always (it would need c < 0), so a held SPY position can always fund its own shield.
  if (state.pending.some((o) => o.kind === "shield") && !h.shield) {
    if (!(h.shares.SPY > EPS_SH)) {
      events.push({ kind: "shieldSkipped", reason: "noStocks" });
    } else {
      const S = d.SPY.o;
      const strike = SHIELD_MONEYNESS * S;
      const p = bsPut(S, strike, prev.vix / 100, Math.max(prev.irx, 0) / 100, SHIELD_DAYS / 252);
      if (h.cash < h.shares.SPY * p) {
        const x = (h.shares.SPY * p - h.cash) / (S * (1 - FEE_RATE) + p);
        doSell("SPY", x * S);
      }
      const contracts = h.shares.SPY;
      const premium = contracts * p;
      h.cash -= premium;
      if (h.cash < 0 && h.cash > -1e-7) h.cash = 0; // float dust from the exact solve
      shieldPremiums += premium;
      const expiryT = t + SHIELD_DAYS;
      h.shield = { contracts, strike, expiryT, premiumPaid: premium, boughtT: t };
      events.push({ kind: "shieldBuy", contracts, strike, premium, expiryT });
    }
  }

  // 4. SHIELD at the close: pays max(K − SPY close, 0) per contract on its expiry day, else marked to market.
  let shieldValue = 0;
  if (h.shield) {
    const sh = h.shield;
    const spot = d.SPY.c;
    if (t >= sh.expiryT) {
      const amount = sh.contracts * Math.max(sh.strike - spot, 0);
      h.cash += amount;
      shieldPayouts += amount;
      events.push({ kind: "shieldPayout", amount, contracts: sh.contracts, strike: sh.strike, spot });
      h.shield = null;
    } else {
      shieldValue =
        sh.contracts *
        bsPut(spot, sh.strike, d.vix / 100, Math.max(d.irx, 0) / 100, (sh.expiryT - t) / 252);
    }
  }

  // 5. Mark at the close.
  let value = h.cash + shieldValue;
  for (const a of ASSETS) value += h.shares[a] * d[a].c;
  const peak = Math.max(state.peak, value);
  const drawdown = 1 - value / peak;
  const record: DayRecord = {
    t,
    date: d.date,
    holdings: cloneHoldings(h),
    value,
    peak,
    drawdown,
    feesPaid,
    dividendsReceived,
    interestEarned,
    realizedPnl,
    shieldValue,
    shieldPremiums,
    shieldPayouts,
    events,
  };
  return {
    scenario,
    t,
    holdings: h,
    pending: [],
    history: [...state.history, record],
    feesPaid,
    dividendsReceived,
    interestEarned,
    realizedPnl,
    peak,
    shieldValue,
    shieldPremiums,
    shieldPayouts,
  };
}

/** Cash + shares value at the given day's open or close. Excludes the SHIELD (use DayRecord.value / state.shieldValue for that). */
export function valueAt(
  holdings: Holdings,
  scenario: Scenario,
  t: number,
  field: "o" | "c",
): number {
  let v = holdings.cash;
  for (const a of ASSETS) v += holdings.shares[a] * scenario.days[t][a][field];
  return v;
}

/**
 * Current weights at close t (drift included). The total includes the SHIELD mark, but the SHIELD gets no
 * weight of its own, so with a shield active the four weights sum to slightly less than 1.
 */
export function currentWeights(state: GameState): Weights {
  const { holdings, scenario, t } = state;
  const total = totalValue(state);
  if (!(total > 0)) return { SPY: 0, TLT: 0, GLD: 0, CASH: 1 };
  const w = (a: Asset) => (holdings.shares[a] * scenario.days[t][a].c) / total;
  return { SPY: w("SPY"), TLT: w("TLT"), GLD: w("GLD"), CASH: holdings.cash / total };
}

/** Paper (unrealized) P&L for one asset at close t: what it's worth now minus what you paid, buy fees included. */
export function paperPnl(state: GameState, asset: Asset): number {
  const { holdings, scenario, t } = state;
  return holdings.shares[asset] * scenario.days[t][asset].c - holdings.cost[asset];
}

/** Half-hearts left (0..10) for a drawdown in [0, 1). */
export function halfHearts(drawdown: number): number {
  return Math.min(10, Math.max(0, 10 - Math.floor(drawdown / HEART_STEP + 1e-9)));
}

/** "Did nothing" ghost: takes the player's day-0 orders, same fills and costs, then holds to the end. Never buys a SHIELD (shield orders are dropped). Full series; the UI must only show records up to the current t. */
export function runGhost(
  scenario: Scenario,
  day0Orders: Order[],
  startCash: number = START_CASH,
): DayRecord[] {
  let s = newGame(scenario, startCash);
  for (const o of day0Orders) if (o.kind !== "shield") s = queueOrder(s, o);
  while (canTrade(s)) s = advance(s);
  return s.history;
}
