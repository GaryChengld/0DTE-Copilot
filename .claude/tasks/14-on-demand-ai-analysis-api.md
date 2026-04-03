# Task 14 — On-Demand AI Analysis API ✅ COMPLETED

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
      "candles_15m": [
        { "t": "09:30", "o": 5120.1, "h": 5128.0, "l": 5118.2, "c": 5125.8, "v": 121000000 },
        { "t": "09:45", "o": 5125.8, "h": 5132.4, "l": 5123.1, "c": 5130.2, "v": 98000000 }
      ],
      "candles_5m": [
        { "t": "11:00", "o": 5128.3, "h": 5131.2, "l": 5127.1, "c": 5130.5, "v": 22000000 },
        { "t": "11:05", "o": 5130.5, "h": 5133.0, "l": 5129.2, "c": 5132.1, "v": 19000000 }
      ],
      "daily_stats": {
        "price": 5130.5, "o": 5110.5, "h": 5130.2, "l": 5105.8, "vwap": 5121.5,
        "rsi": 58.4,
        "ma": { "5": 5118.2, "20": 5105.4, "50": 5080.1, "100": 5050.6, "200": 4980.3 }
      }
    },
    "spy": {
      "daily_stats": {
        "price": 512.5, "o": 510.2, "h": 512.8, "l": 509.4, "vwap": 511.4,
        "rsi": 57.9,
        "ma": { "5": 511.2, "20": 509.8, "50": 505.2, "100": 501.4, "200": 492.1 }
      }
    },
    "vix": {
      "current": 14.5,
      "history_5m": [14.2, 14.3, 14.5]
    }
  },
  "news": [
    { "datetime": "04/03/2026 14:30 ET", "title": "Fed signals no rate cuts until inflation falls further" },
    { "datetime": "04/03/2026 14:15 ET", "title": "Treasury yields climb ahead of jobs data" }
  ]
}
```

**Indicator computation notes:**
- `candles_15m`: all **closed** RTH 15-min candles from market open; only complete groups of 3×5m candles where the last 5m candle is closed are included
- `candles_5m`: latest 6 **closed** RTH 5-min candles only (last ~30 minutes of confirmed price action); the current open/partial candle is excluded
- `daily_stats.price`: current market price from `meta.regularMarketPrice` (real-time, not limited to closed candles)
- `daily_stats.o/h/l`: derived from all today's 5-min candles (open of first candle, running high/low)
- `daily_stats.vwap`: cumulative VWAP from today's 5-min candles using existing `calculateVwap()`; use SPY volume for SPX
- `daily_stats.rsi`: 14-period RSI from Yahoo Finance daily quote (no manual calculation needed)
- `daily_stats.ma`: daily MAs (5/20/50/100/200) from Yahoo Finance daily candle history (no manual calculation needed); `null` if unavailable
- `vix.history_5m`: list of VIX close values from today's 5-min candles, ascending
- `news`: latest economic news headlines from Finnhub at the root of the payload (`datetime` = `"MM/DD/YYYY HH:mm ET"` in New York time, `title` only); omitted when `FINNHUB_API_KEY` is not set or fetch fails

### New: `server/src/routes/analysis.ts`

```typescript
POST /api/ai/analyze
```

Request body (optional):
```json
{ "user_notes": "GEX FLIP at 5500, ADD -650, VIX spiking" }
```

Handler logic:
1. Read optional `user_notes` string from request body
2. Call `fetchMarketData()` — get live SPX/SPY/VIX data
3. Call `findOpenTrades()` — get active positions
4. Build message payload including `user_notes` if provided:
   ```json
   {
     "timestamp": "<ISO8601>",
     "market_data": { ... },
     "open_positions": [ ... ],
     "user_notes": "GEX FLIP at 5500, ADD -650, VIX spiking"
   }
   ```
5. Call `sendToAI(message, true)` — send to AI session
6. Call `createAiAdvice({ source: "user", prompt: message, response: aiResponse })` — persist both prompt and response
7. Call `io.emit("chat:response", ...)` — broadcast via Socket.io
8. Return `{ response: aiResponse }` with HTTP 200

Error handling: return HTTP 500 with `{ error: message }` on failure.

### Modify: `server/src/index.ts`

- Remove `startMarketIngestionJob()` import and call
- Remove `initAISession()` call and import — session is now lazy-initialized on first use
- Remove `scheduleDailyReset()` call and import
- Mount new analysis router: `app.use("/api", analysisRouter)`
- Pass `io` to the analysis route handler (same pattern as existing routes)

### Modify: `server/src/services/aiSession.ts`

- Remove `isSessionAvailable()` export — no longer needed
- Remove `scheduleDailyReset()` export — no longer needed
- In `sendToAI()`: if `provider` is `null` (uninitialized), call `initAISession()` before sending
- Add `restart: boolean` parameter to `sendToAI(message, restart)` — if `true`, call `restartAISession()` after sending
- Pass `restart: true` in `POST /api/ai/analyze` (analysis route) — always restart session after analysis
- Pass `restart: false` everywhere else (`POST /api/chat`, Socket.io `chat:message` handler)

### Modify: `server/src/routes/status.ts`

Remove job status fields from the `GET /api/status` response.

### Update: `server/src/services/snapshotBuilder.ts` (if exists)

If snapshot builder is only used by the job, delete it. Otherwise adapt it to work with
`fetchMarketData()` output for the AI message format.

### Modify: `server/src/routes/trades.ts`

Remove `notifyAIWithOpenPositions()` — the function definition and all 3 call sites (open trade,
exit trade, delete trade). AI is no longer notified on trade events; analysis is triggered
on-demand via `POST /api/ai/analyze` instead.

## Done When

- `POST /api/ai/analyze` returns AI response with HTTP 200
- Response is saved to `AiAdvice` with `source: "job"`
- Socket.io broadcasts `chat:response` event
- No 5-min cron job running at server startup
- `MarketSnapshot` table no longer exists (migration applied)
- TypeScript compiles without errors (`npm run build`)
- `GET /api/status` still works (remove job status fields or mark as N/A)
