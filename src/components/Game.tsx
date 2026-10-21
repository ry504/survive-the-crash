"use client";
// The one game screen. State lives in a pure reducer (src/game/store.ts); all money math is in src/engine.
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { halfHearts } from "@/engine";
import { moodLevel } from "@/game/atmosphere";
import { breakingFor, isHero } from "@/game/events";
import { newsLine } from "@/game/news";
import { SCENARIO } from "@/game/scenario";
import * as sound from "@/game/sound";
import { clearSave, writeSave } from "@/game/save";
import { FF_MS, blocked, coachOpen, reducer, type UiState } from "@/game/store";
import { loadProgress, saveProgress } from "@/game/tutorial";
import { MoodOverlay } from "./Atmosphere";
import { Bosses } from "./Bosses";
import { BreakingCard } from "./Breaking";
import { CandleChart } from "./CandleChart";
import { Coach } from "./Coach";
import { Confirm } from "./Confirm";
import { Controls } from "./Controls";
import { EndPanel } from "./EndPanel";
import { ShieldPop, Toasts } from "./Fx";
import { Hud } from "./Hud";
import { Mood, NewsBot } from "./MoodNews";
import { Story } from "./Story";
import { Bag, Watchlist } from "./Watchlist";
import s from "./game.module.css";

const noop = () => () => {};

