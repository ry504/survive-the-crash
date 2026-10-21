// Pixel sprites drawn in code (spec §9, docs/design/pixel-reference.md).
// A grid is rows of characters: "." = transparent, any other char maps to a colour in the palette.
// spriteUrl/sheetUrl turn grids into SVG data URLs (pure strings, so server and client render the same).

export type Grid = readonly string[];
export type Palette = Readonly<Record<string, string>>;
export interface Sprite {
  grid: Grid;
  pal: Palette;
}

const sprite = (grid: Grid, pal: Palette): Sprite => ({ grid, pal });

// ---------- Palette from the reference ----------
export const C = {
  bg: "#0a0e0a",
  line: "#1f3a24",
  green: "#7dff8a",
  dim: "#8aa88f",
  red: "#ff3b5c",
  heartOff: "#3a1520",
  yellow: "#ffcc33",
  money: "#ffd400",
  darkGold: "#c08a00",
  paleGold: "#fff8b0",
  pink: "#ff9fd0",
  pinkBg: "#1a0a14",
  blue: "#29adff",
  orange: "#ffa300",
  fog: "#10200f",
  grid: "#14261a",
} as const;

// ---------- Sprites from the reference ----------
const HEART: Grid = [
  ".aa.bb.",
  "aawabbb",
  "aaaabbb",
  ".aaabb.",
  "..aab..",
  "...a...",
];
export const HEART_FULL = sprite(HEART, { a: C.red, b: C.red, w: "#ffffff" });
export const HEART_HALF = sprite(HEART, {
  a: C.red,
  b: C.heartOff,
  w: "#ffffff",
});
export const HEART_EMPTY = sprite(HEART, {
  a: C.heartOff,
  b: C.heartOff,
  w: C.heartOff,
});

const COIN_PAL = { y: C.money, o: C.darkGold, w: C.paleGold };
export const COIN = sprite(
  [".yyyy.", "yywwyy", "ywyyyo", "yyyyyo", "yyyyoo", ".oooo."],
  COIN_PAL,
);

export const ROCKET = sprite(
  [
    "....w....",
    "...www...",
    "...wbw...",
    "...www...",
    "...www...",
    "..rwwwr..",
    ".rr.w.rr.",
    "...ooo...",
    "....o....",
  ],
  { w: "#e8eef4", b: C.blue, r: C.red, o: C.orange },
);
export const SHIELD = sprite(
  ["bbbbbbb", "bwwbbbb", "bwbbbbb", "bbbbbbb", ".bbbbb.", "..bbb..", "...b..."],
  {
    b: C.blue,
    w: "#c8ecff",
  },
);
export const GOLD = sprite(
  ["..yyyyyy", "..ywwyyo", ".yyyyyoo", "yyyyyooo", "oooooooo"],
  COIN_PAL,
);
export const PIG = sprite(
  [
    ".p....p...",
    "pppppppp..",
    "ppkpppppnn",
    "pppppppppn",
    "pppppppp..",
    ".pp..pp...",
  ],
  { p: C.pink, k: "#000000", n: "#ff6fb0" },
);
export const SKULL = sprite(
  [".wwwww.", "wwwwwww", "wkkwkkw", "wwwkwww", ".wwwww.", ".w.w.w."],
  {
    w: "#ffffff",
    k: "#000000",
  },
);
export const TROPHY = sprite(
  ["yyyyyyy", "yywyyyy", ".yyyyy.", "..yyy..", "...y...", "..ooo..", ".ooooo."],
  COIN_PAL,
);
export const BEAR = sprite(
  [
    ".##......##.",
    "#bb#....#bb#",
    "#bbbbbbbbbb#",
    "#bbwbbbbwbb#",
    "#bbkbbbbkbb#",
    "#bbbbnnbbbb#",
    "#bbbnmmnbbb#",
    ".#bbbbbbbb#.",
    "..########..",
  ],
  {
    "#": "#000000",
    b: "#c0563a",
    w: "#ffffff",
    k: "#000000",
    n: "#ffb3a0",
    m: "#000000",
  },
);
export const BULL = sprite(
  [
    "h..........h",
    "hh........hh",
    ".hh######hh.",
    "..#bbbbbb#..",
    "..#wbbbbw#..",
    "..#kbbbbk#..",
    "..#bbbbbb#..",
    "..#bnnnnb#..",
    "..#nknnkn#..",
    "...######...",
  ],
  {
    h: "#e8e0c0",
    "#": "#000000",
    b: "#3fae4f",
    w: "#ffffff",
    k: "#000000",
    n: "#ffb3a0",
  },
);
const TRADER_PAL = {
  h: "#3b2416",
  s: "#f1c27d",
  k: "#000000",
  b: "#2e5fa8",
  r: C.red,
  d: "#6cc6ff",
};
export const TRADER_HAPPY = sprite(
  [
    "s.hhhh.s",
    "s.hhhh.s",
    "s.skks.s",
    "ssssssss",
    ".bbrrbb.",
    ".bbrrbb.",
    "..bbbb..",
    "..b..b..",
    "..k..k..",
  ],
  TRADER_PAL,
);
export const TRADER_SAD = sprite(
  [
    "..hhhh..",
    "..hhhh..",
    "..skks.d",
    "..ssss.d",
    "sbbrrbbs",
    "sbbrrbbs",
    "..bbbb..",
    "..b..b..",
    "..k..k..",
  ],
  TRADER_PAL,
);
export const NEWSBOT = sprite(
  [
    "....y.....",
    "....k.....",
    "kkkkkkkkkk",
    "kggggggggk",
    "kgwwggwwgk",
    "kggggggggk",
    "kgggwwgggk",
    "kkkkkkkkkk",
    "...kbbk...",
    "..kbbbbk..",
    "..kk..kk..",
  ],
  { y: C.red, k: "#8a8f98", g: "#0a2a12", w: C.green, b: "#c2c3c7" },
);

