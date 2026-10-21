import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  advance,
  buy,
  canTrade,
  cancelPending,
  currentWeights,
  halfHearts,
  newGame,
  paperPnl,
  panic,
  queueOrder,
  runGhost,
  sell,
  setTarget,
  valueAt,
  FEE_RATE,
  type Bar,
  type Day,
  type GameState,
  type Scenario,
  type Weights,
} from "./index";

const bar = (o: number, c = o, div = 0): Bar => ({ o, h: Math.max(o, c), l: Math.min(o, c), c, adj: c, div });

interface DaySpec {
  SPY?: Partial<Bar> & { o?: number };
  TLT?: Partial<Bar> & { o?: number };
  GLD?: Partial<Bar> & { o?: number };
  irx?: number;
}
function scenario(specs: DaySpec[]): Scenario {
  const days: Day[] = specs.map((s, i) => {
    const mk = (k: "SPY" | "TLT" | "GLD"): Bar => {
      const p = s[k] ?? {};
      const o = p.o ?? 100;
      return { ...bar(o, p.c ?? o, p.div ?? 0), ...p };
    };
    return { date: `d${i}`, SPY: mk("SPY"), TLT: mk("TLT"), GLD: mk("GLD"), vix: 20, irx: s.irx ?? 0 };
  });
  return {
    meta: { id: "t", name: "t", start: "d0", end: `d${days.length - 1}`, tradingDays: days.length, source: "", notes: [] },
    assets: { SPY: { label: "Stocks" }, TLT: { label: "Bonds" }, GLD: { label: "Gold" } },
    days,
  };
}
const w = (SPY: number, TLT: number, GLD: number, CASH: number): Weights => ({ SPY, TLT, GLD, CASH });
const F = 1 + FEE_RATE;

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

describe("fees", () => {
  it("1. target 100% asset charges exact fee", () => {
    const s = advance(setTarget(newGame(scenario([{}, {}])), w(1, 0, 0, 0)));
    const D = 10000 / F;
    expect(s.holdings.shares.SPY).toBeCloseTo(D / 100, 10);
    expect(s.feesPaid).toBeCloseTo(D * FEE_RATE, 10);
    expect(Math.abs(s.holdings.cash)).toBeLessThan(1e-8);
    expect(s.holdings.cash).toBeGreaterThanOrEqual(0);
    const fill = s.history[1].events[0];
    expect(fill).toMatchObject({ kind: "fill", side: "buy", price: 100 });
  });

  it("8. daily SPY<->TLT flip on flat prices loses 17-19%", () => {
    const sc = scenario(Array.from({ length: 100 }, () => ({})));
    let s = setTarget(newGame(sc), w(1, 0, 0, 0));
    s = advance(s);
    for (let i = 0; i < 98; i++) {
      s = setTarget(s, i % 2 === 0 ? w(0, 1, 0, 0) : w(1, 0, 0, 0));
      s = advance(s);
    }
    expect(s.t).toBe(99);
    const final = s.history[99].value;
    const loss = 1 - final / 10000;
    console.log(`TEST8 final=${final.toFixed(4)} loss=${(loss * 100).toFixed(4)}% fees=${s.feesPaid.toFixed(4)}`);
    expect(loss).toBeGreaterThan(0.17);
    expect(loss).toBeLessThan(0.19);
  });
});

