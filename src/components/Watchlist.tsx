import {
  ASSETS,
  currentWeights,
  paperPnl,
  type Asset,
  type Order,
} from "@/engine";
import { money, pct, signedMoney, signedPct } from "@/game/format";
import { PRESETS, SCENARIO } from "@/game/scenario";
import {
  ARROW_DOWN,
  ARROW_UP,
  BOND,
  GOLD,
  PIG,
  ROCKET,
  SHIELD,
  SKULL,
  TROPHY,
  type Sprite,
} from "@/game/sprites";
import type { Action, UiState } from "@/game/store";
import { CoinDrop } from "./Fx";
import s from "./game.module.css";
import { InfoButton, Panel, PixelButton, Pix } from "./ui";

export const ASSET_ICON: Record<Asset | "CASH", Sprite> = {
  SPY: ROCKET,
  TLT: BOND,
  GLD: GOLD,
  CASH: PIG,
};

function Change({ frac }: { frac: number | null }) {
  if (frac === null) return <span className={`${s.change} ${s.sub}`}>--</span>;
  const up = frac >= 0;
  return (
    <span className={`${s.change} ${up ? s.up : s.down}`}>
      <Pix sprite={up ? ARROW_UP : ARROW_DOWN} scale={2} className={s.bob} />
      {signedPct(frac)}
    </span>
  );
}

export function Watchlist({
  st,
  dispatch,
}: {
  st: UiState;
  dispatch: (a: Action) => void;
}) {
  const t = st.game.t;
  const d = SCENARIO.days[t];
  const prev = t > 0 ? SCENARIO.days[t - 1] : null;

  return (
    <Panel
      title={
        <>
          WATCHLIST
          <InfoButton
            name="the watchlist"
            onClick={() => dispatch({ type: "tutShow", id: "watchlist" })}
          />
        </>
      }
      tut="watch"
      className={s.watchPanel}
    >
      <div className={s.rows} role="group" aria-label="Pick an asset to trade">
        {ASSETS.map((a) => {
          const sel = st.selected === a;
          return (
            <button
              key={a}
              type="button"
              className={`${s.row} ${s.rowButton} ${sel ? s.rowSelected : ""}`}
              aria-pressed={sel}
              onClick={() => dispatch({ type: "select", asset: a })}
            >
              <span className={s.iconCell}>
                <Pix sprite={ASSET_ICON[a]} scale={3} />
              </span>
              <span>
                <span className={s.ticker}>{a}</span>{" "}
                <span className={s.sub}>{SCENARIO.assets[a].label}</span>
              </span>
              <span>{money(d[a].c)}</span>
              <Change frac={prev ? d[a].c / prev[a].c - 1 : null} />
            </button>
          );
        })}
        <div className={s.row}>
          <span className={s.iconCell}>
            <Pix sprite={SKULL} scale={3} />
          </span>
          <span>
            <span className={s.ticker}>VIX</span>{" "}
            <span className={s.sub}>Fear</span>
          </span>
          <span>{Math.round(d.vix)}</span>
          <Change frac={prev ? d.vix / prev.vix - 1 : null} />
        </div>
      </div>
      <p className={s.hint}>
        Tap a row to pick what BUY/SELL trades. VIX is not tradable.
      </p>
    </Panel>
  );
}

function describeOrder(o: Order): string {
  if (o.kind === "buy") return `BUY ${o.asset} ${money(o.dollars)}`;
  if (o.kind === "sell") return `SELL ${o.asset} ${money(o.dollars)}`;
  if (o.kind === "shield") return "SHIELD: 1-MONTH COVER ON YOUR SPY";
  const w = o.weights;
  const preset = PRESETS.find((p) =>
    (["SPY", "TLT", "GLD", "CASH"] as const).every(
      (k) => p.weights[k] === w[k],
    ),
  );
  return preset
    ? `SET BAG: ${preset.label}`
    : `SET BAG ${Math.round(w.SPY * 100)}/${Math.round(w.TLT * 100)}/${Math.round(w.GLD * 100)}/${Math.round(w.CASH * 100)}`;
}

export function Bag({
  st,
  dispatch,
}: {
  st: UiState;
  dispatch: (a: Action) => void;
}) {
  const w = currentWeights(st.game);
  const { pending } = st.game;
  const keys = [...ASSETS, "CASH"] as const;
  const sh = st.game.holdings.shield;
  return (
    <Panel
      title={
        <>
          YOUR BAG
          <InfoButton
            name="your bag"
            onClick={() => dispatch({ type: "tutShow", id: "bag" })}
          />
        </>
      }
      tut="bag"
      className={s.bagPanel}
      innerClassName={s.bagBody}
    >
      {st.dividend ? (
        <CoinDrop
          key={st.dividend.id}
          amount={st.dividend.amount}
          onDone={() => dispatch({ type: "dividendDone", id: st.dividend!.id })}
        />
      ) : null}
      {keys.map((k) => {
        const on = Math.round(w[k] * 10);
        const held = k !== "CASH" && st.game.holdings.shares[k] > 0;
        const paper = k === "CASH" ? 0 : paperPnl(st.game, k);
        const stamp = st.stamps.find((x) => x.asset === k);
        return (
          <div key={k} className={s.bagRow}>
            <span className={s.iconCell}>
              <Pix sprite={ASSET_ICON[k]} scale={3} />
            </span>
            <span className={s.ticker}>{k}</span>
            <span className={s.bar} aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`${s.barSeg} ${i < on ? s.barOn : ""}`}
                />
              ))}
            </span>
            <span className={s.right}>{pct(w[k])}</span>
            {held ? (
              <span
                className={`${s.paper} ${paper >= 0 ? s.up : s.down}`}
                title="Paper P&L: what it is worth now minus what you paid. Not real until you sell."
              >
                {signedMoney(paper)} paper
              </span>
            ) : null}
            {stamp ? (
              <span
                key={stamp.id}
                className={`${s.stamp} ${stamp.amount >= 0 ? s.stampGain : s.stampLoss}`}
                role="status"
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget)
                    dispatch({ type: "stampDone", id: stamp.id });
                }}
              >
                <Pix sprite={stamp.amount >= 0 ? TROPHY : SKULL} scale={2} />
                LOCKED {signedMoney(stamp.amount)}
              </span>
            ) : null}
          </div>
        );
      })}
      {sh ? (
        <div className={s.shieldRow} data-shield-row>
          <Pix sprite={SHIELD} scale={3} />
          <span>
            SHIELD {money(st.game.shieldValue)} · {sh.expiryT - st.game.t} days · strike {money(sh.strike)}
          </span>
        </div>
      ) : null}
      {pending.length ? (
        <div className={s.ticket} role="status" data-tut="ticket">
          <div className={s.ticketHead}>
            <span>QUEUED</span>
            <PixelButton
              variant="dim"
              onClick={() => dispatch({ type: "cancel" })}
              aria-label="Cancel queued orders"
            >
              CANCEL
            </PixelButton>
          </div>
          <ul className={s.ticketList}>
            {pending.map((o, i) => (
              <li key={i}>
                {describeOrder(o)} {"->"} fills next open
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={s.empty}>No orders queued.</p>
      )}
    </Panel>
  );
}
