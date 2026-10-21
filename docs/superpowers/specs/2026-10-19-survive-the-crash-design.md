# Survive the Crash: design spec

This is the single source of truth for what the game should be. What the code actually does is tracked in [`docs/BUILD_STATUS.md`](../../BUILD_STATUS.md).

## 1. Intent

A web game where players live through real market crises one day at a time, using real data.

- **Core principle:** simple and fun on the surface, exact underneath. Players see plain language, cute pixel characters and simple choices. The engine uses real prices and real finance math.
- **Every number must be reproducible** from the data files. One number per feature gets sanity-checked by hand or against a real source.
- **Second purpose:** Ryan (Stats/Quant Finance co-op student) learns the finance under each feature as it's built, and the project goes in his portfolio.

**Goals**

- Ship a playable v1 with ONE crisis fast, then add more.
- Leave players knowing what drawdown, volatility, Sharpe, hedging and costs feel like.

**Non-goals (v1)**

- Logins, accounts, backend, real money.
- More than one crisis.
- Intraday data.

**Anti-goals** (failure even if it technically works)

- Look-ahead: showing the player anything after the current day, including through chart scaling.
- Invented headlines or invented numbers.
- A boring finance dashboard. It must feel like a game.
- A pure metaphor game that teaches nothing about real markets.

## 2. Crisis and data

- **v1 crisis: COVID crash 2020.** Window is 10 Feb to 30 Jun 2020, which is **99 trading days** (verified against SPY).
  - The peak was 19 Feb; the bottom was 23 Mar (SPY −34%); then a fast rebound.
  - **Why:** it's short and brutal, and it punishes panic-selling. The data is clean.
- **Tradable assets:**
  - Stocks = SPY
  - Bonds = TLT
  - Gold = GLD
  - Cash
- **Shown, not tradable:** VIX as the FEAR meter. The 3-month T-bill (`^IRX`) is the risk-free rate.
- **Source:** yfinance daily OHLC plus adjusted close and dividends, pre-computed by a Python script into static JSON. No backend.
- **Reproducible builds:** raw Yahoo downloads are cached in the repo, because Yahoo's adjusted close changes slightly between downloads. Rebuilding from the cache gives a byte-identical file.
- **Calendar:** SPY's trading days. If VIX or `^IRX` is missing on one of those days, carry the previous value forward (Claude's call).
- **Known data gap (verified 2026-10-19):** yfinance has no data for delisted tickers (SIVB, LEH). Future SVB or 2008 scenarios must use stand-ins like KRE or XLF. This is survivorship bias, and it's worth a teaching moment.
- **Later crises:**
  - 2008 (SPY/TLT/GLD all available)
  - GameStop 2021
  - SVB 2023 (via KRE)

## 3. Player actions

- **Your bag** is your portfolio, shown to the player as % weights across Stocks/Bonds/Gold/Cash.
  - The player starts Day 1 in 100% cash and picks a starting bag.
  - **Why:** weights are how real portfolios are described, and that's simpler than share counts.
