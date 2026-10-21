"use client";
// SPY daily candles on a 160x78 canvas, scaled up pixelated. Only days 0..t exist here: the y-axis
// is built from days seen so far, and everything right of today is fog (spec §1 anti-goal: no look-ahead).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CHART_TINT, chartBg, moodLevel } from "@/game/atmosphere";
import { money, shortDate } from "@/game/format";
import { SCENARIO, spyMove } from "@/game/scenario";
import { C, TRADER_HAPPY, TRADER_SAD, drawSprite } from "@/game/sprites";
import s from "./game.module.css";
import type { Action } from "@/game/store";
import { InfoButton, Panel } from "./ui";

const W = 160;
const H = 78;
const SLOT = 4; // 3px body + 1px gap
const FOG_SLOTS = 6;
const VISIBLE = W / SLOT - FOG_SLOTS; // 34 candles
const TOP = 12; // room for the trader sprite above the high
const BOTTOM = 3;

/** Left edge of the fog, as a fraction of the chart width (the virus bosses sit right of it). */
const fogFrac = (t: number) => ((Math.min(t, VISIBLE - 1) + 1) * SLOT) / W;

function draw(ctx: CanvasRenderingContext2D, t: number) {
  const days = SCENARIO.days;
  // Background and dots follow the VIX mood palette (spec §8c); candles keep their green/red meaning.
  const mood = moodLevel(days[t].vix);
  const tint = CHART_TINT[mood];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = chartBg(mood);
  ctx.fillRect(0, 0, W, H);

  // Dotted grid.
  ctx.fillStyle = tint.grid;
  for (let y = 4; y < H; y += 8)
    for (let x = 2; x < W; x += 4) ctx.fillRect(x, y, 1, 1);

  // Y range from every day seen so far (0..t), never later.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= t; i++) {
    lo = Math.min(lo, days[i].SPY.l);
    hi = Math.max(hi, days[i].SPY.h);
  }
  // Minimum window of 8% of price so the first quiet days don't stretch one candle to full height.
  const minSpan = 0.08 * ((hi + lo) / 2);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    hi = mid + minSpan / 2;
    lo = mid - minSpan / 2;
  }
  const span = hi - lo;
  const y = (p: number) =>
    Math.round(TOP + ((hi - p) / span) * (H - TOP - BOTTOM));

  const start = Math.max(0, t - (VISIBLE - 1));
  for (let i = start; i <= t; i++) {
    const b = days[i].SPY;
    const x = (i - start) * SLOT;
    const up = i === 0 ? b.c >= b.o : b.c >= days[i - 1].SPY.c;
    ctx.fillStyle = up ? C.green : C.red;
    const wy0 = y(b.h);
    const wy1 = y(b.l);
    ctx.fillRect(x + 1, wy0, 1, Math.max(1, wy1 - wy0 + 1));
    const by0 = y(Math.max(b.o, b.c));
    const by1 = y(Math.min(b.o, b.c));
    ctx.fillRect(x, by0, 3, Math.max(1, by1 - by0 + 1));
  }

  // Dithered fog right of today.
  const fogX = (t - start + 1) * SLOT;
  ctx.fillStyle = chartBg(mood);
  ctx.fillRect(fogX, 0, W - fogX, H);
  ctx.fillStyle = tint.fog;
  for (let yy = 0; yy < H; yy++)
    for (let xx = fogX + (yy % 2); xx < W; xx += 2) ctx.fillRect(xx, yy, 1, 1);

  // Trader rides today's high.
  const sprite = spyMove(t) >= 0 ? TRADER_HAPPY : TRADER_SAD;
  const tx = Math.min(W - 8, Math.max(0, (t - start) * SLOT + 1 - 3));
  const ty = Math.max(0, y(days[t].SPY.h) - 9 - 1);
  drawSprite(ctx, sprite, tx, ty);
}

/** Scale for a box: whole-pixel steps when that keeps most of the size, else the exact fit. */
function fitScale(w: number, h: number): number {
  const exact = Math.min(w / W, h / H);
  const whole = Math.floor(exact);
  return whole >= 1 && whole / exact >= 0.85 ? whole : exact;
}

export function CandleChart({
  t,
  fog,
  dispatch,
}: {
  t: number;
  dispatch: (a: Action) => void;
  /** Drawn over the fog (right of today): the virus bosses. */
  fog?: ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Desktop one-screen layout gives the chart a fixed box (CSS sets --fit: 1); phones keep width: 100%.
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const fit = getComputedStyle(el).getPropertyValue("--fit").trim() === "1";
      setScale(fit ? fitScale(el.clientWidth, el.clientHeight) : null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) draw(ctx, t);
  }, [t]);
  const d = SCENARIO.days[t];
  return (
    <Panel title={<>SPY - DAILY<InfoButton name="the chart" onClick={() => dispatch({ type: "tutShow", id: "chart" })} /></>} tut="chart" className={s.chartPanel} innerClassName={s.chartBody}>
      <div className={s.chartHead}>
        <span>
          O {money(d.SPY.o)} H {money(d.SPY.h)} L {money(d.SPY.l)} C{" "}
          {money(d.SPY.c)}
        </span>
        <span>{shortDate(d.date)}</span>
      </div>
      <div ref={box} className={s.canvasBox}>
      <div className={s.chartStage}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        className={s.canvas}
        style={scale ? { width: Math.floor(W * scale), height: Math.floor(H * scale) } : undefined}
        role="img"
        aria-label={`SPY daily candles up to ${shortDate(d.date)}. Close ${money(d.SPY.c)}. Future days hidden in fog.`}
      />
      {fog ? (
        <div className={s.fogZone} style={{ left: `${fogFrac(t) * 100}%` }}>
          {fog}
        </div>
      ) : null}
      </div>
      </div>
    </Panel>
  );
}
