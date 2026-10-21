import { describe, expect, it } from "vitest";
import { breakingFor } from "./events";
import { PRESETS, SCENARIO } from "./scenario";
import { initialState, reducer, type Action, type UiState } from "./store";

const balanced = PRESETS.find((p) => p.id === "balanced")!.weights;
const date = (s: UiState) => SCENARIO.days[s.game.t].date;

describe("turn-based loop (spec §4)", () => {
  it("days only pass on NEXT DAY; the first press locks in the day-1 bag", () => {
    let s = reducer(initialState(), { type: "target", weights: balanced });
    expect(s.phase).toBe("pick");
    s = reducer(s, { type: "next" });
    expect(s.phase).toBe("play");
    expect(s.game.t).toBe(1);
    expect(s.ghostOrders).toHaveLength(1);
    expect(s.ff).toBe(false);
  });

  it("a BREAKING card must be dismissed before the next day; DISMISS stays on the day and trading works", () => {
    let s = reducer(initialState(), { type: "next" });
    while (!s.breaking) s = reducer(s, { type: "next" });
    const t = s.game.t;
    expect(reducer(s, { type: "next" }).game.t).toBe(t);
    s = reducer(s, { type: "breakingClose" });
    expect(s.breaking).toBeNull();
    expect(s.game.t).toBe(t);
    s = reducer(s, { type: "buy" });
    expect(s.game.pending).toHaveLength(1);
    // REREAD opens the same card again.
    expect(reducer(s, { type: "breakingOpen" }).breaking?.t).toBe(t);
    expect(reducer(s, { type: "next" }).game.t).toBe(t + 1);
  });

  it("FAST-FORWARD stops on every big day (cards and the first dividend) and nowhere else", () => {
    let s = reducer(initialState(), { type: "target", weights: balanced });
    s = reducer(s, { type: "ff" });
    const stops: string[] = [];
    let guard = 0;
    while (s.phase !== "end" && guard++ < 500) {
      if (s.ff) {
        s = reducer(s, { type: "ffTick" });
        continue;
      }
      stops.push(date(s));
      s = reducer(s, { type: "breakingClose" });
      s = reducer(s, { type: "ff" });
    }
    expect(s.phase).toBe("end");
    expect(stops[0]).toBe("2020-02-24");
    for (const d of [
      "2020-03-09",
      "2020-03-12",
      "2020-03-16",
      "2020-03-23",
      "2020-03-26",
    ])
      expect(stops).toContain(d);
    // Every stop is a card day or the first dividend; every card day is a stop.
    const cardDays = SCENARIO.days
      .map((d, t) =>
        t < SCENARIO.days.length - 1 && breakingFor(t) ? d.date : null,
      )
      .filter(Boolean);
    const firstDiv = s.game.history.find((h) =>
      h.events.some((e) => e.kind === "dividend"),
    )!.date;
    expect(stops).toContain(firstDiv);
    expect(stops.filter((d) => !cardDays.includes(d) && d !== firstDiv)).toEqual([]);
    for (const d of cardDays) expect(stops).toContain(d);
  });

  it("any click or key (ffStop) or the FF button stops fast-forward", () => {
    const s = reducer(initialState(), { type: "ff" });
    expect(s.ff).toBe(true);
    const steps: Action[] = [{ type: "ffStop" }, { type: "ff" }];
    for (const a of steps) {
      const on = reducer(s, { type: "ffTick" });
      expect(reducer(on, a).ff).toBe(false);
    }
  });
});

describe("blocked orders warn instead of silently doing nothing", () => {
  const fifty = PRESETS.find((p) => p.id === "fifty")?.weights ?? { SPY: 0.5, TLT: 0.5, GLD: 0, CASH: 0 };
  it("BUY with no cash shows a warning and queues nothing", () => {
    let s = reducer(initialState(), { type: "target", weights: fifty });
    s = reducer(s, { type: "next" }); // fills: 0 cash left
    expect(s.game.holdings.cash).toBeLessThan(1);
    const n = s.toasts.length;
    s = reducer(s, { type: "buy" });
    expect(s.game.pending).toHaveLength(0);
    expect(s.toasts.length).toBe(n + 1);
    expect(s.toasts.at(-1)?.kind).toBe("warn");
  });
  it("SELL of an asset you don't own warns", () => {
    let s = reducer(initialState(), { type: "next" }); // all cash
    s = reducer(s, { type: "sell" });
    expect(s.game.pending).toHaveLength(0);
    expect(s.toasts.at(-1)?.kind).toBe("warn");
  });
  it("BUY with cash still queues", () => {
    let s = reducer(initialState(), { type: "next" });
    s = reducer(s, { type: "buy" });
    expect(s.game.pending).toHaveLength(1);
  });
});

describe("SHIELD action", () => {
  const allIn = PRESETS.find((p) => p.id === "allin")!.weights;
  const toast = (s: UiState) => s.toasts[s.toasts.length - 1];

  it("warns instead of queueing with no stocks", () => {
    const s = reducer(initialState(), { type: "shield" });
    expect(s.game.pending).toHaveLength(0);
    expect(toast(s)).toMatchObject({ kind: "warn", title: "BUY SOME STOCKS FIRST - SHIELD COVERS SPY" });
  });

  it("19 Feb ALL IN: queues, fills, pays on 20 Mar, fires the pop-up and the achievement", () => {
    let s = reducer(initialState(), { type: "target", weights: allIn });
    while (date(s) !== "2020-02-19") {
      s = reducer(s, { type: "next" });
      if (s.breaking) s = reducer(s, { type: "breakingClose" });
    }
    s = reducer(s, { type: "shield" });
    expect(s.game.pending).toEqual([{ kind: "shield" }]);
    expect(toast(reducer(s, { type: "shield" })).title).toBe("SHIELD ALREADY QUEUED");
    s = reducer(s, { type: "next" });
    expect(s.shieldFx?.kind).toBe("up");
    expect(s.game.holdings.shield).not.toBeNull();
    expect(toast(reducer(s, { type: "shield" })).title).toBe("SHIELD ALREADY ACTIVE");
    while (date(s) !== "2020-03-20") {
      s = reducer(s, { type: "next" });
      if (s.breaking) s = reducer(s, { type: "breakingClose" });
    }
    expect(s.shieldFx?.kind).toBe("payout");
    expect(s.shieldFx!.amount).toBeGreaterThan(2000);
    expect(s.unlocked).toContain("insured");
  });
});
