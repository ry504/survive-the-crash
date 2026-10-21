import { describe, expect, it } from "vitest";
import type { GameEvent } from "../engine";
import { STORY } from "./story";
import {
  tipsToShow,
  tutorialClose,
  tutorialLoad,
  tutorialReplay,
  tutorialShow,
  tutorialSkip,
  tutorialStep,
  tutorialStoryDone,
  TIPS,
  TIP_IDS,
  type TipId,
  type TutorialSnap,
} from "./tutorial";

const snap = (o: Partial<TutorialSnap> = {}): TutorialSnap => ({
  phase: "play",
  t: 0,
  pendingCount: 0,
  events: [],
  ghostVisible: false,
  halfHearts: 10,
  bigDay: false,
  vix: 15,
  hasStocks: false,
  ...o,
});
const fill = (side: "buy" | "sell"): GameEvent => ({
  kind: "fill",
  asset: "SPY",
  side,
  shares: 1,
  price: 300,
  dollars: 300,
  fee: 0.3,
  ...(side === "sell" ? { realized: -12 } : {}),
});
const none = new Set<TipId>();
const INTRO: TipId[] = ["welcome", "watchlist", "bag"];

describe("tipsToShow", () => {
  it("fresh game: welcome, watchlist, bag, then the gated pick-your-bag tip (no up-front tour)", () => {
    expect(tipsToShow(null, snap({ phase: "pick" }), none)).toEqual([
      ...INTRO,
      "pickBag",
    ]);
  });

  it("pick-your-bag spotlights only the MIX buttons, never TRADE; NEXT DAY only NEXT DAY", () => {
    expect(TIPS.pickBag.targets).toEqual(["presets"]);
    expect(TIPS.pickBag.targets).not.toContain("trade");
    expect(TIPS.pickBag.gated).toBe(true);
    expect(TIPS.nextDay.targets).toEqual(["play"]);
    expect(TIPS.nextDay.gated).toBe(true);
    expect(TIPS.trade.targets).toEqual(["trade"]);
    expect(TIPS.fastForward.targets).toEqual(["ff"]);
  });

  it("day 1 shows the top bar, days 2-3 the chart, the first quiet day after day 3 FAST-FORWARD, a big day TRADE", () => {
    const seen = new Set<TipId>(INTRO);
    expect(tipsToShow(snap({ t: 0 }), snap({ t: 1, events: [fill("buy")] }), seen)).toEqual(["topBar"]);
    const afterBar = new Set<TipId>([...INTRO, "topBar"]);
    expect(tipsToShow(snap({ t: 1 }), snap({ t: 2 }), afterBar)).toEqual(["chart"]);
    expect(tipsToShow(snap({ t: 2 }), snap({ t: 3 }), afterBar)).toEqual(["chart"]);
    const past = new Set<TipId>([...INTRO, "topBar", "chart"]);
    expect(tipsToShow(snap({ t: 3 }), snap({ t: 4 }), past)).toEqual(["fastForward"]);
    expect(tipsToShow(snap({ t: 3 }), snap({ t: 4, bigDay: true }), past)).toEqual(["trade"]);
    expect(tipsToShow(snap({ t: 8 }), snap({ t: 9, bigDay: true }), past)).toEqual(["trade"]);
  });

  it("dividend day shows the dividend tip", () => {
    const ev: GameEvent = {
      kind: "dividend",
      asset: "TLT",
      perShare: 0.2,
      shares: 10,
      amount: 2,
    };
    const seen = new Set<TipId>(["topBar", "chart", "fastForward"]);
    expect(
      tipsToShow(snap({ t: 13 }), snap({ t: 14, events: [ev] }), seen),
    ).toEqual(["dividend"]);
  });

  it("first sell fill shows the top bar then locked; a buy never shows locked", () => {
    expect(
      tipsToShow(snap({ t: 0 }), snap({ t: 1, events: [fill("sell")] }), none),
    ).toEqual(["topBar", "locked"]);
    expect(
      tipsToShow(snap({ t: 0 }), snap({ t: 1, events: [fill("buy")] }), none),
    ).not.toContain("locked");
  });

  it("several tips on one day come back in tip order", () => {
    const next = snap({
      t: 12,
      events: [fill("sell"), fill("buy")],
      ghostVisible: true,
      halfHearts: 7,
      bigDay: true,
      vix: 40,
    });
    expect(tipsToShow(snap({ t: 11 }), next, none)).toEqual([
      "topBar",
      "chart",
      "trade",
      "hearts",
      "fear",
      "locked",
    ]);
  });

  it("shield tip: needs stocks AND (a big day or VIX > 25); spotlights only the SHIELD button", () => {
    expect(TIPS.shield.targets).toEqual(["shield"]);
    expect(TIPS.shield.title).toBe("SHIELD (insurance)");
    expect(TIPS.shield.text).toBe("Insurance on your stocks.");
    expect(TIPS.shield.bullets).toHaveLength(4);
    const prev = snap({ t: 5 });
    const seen = new Set<TipId>(["topBar", "chart", "fastForward", "trade"]);
    // no stocks: never
    expect(tipsToShow(prev, snap({ t: 6, bigDay: true, vix: 40 }), seen)).not.toContain("shield");
    // stocks but a quiet, calm day: not yet
    expect(tipsToShow(prev, snap({ t: 6, hasStocks: true, vix: 20 }), seen)).not.toContain("shield");
    // stocks + big day, or stocks + VIX > 25
    expect(tipsToShow(prev, snap({ t: 6, hasStocks: true, bigDay: true }), seen)).toContain("shield");
    expect(tipsToShow(prev, snap({ t: 6, hasStocks: true, vix: 26 }), seen)).toContain("shield");
    // one-time
    expect(tipsToShow(prev, snap({ t: 6, hasStocks: true, bigDay: true }), new Set([...seen, "shield"]))).not.toContain("shield");
  });

  it("event tips need a new day, so the same snapshot never re-fires them", () => {
    const s = snap({ t: 5, events: [fill("buy")], vix: 40, halfHearts: 5 });
    expect(tipsToShow(s, s, none)).toEqual([]);
  });

  it("nothing fires on the end screen", () => {
    expect(
      tipsToShow(snap({ t: 97 }), snap({ t: 98, phase: "end", vix: 40 }), none),
    ).toEqual([]);
  });
});

