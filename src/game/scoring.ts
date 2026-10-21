// End-of-run scoring (spec §7). Pure: a DayRecord history + the scenario in, plain numbers and lines out.
// Conventions (fixed so every number reproduces):
// - daily return r_t = V_t / V_{t-1} - 1, close to close, total value (fees, dividends and interest included);
// - risk-free rate earned that night rf_t = max(irx_{t-1}, 0) / 100 / 252 (the same rate cash earns);
// - volatility = sample std of r × √252; Sharpe = mean(r - rf) / sample std(r - rf) × √252, N/A when std ≈ 0.
import {
  halfHearts,
  type Asset,
  type DayRecord,
  type Scenario,
} from "../engine";

const ANNUAL = Math.sqrt(252);
/** Below this daily std a series is flat (all cash): Sharpe is undefined. */
const FLAT_STD = 1e-9;

export interface Stats {
  finalValue: number;
  /** Fraction: 0.034 = +3.4%. */
  totalReturn: number;
  /** Fraction in [0, 1): 0.34 = fell 34% from a peak. */
  maxDrawdown: number;
  /** Annualized, fraction. */
  volatility: number;
  /** Annualized; null when the series has (near) zero volatility. */
  sharpe: number | null;
}

export type RankId = "panic" | "survivor" | "steady" | "legend";
export interface Rank {
  id: RankId;
  title: string;
  blurb: string;
}

export const RANKS: Record<RankId, Rank> = {
  panic: {
    id: "panic",
    title: "PANIC SELLER",
    blurb:
      "Your moves took on more pain than they paid for. Doing nothing scored better.",
  },
  survivor: {
    id: "survivor",
    title: "SURVIVOR",
    blurb: "You made it through, but sitting still was a little smarter.",
  },
  steady: {
    id: "steady",
    title: "STEADY HAND",
    blurb: "You matched or beat the ghost for the risk you took.",
  },
  legend: {
    id: "legend",
    title: "LEGEND",
    blurb: "Your decisions clearly beat doing nothing, risk included.",
  },
};

export interface Report {
  you: Stats;
  ghost: Stats;
  /** Your Sharpe - ghost Sharpe; null when either is N/A (then the rank uses total return). */
  gap: number | null;
  rank: Rank;
  /** Half-hearts hit 0 at some close (a 25% fall from the peak). */
  brokeLimit: boolean;
  /** The regret reveal (or the "never traded" line). */
  regret: string;
  /** Best buy after day 1 that went on to rise, if any. */
  bestBuy: string | null;
  fees: number;
  dividends: number;
  interest: number;
  locked: number;
  /** SHIELD premiums paid / payouts received over the run (0 / 0 when none was bought). */
  shieldPaid: number;
  shieldBack: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** Sample standard deviation (n - 1); 0 for fewer than two points. */
export function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Daily close-to-close returns of total value: r[i] is the return from day i to day i + 1. */
export function dailyReturns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) r.push(values[i] / values[i - 1] - 1);
  return r;
}

/** Largest fall from a running peak, as a fraction. */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.max(worst, 1 - v / peak);
  }
  return worst;
}

/** Risk-free rate for the night before day t (t >= 1): the previous close's T-bill yield, floored at 0. */
export const dailyRf = (scenario: Scenario, t: number) =>
  Math.max(scenario.days[t - 1].irx, 0) / 100 / 252;

export function statsFor(history: DayRecord[], scenario: Scenario): Stats {
  const values = history.map((h) => h.value);
  const r = dailyReturns(values);
  const excess = r.map((x, i) => x - dailyRf(scenario, history[i + 1].t));
  const sd = sampleStd(excess);
  return {
    finalValue: values[values.length - 1],
    totalReturn: values[values.length - 1] / values[0] - 1,
    maxDrawdown: maxDrawdown(values),
    volatility: sampleStd(r) * ANNUAL,
    sharpe: sd < FLAT_STD ? null : (mean(excess) / sd) * ANNUAL,
  };
}

