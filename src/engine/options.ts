// Black-Scholes pricing for the SHIELD put (spec §5). Pure math, no game state.

/**
 * Standard normal CDF. West (2005) double-precision version of Hart (1968) algorithm 5666:
 * absolute error below 1e-14, far tighter than the 1e-7 the game needs.
 */
export function normCdf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const z = Math.abs(x);
  let c: number;
  if (z > 37) {
    c = 0;
  } else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/**
 * Black-Scholes price of one European put.
 * S spot, K strike, sigma annual vol (0.2 = 20%), r annual continuous rate, T years to expiry.
 * Edge cases: T <= 0 → intrinsic max(K − S, 0); sigma <= 0 → discounted intrinsic max(K·e^(−rT) − S, 0);
 * S <= 0 → K·e^(−rT) (the stock is worthless, the put pays the full strike).
 */
export function bsPut(
  S: number,
  K: number,
  sigma: number,
  r: number,
  T: number,
): number {
  if (!(K > 0)) return 0;
  if (!(T > 0)) return Math.max(K - S, 0);
  const disc = K * Math.exp(-r * T);
  if (!(S > 0)) return disc;
  if (!(sigma > 0)) return Math.max(disc - S, 0);
  const sqT = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / sqT;
  const d2 = d1 - sqT;
  return Math.max(disc * normCdf(-d2) - S * normCdf(-d1), 0);
}
