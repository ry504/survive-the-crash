"""Build public/data/covid-2020.json from Yahoo Finance (yfinance). Deterministic output."""
import json
import os
import sys

import pandas as pd
import yfinance as yf

START, END_EXCL, END_INCL = "2020-02-10", "2020-07-01", "2020-06-30"
ASSETS = {"SPY": "Stocks", "TLT": "Bonds", "GLD": "Gold"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "covid-2020.json")


CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")


JHU = os.path.join(CACHE, "jhu_confirmed_global.csv")
JHU_URL = ("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/"
           "csse_covid_19_time_series/time_series_covid19_confirmed_global.csv")


def jhu_cases(refresh=False):
    """Cumulative global confirmed cases per calendar date (cached CSV; network only on --refresh)."""
    if refresh or not os.path.exists(JHU):
        import urllib.request
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(JHU_URL, JHU)
    df = pd.read_csv(JHU)
    tot = df.iloc[:, 4:].sum()
    tot.index = pd.to_datetime(tot.index, format="%m/%d/%y")
    return tot


def dl(ticker, refresh=False):
    """Raw Yahoo download, cached as CSV. Yahoo's Adj Close jitters in the 4th decimal
    between downloads, so the cache is what makes rebuilds byte-identical.
    Re-download with: python3 scripts/build_data.py --refresh"""
    path = os.path.join(CACHE, ticker.replace("^", "") + ".csv")
    if not refresh and os.path.exists(path):
        return pd.read_csv(path, index_col=0, parse_dates=True)
    df = yf.download(ticker, start=START, end=END_EXCL, auto_adjust=False,
                     actions=True, progress=False, multi_level_index=False)
    df.index = pd.DatetimeIndex(df.index).tz_localize(None).normalize()
    df.index.name = "Date"
    os.makedirs(CACHE, exist_ok=True)
    df.to_csv(path, float_format="%.10g")
    return df


def main():
    refresh = "--refresh" in sys.argv
    raw = {t: dl(t, refresh) for t in list(ASSETS) + ["^VIX", "^IRX"]}
    cal = raw["SPY"].index
    assert len(cal) == 99, f"SPY calendar has {len(cal)} days, expected 99"

    series = {}
    for k in ("^VIX", "^IRX"):
        s = raw[k]["Close"].reindex(cal)
        filled = list(s.index[s.isna()])
        s = s.ffill()
        print(f"{k}: forward-filled {[d.strftime('%Y-%m-%d') for d in filled] or 'none'}")
        series[k] = s

    asset_df = {}
    for t in ASSETS:
        d = raw[t].reindex(cal)
        d["Dividends"] = d["Dividends"].fillna(0.0) if "Dividends" in d else 0.0
        asset_df[t] = d

    for t, d in asset_df.items():
        assert not d[["Open", "High", "Low", "Close", "Adj Close", "Dividends"]].isna().any().any(), t
    for k, s in series.items():
        assert not s.isna().any(), k

    # Dividends outside the calendar (e.g. weekend ex-date) would be silently lost; flag them.
    for t in ASSETS:
        lost = raw[t]["Dividends"][~raw[t].index.isin(cal)]
        assert (lost == 0).all(), f"{t} dividends off-calendar: {lost[lost != 0]}"

    cases = jhu_cases(refresh)
    lines = []
    for i, date in enumerate(cal):
        day = {"date": date.strftime("%Y-%m-%d")}
        for t, d in asset_df.items():
            r = d.loc[date]
            day[t] = {"o": round(float(r["Open"]), 4), "h": round(float(r["High"]), 4),
                      "l": round(float(r["Low"]), 4), "c": round(float(r["Close"]), 4),
                      "adj": round(float(r["Adj Close"]), 4), "div": round(float(r["Dividends"]), 4)}
        day["vix"] = round(float(series["^VIX"].loc[date]), 2)
        day["irx"] = round(float(series["^IRX"].loc[date]), 2)
        day["cases"] = int(cases.loc[date])
        lines.append("    " + json.dumps(day, separators=(",", ":")))

    meta = {"id": "covid-2020", "name": "COVID crash 2020", "start": START, "end": END_INCL,
            "tradingDays": len(cal), "source": f"Yahoo Finance via yfinance {yf.__version__}",
            "notes": ["Prices are raw (split-adjusted only) closes; adj = dividend-adjusted close.",
                      "div = cash dividend per share on its ex-date.",
                      "VIX/IRX forward-filled onto SPY trading days.",
                      "IRX is the 13-week T-bill yield in annual percent.",
                      "Johns Hopkins CSSE COVID-19 time series (CC BY 4.0), cumulative global confirmed cases"]}
    assets = {t: {"label": l} for t, l in ASSETS.items()}
    text = ('{\n  "meta": ' + json.dumps(meta, separators=(",", ":")) +
            ',\n  "assets": ' + json.dumps(assets, separators=(",", ":")) +
            ',\n  "days": [\n' + ",\n".join(lines) + "\n  ]\n}\n")
    json.loads(text)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="\n") as f:
        f.write(text)
    print(f"wrote {os.path.normpath(OUT)} ({len(cal)} days)")


if __name__ == "__main__":
    sys.exit(main())