/** Rank by skill gap d = your Sharpe - ghost Sharpe; if either is N/A, by total return vs the ghost. */
export function rankFor(you: Stats, ghost: Stats): Rank {
  if (you.sharpe === null || ghost.sharpe === null) {
    return you.totalReturn >= ghost.totalReturn - 1e-9
      ? RANKS.steady
      : RANKS.survivor;
  }
  const d = you.sharpe - ghost.sharpe;
  if (d < -0.5) return RANKS.panic;
  if (d < 0) return RANKS.survivor;
  if (d < 0.5) return RANKS.steady;
  return RANKS.legend;
}

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
/** "2020-03-16" -> "16 Mar". */
export const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MON[Number(m) - 1]}`;
};
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const wholePct = (f: number) =>
  `${f >= 0 ? "+" : "-"}${Math.abs(Math.round(f * 100))}%`;

interface Trade {
  t: number;
  date: string;
  asset: Asset;
  side: "buy" | "sell";
  shares: number;
  price: number;
  /** Final close / fill price - 1. */
  move: number;
  /** shares × (final close - fill price): what the shares gained (or lost) after the trade. */
  after: number;
}

/** Fills grouped by day + asset + side (several SELL clicks on one day are one trade at one open price). */
function trades(history: DayRecord[], scenario: Scenario): Trade[] {
  const last = scenario.days[scenario.days.length - 1];
  const map = new Map<string, Trade>();
  for (const rec of history) {
    for (const e of rec.events) {
      if (e.kind !== "fill") continue;
      const key = `${rec.t}:${e.asset}:${e.side}`;
      const prev = map.get(key);
      const shares = (prev?.shares ?? 0) + e.shares;
      const final = last[e.asset].c;
      map.set(key, {
        t: rec.t,
        date: rec.date,
        asset: e.asset,
        side: e.side,
        shares,
        price: e.price,
        move: final / e.price - 1,
        after: shares * (final - e.price),
      });
    }
  }
  return [...map.values()];
}

/** The regret reveal: the sell that missed the biggest rise (in dollars), else the best-timed sell. */
export function regretLine(history: DayRecord[], scenario: Scenario): string {
  const all = trades(history, scenario);
  // The day-1 bag is the ghost's bag too; anything after that is a decision.
  if (!all.some((x) => x.t >= 2))
    return "You never traded. That's the ghost's whole strategy.";
  const end = dayMonth(scenario.days[scenario.days.length - 1].date);
  const sells = all.filter((x) => x.side === "sell");
  if (!sells.length)
    return "You never sold. Every share you bought rode out the crash to the end.";
  const worst = sells.reduce((a, b) => (b.after > a.after ? b : a));
  const final = scenario.days[scenario.days.length - 1][worst.asset].c;
  const head = `You sold ${worst.asset} on ${dayMonth(worst.date)} at ${usd(worst.price)}. By ${end} it was ${usd(final)} (${wholePct(worst.move)})`;
  return worst.after > 0
    ? `${head}.`
    : `${head}. Good exit: it fell after you sold.`;
}

/** The best buy after the day-1 bag that went on to rise (bought the dip), or null. */
export function bestBuyLine(
  history: DayRecord[],
  scenario: Scenario,
): string | null {
  const buys = trades(history, scenario).filter(
    (x) => x.side === "buy" && x.t >= 2 && x.after > 0,
  );
  if (!buys.length) return null;
  const best = buys.reduce((a, b) => (b.after > a.after ? b : a));
  const final = scenario.days[scenario.days.length - 1][best.asset].c;
  const end = dayMonth(scenario.days[scenario.days.length - 1].date);
  return `Best buy: ${best.asset} on ${dayMonth(best.date)} at ${usd(best.price)}. By ${end} it was ${usd(final)} (${wholePct(best.move)}).`;
}

export function buildReport(
  history: DayRecord[],
  ghostHistory: DayRecord[],
  scenario: Scenario,
): Report {
  const you = statsFor(history, scenario);
  const ghost = statsFor(ghostHistory, scenario);
  const last = history[history.length - 1];
  return {
    you,
    ghost,
    gap:
      you.sharpe === null || ghost.sharpe === null
        ? null
        : you.sharpe - ghost.sharpe,
    rank: rankFor(you, ghost),
    brokeLimit: history.some((h) => halfHearts(h.drawdown) === 0),
    regret: regretLine(history, scenario),
    bestBuy: bestBuyLine(history, scenario),
    fees: last.feesPaid,
    dividends: last.dividendsReceived,
    interest: last.interestEarned,
    locked: last.realizedPnl,
    shieldPaid: last.shieldPremiums,
    shieldBack: last.shieldPayouts,
  };
}

