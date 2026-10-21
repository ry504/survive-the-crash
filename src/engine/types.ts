export type Asset = "SPY" | "TLT" | "GLD";
export const ASSETS: Asset[] = ["SPY", "TLT", "GLD"];

/** One asset's prices for one day. o/h/l/c are raw; adj is dividend-adjusted; div is the cash dividend per share with its ex-date on this day. */
export interface Bar {
  o: number;
  h: number;
  l: number;
  c: number;
  adj: number;
  div: number;
}

export interface Day {
  date: string;
  SPY: Bar;
  TLT: Bar;
  GLD: Bar;
  /** VIX close (the FEAR meter). */
  vix: number;
  /** 13-week T-bill yield, annual percent. Daily risk-free rate = irx / 100 / 252. */
  irx: number;
  /** Cumulative global confirmed COVID cases (Johns Hopkins CSSE), for the virus bosses (one per 10x). Not used in money math. */
  cases?: number;
}

export interface Scenario {
  meta: {
    id: string;
    name: string;
    start: string;
    end: string;
    tradingDays: number;
    source: string;
    notes: string[];
  };
  assets: Record<Asset, { label: string }>;
  days: Day[];
}

/** Fractions of total value; must sum to 1. */
export type Weights = Record<Asset | "CASH", number>;

export type Order =
  | { kind: "buy"; asset: Asset; dollars: number }
  | { kind: "sell"; asset: Asset; dollars: number }
  | { kind: "target"; weights: Weights }
  /** SHIELD (spec §5): fills at the next open AFTER every other order in the queue, so a BUY SPY + SHIELD queued together covers the new shares. If cash is short, just enough SPY is sold at that open to pay. */
  | { kind: "shield" };

/** One active SHIELD: a European put on SPY, 1 contract per SPY share held when it filled. */
export interface Shield {
  contracts: number;
  /** K = 0.95 × SPY open on the fill day. */
  strike: number;
  /** Scenario index of the expiry close (fill day + 21 trading days). */
  expiryT: number;
  /** Total premium paid, in dollars. */
  premiumPaid: number;
  /** Scenario index of the fill day. */
  boughtT: number;
}

export interface Holdings {
  cash: number;
  shares: Record<Asset, number>;
  /** Average-cost basis per asset in dollars, buy fees included. Paper P&L = shares × price − cost. */
  cost: Record<Asset, number>;
  /** The active SHIELD put, or null. Cleared at its expiry close. */
  shield: Shield | null;
}

export type GameEvent =
  | {
      kind: "fill";
      asset: Asset;
      side: "buy" | "sell";
      shares: number;
      price: number;
      dollars: number;
      fee: number;
      /** Sells only: net proceeds minus the average cost of the shares sold (the "LOCKED" P&L). */
      realized?: number;
    }
  | {
      kind: "dividend";
      asset: Asset;
      perShare: number;
      shares: number;
      amount: number;
    }
  | { kind: "interest"; amount: number }
  | { kind: "shieldBuy"; contracts: number; strike: number; premium: number; expiryT: number }
  /** Emitted at the expiry close even when amount is 0 ("expired worthless"). spot = SPY close that day. */
  | { kind: "shieldPayout"; amount: number; contracts: number; strike: number; spot: number }
  /** A queued SHIELD bought nothing: no SPY shares after the fills. (Short cash never skips: SPY is sold to pay.) */
  | { kind: "shieldSkipped"; reason: "noStocks" };

/** Snapshot at the close of day t. */
export interface DayRecord {
  t: number;
  date: string;
  holdings: Holdings;
  /** Cash + shares × close + shieldValue. */
  value: number;
  peak: number;
  /** 1 - value / peak, in [0, 1). */
  drawdown: number;
  feesPaid: number;
  dividendsReceived: number;
  interestEarned: number;
  realizedPnl: number;
  /** Black-Scholes mark of the active SHIELD at this close (0 if none). Counts in value. */
  shieldValue: number;
  /** Running total of SHIELD premiums paid. */
  shieldPremiums: number;
  /** Running total of SHIELD payouts received at expiry. */
  shieldPayouts: number;
  /** What happened between the previous close and this close (interest, dividends, fills). */
  events: GameEvent[];
}

export interface GameState {
  scenario: Scenario;
  /** Index into scenario.days of the close the player is looking at. */
  t: number;
  holdings: Holdings;
  /** Orders queued at close t; they fill at the open of day t + 1. */
  pending: Order[];
  history: DayRecord[];
  feesPaid: number;
  dividendsReceived: number;
  interestEarned: number;
  realizedPnl: number;
  peak: number;
  /** SHIELD mark at close t (0 if none). */
  shieldValue: number;
  shieldPremiums: number;
  shieldPayouts: number;
}