describe("advance mechanics", () => {
  it("2. dividend goes to shares held at prior close, not shares bought at today's open", () => {
    const sc = scenario([{}, {}, { SPY: { div: 2 } }]);
    // Hold 10 SPY from day 1 close.
    let s = newGame(sc);
    s = queueOrder(s, { kind: "buy", asset: "SPY", dollars: 1000 });
    s = advance(s); // 10 shares
    expect(s.holdings.shares.SPY).toBeCloseTo(10, 10);
    s = queueOrder(s, { kind: "buy", asset: "SPY", dollars: 1000 }); // buys 10 more at day 2 open
    s = advance(s);
    const div = s.history[2].events.find((e) => e.kind === "dividend");
    expect(div).toMatchObject({ kind: "dividend", asset: "SPY", shares: 10, perShare: 2 });
    expect(s.dividendsReceived).toBeCloseTo(20, 10);
    // never paid on the 10 newly bought shares
    expect(s.holdings.shares.SPY).toBeCloseTo(20, 10);
    // no dividend event if nothing held
    const n = advance(advance(newGame(sc)));
    expect(n.history[2].events.some((e) => e.kind === "dividend")).toBe(false);
  });

  it("3. interest on overnight cash", () => {
    const sc = scenario([{ irx: 3.65 }, {}]);
    const s = advance(newGame(sc));
    expect(s.holdings.cash).toBeCloseTo(10000 + (10000 * 0.0365) / 252, 10);
    expect(s.interestEarned).toBeCloseTo((10000 * 0.0365) / 252, 10);
    expect(s.history[1].events[0]).toMatchObject({ kind: "interest" });
    // zero rate -> no event
    expect(advance(newGame(scenario([{}, {}]))).history[1].events).toEqual([]);
  });

  it("4. sell capped at shares held; buy scaled when cash short; cash never negative", () => {
    const sc = scenario([{}, {}, {}, {}]);
    let s = queueOrder(newGame(sc), { kind: "buy", asset: "SPY", dollars: 500 });
    s = advance(s);
    const held = s.holdings.shares.SPY;
    expect(held).toBeCloseTo(5, 10);
    s = queueOrder(s, { kind: "sell", asset: "SPY", dollars: 99999 });
    s = advance(s);
    expect(s.holdings.shares.SPY).toBe(0);
    const sellEv = s.history[2].events[0];
    expect(sellEv).toMatchObject({ kind: "fill", side: "sell", shares: held, dollars: 500 });
    // selling with nothing held: no event
    s = queueOrder(s, { kind: "sell", asset: "SPY", dollars: 100 });
    s = advance(s);
    expect(s.history[3].events).toEqual([]);
    // oversized buy is scaled
    let b = queueOrder(newGame(sc), { kind: "buy", asset: "TLT", dollars: 50000 });
    b = advance(b);
    expect(b.holdings.shares.TLT).toBeCloseTo(10000 / F / 100, 10);
    expect(b.holdings.cash).toBeGreaterThanOrEqual(0);
    expect(b.holdings.cash).toBeLessThan(1e-8);
  });

  it("5. target with fees does not overspend and lands within 0.2% of target", () => {
    const sc = scenario([
      { SPY: { o: 100 }, TLT: { o: 80 }, GLD: { o: 50 } },
      { SPY: { o: 103 }, TLT: { o: 79, c: 81 }, GLD: { o: 52, c: 53 } },
      { SPY: { o: 99, c: 95 }, TLT: { o: 82 }, GLD: { o: 51 } },
    ]);
    const target = w(0.5, 0.2, 0.2, 0.1);
    let s = advance(setTarget(newGame(sc), target));
    expect(s.holdings.cash).toBeGreaterThanOrEqual(-1e-9);
    // weights at the open of day 1 (just after fills)
    const d = sc.days[1];
    const V = s.holdings.cash + (["SPY", "TLT", "GLD"] as const).reduce((a, k) => a + s.holdings.shares[k] * d[k].o, 0);
    for (const k of ["SPY", "TLT", "GLD"] as const) {
      expect(Math.abs((s.holdings.shares[k] * d[k].o) / V - target[k])).toBeLessThan(0.002);
    }
    // a rebalance (sells + buys) also stays solvent
    s = advance(setTarget(s, w(0.1, 0.1, 0.1, 0.7)));
    expect(s.holdings.cash).toBeGreaterThanOrEqual(-1e-9);
    s = advance(setTarget(newGame(sc), w(1, 0, 0, 0)));
    expect(s.holdings.cash).toBeGreaterThanOrEqual(-1e-9);
  });

  it("6. never mutates input state", () => {
    const sc = scenario([{ irx: 2 }, { SPY: { div: 1 } }, {}]);
    let s = setTarget(newGame(sc), w(0.6, 0.2, 0.1, 0.1));
    s = advance(s);
    s = buy(s, "TLT");
    deepFreeze(s);
    expect(() => advance(s)).not.toThrow();
    expect(() => sell(s, "SPY")).not.toThrow();
    expect(() => panic(s)).not.toThrow();
    expect(() => cancelPending(s)).not.toThrow();
    expect(s.t).toBe(1);
    expect(s.pending.length).toBe(1);
    const n = advance(s);
    expect(n.history[n.t].holdings).not.toBe(n.holdings);
  });

  it("7. last day: canTrade false, advance and queueOrder throw", () => {
    let s = newGame(scenario([{}, {}]));
    expect(canTrade(s)).toBe(true);
    s = advance(s);
    expect(canTrade(s)).toBe(false);
    expect(() => advance(s)).toThrow();
    expect(() => queueOrder(s, { kind: "buy", asset: "SPY", dollars: 1 })).toThrow();
    expect(() => buy(s, "SPY")).toThrow();
    expect(() => panic(s)).toThrow();
  });

  it("buy/sell size is 10% of close value; setTarget validates", () => {
    const s0 = newGame(scenario([{}, {}]));
    const b = buy(s0, "GLD");
    expect(b.pending[0]).toEqual({ kind: "buy", asset: "GLD", dollars: 1000 });
    expect(sell(s0, "SPY").pending[0]).toEqual({ kind: "sell", asset: "SPY", dollars: 1000 });
    expect(() => setTarget(s0, w(0.5, 0.5, 0.5, 0))).toThrow();
    expect(() => setTarget(s0, w(1.5, -0.5, 0, 0))).toThrow();
    expect(() => setTarget(s0, w(0.5, 0.3, 0.1, 0.1 + 1e-12))).not.toThrow();
    expect(panic(s0).pending[0]).toEqual({ kind: "target", weights: w(0, 0, 0, 1) });
    expect(cancelPending(b).pending).toEqual([]);
  });

  it("newGame, valueAt, currentWeights", () => {
    const sc = scenario([{}, { SPY: { o: 100, c: 110 } }]);
    const s0 = newGame(sc);
    expect(s0.history).toHaveLength(1);
    expect(s0.history[0]).toMatchObject({ t: 0, value: 10000, drawdown: 0, events: [] });
    expect(currentWeights(s0)).toEqual(w(0, 0, 0, 1));
    const s = advance(setTarget(s0, w(1, 0, 0, 0)));
    expect(valueAt(s.holdings, sc, 1, "c")).toBeCloseTo(s.history[1].value, 10);
    expect(currentWeights(s).SPY).toBeCloseTo(1, 6);
    expect(currentWeights({ ...s, holdings: { cash: 0, shares: { SPY: 0, TLT: 0, GLD: 0 }, cost: { SPY: 0, TLT: 0, GLD: 0 }, shield: null } })).toEqual(w(0, 0, 0, 1));
  });
});

