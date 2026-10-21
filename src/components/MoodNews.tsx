"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { MOOD_LABEL, moodLevel } from "@/game/atmosphere";
import { signedPct } from "@/game/format";
import { SCENARIO, spyMove } from "@/game/scenario";
import { BEAR, BULL, GERM_ICON, NEWSBOT, SKULL } from "@/game/sprites";
import { blip as blipSound } from "@/game/sound";
import s from "./game.module.css";
import { Panel, Pix } from "./ui";

export function Mood({ t }: { t: number }) {
  const d = SCENARIO.days[t];
  const move = spyMove(t);
  const up = move >= 0;
  const segs = Math.min(10, Math.round(d.vix / 8));
  return (
    <Panel title="MOOD" tut="mood">
      <div className={s.mood}>
        <Pix
          sprite={up ? BULL : BEAR}
          scale={5}
          alt={up ? "Bull: SPY up today" : "Bear: SPY down today"}
          className={up ? s.bob : s.stomp}
        />
        <div className={s.moodText}>
          <span className={`${s.moodLabel} ${up ? s.up : s.down}`}>
            {up ? "BULLS" : "BEARS"} {signedPct(move)}
          </span>
          <span className={s.moodLabel}>{MOOD_LABEL[moodLevel(d.vix)]}</span>
          <span
            className={s.fear}
            role="img"
            aria-label={`Fear meter: VIX ${Math.round(d.vix)}`}
          >
            <Pix sprite={SKULL} scale={2} />
            <span className={s.fearBar}>
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`${s.fearSeg} ${i < segs ? s.fearOn : ""}`}
                />
              ))}
            </span>
          </span>
          {d.cases !== undefined ? (
            <span
              className={`${s.moodLabel} ${s.cases}`}
              title="Confirmed COVID cases worldwide so far (Johns Hopkins CSSE)"
            >
              <Pix sprite={GERM_ICON} scale={2} />
              <span>
                <span className={s.hudLabel}>CASES</span>
                <span>{d.cases.toLocaleString("en-US")}</span>
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const m = window.matchMedia(reducedQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/**
 * Typewriter text (~28 ms/char by default, faster if the day would end first; maxMs slows it down).
 * Remount (key = text) to restart. blip = soft tick sound while typing; render = custom markup for the typed part.
 */
export function Typewriter({
  text,
  budgetMs,
  maxMs = 28,
  blip = false,
  render,
}: {
  text: string;
  budgetMs: number;
  maxMs?: number;
  blip?: boolean;
  render?: (shown: string) => ReactNode;
}) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const perChar = Math.max(
      4,
      Math.min(maxMs, budgetMs / Math.max(1, text.length)),
    );
    const step = Math.max(1, Math.round(16 / perChar));
    const id = window.setInterval(() => {
      setN((k) => Math.min(text.length, k + step));
      if (blip) blipSound();
    }, perChar * step);
    // Stop ticking once the whole text is out.
    const stop = window.setTimeout(
      () => window.clearInterval(id),
      Math.ceil(text.length / step) * perChar * step + 50,
    );
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [text, reduced, budgetMs, maxMs, blip]);
  const shown = reduced ? text : text.slice(0, n);
  return (
    <>
      <span aria-hidden>
        {render ? render(shown) : shown}
        <span className={s.cursor}>_</span>
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

export function NewsBot({
  text,
  budgetMs,
  blip = false,
  onReread,
}: {
  text: string;
  budgetMs: number;
  blip?: boolean;
  /** Today has a BREAKING card that was dismissed: REREAD opens it again. */
  onReread?: () => void;
}) {
  return (
    <Panel title="NEWS BOT" tut="news">
      <div className={s.news}>
        <div className={s.newsSide}>
          <Pix sprite={NEWSBOT} scale={5} alt="News bot" />
          {onReread ? (
            <button
              type="button"
              className={s.reread}
              onClick={onReread}
              aria-label="Reread today's breaking news"
            >
              REREAD
            </button>
          ) : null}
        </div>
        <div className={s.bubbleWrap}>
          <div className={s.bubble}>
            <div className={s.bubbleInner} aria-live="polite">
              <Typewriter key={text} text={text} budgetMs={budgetMs} blip={blip} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
