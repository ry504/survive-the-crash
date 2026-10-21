import { describe, expect, it } from "vitest";
import { buyShield } from "../engine";
import { PRESETS, SCENARIO } from "./scenario";
import { restore, toSave } from "./save";
import { initialState, reducer, type Action, type UiState } from "./store";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!.weights;

/** NEXT DAY, dismissing the day's BREAKING card first (the card blocks moving on until it is read). */
const nextDay = (s: UiState) =>
  reducer(reducer(s, { type: "breakingClose" }), { type: "next" });

/** Play live through the reducer: a starting bag, then a scripted trade on some days, stepping day by day. */
function playLive(days: number): UiState {
  let s = initialState();
  const go = (a: Action) => (s = reducer(s, a));
  go({ type: "target", weights: preset("balanced") });
  go({ type: "start" });
  for (let d = 0; d < days; d++) {
    if (d === 3) go({ type: "buy" });
    if (d === 7) {
      go({ type: "select", asset: "GLD" });
      go({ type: "buy" });
      go({ type: "buy" });
    }
    if (d === 20) go({ type: "target", weights: preset("allcash") });
    if (d === 30) {
      go({ type: "select", asset: "TLT" });
      go({ type: "buy" });
      go({ type: "cancel" });
      go({ type: "target", weights: preset("allin") });
    }
    if (d === 45) {
      go({ type: "select", asset: "SPY" });
      go({ type: "sell" });
    }
    s = nextDay(s);
  }
  return s;
}

const roundTrip = (s: UiState) =>
  restore(JSON.parse(JSON.stringify(toSave(s))));

describe("save + replay (CONTINUE)", () => {
  it("nothing to save before the first day or after the end", () => {
    expect(toSave(initialState())).toBeNull();
    const done = playLive(SCENARIO.days.length - 1);
    expect(done.phase).toBe("end");
    expect(toSave(done)).toBeNull();
  });

  it.each([0, 1, 5, 21, 50, SCENARIO.days.length - 2])(
    "replaying the saved orders at day %i gives the same state as playing live",
    (days) => {
      let live = playLive(days);
      // Queue an order that hasn't filled yet: it must survive the reload too.
      live = reducer(live, { type: "buy" });
      const back = roundTrip(live);
      expect(back).not.toBeNull();
      expect(back!.game.t).toBe(live.game.t);
      expect(back!.game.history[back!.game.t].value).toBe(
        live.game.history[live.game.t].value,
      );
      expect(back!.game.holdings).toEqual(live.game.holdings);
      expect(back!.game.pending).toEqual(live.game.pending);
      expect(back!.game.history).toEqual(live.game.history);
      expect(back!.ghost).toEqual(live.ghost);
      expect(back!.xp).toBe(live.xp);
      expect(back!.unlocked).toEqual(live.unlocked);
      expect(back!.phase).toBe("play");
      expect(back!.ff).toBe(false);
    },
  );

  it("finishing a restored run lands on the same final value as the live run", () => {
    const last = SCENARIO.days.length - 1;
    let live = playLive(40);
    let back = roundTrip(live)!;
    for (let d = 40; d < last; d++) {
      live = nextDay(live);
      back = nextDay(back);
    }
    expect(live.phase).toBe("end");
    expect(back.phase).toBe("end");
    expect(back.game.history[last].value).toBe(live.game.history[last].value);
    expect(back.xp).toBe(live.xp);
  });

  it("a SHIELD (filled and still pending) survives the round trip", () => {
    let live = playLive(5); // balanced bag holds SPY
    live = { ...live, game: buyShield(live.game) };
    live = nextDay(live);
    expect(live.game.holdings.shield).not.toBeNull();
    for (let d = 0; d < 3; d++) live = nextDay(live);
    const back = roundTrip(live);
    expect(back).not.toBeNull();
    expect(back!.game.holdings).toEqual(live.game.holdings);
    expect(back!.game.history).toEqual(live.game.history);
    // a shield queued but not filled yet
    let fresh = playLive(5);
    fresh = { ...fresh, game: buyShield(fresh.game) };
    const back2 = roundTrip(fresh);
    expect(back2!.game.pending).toEqual([{ kind: "shield" }]);
    expect(restore({ ...toSave(fresh)!, pending: [{ kind: "shield", x: 1 }] })).toBeNull();
  });

  it("rejects broken saves", () => {
    const good = toSave(playLive(10))!;
    expect(restore(null)).toBeNull();
    expect(restore("nope")).toBeNull();
    expect(restore({ ...good, v: 2 })).toBeNull();
    expect(restore({ ...good, scenario: "gfc-2008" })).toBeNull();
    expect(restore({ ...good, value: good.value + 5 })).toBeNull();
    expect(restore({ ...good, t: 11 })).toBeNull();
    expect(restore({ ...good, t: SCENARIO.days.length - 1 })).toBeNull();
    expect(
      restore({ ...good, log: [[{ kind: "buy", asset: "BTC", dollars: 1 }]] }),
    ).toBeNull();
    expect(
      restore({
        ...good,
        pending: [
          { kind: "target", weights: { SPY: 1, TLT: 1, GLD: 0, CASH: 0 } },
        ],
      }),
    ).toBeNull();
    expect(restore(good)).not.toBeNull();
  });
});
