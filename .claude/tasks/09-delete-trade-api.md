# Task 09 — Delete Trade API ✅ COMPLETED

## Goal

Implement `DELETE /api/trades/:id` to delete a trade and all its associated exits, in case the trade was created incorrectly.

## Endpoint

**`DELETE /api/trades/:id`**

`:id` is the trade's database `id`.

No request body.

## Validation

- `404` if no `Trade` record exists for the given `id`

## Server Logic

- Delete all `TradeExit` records associated with the trade first (to satisfy FK constraint)
- Then delete the `Trade` record

## Response

Returns `200` on success:

```json
{
  "message": "Trade 1 and 2 exit(s) deleted"
}
```

Returns `404` if trade not found:

```json
{
  "error": "Trade 1 not found"
}
```

## File Structure

- **`server/src/routes/trades.ts`** — Add DELETE route handler (same file as tasks 06, 07, and 08)

## Done When

- `DELETE /api/trades/:id` deletes the trade and all its exits, returns `200`
- `404` returned when trade not found
- TypeScript compiles without errors (`npm run build`)
