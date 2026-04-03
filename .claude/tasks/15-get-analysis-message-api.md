# Task 15 — Get Analysis Message API ✅ COMPLETED

## Goal

Add a new endpoint to the analysis router that generates and returns the analysis message payload
without sending it to AI. Useful for previewing the exact data that would be sent to AI before
triggering a full analysis.

## Endpoint

**`POST /api/ai/analyze/message`**

Request body (optional):
```json
{ "user_notes": "GEX FLIP at 5500, ADD -650, VIX spiking" }
```

## Handler Logic

1. Read optional `user_notes` string from request body
2. Call `fetchMarketData()` — get live SPX/SPY/VIX data
3. Call `findOpenTrades()` — get active positions
4. Build and return the message payload as JSON with HTTP 200:
   ```json
   {
     "timestamp": "2026-03-30 10:15 ET",
     "market_data": { ... },
     "news": [{ "datetime": "04/03/2026 14:30 ET", "title": "..." }],
     "open_positions": [ ... ],
     "user_notes": "GEX FLIP at 5500, ADD -650, VIX spiking"
   }
   ```
   Omit `user_notes` from the payload if not provided.

Error handling: return HTTP 500 with `{ error: message }` on failure.

## Files

- **`server/src/routes/analysis.ts`** — add POST route handler alongside the existing POST /api/ai/analyze

## Done When

- `POST /api/ai/analyze/message` returns the analysis payload as JSON with HTTP 200
- The payload structure matches exactly what `POST /api/ai/analyze` sends to AI
- `user_notes` is included in the payload when provided, omitted when not
- TypeScript compiles without errors (`npm run build`)
