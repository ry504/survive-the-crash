// The one v1 crisis, imported statically so the static export needs no fetch.
import type { Scenario, Weights } from "@/engine";
import raw from "../../public/data/covid-2020.json";

export const SCENARIO = raw as Scenario;

/** Market-wide circuit-breaker halts (S&P 500 down 7% intraday), spec §6. */
export const CIRCUIT_BREAKER_DAYS = new Set([
  "2020-03-09",
  "2020-03-12",
  "2020-03-16",
  "2020-03-18",
]);

export interface Preset {
  id: string;
  label: string;
  weights: Weights;
}

export const PRESETS: Preset[] = [
  {
    id: "allin",
    label: "ALL IN",
    weights: { SPY: 1, TLT: 0, GLD: 0, CASH: 0 },
  },
  {
    id: "5050",
    label: "50-50",
    weights: { SPY: 0.5, TLT: 0.5, GLD: 0, CASH: 0 },
  },
  {
    id: "balanced",
    label: "BALANCED",
    weights: { SPY: 0.6, TLT: 0.2, GLD: 0.1, CASH: 0.1 },
  },
  {
    id: "allcash",
    label: "ALL CASH",
    weights: { SPY: 0, TLT: 0, GLD: 0, CASH: 1 },
  },
];

/** SPY close-to-close move at day t (day 0: open-to-close, since there is no earlier close). */
export function spyMove(t: number, s: Scenario = SCENARIO): number {
  const d = s.days[t];
  return t === 0 ? d.SPY.c / d.SPY.o - 1 : d.SPY.c / s.days[t - 1].SPY.c - 1;
}
