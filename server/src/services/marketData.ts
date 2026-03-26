import YahooFinance from "yahoo-finance2";
import { calculateVwap } from "./vwap.js";

const yahooFinance = new YahooFinance();

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

type RTHCandle = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

async function fetchRTHCandles(symbol: string): Promise<RTHCandle[]> {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  return (result.quotes ?? []).filter((q) => {
    if (
      q.date == null ||
      q.open == null ||
      q.high == null ||
      q.low == null ||
      q.close == null ||
      q.volume == null ||
      q.volume <= 0
    )
      return false;
    const candleDateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(q.date);
    return candleDateET === todayET && isRTHCandle(q.date);
  }) as RTHCandle[];
}

function buildTickerData(candles: RTHCandle[], vwapCandles: RTHCandle[]): TickerData {
  if (candles.length === 0) {
    throw new Error("No RTH candles available");
  }

  const latest = candles[candles.length - 1];

  return {
    current: {
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume,
    },
    daily: {
      open: candles[0].open,
      high: Math.max(...candles.map((q) => q.high)),
      low: Math.min(...candles.map((q) => q.low)),
      volume: candles.reduce((sum, q) => sum + q.volume, 0),
    },
    vwap: calculateVwap(vwapCandles),
  };
}

async function fetchVix(): Promise<number> {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart("^VIX", {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  return result.meta?.regularMarketPrice ?? 0;
}

export async function fetchMarketData(): Promise<MarketData> {
  const [spxCandles, spyCandles, vix] = await Promise.all([
    fetchRTHCandles("^GSPC"),
    fetchRTHCandles("SPY"),
    fetchVix(),
  ]);

  if (spxCandles.length === 0) throw new Error("No RTH quotes returned for ^GSPC");
  if (spyCandles.length === 0) throw new Error("No RTH quotes returned for SPY");

  // SPX VWAP: use SPX prices (H/L/C) with SPY volume — SPX is a cash index with unreliable synthetic volume
  const spxWithSpyVolume = spxCandles.map((spxCandle) => {
    const spyCandle = spyCandles.find(
      (s) => s.date.getTime() === spxCandle.date.getTime()
    );
    return { ...spxCandle, volume: spyCandle?.volume ?? 0 };
  });

  const spx = buildTickerData(spxCandles, spxWithSpyVolume);
  const spy = buildTickerData(spyCandles, spyCandles);

  return { spx, spy, vix };
}
