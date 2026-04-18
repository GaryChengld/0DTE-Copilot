# Task 23 — Trading Journal API ✅ COMPLETED (2026-04-17)

## Goal

Add a `Journal` table to store daily trading journal entries in markdown format, and expose four APIs to save, delete, retrieve, and list journal records.

Each journal entry is keyed by **date only** (no time). Saving to an existing date updates the record rather than creating a duplicate.

## Prisma Schema Changes

### `server/prisma/schema.prisma`

Add the `Journal` model:

```prisma
model Journal {
  id        Int      @id @default(autoincrement())
  date      String   @unique  // "YYYY-MM-DD" — one entry per calendar day
  journal   String             // markdown content
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Key decisions:
- `date` is stored as a `String` in `"YYYY-MM-DD"` format (not `DateTime`) to avoid timezone ambiguity — dates are always local trading dates, not UTC timestamps
- `@unique` on `date` enforces the one-entry-per-day rule at the DB level
- `updatedAt` is auto-managed by Prisma so the client never needs to send it

After editing the schema run:
```bash
npx prisma migrate dev --name add-journal
```

## New: `server/src/db/journalRepository.ts`

```typescript
import { prisma } from "./client.js";

export interface JournalEntry {
  id: number;
  date: string;    // "YYYY-MM-DD"
  journal: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Upsert: create if date is new, update if it already exists. */
export async function upsertJournal(date: string, journal: string): Promise<JournalEntry> {
  return prisma.journal.upsert({
    where: { date },
    create: { date, journal },
    update: { journal },
  });
}

/** Delete a journal entry by id. Returns null if not found. */
export async function deleteJournal(id: number): Promise<JournalEntry | null> {
  try {
    return await prisma.journal.delete({ where: { id } });
  } catch {
    return null;
  }
}

/** Retrieve a single journal entry by date ("YYYY-MM-DD"). Returns null if not found. */
export async function getJournalByDate(date: string): Promise<JournalEntry | null> {
  return prisma.journal.findUnique({ where: { date } });
}

/** List all journal dates for a given year + month. Returns dates only, sorted ascending. */
export async function listJournalDates(year: number, month: number): Promise<string[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const rows = await prisma.journal.findMany({
    where: { date: { startsWith: prefix } },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => r.date);
}
```

## New: `server/src/routes/journal.ts`

```typescript
import { Router } from "express";
import {
  upsertJournal,
  deleteJournal,
  getJournalByDate,
  listJournalDates,
} from "../db/journalRepository.js";

const router = Router();

/**
 * PUT /api/journal
 * Body: { date: "YYYY-MM-DD", journal: string }
 * Creates or updates the entry for that date.
 */
router.put("/journal", async (req, res) => {
  const { date, journal } = req.body as { date?: string; journal?: string };
  if (!date || !journal) {
    res.status(400).json({ error: "date and journal are required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    return;
  }
  try {
    const entry = await upsertJournal(date, journal);
    res.json({ journal: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PUT /journal] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/journal/:id
 * Deletes the journal entry with the given id.
 */
router.delete("/journal/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "id must be a number" });
    return;
  }
  try {
    const deleted = await deleteJournal(id);
    if (!deleted) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /journal/:id] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/journal?date=YYYY-MM-DD
 * Retrieves the journal entry for the given date.
 */
router.get("/journal", async (req, res) => {
  const { date } = req.query as { date?: string };
  if (!date) {
    res.status(400).json({ error: "date query parameter is required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    return;
  }
  try {
    const entry = await getJournalByDate(date);
    if (!entry) {
      res.status(404).json({ error: "No journal entry found for this date" });
      return;
    }
    res.json({ journal: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /journal] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/journal/months?year=2026&month=4
 * Lists all dates that have a journal entry in the given year+month.
 */
router.get("/journal/months", async (req, res) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "year and month (1–12) query parameters are required" });
    return;
  }
  try {
    const dates = await listJournalDates(year, month);
    res.json({ dates });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /journal/months] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
```

## Modify: `server/src/index.ts`

```typescript
import journalRouter from "./routes/journal.js";
// ...
app.use("/api", journalRouter);
```

---

## Extend: User AI Advices by Date

Add a `date` query parameter to the existing `GET /api/ai-advices` endpoint. When `date` is supplied, return only records where `source = "user"` and `timestamp` falls within that calendar day (ET midnight → midnight). When `date` is omitted the existing behaviour (latest 20, all sources) is unchanged.

### Modify: `server/src/db/ingestionRepository.ts`

Add `getAiAdvicesByDate()` below the existing functions:

```typescript
/** Return all source="user" AI advices whose timestamp falls on the given date (ET). */
export async function getAiAdvicesByDate(date: string) {
  // Build start/end of day in ET by treating the date string as local midnight
  const start = new Date(`${date}T00:00:00`);
  const end   = new Date(`${date}T23:59:59.999`);
  return prisma.aiAdvice.findMany({
    where: {
      source: "user",
      timestamp: { gte: start, lte: end },
    },
    orderBy: { timestamp: "asc" },
  });
}
```

Key decisions:
- Filter `source = "user"` only — excludes `"job"` and `"session_summary"` records which are internal
- Results sorted ascending so the caller sees the conversation in chronological order
- Date boundaries constructed from the `"YYYY-MM-DD"` string to avoid importing a timezone library; the server already runs in ET context

### Modify: `server/src/routes/chat.ts`

Import the new repository function and extend the existing `GET /api/ai-advices` handler:

```typescript
import { createAiAdvice, getLatestAiAdvices, getAiAdvicesByDate } from '../db/ingestionRepository.js'

// Replace the existing GET /ai-advices handler:
router.get('/ai-advices', async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string };

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    const advices = await getAiAdvicesByDate(date);
    res.json(advices);
    return;
  }

  // Existing behaviour — latest 20, all sources
  const advices = await getLatestAiAdvices(20);
  res.json(advices);
});
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/journal` | Create or update journal entry for a date |
| DELETE | `/api/journal/:id` | Delete journal entry by id |
| GET | `/api/journal?date=YYYY-MM-DD` | Retrieve journal entry for a date |
| GET | `/api/journal/months?year=Y&month=M` | List dates with entries in a given month |
| GET | `/api/ai-advices?date=YYYY-MM-DD` | Retrieve all user chat messages + AI responses for a date |
| GET | `/api/spx/candles?date=YYYY-MM-DD` | SPX RTH 5-min candles for a date + last 10 from previous trading day |

## Request / Response Shapes

### PUT `/api/journal`

Request:
```json
{ "date": "2026-04-17", "journal": "## Today\n\nSPX opened flat..." }
```

Response:
```json
{
  "journal": {
    "id": 1,
    "date": "2026-04-17",
    "journal": "## Today\n\nSPX opened flat...",
    "createdAt": "2026-04-17T14:00:00.000Z",
    "updatedAt": "2026-04-17T15:30:00.000Z"
  }
}
```

### DELETE `/api/journal/:id`

Response:
```json
{ "deleted": { "id": 1, "date": "2026-04-17", ... } }
```

### GET `/api/journal?date=2026-04-17`

Response:
```json
{
  "journal": {
    "id": 1,
    "date": "2026-04-17",
    "journal": "## Today\n\nSPX opened flat...",
    "createdAt": "2026-04-17T14:00:00.000Z",
    "updatedAt": "2026-04-17T15:30:00.000Z"
  }
}
```

### GET `/api/journal/months?year=2026&month=4`

Response:
```json
{ "dates": ["2026-04-14", "2026-04-15", "2026-04-17"] }
```

---

## Extend: SPX Historical Candles by Date

Extend the existing `GET /api/spx/candles` endpoint to accept an optional `date` query parameter (`YYYY-MM-DD`). When `date` is supplied return all RTH 5-min candles for that day **plus the last 10 candles from the previous trading day** prepended (for chart context). When `date` is omitted the existing live behaviour is unchanged.

Previous trading day is resolved automatically from the fetched data — no hardcoded calendar logic needed, so weekends and holidays are handled naturally.

### New function: `server/src/services/marketData.ts`

Add `fetchSpxCandlesByDate()` below `fetchSpxCandles()`. Returns SPX candles only — no SPY fetching.

```typescript
export async function fetchSpxCandlesByDate(date: string): Promise<SpxCandle[]> {
  // Pull a wide window: 7 calendar days before → 1 day after the target date.
  // This guarantees we capture the previous trading day even across weekends.
  const targetDate = new Date(`${date}T00:00:00`);
  const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const period2 = new Date(targetDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const [spxResult, seedCloses] = await Promise.all([
    yahooFinance.chart("^GSPC", { period1, period2, interval: "5m" as const }) as unknown as Promise<YFChartResult>,
    fetchDailyCloses("^GSPC", 60), // seed RSI with enough daily history
  ]);

  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Filter to valid RTH candles only
  const spxAll = ((spxResult.quotes ?? []).filter((q) =>
    q.date != null && q.open != null && q.high != null &&
    q.low != null && q.close != null && q.volume != null &&
    q.volume > 0 && isRTHCandle(q.date)
  ) as RTHCandle[]);

  // Group by ET date
  const byDate = new Map<string, RTHCandle[]>();
  for (const c of spxAll) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(c);
  }

  const targetCandles = byDate.get(date) ?? [];
  const prevDate = [...byDate.keys()].filter((d) => d < date).sort().at(-1);
  const prevCandles = prevDate ? (byDate.get(prevDate) ?? []).slice(-10) : [];

  // Combine: last 10 from previous day + all of target day
  const combined = [...prevCandles, ...targetCandles];

  // Seed RSI with daily closes then append intraday closes
  const intradayCloses = combined.map((c) => c.close);
  const rsiAll = RSI.calculate({ period: 14, values: [...seedCloses, ...intradayCloses] });
  const rsiIntraday = rsiAll.slice(rsiAll.length - intradayCloses.length);

  // VWAP resets at each trading day boundary
  let cumTPV = 0;
  let cumVol = 0;
  let currentDateET = "";

  return combined.map((c, i) => {
    const candleDateET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(c.date);
    if (candleDateET !== currentDateET) {
      cumTPV = 0;
      cumVol = 0;
      currentDateET = candleDateET;
    }
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
    const vwap = cumVol > 0 ? r2(cumTPV / cumVol) : r2(c.close);
    const rsi = rsiIntraday[i] != null ? r2(rsiIntraday[i]) : null;

    return {
      t: formatDateTimeET(c.date),
      o: r2(c.open),
      h: r2(c.high),
      l: r2(c.low),
      c: r2(c.close),
      v: c.volume,
      vwap,
      rsi,
      open: false,
    };
  });
}
```

Key decisions:
- Returns `SpxCandle[]` directly — no SPY fetching; SPX synthetic volume is used as-is for VWAP (acceptable for historical data where precision matters less than simplicity)
- Previous trading day is the latest date key in the grouped map that is strictly before `date` — handles weekends and holidays without any calendar library
- VWAP resets at each day boundary, matching `fetchSpxCandles()` behaviour
- `open: false` always — all historical candles are closed; field kept so the response shape is identical to the live endpoint

### Modify: `server/src/routes/spxCandles.ts`

```typescript
import { Router } from "express";
import { fetchSpxCandles, fetchSpxCandlesByDate } from "../services/marketData.js";

const router = Router();

router.get("/spx/candles", async (req, res) => {
  const { date } = req.query as { date?: string };

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    try {
      const candles = await fetchSpxCandlesByDate(date);
      res.json({ candles });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GET /spx/candles?date] error:", message);
      res.status(500).json({ error: message });
    }
    return;
  }

  // Existing live behaviour — response shape unchanged
  try {
    const candles = await fetchSpxCandles();
    res.json({ candles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /spx/candles] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
```

No changes to `server/src/index.ts` — the router is already registered.

---

## Request / Response Shape — AI Advices by Date

### GET `/api/ai-advices?date=2026-04-17`

Response (chronological, user messages only):
```json
[
  {
    "id": 12,
    "source": "user",
    "prompt": "What do you think about the current SPX setup?",
    "response": "## Analysis\n\nVWAP is holding...",
    "provider": "gemini",
    "timestamp": "2026-04-17T14:05:00.000Z"
  }
]
```

Returns `[]` when no user advices exist for the given date. Returns 400 if `date` is not in `YYYY-MM-DD` format.

---

## Request / Response Shape — SPX Candles by Date

### GET `/api/spx/candles?date=2026-04-17`

Response — same `{ candles }` shape as the live endpoint:
```json
{
  "candles": [
    { "t": "2026-04-16T15:45:00", "o": 5280.00, "h": 5285.50, "l": 5278.00, "c": 5283.10, "v": 1023400, "vwap": 5261.20, "rsi": 54.3, "open": false },
    { "t": "2026-04-16T15:50:00", "o": 5283.10, "h": 5290.00, "l": 5281.00, "c": 5288.40, "v": 987600,  "vwap": 5262.10, "rsi": 56.1, "open": false },
    { "t": "2026-04-16T15:55:00", "o": 5288.40, "h": 5291.00, "l": 5286.00, "c": 5289.00, "v": 1102300, "vwap": 5263.00, "rsi": 56.4, "open": false },
    { "t": "2026-04-17T09:30:00", "o": 5291.00, "h": 5300.00, "l": 5288.00, "c": 5295.50, "v": 2341000, "vwap": 5295.50, "rsi": 57.2, "open": false }
  ]
}
```

- First entries are the last 10 candles from the previous trading day (note the `t` date prefix differs)
- VWAP resets at the trading day boundary
- Returns `{ candles: [] }` if no data is available for the given date

---

## Done When

- `Journal` table exists in SQLite with `date` unique constraint
- `PUT /api/journal` upserts correctly (creates on new date, updates on existing date)
- `DELETE /api/journal/:id` returns 404 when id not found
- `GET /api/journal?date=` returns 404 when no entry exists for that date
- `GET /api/journal/months?year=&month=` returns only dates (no journal content), sorted ascending
- `GET /api/ai-advices?date=YYYY-MM-DD` returns only `source="user"` records for that day, sorted ascending
- `GET /api/ai-advices` (no date) still returns latest 20 across all sources (existing behaviour unchanged)
- `GET /api/spx/candles?date=YYYY-MM-DD` returns `{ candles }` — previous trading day's last 10 candles + all target day candles, with per-day VWAP and RSI
- `GET /api/spx/candles` (no date) still returns live candles (existing behaviour unchanged)
- No TypeScript or build errors (`npm run build`)
