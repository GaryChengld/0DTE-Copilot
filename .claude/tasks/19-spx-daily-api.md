# Task 19 — SPX Daily Data API

## Goal

Add a lightweight function in `marketData.ts` that returns SPX daily snapshot data (price, O/H/L, change points, change %) and expose it via a new `GET /api/market-snapshot` endpoint. This provides the frontend with current SPX stats and the latest VIX/ADD/TICK values without the overhead of the full analysis payload.

## Changes

### Modify: `server/src/services/marketData.ts`

Add a new exported interface and function:

```typescript
export interface SpxDailySnapshot {
  price: number;
  o: number;
  h: number;
  l: number;
  change: number;      // price - open (positive = up, negative = down)
  changePct: number;   // change / open * 100, rounded to 2 decimals
}

export async function fetchSpxDailySnapshot(): Promise<SpxDailySnapshot> {
  // Fetch only today's RTH candles for ^GSPC (no daily closes needed — no MAs/RSI)
  const { candles, meta } = await fetchTodayRTHCandles("^GSPC");

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const hasCandles = candles.length > 0;

  const price = r2(meta.regularMarketPrice ?? (hasCandles ? candles[candles.length - 1].close : 0));
  const o = r2(hasCandles ? candles[0].open : (meta.regularMarketOpen ?? 0));
  const h = r2(hasCandles ? Math.max(...candles.map((c) => c.high)) : (meta.regularMarketDayHigh ?? 0));
  const l = r2(hasCandles ? Math.min(...candles.map((c) => c.low)) : (meta.regularMarketDayLow ?? 0));
  const change = r2(price - o);
  const changePct = o !== 0 ? r2((change / o) * 100) : 0;

  return { price, o, h, l, change, changePct };
}
```

This reuses the existing `fetchTodayRTHCandles()` helper — much lighter than `fetchMarketData()` since it skips SPY, daily closes, MAs, RSI, and VWAP.

### New: `server/src/routes/marketSnapshot.ts`

```typescript
import { Router } from "express";
import { fetchSpxDailySnapshot } from "../services/marketData.js";
import { getTodayOtherIndexSnapshots } from "../db/otherIndexesRepository.js";

const router = Router();

function getTradeDateET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

router.get("/market-snapshot", async (_req, res) => {
  try {
    const tradeDate = getTradeDateET();
    const [spx, snapshots] = await Promise.all([
      fetchSpxDailySnapshot(),
      getTodayOtherIndexSnapshots(tradeDate),
    ]);

    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const indexes = {
      vix: latest?.vix ?? null,
      add: latest?.add ?? null,
      tick: latest?.tick ?? null,
    };

    res.json({ spx, indexes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /market-snapshot] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
```

Response shape:
```json
{
  "spx": { "price": 5623.50, "o": 5610.00, "h": 5635.20, "l": 5605.30, "change": 13.50, "changePct": 0.24 },
  "indexes": { "vix": 18.5, "add": -320, "tick": -280 }
}
```

### Modify: `server/src/index.ts`

Register the new route:

```typescript
import marketSnapshotRouter from "./routes/marketSnapshot.js";
// ...
app.use("/api", marketSnapshotRouter);
```

## Done When

- `fetchSpxDailySnapshot()` returns SPX price, O/H/L, change, changePct
- `GET /api/market-snapshot` returns SPX snapshot + latest VIX/ADD/TICK
- No TypeScript or build errors (`npm run build`)