// ---------- New sprites, same style ----------

/** Bond certificate for TLT (the shield is reserved for SHIELD insurance). */
export const BOND = sprite(
  ["wwwwwww", "wbbbbbw", "wwwwwww", "wbbbwww", "wwwwwww", "wwwwrrw", "wwwwrrw"],
  {
    w: "#e8eef4",
    b: C.blue,
    r: C.red,
  },
);

export const PADLOCK = sprite(
  ["..kkk..", ".k...k.", ".k...k.", "kkkkkkk", "kkkykkk", "kkkykkk", "kkkkkkk"],
  {
    k: "#8a8f98",
    y: C.bg,
  },
);

export const ARROW_UP = sprite(["..g..", ".ggg.", "ggggg"], { g: C.green });
export const ARROW_DOWN = sprite(["rrrrr", ".rrr.", "..r.."], { r: C.red });
/** Play triangle for "GOT IT" / "NEXT" (dark ink on the yellow button). */
export const PLAY_ARROW = sprite(["k...", "kk..", "kkk.", "kkkk", "kkk.", "kk..", "k..."], {
  k: C.bg,
});

/** Fee goblin (designer's mechanic, spec §3): green, big pointy ears, yellow eyes, toothy grin. 12x11. */
const GOBLIN_PAL = {
  g: "#5fd35a",
  d: "#2f7d32",
  y: C.yellow,
  k: "#000000",
  w: "#ffffff",
  m: "#5a0f1e",
};
const GOBLIN_TOP: Grid = [
  "d..........d",
  "dd.gggggg.dd",
  ".dggggggggd.",
  "..gkyggykg..",
  "..gggggggg..",
];
export const GOBLIN_GRIN = sprite(
  [
    ...GOBLIN_TOP,
    "..gggddggg..",
    "..kwwwwwwk..",
    "..gkwkkwkg..",
    "...gggggg...",
    "..dd....dd..",
    "............",
  ],
  GOBLIN_PAL,
);
export const GOBLIN_CHOMP = sprite(
  [
    ...GOBLIN_TOP,
    "..gggddggg..",
    "..gwkwwkwg..",
    "..gmmmmmmg..",
    "..gwkwwkwg..",
    "...gggggg...",
    "..dd....dd..",
  ],
  GOBLIN_PAL,
);

/** A coin getting eaten: full, one bite, two bites, crumbs. Same 6x6 box as COIN. */
export const COIN_BITES: Grid[] = [
  COIN.grid,
  [".yyy..", "yyww..", "ywyy..", "yyyyy.", "yyyyoo", ".oooo."],
  ["......", "......", "yy....", "yyy...", "yyyo..", ".oo..."],
  ["......", "......", "......", "..y...", "......", ".o..y."],
];

// ---------- Crisis layer (spec §6b, §8c): germ icon, virus boss, warning sign, heroes, event icons ----------

