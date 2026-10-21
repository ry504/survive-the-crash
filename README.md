# Survive the Crash

**Relive the 2020 COVID market crash one real trading day at a time.** It's a pixel-art web game that is simple and fun on the surface and exact underneath. Every price, headline and case count is real, and every score is a real finance metric.

**Play:** https://ry504.github.io/survive-the-crash/

You start on 10 Feb 2020 with $10,000, the day the S&P 500 closed at an all-time high. Over the next 99 trading days stocks fall 34%, trading halts four times, the Fed and Congress step in, and the market rebounds. You split your money across stocks, bonds, gold and cash, react to each day's news, and try to beat a "ghost" that never touches anything.

## How the game maps to real finance

| On screen                        | What it really is                                                                |
| -------------------------------- | -------------------------------------------------------------------------------- |
| 🚀 SPY / 🛡 TLT / 🪙 GLD          | S&P 500 ETF, 20+ year Treasury bond ETF, gold ETF: real daily prices             |
| 💀 FEAR meter                    | The VIX, the market's implied volatility index                                   |
| Your bag                         | Portfolio weights (shares held underneath, drifting with prices)                 |
| 👺 Fee goblin                    | 0.1% transaction cost on every trade                                             |
| Orders fill "tomorrow morning"   | Next-day open fills, so there's no look-ahead                                    |
| 🪙 Coin drops                    | Cash dividends on the ex-date (SPY paid $1.41 on 20 Mar 2020)                    |
| 🐷 Cash interest                 | 3-month T-bill rate, floored at 0 (it dipped negative in March 2020)             |
| "paper" vs 💀/🏆 LOCKED          | Unrealized vs realized P&L (average-cost basis, fees included)                   |
| ❤ Hearts                         | Drawdown from your peak (each heart = 5%)                                        |
| 👻 Ghost                         | Buy-and-hold benchmark: your day-1 bag, never touched                            |
| Money made                       | Total return                                                                     |
| Worst fall                       | Maximum drawdown                                                                 |
| Bumpiness                        | Annualized volatility (std of daily returns × √252)                              |
| **Skill score (headline grade)** | **Sharpe ratio**: mean daily excess return over the T-bill rate ÷ its std × √252 |
| Rank (Panic Seller → Legend)     | Your Sharpe minus the ghost's Sharpe                                             |
| Virus bosses                     | One per 10× of real cumulative global COVID cases (log scale)                    |
| Fog on the chart                 | No look-ahead: the chart's y-axis only uses days already seen                    |
| 🛡 SHIELD | A 1-month European put on SPY, strike 5% below the market. Priced with Black-Scholes using VIX as the volatility input. Its value is updated every day, and it pays max(strike − price, 0) at expiry |

Over this window the data teaches the lesson by itself. A 50-50 stocks/bonds bag beat ALL IN on return (+3.4% vs −6.9%), on worst fall (−16% vs −34%) and on Sharpe (+0.53 vs −0.13). Panic-selling at the 23 Mar bottom locked in about −30%; holding ended at −7.5%. Insurance bought on 19 Feb (VIX 14) cost about $20 per $10k and paid out over $2,300 a month later. The same cover on 16 Mar (VIX 83) cost $697.

## Data sources

- **Prices:** SPY, TLT, GLD, ^VIX, ^IRX from Yahoo Finance via `yfinance` 1.2.2. Daily OHLC, adjusted close and dividends, 10 Feb – 30 Jun 2020 (99 trading days).
- **Cases:** Johns Hopkins CSSE COVID-19 time series, cumulative global confirmed cases (CC BY 4.0).
- **Events:** 25 real dated events (Fed, Congress, WHO, circuit breakers, oil, jobs). Each one is sourced to the Fed, WHO, BLS, EIA, NYSE or AP/NPR/CNBC/BBC, and listed in-game under **SOURCES** and in [`docs/research/covid-2020-events.md`](docs/research/covid-2020-events.md). **No headline in this game is invented.** Each event appears on the first trading day a player could have known it.

The pipeline (`scripts/build_data.py`) caches raw downloads so rebuilds are byte-identical. `scripts/check_data.py` checks the data, including that raw price + dividends reproduces the adjusted return. Hand-checked against outside sources: SPY on 16 Mar 2020 = −10.94% (matches Yahoo's history page), and a buy-and-hold SPY run matches an independent hand calculation to within one day's interest.

## Limitations

- **One crisis.** 2008, GameStop 2021 and SVB 2023 are on the roadmap. Delisted tickers (Lehman, SVB) are missing from yfinance, which is survivorship bias, so those need stand-in ETFs.
- **Sharpe over 99 days is noisy.** One lucky week can swing it, and the end screen says so.
- **SPY vs the S&P 500 index:** on chaotic days the ETF and the index close slightly differently (16 Mar: −10.9% vs −12.0%), but they converge within days.
- **Simplified trading:** fractional shares, a flat 0.1% fee, no bid/ask spread or slippage, fills at the next open, dividends paid on the ex-date (in reality the cash arrives a few days later).
- **SHIELD pricing ignores volatility skew.** It uses the VIX (an at-the-money 30-day implied volatility) for a put struck 5% below the market. Real out-of-the-money puts trade at higher implied volatility, so the game's insurance is slightly cheaper than it really was. One shield at a time, with no early cash-out.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine, scoring, tutorial, events, save tests (Vitest)
npm run build      # static export to out/
```

Rebuild the data (optional; uses the committed cache, or `--refresh` to re-download):

```bash
pip install -r requirements.txt
python3 scripts/build_data.py && python3 scripts/check_data.py
```

## Stack

Next.js 16 (static export), React 19, TypeScript, Vitest, WebAudio (sound is generated, no audio files), code-drawn pixel sprites. Python + yfinance + pandas for the data. No backend, no logins.

## Docs

- [Design spec](docs/superpowers/specs/2026-10-19-survive-the-crash-design.md): what the game should be, with the reason behind each rule.
- [Build status](docs/BUILD_STATUS.md): what the code does today.
