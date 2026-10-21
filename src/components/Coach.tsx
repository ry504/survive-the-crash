"use client";
// NEWS BOT coach (spec §8b): a blinking notched frame around the thing being explained and a bubble next to it
// (docked to the bottom on phones). Tips never block trading (spec §6b): nothing here catches clicks except the
// bubble itself, which keeps clear of the watchlist, bag and action bar when it can. Only the gated "pick your
// bag" tip dims the rest of the screen, and even that dim lets every click through.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NEWSBOT, PLAY_ARROW } from "@/game/sprites";
import type { Action } from "@/game/store";
import { TIPS, type TipId } from "@/game/tutorial";
import { Typewriter } from "./MoodNews";
import s from "./game.module.css";
import { PixelButton, Pix } from "./ui";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Layout {
  vw: number;
  vh: number;
  holes: Box[];
  /** Bubble top-left on desktop; null = docked (phones, or nowhere free). */
  at: { x: number; y: number } | null;
}

const PAD = 6; // cutout margin around the target
const RING = 4; // frame thickness
const GAP = 10; // bubble distance from the target
const EDGE = 12; // keep the bubble this far from the viewport edges

const phoneQuery = "(max-width: 720px)";
function subscribePhone(cb: () => void) {
  const m = window.matchMedia(phoneQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function usePhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(phoneQuery).matches,
    () => false,
  );
}

function targetsOf(keys: string[]): HTMLElement[] {
  return keys.flatMap((k) =>
    Array.from(document.querySelectorAll<HTMLElement>(`[data-tut="${k}"]`)),
  );
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
};
const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Padded, rounded-to-pixel boxes of every visible target; touching boxes merge so cutouts never overlap. */
function measureHoles(keys: string[]): Box[] {
  const boxes: Box[] = [];
  for (const el of targetsOf(keys)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    let b: Box = {
      x: Math.round(r.left - PAD),
      y: Math.round(r.top - PAD),
      w: Math.round(r.width + PAD * 2),
      h: Math.round(r.height + PAD * 2),
    };
    for (let i = boxes.length - 1; i >= 0; i--) {
      const grown = {
        x: b.x - RING,
        y: b.y - RING,
        w: b.w + RING * 2,
        h: b.h + RING * 2,
      };
      if (overlaps(grown, boxes[i])) {
        b = union(b, boxes[i]);
        boxes.splice(i, 1);
      }
    }
    boxes.push(b);
  }
  return boxes;
}

/** Where the player trades: the bubble avoids covering these (less strongly than the tip's own targets). */
const TRADE_AREAS = ["watch", "bag", "actions", "news"];
function measureAvoid(): Box[] {
  return targetsOf(TRADE_AREAS).map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
}

/** Bubble spot: below, above, right or left of the primary target; the one covering the least (targets first,
 * then the trading areas). */
function placeBubble(
  holes: Box[],
  bw: number,
  bh: number,
  vw: number,
  vh: number,
  avoid: Box[] = [],
): { x: number; y: number } | null {
  if (!holes.length) return { x: (vw - bw) / 2, y: (vh - bh) / 2 };
  const p = holes[0];
  const all = holes.reduce(union);
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - bw - EDGE);
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - bh - EDGE);
  const spots = [
    { x: clampX(p.x), y: p.y + p.h + GAP },
    { x: clampX(p.x), y: p.y - bh - GAP },
    { x: p.x + p.w + GAP, y: clampY(p.y) },
    { x: p.x - bw - GAP, y: clampY(p.y) },
    { x: clampX(all.x), y: all.y + all.h + GAP },
    { x: clampX(all.x), y: all.y - bh - GAP },
    { x: (vw - bw) / 2, y: vh - bh - EDGE },
    { x: (vw - bw) / 2, y: EDGE },
  ].filter(
    (q) =>
      q.x >= EDGE - 0.5 &&
      q.y >= EDGE - 0.5 &&
      q.x + bw <= vw - EDGE + 0.5 &&
      q.y + bh <= vh - EDGE + 0.5,
  );
  let best: { x: number; y: number } | null = null;
  let bestCover = Infinity;
  for (const q of spots) {
    const box = { x: q.x, y: q.y, w: bw, h: bh };
    const cover =
      holes.reduce((sum, h) => sum + area(box, h), 0) * 100 +
      avoid.reduce((sum, h) => sum + area(box, h), 0);
    if (cover === 0) return { x: Math.round(q.x), y: Math.round(q.y) };
    if (cover < bestCover) {
      bestCover = cover;
      best = { x: Math.round(q.x), y: Math.round(q.y) };
    }
  }
  return best;
}

/** Notched rectangle (3px pixel corners, like --notch) as an SVG subpath. */
function notch(b: Box, n = 3): string {
  const { x, y, w, h } = b;
  const r = x + w;
  const bt = y + h;
  return `M${x + n} ${y}H${r - n}V${y + n}H${r}V${bt - n}H${r - n}V${bt}H${x + n}V${bt - n}H${x}V${y + n}H${x + n}Z`;
}
const grow = (b: Box, d: number): Box => ({
  x: b.x - d,
  y: b.y - d,
  w: b.w + d * 2,
  h: b.h + d * 2,
});

