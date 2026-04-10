# Task 21 — SPX Intraday Candles API ✅ COMPLETED (2026-04-08)

## Goal

Expose the latest 80 SPX RTH 5-minute candles (including the current unfinished candle) with per-candle VWAP via a new `GET /api/spx/candles` endpoint. Candles span multiple trading days when needed (e.g. early in the session when today has fewer than 80 candles). This feeds the custom Lightweight Charts candlestick chart in Task 61.

## Background

`fetchTodayRTHCandles("^GSPC")` in `server/src/services/marketData.ts` already fetches today's 5-min RTH candles from Yahoo Finance. Currently it filters out the unfinished candle in `fetchMarketData()` via `isCandleClosed()`. This task exposes **all** candles (including the live one) and computes cumulative VWAP per candle.

SPX uses SPY volume for VWAP (same pattern as `fetchMarketData()` — SPX is a cash index with unreliable synthetic volume).

## Changes

### New function: `server/src/services/marketData.ts`

Add `fetchSpxCandles()` below `fetchSpxDailySnapshot()`:

```typescript
export interface SpxCandle {
  t: string;       // "HH:mm" ET — candle open time
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;       // SPY volume (used for VWAP)
  vwap: number;    // cumulative VWAP up to and including this candle
  open: boolean;   // true = candle is still in progress (not yet closed)
}

export async function fetchSpxCandles(): Promise<SpxCandle[]> {
  // Fetch SPX and SPY candles in parallel — SPY provides volume for VWAP
  const [spxResult, spyResult] = await Promise.all([
    fetchTodayRTHCandles("^GSPC"),
    fetchTodayRTHCandles("SPY"),
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Map SPX candles, substituting SPY volume for VWAP
  const merged = spxResult.candles.map((spx) => {
    const spy = spyResult.candles.find((s) => s.date.getTime() === spx.date.getTime());
    return { ...spx, volume: spy?.volume ?? 0 };
  });

  // Compute cumulative VWAP per candle using running totals
  let cumTPV = 0; // sum of (typical price × volume)
  let cumVol = 0; // sum of volume

  return merged.map((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    const vwap = cumVol > 0 ? r2(cumTPV / cumVol) : r2(c.close);

    return {
      t: formatTimeET(c.date),
      o: r2(c.open),
      h: r2(c.high),
      l: r2(c.low),
      c: r2(c.close),
      v: c.volume,
      vwap,
      open: !isCandleClosed(c.date),
    };
  });
}
```

Key decisions:
- Include the unfinished candle (`open: true`) so the chart shows live price action
- Compute VWAP cumulatively from 09:30 — not just the last value, so each candle has its own VWAP point for the line series
- Reuse `formatTimeET()` and `isCandleClosed()` — both already in scope

### New: `server/src/routes/spxCandles.ts`

```typescript
import { Router } from "express";
import { fetchSpxCandles } from "../services/marketData.js";

const router = Router();

router.get("/spx/candles", async (_req, res) => {
  try {
    const candles = await fetchSpxCandles();
    res.json({ candles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /spx/candles] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
```

### Modify: `server/src/index.ts`

```typescript
import spxCandlesRouter from "./routes/spxCandles.js";
// ...
app.use("/api", spxCandlesRouter);
```

## Response Shape

```json
{
  "candles": [
    { "t": "09:30", "o": 5610.00, "h": 5618.50, "l": 5608.20, "c": 5615.30, "v": 1234567, "vwap": 5613.10, "open": false },
    { "t": "09:35", "o": 5615.30, "h": 5622.00, "l": 5613.00, "c": 5619.80, "v": 987654,  "vwap": 5615.40, "open": false },
    { "t": "10:00", "o": 5618.00, "h": 5620.50, "l": 5616.00, "c": 5619.20, "v": 543210,  "vwap": 5617.80, "open": true  }
  ]
}
```

- Returns empty `candles: []` outside RTH or before market open
- `open: true` only on the last candle when it is still in progress

## Done When

- `GET /api/spx/candles` returns all today's RTH 5-min candles
- Last candle has `open: true` when market is live
- Each candle includes cumulative VWAP
- No TypeScript or build errors (`npm run build`)
