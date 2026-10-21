import { canShield, canTrade, shieldQuote } from "@/engine";
import { moodLevel } from "@/game/atmosphere";
import { money } from "@/game/format";
import { PRESETS } from "@/game/scenario";
import {
  C,
  PIG,
  PLAY_ARROW,
  ROCKET,
  SHIELD,
  type Sprite,
} from "@/game/sprites";
import type { Action, UiState } from "@/game/store";
import s from "./game.module.css";
import { InfoButton, Panel, PixelButton, Pix } from "./ui";

const FF_ARROW: Sprite = { grid: PLAY_ARROW.grid, pal: { k: C.blue } };
const STOP_SQUARE: Sprite = {
  grid: ["kkkkk", "kkkkk", "kkkkk", "kkkkk", "kkkkk"],
  pal: { k: C.red },
};

const FEAR_TAG = { calm: "cheap", nervous: "", scared: "pricey", panic: "EXPENSIVE" } as const;

/** SHIELD button text: the live quote before buying, or why it can't be bought now. */
function shieldLabel(st: UiState): { text: string; blocked: boolean } {
  const g = st.game;
  const c = canShield(g);
  if (c.reason === "active")
    return { text: `ACTIVE · ${g.holdings.shield!.expiryT - g.t} days`, blocked: true };
  if (c.reason === "queued") return { text: "QUEUED", blocked: true };
  if (!c.ok) return { text: "SHIELD", blocked: true };
  const tag = FEAR_TAG[moodLevel(g.scenario.days[g.t].vix)];
  return { text: `SHIELD ${money(shieldQuote(g).premium)}${tag ? ` ${tag}` : ""}`, blocked: false };
}

export function Controls({
  st,
  dispatch,
}: {
  st: UiState;
  dispatch: (a: Action) => void;
}) {
  const tradable = st.phase !== "end" && canTrade(st.game);
  const pick = st.phase === "pick";
  const sel = st.selected;
  const shield = shieldLabel(st);

  return (
    <Panel title={pick ? "PICK YOUR BAG" : "ACTIONS"} tut="actions">
      <div className={s.controls}>
        {pick ? (
          <p className={s.pickIntro}>
            Pick a mix, or BUY/SELL one asset (10% of your bag per tap). Orders
            fill at the next day&apos;s open with a 0.1% fee. Then press NEXT
            DAY. Time only moves when you say so.
          </p>
        ) : null}

        <div className={s.btnRow} data-tut="presets">
          <span className={s.groupLabel}>
            MIX
            <InfoButton
              name="MIX"
              onClick={() => dispatch({ type: "tutShow", id: "pickBag" })}
            />
          </span>
          {PRESETS.map((p) => (
            <PixelButton
              key={p.id}
              variant="dim"
              disabled={!tradable}
              onClick={() => dispatch({ type: "target", weights: p.weights })}
              title={`Re-target the whole bag: SPY ${p.weights.SPY * 100}% / TLT ${p.weights.TLT * 100}% / GLD ${
                p.weights.GLD * 100
              }% / CASH ${p.weights.CASH * 100}%`}
            >
              {p.label}
            </PixelButton>
          ))}
        </div>

        <div className={s.btnRow} data-tut="trade">
          <span className={s.groupLabel}>
            TRADE
            <InfoButton
              name="TRADE"
              onClick={() => dispatch({ type: "tutShow", id: "trade" })}
            />
          </span>
          <PixelButton
            disabled={!tradable}
            onClick={() => dispatch({ type: "buy" })}
          >
            <Pix sprite={ROCKET} scale={2} />
            BUY {sel}
          </PixelButton>
          <PixelButton
            variant="red"
            disabled={!tradable}
            onClick={() => dispatch({ type: "sell" })}
          >
            <Pix
              sprite={ROCKET}
              scale={2}
              style={{ transform: "scaleY(-1)" }}
            />
            SELL {sel}
          </PixelButton>
          <PixelButton
            variant="pink"
            disabled={!tradable}
            onClick={() =>
              dispatch({
                type: "target",
                weights: { SPY: 0, TLT: 0, GLD: 0, CASH: 1 },
              })
            }
            title="Panic button: sell everything at the next open"
          >
            <Pix sprite={PIG} scale={2} />
            CASH
          </PixelButton>
          <span className={s.shieldWrap}>
            <PixelButton
              variant="blue"
              data-tut="shield"
              disabled={!tradable}
              // Blocked states stay clickable on purpose: the tap explains why with a red toast.
              aria-disabled={shield.blocked || undefined}
              className={shield.blocked ? s.looksDisabled : undefined}
              onClick={() => dispatch({ type: "shield" })}
              title="Insurance on your SPY: covers drops below -5% for 1 month (21 trading days)"
            >
              <Pix sprite={SHIELD} scale={2} />
              {shield.text}
            </PixelButton>
            <InfoButton
              name="SHIELD"
              onClick={() => dispatch({ type: "tutShow", id: "shield" })}
            />
          </span>
        </div>

        <div className={`${s.btnRow} ${s.playRow}`}>
          {st.phase === "end" ? (
            <PixelButton
              variant="yellow"
              onClick={() => dispatch({ type: "openEnd" })}
            >
              SEE RESULTS
            </PixelButton>
          ) : (
            <>
              <PixelButton
                variant="yellow"
                className={s.playBig}
                data-tut="play"
                onClick={() => dispatch({ type: "next" })}
                aria-keyshortcuts="Space Enter N"
                title="Move one trading day forward (Space, Enter or N)"
              >
                NEXT DAY <Pix sprite={PLAY_ARROW} scale={2} />
                <span className={s.keyHint} aria-hidden>
                  SPACE
                </span>
              </PixelButton>
              <PixelButton
                variant={st.ff ? "red" : "blue"}
                data-ff
                data-tut="ff"
                onClick={() => dispatch({ type: "ff" })}
                aria-keyshortcuts="F"
                title="Play quiet days automatically. Stops by itself on the next big day."
              >
                {st.ff ? (
                  <>
                    STOP <Pix sprite={STOP_SQUARE} scale={2} />
                  </>
                ) : (
                  <>
                    FAST-FORWARD
                    <span className={s.ffArrows}>
                      <Pix sprite={FF_ARROW} scale={2} />
                      <Pix sprite={FF_ARROW} scale={2} />
                    </span>
                  </>
                )}
                <span className={s.keyHint} aria-hidden>
                  F
                </span>
              </PixelButton>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
