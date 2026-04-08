import YahooFinance from "yahoo-finance2";
import { SMA, RSI, VWAP } from "technicalindicators";

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
  chartPreviousClose?: number;
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
  price: number;
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

export interface SpxMarketData {
  candles_15m: Candle5m[];
  candles_5m: Candle5m[];
  daily_stats: DailyStats;
}

export interface SpyMarketData {
  daily_stats: DailyStats;
}

export interface MarketData {
  spx: SpxMarketData;
  spy: SpyMarketData;
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

// Snap a timestamp to the 15-minute boundary in ET (e.g. 09:35 → "09:30")
function snap15mET(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  return `${hour}:${String(Math.floor(minute / 15) * 15).padStart(2, "0")}`;
}

// A 5m candle is closed when its start time + 5 minutes is in the past
function isCandleClosed(candleDate: Date): boolean {
  return candleDate.getTime() + 5 * 60 * 1000 <= Date.now();
}

function calcVwap(candles: RTHCandle[]): number | null {
  if (candles.length === 0) return null;
  const result = VWAP.calculate({
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    volume: candles.map((c) => c.volume),
  });
  return result.length > 0 ? Math.round(result[result.length - 1] * 100) / 100 : null;
}

function calcMA(closes: number[], period: number): number | null {
  const result = SMA.calculate({ period, values: closes });
  return result.length > 0 ? Math.round(result[result.length - 1] * 100) / 100 : null;
}

function calcRSI(closes: number[], period: number = 14): number | null {
  const result = RSI.calculate({ period, values: closes });
  return result.length > 0 ? Math.round(result[result.length - 1] * 100) / 100 : null;
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

// --- SPX daily snapshot (lightweight) ---

export interface SpxDailySnapshot {
  price: number;
  o: number;
  h: number;
  l: number;
  change: number;
  changePct: number;
}

export async function fetchSpxDailySnapshot(): Promise<SpxDailySnapshot> {
  const { candles, meta } = await fetchTodayRTHCandles("^GSPC");

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hasCandles = candles.length > 0;

  const price = r2(meta.regularMarketPrice ?? (hasCandles ? candles[candles.length - 1].close : 0));
  const o = r2(hasCandles ? candles[0].open : (meta.regularMarketOpen ?? 0));
  const h = r2(hasCandles ? Math.max(...candles.map((c) => c.high)) : (meta.regularMarketDayHigh ?? 0));
  const l = r2(hasCandles ? Math.min(...candles.map((c) => c.low)) : (meta.regularMarketDayLow ?? 0));
  const prevClose = meta.chartPreviousClose ?? o;
  const change = r2(price - prevClose);
  const changePct = prevClose !== 0 ? r2((change / prevClose) * 100) : 0;

  return { price, o, h, l, change, changePct };
}

// --- Main export ---

export async function fetchMarketData(): Promise<MarketData> {
  const [spxResult, spyResult, spxDailyCloses, spyDailyCloses] = await Promise.all([
    fetchTodayRTHCandles("^GSPC"),
    fetchTodayRTHCandles("SPY"),
    fetchDailyCloses("^GSPC", 300),
    fetchDailyCloses("SPY", 300),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const toCandle5m = (candle: RTHCandle): Candle5m => ({
    t: formatTimeET(candle.date),
    o: r2(candle.open),
    h: r2(candle.high),
    l: r2(candle.low),
    c: r2(candle.close),
    v: candle.volume,
  });

  const buildCandles15m = (candles: RTHCandle[]): Candle5m[] => {
    const result: Candle5m[] = [];
    for (let i = 0; i < candles.length; i += 3) {
      const group = candles.slice(i, i + 3);
      // Only include complete groups of 3 where the last candle is closed
      if (group.length < 3 || !isCandleClosed(group[2].date)) break;
      result.push({
        t: snap15mET(group[0].date),
        o: r2(group[0].open),
        h: r2(Math.max(...group.map((c) => c.high))),
        l: r2(Math.min(...group.map((c) => c.low))),
        c: r2(group[group.length - 1].close),
        v: group.reduce((sum, c) => sum + c.volume, 0),
      });
    }
    return result;
  };

  const buildDailyStats = (
    candles: RTHCandle[],
    vwapCandles: RTHCandle[],
    dailyCloses: number[],
    meta: YFMeta
  ): DailyStats => {
    const hasCandles = candles.length > 0;
    return {
      price: r2(meta.regularMarketPrice ?? (hasCandles ? candles[candles.length - 1].close : 0)),
      o: r2(hasCandles ? candles[0].open : (meta.regularMarketOpen ?? 0)),
      h: r2(hasCandles ? Math.max(...candles.map((c) => c.high)) : (meta.regularMarketDayHigh ?? 0)),
      l: r2(hasCandles ? Math.min(...candles.map((c) => c.low)) : (meta.regularMarketDayLow ?? 0)),
      vwap: calcVwap(vwapCandles),
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

  const spxClosedCandles = spxResult.candles.filter((c) => isCandleClosed(c.date));

  return {
    spx: {
      candles_15m: buildCandles15m(spxClosedCandles),
      candles_5m: spxClosedCandles.slice(-6).map(toCandle5m),
      daily_stats: buildDailyStats(spxResult.candles, spxWithSpyVolume, spxDailyCloses, spxResult.meta),
    },
    spy: {
      daily_stats: buildDailyStats(spyResult.candles, spyResult.candles, spyDailyCloses, spyResult.meta),
    },
  };
}