export function Coach({
  id,
  dispatch,
}: {
  id: TipId;
  dispatch: (a: Action) => void;
}) {
  const tip = TIPS[id];
  const phone = usePhone();
  const bubble = useRef<HTMLDivElement>(null);
  const gotIt = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Track targets every frame: the page scrolls, panels grow, the goblin pops in and out.
  useEffect(() => {
    let raf = 0;
    let last = "";
    const loop = () => {
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const holes = measureHoles(tip.targets);
      const b = bubble.current;
      const at =
        phone || !b
          ? null
          : placeBubble(
              holes,
              b.offsetWidth,
              b.offsetHeight,
              vw,
              vh,
              measureAvoid(),
            );
      const next: Layout = { vw, vh, holes, at };
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setLayout(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tip, phone]);

  // Phones: the docked bubble sits over the bottom of the page, so leave that much scroll room under the page,
  // otherwise a target near the bottom (the watchlist) can never be lifted above the bubble.
  useEffect(() => {
    if (!phone) return;
    const b = bubble.current;
    if (!b) return;
    const root = document.body;
    const set = () => {
      root.style.paddingBottom = `${b.offsetHeight + EDGE * 2}px`;
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(b);
    return () => {
      ro.disconnect();
      root.style.paddingBottom = "";
    };
  }, [tip, phone]);

  // Bring the target into view once per tip. On phones it must sit above the docked bubble.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const els = targetsOf(tip.targets);
      if (!els.length) return;
      const rects = els.map((e) => e.getBoundingClientRect());
      const vh = window.innerHeight;
      const room =
        vh - (phone ? (bubble.current?.offsetHeight ?? 0) + EDGE * 2 : 0);
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const first = rects[0];
      const [a, z] =
        bottom - top <= room - EDGE * 2
          ? [top, bottom]
          : [first.top, first.bottom];
      if (a < EDGE + PAD || z > room - PAD)
        window.scrollBy({ top: a - EDGE - PAD * 2, behavior: "instant" });
    });
    return () => cancelAnimationFrame(raf);
  }, [tip, phone]);

  // Focus GOT IT (or the dialog itself while waiting for the player to act).
  useEffect(() => {
    (tip.gated ? bubble.current : gotIt.current)?.focus({
      preventScroll: true,
    });
  }, [tip]);

  // Esc closes the tip (not the gated one). Enter and Space belong to NEXT DAY, or to GOT IT while it has focus.
  useEffect(() => {
    if (tip.gated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.key !== "Escape") return;
      e.preventDefault();
      dispatch({ type: "tutClose" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tip, dispatch]);

  const docked = phone || !layout || layout.at === null;
  const style = docked ? undefined : { left: layout.at!.x, top: layout.at!.y };

  return (
    <>
      {layout ? (
        <svg
          className={s.coachDim}
          width={layout.vw}
          height={layout.vh}
          viewBox={`0 0 ${layout.vw} ${layout.vh}`}
          shapeRendering="crispEdges"
          aria-hidden
        >
          {tip.gated ? (
            <path
              className={s.coachShade}
              fillRule="evenodd"
              d={`M0 0H${layout.vw}V${layout.vh}H0Z${layout.holes.map((h) => notch(h)).join("")}`}
            />
          ) : null}
          <g className={s.coachFrames}>
            {layout.holes.map((h, i) => (
              <path
                key={i}
                fillRule="evenodd"
                d={notch(grow(h, RING), RING + 1) + notch(h)}
              />
            ))}
          </g>
        </svg>
      ) : null}
      <div
        ref={bubble}
        className={`${s.coach} ${tip.bullets ? s.coachWide : ""} ${docked ? s.coachDocked : ""}`}
        style={{ ...style, opacity: layout || phone ? undefined : 0 }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="coach-title"
        aria-describedby="coach-text"
        tabIndex={-1}
      >
        <div className={s.coachOuter}>
          <div className={s.coachInner}>
            <Pix sprite={NEWSBOT} scale={4} className={s.coachBot} />
            <div className={s.coachBody}>
              <h2 id="coach-title" className={s.coachTitle}>
                NEWS BOT
              </h2>
              {tip.title ? (
                <p className={s.coachStep}>
                  {tip.title}
                </p>
              ) : null}
              {tip.text ? (
                <p id="coach-text" className={s.coachText} aria-live="polite">
                  <Typewriter
                    key={id}
                    text={tip.text}
                    budgetMs={tip.text.length * 28}
                    blip
                  />
                </p>
              ) : null}
              {tip.bullets ? (
                <ul className={s.coachList}>
                  {tip.bullets.map((b, i) => (
                    <li key={i} className={s.coachItem}>
                      {tip.bullets!.some((x) => x.icon) ? (
                        <span className={s.coachIcon} aria-hidden>
                          {b.icon ? <Pix sprite={b.icon} scale={2} /> : null}
                        </span>
                      ) : null}
                      <span>
                        {b.label ? (
                          <b className={s.coachLabel}>{b.label}</b>
                        ) : null}{" "}
                        {b.text}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={s.coachButtons}>
                {tip.gated ? (
                  <span className={s.coachWait}>YOUR MOVE...</span>
                ) : (
                  <PixelButton
                    ref={gotIt}
                    variant="yellow"
                    onClick={() => dispatch({ type: "tutClose" })}
                    onKeyDown={(e) => e.repeat && e.preventDefault()}
                  >
                    GOT IT <Pix sprite={PLAY_ARROW} scale={2} />
                  </PixelButton>
                )}
                <button
                  type="button"
                  className={s.skipLink}
                  onClick={() => dispatch({ type: "tutSkip" })}
                >
                  SKIP TUTORIAL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
