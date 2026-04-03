# Task 58 — News Panel ✅ COMPLETED

## Goal

Add a **News** tab to the right sidebar, sharing it with Open Positions via a tab switcher at
the top of the panel. The news panel fetches the latest economic headlines from `GET /api/news`
and displays them as a list of clickable links.

## Layout

```
┌─────────────────────────────────┐
│  [ Positions ] [ News ]         │  ← tab bar at top of right sidebar
├─────────────────────────────────┤
│  <active tab content>           │
│                                 │
│  (Positions tab → existing      │
│   OpenPositions + TradeEntryForm│
│   components, unchanged)        │
│                                 │
│  (News tab → NewsPanel)         │
└─────────────────────────────────┘
```

## Changes

### New: `client/src/api/news.ts`

```typescript
export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string; // "MM/DD/YYYY HH:mm ET"
  url: string;
}

export interface NewsResponse {
  timestamp: string;
  news: NewsItem[];
}

export async function getNews(): Promise<NewsResponse> {
  const res = await fetch("/api/news");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### New: `client/src/components/NewsPanel.tsx`

- Accept a `news` prop (`NewsItem[] | null`) and `onRefresh` callback from parent
- Render a refresh icon button (`RefreshCw` from `lucide-react`) in the top-right of the panel header; clicking it calls `onRefresh()`
- Show spinner (`Loader2` from `lucide-react`, animate-spin) while loading; show error message on failure
- Each news item displays:
  - **Title** as a clickable link (`<a href={url} target="_blank" rel="noopener noreferrer">`)
  - Source and datetime on a second line in muted text
- Items separated by a subtle divider
- Use CSS variables (`var(--bg-card)`, `var(--text-muted)`, `var(--border)`) for styling

### Modify: `client/src/App.tsx`

News data is loaded at the app level so it is available immediately when the page opens,
regardless of which sidebar tab is active.

- Add state: `news: NewsItem[] | null = null`, `newsLoading: boolean`, `newsError: string | null`
- Add `loadNews()` function that calls `getNews()` and updates state
- Call `loadNews()` in a `useEffect` on mount (empty dependency array)
- Pass `news`, `newsLoading`, `newsError`, and `onRefresh={loadNews}` down to `<NewsPanel />`

### Modify: `client/src/App.tsx` (sidebar tab bar)

- Add `sidebarTab` state: `"positions" | "news"`, default `"positions"`
- At the top of the right sidebar `<aside>`, render a tab bar:
  ```tsx
  <div className="flex border-b shrink-0" style={{ borderColor: "var(--border)" }}>
    <button onClick={() => setSidebarTab("positions")} ...>Positions</button>
    <button onClick={() => setSidebarTab("news")} ...>News</button>
  </div>
  ```
- Active tab button: white text, bottom border highlight (`border-b-2 border-blue-400`)
- Inactive tab button: muted text, no border
- Below the tab bar, render conditionally:
  - `sidebarTab === "positions"` → `<OpenPositions />` + `<TradeEntryForm />`
  - `sidebarTab === "news"` → `<NewsPanel />`

## Done When

- Right sidebar shows "Positions" and "News" tabs
- Switching tabs shows the correct panel
- News is fetched on page load (not just when switching to the News tab)
- Refresh icon button re-fetches news on click
- Each headline title links to the article URL in a new tab
- No TypeScript errors (`npm run build` from `client/`)
