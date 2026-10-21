"""Sanity checks for public/data/covid-2020.json. Exits non-zero on failure."""
import json
import os
import sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "covid-2020.json")
d = json.load(open(PATH))
days = d["days"]
by = {x["date"]: x for x in days}
A = ["SPY", "TLT", "GLD"]

assert len(days) == 99 and d["meta"]["tradingDays"] == 99, len(days)
assert days[0]["date"] == "2020-02-10" and days[-1]["date"] == "2020-06-30"
dates = [x["date"] for x in days]
assert all(a < b for a, b in zip(dates, dates[1:])), "dates not strictly increasing"
print(f"days: {len(days)}  {dates[0]} .. {dates[-1]}")

for x in days:
    assert x["vix"] is not None and x["irx"] is not None, x["date"]
    for t in A:
        r = x[t]
        assert set(r) == {"o", "h", "l", "c", "adj", "div"}, (x["date"], t)
        assert all(v is not None for v in r.values()), (x["date"], t)
        assert min(r["o"], r["h"], r["l"], r["c"], r["adj"]) > 0, (x["date"], t)
        assert r["l"] <= min(r["o"], r["c"]) and r["h"] >= max(r["o"], r["c"]), (x["date"], t, r)
print("OHLC ordering and positivity OK")

ret = (by["2020-03-16"]["SPY"]["c"] / by["2020-03-13"]["SPY"]["c"] - 1) * 100
print(f"SPY 2020-03-16 return: {ret:.2f}%")
assert abs(ret - (-10.94)) <= 0.02, ret

divs = {t: {x["date"]: x[t]["div"] for x in days if x[t]["div"] > 0} for t in A}
print("dividends:", {t: divs[t] for t in A})
assert sorted(divs["SPY"]) == ["2020-03-20", "2020-06-19"]
assert abs(divs["SPY"]["2020-03-20"] - 1.406) < 0.005 and abs(divs["SPY"]["2020-06-19"] - 1.366) < 0.005
assert sorted(divs["TLT"]) == ["2020-03-02", "2020-04-01", "2020-05-01", "2020-06-01"]
assert not divs["GLD"]

print(f"{'asset':5} {'raw px ret':>11} {'raw+divs':>10} {'adjusted':>10} {'diff(pp)':>9}")
for t in A:
    tr = 1.0
    for p, c in zip(days, days[1:]):
        tr *= (c[t]["c"] + c[t]["div"]) / p[t]["c"]
    raw = days[-1][t]["c"] / days[0][t]["c"] - 1
    adj = days[-1][t]["adj"] / days[0][t]["adj"] - 1
    diff = (tr - 1 - adj) * 100
    print(f"{t:5} {raw*100:10.2f}% {(tr-1)*100:9.2f}% {adj*100:9.2f}% {diff:9.3f}")
    assert abs(diff) <= 0.05, (t, diff)
for x in days:
    assert isinstance(x["cases"], int) and not isinstance(x["cases"], bool) and x["cases"] > 0, x["date"]
assert all(a["cases"] <= b["cases"] for a, b in zip(days, days[1:])), "cases decreased"
for dt, v in [("2020-02-10", 42771), ("2020-03-11", 126527), ("2020-03-23", 381711), ("2020-06-30", 10475388)]:
    print(f"cases {dt}: {by[dt]['cases']}")
    assert by[dt]["cases"] == v, (dt, by[dt]["cases"], v)
print("ALL CHECKS PASSED")
