# Pixel style reference

Extracted from the mockup approved on 2026-10-19. Spec §9 is the rule set; this file is the raw material.

## Palette

- Background: `#0a0e0a`
- Panel lines: `#1f3a24`
- Primary green: `#7dff8a`
- Dim text: `#8aa88f`
- Red: `#ff3b5c`
- Heart off: `#3a1520`
- Yellow: `#ffcc33` (labels), `#ffd400` (money), dark gold `#c08a00`, pale gold `#fff8b0`
- Pink: `#ff9fd0`, pink background `#1a0a14`
- Blue: `#29adff`
- Orange: `#ffa300`
- Fog dots: `#10200f`
- Grid dots: `#14261a`

### Mood palette (VIX, spec §8c)

`data-mood` on `<html>` swaps these CSS variables. `--green` / `--red` keep meaning up/down at every level.

| Mood (VIX)       | `--ink`   | `--dim`   | `--line`  | `--bg`    | `--tint`  | Vignette (bands, max alpha) | Extras                   |
| ---------------- | --------- | --------- | --------- | --------- | --------- | --------------------------- | ------------------------ |
| calm (< 20)      | `#7dff8a` | `#8aa88f` | `#1f3a24` | `#0a0e0a` | `#0b1a0d` | none                        |                          |
| nervous (< 30)   | `#e6f07a` | `#a8a888` | `#34331f` | `#0d0d09` | `#18170b` | from 86%, 0.10              |                          |
| scared (< 50)    | `#ffb066` | `#b89a82` | `#45301c` | `#0f0b08` | `#1c120a` | from 80%, 0.15              | faint scanlines          |
| panic (>= 50)    | `#ff8a80` | `#c49494` | `#4f1d22` | `#120809` | `#1e0b0d` | from 74%, 0.20              | flickering scanlines, static |

