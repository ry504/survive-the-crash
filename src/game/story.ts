// Story intro (before the tutorial's welcome tip). Verified facts only, nothing after 10 Feb 2020: no spoilers.
// The last card is the game's own voice, so it has no source.

export interface StoryCard {
  date: string;
  text: string;
  /** "triumph" = green with the bull, "ominous" = red with the bear peeking in. */
  mood?: "triumph" | "ominous";
  source?: { name: string; url: string };
  /** Red warning header above the text (visual only; the text itself is unchanged). */
  alert?: string;
  /** Words in the text that get the subtle glitch effect. Each must appear in `text` exactly. */
  glitch?: string[];
}

export const STORY: StoryCard[] = [
  {
    date: "2019-12",
    text: "December 2019. A new virus is detected in Wuhan, China.",
    glitch: ["new virus"],
    source: {
      name: "WHO",
      url: "https://www.who.int/europe/emergencies/situations/covid-19",
    },
  },
  {
    date: "2020-01-23",
    text: "23 January 2020. Wuhan, a city of 11 million people, is sealed off. Trains, planes and buses: stopped.",
    glitch: ["sealed off"],
    source: {
      name: "BBC",
      url: "https://www.bbc.com/news/world-asia-china-55628488",
    },
  },
  {
    date: "2020-01-30",
    text: "30 January. The World Health Organization declares a global health emergency.",
    alert: "GLOBAL HEALTH EMERGENCY",
    glitch: ["global health emergency"],
    source: {
      name: "PAHO/WHO",
      url: "https://www.paho.org/en/news/30-1-2020-who-declares-public-health-emergency-novel-coronavirus",
    },
  },
  {
    date: "2020-02-09",
    text: "9 February. The new virus has now killed more people than SARS did in 2002–03.",
    glitch: ["SARS"],
    source: {
      name: "Wikipedia (citing ABC News)",
      url: "https://en.wikipedia.org/wiki/Timeline_of_the_COVID-19_pandemic_in_February_2020",
    },
  },
  {
    date: "2020-02-10",
    text: "And Wall Street? 10 February 2020: the S&P 500 closes at an ALL-TIME HIGH.",
    mood: "triumph",
    source: {
      name: "Yahoo Finance",
      url: "https://finance.yahoo.com/quote/%5EGSPC/history",
    },
  },
  {
    date: "2020-02-10",
    text: "Most investors aren't worried. Should you be? You have $10,000. Your story starts now.",
    mood: "ominous",
    glitch: ["Should you be?"],
  },
];
