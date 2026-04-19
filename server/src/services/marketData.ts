import YahooFinance from "yahoo-finance2";
import { SMA, RSI, VWAP, ATR } from "technicalindicators";

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

// Returns "YYYY-MM-DDTHH:mm" in ET — used for multi-day candle timestamps
function formatDateTimeET(date: Date): string {
  const dateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parts.find((p) => p.type === "minute")!.value;
  return `${dateET}T${hour}:${minute}`;
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

function calcATR(candles: { high: number; low: number; close: number }[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;
  const result = ATR.calculate({
    period,
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
  });
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

// Fetch the most recent trading day's RTH 5-min candles (works outside market hours / weekends)
async function fetchLatestRTHCandles(symbol: string): Promise<{ candles: RTHCandle[]; meta: YFMeta }> {
  const period1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // look back 5 days

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  const valid = (result.quotes ?? []).filter((q) =>
    q.date != null &&
    q.open != null &&
    q.high != null &&
    q.low != null &&
    q.close != null &&
    q.volume != null &&
    q.volume > 0 &&
    isRTHCandle(q.date)
  ) as RTHCandle[];

  // Group by ET date, pick the most recent
  const byDate = new Map<string, RTHCandle[]>();
  for (const c of valid) {
    const dateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (!byDate.has(dateET)) byDate.set(dateET, []);
    byDate.get(dateET)!.push(c);
  }

  const latestDate = [...byDate.keys()].sort().at(-1);
  const candles = latestDate ? byDate.get(latestDate)! : [];

  return { candles, meta: result.meta };
}

// Returns the last `limit` RTH 5-min candles across multiple trading days (sorted ascending)
async function fetchRecentRTHCandles(symbol: string, limit: number): Promise<{ candles: RTHCandle[]; meta: YFMeta }> {
  const period1 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "5m" as const,
  })) as unknown as YFChartResult;

  const valid = ((result.quotes ?? []).filter((q) =>
    q.date != null &&
    q.open != null &&
    q.high != null &&
    q.low != null &&
    q.close != null &&
    q.volume != null &&
    q.volume > 0 &&
    isRTHCandle(q.date)
  ) as RTHCandle[]).sort((a, b) => a.date.getTime() - b.date.getTime());

  return { candles: valid.slice(-limit), meta: result.meta };
}

async function fetchDailyCloses(symbol: string, days: number): Promise<number[]> {
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "1d" as const,
  })) as unknown as YFChartResult;

  return (result.quotes ?? []).filter((q) => q.close != null).map((q) => q.close!);
}

async function fetchDailyCandles(symbol: string, days: number): Promise<{ high: number; low: number; close: number }[]> {
  const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = (await yahooFinance.chart(symbol, {
    period1,
    interval: "1d" as const,
  })) as unknown as YFChartResult;

  return (result.quotes ?? [])
    .filter((q) => q.high != null && q.low != null && q.close != null)
    .map((q) => ({ high: q.high!, low: q.low!, close: q.close! }));
}

// --- SPX intraday candles ---

export interface SpxCandle {
  t: string;          // "YYYY-MM-DDTHH:mm" ET — candle open date+time
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;          // SPY volume (used for VWAP)
  vwap: number;       // cumulative VWAP, resets each trading day
  rsi: number | null; // RSI(14) seeded with daily closes
  open: boolean;      // true = candle still in progress
}

const CANDLE_LIMIT = 80;

