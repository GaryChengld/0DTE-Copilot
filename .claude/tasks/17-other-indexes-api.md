# Task 17 — Other Indexes API ✅ COMPLETED

## Goal

Allow the user to manually feed intraday VIX, $ADD, and $TICK readings for the current market
day via API. Each POST appends one or more time-stamped snapshots for today. The full day's
history is automatically included in the AI analysis payload.

## Changes

### New: Prisma schema `OtherIndexSnapshot` model

Add to `server/prisma/schema.prisma`:

```prisma
model OtherIndexSnapshot {
  id        Int    @id @default(autoincrement())
  tradeDate String // YYYY-MM-DD (ET)
  time      String // HH:MM (ET), e.g. "09:35"
  vix       Float?
  add       Float? // $ADD NYSE breadth
  tick      Float? // $TICK NYSE tick

  @@index([tradeDate])
}
```

Run `npx prisma migrate dev --name add-internal-snapshot`.

### New: `server/src/db/otherIndexesRepository.ts`

```typescript
export async function appendOtherIndexSnapshots(
  tradeDate: string,
  snapshots: Array<{ time: string; vix?: number | null; add?: number | null; tick?: number | null }>
): Promise<void>

export async function getTodayOtherIndexSnapshots(tradeDate: string): Promise<OtherIndexSnapshot[]>
```

- `appendOtherIndexSnapshots`: upserts all provided snapshots for the given `tradeDate` — updates the existing record if `tradeDate` + `time` matches, otherwise inserts
- `getTodayOtherIndexSnapshots`: returns all rows for `tradeDate`, ordered by `time` ascending

### New: `server/src/routes/otherIndexes.ts`

```
POST /api/other_indexes
```

#### POST /api/other_indexes

`time` is optional — if omitted the server records the current ET time automatically.
At least one of `vix`, `add`, `tick` must be provided.

```json
{ "time": "10:15", "vix": 20.1, "add": -680, "tick": -420 }
```

```json
{ "vix": 20.1, "add": -680 }
```

Handler logic:
1. Validate: at least one of `vix`, `add`, `tick` is present; return HTTP 400 otherwise
2. Use `time` from body if provided, otherwise derive current HH:MM from US/Eastern clock
3. Compute today's `tradeDate` as `YYYY-MM-DD` in US/Eastern time
4. Upsert: if a record with the same `tradeDate` + `time` already exists, update it; otherwise insert
5. Return HTTP 201 `{ message: "Snapshot saved", time }`

Error handling: HTTP 400 if validation fails, HTTP 500 on DB error.

### Modify: `server/src/index.ts`

Mount the new router: `app.use("/api", otherIndexesRouter)`

### Modify: `server/src/routes/analysis.ts`

In `buildAnalysisPayload()`, call `getTodayOtherIndexSnapshots(tradeDate)` in parallel with the
existing fetches. Include the result as `other_indexes_history` nested inside `market_data` (omit
the field if the array is empty):

```json
{
  "timestamp": "<ISO8601>",
  "market_data": {
    "spx": { ... },
    "spy": { ... },
    "other_indexes_history": [
      { "time": "09:35", "vix": 18.5, "add": -320, "tick": -280 },
      { "time": "09:40", "vix": 19.2, "add": -450 }
    ]
  },
  "open_positions": [ ... ],
  "market_summary": { ... },
  "user_notes": "..."
}
```

Each entry in `other_indexes_history` omits the `id` and `tradeDate` fields. Fields with a `null`
value are also omitted — only `time` and non-null index values are included.

### Modify: `server/src/services/marketData.ts`

Remove VIX data from the `market_data` payload. Delete the `vix` field from the `MarketData`
interface and remove all VIX fetching logic (`fetchVixData()`, the parallel fetch, and the `vix`
property in the returned object). VIX readings are now supplied manually via `POST /api/other_indexes`.

## Done When

- `POST /api/other_indexes` appends one snapshot to DB, returns HTTP 201 with the recorded `time`
- `POST /api/ai/analyze` and `POST /api/ai/analyze/message` include `other_indexes_history`
  when today's snapshots exist (omitted when empty)
- `market_data` no longer contains a `vix` field
- TypeScript compiles without errors (`npm run build`)
