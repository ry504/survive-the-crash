"use client";
// Title screen (spec §9b): logo over a red heartbeat with one virus boss looming behind it, PRESS START, then the menu, the crisis
// select and the sources list. Keyboard (arrows + Enter, Esc = back), mouse and touch all work.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { shortDate } from "@/game/format";
import { loadSave, readSaveRaw, clearSave } from "@/game/save";
import { SCENARIO } from "@/game/scenario";
import * as sound from "@/game/sound";
import { HONESTY_LINE, sourceSections } from "@/game/sources";
import {
  C,
  GERM_ICON,
  NEWSBOT,
  PADLOCK,
  PLAY_ARROW,
  SPEAKER_OFF,
  SPEAKER_ON,
  type Sprite,
} from "@/game/sprites";
import type { UiState } from "@/game/store";
import { Boss } from "./Bosses";
import { Confirm } from "./Confirm";
import s from "./game.module.css";
import { Panel, PixelButton, Pix } from "./ui";

export type StartMode =
  { kind: "new"; tutorial: boolean } | { kind: "continue"; st: UiState };

type View =
  "press" | "menu" | "crisis" | "sources" | "confirmNew" | "confirmHow";

const noop = () => () => {};
/** The play triangle in yellow: the menu cursor and the tile's PLAY mark. */
const CURSOR: Sprite = { grid: PLAY_ARROW.grid, pal: { k: C.yellow } };

const LOCKED = ["2008 FINANCIAL CRISIS", "GAMESTOP 2021", "SVB 2023"];

/** "10 FEB - 30 JUN 2020" from the scenario's own dates (the pixel fonts have no en dash). */
function windowLabel(): string {
  const a = shortDate(SCENARIO.meta.start);
  const b = shortDate(SCENARIO.meta.end);
  return a.slice(-4) === b.slice(-4)
    ? `${a.slice(0, -5)} - ${b}`
    : `${a} - ${b}`;
}

/** Arrow keys move focus between the [data-nav] items inside the container; held Enter/Space doesn't repeat. */
function navKeys(e: ReactKeyboardEvent<HTMLElement>) {
  if (e.repeat && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    return;
  }
  const step =
    e.key === "ArrowDown" || e.key === "ArrowRight"
      ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft"
        ? -1
        : 0;
  if (!step) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>("[data-nav]"),
  );
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = i < 0 ? 0 : (i + step + items.length) % items.length;
  items[next].focus();
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`${s.logo} ${small ? s.logoSmall : ""}`}>
      <span className="sr-only">Survive the Crash</span>
      <span className={s.logoTop} aria-hidden>
        SURVIVE THE
      </span>
      <span className={s.logoCrash} aria-hidden>
        {"CRASH".split("").map((ch, i) => (
          <span
            key={i}
            className={s.logoLetter}
            style={{ "--i": i } as CSSProperties}
          >
            {ch}
          </span>
        ))}
      </span>
    </h1>
  );
}

function MenuItem({
  id,
  children,
  onClick,
  label,
}: {
  id: string;
  children: ReactNode;
  onClick: () => void;
  label?: string;
}) {
  return (
    <PixelButton
      variant="dim"
      className={s.menuBtn}
      data-nav
      data-id={id}
      aria-label={label}
      onClick={onClick}
    >
      <Pix sprite={CURSOR} scale={2} className={s.menuCursor} />
      <span>{children}</span>
    </PixelButton>
  );
}