/** Small static germ icon: the CASES counter, virus BREAKING items and the COVID crisis tile. Never shown in crowds. */
export const GERM_ICON = sprite(
  [
    "....s....",
    ".s..s..s.",
    "..sgggs..",
    ".ggggggg.",
    "ssgggggss",
    ".ggggggg.",
    "..sgggs..",
    ".s..s..s.",
    "....s....",
  ],
  { g: "#ff6f91", s: "#b0204a" },
);

/**
 * Virus boss (spec §6b, replaces the swarm): menacing, not gory, not bug-like. A dark sickly round body with thick
 * jagged spike proteins around the rim, a dull highlight and exactly two narrow, slanted, glowing red slit eyes.
 * No mouth, no spots, no legs or antennae. 16x16, radially symmetric "sea mine": 8 short thick club spikes
 * (stalk s + knob k) evenly around a round body, so it reads as a ball, never as a body with legs.
 * b = body, s = spike stalk, k = spike knob, h = dull highlight, e = eyes.
 */
export const BOSS: Grid = [
  "......kkkk......",
  ".kk....ss....kk.",
  ".kks...ss...skk.",
  "....bbbbbbbb....",
  "...bhhbbbbbbb...",
  "..bhhbbbbbbbbb..",
  "kssbbbbbbbbbbssk",
  "ksbeebbbbbbeebsk",
  "ksbbeebbbbeebbsk",
  "kssbbbbbbbbbbssk",
  "..bbbbbbbbbbbb..",
  "...bbbbbbbbbb...",
  "....bbbbbbbb....",
  ".kks...ss...skk.",
  ".kk....ss....kk.",
  "......kkkk......",
];
/** Just the eyes, white-hot, laid over the boss: they flicker on panic days. */
export const BOSS_EYES: Grid = BOSS.map((row) => row.replace(/[^e]/g, "."));
const BOSS_EYE = "#ff2a4a";
/** Three dark, sickly variants: crimson, purple-black, red-black. */
export const BOSS_PALS: Palette[] = [
  { b: "#4a0a18", s: "#8c1830", k: "#a82a44", h: "#6a2a38", e: BOSS_EYE },
  { b: "#2c0c34", s: "#6a2070", k: "#84308a", h: "#4a2a52", e: BOSS_EYE },
  { b: "#1e0a0e", s: "#6a1222", k: "#86202f", h: "#3a2026", e: BOSS_EYE },
];
export const BOSS_EYES_HOT = sprite(BOSS_EYES, { e: "#ffd0d8" });

/** Warning sign (the pixel fonts have no U+26A0 glyph). */
export const WARN = sprite(
  [
    "....y....",
    "...yyy...",
    "...yky...",
    "..yykyy..",
    "..yykyy..",
    ".yyyyyyy.",
    ".yyykyyy.",
    "yyyyyyyyy",
  ],
  { y: C.yellow, k: "#000000" },
);

/** Hazard stripes tile (8x8) for the emergency-broadcast header; tiles seamlessly. */
export const HAZARD = sprite(
  Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => ((x + y) % 8 < 4 ? "r" : "k")).join(""),
  ),
  { r: C.red, k: "#000000" },
);

/** The Fed (hero): a generic central banker, grey hair, glasses, navy suit, green tie. Not a real person. */
export const FED = sprite(
  [
    "..hhhhhh..",
    ".hhhhhhhh.",
    ".hssssssh.",
    ".skksskks.",
    ".ssssssss.",
    ".ssmmmmss.",
    "..ssssss..",
    ".nnwggwnn.",
    "nnnwggwnnn",
    "nnnnggnnnn",
    "ss.nnnn.ss",
    "...nn.nn..",
    "...kk.kk..",
  ],
  {
    h: "#c8c8c8",
    s: "#f1c27d",
    k: "#000000",
    m: "#8a3a2a",
    n: "#2b3a55",
    w: "#ffffff",
    g: "#3fae4f",
  },
);

/** Money printer, two frames: the LED blinks and a bill rolls out. */
export const PRINTER_PAL = {
  m: "#8a8f98",
  w: "#e8eef4",
  d: "#4a4f58",
  r: C.red,
  g: C.green,
  k: "#000000",
  b: "#3fae4f",
  l: "#9be59b",
};
const PRINTER_TOP: Grid = ["..mmmmmmmm..", "..mwwwwwwm..", "mmmmmmmmmmmm"];
const PRINTER_BODY: Grid = ["mddddddddddm", "mkkkkkkkkkkm", "mmmmmmmmmmmm"];
export const PRINTER_FRAMES: Grid[] = [
  [
    ...PRINTER_TOP,
    "mddddddddrdm",
    ...PRINTER_BODY,
    ".bbbbbbbbbb.",
    "............",
    "............",
  ],
  [
    ...PRINTER_TOP,
    "mddddddddgdm",
    ...PRINTER_BODY,
    ".bbbbbbbbbb.",
    ".blbbllbblb.",
    ".bbbbbbbbbb.",
  ],
];