Body text stays above 4.5:1 against the background at every level (checked by formula, including under the vignette's first band).

## Fonts

- **Press Start 2P:** labels, HUD, buttons. 11px.
- **VT323:** body text. 17–22px.

## Sprites

Character grids: `.` = transparent; other characters map to the colours listed after each grid. Render each to a tiny canvas, then scale with `image-rendering: pixelated`.

```
HEART (a=fill colour, b=right-half colour, w=shine white when full)
".aa.bb." "aawabbb" "aaaabbb" ".aaabb." "..aab.." "...a..."
  full: a=b=#ff3b5c   half: a=#ff3b5c b=#3a1520   empty: a=b=#3a1520

COIN   ".yyyy." "yywwyy" "ywyyyo" "yyyyyo" "yyyyoo" ".oooo."   y=#ffd400 o=#c08a00 w=#fff8b0
ROCKET "....w...." "...www..." "...wbw..." "...www..." "...www..." "..rwwwr.." ".rr.w.rr." "...ooo..." "....o...."
       w=#e8eef4 b=#29adff r=#ff3b5c o=#ffa300
SHIELD "bbbbbbb" "bwwbbbb" "bwbbbbb" "bbbbbbb" ".bbbbb." "..bbb.." "...b..."   b=#29adff w=#c8ecff
GOLD   "..yyyyyy" "..ywwyyo" ".yyyyyoo" "yyyyyooo" "oooooooo"   y=#ffd400 w=#fff8b0 o=#c08a00
PIG    ".p....p..." "pppppppp.." "ppkpppppnn" "pppppppppn" "pppppppp.." ".pp..pp..."   p=#ff9fd0 k=#000 n=#ff6fb0
SKULL  ".wwwww." "wwwwwww" "wkkwkkw" "wwwkwww" ".wwwww." ".w.w.w."   w=#fff k=#000
TROPHY "yyyyyyy" "yywyyyy" ".yyyyy." "..yyy.." "...y..." "..ooo.." ".ooooo."   y=#ffd400 w=#fff8b0 o=#c08a00
BEAR   ".##......##." "#bb#....#bb#" "#bbbbbbbbbb#" "#bbwbbbbwbb#" "#bbkbbbbkbb#" "#bbbbnnbbbb#" "#bbbnmmnbbb#" ".#bbbbbbbb#." "..########.."
       #=#000 b=#c0563a w=#fff k=#000 n=#ffb3a0 m=#000
BULL   "h..........h" "hh........hh" ".hh######hh." "..#bbbbbb#.." "..#wbbbbw#.." "..#kbbbbk#.." "..#bbbbbb#.." "..#bnnnnb#.." "..#nknnkn#.." "...######..."
       h=#e8e0c0 #=#000 b=#3fae4f w=#fff k=#000 n=#ffb3a0
TRADER happy "s.hhhh.s" "s.hhhh.s" "s.skks.s" "ssssssss" ".bbrrbb." ".bbrrbb." "..bbbb.." "..b..b.." "..k..k.."
TRADER sad   "..hhhh.." "..hhhh.." "..skks.d" "..ssss.d" "sbbrrbbs" "sbbrrbbs" "..bbbb.." "..b..b.." "..k..k.."
       h=#3b2416 s=#f1c27d k=#000 b=#2e5fa8 r=#ff3b5c d=#6cc6ff (sweat drop)
NEWSBOT "....y....." "....k....." "kkkkkkkkkk" "kggggggggk" "kgwwggwwgk" "kggggggggk" "kgggwwgggk" "kkkkkkkkkk" "...kbbk..." "..kbbbbk.." "..kk..kk.."
       y=#ff3b5c k=#8a8f98 g=#0a2a12 w=#7dff8a b=#c2c3c7
```

### Crisis layer (added 2026-10-19, spec §6b/§8c)

```
VIRUS BOSS (spec §6b; replaced the germ swarm on 2026-10-20) 12x12, menacing, not gory, not bug-like:
       "..s..ss..s.." ".ss.ssss.ss." "..sbbbbbbs.." "ssbhhbbbbbss" ".sbhbbbbbbs." "sbeebbbbeebs"
       "sbbbebbebbbs" ".sbbbbbbbbs." "ssbbbbbbbbss" "..sbbbbbbs.." ".ss.ssss.ss." "..s..ss..s.."
       variants (b body / s spikes / h dull highlight): crimson #4a0a18/#8c1830/#6a2a38,
       purple-black #2c0c34/#6a2070/#4a2a52, red-black #1e0a0e/#6a1222/#3a2026; e = eyes #ff2a4a
       Hot-eye overlay: the same grid, eyes only, #ffd0d8 (flickers on panic days).
       Exactly two slanted slit eyes. No crown, no mouth, no spots or dot patterns, no legs or antennae.
       Up to 4, stacked down the right edge of the chart fog; >= 48 px desktop (scale 4-6), >= 36 px phones (3-5).
       Title screen: one at 168 px (144 px on phones) looming behind the logo, lower half in hard-banded shadow.
GERM_ICON (small static icon only: CASES counter, virus BREAKING items, the COVID crisis tile)
       "s...s...s" ".s.ggg.s." "..ggggg.." ".gwkgwkg." "sgggggggs" ".gggkggg." "..ggggg.." ".s.ggg.s." "s...s...s"
       g/s = #ff6f91/#b0204a, w=#fff k=#000
WARN   "....y...." "...yyy..." "...yky..." "..yykyy.." "..yykyy.." ".yyyyyyy." ".yyykyyy." "yyyyyyyyy"   y=#ffcc33 k=#000
HAZARD 8x8 tile, (x + y) % 8 < 4 ? red : black   r=#ff3b5c k=#000 (shown at 2x, scrolls in steps)
FED    "..hhhhhh.." ".hhhhhhhh." ".hssssssh." ".skksskks." ".ssssssss." ".ssmmmmss." "..ssssss.." ".nnwggwnn."
       "nnnwggwnnn" "nnnnggnnnn" "ss.nnnn.ss" "...nn.nn.." "...kk.kk.."
       h=#c8c8c8 s=#f1c27d k=#000 m=#8a3a2a n=#2b3a55 w=#fff g=#3fae4f   (a generic central banker, not a real person)
PRINTER f1 "..mmmmmmmm.." "..mwwwwwwm.." "mmmmmmmmmmmm" "mddddddddrdm" "mddddddddddm" "mkkkkkkkkkkm" "mmmmmmmmmmmm" ".bbbbbbbbbb." "............" "............"
        f2 same top, LED g instead of r, bill rows ".bbbbbbbbbb." ".blbbllbblb." ".bbbbbbbbbb."
        m=#8a8f98 w=#e8eef4 d=#4a4f58 r=#ff3b5c g=#7dff8a k=#000 b=#3fae4f l=#9be59b
CAPITOL "......y......" "......w......" ".....www....." "....wwwww...." "...wwkwkww..." "...wkwwwkw..." "...wwkkkww..."
        "..ggggggggg.." "..g.g.g.g.g.." "wwwwwwwwwwwww" "w.w.w.w.w.w.w" "wwwwwwwwwwwww" "ggggggggggggg"
        y=#ffcc33 w=#e8eef4 g=#a8b0bc k=#2a2f3a   (friendly dome with a smile)
CHECK  "oooooooooooo" "occcccccyyco" "oddddddcccco" "occcccccccco" "occccccckkco" "oooooooooooo"
       o=#3fae4f c=#d8f5d0 d=#5a8a5a y=#ffd400 k=#2a2f3a
SIREN  "..rrr.." ".rwrrr." ".rrrrr." ".rrrrr." "kkkkkkk" "kdddddk" "kkkkkkk"   r=#ff3b5c w=#ffd0d8 k=#8a8f98 d=#4a4f58
BRIEFCASE "..kkkk.." "..k..k.." "bbbbbbbb" "bbbbbbbb" "bbbyybbb" "bbbbbbbb" "bbbbbbbb"   b=#a0683a k=#5a3a1e y=#ffd400
SPEAKER on  "...w......" "..ww...w.." "wwww.w..w." "wwww.w..w." "wwww.w..w." "..ww...w.." "...w......"
        off "...w......" "..ww.r...r" "wwww..r.r." "wwww...r.." "wwww..r.r." "..ww.r...r" "...w......"   w=#c2c3c7 r=#ff3b5c
```

BREAKING card event icons: virus = germ, market = bear, economy = briefcase, government = siren. Heroes get their character + prop (Fed + money printer, Capitol + stimulus check) over stepped rays of pale-gold light.

The fee goblin is new: design it in the same style. A ~10×10 green goblin, big ears, toothy grin. Show it munching on a coin.

## Motion

Every animation is stepped (`steps(n)`).

| Name                        | What it does                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| bob                         | translateY(-3px), steps(2), 0.6 s                                    |
| spin (coin)                 | scaleX 1 → 0.2, steps(4), 1 s                                        |
| stomp (bear)                | translate(2px, 2px) rotate(-4deg), steps(2), 0.4 s                   |
| shake (screen, on −4% days) | about 5 px jitter, steps(5), 0.4 s                                   |
| flash (red overlay)         | opacity 0.5 → 0, 0.5 s                                               |
| damage numbers              | "+$123" / "−$456" float up 34 px and fade, steps(8), 1.1 s           |
| achievement toast           | slides in from the right, holds about 2 s, slides out, steps(14)     |
| blink cursor                | `_` after the news bot's typewriter text (about 28 ms per character) |
| boss breathing              | scale 1 → 1.06 on the heartbeat's lub-dub, steps(1), 1.7 s (title pulse uses the same rhythm) |
| boss hot eyes (panic)       | eye overlay opacity jumps 0.2–1, steps(1), 1.3 s                     |
| boss recoil (hero card)     | scale 0.86 + 4 px back + brightness 0.4, easing back over 1.4 s, steps(1) |
| title heartbeat             | hard-banded red rings, opacity/scale lub-dub, steps(1), 1.7 s       |
| PRESS START blink           | blink, steps(2), 1.1 s                                               |
| hazard stripes              | background slides 16 px, steps(4), 1.2 s                             |
| warning flash               | blink, steps(2), 0.8 s                                               |
| relief light                | pale-gold screen flash 0.4 → 0, steps(6), 1.2 s; rays scale+turn, steps(7) |
| glitch (story key words)    | 3.6 s loop, steps(1): a brief 2 px shift with blue/red offset copies |
| scanline flicker (panic)    | opacity jumps, steps(1), 2.6 s; static noise shifts, steps(1), 0.4 s |

## Layout (desktop; stacks to one column on phones)

- **HUD row:**
  - DAY nn/99
  - date
  - 5 hearts
  - spinning coin + total value
  - fee goblin + fees paid
  - LV + XP segments
- **Grid** (left about 36%, right about 64%):
  - **WATCHLIST:** one row per asset with icon, ticker, last price, and ▲/▼ % (bobbing arrow); VIX row with skull. Below it, YOUR BAG shows icon + % per asset + pending-order ticket.
  - **SPY · DAILY:** pixel candles on a low-res canvas, about 160×78 scaled up.
    - Dotted grid.
    - Fog (dither) to the right of today.
    - The y-axis uses only days seen so far.
    - The trader sprite stands on today's high.
  - **MOOD:** bull (bobbing, up day) or bear (stomping, down day). Mood label from VIX: under 20 CALM, under 30 NERVOUS, under 50 SCARED, else PANIC!!. Skull + 10-segment fear bar = VIX / 8.
  - **NEWS BOT:** robot sprite + speech bubble with typewriter text. On a BREAKING day, a small yellow REREAD tab sits on the bubble's bottom-right corner.
- **Panel titles** sit on the top border: yellow Press Start 2P on the background colour.
- **Button row:**
  - BUY / SELL / CASH / SHIELD with icons
  - presets
  - NEXT DAY ▶ (big, yellow, primary; tiny "SPACE" keycap hint) and FAST-FORWARD ▶▶ (blue, secondary; "F" hint), which turns into a red STOP ■ while running. Key hints hide on touch screens.

## Notched corners (no rounded corners anywhere)

Layer two blocks, both with a notched clip-path:

- the outer block in the border colour, with padding = border width;
- the inner block in the fill colour.

Buttons get a thicker bottom edge (outer padding-bottom 6 px). On press it drops to 3 px and the button moves down 3 px.

**Don't** combine CSS `border` with `clip-path`. The notch cuts the border and leaves a broken frame. That was the bug in the mockup.

```css
clip-path: polygon(
  3px 0,
  calc(100% - 3px) 0,
  calc(100% - 3px) 3px,
  100% 3px,
  100% calc(100% - 3px),
  calc(100% - 3px) calc(100% - 3px),
  calc(100% - 3px) 100%,
  3px 100%,
  3px calc(100% - 3px),
  0 calc(100% - 3px),
  0 3px,
  3px 3px
);
```

## Virus boss shape rule (2026-10-20)
The boss is a 16×16 radially symmetric "sea mine": a round body with 8 short, thick club spikes (stalk + knob) evenly spaced around it, plus two slanted red slit eyes. Thin or paired spikes on the sides read as legs, which is a spider/crab look and. The germ icon follows the same rule.