export async function fetchSpxCandles(): Promise<SpxCandle[]> {
  const [spxResult, spyResult, seedCloses] = await Promise.all([
    fetchRecentRTHCandles("^GSPC", CANDLE_LIMIT),
    fetchRecentRTHCandles("SPY", CANDLE_LIMIT),
    fetchDailyCloses("^GSPC", 30), // seed RSI so first intraday candle has a value
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const merged = spxResult.candles.map((spx) => {
    const spy = spyResult.candles.find((s) => s.date.getTime() === spx.date.getTime());
    return { ...spx, volume: spy?.volume ?? 0 };
  });

  // Compute RSI on [seedCloses + intraday closes] so every intraday candle has a value
  const intradayCloses = merged.map((c) => c.close);
  const combined = [...seedCloses, ...intradayCloses];
  const rsiAll = RSI.calculate({ period: 14, values: combined });
  const rsiIntraday = rsiAll.slice(rsiAll.length - intradayCloses.length);

  // VWAP resets each trading day
  let cumTPV = 0;
  let cumVol = 0;
  let currentDateET = "";

  return merged.map((c, i) => {
    const candleDateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (candleDateET !== currentDateET) {
      cumTPV = 0;
      cumVol = 0;
      currentDateET = candleDateET;
    }

    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    const vwap = cumVol > 0 ? r2(cumTPV / cumVol) : r2(c.close);
    const rsi = rsiIntraday[i] != null ? r2(rsiIntraday[i]) : null;

    return {
      t: formatDateTimeET(c.date),
      o: r2(c.open),
      h: r2(c.high),
      l: r2(c.low),
      c: r2(c.close),
      v: c.volume,
      vwap,
      rsi,
      open: !isCandleClosed(c.date),
    };
  });
}

export async function fetchSpxCandlesByDate(date: string): Promise<SpxCandle[]> {
  // Pull a wide window: 7 calendar days before → 1 day after the target date.
  // This guarantees we capture the previous trading day even across weekends.
  const targetDate = new Date(`${date}T00:00:00`);
  const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const period2 = new Date(targetDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [spxResult, seedCloses] = await Promise.all([
    yahooFinance.chart("^GSPC", { period1, period2, interval: "5m" as const }) as unknown as Promise<YFChartResult>,
    fetchDailyCloses("^GSPC", 60),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const spxAll = ((spxResult.quotes ?? []).filter((q) =>
    q.date != null && q.open != null && q.high != null &&
    q.low != null && q.close != null && q.volume != null &&
    q.volume > 0 && isRTHCandle(q.date)
  ) as RTHCandle[]);

  // Group by ET date
  const byDate = new Map<string, RTHCandle[]>();
  for (const c of spxAll) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(c);
  }

  // Use the selected date if it has candles; otherwise fall back to the most recent trading day before it.
  // Then take the last 80 candles ending at that effective date.
  const sortedDates = [...byDate.keys()].sort();
  const effectiveDate = sortedDates.filter((d) => d <= date).at(-1);

  if (!effectiveDate) return [];

  const allCandles: RTHCandle[] = [];
  for (const d of sortedDates.filter((d) => d <= effectiveDate)) {
    allCandles.push(...(byDate.get(d) ?? []));
  }
  const combined = allCandles.slice(-80);

  // Seed RSI with daily closes then append intraday closes
  const intradayCloses = combined.map((c) => c.close);
  const rsiAll = RSI.calculate({ period: 14, values: [...seedCloses, ...intradayCloses] });
  const rsiIntraday = rsiAll.slice(rsiAll.length - intradayCloses.length);

  // VWAP resets at each trading day boundary
  let cumTPV = 0;
  let cumVol = 0;
  let currentDateET = "";

  return combined.map((c, i) => {
    const candleDateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (candleDateET !== currentDateET) {
      cumTPV = 0;
      cumVol = 0;
      currentDateET = candleDateET;
    }
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    const vwap = cumVol > 0 ? r2(cumTPV / cumVol) : r2(c.close);
    const rsi = rsiIntraday[i] != null ? r2(rsiIntraday[i]) : null;

    return {
      t: formatDateTimeET(c.date),
      o: r2(c.open),
      h: r2(c.high),
      l: r2(c.low),
      c: r2(c.close),
      v: c.volume,
      vwap,
      rsi,
      open: false,
    };
  });
}

// --- Sector ETF snapshots ---

export interface SectorEtf {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

const SECTOR_ETFS: { symbol: string; name: string }[] = [
  { symbol: "XLK",  name: "Technology" },
  { symbol: "XLC",  name: "Communication" },
  { symbol: "XLY",  name: "Cons. Discret." },
  { symbol: "XLP",  name: "Cons. Staples" },
  { symbol: "XLV",  name: "Health Care" },
  { symbol: "XLF",  name: "Financials" },
  { symbol: "XLI",  name: "Industrials" },
  { symbol: "XLB",  name: "Materials" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLU",  name: "Utilities" },
  { symbol: "XLE",  name: "Energy" },
];

export async function fetchSectorEtfs(): Promise<SectorEtf[]> {
  const r2 = (n: number) => Math.round(n * 100) / 100;

  return Promise.all(
    SECTOR_ETFS.map(async ({ symbol, name }) => {
      const quote = await yahooFinance.quote(symbol);
      const price     = r2(quote.regularMarketPrice      ?? 0);
      const change    = r2(quote.regularMarketChange     ?? 0);
      const changePct = r2(quote.regularMarketChangePercent ?? 0);
      return { symbol, name, price, change, changePct };
    })
  );
}

// --- SPX daily snapshot (lightweight) ---

export interface SpxDailySnapshot {
  price: number;
  o: number;
  h: number;
  l: number;
  change: number;
  changePct: number;
  rsi: number | null;
  atr: number | null;
  ma: {
    "20": number | null;
    "50": number | null;
    "100": number | null;
    "200": number | null;
  };
}

export async function fetchSpxDailySnapshot(): Promise<SpxDailySnapshot> {
  const [{ candles, meta }, dailyCloses, dailyCandles, spxQuote] = await Promise.all([
    fetchTodayRTHCandles("^GSPC"),
    fetchDailyCloses("^GSPC", 300),
    fetchDailyCandles("^GSPC", 60),
    yahooFinance.quote("^GSPC"),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hasCandles = candles.length > 0;

  const price = r2(meta.regularMarketPrice ?? (hasCandles ? candles[candles.length - 1].close : 0));
  const o = r2(hasCandles ? candles[0].open : (spxQuote.regularMarketOpen ?? meta.regularMarketOpen ?? 0));
  const h = r2(hasCandles ? Math.max(...candles.map((c) => c.high)) : (meta.regularMarketDayHigh ?? 0));
  const l = r2(hasCandles ? Math.min(...candles.map((c) => c.low)) : (meta.regularMarketDayLow ?? 0));
  const change    = r2(spxQuote.regularMarketChange        ?? 0);
  const changePct = r2(spxQuote.regularMarketChangePercent ?? 0);

  return {
    price, o, h, l, change, changePct,
    rsi: calcRSI(dailyCloses),
    atr: calcATR(dailyCandles),
    ma: {
      "20": calcMA(dailyCloses, 20),
      "50": calcMA(dailyCloses, 50),
      "100": calcMA(dailyCloses, 100),
      "200": calcMA(dailyCloses, 200),
    },
  };
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
