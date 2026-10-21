import { describe, expect, it } from "vitest";
import { EVENTS } from "./events";
import { sourceDate, sourceSections } from "./sources";
import { STORY } from "./story";

describe("sources screen", () => {
  const sections = sourceSections();
  const items = (title: string) =>
    sections.find((s) => s.title.startsWith(title))!.items;

  it("lists every story card and every event, generated from the data files", () => {
    expect(items("STORY").length).toBe(STORY.length);
    expect(items("STORY").length).toBe(6);
    expect(items("BREAKING").length).toBe(EVENTS.length);
    expect(items("BREAKING").length).toBe(25);
    expect(items("BREAKING").map((i) => i.text)).toEqual(
      EVENTS.map((e) => e.headline),
    );
  });

  it("every link is https, and only the game's own last story line has none", () => {
    const all = sections.flatMap((s) => s.items);
    for (const i of all) for (const l of i.links) expect(l.url).toMatch(/^https:\/\//);
    expect(all.filter((i) => i.links.length === 0)).toEqual([
      expect.objectContaining({ text: STORY[STORY.length - 1].text }),
    ]);
  });

  it("formats month-only and full dates", () => {
    expect(sourceDate("2019-12")).toBe("DEC 2019");
    expect(sourceDate("2020-03-16")).toBe("16 MAR 2020");
  });
});
