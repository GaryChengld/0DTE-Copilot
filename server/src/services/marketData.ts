import YahooFinance from "yahoo-finance2";
import { calculateVwap } from "./vwap.js";

const yahooFinance = new YahooFinance();

// --- Internal types ---

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

type RTHCandle = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// --- Exported types ---

export interface Candle5m {
  t: string; // "HH:mm" in ET
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface DailyStats {
  o: number;
  h: number;
  l: number;
  vwap: number | null;
  rsi: number | null;
  ma: {
    "5": number | null;
    "20": number | null;
    "50": number | null;
    "100": number | null;
    "200": number | null;
  };
}

export interface TickerMarketData {
  candles_5m: Candle5m[];
  daily_stats: DailyStats;
}

export interface MarketData {
  spx: TickerMarketData;
  spy: TickerMarketData;
  vix: {
    current: number;
    history_5m: number[];
  };
}

// --- Helpers ---

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

function formatTimeET(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parts.find((p) => p.type === "minute")!.value;
  return `${hour}:${minute}`;
}

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return Math.round((slice.reduce((sum, c) => sum + c, 0) / period) * 100) / 100;
}

function calcRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  let avgGain = changes.slice(0, period).filter((c) => c > 0).reduce((s, c) => s + c, 0) / period;
  let avgLoss =
    changes
      .slice(0, period)
      .filter((c) => c < 0)
      .reduce((s, c) => s + Math.abs(c), 0) / period;

  for (const change of changes.slice(period)) {
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
}

// --- Fetch helpers ---

async function fetchTodayRTHCandles(symbol: string): Promise<{ candles: RTHCandle[]; meta: YFMeta }> {
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

async function fetchDailyCloses(symbol: string, days: number): Promise<number[]> {
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "1d" as const,
  })) as unknown as YFChartResult;

  return (result.quotes ?? []).filter((q) => q.close != null).map((q) => q.close!);
}

async function fetchVixData(): Promise<{ current: number; history_5m: number[] }> {
  const period1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  const result = (await yahooFinance.chart("^VIX", {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  const todayCandles = (result.quotes ?? []).filter((q) => {
    if (q.date == null || q.close == null) return false;
    const candleDateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(q.date);
    return candleDateET === todayET && isRTHCandle(q.date);
  });

  return {
    current: result.meta?.regularMarketPrice ?? 0,
    history_5m: todayCandles.map((q) => q.close!),
  };
}

// --- Main export ---

export async function fetchMarketData(): Promise<MarketData> {
  const [spxResult, spyResult, spxDailyCloses, spyDailyCloses, vixData] = await Promise.all([
    fetchTodayRTHCandles("^GSPC"),
    fetchTodayRTHCandles("SPY"),
    fetchDailyCloses("^GSPC", 210),
    fetchDailyCloses("SPY", 210),
    fetchVixData(),
  ]);

  const toCandle5m = (candle: RTHCandle): Candle5m => ({
    t: formatTimeET(candle.date),
    o: candle.open,
    h: candle.high,
    l: candle.low,
    c: candle.close,
    v: candle.volume,
  });

  const buildDailyStats = (
    candles: RTHCandle[],
    vwapCandles: RTHCandle[],
    dailyCloses: number[],
    meta: YFMeta
  ): DailyStats => {
    const hasCandles = candles.length > 0;
    return {
      o: hasCandles ? candles[0].open : (meta.regularMarketOpen ?? 0),
      h: hasCandles ? Math.max(...candles.map((c) => c.high)) : (meta.regularMarketDayHigh ?? 0),
      l: hasCandles ? Math.min(...candles.map((c) => c.low)) : (meta.regularMarketDayLow ?? 0),
      vwap: calculateVwap(vwapCandles),
      rsi: calcRSI(dailyCloses),
      ma: {
        "5": calcMA(dailyCloses, 5),
        "20": calcMA(dailyCloses, 20),
        "50": calcMA(dailyCloses, 50),
        "100": calcMA(dailyCloses, 100),
        "200": calcMA(dailyCloses, 200),
      },
    };
  };

  // SPX VWAP: use SPX prices with SPY volume — SPX is a cash index with unreliable synthetic volume
  const spxWithSpyVolume = spxResult.candles.map((spxCandle) => {
    const spyCandle = spyResult.candles.find((s) => s.date.getTime() === spxCandle.date.getTime());
    return { ...spxCandle, volume: spyCandle?.volume ?? 0 };
  });

  return {
    spx: {
      candles_5m: spxResult.candles.map(toCandle5m),
      daily_stats: buildDailyStats(spxResult.candles, spxWithSpyVolume, spxDailyCloses, spxResult.meta),
    },
    spy: {
      candles_5m: spyResult.candles.map(toCandle5m),
      daily_stats: buildDailyStats(spyResult.candles, spyResult.candles, spyDailyCloses, spyResult.meta),
    },
    vix: vixData,
  };
}