- **Engine model (Claude's call):**
  - Underneath, the bag is held as share counts.
  - Weights drift as prices move; there's no automatic rebalancing.
  - BUY/SELL = trade 10% of current total value.
  - Presets queue the trades needed to hit that mix.
  - Queued orders show as a pending ticket until they fill.
- **Buttons** (pixel icons):
  - 🚀 **BUY** and **SELL**: move 10% of the bag between the selected asset and cash.
  - 🐷 **CASH**: sell everything to cash in one tap, the "panic button".
  - 🛡 **SHIELD**: insurance (§5).
  - **Presets (Claude's call):**
    - ALL IN (100% stocks)
    - 50-50 (stocks/bonds)
    - BALANCED (60% stocks / 20% bonds / 10% gold / 10% cash)
    - ALL CASH
  - Picking a preset or CASH replaces any orders already queued, so you don't pay fees on trades that would cancel out.
- **Fills:** orders placed today fill at the **next day's open**.
  - **Why:** you can't trade at a close you've already seen. Overnight gaps hurt, just like in reality.
- **Blocked orders warn (Claude's call, 2026-10-20):** BUY with no cash (and no queued sell to raise it), or SELL of something you don't own, shows a red "NO CASH! SELL SOMETHING FIRST" / "YOU DON'T OWN ANY X" toast and queues nothing. **Why:** without it the order was queued and then silently skipped at the next open.
- **Valuation:** portfolio value and hearts are marked at each day's close.
- **Last day:** no new orders on the final day, because there's no next open. The game ends at that close.
- **Trading cost:** 0.1% of each trade's dollar value.
- **Fee goblin (Ryan's call, 2026-10-19):** each trade, a tiny pixel goblin pops out and eats a coin. The HUD keeps a running "fees paid" counter, and the end screen shows the total.
  - **Why:** overtrading should *feel* bad. A full switch every day for 99 days costs about 18% in fees alone, more than the crash cost a stock holder who sat still (−6.9%).
- **Paper vs locked P&L (Ryan's call, 2026-10-19):**
  - Each held asset in the bag shows a faded "paper" P&L (`-$412 paper`).
  - Every sell gets stamped 💀 `LOCKED -$412` or 🏆 `LOCKED +$412`.
  - The end screen shows total locked-in P&L.
  - **Why:** a loss isn't real until you sell. In the data, panic-selling at the 23 Mar bottom locked in about −30%, while holding to 30 Jun ended at −7.5%.
  - **Method (Claude's call):** average-cost basis with buy fees included. Realized = net proceeds − average cost of the shares sold.
- **Order sizing (Claude's call):**
  - Fractional shares are allowed.
  - BUY/SELL = 10% of total value at the last close, as a dollar amount.
    - At the fill, a buy pays amount × 1.001 from cash. If there's not enough cash, it's scaled down.
    - A sell gets proceeds × 0.999, capped at the shares held.
  - Presets and CASH re-target the whole bag at the next open: sells first, then buys.
- **Starting money:** $10,000.
- **Cash** earns the daily T-bill rate, but never less than 0. The real 3-month T-bill yield dipped slightly negative in March 2020. Cash in an account doesn't charge you interest, so it's floored at 0 (Claude's call).
- **Dividends (Ryan's call, 2026-10-19):** the screen shows real historic prices, so they match the history books. Dividends drop into the bag as cash coins ("TLT paid you $3.20!").
  - **Why:** the number on screen matches the news, and you can see the payout. The math still equals the adjusted (total) return.
  - **Timing (Claude's call):** paid on the ex-date, for shares held at the previous close. In reality the cash lands a few days later; that's ignored for simplicity.

## 4. Turns and pacing

- **Turn-based (Ryan's call, 2026-10-20).** Every trading day stops and waits for the player. A big **NEXT DAY ▶** button (Space / Enter) moves one day. You can trade on any day before pressing it.
  - **Why:** in real life you can act every day. With auto-play as the default, plus news cards whose main button resumed play, Ryan played a full run and "was basically just watching": he never got a chance to react.
- **FAST-FORWARD ▶▶** is optional. It plays quiet days automatically (about 0.4 s each) and **stops by itself** on the next big day: a headline day, a SPY move over 3%, a circuit-breaker day, or a dividend/tutorial moment. Then it waits. Any click or key stops it too.
- A full run takes about 5–8 minutes. Quiet stretches are fast-forwarded and big days are played by hand.

## 5. Insurance (SHIELD)

- **In scope.** Underneath it's a put option on SPY covering the player's stock holding, priced with Black-Scholes.
  - Volatility input = that day's VIX / 100.
  - Rate = `^IRX`.
- **Why:** it costs money every time you buy it, and it's expensive exactly when everyone is scared, like real insurance.
- **Timing:** ships in v1, built after the core loop is playable (Claude's call: scope, not finance).
- **Player design (Ryan's call, 2026-10-20): one button, 1-month coverage.**
  - Tapping SHIELD covers the stocks you hold against drops below −5% for 21 trading days.
  - The price shows *before* you buy, with a fear label ("SHIELD $20 · fear is low" / "$697 · fear is EXTREME").
  - When it pays out, a shield blocks the hit with "🛡 +$X".
  - **Why:** in the real data, a put bought on 19 Feb (VIX 14) cost $20 per $10k and paid $2,391 by 19 Mar. The same cover on 16 Mar (VIX 83) cost $697. The lesson is to buy insurance when it's cheap.
- **Exact mechanics (Claude's call):**
  - **The contract:** a European put on SPY, 1 contract per SPY share held when it fills, strike K = 0.95 × SPY open at the fill, expiry 21 trading days later.
  - **Pricing:** Black-Scholes, σ = VIX/100 and r = max(IRX, 0)/100.
    - The order is placed at close t and fills at the next open. The premium uses S = that open, the VIX and IRX from close t (the latest known), and T = 21/252.
    - The premium is paid from cash with no extra fee.
    - **If cash is short (Claude's call, 2026-10-20: ALL IN bags have no cash, and they're the ones that most need insurance):** at that same open the game first sells just enough SPY (a normal sell with the 0.1% fee) to pay the premium on the shares left, then covers those shares. Cash ends at 0, never below. The only time a SHIELD buys nothing is when no SPY is held after the other fills.
  - **Daily value:** each close, the put is marked to market with Black-Scholes, using the trading days left / 252, that day's VIX and SPY close. It counts in portfolio value, so it affects hearts, drawdown and Sharpe.
  - **At expiry close:** it pays max(K − SPY close, 0) × contracts into cash and disappears.
  - **One shield at a time:** while one is active, the button shows "ACTIVE · n days left". There's no early cash-out in v1.
  - **The ghost** never buys shields.
- **Known limitation:** using VIX ignores volatility skew, so out-of-the-money puts come out slightly underpriced vs reality. State this in the README.

## 6. Headlines

- **Real headlines only**, short. Each one's data entry carries:
  - date
  - source
  - URL
- Claude researches them. Ryan approves each one before it ships. **Never invent a headline.**
- They show up as the NEWS BOT's speech and can trigger auto-pause.
- **The build is not blocked on headlines** (Claude's call). The game first ships with data-generated bot lines. Approved headlines get added as their own step.
- **No headline that day:** the bot says a line generated from the data, e.g. "SPY −10.9% today. Ouch." or "Fear index at 83." It only says "Quiet day" when SPY moved less than 1.5%.
- **Circuit-breaker days** (market-wide 15-minute halts after a 7% drop) are real and get their own event: 9, 12, 16 and 18 Mar 2020.

## 6b. Villains and heroes (Ryan's call, 2026-10-19)

- **No swarm (Ryan, 2026-10-20):** swarms of tiny scattered creatures felt creepy and distracting in playtesting, so nothing small and numerous may crawl on screen anywhere in the game. Instead (Ryan's call, 2026-10-20):
  - **A few big virus bosses (Ryan's call, 2026-10-20):** menacing, not gory, not bug-like. A dark, sickly round body (deep crimson / purple-black, dull highlight) with thick jagged spike proteins around the rim and exactly two narrow glowing red slit eyes. No crown, no smile, no clusters of eyes or dot patterns, no legs or antennae (they read as bugs, not a virus).
  - **One boss per 10× of real cumulative cases** (Claude's call: exact and easy to explain). Count = floor(log10(cases)) − 3:
    - 1 boss at 42,771 (10 Feb)
    - 2 bosses from 100k (early March)
    - 3 bosses from 1M (2 Apr)
    - 4 bosses from 10M (end of June)
  - Within each 10×, the newest boss grows with the fractional part of log10(cases).
  - **Size and placement:** each boss is at least about 48 px on desktop (36 px on phones). They sit in fixed spots (not crawling), never over numbers or buttons.
    - **Where (Claude's call, 2026-10-20):** stacked down the right edge of the chart's fog (the unknown future), oldest on top.
  - **Motion:** a slow stepped "breathing" pulse (scale 1 → 1.06) on the heartbeat's rhythm; on panic days the eyes flicker white-hot; when a hero card fires, they recoil and go dim for a beat (Claude's call: it plays as the card closes, so the player sees it).
  - **Hard cap: 4.** Never hundreds. The original idea, kept for history in git:
- ~~Virus swarm = real data.~~ Cute cartoon pixel germs float over the screen. Their count each day follows the **real cumulative global confirmed COVID cases** (log scale), from a sourced daily series cached in the repo.
  - **Where they go (Claude's call, 2026-10-19):** in the side margins (crowding the corners first) and in the chart's fog, never over numbers or buttons, and they never block clicks. One germ at 40,000 cases, 60 (the cap) at 10 million.
  - **Case counter (Claude's call, 2026-10-19):** "CASES 381,711" with a germ icon sits in the MOOD panel under the fear meter. **Why:** in the HUD it pushed the bar onto two lines at 1280×720.
- **BREAKING card = pop-up with DISMISS (Ryan's call, 2026-10-20).** Real dated events (virus, government, Fed, market, economy) pop up on the trading day players could first have known them, with NEWS BOT reading them out and the source shown. The only button is **DISMISS**. It closes the card and leaves the player **on that day**, free to trade; it never advances or resumes anything. The headline stays in the NEWS BOT panel, with REREAD to open the card again. Each event is researched with a source, and **Ryan approves every one before it ships.**
- **Approved event list:** the 25 events in `docs/research/covid-2020-events.md` (approved 2026-10-19).
- **One merged BREAKING item per day (Claude's call):** if an event, a big move or a circuit breaker land on the same day, they're combined into one card.
  - **What the card shows (Claude's call, 2026-10-19):** the day's events first (headline, what it means, source link), then the day's market line, which is always shown, even on a quiet event day.
  - ~~Continue vs trade: a CONTINUE button that resumed auto-play.~~ Removed 2026-10-20, because it left no time to react.
  - Tutorial tips never block trading. They point at things, and the player can act straight away.
- **Heroes on rescue days:** the Fed (money printer) and Congress (stimulus checks) appear on the real dates they acted.
- **Why:** the bosses make the threat feel real while staying exact underneath. The heroes secretly teach *why* the market bounced back.
- **Taste rule:** real people died. Viruses look menacing but never gory, deaths are never a score, and there are no jokes about victims.

## 7. Scoring and end screen

- **During play, hearts = drawdown.** 5 hearts; each heart = 5% drop from your peak value. Half hearts at 2.5%.
- **What happens at 0 hearts (Claude's call, 2026-10-20, to ship):** no death. Hearts are a gauge; a deep drawdown already hurts the skill score. The end screen shows a "BROKE THE 25% LIMIT" badge if hearts ever hit 0.
- **End-screen stats (plain name → real metric):**
  - Money made → total return
  - Worst fall → max drawdown
  - Bumpiness → annualized volatility (daily, ×√252)
  - **Skill score → Sharpe ratio.** This is the headline grade.
    - Formula: mean(daily excess return) / std(daily excess return) × √252.
    - Daily risk-free rate = (`^IRX` / 100) / 252.
    - Portfolio returns include trading costs and the SHIELD premium and value.
    - These conventions are Claude's call, fixed so every number reproduces.
- **Headline grade = Skill score vs the ghost (Ryan's call, 2026-10-20).** The rank depends on beating the ghost *per unit of risk*. Money made and worst fall are shown underneath.
  - **Why:** in the real data, the 50-50 bag beat ALL IN on return (+3.4% vs −6.9%), on worst fall (−16% vs −34%) and on Sharpe (+0.53 vs −0.13). Judging by return alone rewards reckless luck.
  - **All-cash bag:** Sharpe is undefined (zero volatility). The screen shows "N/A" and ranks on the other stats (Claude's call).
- **Ghost "did nothing":** takes the player's Day-1 bag, with the same Day-2-open fill and the same cost, then holds it untouched. Every stat is shown next to the ghost's.
  - **Why:** it isolates the value of the player's decisions.
- **Ranks (Claude's call, 2026-10-20):** by skill gap d = your Sharpe − ghost Sharpe.
  - **Panic Seller:** d < −0.5
  - **Survivor:** −0.5 ≤ d < 0
  - **Steady Hand:** 0 ≤ d < 0.5
  - **Legend:** d ≥ 0.5
  - If either Sharpe is N/A (zero volatility, e.g. all cash), rank on return vs the ghost instead: below = Survivor, at or above = Steady Hand.
- **Sharpe inputs:** daily close-to-close returns of total value. The risk-free rate is the daily T-bill rate floored at 0, the same as cash earns.
- **Honesty note:** Sharpe over about 99 days is noisy. The end screen says so in one line.
- **Regret reveal:** e.g. "You sold 16 Mar. SPY rose X% after."
- **Then:** a reveal of the real finance terms, and a shareable rank card.

## 8. Fun layer

- XP and levels: +10 per day survived, plus a bonus for achievements.
- Achievement toasts, e.g. "Survived a circuit breaker".
- A trader character rides the latest candle: happy on green days, sweating on red days.
- Damage numbers pop off on each day's P&L.
- A bull or bear mascot reacts to the day's move.
- Mood label and skull fear meter driven by the VIX.
- Screen shake and a red flash on days down 4% or more.
- **Fog over future days** on the chart. The chart's y-axis rescales using only data seen so far.
- MISSION COMPLETE at the end.

## 8b. Tutorial (Ryan's call, 2026-10-19)

- **NEWS BOT coaches the player live.** The first time each thing happens, the robot pops up, spotlights it, and explains it in one or two plain lines. Tips never block trading (see §6b); FAST-FORWARD stops when a new tip appears.
- **Why:** it's the same rule as Ryan's own learning: teach at the moment it's needed, not up front. Players skip slides, but they read a tip about the thing that just happened.
- **Story intro first (Ryan's call, 2026-10-19):** before the first tip, NEWS BOT tells the backstory in 6 pixel cards, each fact with its source:
  - the virus detected in Wuhan (Dec 2019)
  - Wuhan sealed off (23 Jan)
  - WHO declares a global emergency (30 Jan)
  - deaths pass SARS (9 Feb)
  - the S&P 500 closes at an all-time high (10 Feb)
  - "Most investors aren't worried. Should you be?"

  It stops on 10 Feb 2020, with no spoilers of what comes next. The cards live in `src/game/story.ts`.
- **Just-in-time explanations (Ryan's call, 2026-10-20):** each part of the screen is explained the moment the player first has to use it, never as a tour up front. Each tip spotlights **only** the thing it talks about. Every panel also has an **ⓘ** button that reopens its explanation anytime. Order and triggers:
  1. **Day 0, welcome:** spotlights the money.
  2. **Day 0, WATCHLIST:** what you can invest in (copy below).
  3. **Day 0, YOUR BAG:** your money, all cash right now (copy below).
  4. **Day 0, PICK YOUR BAG:** the MIX copy below, spotlighting **only the MIX buttons**. It stays until the player picks one (gated).
  5. **Right after picking, NEXT DAY:** spotlights **only NEXT DAY ▶**. "Your order is queued. It fills tomorrow morning at the opening price. Press NEXT DAY ▶ to go to tomorrow." It stays until they press it (gated).
  6. **Day 1, top bar + goblin:** your money, hearts, ghost, and fees (copy below; the goblin line is added because the first fill just happened).
  7. **Day 2–3, CHART + fog:** chart copy below.
  8. **First quiet day after day 3, FAST-FORWARD:** "Quiet day. FAST-FORWARD zips through quiet days and stops by itself when something big happens."
  9. **First big day, TRADE:** the trade copy below, spotlighting only the TRADE buttons. "Big day! Read the news, then decide."
  10. The later tips (fear, dividend, LOCKED, hearts) stay event-driven as before.

  **Copy (Claude wrote it; the finance must stay accurate):**
  - **WATCHLIST:** "These are the things you can invest in, plus a fear gauge."
    - **SPY = stocks.** One share holds a tiny slice of the 500 biggest US companies. Big gains, big crashes.
    - **TLT = bonds.** Loans to the US government. They often rise when people panic.
    - **GLD = gold.** The old-school 'safe place'.
    - **VIX = fear.** How scared the market is. You can't buy it, just watch it.
    - The % is today's change. Tap a row to choose what BUY and SELL trade.
  - **YOUR BAG:** "This is your money, split up. Right now it's all cash."
    - Each bar shows how much of your money sits in that thing.
    - **CASH** is safe, but earns almost nothing.
    - **'paper'** is how much you're up or down on it right now. It's only real once you sell.
  - **MIX:** "Pick how to split your $10,000. One tap sets your whole bag."
    - **ALL IN** = everything in stocks (riskiest).
    - **50-50** = half stocks, half bonds.
    - **BALANCED** = 60% stocks, 20% bonds, 10% gold, 10% cash.
    - **ALL CASH** = keep it all as cash.
  - **TRADE:** "Small moves on the one you picked in the watchlist."
    - **BUY** = put 10% of your money into it. You need cash for this.
    - **SELL** = take 10% of your money out of it, back to cash.
    - **CASH** = panic button: sell everything.
    - Orders happen tomorrow morning at the opening price, and every trade costs 0.1%.
  - **CHART:** "SPY's price, one bar ('candle') per day."
    - Green = it went up that day. Red = it went down.
    - The fog is the future. No peeking.
  - **TOP BAR:**
    - **$** = all your money added up.
    - **Hearts** show how far you've fallen from your best day (each heart = 5%).
    - **GHOST** = what you'd have if you never traded after day 1. Beat it.
    - **The goblin** eats 0.1% of every trade (fees).
- **Tips, in the order they usually show up:** welcome, WATCHLIST, YOUR BAG, PICK YOUR BAG (waits until you pick), NEXT DAY (waits until you press it), TOP BAR (day 1), CHART (day 2-3), FAST-FORWARD (first quiet day after day 3), TRADE (first big day), then hearts, FEAR meter, dividend and LOCKED vs paper when they happen. Exact triggers and copy are in the "Just-in-time explanations" bullet above.
- **Controls:** you can skip the whole tutorial. A "?" button replays it. Tips you've seen are remembered on this device.
- **Story intro first (designer's call, 2026-10-19):** before the welcome tip, NEWS BOT tells what happened up to 10 Feb 2020 on six full-screen cards (Wuhan, the lockdown, the WHO emergency, deaths passing SARS, the S&P 500 record close, then "Your story starts now"). Each fact card shows its source. Nothing after 10 Feb 2020 appears, so nothing is spoiled. It can be skipped and is replayed by "?" (story, then tips).

## 8c. Atmosphere: ominous and intense (Ryan's call, 2026-10-19)

It was a real global emergency, and the game should feel like one.

- **The arc:** it starts calm and almost cheerful (all-time high, green screen). Dread creeps in. March feels like an emergency broadcast. Relief comes in waves when the heroes act.
- **Intensity is driven by real data** (exact underneath): VIX sets the mood level, and case counts set how many virus bosses there are.
- **What escalates with VIX** (calm → nervous → scared → panic):
  - The screen palette shifts from phosphor green to amber to red.
  - A dark vignette closes in from the edges.
  - Scanlines flicker and there's static on panic days.
- **BREAKING cards:**
  - Virus, market and economy events look like an *emergency broadcast*: hazard stripes, a flashing ⚠, slow typewriter.
  - Fed and Congress hero events break the tension with a short burst of relief light.
  - **Claude's call (2026-10-19):** government news without a hero tag (travel ban, national emergency, stay-at-home) also gets the emergency-broadcast look. A card whose only other item is a big *up* move keeps the calm gold "relief" header.
- **Sound** (generated in the browser, no audio files):
  - a low drone that rises with VIX
  - a heartbeat when you lose a heart
  - a siren on circuit-breaker days
  - blips for typing and trades
  - a soft relief chord when a hero (Fed or Congress) acts

  It starts only after the player taps START (browsers block autoplay). A mute button sits in the HUD, and mute is remembered on the device.
- **Taste rule:** intense, never gory or mocking. Deaths are never shown as a score.
- **Reduced motion:** with the reduced-motion setting on, there's no flicker, shake or static. Colour shifts stay.

## 9. Visual style

The reference is the approved mockup from the 2026-10-19 design session: green phosphor pixel CRT.

- **Palette:** background `#0a0e0a`, primary green `#7dff8a`, panel lines `#1f3a24`, red `#ff3b5c`, yellow `#ffcc33` / `#ffd400`, pink `#ff9fd0`, blue `#29adff`.
- **Fonts:** Press Start 2P for labels and HUD, VT323 for body text.
- **Sprites are drawn in code** as tiny pixel grids:
  - hearts
  - coin
  - rocket, shield, gold bar, piggy, skull
  - bull, bear
  - trader (2 poses)
  - news bot
  - trophy
- **Chart:** drawn on a low-resolution canvas scaled up with `image-rendering: pixelated`.
- **Animation:** stepped (`steps()`), never smooth tweens.
- **No rounded corners anywhere.** Buttons, bubbles and toasts use **notched pixel corners**.
  - Build them by layering two notched blocks (the outer one coloured, the inner one dark).
  - Don't use CSS border + clip-path: the mockup did, and the notch cut the border into a broken frame.
- Buttons have a thick bottom edge and press down when clicked.
- **One screen on desktop (Ryan's call, 2026-10-19):** at 1280×720 and larger, the whole game fits in the window with no page scroll and no empty corners.
  - Layout: the HUD on top; left column = watchlist then bag; right column = chart (it grows to fill space) then mood + news; a full-width action bar along the bottom.
  - **Why:** in a game you shouldn't have to scroll to find the buttons.
- **Desktop fits one screen (designer's call, 2026-10-19):** from 1280×720 up, the whole game fits the window with no page scroll and no empty corner: HUD on top, watchlist + bag on the left, the chart (which grows to fill the space) + mood/news on the right, and a full-width action bar along the bottom.
- **Mobile-friendly:** the layout stacks at phone width with the chart and action buttons first. No sideways scroll, and tap targets are at least 40 px.
- **Optional later:** hand-drawn hero art (title screen, crisis backdrops) by Ryan in Aseprite.

## 9b. Title screen (Ryan's call, 2026-10-20)

- **Look:** a big pixel **SURVIVE THE CRASH** logo over a slow red heartbeat glow, with one virus boss looming behind it, half in shadow, its red eyes just above the logo (no germs: see §6b). **PRESS START** blinks underneath.
- **Menu:**
  - **NEW GAME** opens the crisis select:
    - 🦠 COVID 2020 is playable.
    - 🔒 2008 Financial Crisis, 🔒 GameStop 2021 and 🔒 SVB 2023 show as locked COMING SOON tiles.
  - **CONTINUE**, shown only if a game is in progress (saved on this device).
    - **How it's saved (Claude's call, 2026-10-20):** only the inputs: the orders queued each day and the day reached. Loading replays them through the engine, so the resumed game is exactly the same; a save that doesn't replay to the same value is dropped. NEW GAME and HOW TO PLAY ask "Overwrite your saved game?" first; finishing a game clears the save. An in-game MENU button goes back to the title and keeps the save.
  - **Story on NEW GAME (Claude's call, 2026-10-20):** the story intro plays only if it hasn't been seen on this device; HOW TO PLAY always replays it.
  - **HOW TO PLAY**: starts a new game with the story and every tip again.
  - **SOUND**: on/off.
  - **SOURCES**: every data and news source in one place.
- **Why:** a real game needs a front door, and the locked tiles tease the roadmap. The first tap on START also unlocks browser audio, so the drone starts as you enter.

## 10. Stack and delivery

- Next.js 16 + React, static export (`output: "export"`), deployed on Vercel. Next 16.4's `cacheComponents` / partial prerendering can't be used with static export, so they're off.
- The data pipeline is a Python script (yfinance) whose JSON output is committed to the repo.
- No logins in v1. Leaderboard (Supabase) is optional later.

## 11. Teaching flow (how features get built)

Each finance feature follows these steps:

1. Claude teaches the concept in 2–4 lines with an analogy.
2. Ryan designs the player-facing version.
3. Claude builds it.
4. Claude asks one interview-style check question, and doesn't move on until Ryan's answer is solid.

Everything is logged in a private learning log (kept out of the public repo).

| Feature       | Concepts                                 |
| ------------- | ---------------------------------------- |
| Data pipeline | adjusted prices, returns                 |
| Engine        | P&L, position sizing, trading costs      |
| Shield        | hedging, puts, why insurance has a price |
| Headlines     | news and overreaction                    |
| Scoring       | risk-adjusted returns                    |

## 12. Left to the builder

- File and folder structure
- Component breakdown
- State management
- Exact animation timings
- Sprite pixel art details beyond the mockup
- Exact auto-pause thresholds within the spirit of §4

## 13. v1 done criteria (Ryan's call, 2026-10-20)

v1 is ready to publish, and to put on the portfolio and resume, when all of these are true:

1. Title screen + crisis select (§9b).
2. Scoring and end screen (§7):
   - Sharpe skill score vs the ghost
   - ranks
   - regret reveal
   - 0-hearts rule decided after its lesson
3. SHIELD insurance (§5): back in v1 (Ryan's call, 2026-10-20: hedging and options pricing are a core concept to learn).
4. A polish pass:
   - Ryan plays a full round with sound on
   - a bug sweep
   - phone check
5. Live on a public Vercel link, with the README (how every number maps to real finance, sources, limitations) and the career handoff summary.

**Why this is the line:** a recruiter clicks the link, plays for 5 minutes, and sees real data, real finance (Sharpe, drawdown, option pricing) and polish.

**Not in v1:**
- more crises
- leaderboard
- hand-drawn art
- share card (nice to have)

