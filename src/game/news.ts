// NEWS BOT lines: approved event headlines (src/game/events.ts) plus lines generated only from the data
// (spec §6: never invent a headline).
import type { GameEvent, Scenario } from "../engine/types";
import { eventsOn } from "./events";
import { absPct, money, shortDate, signedPct } from "./format";
import { CIRCUIT_BREAKER_DAYS, spyMove } from "./scenario";

/** The day's market sentence from the data alone (also the last line of a BREAKING card). */
export function marketLine(s: Scenario, t: number): string {
  const spy = spyMove(t, s);
  if (CIRCUIT_BREAKER_DAYS.has(s.days[t].date))
    return `CIRCUIT BREAKER! S&P fell 7%. Trading halted 15 min. SPY ${signedPct(spy)} at the close.`;
  if (spy <= -0.04) return `SPY -${absPct(spy)} today. Ouch.`;
  if (spy >= 0.04) return `SPY +${absPct(spy)}! Bear trap or real rally?`;
  return `SPY ${signedPct(spy)} today.`;
}

export function newsLine(
  s: Scenario,
  t: number,
  events: readonly GameEvent[],
): string {
  const d = s.days[t];
  if (t === 0) {
    return `${shortDate(d.date)}. SPY closed at ${money(d.SPY.c)}. You have $10,000. Pick your bag, then press NEXT DAY.`;
  }
  const lines: string[] = [];
  const news = eventsOn(d.date);
  if (news.length) {
    lines.push(
      `BREAKING: ${news[0].headline}.${news.length > 1 ? ` (+${news.length - 1} MORE)` : ""}`,
    );
  }
  const spy = spyMove(t, s);
  const tlt = d.TLT.c / s.days[t - 1].TLT.c - 1;

  if (CIRCUIT_BREAKER_DAYS.has(d.date) || Math.abs(spy) >= 0.04) {
    lines.push(marketLine(s, t));
  } else if (tlt >= 0.02) {
    lines.push(`Bonds +${absPct(tlt)}. Everyone runs to safety.`);
  } else if (d.vix >= 40) {
    lines.push(`Fear index at ${Math.round(d.vix)}. Hold the line.`);
  } else if (Math.abs(spy) < 0.015) {
    lines.push(`SPY ${signedPct(spy)}. Quiet day.`);
  } else {
    lines.push(`SPY ${signedPct(spy)} today.`);
  }

  for (const e of events) {
    if (e.kind === "dividend")
      lines.push(`${e.asset} paid you ${money(e.amount)}!`);
  }
  return lines.join(" ");
}
