import { describe, expect, it } from "vitest";
import {
  advance,
  canTrade,
  newGame,
  panic,
  runGhost,
  setTarget,
  type Bar,
  type DayRecord,
  type GameEvent,
  type Scenario,
} from "../engine";
import { PRESETS, SCENARIO } from "./scenario";
import {
  buildReport,
  maxDrawdown,
  rankFor,
  regretLine,
  bestBuyLine,
  statsFor,
  type Stats,
} from "./scoring";

const bar = (o: number, c = o): Bar => ({
  o,
  h: Math.max(o, c),
  l: Math.min(o, c),
  c,
  adj: c,
  div: 0,
});

/** A tiny scenario: SPY/TLT/GLD opens/closes per day and a T-bill yield per day. */
function scenario(
  dates: string[],
  irx: number[],
  px: Partial<Record<"SPY" | "TLT" | "GLD", number[]>> = {},
): Scenario {
  return {
    meta: {
      id: "t",
      name: "t",
      start: dates[0],
      end: dates.at(-1)!,
      tradingDays: dates.length,
      source: "",
      notes: [],
    },
    assets: {
      SPY: { label: "SPY" },
      TLT: { label: "TLT" },
      GLD: { label: "GLD" },
    },
    days: dates.map((date, i) => ({
      date,
      SPY: bar(px.SPY?.[i] ?? 100),
      TLT: bar(px.TLT?.[i] ?? 100),
      GLD: bar(px.GLD?.[i] ?? 100),
      vix: 20,
      irx: irx[i],
    })),
  };
}

/** History records with only the fields scoring reads. */
function history(
  values: number[],
  events: GameEvent[][] = [],
  dates?: string[],
): DayRecord[] {
  let peak = 0;
  return values.map((value, t) => {
    peak = Math.max(peak, value);
    return {
      t,
      date: dates?.[t] ?? `2020-01-0${t + 1}`,
      holdings: {
        cash: value,
        shares: { SPY: 0, TLT: 0, GLD: 0 },
        cost: { SPY: 0, TLT: 0, GLD: 0 },
        shield: null,
      },
      value,
      peak,
      drawdown: 1 - value / peak,
      feesPaid: 0,
      dividendsReceived: 0,
      interestEarned: 0,
      realizedPnl: 0,
      shieldValue: 0,
      shieldPremiums: 0,
      shieldPayouts: 0,
      events: events[t] ?? [],
    };
  });
}

const DATES4 = ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-06"];

describe("stats (hand-checked)", () => {
  // Values 100 -> 110 -> 99 -> 108.9: returns +10%, -10%, +10%.
  // mean = 1/30; sample std = sqrt(((2/30)^2 + (4/30)^2 + (2/30)^2) / 2) = sqrt(0.0266667 / 2) = 0.1154701.
  const vals = [100, 110, 99, 108.9];

  it("total return, max drawdown, volatility, Sharpe with rf = 0", () => {
    const s = statsFor(history(vals), scenario(DATES4, [0, 0, 0, 0]));
    expect(s.totalReturn).toBeCloseTo(0.089, 12);
    expect(s.maxDrawdown).toBeCloseTo(0.1, 12); // 110 -> 99
    expect(s.volatility).toBeCloseTo(Math.sqrt(0.08 / 3 / 2) * Math.sqrt(252), 12); // 1.833030
    expect(s.volatility).toBeCloseTo(1.83303, 4);
    expect(s.sharpe!).toBeCloseTo((1 / 30 / 0.1154701) * Math.sqrt(252), 5); // 4.582576
    expect(s.sharpe!).toBeCloseTo(4.58258, 4);
  });

  it("subtracts the PREVIOUS close's T-bill rate, floored at 0", () => {
    // rf for the night into day t uses irx[t - 1]: 2.52% -> 0.0001/day on the first night only; -1% floors to 0.
    const s = statsFor(history(vals), scenario(DATES4, [2.52, -1, 0, 5]));
    const ex = [0.1 - 0.0001, -0.1, 0.1];
    const m = (ex[0] + ex[1] + ex[2]) / 3;
    const sd = Math.sqrt(ex.reduce((a, x) => a + (x - m) ** 2, 0) / 2);
    expect(s.sharpe!).toBeCloseTo((m / sd) * Math.sqrt(252), 10);
    // A constant 2.52% shifts every excess return by 0.0001: std unchanged, mean down by 0.0001.
    const flatRf = statsFor(
      history(vals),
      scenario(DATES4, [2.52, 2.52, 2.52, 2.52]),
    );
    expect(flatRf.sharpe!).toBeCloseTo(
      ((1 / 30 - 0.0001) / 0.1154701) * Math.sqrt(252),
      5,
    ); // 4.56886
    expect(flatRf.volatility).toBeCloseTo(1.83303, 4); // volatility ignores rf
  });

  it("Sharpe is N/A on a flat series and on cash earning exactly the T-bill rate", () => {
    expect(
      statsFor(history([100, 100, 100, 100]), scenario(DATES4, [0, 0, 0, 0]))
        .sharpe,
    ).toBeNull();
    const rf = 2.52 / 100 / 252;
    const cash = [
      10_000,
      10_000 * (1 + rf),
      10_000 * (1 + rf) ** 2,
      10_000 * (1 + rf) ** 3,
    ];
    const s = statsFor(
      history(cash),
      scenario(DATES4, [2.52, 2.52, 2.52, 2.52]),
    );
    expect(s.sharpe).toBeNull();
    expect(s.maxDrawdown).toBe(0);
  });

  it("max drawdown takes the worst peak-to-trough fall, not the last one", () => {
    expect(maxDrawdown([100, 120, 60, 130, 117])).toBeCloseTo(0.5, 12);
  });
});

