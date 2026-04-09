# Task 20 — News Keywords Table and API ✅ COMPLETED (2026-04-08)

## Goal

Store the news filter keywords in the database instead of hardcoding them in `server/src/services/news.ts`. Expose CRUD APIs so keywords can be retrieved and updated at runtime without restarting the server.

## Background

Currently `ECONOMIC_KEYWORDS` is a hardcoded array in `news.ts`. This task moves keywords to a `NewsKeyword` table in SQLite and replaces the static array with a DB lookup.

## Changes

### Modify: `server/prisma/schema.prisma`

Add a new model:

```prisma
model NewsKeyword {
  id      Int    @id @default(autoincrement())
  keyword String @unique
}
```

After editing: run `npx prisma migrate dev --name add-news-keywords`.

Seed initial keywords by inserting all current `ECONOMIC_KEYWORDS` values in the migration or via a seed step.

### New: `server/src/db/newsKeywordsRepository.ts`

Follow the pattern of `server/src/db/otherIndexesRepository.ts`:

```typescript
import prisma from "./client.js";

export async function getAllKeywords(): Promise<string[]> {
  const rows = await prisma.newsKeyword.findMany({ orderBy: { keyword: "asc" } });
  return rows.map((r) => r.keyword);
}

export async function saveKeywords(keywords: string[]): Promise<void> {
  // Replace all: delete existing, insert new list
  await prisma.$transaction([
    prisma.newsKeyword.deleteMany(),
    prisma.newsKeyword.createMany({
      data: keywords.map((keyword) => ({ keyword })),
    }),
  ]);
}
```

### Modify: `server/src/services/news.ts`

- Remove the `ECONOMIC_KEYWORDS` constant and `isEconomicNews()` function
- Import `getAllKeywords` from `../db/newsKeywordsRepository.js`
- In `fetchLatestNews()`, fetch keywords from DB at call time:

```typescript
export async function fetchLatestNews(limit: number = 10): Promise<NewsItem[]> {
  const keywords = await getAllKeywords();
  const isEconomicNews = (headline: string) => {
    const lower = headline.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  };

  const url = `https://finnhub.io/api/v1/news?category=general&token=${config.finnhubApiKey}`;
  // ... rest unchanged
}
```

### New: `server/src/routes/newsKeywords.ts`

```typescript
import { Router } from "express";
import { getAllKeywords, saveKeywords } from "../db/newsKeywordsRepository.js";

const router = Router();

// GET /api/news/keywords — return all keywords as array
router.get("/news/keywords", async (_req, res) => {
  try {
    const keywords = await getAllKeywords();
    res.json({ keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// PUT /api/news/keywords — replace entire keyword list
// Body: { keywords: string[] }
router.put("/news/keywords", async (req, res) => {
  const { keywords } = req.body ?? {};
  if (!Array.isArray(keywords) || keywords.some((k) => typeof k !== "string")) {
    res.status(400).json({ error: "keywords must be an array of strings" });
    return;
  }
  try {
    const trimmed = [...new Set(keywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean))];
    await saveKeywords(trimmed);
    res.json({ keywords: trimmed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
```

### Modify: `server/src/index.ts`

Register the new route:

```typescript
import newsKeywordsRouter from "./routes/newsKeywords.js";
// ...
app.use("/api", newsKeywordsRouter);
```

## Seed Data

The initial keyword list to insert into `NewsKeyword` table (from current `ECONOMIC_KEYWORDS`):

```
fed, federal reserve, fomc, powell, rate cut, rate hike, interest rate,
cpi, inflation, gdp, jobs, nonfarm, nfp, unemployment, payroll,
treasury, yield, recession, economic, economy, fiscal, monetary,
debt ceiling, tariff, trade war, stimulus, quantitative, war,
ceasefire, sanction, iran, china, russia, trump, opec, oil price,
geopolit, congress, senate, white house, executive order
```

Seed via a Prisma migration script or a one-time seed file (`prisma/seed.ts`).

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news/keywords` | Return all keywords as `{ keywords: string[] }` |
| PUT | `/api/news/keywords` | Replace keyword list with `{ keywords: string[] }` |

## Done When

- `NewsKeyword` table exists in SQLite with all initial keywords seeded
- `GET /api/news/keywords` returns the keyword list
- `PUT /api/news/keywords` replaces the list and returns the saved result
- `fetchLatestNews()` filters using keywords from DB (not hardcoded)
- No TypeScript or build errors (`npm run build`)
