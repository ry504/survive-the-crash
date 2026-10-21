// Pop-up juice: fee goblin, dividend coin drop, achievement toasts, red flash.
import type { AnimationEvent, CSSProperties } from "react";
import { XP_PER_ACHIEVEMENT } from "@/game/achievements";
import { money } from "@/game/format";
import {
  COIN,
  COIN_BITES,
  GOBLIN_CHOMP,
  GOBLIN_GRIN,
  SHIELD,
  TROPHY,
  sheetUrl,
} from "@/game/sprites";
import type { ShieldFx, Toast } from "@/game/store";
import s from "./game.module.css";
import { Pix } from "./ui";

const GOBLIN_SHEET = sheetUrl(
  [GOBLIN_GRIN.grid, GOBLIN_CHOMP.grid],
  GOBLIN_GRIN.pal,
);
const COIN_SHEET = sheetUrl(COIN_BITES, COIN.pal);
const SCALE = 5;

/** The fee goblin pops out of the HUD and munches a coin every time an order fills. */
export function FeeGoblin({
  fee,
  onDone,
}: {
  fee: number;
  onDone: () => void;
}) {
  const vars = { "--s": SCALE } as CSSProperties;
  return (
    <div
      className={s.goblinPop}
      data-tut="fees"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
      role="status"
    >
      <span
        className={s.goblinSheet}
        style={{ ...vars, backgroundImage: `url("${GOBLIN_SHEET}")` }}
        aria-hidden
      />
      <span
        className={s.coinBites}
        style={{ ...vars, backgroundImage: `url("${COIN_SHEET}")` }}
        aria-hidden
      />
      <span className={s.goblinSay}>
        <span>NOM NOM!</span>
        <span>FEE -{money(fee)}</span>
      </span>
    </div>
  );
}

/** Dividend: coins rain into the bag with a "+$X DIVIDEND" tag. */
export function CoinDrop({
  amount,
  onDone,
}: {
  amount: number;
  onDone: () => void;
}) {
  return (
    <div className={s.coinDrop} aria-hidden>
      {[18, 42, 66, 90].map((pct, i) => (
        <Pix
          key={pct}
          sprite={COIN}
          scale={3}
          className={s.droppingCoin}
          style={{ left: `${pct}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
      <span
        className={s.divText}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onDone();
        }}
      >
        +{money(amount)} DIVIDEND
      </span>
    </div>
  );
}

/** SHIELD pop-up: a big shield blocks a falling red bar ("+$X"), a small "SHIELD UP" stamp, or a grey "expired". */
export function ShieldPop({
  fx,
  onDone,
}: {
  fx: ShieldFx;
  onDone: () => void;
}) {
  const end = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) onDone();
  };
  if (fx.kind === "payout")
    return (
      <div className={s.shieldFx} role="status">
        <div className={s.shieldStage} onAnimationEnd={end}>
          <div className={s.shieldBlock} aria-hidden>
            <span className={s.hitBar} />
            <Pix sprite={SHIELD} scale={12} />
          </div>
          <span className={s.shieldText}>
            <Pix sprite={SHIELD} scale={3} /> +{money(fx.amount)}
          </span>
          <span className={s.shieldSub}>SHIELD BLOCKED THE HIT</span>
        </div>
      </div>
    );
  return (
    <div className={s.shieldFx} role="status">
      <div
        className={`${s.shieldStage} ${fx.kind === "up" ? s.shieldUp : s.shieldSmall}`}
        onAnimationEnd={end}
      >
        <Pix sprite={SHIELD} scale={3} />
        <span className={s.shieldText}>
          {fx.kind === "up" ? "SHIELD UP" : "SHIELD EXPIRED (not needed)"}
        </span>
      </div>
    </div>
  );
}

export function Toasts({
  toasts,
  onDone,
}: {
  toasts: Toast[];
  onDone: (id: number) => void;
}) {
  return (
    <div className={s.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={s.toast} onAnimationEnd={() => onDone(t.id)}>
          <div className={s.toastOuter}>
            <div className={s.toastInner}>
              {t.kind === "warn" ? null : <Pix sprite={TROPHY} scale={3} />}
              <div>
                <div className={s.toastTitle} style={t.kind === "warn" ? { color: "var(--red)" } : undefined}>
                  {t.title}
                </div>
                {t.kind === "warn" ? null : <div className={s.toastXp}>+{XP_PER_ACHIEVEMENT} XP</div>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
