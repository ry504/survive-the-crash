"use client";
// MISSION COMPLETE / FINAL REPORT (spec §7): rank from the skill score (Sharpe) vs the ghost, the four stats with
// their real names revealed, the regret reveal, fees / dividends / locked-in P&L, the 25% badge and the honesty note.
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { runGhost } from "@/engine";
import { money, pct, signedMoney, signedPct } from "@/game/format";
import { SCENARIO } from "@/game/scenario";
import { buildReport, type RankId, type Stats } from "@/game/scoring";
import {
  BEAR,
  BULL,
  HEART_HALF,
  SHIELD,
  SKULL,
  TROPHY,
  type Sprite,
} from "@/game/sprites";
import type { Action, UiState } from "@/game/store";
import s from "./game.module.css";
import e from "./EndPanel.module.css";
import { Panel, PixelButton, Pix } from "./ui";

const RANK_ART: Record<RankId, { sprite: Sprite; scale: number; cls: string }> =
  {
    panic: { sprite: BEAR, scale: 6, cls: e.rankPanic },
    survivor: { sprite: HEART_HALF, scale: 10, cls: e.rankSurvivor },
    steady: { sprite: BULL, scale: 6, cls: e.rankSteady },
    legend: { sprite: TROPHY, scale: 10, cls: e.rankLegend },
  };

/** Sharpe to 2 decimals with a sign; "N/A" when undefined. Never "-0.00". */
export function sharpeText(v: number | null): string {
  if (v === null) return "N/A";
  const a = Math.abs(v).toFixed(2);
  if (a === "0.00") return "0.00";
  return v > 0 ? `+${a}` : `-${a}`;
}

interface Row {
  plain: string;
  term: string;
  show: (x: Stats) => string;
  /** Which way is better; ties (same text on screen) highlight nothing. */
  better: "high" | "low";
  key: (x: Stats) => number | null;
}

const ROWS: Row[] = [
  {
    plain: "Money made",
    term: "Total return",
    show: (x) => signedPct(x.totalReturn),
    better: "high",
    key: (x) => x.totalReturn,
  },
  {
    plain: "Worst fall",
    term: "Max drawdown",
    show: (x) => (x.maxDrawdown > 0.0005 ? `-${pct(x.maxDrawdown)}` : "0.0%"),
    better: "low",
    key: (x) => x.maxDrawdown,
  },
  {
    plain: "Bumpiness",
    term: "Volatility (yearly)",
    show: (x) => pct(x.volatility),
    better: "low",
    key: (x) => x.volatility,
  },
  {
    plain: "Skill score",
    term: "Sharpe ratio",
    show: (x) => sharpeText(x.sharpe),
    better: "high",
    key: (x) => x.sharpe,
  },
];

function winner(r: Row, you: Stats, ghost: Stats): "you" | "ghost" | null {
  if (r.show(you) === r.show(ghost)) return null;
  const a = r.key(you);
  const b = r.key(ghost);
  if (a === null || b === null) return null;
  const youBetter = r.better === "high" ? a > b : a < b;
  return youBetter ? "you" : "ghost";
}

