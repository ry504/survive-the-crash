// Display formatting. Every number on screen goes through here: money to whole dollars, % to 1 decimal.
// ASCII "-" is used for minus because the pixel fonts have no U+2212 glyph.

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

/** "$10,000" / "-$456". Rounds to whole dollars; never shows "-$0". */
export function money(v: number): string {
  const r = Math.round(v);
  const abs = Math.abs(r).toLocaleString("en-US");
  return r < 0 ? `-$${abs}` : `$${abs}`;
}

/** "+$123" / "-$456" / "$0". */
export function signedMoney(v: number): string {
  const r = Math.round(v);
  if (r === 0) return "$0";
  return r > 0 ? `+${money(r)}` : money(r);
}

/** Fraction to "+1.2%" / "-3.4%" / "0.0%". */
export function signedPct(frac: number): string {
  const s = (frac * 100).toFixed(1);
  if (s === "0.0" || s === "-0.0") return "0.0%";
  return frac > 0 ? `+${s}%` : `${s}%`;
}

/** Fraction to "12.3%" (no sign). */
export function pct(frac: number): string {
  const s = (frac * 100).toFixed(1);
  return `${s === "-0.0" ? "0.0" : s}%`;
}

/** Absolute value of a fraction as "7.6%" (for sentences that already say up/down). */
export function absPct(frac: number): string {
  return pct(Math.abs(frac));
}

/** "2020-03-16" -> "16 MAR 2020" (parsed by hand: no time-zone drift). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
