# Task 24 — Trade History APIs ✅ COMPLETED (2026-04-18)

## Goal

Add two read-only APIs for reviewing historical trade activity:

1. **Monthly PNL** — aggregate daily P&L for a given year+month, one entry per day that has exits
2. **Trades by date** — all trades that were opened **or** partially/fully exited on a given date

## API 1 — Monthly PNL

### Endpoint

```
GET /api/trades/pnl?year=YYYY&month=M
```

### Logic

- Query `TradeExit` where `tradeDate` starts with `"YYYY-MM"` (same prefix trick as `listJournalDates`)
- Group exits by `tradeDate`, sum their `pnl` fields (treat `null` pnl as `0`)
- Return one entry per date that has at least one exit, sorted ascending

### Response shape

```json
{
  "pnl": [
    { "date": "2026-04-14", "pnl": 120.00 },
    { "date": "2026-04-15", "pnl": -85.00 },
    { "date": "2026-04-17", "pnl": 240.00 }
  ]
}
```

- Dates with no exits are omitted (not returned with `pnl: 0`)
- `pnl` is a number (can be negative)

### Validation

- Both `year` and `month` are required integers; `month` must be 1–12
- Return `400` if missing or invalid

---

## API 2 — Trades by Date

### Endpoint

```
GET /api/trades?date=YYYY-MM-DD
```

### Logic

A trade is included if **either** condition is true:

- `trade.tradeDate = date` — the trade was opened on that date
- Any `TradeExit` with `tradeId = trade.id` and `tradeExit.tradeDate = date` — the trade had an exit on that date

Use `OR` at the Prisma level to avoid fetching everything in memory. Include all `exits` in the response (not just exits on that date — return the full trade record with all its exits).

### Response shape

```json
{
  "trades": [
    {
      "id": 5,
      "tradeDate": "2026-04-17",
      "status": "CLOSED",
      "symbol": "SPX",
      "tradeType": "SPREAD",
      "spreadType": "CREDIT",
      "optionType": "PUT",
      "strike": "5510/5500",
      "quantityInitial": 2,
      "quantityRemaining": 0,
      "entryPrice": 1.50,
      "entryTime": "2026-04-17T10:15:00",
      "exits": [
        {
          "id": 3,
          "tradeId": 5,
          "tradeDate": "2026-04-17",
          "exitQuantity": 2,
          "exitPrice": 0.10,
          "exitTime": "2026-04-17T13:45:00",
          "exitReason": "Take Profit",
          "pnl": 280.00
        }
      ]
    }
  ]
}
```

- Returns `{ "trades": [] }` when no trades match
- Results ordered by `trade.id` ascending

### Validation

- `date` is required in `YYYY-MM-DD` format
- Return `400` if missing or invalid

---

## Implementation Plan

### New functions in `server/src/db/tradeRepository.ts`

**`getMonthlyPnl(year, month)`** — returns `{ date: string; pnl: number }[]`

Use `prisma.tradeExit.groupBy` with `_sum` on `pnl`, filtered by `tradeDate` prefix. If `groupBy` is unavailable (SQLite driver limitation), fall back to `findMany` and aggregate in TypeScript.

**`findTradesByDate(date)`** — returns `TradeWithExits[]`

```typescript
prisma.trade.findMany({
  where: {
    OR: [
      { tradeDate: date },
      { exits: { some: { tradeDate: date } } },
    ],
  },
  include: { exits: true },
  orderBy: { id: "asc" },
})
```

### New route handler in `server/src/routes/trades.ts`

Extend the existing trades router — do not create a new file.

- Add `GET /trades/pnl` before any `:id` parameterized routes to prevent route shadowing
- Add `GET /trades` with `date` query parameter

### No schema changes

No Prisma schema changes needed — `TradeExit.tradeDate` already has `@@index([tradeDate])` for efficient lookups.

---

## Done When

- `GET /api/trades/pnl?year=2026&month=4` returns `{ pnl: [...] }` with one entry per day that has exits
- `GET /api/trades?date=2026-04-17` returns all trades opened or exited on that date, each with their full `exits` array
- Both endpoints return `400` for missing/invalid parameters
- No TypeScript or build errors (`npm run build` in `server/`)