export default function Game({
  initial,
  tutorial = false,
  onMenu,
}: {
  /** A fresh run, or one rebuilt from the save (CONTINUE). */
  initial: UiState;
  /** HOW TO PLAY: forget the seen tips and play the story + every tip again. */
  tutorial?: boolean;
  /** Back to the title screen (the save is kept). */
  onMenu: () => void;
}) {
  // Portals need document.body, which only exists after hydration (the page is prerendered).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [st, dispatch] = useReducer(reducer, initial);
  const [leaving, setLeaving] = useState(false);
  const { t } = st.game;
  const coach = coachOpen(st);
  const { tut } = st;
  const vix = SCENARIO.days[t].vix;
  const mood = moodLevel(vix);
  const hearts = halfHearts(st.game.history[t].drawdown);

  // Turn-based (spec §4): a day only passes on NEXT DAY. FAST-FORWARD plays one day per FF_MS, re-armed after
  // every day; the reducer stops it on big days and new tips. It also holds while "back to the title?" is open.
  const hold = blocked(st) || leaving;
  useEffect(() => {
    if (!st.ff || hold) return;
    const id = window.setTimeout(() => dispatch({ type: "ffTick" }), FF_MS);
    return () => window.clearTimeout(id);
  }, [st.ff, t, hold]);

  // Keys: Space / Enter / N = NEXT DAY, F = FAST-FORWARD. While fast-forwarding, any key or click stops it
  // (clicks still do their own thing, so a BUY during fast-forward stops it and buys).
  const live = useRef({ ff: st.ff, hold });
  useEffect(() => {
    live.current = { ff: st.ff, hold };
  });
  useEffect(() => {
    // Was focus last moved by a click/tap (true) or by the keyboard (false)? :focus-visible can't tell: Chrome
    // turns it on as soon as a key is pressed.
    let pointerFocus = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") pointerFocus = false;
      // A dialog (BREAKING card, coach) already handled this key.
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]")) return;
      const { ff, hold } = live.current;
      const k = e.key.toLowerCase();
      if (ff) {
        if (k === " " || k === "enter" || k === "n" || k === "f") e.preventDefault();
        dispatch({ type: "ffStop" });
        return;
      }
      if (hold) return;
      if (k === "f") {
        e.preventDefault();
        dispatch({ type: "ff" });
      } else if (k === "n") {
        e.preventDefault();
        dispatch({ type: "next" });
      } else if (k === " " || k === "enter") {
        // A keyboard user on a button or link presses that button. A button that only has focus because it was
        // clicked (no focus ring) must not swallow Space: that would re-press BUY instead of moving on.
        const control = el?.closest<HTMLElement>("button, a, [role='button']");
        if (control && (!pointerFocus || control.closest("[role='dialog']")))
          return;
        e.preventDefault();
        dispatch({ type: "next" });
      }
    };
    const onPointer = (e: PointerEvent) => {
      pointerFocus = true;
      if (!live.current.ff) return;
      // The FAST-FORWARD button toggles itself on click.
      if ((e.target as HTMLElement | null)?.closest("[data-ff]")) return;
      dispatch({ type: "ffStop" });
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  // Tutorial progress lives on this device only (localStorage, read after mount so SSR markup matches).
  useEffect(
    () =>
      dispatch({
        type: "tutLoad",
        saved: tutorial ? { seen: [], storySeen: false } : loadProgress(),
      }),
    [tutorial],
  );
  useEffect(() => {
    if (tut.ready) saveProgress({ seen: tut.seen, storySeen: tut.storySeen });
  }, [tut.ready, tut.seen, tut.storySeen]);

  // Mood palette (spec §8c): CSS variables on the root follow today's VIX.
  useEffect(() => {
    document.documentElement.dataset.mood = mood;
  }, [mood]);
  useEffect(() => () => void delete document.documentElement.dataset.mood, []);

  // CONTINUE (spec §9b): the run is saved on every change while it is in progress; finishing clears it.
  const { phase, log, ghostOrders } = st;
  const { pending } = st.game;
  useEffect(() => {
    if (phase === "end") clearSave();
    else writeSave(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the save only depends on these inputs
  }, [phase, t, log, ghostOrders, pending]);

  // Sound (spec §8c): unlocked by the first gesture on the title screen (App); the drone follows today's VIX.
  useEffect(() => sound.setVix(vix), [vix]);
  const prevHearts = useRef(hearts);
  useEffect(() => {
    if (hearts < prevHearts.current) sound.heartbeat();
    prevHearts.current = hearts;
  }, [hearts]);
  const fills = st.game.history[t].events.some((e) => e.kind === "fill");
  useEffect(() => {
    if (fills) sound.fillSound();
  }, [t, fills]);
  const shieldFx = st.shieldFx;
  useEffect(() => {
    if (shieldFx?.kind === "payout") {
      sound.fillSound();
      sound.reliefChord();
    } else if (shieldFx?.kind === "up") sound.fillSound();
  }, [shieldFx]);
  const card = st.breaking;
  useEffect(() => {
    if (!card) return;
    if (card.breaker) sound.siren();
    if (card.events.some(isHero)) sound.reliefChord();
  }, [card]);

  const reread = phase === "play" && !card && !!breakingFor(t);

  // Right after a hero card closes, the bosses recoil and dim for a beat (spec §6b).
  const recoil =
    st.heroT >= 0 && t - st.heroT <= 1 && !st.breaking ? st.heroT : null;

  const shakeClass =
    st.shakeId === 0 ? "" : st.shakeId % 2 ? s.shakeA : s.shakeB;
  const news = newsLine(SCENARIO, t, st.game.history[t].events);

  return (
    <main className={`${s.screen} ${shakeClass}`}>
      <h1 className="sr-only">Survive the Crash: COVID 2020</h1>
      {st.shakeId ? (
        <div key={st.shakeId} className={s.flash} aria-hidden />
      ) : null}

      <Hud st={st} dispatch={dispatch} onMenu={() => setLeaving(true)} />

      <div className={s.grid}>
        <div className={s.col}>
          <div className={s.oWatch}>
            <Watchlist st={st} dispatch={dispatch} />
          </div>
          <div className={s.oBag}>
            <Bag st={st} dispatch={dispatch} />
          </div>
        </div>
        <div className={s.col}>
          <div className={s.oChart}>
            <CandleChart
              t={t}
              dispatch={dispatch}
              fog={<Bosses t={t} recoil={recoil} />}
            />
          </div>
          <div className={`${s.duo} ${s.oDuo}`}>
            <Mood t={t} />
            <NewsBot
              text={news}
              budgetMs={st.ff ? FF_MS * 0.8 : 2000}
              blip={!st.ff}
              onReread={
                reread ? () => dispatch({ type: "breakingOpen" }) : undefined
              }
            />
          </div>
        </div>
        <div className={s.oControls}>
          <Controls st={st} dispatch={dispatch} />
        </div>
      </div>

      <Toasts
        toasts={st.toasts}
        onDone={(id) => dispatch({ type: "toastDone", id })}
      />
      {st.endOpen ? (
        <EndPanel st={st} dispatch={dispatch} onTitle={onMenu} />
      ) : null}
      {/* Portalled to <body>: the screen shake transforms <main>, which would drag fixed overlays with it.
          The BREAKING card comes first; a tutorial tip for the same day waits until it is dismissed. */}
      {mounted ? createPortal(
        <>
          <MoodOverlay level={mood} />
          {shieldFx && !st.endOpen ? (
            <ShieldPop
              key={shieldFx.id}
              fx={shieldFx}
              onDone={() => dispatch({ type: "shieldDone", id: shieldFx.id })}
            />
          ) : null}
          {card && !st.endOpen ? (
            <BreakingCard key={card.t} b={card} dispatch={dispatch} />
          ) : coach && !st.endOpen ? (
            tut.storyOpen ? (
              <Story dispatch={dispatch} />
            ) : (
              <Coach key={tut.queue[0]} id={tut.queue[0]} dispatch={dispatch} />
            )
          ) : null}
          {leaving ? (
            <Confirm
              title="BACK TO THE TITLE?"
              text={
                phase === "play"
                  ? `Your game is saved on this device. CONTINUE picks it up on day ${t + 1}.`
                  : phase === "pick"
                    ? "This game hasn't started yet, so there's nothing to save."
                    : "This game is over."
              }
              yes="MENU"
              no="KEEP PLAYING"
              onYes={onMenu}
              onNo={() => setLeaving(false)}
            />
          ) : null}
        </>,
        document.body,
      ) : null}
    </main>
  );
}
