"use client";
// Virus bosses (spec §6b): a few big, menacing virus particles in the chart's fog, one per 10x of real cumulative
// cases (1 to 4, never more). Fixed spots, a slow stepped "breathing" pulse on the heartbeat's rhythm, eyes that
// flicker hotter on panic days, and a recoil + dim right after a hero card. Decorative only: aria-hidden,
// pointer-events: none, and they live inside the fog, never over numbers or buttons.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bossCount, bossGrowth } from "@/game/atmosphere";
import { SCENARIO } from "@/game/scenario";
import { BOSS, BOSS_EYES_HOT, BOSS_PALS, type Sprite } from "@/game/sprites";
import s from "./game.module.css";
import { Pix } from "./ui";

const SIZE = BOSS.length; // 16x16
const GAP = 4;

/** One sprite per colour variant, built once (spriteUrl caches by object). */
export const BOSS_SPRITES: Sprite[] = BOSS_PALS.map((pal) => ({
  grid: BOSS,
  pal,
}));

/**
 * Pixel scale per boss (top to bottom), the biggest that fits the fog box. The older bosses share one size;
 * the newest grows from the minimum towards it with the fractional part of log10(cases).
 */
export function bossScales(
  n: number,
  growth: number,
  w: number,
  h: number,
  minS: number,
  maxS: number,
): number[] {
  for (let big = maxS; big > minS; big--) {
    const newest = minS + Math.round(growth * (big - minS));
    const sizes = Array.from({ length: n }, (_, i) =>
      i === n - 1 ? newest : big,
    );
    const height = sizes.reduce((a, sc) => a + SIZE * sc, 0) + GAP * (n - 1);
    if (height <= h && SIZE * big <= w) return sizes;
  }
  return Array.from({ length: n }, () => minS);
}

/** One boss: the body, plus white-hot eyes on top (they only show, flickering, on panic days). */
export function Boss({
  variant,
  scale,
  className,
}: {
  variant: number;
  scale: number;
  className?: string;
}) {
  return (
    <span className={`${s.boss} ${className ?? ""}`}>
      <Pix sprite={BOSS_SPRITES[variant % BOSS_SPRITES.length]} scale={scale} />
      <Pix sprite={BOSS_EYES_HOT} scale={scale} className={s.bossEyes} />
    </span>
  );
}

const phoneQuery = "(max-width: 720px)";
function subscribePhone(cb: () => void) {
  const m = window.matchMedia(phoneQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function Bosses({
  t,
  recoil,
}: {
  t: number;
  /** The hero day whose recoil is playing, or null. Changing it restarts the recoil. */
  recoil: number | null;
}) {
  const cases = SCENARIO.days[t].cases;
  const n = bossCount(cases);
  const growth = bossGrowth(cases);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const phone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(phoneQuery).matches,
    () => false,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // At least 48 px on desktop and 36 px on phones (spec §6b).
  const scales = bossScales(
    n,
    growth,
    box.w,
    box.h,
    Math.ceil((phone ? 36 : 48) / SIZE),
    Math.ceil((phone ? 64 : 96) / SIZE),
  );

  return (
    <div ref={ref} className={s.bosses} aria-hidden>
      {box.h > 0
        ? scales.map((sc, i) => (
            <span
              key={i}
              className={s.bossBreathe}
              style={{ animationDelay: `${-i * 0.45}s` }}
            >
              <Boss
                key={recoil ?? "calm"}
                variant={i}
                scale={sc}
                className={recoil !== null ? s.bossRecoil : undefined}
              />
            </span>
          ))
        : null}
    </div>
  );
}
