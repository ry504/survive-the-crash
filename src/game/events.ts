// BREAKING event cards (spec §6, §6b). The 25 events Ryan approved on 2026-10-19, copied exactly from
// docs/research/covid-2020-events.md (game day, headline, "what it means", category, tag, primary source).
// Never add an event here that is not in that approved table.
import { CIRCUIT_BREAKER_DAYS, SCENARIO, spyMove } from "./scenario";
import type { Scenario } from "../engine/types";

export type EventCategory =
  "virus" | "market" | "economy" | "government" | "fed";
export type EventTag = "virus-villain" | "fed-hero" | "congress-hero" | "none";

export interface CrisisEvent {
  /** Trading day whose close screen first shows the event (YYYY-MM-DD). */
  gameDay: string;
  headline: string;
  /** "What it means", in plain words. */
  meaning: string;
  category: EventCategory;
  tag: EventTag;
  sourceName: string;
  sourceUrl: string;
}

export const EVENTS: readonly CrisisEvent[] = [
  {
    gameDay: "2020-02-26",
    headline: "US health officials say the virus will spread in the US",
    meaning: "Americans are told to prepare for disruption at home.",
    category: "virus",
    tag: "virus-villain",
    sourceName: "Time",
    sourceUrl: "https://time.com/5790368/coronavirus-community-spread-us",
  },
  {
    gameDay: "2020-03-03",
    headline: "Fed cuts interest rates by half a point between meetings",
    meaning: "Borrowing gets cheaper to cushion the economy from the virus.",
    category: "fed",
    tag: "fed-hero",
    sourceName: "Fed",
    sourceUrl:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200303a.htm",
  },
  {
    gameDay: "2020-03-09",
    headline: "Oil crashes 24% as Saudi Arabia and Russia start a price war",
    meaning: "Oil is suddenly very cheap, hurting energy companies and stocks.",
    category: "market",
    tag: "none",
    sourceName: "CNBC",
    sourceUrl:
      "https://www.cnbc.com/2020/03/08/oil-plummets-30percent-as-opec-deal-failure-sparks-price-war-fears.html",
  },
  {
    gameDay: "2020-03-09",
    headline: "Stock trading halts for the first time since 1997",
    meaning: "Prices fell so fast the exchange paused trading to calm panic.",
    category: "market",
    tag: "none",
    sourceName: "NPR",
    sourceUrl:
      "https://www.npr.org/2020/03/09/813619387/dow-dives-1-900-points-nyse-halts-trading-as-stock-indexes-plummet",
  },
  {
    gameDay: "2020-03-10",
    headline: "Italy locks down the whole country",
    meaning: "About 60 million people are told to stay home.",
    category: "virus",
    tag: "virus-villain",
    sourceName: "CNBC",
    sourceUrl:
      "https://www.cnbc.com/2020/03/09/italy-extends-its-quarantine-to-the-entire-country-pm-asks-residents-to-stay-at-home.html",
  },
  {
    gameDay: "2020-03-11",
    headline: "WHO calls the coronavirus outbreak a pandemic",
    meaning:
      "The virus is now officially spreading worldwide, not just in a few places.",
    category: "virus",
    tag: "virus-villain",
    sourceName: "WHO",
    sourceUrl:
      "https://www.who.int/news-room/speeches/item/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020",
  },
  {
    gameDay: "2020-03-12",
    headline: "US suspends travel from Europe for 30 days",
    meaning: "Flights from most of Europe stop to slow the virus.",
    category: "government",
    tag: "none",
    sourceName: "White House archive",
    sourceUrl:
      "https://trumpwhitehouse.archives.gov/briefings-statements/remarks-president-trump-address-nation",
  },
  {
    gameDay: "2020-03-12",
    headline: "NBA suspends its season after a player tests positive",
    meaning: "Even pro sports stop, a sign of how serious things are.",
    category: "virus",
    tag: "virus-villain",
    sourceName: "ESPN",
    sourceUrl:
      "https://www.espn.com/nba/story/_/id/28887560/nba-suspends-season-further-notice-player-tests-positive-coronavirus",
  },
  {
    gameDay: "2020-03-12",
    headline: "Stock trading halts again, second time in four days",
    meaning: "Selling keeps getting worse, so the pause button is hit again.",
    category: "market",
    tag: "none",
    sourceName: "NYSE",
    sourceUrl:
      "https://www.nyse.com/article/circuit-breakers-are-doing-their-job-but-dont-close-the-markets",
  },
  {
    gameDay: "2020-03-13",
    headline: "Trump declares a national emergency over the coronavirus",
    meaning: "The government unlocks up to $50 billion to fight the virus.",
    category: "government",
    tag: "none",
    sourceName: "White House archive",
    sourceUrl:
      "https://trumpwhitehouse.archives.gov/briefings-statements/remarks-president-trump-vice-president-pence-members-coronavirus-task-force-press-conference-3",
  },
  {
    gameDay: "2020-03-16",
    headline: "Fed cuts rates to near zero and will buy bonds",
    meaning:
      "Money gets as cheap as possible and the Fed pumps cash into markets.",
    category: "fed",
    tag: "fed-hero",
    sourceName: "Fed",
    sourceUrl:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm",
  },
  {
    gameDay: "2020-03-16",
    headline: "Trading halts a third time; Dow falls nearly 13%",
    meaning: "The worst one-day stock drop since the 1987 crash.",
    category: "market",
    tag: "none",
    sourceName: "CNBC",
    sourceUrl:
      "https://www.cnbc.com/2020/03/15/traders-await-futures-open-after-fed-cuts-rates-launches-easing-program.html",
  },
  {
    gameDay: "2020-03-18",
    headline: "Trading halts a fourth time in ten days",
    meaning: "Another pause, as panic selling returns after a brief calm.",
    category: "market",
    tag: "none",
    sourceName: "NYSE",
    sourceUrl:
      "https://www.nyse.com/article/circuit-breakers-are-doing-their-job-but-dont-close-the-markets",
  },
  {
    gameDay: "2020-03-20",
    headline: "California orders all residents to stay home",
    meaning:
      "The first state-wide stay-at-home order, covering 40 million people.",
    category: "government",
    tag: "none",
    sourceName: "CA governor",
    sourceUrl:
      "https://www.gov.ca.gov/wp-content/uploads/2020/03/3.19.20-attested-EO-N-33-20-COVID-19-HEALTH-ORDER.pdf",
  },
  {
    gameDay: "2020-03-23",
    headline: "Fed promises to buy as many bonds as needed",
    meaning:
      "The Fed removes its cap and adds new loan programs for companies.",
    category: "fed",
    tag: "fed-hero",
    sourceName: "Fed",
    sourceUrl:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200323a.htm",
  },
  {
    gameDay: "2020-03-26",
    headline: "Senate passes $2 trillion relief bill, 96 to 0",
    meaning:
      "Congress agrees on huge aid for workers, families and businesses.",
    category: "government",
    tag: "congress-hero",
    sourceName: "NPR",
    sourceUrl:
      "https://www.npr.org/2020/03/25/818881845/senate-reaches-historic-deal-on-2t-coronavirus-economic-rescue-package",
  },
  {
    gameDay: "2020-03-26",
    headline: "3.3 million Americans file for unemployment in one week",
    meaning: "The most weekly jobless claims ever, up from about 282,000.",
    category: "economy",
    tag: "none",
    sourceName: "US Dept of Labor",
    sourceUrl:
      "https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20200510.pdf",
  },
  {
    gameDay: "2020-03-30",
    headline: "Trump signs the $2 trillion CARES Act into law",
    meaning:
      "Stimulus checks and business loans are now officially on the way.",
    category: "government",
    tag: "congress-hero",
    sourceName: "Treasury OIG",
    sourceUrl: "https://oig.treasury.gov/cares-act",
  },
  {
    gameDay: "2020-04-09",
    headline: "Fed announces up to $2.3 trillion in new loans",
    meaning:
      "The Fed lends to businesses and local governments to keep them afloat.",
    category: "fed",
    tag: "fed-hero",
    sourceName: "Fed",
    sourceUrl:
      "https://www.federalreserve.gov/newsevents/pressreleases/monetary20200409a.htm",
  },
  {
    gameDay: "2020-04-20",
    headline: "US oil price drops below zero for the first time",
    meaning: "Sellers paid buyers to take oil because storage was full.",
    category: "market",
    tag: "none",
    sourceName: "EIA",
    sourceUrl: "https://www.eia.gov/todayinenergy/detail.php?id=43495",
  },
  {
    gameDay: "2020-05-08",
    headline: "US lost 20.5 million jobs in April; unemployment hits 14.7%",
    meaning: "The biggest one-month job loss on record.",
    category: "economy",
    tag: "none",
    sourceName: "BLS",
    sourceUrl: "https://www.bls.gov/news.release/archives/empsit_05082020.htm",
  },
  {
    gameDay: "2020-05-18",
    headline: "Moderna reports positive early results for its vaccine",
    meaning: "First human data suggests a vaccine could work.",
    category: "virus",
    tag: "none",
    sourceName: "Moderna release",
    sourceUrl:
      "https://www.flagshippioneering.com/news/press-release/moderna-announces-positive-interim-phase-1-data-for-its-mrna-vaccine-mrna-1273-against-novel-coronavirus",
  },
  {
    gameDay: "2020-06-05",
    headline: "US added 2.5 million jobs in May; unemployment 13.3%",
    meaning: "Jobs started coming back as businesses reopened.",
    category: "economy",
    tag: "none",
    sourceName: "BLS",
    sourceUrl: "https://www.bls.gov/news.release/archives/empsit_06052020.htm",
  },
  {
    gameDay: "2020-06-09",
    headline: "Economists say the US recession began in February",
    meaning: "The record 128-month growth streak is officially over.",
    category: "economy",
    tag: "none",
    sourceName: "NBER",
    sourceUrl:
      "https://www.nber.org/news/business-cycle-dating-committee-announcement-june-8-2020",
  },
  {
    gameDay: "2020-06-11",
    headline: "Dow falls 6.9% on fears of a second virus wave",
    meaning:
      "Stocks that rallied for weeks suddenly drop as cases rise in some states.",
    category: "market",
    tag: "virus-villain",
    sourceName: "Yahoo Finance",
    sourceUrl:
      "https://finance.yahoo.com/news/stock-market-news-live-june-11-2020-222011316.html",
  },
];

export const isHero = (e: CrisisEvent) =>
  e.tag === "fed-hero" || e.tag === "congress-hero";

/** Events first shown on this trading day, in table order. */
export function eventsOn(date: string): CrisisEvent[] {
  return EVENTS.filter((e) => e.gameDay === date);
}

/** Everything that pauses one day, merged into one BREAKING card (spec §6b: one pause per day, max). */
export interface Breaking {
  t: number;
  date: string;
  events: CrisisEvent[];
  /** SPY close-to-close move that day. */
  move: number;
  /** Market-wide circuit-breaker halt that day. */
  breaker: boolean;
  /** |SPY| moved more than 3%. */
  big: boolean;
}

/** The BREAKING card for day t, or null on an ordinary day. Uses day t only: no look-ahead. */
export function breakingFor(
  t: number,
  s: Scenario = SCENARIO,
): Breaking | null {
  if (t <= 0) return null;
  const date = s.days[t].date;
  const events = eventsOn(date);
  const move = spyMove(t, s);
  const breaker = CIRCUIT_BREAKER_DAYS.has(date);
  const big = Math.abs(move) > 0.03;
  if (!events.length && !breaker && !big) return null;
  return { t, date, events, move, breaker, big };
}
