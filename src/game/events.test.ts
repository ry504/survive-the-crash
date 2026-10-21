import { describe, expect, it } from "vitest";
import { BOSS_MAX, MOOD_LABEL, bossCount, bossGrowth, moodLevel } from "./atmosphere";
import { EVENTS, breakingFor, isHero } from "./events";
import { newsLine } from "./news";
import { SCENARIO } from "./scenario";

const dates = SCENARIO.days.map((d) => d.date);
const idx = (date: string) => dates.indexOf(date);

describe("approved events", () => {
  it("has exactly the 25 approved events", () => {
    expect(EVENTS).toHaveLength(25);
  });

  it("every game day is a trading day in the scenario", () => {
    for (const e of EVENTS) expect(dates, e.headline).toContain(e.gameDay);
  });

  it("every source is an https URL with a name", () => {
    for (const e of EVENTS) {
      expect(e.sourceUrl).toMatch(/^https:\/\//);
      expect(e.sourceName.length).toBeGreaterThan(0);
    }
  });

  it("is sorted by game day", () => {
    const days = EVENTS.map((e) => e.gameDay);
    expect([...days].sort()).toEqual(days);
  });

  it("tags match the research tally: 4 Fed heroes, 2 Congress heroes", () => {
    expect(EVENTS.filter((e) => e.tag === "fed-hero")).toHaveLength(4);
    expect(EVENTS.filter((e) => e.tag === "congress-hero")).toHaveLength(2);
  });
});

describe("BREAKING cards (one per day, merged)", () => {
  it("16 Mar merges the Fed hero, the halt and the circuit breaker into one card", () => {
    const b = breakingFor(idx("2020-03-16"))!;
    expect(b.events.map((e) => e.tag)).toEqual(["fed-hero", "none"]);
    expect(b.breaker).toBe(true);
    expect(b.big).toBe(true);
  });

  it("26 Mar has the Congress hero and the jobless claims", () => {
    const b = breakingFor(idx("2020-03-26"))!;
    expect(b.events.map((e) => e.category)).toEqual(["government", "economy"]);
    expect(b.events.some(isHero)).toBe(true);
  });

  it("a quiet day without events has no card; an event day always has one", () => {
    expect(breakingFor(1)).toBeNull();
    expect(breakingFor(idx("2020-02-26"))?.events).toHaveLength(1);
  });

  it("every event day and every circuit-breaker day gets a card", () => {
    for (const e of EVENTS) expect(breakingFor(idx(e.gameDay))).not.toBeNull();
    for (const d of ["2020-03-09", "2020-03-12", "2020-03-16", "2020-03-18"])
      expect(breakingFor(idx(d))?.breaker).toBe(true);
  });

  it("NEWS BOT reads the first headline on an event day", () => {
    const t = idx("2020-03-11");
    expect(newsLine(SCENARIO, t, [])).toContain(
      "WHO calls the coronavirus outbreak a pandemic",
    );
  });
});

describe("atmosphere", () => {
  it("mood levels follow the VIX thresholds", () => {
    expect([15, 20, 29.9, 30, 50, 82].map(moodLevel)).toEqual([
      "calm",
      "nervous",
      "nervous",
      "scared",
      "panic",
      "panic",
    ]);
    expect(MOOD_LABEL.panic).toBe("PANIC!!");
  });

  it("bosses: one per 10x of real cases, 1 to 4", () => {
    expect([42_771, 99_999, 100_000, 1_038_176, 10_475_388].map(bossCount)).toEqual([
      1, 1, 2, 3, 4,
    ]);
    expect(bossCount(1e9)).toBe(BOSS_MAX);
    expect(bossCount(500)).toBe(1);
    expect(bossCount(undefined)).toBe(0);
    expect(bossGrowth(100_000)).toBe(0);
    expect(bossGrowth(42_771)).toBeCloseTo(Math.log10(4.2771), 12);
  });

  it("bosses never shrink in number over the scenario, using each day's own count", () => {
    const counts = SCENARIO.days.map((d) => bossCount(d.cases));
    expect(counts[0]).toBe(1);
    expect(counts[counts.length - 1]).toBe(4);
    for (let i = 1; i < counts.length; i++)
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });
});