describe("halfHearts", () => {
  it("10. boundaries", () => {
    expect(halfHearts(0)).toBe(10);
    expect(halfHearts(0.024)).toBe(10);
    expect(halfHearts(0.025)).toBe(9);
    expect(halfHearts(0.25)).toBe(0);
    expect(halfHearts(0.9)).toBe(0);
    expect(halfHearts(0.075)).toBe(7);
  });
});

describe("real data", () => {
  const real: Scenario = JSON.parse(readFileSync("public/data/covid-2020.json", "utf8"));

  it("9. ghost 100% SPY matches hand formula", () => {
    expect(real.days).toHaveLength(99);
    const hist = runGhost(real, [{ kind: "target", weights: w(1, 0, 0, 0) }]);
    expect(hist).toHaveLength(99);
    const final = hist[98].value;

    // Independent replay. Day-0 cash earns one day of interest before the buy.
    const open = real.days[1].SPY.o;
    const closeEnd = real.days[98].SPY.c;
    const cash0 = 10000 * (1 + real.days[0].irx / 100 / 252);
    const shares = cash0 / F / open;
    let cash = 0;
    let divTotal = 0;
    const divs: string[] = [];
    for (let t = 1; t < 98; t++) {
      cash += Math.max(0, cash * (real.days[t].irx / 100 / 252)); // IRX dips negative in Mar 2020; engine floors cash interest at 0
      const dv = real.days[t + 1].SPY.div;
      if (dv > 0) {
        cash += shares * dv;
        divTotal += shares * dv;
        divs.push(`${real.days[t + 1].date}:${dv}`);
      }
    }
    const replay = shares * closeEnd + cash;
    // Simple hand formula ignoring interest.
    const simpleShares = 10000 / F / open;
    const simple = simpleShares * closeEnd + simpleShares * (1.406 + 1.366);
    console.log(
      `TEST9 open(2020-02-11 SPY)=${open} close(2020-06-30 SPY)=${closeEnd} divs=${divs.join(",")} ` +
        `shares(with day0 interest)=${shares.toFixed(6)} simpleShares=${simpleShares.toFixed(6)} ` +
        `engine final=${final.toFixed(4)} replay=${replay.toFixed(4)} simpleHand=${simple.toFixed(4)} dividends$=${divTotal.toFixed(4)}`,
    );
    expect(final).toBeCloseTo(replay, 6);
    // simple formula ignores ~$0.60 of day-0 interest (cash earns it before the day-1 buy) + tiny dividend interest
    expect(Math.abs(final - simple)).toBeLessThan(1);
    expect(hist[98].feesPaid).toBeCloseTo((cash0 / F) * FEE_RATE, 8);
  });

  it("ghost history invariants", () => {
    const hist = runGhost(real, [{ kind: "target", weights: w(0.5, 0.2, 0.1, 0.2) }]);
    hist.forEach((r, i) => {
      expect(r.t).toBe(i);
      expect(r.holdings.cash).toBeGreaterThanOrEqual(-1e-9);
      expect(r.drawdown).toBeGreaterThanOrEqual(0);
      expect(r.drawdown).toBeLessThan(1);
    });
  });
});

