# Task 67 — ReplayData Cache Table

## Goal

Cache the computed replay payload in SQLite keyed by date so repeat visits to the Replay tab are instant. First request for a date fetches from Yahoo Finance (~2–5s, 7 HTTP calls); subsequent requests return the stored row immediately.

## Schema Change

**File:** `server/prisma/schema.prisma`

```prisma
model ReplayData {
  id         Int      @id @default(autoincrement())
  date       String   @unique  // "YYYY-MM-DD"
  replayData Json              // full replay payload as cached JSON
  createdAt  DateTime @default(now())
}
```

## Migration

**File:** `server/prisma/migrations/20260516000000_add_replay_data/migration.sql`

```sql
-- CreateTable
CREATE TABLE "ReplayData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "replayData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplayData_date_key" ON "ReplayData"("date");
```

Applied via `npx prisma migrate deploy` + `npx prisma generate` (from `server/`).

## New Repository

**File:** `server/src/db/replayDataRepository.ts`

- `getReplayDataByDate(date)` — `findUnique` by date, returns `replayData` JSON or null
- `saveReplayData(date, data)` — upsert by date

## Route Change

**File:** `server/src/routes/replay.ts`

Cache-first pattern added at the top of the handler:
1. `getReplayDataByDate(date)` → if hit, `res.json(cached)` and return
2. On miss: run existing Yahoo Finance + DB fetch logic
3. Build payload (unchanged)
4. `saveReplayData(date, payload)` — fire-and-forget (errors logged, don't affect response)
5. `res.json(payload)`

## Status

Completed 2026-05-16. All files implemented and committed (commit `203301f`).
