"use client";
// Atmosphere (spec §8c): the VIX mood overlays (vignette, scanlines, static). Purely decorative: aria-hidden and
// pointer-events: none. (The virus swarm was removed on 2026-10-20: swarms of tiny germs felt creepy in playtesting. A few big
// virus bosses in the chart fog replace it: see Bosses.tsx.)
import type { MoodLevel } from "@/game/atmosphere";
import s from "./game.module.css";

/** Vignette, scanlines and static, styled per mood level (globals.css: :root[data-mood]). */
export function MoodOverlay({ level }: { level: MoodLevel }) {
  return (
    <div className={s.atmo} data-level={level} aria-hidden>
      <div className={s.vignette} />
      <div className={s.scanlines} />
      <div className={s.static} />
    </div>
  );
}