export type { GameState };

describe("P&L", () => {
  it("11. paper P&L includes buy fee; selling half locks in exactly that half", () => {
    // d0 close 100; buy $1,000 SPY at d1 open 100; d1 close 110; sell $550 at d2 open 110.
    const sc = scenario([{}, { SPY: { o: 100, c: 110 } }, { SPY: { o: 110, c: 110 } }, {}]);
    let s = newGame(sc);
    s = queueOrder(s, { kind: "buy", asset: "SPY", dollars: 1000 });
    s = advance(s);
    expect(s.holdings.shares.SPY).toBeCloseTo(10, 12);
    expect(s.holdings.cost.SPY).toBeCloseTo(1000 * F, 9);
    expect(paperPnl(s, "SPY")).toBeCloseTo(10 * 110 - 1000 * F, 9); // +99
    s = queueOrder(s, { kind: "sell", asset: "SPY", dollars: 550 });
    s = advance(s);
    const fill = s.history[s.t].events.find((e) => e.kind === "fill");
    // 5 shares sold at 110: proceeds 550, fee 0.55, basis = half of 1001 = 500.5 → realized 48.95
    expect(fill && fill.kind === "fill" ? fill.realized : NaN).toBeCloseTo(550 - 0.55 - 500.5, 9);
    expect(s.realizedPnl).toBeCloseTo(48.95, 9);
    expect(s.holdings.cost.SPY).toBeCloseTo(500.5, 9);
    expect(paperPnl(s, "SPY")).toBeCloseTo(5 * 110 - 500.5, 9);
  });

  it("12. selling everything zeroes cost basis; realized + fees reconcile with cash", () => {
    const sc = scenario([{}, { SPY: { o: 100, c: 90 } }, { SPY: { o: 80, c: 80 } }, {}]);
    let s = newGame(sc);
    s = setTarget(s, w(1, 0, 0, 0));
    s = advance(s);
    s = panic(s);
    s = advance(s);
    expect(s.holdings.shares.SPY).toBe(0);
    expect(s.holdings.cost.SPY).toBe(0);
    // Started with 10,000 and ended all cash: total loss = -realized (no interest, no dividends).
    expect(s.holdings.cash - 10000).toBeCloseTo(s.realizedPnl, 9);
    expect(s.realizedPnl).toBeLessThan(0);
  });
});
