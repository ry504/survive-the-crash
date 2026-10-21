// Atmosphere driven by real data (spec §8c, §6b): VIX sets the mood level, global cases set how many virus bosses show.

export type MoodLevel = "calm" | "nervous" | "scared" | "panic";

/** Same thresholds as the MOOD panel label: <20 calm, <30 nervous, <50 scared, else panic. */
export function moodLevel(vix: number): MoodLevel {
  if (vix < 20) return "calm";
  if (vix < 30) return "nervous";
  if (vix < 50) return "scared";
  return "panic";
}

export const MOOD_LABEL: Record<MoodLevel, string> = {
  calm: "CALM",
  nervous: "NERVOUS",
  scared: "SCARED",
  panic: "PANIC!!",
};

/** Chart canvas dots (grid + fog dither) per mood, matching the CSS palette in globals.css. */
export const CHART_TINT: Record<MoodLevel, { grid: string; fog: string }> = {
  calm: { grid: "#14261a", fog: "#10200f" },
  nervous: { grid: "#26240f", fog: "#1d1c0c" },
  scared: { grid: "#2c1d10", fog: "#23170c" },
  panic: { grid: "#2e1316", fog: "#26100f" },
};
const CHART_BG: Record<MoodLevel, string> = {
  calm: "#0a0e0a",
  nervous: "#0d0d09",
  scared: "#0f0b08",
  panic: "#120809",
};
export const chartBg = (m: MoodLevel) => CHART_BG[m];

/** Hard cap on virus bosses on screen (spec §6b: a few big ones, never a crowd). */
export const BOSS_MAX = 4;

/**
 * Virus bosses for a cumulative case count: one per 10x of real cases (spec §6b).
 * floor(log10(cases)) - 3, clamped to 1..4: 1 at 42,771 (10 Feb), 2 from 100k, 3 from 1M, 4 from 10M.
 * Uses the day's own count only, so it never depends on future days. 0 when there is no case count.
 */
export function bossCount(cases: number | undefined): number {
  if (cases === undefined || !Number.isFinite(cases) || cases <= 0) return 0;
  return Math.max(1, Math.min(BOSS_MAX, Math.floor(Math.log10(cases)) - 3));
}

/** How far the newest boss has grown within its 10x (fractional part of log10(cases)), in [0, 1). */
export function bossGrowth(cases: number | undefined): number {
  if (cases === undefined || !Number.isFinite(cases) || cases <= 0) return 0;
  const l = Math.log10(cases);
  return l - Math.floor(l);
}
