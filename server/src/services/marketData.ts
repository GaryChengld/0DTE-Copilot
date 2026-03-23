// eslint-disable-next-line @typescript-eslint/no-explicit-any
import yahooFinance from "yahoo-finance2";
import { calculateVwap } from "./vwap.js";

type YFQuote = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type YFChartResult = {
  quotes: YFQuote[];
  meta: { regularMarketPrice?: number };
};

export interface OHLCBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  current: OHLCBar;
  daily: Omit<OHLCBar, "close">;
  vwap: number | null;
}

export interface MarketData {
  spx: TickerData;
  spy: TickerData;
  vix: number;
}

function isRTHCandle(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const total = hour * 60 + minute;

  return total >= 9 * 60 + 30 && total <= 16 * 60;
}

async function fetchTickerData(symbol: string): Promise<TickerData> {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  const quotes = (result.quotes ?? []).filter(
    (q) =>
      q.date != null &&
      q.open != null &&
      q.high != null &&
      q.low != null &&
      q.close != null &&
      q.volume != null &&
      isRTHCandle(q.date)
  ) as Array<{
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;

  if (quotes.length === 0) {
    throw new Error(`No RTH quotes returned for ${symbol}`);
  }

  const latest = quotes[quotes.length - 1];

  const dailyOpen = quotes[0].open;
  const dailyHigh = Math.max(...quotes.map((q) => q.high));
  const dailyLow = Math.min(...quotes.map((q) => q.low));
  const dailyVolume = quotes.reduce((sum, q) => sum + q.volume, 0);

  const vwap = calculateVwap(quotes);

  return {
    current: {
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume,
    },
    daily: {
      open: dailyOpen,
      high: dailyHigh,
      low: dailyLow,
      volume: dailyVolume,
    },
    vwap,
  };
}

async function fetchVix(): Promise<number> {
  const result = (await yahooFinance.quote("^VIX")) as unknown as {
    regularMarketPrice?: number;
  };
  return result.regularMarketPrice ?? 0;
}

export async function fetchMarketData(): Promise<MarketData> {
  const [spx, spy, vix] = await Promise.all([
    fetchTickerData("^GSPC"),
    fetchTickerData("SPY"),
    fetchVix(),
  ]);

  return { spx, spy, vix };
}