describe("rank boundaries (spec §7: d = your Sharpe - ghost Sharpe)", () => {
  const st = (sharpe: number | null, totalReturn = 0): Stats => ({
    finalValue: 0,
    totalReturn,
    maxDrawdown: 0,
    volatility: 0,
    sharpe,
  });
  const rank = (d: number) => rankFor(st(1 + d), st(1)).id;

  it.each([
    [-0.51, "panic"],
    [-0.5, "survivor"],
    [-0.01, "survivor"],
    [0, "steady"],
    [0.49, "steady"],
    [0.5, "legend"],
    [2, "legend"],
  ])("d = %s -> %s", (d, id) => expect(rank(d)).toBe(id));

  it("N/A Sharpe on either side ranks on return vs the ghost", () => {
    expect(rankFor(st(null, 0.01), st(0.4, 0.0)).id).toBe("steady");
    expect(rankFor(st(null, 0.0), st(0.4, 0.0)).id).toBe("steady");
    expect(rankFor(st(null, -0.05), st(0.4, 0.0)).id).toBe("survivor");
    expect(rankFor(st(0.4, 0.02), st(null, 0.03)).id).toBe("survivor");
  });
});

describe("regret reveal", () => {
  const dates = [
    "2020-03-13",
    "2020-03-16",
    "2020-03-17",
    "2020-03-23",
    "2020-06-30",
  ];
  const sc = scenario(dates, [0, 0, 0, 0, 0], {
    SPY: [270, 260, 241, 230, 308],
    GLD: [150, 150, 150, 160, 170],
    TLT: [160, 160, 160, 165, 150],
  });
  const fill = (
    asset: "SPY" | "TLT" | "GLD",
    side: "buy" | "sell",
    shares: number,
    price: number,
  ): GameEvent => ({
    kind: "fill",
    asset,
    side,
    shares,
    price,
    dollars: shares * price,
    fee: 0,
  });
  const vals = [10_000, 10_000, 10_000, 10_000, 10_000];

  it("picks the sell that missed the biggest rise in dollars", () => {
    const h = history(
      vals,
      [
        [],
        [fill("SPY", "buy", 30, 260)],
        [fill("SPY", "sell", 10, 241), fill("SPY", "sell", 5, 241)],
        [fill("GLD", "sell", 20, 160)],
      ],
      dates,
    );
    // SPY: 15 shares × (308 - 241) = $1,005 missed; GLD: 20 × (170 - 160) = $200.
    expect(regretLine(h, sc)).toBe(
      "You sold SPY on 17 Mar at $241. By 30 Jun it was $308 (+28%).",
    );
  });

  it("says so when the best-timed sell fell afterwards", () => {
    const h = history(
      vals,
      [[], [fill("TLT", "buy", 10, 160)], [], [fill("TLT", "sell", 10, 165)]],
      dates,
    );
    expect(regretLine(h, sc)).toBe(
      "You sold TLT on 23 Mar at $165. By 30 Jun it was $150 (-9%). Good exit: it fell after you sold.",
    );
  });

  it("never traded after the day-1 bag", () => {
    const h = history(vals, [[], [fill("SPY", "buy", 30, 260)]], dates);
    expect(regretLine(h, sc)).toBe(
      "You never traded. That's the ghost's whole strategy.",
    );
    expect(bestBuyLine(h, sc)).toBeNull();
  });

  it("best dip buy (day-1 bag excluded)", () => {
    const h = history(
      vals,
      [[], [fill("SPY", "buy", 30, 260)], [], [fill("SPY", "buy", 10, 230)]],
      dates,
    );
    expect(bestBuyLine(h, sc)).toBe(
      "Best buy: SPY on 23 Mar at $230. By 30 Jun it was $308 (+34%).",
    );
  });

  it("flags the 25% limit when half-hearts hit 0", () => {
    const sc4 = scenario(DATES4, [0, 0, 0, 0]);
    expect(
      buildReport(
        history([100, 76, 80, 90]),
        history([100, 100, 100, 100]),
        sc4,
      ).brokeLimit,
    ).toBe(false);
    expect(
      buildReport(
        history([100, 75, 80, 90]),
        history([100, 100, 100, 100]),
        sc4,
      ).brokeLimit,
    ).toBe(true);
  });
});

