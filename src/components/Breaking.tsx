"use client";
// BREAKING card (spec §6, §6b, §8c): everything big about one day, merged into one card. Events first,
// then the market line. Its only button is DISMISS: the player stays on that day and can trade; it never advances
// anything. REREAD in the NEWS BOT panel opens it again. Virus/market/economy/government news = emergency broadcast (hazard stripes, flashing
// warning, slow typewriter); Fed and Congress rescues = hero blocks with a burst of relief light.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { type Breaking, type CrisisEvent, isHero } from "@/game/events";
import { shortDate } from "@/game/format";
import { marketLine } from "@/game/news";
import { SCENARIO } from "@/game/scenario";
import { blip } from "@/game/sound";
import {
  BEAR,
  BRIEFCASE,
  CAPITOL,
  CHECK,
  FED,
  GERM_ICON,
  PRINTER_FRAMES,
  PRINTER_PAL,
  SIREN,
  WARN,
  sheetUrl,
  spriteUrl,
  HAZARD,
  type Sprite,
} from "@/game/sprites";
import type { Action } from "@/game/store";
import { useReducedMotion } from "./MoodNews";
import s from "./game.module.css";
import { PixelButton, Pix } from "./ui";

const PRINTER_SHEET = sheetUrl(PRINTER_FRAMES, PRINTER_PAL);
const HAZARD_URL = spriteUrl(HAZARD);

const ICON: Record<CrisisEvent["category"], { sprite: Sprite; alt: string }> = {
  virus: { sprite: GERM_ICON, alt: "Virus news" },
  market: { sprite: BEAR, alt: "Market news" },
  economy: { sprite: BRIEFCASE, alt: "Economy news" },
  government: { sprite: SIREN, alt: "Government news" },
  fed: { sprite: FED, alt: "The Fed" },
};

/** Emergency typing is slow on purpose; rescue news reads at the normal pace. */
const SLOW_MS = 36;
const HERO_MS = 26;

function HeroArt({ e }: { e: CrisisEvent }) {
  const fed = e.tag === "fed-hero";
  return (
    <div className={s.heroArt} aria-hidden>
      <span className={s.rays} />
      <Pix sprite={fed ? FED : CAPITOL} scale={4} className={s.heroSprite} />
      {fed ? (
        <span
          className={s.printer}
          style={
            {
              "--s": 3,
              backgroundImage: `url("${PRINTER_SHEET}")`,
            } as CSSProperties
          }
        />
      ) : (
        <Pix sprite={CHECK} scale={3} className={`${s.check} ${s.bob}`} />
      )}
    </div>
  );
}

