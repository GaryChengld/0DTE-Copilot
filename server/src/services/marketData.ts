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

type YFMeta = {
  regularMarketPrice?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
};

type YFChartResult = {
  quotes: YFQuote[];
  meta: YFMeta;
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

type ChartResult = { candles: RTHCandle[]; meta: YFMeta };

async function fetchChartResult(symbol: string): Promise<ChartResult> {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  const candles = (result.quotes ?? []).filter((q) => {
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

  return { candles, meta: result.meta };
}

function buildTickerDataFromMeta(meta: YFMeta): TickerData {
  const price = meta.regularMarketPrice ?? 0;
  const open = meta.regularMarketOpen ?? price;
  const high = meta.regularMarketDayHigh ?? price;
  const low = meta.regularMarketDayLow ?? price;
  const volume = meta.regularMarketVolume ?? 0;

  return {
    current: { open, high, low, close: price, volume },
    daily: { open, high, low, volume },
    vwap: null,
  };
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
  const [spxResult, spyResult, vix] = await Promise.all([
    fetchChartResult("^GSPC"),
    fetchChartResult("SPY"),
    fetchVix(),
  ]);

  let spx: TickerData;
  let spy: TickerData;

  if (spxResult.candles.length === 0 || spyResult.candles.length === 0) {
    // Market just opened — no completed 5-min candles yet. Use daily meta data only.
    console.log("[marketData] no RTH candles yet — using daily meta data for opening snapshot");
    spx = buildTickerDataFromMeta(spxResult.meta);
    spy = buildTickerDataFromMeta(spyResult.meta);
  } else {
    // SPX VWAP: use SPX prices (H/L/C) with SPY volume — SPX is a cash index with unreliable synthetic volume
    const spxWithSpyVolume = spxResult.candles.map((spxCandle) => {
      const spyCandle = spyResult.candles.find(
        (s) => s.date.getTime() === spxCandle.date.getTime()
      );
      return { ...spxCandle, volume: spyCandle?.volume ?? 0 };
    });

    spx = buildTickerData(spxResult.candles, spxWithSpyVolume);
    spy = buildTickerData(spyResult.candles, spyResult.candles);
  }

  return { spx, spy, vix };
}
