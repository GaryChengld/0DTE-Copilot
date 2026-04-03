# Task 18 — Latest Finance News API

## Goal

Add a `GET /api/news` endpoint that fetches the latest 10 general finance headlines from
Finnhub's free news API. Provides the AI copilot with awareness of macro events happening
during the trading session.

## Changes

### Modify: `server/.env.example`

Add:
```
FINNHUB_API_KEY=your_finnhub_api_key
```

### Modify: `server/src/config.ts`

Add `finnhubApiKey` to the exported config object:
```typescript
finnhubApiKey: process.env.FINNHUB_API_KEY ?? "",
```

### New: `server/src/services/news.ts`

Uses Node.js native `fetch()` (Node 20+, no extra dependency needed).

Exported types and function:
```typescript
export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string; // "MM/DD/YYYY HH:mm ET"
  url: string;
}

export async function fetchLatestNews(limit: number = 10): Promise<NewsItem[]>
```

Implementation notes:
- Fetch `https://finnhub.io/api/v1/news?category=general&token=<finnhubApiKey>`
- Throw if response is not ok
- Sort by `datetime` descending, take first `limit` items
- Map Finnhub fields: `headline` → `title`, `source` → `source`, `url` → `url`
- Format `datetime` (Unix seconds) as New York time string: `"MM/DD/YYYY HH:mm ET"` using `Intl.DateTimeFormat` with `timeZone: "America/New_York"`
- Filter to economic news only using keyword matching on headline (Fed, FOMC, CPI, GDP, inflation, interest rate, jobs, NFP, Treasury, yield, recession, tariff, etc.)

Finnhub response item shape (internal type, not exported):
```typescript
type FinnhubNewsItem = {
  headline: string;
  source: string;
  datetime: number; // Unix seconds
  url: string;
};
```

### New: `server/src/routes/news.ts`

Express router with one endpoint:

```
GET /api/news
```

Handler logic:
1. If `config.finnhubApiKey` is empty, return HTTP 503 `{ error: "News service not configured" }`
2. Call `fetchLatestNews(10)`
3. Return `{ timestamp: <"MM/DD/YYYY HH:mm ET">, news: NewsItem[] }` with HTTP 200
4. On error, return HTTP 500 `{ error: message }`

Response sample:
```json
{
  "timestamp": "04/03/2026 14:35 ET",
  "news": [
    {
      "title": "Fed signals no rate cuts until inflation falls further, Powell says",
      "source": "Reuters",
      "publishedAt": "04/03/2026 14:30 ET",
      "url": "https://www.reuters.com/article/..."
    },
    {
      "title": "S&P 500 futures slip as Treasury yields climb ahead of jobs data",
      "source": "MarketWatch",
      "publishedAt": "04/03/2026 14:15 ET",
      "url": "https://www.marketwatch.com/article/..."
    }
  ]
}
```

### Modify: `server/src/index.ts`

Mount the news router:
```typescript
import newsRouter from "./routes/news.js";
app.use("/api", newsRouter);
```

### Update: `CLAUDE.md`

- Add task 18 to the Completed Tasks table
- Add `GET /api/news` to the API Reference table

## Done When

- `GET /api/news` returns `{ news: [...] }` with 10 items (HTTP 200)
- Returns HTTP 503 `{ error: "News service not configured" }` when `FINNHUB_API_KEY` is not set
- `npm run build` passes with no TypeScript errors