export function EndPanel({
  st,
  dispatch,
  onTitle,
}: {
  st: UiState;
  dispatch: (a: Action) => void;
  /** Back to the title screen (the finished game has no save to keep). */
  onTitle: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus({ preventScroll: true }), []);

  const { history } = st.game;
  const ghostHist = st.ghost;
  const report = useMemo(
    () => buildReport(history, ghostHist ?? runGhost(SCENARIO, []), SCENARIO),
    [history, ghostHist],
  );
  const { you, ghost, rank } = report;
  const art = RANK_ART[rank.id];

  // Keep Tab inside the dialog; Esc closes it to look at the board (SEE RESULTS reopens it).
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      dispatch({ type: "closeEnd" });
      return;
    }
    if (ev.key !== "Tab" || !box.current) return;
    const items = [
      ...box.current.querySelectorAll<HTMLElement>(
        "button, a[href], [tabindex='0']",
      ),
    ];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`${s.backdrop} ${e.backdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
      aria-describedby="end-blurb"
      onKeyDown={onKeyDown}
      ref={box}
    >
      <Panel title="FINAL REPORT" className={e.box} innerClassName={e.body}>
        <p className={e.kicker}>
          MISSION COMPLETE - {history.length} DAYS SURVIVED
        </p>

        <div className={e.top}>
          <div className={e.rank}>
            <Pix sprite={art.sprite} scale={art.scale} className={e.rankArt} />
            <div>
              <p className={e.label}>YOUR RANK</p>
              <h2 id="end-title" className={`${e.rankTitle} ${art.cls}`}>
                {rank.title}
              </h2>
              <p id="end-blurb" className={e.blurb}>
                {rank.blurb}
              </p>
            </div>
          </div>
          <div
            className={e.score}
            aria-label={`Skill score: you ${sharpeText(you.sharpe)}, ghost ${sharpeText(ghost.sharpe)}`}
          >
            <p className={e.label}>SKILL SCORE</p>
            <div className={e.scoreRow}>
              <div>
                <span className={e.scoreWho}>YOU</span>
                <span className={e.scoreBig}>{sharpeText(you.sharpe)}</span>
              </div>
              <span className={e.vs}>VS</span>
              <div>
                <span className={e.scoreWho}>GHOST</span>
                <span className={`${e.scoreBig} ${e.scoreGhost}`}>
                  {sharpeText(ghost.sharpe)}
                </span>
              </div>
            </div>
            <p className={e.gap}>
              {report.gap === null
                ? "No bumps, no skill score: ranked on money made vs the ghost."
                : `Gap ${sharpeText(report.gap)}. The ghost kept your day-1 bag and did nothing.`}
            </p>
          </div>
        </div>

        <table className={e.table}>
          <caption className="sr-only">
            Your stats next to the ghost&apos;s, with the real finance names
          </caption>
          <thead>
            <tr>
              <th scope="col">STAT</th>
              <th scope="col">YOU</th>
              <th scope="col">GHOST</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const w = winner(r, you, ghost);
              return (
                <tr key={r.plain}>
                  <th scope="row">
                    <span className={e.plain}>{r.plain}</span>
                    <span className={e.term}>= {r.term}</span>
                  </th>
                  <td className={w === "you" ? e.best : undefined}>
                    {r.show(you)}
                    {w === "you" ? (
                      <span className="sr-only"> (better)</span>
                    ) : null}
                  </td>
                  <td className={w === "ghost" ? e.best : e.ghostCell}>
                    {r.show(ghost)}
                    {w === "ghost" ? (
                      <span className="sr-only"> (better)</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={e.regret}>
          <p>{report.regret}</p>
          {report.bestBuy ? (
            <p className={e.bestBuy}>{report.bestBuy}</p>
          ) : null}
        </div>

        <dl className={e.extras}>
          <div>
            <dt>Fees paid</dt>
            <dd className={s.down}>{money(report.fees)}</dd>
          </div>
          <div>
            <dt>Dividends</dt>
            <dd className={s.money}>{money(report.dividends)}</dd>
          </div>
          <div>
            <dt>Locked-in P&amp;L</dt>
            <dd className={report.locked >= 0 ? s.up : s.down}>
              {signedMoney(report.locked)}
            </dd>
          </div>
          <div>
            <dt>Final bag</dt>
            <dd className={s.money}>{money(you.finalValue)}</dd>
          </div>
        </dl>

        {report.shieldPaid > 0 ? (
          <p className={e.insurance}>
            <Pix sprite={SHIELD} scale={2} />
            Insurance paid / got back:{" "}
            <b className={s.down}>{money(report.shieldPaid)}</b> /{" "}
            <b className={s.up}>{money(report.shieldBack)}</b>
          </p>
        ) : null}

        {report.brokeLimit ? (
          <p className={e.badge}>
            <Pix sprite={SKULL} scale={2} />
            BROKE THE 25% LIMIT
          </p>
        ) : null}

        <p className={e.honesty}>
          Sharpe over 99 days is noisy — one lucky week can swing it.
        </p>

        <div className={e.buttons}>
          <PixelButton
            ref={again}
            variant="yellow"
            onClick={() => dispatch({ type: "restart" })}
          >
            PLAY AGAIN
          </PixelButton>
          <PixelButton variant="dim" onClick={onTitle}>
            TITLE
          </PixelButton>
          <PixelButton
            variant="dim"
            onClick={() => dispatch({ type: "closeEnd" })}
            aria-keyshortcuts="Escape"
          >
            VIEW BOARD
          </PixelButton>
        </div>
      </Panel>
    </div>
  );
}
