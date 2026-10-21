// Achievement toasts (spec §8). Each check only looks at days up to the current close: no look-ahead.
import type { DayRecord, Scenario } from "@/engine";
import { CIRCUIT_BREAKER_DAYS } from "./scenario";

export interface AchievementCtx {
  scenario: Scenario;
  history: readonly DayRecord[];
  rec: DayRecord;
  isLastDay: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  check: (c: AchievementCtx) => boolean;
}

export const XP_PER_DAY = 10;
export const XP_PER_ACHIEVEMENT = 100;
export const XP_PER_LEVEL = 200;
export const level = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

const breakersSeen = (c: AchievementCtx) =>
  c.history.filter((r) => CIRCUIT_BREAKER_DAYS.has(r.date)).length;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-trade",
    title: "FED THE GOBLIN",
    check: (c) => c.rec.events.some((e) => e.kind === "fill"),
  },
  {
    id: "first-div",
    title: "FIRST DIVIDEND",
    check: (c) => c.rec.events.some((e) => e.kind === "dividend"),
  },
  {
    id: "breaker",
    title: "SURVIVED A CIRCUIT BREAKER",
    check: (c) => CIRCUIT_BREAKER_DAYS.has(c.rec.date),
  },
  {
    id: "breaker-4",
    title: "SURVIVED ALL 4 BREAKERS",
    check: (c) => breakersSeen(c) >= 4,
  },
  {
    id: "fear-50",
    title: "STARED DOWN VIX 50",
    check: (c) => c.scenario.days[c.rec.t].vix >= 50,
  },
  {
    id: "halfway",
    title: "HALFWAY THERE",
    check: (c) => c.rec.t + 1 >= Math.ceil(c.scenario.days.length / 2),
  },
  {
    id: "back-to-peak",
    title: "BACK TO THE PEAK",
    check: (c) => {
      const prev = c.history[c.history.length - 2];
      const worst = Math.max(...c.history.map((r) => r.drawdown));
      return (
        !!prev &&
        worst >= 0.1 &&
        c.rec.value >= prev.peak &&
        c.rec.drawdown === 0
      );
    },
  },
  {
    id: "insured",
    title: "INSURED BEFORE THE STORM",
    check: (c) => c.rec.events.some((e) => e.kind === "shieldPayout" && e.amount > 500),
  },
  { id: "complete", title: "MISSION COMPLETE", check: (c) => c.isLastDay },
];