/** Congress (hero): a friendly Capitol dome with a face. */
export const CAPITOL = sprite(
  [
    "......y......",
    "......w......",
    ".....www.....",
    "....wwwww....",
    "...wwkwkww...",
    "...wkwwwkw...",
    "...wwkkkww...",
    "..ggggggggg..",
    "..g.g.g.g.g..",
    "wwwwwwwwwwwww",
    "w.w.w.w.w.w.w",
    "wwwwwwwwwwwww",
    "ggggggggggggg",
  ],
  { y: C.yellow, w: "#e8eef4", g: "#a8b0bc", k: "#2a2f3a" },
);

/** Stimulus check: pale green paper, gold amount box, signature. */
export const CHECK = sprite(
  [
    "oooooooooooo",
    "occcccccyyco",
    "oddddddcccco",
    "occcccccccco",
    "occccccckkco",
    "oooooooooooo",
  ],
  { o: "#3fae4f", c: "#d8f5d0", d: "#5a8a5a", y: C.money, k: "#2a2f3a" },
);

/** Government event icon: a red emergency light. */
export const SIREN = sprite(
  ["..rrr..", ".rwrrr.", ".rrrrr.", ".rrrrr.", "kkkkkkk", "kdddddk", "kkkkkkk"],
  { r: C.red, w: "#ffd0d8", k: "#8a8f98", d: "#4a4f58" },
);

/** Economy event icon: a work briefcase (jobs). */
export const BRIEFCASE = sprite(
  [
    "..kkkk..",
    "..k..k..",
    "bbbbbbbb",
    "bbbbbbbb",
    "bbbyybbb",
    "bbbbbbbb",
    "bbbbbbbb",
  ],
  { b: "#a0683a", k: "#5a3a1e", y: C.money },
);

/** HUD sound toggle. */
const SPEAKER_PAL = { w: "#c2c3c7", r: C.red };
export const SPEAKER_ON = sprite(
  [
    "...w......",
    "..ww...w..",
    "wwww.w..w.",
    "wwww.w..w.",
    "wwww.w..w.",
    "..ww...w..",
    "...w......",
  ],
  SPEAKER_PAL,
);
export const SPEAKER_OFF = sprite(
  [
    "...w......",
    "..ww.r...r",
    "wwww..r.r.",
    "wwww...r..",
    "wwww..r.r.",
    "..ww.r...r",
    "...w......",
  ],
  SPEAKER_PAL,
);

// ---------- Rendering ----------

function svgRects(grid: Grid, pal: Palette, dx: number): string {
  let out = "";
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      const fill = pal[ch];
      if (ch !== "." && fill)
        out += `<rect x="${x + dx}" y="${y}" width="${run}" height="1" fill="${fill}"/>`;
      x += run;
    }
  });
  return out;
}

const gridW = (g: Grid) => Math.max(...g.map((r) => r.length));

/** Horizontal sprite sheet: frames laid out left to right, each frame the width of the widest one. */
export function sheetUrl(frames: Grid[], pal: Palette): string {
  const w = Math.max(...frames.map(gridW));
  const h = Math.max(...frames.map((g) => g.length));
  const body = frames.map((g, i) => svgRects(g, pal, i * w)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * frames.length}" height="${h}" viewBox="0 0 ${
    w * frames.length
  } ${h}" shape-rendering="crispEdges">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const urlCache = new Map<Sprite, string>();
/** One sprite as an SVG data URL (cached). */
export function spriteUrl(s: Sprite): string {
  let u = urlCache.get(s);
  if (!u) {
    u = sheetUrl([s.grid], s.pal);
    urlCache.set(s, u);
  }
  return u;
}

export function spriteSize(s: Sprite): { w: number; h: number } {
  return { w: gridW(s.grid), h: s.grid.length };
}

/** Paint a sprite onto a canvas at integer pixel (x, y). */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
): void {
  s.grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const fill = s.pal[row[c]];
      if (row[c] === "." || !fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  });
}