export function Title({
  skipPress,
  onStart,
}: {
  /** Coming back from a game: audio is already unlocked, go straight to the menu. */
  skipPress: boolean;
  onStart: (m: StartMode) => void;
}) {
  const [view, setView] = useState<View>(skipPress ? "menu" : "press");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lockedNote, setLockedNote] = useState("");
  const saved = useSyncExternalStore(
    noop,
    () => loadSave(),
    () => null,
  );
  const muted = useSyncExternalStore(
    sound.subscribeMuted,
    sound.isMuted,
    () => false,
  );
  const root = useRef<HTMLDivElement>(null);

  // A save that no longer replays (data changed, storage edited) is dropped rather than offered.
  // (Checked here, not from `saved`: on the hydration pass `saved` is still the server's null.)
  useEffect(() => {
    if (readSaveRaw() && !loadSave()) clearSave();
  }, []);

  // The title drone sits at the first day's calm.
  useEffect(() => sound.setVix(SCENARIO.days[0].vix), []);

  // Each view starts with focus on its first item (or the item we came back to), so keys work at once.
  // The yes/no box focuses its own button.
  useEffect(() => {
    const el = root.current;
    if (!el || view === "confirmNew" || view === "confirmHow") return;
    const target =
      (focusId && el.querySelector<HTMLElement>(`[data-id="${focusId}"]`)) ||
      el.querySelector<HTMLElement>("[data-autofocus]") ||
      el.querySelector<HTMLElement>("[data-nav]");
    target?.focus({ preventScroll: true });
  }, [view, focusId]);

  // The first press also unlocks browser audio (it must happen inside the gesture), so the drone starts here.
  const pressStart = () => {
    sound.unlock();
    setView("menu");
  };
  const back = (to: string) => {
    setFocusId(to);
    setLockedNote("");
    setView("menu");
  };
  const go = (v: View) => {
    setFocusId(null);
    setView(v);
  };

  // PRESS START: Enter or Space anywhere, or a click / tap anywhere on the screen. Esc goes back one screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (view === "press" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        sound.unlock();
        setView("menu");
      } else if ((view === "crisis" || view === "sources") && e.key === "Escape") {
        e.preventDefault();
        setFocusId(view === "crisis" ? "new" : "sources");
        setLockedNote("");
        setView("menu");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view]);
  const startNew = (tutorial: boolean) => {
    clearSave();
    onStart({ kind: "new", tutorial });
  };

  const title =
    view === "press" ||
    view === "menu" ||
    view === "confirmNew" ||
    view === "confirmHow";

  return (
    <div
      ref={root}
      className={`${s.title} ${view === "sources" ? s.titleTall : ""}`}
      onClick={view === "press" ? pressStart : undefined}
    >
      {title ? <div className={s.pulse} aria-hidden /> : null}
      <div className={s.titleScan} aria-hidden />

      {title ? (
        <div className={s.titleTop}>
          {/* The villain looms behind the logo, half in shadow. */}
          <div className={s.titleBoss} aria-hidden>
            <Boss variant={0} scale={18} />
          </div>
          <Logo />
          <p className={s.titleSub}>COVID 2020</p>
        </div>
      ) : (
        <Logo small />
      )}

      {view === "press" ? (
        <button
          type="button"
          className={s.pressStart}
          data-autofocus
          onClick={(e) => {
            e.stopPropagation();
            pressStart();
          }}
        >
          PRESS START
        </button>
      ) : null}

      {view === "menu" || view === "confirmNew" || view === "confirmHow" ? (
        <nav className={s.menu} aria-label="Main menu" onKeyDown={navKeys}>
          {saved ? (
            <MenuItem
              id="continue"
              label={`Continue: day ${saved.game.t + 1} of ${SCENARIO.days.length}`}
              onClick={() => onStart({ kind: "continue", st: saved })}
            >
              CONTINUE{" "}
              <span className={s.menuNote}>DAY {saved.game.t + 1}</span>
            </MenuItem>
          ) : null}
          <MenuItem
            id="new"
            onClick={() => (saved ? go("confirmNew") : go("crisis"))}
          >
            NEW GAME
          </MenuItem>
          <MenuItem
            id="how"
            onClick={() => (saved ? go("confirmHow") : startNew(true))}
          >
            HOW TO PLAY
          </MenuItem>
          <MenuItem
            id="sound"
            label={
              muted
                ? "Sound is off. Turn sound on"
                : "Sound is on. Turn sound off"
            }
            onClick={() => {
              sound.setMuted(!muted);
              sound.unlock();
            }}
          >
            SOUND: {muted ? "OFF" : "ON"}
            <Pix sprite={muted ? SPEAKER_OFF : SPEAKER_ON} scale={2} />
          </MenuItem>
          <MenuItem id="sources" onClick={() => go("sources")}>
            SOURCES
          </MenuItem>
        </nav>
      ) : null}

      {view === "confirmNew" || view === "confirmHow" ? (
        <Confirm
          warn
          focusNo
          title="OVERWRITE YOUR SAVED GAME?"
          text={`You have a game saved on day ${saved ? saved.game.t + 1 : "?"}. ${
            view === "confirmHow"
              ? "HOW TO PLAY starts a new game, and"
              : "A new game"
          } replaces it once you start.`}
          yes="OVERWRITE"
          no="KEEP IT"
          onYes={() => (view === "confirmHow" ? startNew(true) : go("crisis"))}
          onNo={() => back(view === "confirmHow" ? "how" : "new")}
        />
      ) : null}

      {view === "crisis" ? (
        <section
          className={s.crisis}
          aria-labelledby="crisis-title"
          onKeyDown={navKeys}
        >
          <h2 id="crisis-title" className={s.screenHead}>
            CHOOSE YOUR CRISIS
          </h2>
          <div className={s.tiles}>
            <button
              type="button"
              className={s.tile}
              data-nav
              data-autofocus
              aria-label={`COVID 2020. ${windowLabel()}, ${SCENARIO.meta.tradingDays} trading days. Play`}
              onClick={() => startNew(false)}
            >
              <span className={s.tileOuter}>
                <span className={s.tileInner}>
                  <Pix sprite={GERM_ICON} scale={5} className={s.tileIcon} />
                  <span className={s.tileName}>COVID 2020</span>
                  <span className={s.tileMeta}>{windowLabel()}</span>
                  <span className={s.tileMeta}>
                    {SCENARIO.meta.tradingDays} trading days
                  </span>
                  <span className={s.tilePlay}>
                    PLAY <Pix sprite={CURSOR} scale={2} />
                  </span>
                </span>
              </span>
            </button>
            {LOCKED.map((name) => (
              <button
                key={name}
                type="button"
                className={`${s.tile} ${s.tileLocked}`}
                data-nav
                aria-disabled="true"
                aria-label={`${name}. Locked, coming soon`}
                onClick={() => setLockedNote(`${name} is locked. Coming soon.`)}
              >
                <span className={s.tileOuter}>
                  <span className={s.tileInner}>
                    <Pix sprite={PADLOCK} scale={5} className={s.tileIcon} />
                    <span className={s.tileName}>{name}</span>
                    <span className={s.tileSoon}>COMING SOON</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className={s.lockedNote} role="status">
            {lockedNote}
          </p>
          <PixelButton variant="dim" data-nav onClick={() => back("new")}>
            BACK
          </PixelButton>
        </section>
      ) : null}

      {view === "sources" ? <Sources onBack={() => back("sources")} /> : null}
    </div>
  );
}

function Sources({ onBack }: { onBack: () => void }) {
  const sections = sourceSections();
  return (
    <section className={s.sources} aria-labelledby="sources-title">
      <h2 id="sources-title" className={s.screenHead}>
        SOURCES
      </h2>
      <Panel className={s.sourcesPanel} innerClassName={s.sourcesBody}>
        <div className={s.sourcesScroll} tabIndex={0} aria-label="Sources list">
          <p className={s.honesty}>
            <Pix sprite={NEWSBOT} scale={3} /> {HONESTY_LINE}
          </p>
          {sections.map((sec) => (
            <div key={sec.title} className={s.srcSection}>
              <h3 className={s.srcTitle}>{sec.title}</h3>
              <ul className={s.srcList}>
                {sec.items.map((it, i) => (
                  <li key={i} className={s.srcItem}>
                    {it.date ? (
                      <span className={s.srcDate}>{it.date}</span>
                    ) : null}
                    <span className={s.srcText}>
                      {it.text}{" "}
                      {it.links.length ? (
                        it.links.map((l, k) => (
                          <span key={l.url}>
                            {k ? " / " : ""}
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {l.name}
                            </a>
                          </span>
                        ))
                      ) : (
                        <span className={s.srcOwn}>
                          (NEWS BOT&apos;s own words)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
      <PixelButton variant="dim" data-autofocus onClick={onBack}>
        BACK
      </PixelButton>
    </section>
  );
}
