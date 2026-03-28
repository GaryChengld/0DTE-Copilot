# Task 14 — On-Demand AI Analysis API

## Goal

Replace the 5-minute market ingestion cron job with an on-demand `POST /api/ai/analyze` endpoint.
When called, it fetches open trades, sends market data to AI, saves the response, and broadcasts
it via Socket.io.

Remove the cron job, `MarketSnapshot` DB table, and all associated code.


## Changes

### Remove: `server/src/jobs/marketIngestion.ts`

Delete entirely. Remove its import and `startMarketIngestionJob()` call from `server/src/index.ts`.

### Remove: `server/src/db/ingestionRepository.ts` (partial)

Remove `createMarketSnapshot()`, `getTodayMarketSnapshots()`, and all `MarketSnapshot`-related
imports. Keep `createAiAdvice()`, `getLatestAiAdvices()`, `getTodaySessionSummary()`.

### Remove: Prisma schema `MarketSnapshot` model

Delete the `MarketSnapshot` model from `server/prisma/schema.prisma`.
Run `npx prisma migrate dev --name remove-market-snapshot` to drop the table.

### Modify: `server/src/services/marketData.ts`

Change `fetchMarketData()` to fetch **all 5-minute candles from the current market day** (since
9:30 AM ET) and compute the following indicators from those candles.

The returned JSON payload sent to AI must follow this schema:

```json
{
  "market_data": {
    "spx": {
      "candles_5m": [
        { "t": "09:30", "o": 5120.1, "h": 5125.4, "l": 5118.2, "c": 5122.3, "v": 45000000 },
        { "t": "09:35", "o": 5122.3, "h": 5126.1, "l": 5121.0, "c": 5125.8, "v": 38000000 }
      ],
      "daily_stats": {
        "o": 5110.5, "h": 5130.2, "l": 5105.8, "vwap": 5121.5,
        "rsi": 58.4,
        "ma": { "5": 5118.2, "20": 5105.4, "50": 5080.1, "100": 5050.6, "200": 4980.3 }
      }
    },
    "spy": {
      "candles_5m": [
        { "t": "09:30", "o": 511.5, "h": 512.1, "l": 510.9, "c": 511.8, "v": 1250000 }
      ],
      "daily_stats": {
        "o": 510.2, "h": 512.8, "l": 509.4, "vwap": 511.4,
        "rsi": 57.9,
        "ma": { "5": 511.2, "20": 509.8, "50": 505.2, "100": 501.4, "200": 492.1 }
      }
    },
    "vix": {
      "current": 14.5,
      "history_5m": [14.2, 14.3, 14.5]
    }
  }
}
```

**Indicator computation notes:**
- `candles_5m`: all RTH 5-min candles for today (9:30 AM ET onward), ascending by time
- `daily_stats.o/h/l`: derived from all today's 5-min candles (open of first candle, running high/low)
- `daily_stats.vwap`: cumulative VWAP from today's 5-min candles using existing `calculateVwap()`; use SPY volume for SPX
- `daily_stats.rsi`: 14-period RSI from Yahoo Finance daily quote (no manual calculation needed)
- `daily_stats.ma`: daily MAs (5/20/50/100/200) from Yahoo Finance daily candle history (no manual calculation needed); `null` if unavailable
- `vix.history_5m`: list of VIX close values from today's 5-min candles, ascending

### New: `server/src/routes/analysis.ts`

```typescript
POST /api/ai/analyze
```

Handler logic:
1. Call `fetchMarketData()` — get live SPX/SPY/VIX data (existing function)
2. Call `findOpenTrades()` — get active positions
3. Build message payload (same JSON structure currently sent by the job)
4. Call `sendToAI(message)` — send to AI session
5. Call `createAiAdvice({ source: "user", prompt: message, response: aiResponse })` — persist both prompt and response
6. Call `io.emit("chat:response", ...)` — broadcast via Socket.io
7. Return `{ response: aiResponse }` with HTTP 200

Error handling: return HTTP 500 with `{ error: message }` on failure.

### Modify: `server/src/index.ts`

- Remove `startMarketIngestionJob()` import and call
- Mount new analysis router: `app.use("/api", analysisRouter)`
- Pass `io` to the analysis route handler (same pattern as existing routes)

### Modify: `server/src/routes/status.ts`

Remove job status fields from the `GET /api/status` response.

### Update: `server/src/services/snapshotBuilder.ts` (if exists)

If snapshot builder is only used by the job, delete it. Otherwise adapt it to work with
`fetchMarketData()` output for the AI message format.

## Done When

- `POST /api/ai/analyze` returns AI response with HTTP 200
- Response is saved to `AiAdvice` with `source: "job"`
- Socket.io broadcasts `chat:response` event
- No 5-min cron job running at server startup
- `MarketSnapshot` table no longer exists (migration applied)
- TypeScript compiles without errors (`npm run build`)
- `GET /api/status` still works (remove job status fields or mark as N/A)
