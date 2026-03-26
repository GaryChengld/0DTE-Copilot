# Task 07 — Exit Position API ✅ COMPLETED

## Goal

Implement `POST /api/trades/exits` to record a full or partial exit against an open trade, backed by the `TradeExit` Prisma model.

## Endpoint

**`POST /api/trades/exits`**

Request body:

```json
{
  "tradeId": 1,
  "exitQuantity": 3,
  "exitPrice": 0.30,
  "exitTime": "2026-03-25T13:45:00-05:00",
  "exitReason": "Take Profit"
}
```

| Field | Required | Notes |
|---|---|---|
| `tradeId` | Yes | Must reference an existing `Trade.id` |
| `exitQuantity` | Yes | Must be ≤ `trade.quantityRemaining` |
| `exitPrice` | Yes | Settlement value of spread; `0.00` for expired worthless |
| `exitTime` | No | Defaults to current time if omitted |
| `exitReason` | Yes | `Take Profit`, `Stop Loss`, or `Expired` |

## Validation

- `404` if no `Trade` record exists for the given `tradeId`
- `400` if `exitQuantity > trade.quantityRemaining`

## Server-computed on create

- `tradeDate` — copied from the parent `Trade` record (denormalized)
- `pnl` — `(entryPrice - exitPrice) × exitQuantity × 100` for `CREDIT`; `(exitPrice - entryPrice) × exitQuantity × 100` for `DEBIT`

## After inserting the exit

- Decrement `trade.quantityRemaining` by `exitQuantity`
- Update `trade.status`:
  - `quantityRemaining > 0` → `"PARTIAL_CLOSED"`
  - `quantityRemaining === 0` → `"CLOSED"`

Returns `201` with the created `TradeExit` record:

```json
{
  "id": 1,
  "tradeId": 1,
  "tradeDate": "2026-03-25",
  "exitQuantity": 3,
  "exitPrice": 0.30,
  "exitTime": "2026-03-25T13:45:00-05:00",
  "exitReason": "Take Profit",
  "pnl": 285.00
}
```

## File Structure

- **`server/src/routes/trades.ts`** — Add exit route handler (same file as task 06)

## Done When

- `POST /api/trades/exits` creates a `TradeExit`, updates `Trade.quantityRemaining` and `Trade.status`, returns `201`
- `404` returned when `tradeId` does not exist in the `Trade` table
- `400` returned when `exitQuantity > quantityRemaining`
- TypeScript compiles without errors (`npm run build`)
