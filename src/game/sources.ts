// SOURCES screen (spec §9b): every data and news source in one place, generated from the data files themselves
// (story.ts, events.ts, the scenario's meta), never hand-copied.
import { EVENTS } from "./events";
import { shortDate } from "./format";
import { SCENARIO } from "./scenario";
import { STORY } from "./story";

export interface SourceLink {
  name: string;
  url: string;
}
export interface SourceItem {
  /** Display date, e.g. "16 MAR 2020" or "DEC 2019". */
  date?: string;
  text: string;
  /** No link = the game's own words (the last story card). */
  links: SourceLink[];
}
export interface SourceSection {
  title: string;
  items: SourceItem[];
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** "2020-03-16" -> "16 MAR 2020"; "2019-12" -> "DEC 2019". */
export function sourceDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d ? shortDate(iso) : `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Market tickers in the data file (tradable assets, then the fear index and the T-bill rate). */
const TICKERS = [...Object.keys(SCENARIO.assets), "^VIX", "^IRX"];

export function sourceSections(): SourceSection[] {
  const { meta } = SCENARIO;
  return [
    {
      title: "MARKET DATA",
      items: [
        {
          text: `Daily prices ${shortDate(meta.start)} to ${shortDate(meta.end)} (${meta.tradingDays} trading days): ${TICKERS.join(", ")}. ${meta.source}.`,
          links: [
            { name: "Yahoo Finance", url: "https://finance.yahoo.com" },
            { name: "yfinance", url: "https://github.com/ranaroussi/yfinance" },
          ],
        },
      ],
    },
    {
      title: "CASE DATA",
      items: [
        {
          text: "Cumulative global confirmed COVID-19 cases (the CASES counter). Johns Hopkins University CSSE COVID-19 Data Repository, CC BY 4.0.",
          links: [
            {
              name: "JHU CSSE on GitHub",
              url: "https://github.com/CSSEGISandData/COVID-19",
            },
            {
              name: "CC BY 4.0",
              url: "https://creativecommons.org/licenses/by/4.0/",
            },
          ],
        },
      ],
    },
    {
      title: `STORY INTRO (${STORY.length} CARDS)`,
      items: STORY.map((c) => ({
        date: sourceDate(c.date),
        text: c.text,
        links: c.source ? [c.source] : [],
      })),
    },
    {
      title: `BREAKING NEWS (${EVENTS.length} EVENTS)`,
      items: EVENTS.map((e) => ({
        date: shortDate(e.gameDay),
        text: e.headline,
        links: [{ name: e.sourceName, url: e.sourceUrl }],
      })),
    },
  ];
}

export const HONESTY_LINE = "No headline in this game is invented.";
