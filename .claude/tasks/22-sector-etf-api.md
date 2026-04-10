# Task 22 — Sector ETF Snapshot API ✅ COMPLETED (2026-04-09)

## Goal

Expose a `GET /api/etf/sectors` endpoint that returns today's price and % change for the 11 S&P 500 sector ETFs. This feeds the ETF heatmap in the Market Data panel (Task 62), replacing the TradingView widget with fresh live data polled every 30 seconds.

## ETFs

| Symbol | Sector |
|--------|--------|
| XLK | Technology |
| XLC | Communication |
| XLY | Cons. Discretionary |
| XLP | Cons. Staples |
| XLV | Health Care |
| XLF | Financials |
| XLI | Industrials |
| XLB | Materials |
| XLRE | Real Estate |
| XLU | Utilities |
| XLE | Energy |

## Changes

### New function: `server/src/services/marketData.ts`

Add `fetchSectorEtfs()` below `fetchSpxCandles()`:

```typescript
export interface SectorEtf {
  symbol: string;   // e.g. "XLK"
  name: string;     // e.g. "Technology"
  price: number;
  change: number;   // absolute change from previous close
  changePct: number; // % change from previous close
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

  const results = await Promise.all(
    SECTOR_ETFS.map(async ({ symbol, name }) => {
      const meta = (await yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 24 * 60 * 60 * 1000),
        interval: "1d" as const,
      })) as unknown as YFChartResult;

      const price = r2(meta.meta.regularMarketPrice ?? 0);
      const prevClose = meta.meta.chartPreviousClose ?? price;
      const change = r2(price - prevClose);
      const changePct = prevClose !== 0 ? r2((change / prevClose) * 100) : 0;

      return { symbol, name, price, change, changePct };
    })
  );

  return results;
}
```

Key decisions:
- Use `yahooFinance.chart()` (same pattern as existing functions) to get `meta.regularMarketPrice` and `meta.chartPreviousClose`
- `Promise.all` fetches all 11 ETFs in parallel — fast enough for 30s polling
- `chartPreviousClose` is the official previous close used for % change calculation (same as `fetchSpxDailySnapshot`)

### New: `server/src/routes/sectorEtfs.ts`

```typescript
import { Router } from "express";
import { fetchSectorEtfs } from "../services/marketData.js";

const router = Router();

router.get("/etf/sectors", async (_req, res) => {
  try {
    const etfs = await fetchSectorEtfs();
    res.json({ etfs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /etf/sectors] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
```

### Modify: `server/src/index.ts`

```typescript
import sectorEtfsRouter from "./routes/sectorEtfs.js";
// ...
app.use("/api", sectorEtfsRouter);
```

## Response Shape

```json
{
  "etfs": [
    { "symbol": "XLK",  "name": "Technology",      "price": 189.42, "change": 2.31,  "changePct": 1.24 },
    { "symbol": "XLC",  "name": "Communication",   "price": 94.10,  "change": -0.87, "changePct": -0.92 },
    { "symbol": "XLY",  "name": "Cons. Discret.",  "price": 172.55, "change": 1.10,  "changePct": 0.64 },
    ...
  ]
}
```

## Done When

- `GET /api/etf/sectors` returns all 11 sector ETFs with live price and % change
- No TypeScript or build errors (`npm run build`)
