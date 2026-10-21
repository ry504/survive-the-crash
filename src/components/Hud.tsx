"use client";
import { useSyncExternalStore } from "react";
import { halfHearts } from "@/engine";
import { XP_PER_LEVEL, level } from "@/game/achievements";
import { money, shortDate, signedMoney } from "@/game/format";
import { SCENARIO } from "@/game/scenario";
import { isMuted, setMuted, subscribeMuted, unlock } from "@/game/sound";
import {
  COIN,
  GOBLIN_GRIN,
  HEART_EMPTY,
  HEART_FULL,
  HEART_HALF,
  SPEAKER_OFF,
  SPEAKER_ON,
} from "@/game/sprites";
import type { Action, UiState } from "@/game/store";
import { FeeGoblin } from "./Fx";
import s from "./game.module.css";
import { InfoButton, Panel, PixelButton, Pix } from "./ui";

export function Hud({
  st,
  dispatch,
  onMenu,
}: {
  st: UiState;
  dispatch: (a: Action) => void;
  onMenu: () => void;
}) {
  const { game } = st;
  const rec = game.history[game.t];
  const half = halfHearts(rec.drawdown);
  const ghost = st.ghost?.[game.t];
  const xpInLevel = st.xp % XP_PER_LEVEL;
  const segs = Math.floor(xpInLevel / (XP_PER_LEVEL / 10));
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);

  return (
    <Panel
      title={
        <>
          SURVIVE THE CRASH
          <InfoButton
            name="the top bar"
            onClick={() => dispatch({ type: "tutShow", id: "topBar" })}
          />
        </>
      }
      tut="hud"
    >
      <div className={s.hud}>
        <div className={s.hudItem}>
          <span className={s.hudLabel}>DAY</span>
          <span>
            {String(game.t + 1).padStart(2, "0")}/{SCENARIO.days.length}
          </span>
        </div>
        <div className={s.hudItem}>{shortDate(rec.date)}</div>
        <div
          className={`${s.hudItem} ${s.hearts}`}
          data-tut="hearts"
          role="img"
          aria-label={`${half / 2} of 5 hearts. Down ${(rec.drawdown * 100).toFixed(1)}% from your peak.`}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const left = half - i * 2;
            return (
              <Pix
                key={i}
                sprite={
                  left >= 2 ? HEART_FULL : left === 1 ? HEART_HALF : HEART_EMPTY
                }
                scale={3}
              />
            );
          })}
        </div>
        <div className={s.hudItem} data-tut="money">
          <Pix sprite={COIN} scale={3} className={s.spin} />
          <span
            className={s.money}
            aria-label={`Bag value ${money(rec.value)}`}
          >
            {money(rec.value)}
          </span>
          <span className={s.damageLayer} aria-hidden>
            {st.damage.map((d) => (
              <span
                key={d.id}
                className={`${s.damage} ${d.amount >= 0 ? s.up : s.down}`}
                onAnimationEnd={() =>
                  dispatch({ type: "damageDone", id: d.id })
                }
              >
                {signedMoney(d.amount)}
              </span>
            ))}
          </span>
        </div>
        {ghost ? (
          <div
            className={`${s.hudItem} ${s.ghost}`}
            data-tut="ghost"
            title="Your day-1 bag, never touched"
          >
            GHOST {money(ghost.value)}
          </div>
        ) : null}
        <div className={s.hudItem} data-tut="fees">
          <Pix sprite={GOBLIN_GRIN} scale={2} alt="Fee goblin" />
          <span>
            <span className={s.hudLabel}>FEES</span> {money(game.feesPaid)}
          </span>
          {st.goblin ? (
            <FeeGoblin
              key={st.goblin.id}
              fee={st.goblin.fee}
              onDone={() => dispatch({ type: "goblinDone", id: st.goblin!.id })}
            />
          ) : null}
        </div>
        <div className={s.hudItem}>
          <span className={s.hudLabel}>LV {level(st.xp)}</span>
          <span className={s.xpBar} role="img" aria-label={`${st.xp} XP`}>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`${s.xpSeg} ${i < segs ? s.xpSegOn : ""}`}
              />
            ))}
          </span>
          <span>{st.xp} XP</span>
        </div>
        <PixelButton
          variant="dim"
          className={`${s.helpBtn} ${s.iconBtn}`}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          title={muted ? "Sound off" : "Sound on"}
          onClick={() => {
            setMuted(!muted);
            unlock();
          }}
        >
          <Pix sprite={muted ? SPEAKER_OFF : SPEAKER_ON} scale={2} />
        </PixelButton>
        <PixelButton
          variant="dim"
          className={s.iconBtn}
          aria-label="Replay tutorial"
          title="Replay the story and tutorial"
          onClick={() => dispatch({ type: "tutReplay" })}
        >
          ?
        </PixelButton>
        <PixelButton
          variant="dim"
          className={s.iconBtn}
          aria-label="Back to the title menu (your game is saved)"
          title="Back to the title menu"
          onClick={onMenu}
        >
          MENU
        </PixelButton>
      </div>
    </Panel>
  );
}
