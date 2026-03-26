# Task 08 — Get Today's Open Trades API ✅ COMPLETED

## Goal

Implement `GET /api/trades/open` to retrieve all of today's trades that are not yet closed, including their exits.

## Endpoint

**`GET /api/trades/open`**

No request parameters.

## Response

Returns `200` with an array of all open trades:

```json
[
  {
    "id": 1,
    "tradeDate": "2026-03-25",
    "status": "OPEN",
    "symbol": "SPX",
    "tradeType": "SPREAD",
    "spreadType": "CREDIT",
    "optionType": "PUT",
    "strike": "5100/5090",
    "quantity": 5,
    "quantityRemaining": 2,
    "entryPrice": 1.25,
    "entryTime": "2026-03-25T10:15:00-05:00",
    "exits": [
      {
        "id": 1,
        "exitQuantity": 3,
        "exitPrice": 0.30,
        "exitTime": "2026-03-25T13:45:00-05:00",
        "exitReason": "Take Profit",
        "pnl": 285.00
      }
    ]
  }
]
```

Returns `200` with an empty array if no open trades exist for today.

## Server Logic

- Filter: `status != "CLOSED"`
- Include all associated `TradeExit` records for each trade

## File Structure

- **`server/src/routes/trades.ts`** — Add GET route handler (same file as tasks 06 and 07)

## Done When

- `GET /api/trades/open` returns today's non-closed trades with their exits
- Returns empty array `[]` when no open trades exist
- TypeScript compiles without errors (`npm run build`)
