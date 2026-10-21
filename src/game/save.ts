// CONTINUE (spec §9b): the run in progress, saved on this device. Only the inputs are stored (the orders the
// player queued each day + the day reached); loading replays them through the pure engine. A save that does not
// replay to the same value it was saved with is treated as broken and ignored.
import { ASSETS, type Order } from "../engine";
import { SCENARIO } from "./scenario";
import { replayRun, type RunInputs, type UiState } from "./store";

export const SAVE_KEY = "stc.save.v1";

export interface SaveData extends RunInputs {
  v: 1;
  scenario: string;
  /** Bag value at close t, as a check that the replay matches. */
  value: number;
}

/** The save for a run in progress, or null when there's nothing worth resuming (not started, or finished). */
export function toSave(st: UiState): SaveData | null {
  if (st.phase !== "play") return null;
  const { game } = st;
  return {
    v: 1,
    scenario: SCENARIO.meta.id,
    t: game.t,
    ghostOrders: st.ghostOrders,
    log: st.log,
    pending: game.pending,
    value: game.history[game.t].value,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;
const isAmount = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;

function isOrder(o: unknown): o is Order {
  if (!isObj(o)) return false;
  if (o.kind === "shield") return Object.keys(o).length === 1;
  if (o.kind === "buy" || o.kind === "sell")
    return ASSETS.includes(o.asset as never) && isAmount(o.dollars);
  if (o.kind !== "target" || !isObj(o.weights)) return false;
  const w = o.weights;
  const keys = [...ASSETS, "CASH"];
  if (!keys.every((k) => isAmount(w[k]) && (w[k] as number) <= 1)) return false;
  const sum = keys.reduce((a, k) => a + (w[k] as number), 0);
  return Math.abs(sum - 1) < 1e-9;
}
const isOrders = (x: unknown): x is Order[] =>
  Array.isArray(x) && x.every(isOrder);

/** Parse and replay a save. Null if it is malformed, for another scenario, or doesn't reproduce its value. */
export function restore(data: unknown): UiState | null {
  if (!isObj(data) || data.v !== 1 || data.scenario !== SCENARIO.meta.id)
    return null;
  const { t, ghostOrders, log, pending, value } = data;
  if (
    typeof t !== "number" ||
    typeof value !== "number" ||
    !isOrders(ghostOrders) ||
    !isOrders(pending) ||
    !Array.isArray(log) ||
    !log.every(isOrders)
  )
    return null;
  try {
    const st = replayRun({ t, ghostOrders, log, pending });
    const got = st.game.history[st.game.t].value;
    return Math.abs(got - value) <= 1e-6 * Math.max(1, Math.abs(value))
      ? st
      : null;
  } catch {
    return null;
  }
}

// ---------- Storage (this device only; every call wrapped, storage can be blocked) ----------

export function readSaveRaw(): string | null {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeSave(st: UiState): void {
  const data = toSave(st);
  if (!data) return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked or full: the game still plays, CONTINUE just won't be offered.
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

let cache: { raw: string | null; st: UiState | null } = { raw: null, st: null };

/** The saved run, replayed (cached per stored string, so it is safe to call on every render). */
export function loadSave(raw: string | null = readSaveRaw()): UiState | null {
  if (raw === cache.raw) return cache.st;
  let st: UiState | null = null;
  if (raw) {
    try {
      st = restore(JSON.parse(raw));
    } catch {
      st = null;
    }
  }
  cache = { raw, st };
  return st;
}