export function BreakingCard({
  b,
  dispatch,
}: {
  b: Breaking;
  dispatch: (a: Action) => void;
}) {
  const reduced = useReducedMotion();
  const heroes = b.events.filter(isHero);
  const alarm =
    b.events.some((e) => !isHero(e)) ||
    b.breaker ||
    (b.big && (b.move < 0 || heroes.length === 0));
  const market = marketLine(SCENARIO, b.t);
  // Typed in order: each headline, then the market line. Meanings and sources appear once their headline is out.
  const lines = [...b.events.map((e) => e.headline), market];
  const ends = lines.reduce<number[]>(
    (acc, l) => [...acc, (acc.at(-1) ?? 0) + l.length],
    [],
  );
  const total = ends.at(-1)!;
  const [n, setN] = useState(0);
  const shown = reduced ? total : n;
  const perChar = alarm ? SLOW_MS : HERO_MS;

  const all = lines.join("");
  useEffect(() => {
    if (reduced) return;
    let k = 0;
    const id = window.setInterval(() => {
      k += 1;
      setN(k);
      if (all[k - 1] !== " ") blip();
      if (k >= all.length) window.clearInterval(id);
    }, perChar);
    return () => window.clearInterval(id);
  }, [reduced, all, perChar]);

  const go = useRef<HTMLButtonElement>(null);
  const close = () => dispatch({ type: "breakingClose" });

  // Focus DISMISS; give focus back to wherever it was when the card closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    go.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  // Enter / Space / Esc dismiss, except on a link or button (those do their own thing). preventDefault also tells
  // the game's NEXT DAY keys that this press was used up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: "breakingClose" });
        return;
      }
      if (t?.closest("a, button")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dispatch({ type: "breakingClose" });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const typed = (i: number) => {
    const start = i === 0 ? 0 : ends[i - 1];
    return lines[i].slice(
      0,
      Math.max(0, Math.min(lines[i].length, shown - start)),
    );
  };
  const done = (i: number) => shown >= ends[i];
  const cursor = (i: number) =>
    !reduced &&
    shown < total &&
    shown >= (i === 0 ? 0 : ends[i - 1]) &&
    !done(i);

  return (
    <div
      className={s.bcBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bc-title"
      aria-describedby="bc-text"
    >
      {heroes.length ? <div className={s.reliefFlash} aria-hidden /> : null}
      <div className={`${s.bcCard} ${alarm ? s.bcAlarm : s.bcHero}`}>
        <div className={s.bcOuter}>
          <div className={s.bcInner}>
            <h2
              id="bc-title"
              className={s.bcHead}
              style={
                alarm
                  ? ({ "--hazard": `url("${HAZARD_URL}")` } as CSSProperties)
                  : undefined
              }
            >
              <span className={s.bcLabel}>
                {alarm ? (
                  <Pix sprite={WARN} scale={2} className={s.warnFlash} />
                ) : null}
                <span>BREAKING NEWS</span>
                {alarm ? (
                  <Pix sprite={WARN} scale={2} className={s.warnFlash} />
                ) : null}
              </span>
              <span className={s.bcDate}>{shortDate(b.date)}</span>
            </h2>

            {/* Screen readers get the whole card at once; the typed copy below is visual only. */}
            <div id="bc-text" className="sr-only">
              {b.events.map((e) => (
                <p key={e.headline}>
                  {e.headline}. {e.meaning} Source: {e.sourceName}.
                </p>
              ))}
              <p>{market}</p>
            </div>

            <ul className={s.bcList}>
              {b.events.map((e, i) => {
                const hero = isHero(e);
                const icon = ICON[e.category];
                return (
                  <li
                    key={e.headline}
                    className={`${s.bcItem} ${hero ? s.bcItemHero : ""}`}
                  >
                    {hero ? (
                      <HeroArt e={e} />
                    ) : (
                      <div className={s.bcIcon} aria-hidden>
                        <Pix sprite={icon.sprite} scale={3} />
                      </div>
                    )}
                    <div className={s.bcBody}>
                      {hero ? (
                        <span className={s.bcTag}>
                          {e.tag === "fed-hero"
                            ? "THE FED STEPS IN"
                            : "CONGRESS STEPS IN"}
                        </span>
                      ) : null}
                      <h3 className={s.bcHeadline} aria-hidden>
                        {typed(i)}
                        {cursor(i) ? <span className={s.cursor}>_</span> : null}
                      </h3>
                      <p
                        className={s.bcMeaning}
                        style={{ visibility: done(i) ? "visible" : "hidden" }}
                        aria-hidden
                      >
                        {e.meaning}
                      </p>
                      <p
                        className={s.bcSource}
                        style={{ visibility: done(i) ? "visible" : "hidden" }}
                      >
                        Source:{" "}
                        <a
                          href={e.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          tabIndex={done(i) ? undefined : -1}
                        >
                          {e.sourceName}
                        </a>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p
              className={`${s.bcMarket} ${b.move < 0 ? s.down : s.up}`}
              aria-hidden
            >
              <span className={s.bcMarketLabel}>MARKET</span>
              <span>
                {typed(lines.length - 1)}
                {cursor(lines.length - 1) ? (
                  <span className={s.cursor}>_</span>
                ) : null}
              </span>
            </p>

            <div className={s.bcButtons}>
              <span className={s.bcHint}>You stay on this day. Trade, then NEXT DAY.</span>
              <PixelButton
                ref={go}
                variant="yellow"
                onClick={close}
                onKeyDown={(e) => e.repeat && e.preventDefault()}
              >
                DISMISS
              </PixelButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
