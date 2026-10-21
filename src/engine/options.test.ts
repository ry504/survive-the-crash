import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  advance,
  buyShield,
  canShield,
  currentWeights,
  newGame,
  queueOrder,
  runGhost,
  setTarget,
  shieldQuote,
  SHIELD_DAYS,
  type Bar,
  type Day,
  type GameState,
  type Scenario,
  type Weights,
} from "./index";
import { bsPut, normCdf } from "./options";

const w = (SPY: number, TLT: number, GLD: number, CASH: number): Weights => ({
  SPY,
  TLT,
  GLD,
  CASH,
});

/** Black-Scholes call, only for the put-call parity check. */
function bsCall(
  S: number,
  K: number,
  sigma: number,
  r: number,
  T: number,
): number {
  const sqT = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / sqT;
  const d2 = d1 - sqT;
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

describe("normCdf / bsPut", () => {
  it("normCdf matches reference values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 14);
    expect(normCdf(1)).toBeCloseTo(0.841344746068543, 12);
    expect(normCdf(-1.96)).toBeCloseTo(0.0249978951482204, 12);
    expect(normCdf(3)).toBeCloseTo(0.99865010196837, 12);
    expect(normCdf(-8)).toBeCloseTo(6.22096057427178e-16, 20);
    for (const x of [0.1, 0.7, 1.3, 2.5, 5])
      expect(normCdf(x) + normCdf(-x)).toBeCloseTo(1, 14);
  });

  it("textbook put: S=100 K=100 σ=0.2 r=0.05 T=1 → 5.5735", () => {
    expect(Math.abs(bsPut(100, 100, 0.2, 0.05, 1) - 5.5735)).toBeLessThan(1e-3);
  });

  it("put-call parity C − P = S − K·e^(−rT)", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20; i++) {
      const S = 50 + rnd() * 300;
      const K = S * (0.7 + rnd() * 0.6);
      const sigma = 0.05 + rnd() * 0.9;
      const r = rnd() * 0.06;
      const T = 0.01 + rnd() * 2;
      const lhs = bsCall(S, K, sigma, r, T) - bsPut(S, K, sigma, r, T);
      expect(lhs).toBeCloseTo(S - K * Math.exp(-r * T), 8);
    }
  });

  it("edge cases", () => {
    expect(bsPut(90, 100, 0.3, 0.02, 0)).toBe(10);
    expect(bsPut(110, 100, 0.3, 0.02, -1)).toBe(0);
    expect(bsPut(90, 100, 0, 0.05, 1)).toBeCloseTo(
      100 * Math.exp(-0.05) - 90,
      12,
    );
    expect(bsPut(110, 100, 0, 0.05, 1)).toBe(0);
    expect(bsPut(0, 100, 0.3, 0, 1)).toBe(100);
  });
});

// Synthetic scenario helpers (same shape as engine.test.ts).
const bar = (o: number, c = o): Bar => ({
  o,
  h: Math.max(o, c),
  l: Math.min(o, c),
  c,
  adj: c,
  div: 0,
});
function flat(
  n: number,
  spy: (i: number) => { o: number; c: number } = () => ({ o: 100, c: 100 }),
): Scenario {
  const days: Day[] = Array.from({ length: n }, (_, i) => {
    const p = spy(i);
    return {
      date: `d${i}`,
      SPY: bar(p.o, p.c),
      TLT: bar(100),
      GLD: bar(100),
      vix: 20,
      irx: 0,
    };
  });
  return {
    meta: {
      id: "t",
      name: "t",
      start: "d0",
      end: `d${n - 1}`,
      tradingDays: n,
      source: "",
      notes: [],
    },
    assets: {
      SPY: { label: "Stocks" },
      TLT: { label: "Bonds" },
      GLD: { label: "Gold" },
    },
    days,
  };
}

