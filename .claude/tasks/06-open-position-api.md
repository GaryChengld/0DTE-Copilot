# Task 06 — Open Position API ✅ COMPLETED

## Goal

Implement `POST /api/trades` to open a new trade, backed by the `Trade` Prisma model.

## Endpoint

**`POST /api/trades`**

Request body:

```json
{
  "symbol": "SPX",
  "tradeType": "SPREAD",
  "spreadType": "CREDIT",
  "optionType": "PUT",
  "strike": "5100/5090",
  "quantity": 5,
  "entryPrice": 1.25,
  "entryTime": "2026-03-25T10:15:00-05:00"
}
```

| Field | Required | Notes |
|---|---|---|
| `symbol` | Yes | e.g., `SPX` |
| `tradeType` | Yes | `SPREAD` or `SINGLE` |
| `spreadType` | Yes | `CREDIT` or `DEBIT` |
| `optionType` | Yes | `PUT` or `CALL` |
| `strike` | No | `"5100/5090"` for SPREAD; `"5100"` for SINGLE |
| `quantity` | Yes | Number of contracts |
| `entryPrice` | Yes | Credit received or debit paid per spread |
| `entryTime` | No | Defaults to current time if omitted |

Server-computed on create:
- `tradeDate` — current market date in ET (`YYYY-MM-DD`), derived from `entryTime` if provided, otherwise from current time in ET
- `quantityRemaining` — set to `quantityInitial`
- `status` — `"OPEN"`

Returns `201` with the created `Trade` record:

```json
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
  "quantityRemaining": 5,
  "entryPrice": 1.25,
  "entryTime": "2026-03-25T10:15:00-05:00"
}
```

## File Structure

- **`server/src/routes/trades.ts`** — Route handler
- Register router in `server/src/index.ts` under `/api`

## Done When

- `POST /api/trades` creates a `Trade` record and returns `201`
- TypeScript compiles without errors (`npm run build`)
