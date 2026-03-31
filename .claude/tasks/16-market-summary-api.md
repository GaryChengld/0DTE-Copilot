# Task 16 — Market Summary API ✅ COMPLETED

## Goal

Allow the user to save external market context data (GEX levels, options indicators, ADD, etc.)
via API. This data is stored in a new DB table and automatically included in the analysis
payload sent to AI when triggering analysis.

The body always has the shape `{ "content": <string | object> }`. The value of `content`
is extracted and stored in the DB — it can be free text, markdown, or a JSON object.

## Changes

### New: Prisma schema `MarketSummary` model

Add to `server/prisma/schema.prisma`:

```prisma
model MarketSummary {
  id        Int      @id @default(autoincrement())
  timestamp DateTime @default(now())
  data      Json     // stores the value of the "content" field from the request body
}
```

Run `npx prisma migrate dev --name add-market-summary`.

### New: `server/src/db/marketSummaryRepository.ts`

```typescript
export async function createMarketSummary(data: any): Promise<void>
export async function getLatestMarketSummary(): Promise<unknown>
```

- `createMarketSummary`: inserts a new record storing `data` (the extracted `content` value)
- `getLatestMarketSummary`: returns the `data` field of the most recently inserted record, or `null` if none exists

### New: `server/src/routes/marketSummary.ts`

```
POST /api/market-summary
```

Request body always uses the `content` field. The value can be a string or a JSON object:

Free text:
```json
{ "content": "GEX flip 6550, ADD -1850, VIX 31, very bearish" }
```

JSON object:
```json
{
  "content": {
    "gex_flip": 6550,
    "add_nyse": -1850,
    "vix": 31.05,
    "put_wall": 6200,
    "call_wall": 6700,
    "iv_rank": "39%"
  }
}
```

Handler logic:
1. Extract `content` from request body
2. Validate `content` is present and non-empty
3. Call `createMarketSummary(content)` — stores only the value of `content`
4. Return HTTP 201 `{ message: "Market summary saved" }`

Error handling: return HTTP 400 if `content` is missing, HTTP 500 on failure.

### Modify: `server/src/index.ts`

Mount the new router: `app.use("/api", marketSummaryRouter)`

### Modify: `server/src/routes/analysis.ts`

In `buildAnalysisPayload()`, call `getLatestMarketSummary()` in parallel with the existing
fetches, and include the result as `market_summary` in the payload (omit the field if `null`):

```json
{
  "timestamp": "<ISO8601>",
  "market_data": { ... },
  "open_positions": [ ... ],
  "market_summary": { ... },
  "user_notes": "..."
}
```

## Done When

- `POST /api/market-summary` extracts `content` from body, saves it to DB, returns HTTP 201
- `POST /api/ai/analyze` and `POST /api/ai/analyze/message` include `market_summary`
  from the latest saved record (omitted when no record exists)
- TypeScript compiles without errors (`npm run build`)