describe("real COVID data", () => {
  const w = (id: string) => PRESETS.find((p) => p.id === id)!.weights;
  const play = (id: string, panicOn?: string) => {
    let s = setTarget(newGame(SCENARIO), w(id));
    const ghost = runGhost(SCENARIO, s.pending);
    while (canTrade(s)) {
      s = advance(s);
      if (panicOn && SCENARIO.days[s.t].date === panicOn && canTrade(s))
        s = panic(s);
    }
    return buildReport(s.history, ghost, SCENARIO);
  };

  it("reproduces the spec's quoted Sharpes (ALL IN -0.13, 50-50 +0.53) on adjusted closes from 10 Feb", () => {
    // The spec's "why" numbers buy at the 10 Feb close with no fee and hold (adjusted close = total return).
    const adj = (a: "SPY" | "TLT") => SCENARIO.days.map((d) => d[a].adj);
    const spy = adj("SPY");
    const tlt = adj("TLT");
    const sharpe = (vals: number[]) =>
      statsFor(history(vals, [], SCENARIO.days.map((d) => d.date)), SCENARIO).sharpe!;
    expect(sharpe(spy)).toBeCloseTo(-0.1256, 4);
    expect(sharpe(spy.map((x, i) => 0.5 * (x / spy[0]) + 0.5 * (tlt[i] / tlt[0])))).toBeCloseTo(0.5251, 4);
  });

  it("in-game bags fill at the 11 Feb open and pay the fee, so they score a little lower", () => {
    expect(play("allin").you.sharpe!).toBeCloseTo(-0.161, 3);
    expect(play("allin").you.finalValue).toBeCloseTo(9246.8, 1); // the engine's hand-checked buy-and-hold
  });

  it("BALANCED, never trading = the ghost: d = 0, Steady Hand", () => {
    const r = play("balanced");
    expect(r.gap).toBe(0);
    expect(r.rank.id).toBe("steady");
    expect(r.regret).toBe(
      "You never traded. That's the ghost's whole strategy.",
    );
  });

  it("ALL IN, then CASH on 16 Mar: Panic Seller with a regret line about SPY", () => {
    const r = play("allin", "2020-03-16");
    expect(r.rank.id).toBe("panic");
    expect(r.regret).toMatch(
      /^You sold SPY on 17 Mar at \$\d+\. By 30 Jun it was \$\d+ \(\+\d+%\)\.$/,
    );
    expect(r.brokeLimit).toBe(true);
  });
});