describe("tutorial state", () => {
  const pick = snap({ phase: "pick" });

  it("walks the whole opening: pick a bag, get the NEXT DAY prompt, press it, then the top bar", () => {
    let tut = tutorialLoad({ seen: [], storySeen: true }, pick);
    expect(tut.queue).toEqual([...INTRO, "pickBag"]);
    for (let i = 0; i < INTRO.length; i++) tut = tutorialClose(tut);
    expect(tut.queue).toEqual(["pickBag"]);
    // Queuing BALANCED completes the gated tip and brings up NEXT DAY right away.
    const queued = { ...pick, pendingCount: 1 };
    tut = tutorialStep(tut, pick, queued);
    expect(tut.queue).toEqual(["nextDay"]);
    expect(tut.seen).toEqual([...INTRO, "pickBag"]);
    // Picking another mix doesn't re-queue or drop it (gated: no GOT IT, it waits for NEXT DAY).
    expect(tutorialStep(tut, queued, queued)).toBe(tut);
    // NEXT DAY closes it; the first fill brings up the top bar (goblin line included).
    tut = tutorialStep(tut, queued, snap({ t: 1, events: [fill("buy")] }));
    expect(tut.queue).toEqual(["topBar"]);
    expect(tut.seen).toContain("nextDay");
    tut = tutorialClose(tut);
    expect(tutorialStep(tut, snap({ t: 1 }), snap({ t: 2 })).queue).toEqual(["chart"]);
    // A fresh load brings back nothing already seen.
    expect(tutorialLoad({ seen: tut.seen, storySeen: true }, pick).queue).toEqual([]);
  });

  it("regression: picking a bag while intro tips are still up still prompts NEXT DAY, first", () => {
    // Clicks pass through the tips, so a quick player taps BALANCED before closing welcome/watchlist/bag.
    // The old order buried "queued" behind the whole tour, then NEXT DAY silently dropped it.
    let tut = tutorialLoad({ seen: [], storySeen: true }, pick);
    tut = tutorialClose(tut); // welcome only
    expect(tut.queue).toEqual(["watchlist", "bag", "pickBag"]);
    tut = tutorialStep(tut, pick, { ...pick, pendingCount: 1 });
    expect(tut.queue).toEqual(["nextDay"]);
    expect(tut.seen).toEqual([...INTRO, "pickBag"]);
  });

  it("the gated pick-your-bag tip closes if the player starts without picking (all cash)", () => {
    let tut = tutorialLoad({ seen: INTRO, storySeen: true }, pick);
    expect(tut.queue).toEqual(["pickBag"]);
    tut = tutorialStep(tut, pick, snap({ t: 1 }));
    expect(tut.queue).not.toContain("pickBag");
  });

  it("the trade tip closes when the player moves to the next day", () => {
    const big = snap({ t: 9, bigDay: true });
    const fresh = { ready: true, seen: [], queue: [], storySeen: true, storyOpen: false };
    let tut = tutorialStep(fresh, snap({ t: 8 }), big);
    expect(tut.queue).toContain("trade");
    tut = tutorialStep(tut, big, snap({ t: 10 }));
    expect(tut.queue).not.toContain("trade");
  });

  it("story shows first on a fresh device; tips wait behind it", () => {
    const tut = tutorialLoad({ seen: [], storySeen: false }, pick);
    expect(tut.storyOpen).toBe(true);
    expect(tut.queue[0]).toBe("welcome");
    expect(tutorialStoryDone(tut)).toMatchObject({
      storyOpen: false,
      storySeen: true,
    });
  });

  it("skip marks every tip seen; replay clears them and starts with the story + welcome", () => {
    const skipped = tutorialSkip(
      tutorialLoad({ seen: [], storySeen: true }, pick),
    );
    expect(skipped.queue).toEqual([]);
    expect(skipped.seen).toHaveLength(TIP_IDS.length);
    const again = tutorialReplay(skipped, snap({ t: 30 }));
    expect(again).toMatchObject({
      seen: [],
      queue: [...INTRO],
      storyOpen: true,
    });
  });

  it("an info button opens only its own tip, ahead of the queue, without marking anything seen", () => {
    const tut = tutorialLoad({ seen: [], storySeen: true }, pick);
    const shown = tutorialShow(tut, "trade");
    expect(shown.queue[0]).toBe("trade");
    expect(shown.queue.filter((q) => q === "trade")).toHaveLength(1);
    expect(shown.queue).toHaveLength(tut.queue.length + 1);
    expect(shown.seen).toEqual(tut.seen);
    // After the tour is done, it shows just that one tip; GOT IT leaves the rest untouched.
    const done = { ...tut, seen: [...INTRO, "pickBag"] as TipId[], queue: [] };
    const one = tutorialShow(done, "bag");
    expect(one.queue).toEqual(["bag"]);
    expect(tutorialClose(one).queue).toEqual([]);
    expect(tutorialClose(one).seen).toEqual(done.seen);
    // Not while the story is open.
    expect(tutorialShow({ ...done, storyOpen: true }, "bag").queue).toEqual([]);
  });

  it("every panel explanation (the ones behind an ⓘ button) has a title, bullets and targets", () => {
    for (const id of ["watchlist", "bag", "pickBag", "topBar", "chart", "trade"] as TipId[]) {
      const t = TIPS[id];
      expect(t.title && t.bullets?.length && t.targets.length).toBeTruthy();
    }
  });

  it("no tips fire before progress is loaded", () => {
    const tut = {
      ready: false,
      seen: [],
      queue: [],
      storySeen: false,
      storyOpen: false,
    };
    expect(
      tutorialStep(tut, snap(), snap({ t: 1, events: [fill("buy")] })),
    ).toBe(tut);
  });
});

describe("story", () => {
  it("has 6 cards, each but the last with an https source", () => {
    expect(STORY).toHaveLength(6);
    for (const c of STORY.slice(0, -1))
      expect(c.source?.url).toMatch(/^https:\/\//);
    expect(STORY[5].source).toBeUndefined();
  });

  it("every glitch word appears in its card's text exactly", () => {
    for (const c of STORY)
      for (const w of c.glitch ?? []) expect(c.text).toContain(w);
    expect(STORY[2].alert).toBe("GLOBAL HEALTH EMERGENCY");
  });
});