describe("SHIELD rules (synthetic)", () => {
  it("canShield: noStocks, queued, active, lastDays; buyShield throws when blocked", () => {
    const sc = flat(40);
    let s = newGame(sc);
    expect(canShield(s)).toEqual({ ok: false, reason: "noStocks" });
    expect(() => buyShield(s)).toThrow(/noStocks/);
    s = advance(setTarget(s, w(0.9, 0, 0, 0.1)));
    expect(canShield(s)).toEqual({ ok: true });
    const q = buyShield(s);
    expect(q.pending).toEqual([{ kind: "shield" }]);
    expect(canShield(q)).toEqual({ ok: false, reason: "queued" });
    s = advance(q);
    expect(s.holdings.shield).not.toBeNull();
    expect(s.holdings.shield!.expiryT).toBe(2 + SHIELD_DAYS);
    expect(canShield(s)).toEqual({ ok: false, reason: "active" });
    // lastDays: last index 39; at t = 39 − 22 = 17 the fill (18) + 21 = 39 fits; at t = 18 it doesn't.
    let a = advance(setTarget(newGame(sc), w(0.9, 0, 0, 0.1)));
    while (a.t < 17) a = advance(a);
    expect(canShield(a).ok).toBe(true);
    a = advance(a);
    expect(canShield(a)).toEqual({ ok: false, reason: "lastDays" });
  });

  it("ALL IN: sells just enough SPY to fund the premium; cash never negative", () => {
    const sc = flat(40);
    let s = advance(setTarget(newGame(sc), w(1, 0, 0, 0))); // cash ≈ 0
    const n = s.holdings.shares.SPY;
    const fees0 = s.feesPaid;
    s = advance(buyShield(s));
    const evs = s.history[s.t].events;
    const sellEv = evs.find((e) => e.kind === "fill" && e.side === "sell");
    expect(sellEv).toBeDefined();
    expect(evs.findIndex((e) => e.kind === "fill")).toBeLessThan(evs.findIndex((e) => e.kind === "shieldBuy"));
    const sh = s.holdings.shield!;
    const p = bsPut(100, 95, 0.2, 0, SHIELD_DAYS / 252);
    expect(sh.contracts).toBeCloseTo(s.holdings.shares.SPY, 12);
    expect(sh.contracts).toBeLessThan(n);
    expect(sh.premiumPaid).toBeCloseTo(sh.contracts * p, 9);
    // proceeds after the sell fee pay exactly the premium on the shares left
    if (sellEv && sellEv.kind === "fill") {
      expect(sellEv.dollars - sellEv.fee).toBeCloseTo(sh.premiumPaid - (s.history[1].holdings.cash), 6);
      expect(s.feesPaid - fees0).toBeCloseTo(sellEv.fee, 12);
    }
    expect(s.holdings.cash).toBeGreaterThanOrEqual(0);
    expect(s.holdings.cash).toBeLessThan(1e-6);
    // cash never negative across the whole run, with repeated shields
    for (let k = 0; k < 15; k++) {
      while (!canShield(s).ok && s.t < 39) s = advance(s);
      if (s.t >= 39 || !canShield(s).ok) break;
      s = advance(buyShield(s));
    }
    while (s.t < 39) s = advance(s);
    for (const r of s.history) expect(r.holdings.cash).toBeGreaterThanOrEqual(0);
  });

  it("partial cash: sells only the shortfall", () => {
    const sc = flat(40);
    let s = advance(setTarget(newGame(sc), w(0.995, 0, 0, 0.005))); // ~$50 cash, premium ~$100+
    const cash = s.holdings.cash;
    s = advance(buyShield(s));
    const sellEv = s.history[s.t].events.find((e) => e.kind === "fill");
    expect(sellEv && sellEv.kind === "fill" ? sellEv.dollars * (1 - 0.001) : 0).toBeCloseTo(s.holdings.shield!.premiumPaid - cash, 6);
    expect(s.holdings.cash).toBeGreaterThanOrEqual(0);
  });

  it("noStocks if everything is sold the same day", () => {
    const sc = flat(40);
    let n = advance(setTarget(newGame(sc), w(0.5, 0, 0, 0.5)));
    n = buyShield(n);
    n = queueOrder(n, { kind: "target", weights: w(0, 0, 0, 1) });
    n = advance(n);
    expect(n.history[n.t].events).toContainEqual({ kind: "shieldSkipped", reason: "noStocks" });
    expect(n.holdings.shield).toBeNull();
    expect(n.shieldPremiums).toBe(0);
  });

  it("BUY SPY + SHIELD queued together covers the new shares; premium from cash, no fee", () => {
    const sc = flat(40);
    let s = advance(setTarget(newGame(sc), w(0.5, 0, 0, 0.5)));
    const sharesBefore = s.holdings.shares.SPY;
    s = buyShield(s);
    s = queueOrder(s, { kind: "buy", asset: "SPY", dollars: 1000 }); // queued AFTER the shield, still fills first
    const cashBefore = s.holdings.cash;
    s = advance(s);
    const sh = s.holdings.shield!;
    expect(sh.contracts).toBeCloseTo(sharesBefore + 10, 9);
    expect(sh.strike).toBeCloseTo(95, 12);
    const per = bsPut(100, 95, 0.2, 0, SHIELD_DAYS / 252);
    expect(sh.premiumPaid).toBeCloseTo(sh.contracts * per, 9);
    expect(s.holdings.cash).toBeCloseTo(
      cashBefore - 1000 * 1.001 - sh.premiumPaid,
      9,
    );
    // value includes the mark
    const rec = s.history[s.t];
    expect(rec.value).toBeCloseTo(
      rec.holdings.cash + rec.holdings.shares.SPY * 100 + rec.shieldValue,
      9,
    );
    expect(rec.shieldValue).toBeGreaterThan(0);
    // weights: the total includes the shield mark; the four weights sum to 1 − shield share
    const cw = currentWeights(s);
    expect(cw.SPY + cw.TLT + cw.GLD + cw.CASH).toBeCloseTo(
      1 - rec.shieldValue / rec.value,
      12,
    );
  });

  it("expires worthless with a 0 payout event; can buy again after", () => {
    const sc = flat(40);
    let s = advance(setTarget(newGame(sc), w(0.9, 0, 0, 0.1)));
    s = advance(buyShield(s));
    const expiryT = s.holdings.shield!.expiryT;
    while (s.t < expiryT) s = advance(s);
    const ev = s.history[s.t].events.find((e) => e.kind === "shieldPayout");
    expect(ev).toMatchObject({ kind: "shieldPayout", amount: 0, spot: 100 });
    expect(s.holdings.shield).toBeNull();
    expect(s.shieldValue).toBe(0);
    expect(s.history[s.t].shieldValue).toBe(0);
  });
});

