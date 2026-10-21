"use client";
// Story intro: NEWS BOT tells what happened up to 10 Feb 2020, one full-screen card at a time. No spoilers.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { STORY } from "@/game/story";
import { BEAR, BULL, NEWSBOT, PLAY_ARROW, WARN } from "@/game/sprites";
import type { Action } from "@/game/store";
import { Typewriter } from "./MoodNews";
import s from "./game.module.css";
import { PixelButton, Pix } from "./ui";

/** Slow, ominous typing for the backstory (ms per character). */
const STORY_MS = 46;

/** Wrap the typed part of each glitch word in a span (the word may still be half typed). */
function glitchify(full: string, shown: string, words: string[]): ReactNode {
  const marks = words
    .map((w) => [full.indexOf(w), full.indexOf(w) + w.length] as const)
    .filter(([a]) => a >= 0)
    .sort((x, y) => x[0] - y[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const [a, b] of marks) {
    if (a >= shown.length) break;
    if (a > pos) out.push(shown.slice(pos, a));
    const seg = shown.slice(a, Math.min(b, shown.length));
    out.push(
      <span key={a} className={s.glitch} data-text={seg}>
        {seg}
      </span>,
    );
    pos = Math.min(b, shown.length);
  }
  if (pos < shown.length) out.push(shown.slice(pos));
  return out;
}

export function Story({ dispatch }: { dispatch: (a: Action) => void }) {
  const [i, setI] = useState(0);
  const card = STORY[i];
  const last = i === STORY.length - 1;
  const next = useRef<HTMLButtonElement>(null);

  const advance = () =>
    last
      ? dispatch({ type: "storyDone" })
      : setI((k) => Math.min(k + 1, STORY.length - 1));

  useEffect(() => next.current?.focus({ preventScroll: true }), [i]);

  // Enter / Space advance from anywhere except a link or button (those do their own thing). Esc skips the story.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      // Esc always skips; Enter/Space are left to a focused link or button (NEXT is focused by default).
      if (t?.closest("a, button") && e.key !== "Escape") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (last) dispatch({ type: "storyDone" });
        else setI((k) => Math.min(k + 1, STORY.length - 1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: "storyDone" });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [last, dispatch]);

  const mood =
    card.mood === "triumph"
      ? s.storyTriumph
      : card.mood === "ominous" || card.alert
        ? s.storyOminous
        : "";

  return (
    <div
      className={`${s.storyBackdrop} ${card.mood === "triumph" ? "" : s.storyDread}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-title"
      aria-describedby="story-text"
    >
      <div className={`${s.storyCard} ${mood}`}>
        <div className={s.storyOuter}>
          <div className={s.storyInner}>
            <h2 id="story-title" className={s.storyTitle}>
              <Pix sprite={NEWSBOT} scale={4} />
              <span>NEWS BOT REMEMBERS...</span>
              <span className={s.storyCount}>
                {i + 1}/{STORY.length}
              </span>
            </h2>
            {card.alert ? (
              <p className={s.storyAlert}>
                <Pix sprite={WARN} scale={3} alt="Warning" className={s.warnFlash} />
                <span>{card.alert}</span>
                <Pix sprite={WARN} scale={3} className={s.warnFlash} />
              </p>
            ) : null}
            <div className={s.storyStage}>
              {card.mood === "triumph" ? (
                <Pix
                  sprite={BULL}
                  scale={6}
                  alt="A happy bull"
                  className={`${s.storyBull} ${s.bob}`}
                />
              ) : null}
              <p id="story-text" className={s.storyText} aria-live="polite">
                <Typewriter
                  key={i}
                  text={card.text}
                  budgetMs={card.text.length * STORY_MS}
                  maxMs={STORY_MS}
                  blip
                  render={
                    card.glitch
                      ? (shown) => glitchify(card.text, shown, card.glitch!)
                      : undefined
                  }
                />
              </p>
            </div>
            <p className={s.storySource}>
              {card.source ? (
                <>
                  Source:{" "}
                  <a
                    href={card.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {card.source.name}
                  </a>
                </>
              ) : (
                " "
              )}
            </p>
            <div className={s.storyButtons}>
              <button
                type="button"
                className={s.skipLink}
                onClick={() => dispatch({ type: "storyDone" })}
              >
                SKIP STORY
              </button>
              <PixelButton
                ref={next}
                variant="yellow"
                onClick={advance}
                onKeyDown={(e) => e.repeat && e.preventDefault()}
              >
                {last ? "START" : "NEXT"} <Pix sprite={PLAY_ARROW} scale={2} />
              </PixelButton>
            </div>
          </div>
        </div>
        {card.mood === "ominous" ? (
          <Pix
            sprite={BEAR}
            scale={6}
            alt="A bear peeking in"
            className={s.storyBear}
          />
        ) : null}
      </div>
    </div>
  );
}