describe("SHIELD on real data", () => {
  const real: Scenario = JSON.parse(
    readFileSync("public/data/covid-2020.json", "utf8"),
  );
  const idx = (date: string) => real.days.findIndex((d) => d.date === date);
  const playTo = (s: GameState, t: number) => {
    while (s.t < t) s = advance(s);
    return s;
  };
  // ALL IN on day 0: the premium is funded by selling a little SPY at the fill.
  const start = () => advance(setTarget(newGame(real), w(1, 0, 0, 0)));

  it("bought on 19 Feb close: cheap, pays > $2,000 at expiry, beats no shield", () => {
    const t19 = idx("2020-02-19");
    const base = playTo(start(), t19);
    const quote = shieldQuote(base);
    let s = advance(buyShield(base));
    const sh = s.holdings.shield!;
    const S = real.days[t19 + 1].SPY.o;
    const fund = s.history[s.t].events.find((e) => e.kind === "fill");
    expect(fund).toMatchObject({ kind: "fill", side: "sell", asset: "SPY" });
    expect(s.holdings.cash).toBeGreaterThanOrEqual(0);
    const per10k = (sh.premiumPaid / (sh.contracts * S)) * 10000;
    s = playTo(s, sh.expiryT);
    const pay = s.history[s.t].events.find((e) => e.kind === "shieldPayout");
    const noShield = playTo(base, sh.expiryT);
    // Reference: everything from the 19 Feb close, expiring 19 Mar (21 days after 19 Feb).
    const refK = 0.95 * real.days[t19].SPY.c;
    const refPayPerShare = Math.max(
      refK - real.days[idx("2020-03-19")].SPY.c,
      0,
    );
    const refPer10k = (quote.perShare / real.days[t19].SPY.c) * 10000;
    console.log(
      `SHIELD 19Feb ENGINE fill=${real.days[sh.boughtT].date} open=${S} K=${sh.strike.toFixed(2)} contracts=${sh.contracts.toFixed(4)} ` +
        `premium=$${sh.premiumPaid.toFixed(2)} ($${per10k.toFixed(2)}/10k) fundingSell=$${fund && fund.kind === "fill" ? fund.dollars.toFixed(2) : NaN} expiry=${real.days[sh.expiryT].date} ` +
        `spot=${pay && pay.kind === "shieldPayout" ? pay.spot : NaN} payout=$${pay && pay.kind === "shieldPayout" ? pay.amount.toFixed(2) : NaN} ` +
        `value=${s.history[s.t].value.toFixed(2)} vs noShield=${noShield.history[noShield.t].value.toFixed(2)} | ` +
        `REFERENCE (19Feb close) K=${refK.toFixed(2)} premium=$${quote.premium.toFixed(2)} ($${refPer10k.toFixed(2)}/10k) ` +
        `payout@19Mar=$${(refPayPerShare * quote.contracts).toFixed(2)} ($${((refPayPerShare / real.days[t19].SPY.c) * 10000).toFixed(2)}/10k)`,
    );
    expect(per10k).toBeGreaterThan(15);
    expect(per10k).toBeLessThan(30);
    expect(pay && pay.kind === "shieldPayout" ? pay.amount : 0).toBeGreaterThan(
      2000,
    );
    expect(s.history[s.t].value).toBeGreaterThan(
      noShield.history[noShield.t].value,
    );
    expect(s.shieldPayouts).toBeGreaterThan(2000);
    expect(s.shieldPremiums).toBeCloseTo(sh.premiumPaid, 9);
  });

  it("mark-to-market rises on the 16 Mar crash day", () => {
    let s = advance(buyShield(playTo(start(), idx("2020-02-19"))));
    s = playTo(s, idx("2020-03-13"));
    const before = s.shieldValue;
    s = advance(s); // 16 Mar, SPY −12%
    expect(real.days[s.t].date).toBe("2020-03-16");
    expect(s.shieldValue).toBeGreaterThan(before);
    expect(s.history[s.t].shieldValue).toBe(s.shieldValue);
  });

  it("16 Mar pricing ≈ 7% of the covered value", () => {
    const t16 = idx("2020-03-16");
    // Needs cash: 70% SPY so the ~7% premium is affordable.
    const base = playTo(
      advance(setTarget(newGame(real), w(0.7, 0, 0, 0.3))),
      t16,
    );
    const quote = shieldQuote(base);
    const s = advance(buyShield(base));
    const sh = s.holdings.shield!;
    const ratio = sh.premiumPaid / (sh.contracts * real.days[t16 + 1].SPY.o);
    console.log(
      `SHIELD 16Mar quote=${((quote.perShare / real.days[t16].SPY.c) * 100).toFixed(2)}% ($${((quote.perShare / real.days[t16].SPY.c) * 10000).toFixed(0)}/10k) ` +
        `filled 17Mar ratio=${(ratio * 100).toFixed(2)}%`,
    );
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.09);
  });

  it("ghost never buys a shield", () => {
    const orders = [{ kind: "target" as const, weights: w(1, 0, 0, 0) }];
    const a = runGhost(real, orders);
    const b = runGhost(real, [...orders, { kind: "shield" }]);
    expect(b).toEqual(a);
    expect(
      b.every((r) => r.shieldValue === 0 && r.holdings.shield === null),
    ).toBe(true);
  });
});
