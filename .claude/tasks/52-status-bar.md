# Task 52 — Status Bar ✅ COMPLETED (2026-03-30)

## Goal

Implement the top status bar showing server health, AI session state, current ET time,
and market hours indicator. A `☰` menu button opens a dropdown with app-level actions.

## Changes

### New: `client/src/hooks/useStatus.ts`

Polls `GET /api/status` every 30 seconds:

```typescript
export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    const fetch = () =>
      api.get("/api/status").then(setStatus).catch(() => setStatus(null));
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
```

`StatusResponse` shape (from server):
```typescript
interface StatusResponse {
  status: "ok" | "degraded";
  uptime: number;
  db: "ok" | "error";
  latencyMs: number;
  ai: {
    status: "uninitialized" | "ok" | "error";
    provider: string;
    lastMessageAt: string | null;
    lastError: string | null;
  };
}
```

### New: `client/src/api/session.ts`

```typescript
export async function restartSession(): Promise<void> {
  await fetch("/api/ai-session/restart", { method: "POST" });
}
```

### New: `client/src/components/AppMenu.tsx`

A dropdown menu anchored to the `☰` button in the status bar. Items:

- **Restart AI Session** — calls `restartSession()`, shows brief "Restarting…" inline state
- **Market Summary** — opens the `MarketSummaryModal` (Task 56)

Behavior:
- Clicking `☰` toggles the dropdown open/closed
- Clicking outside closes it (use a `useEffect` with a document click listener)
- While restart is in progress, the menu item shows "Restarting…" and is disabled

### New: `client/src/components/StatusBar.tsx`

Layout: `☰` menu + title on the left; statuses + indexes toggle on the right.

Right side, left to right:
- **Health dot**: green (`status === "ok"`), yellow (`degraded`), red (fetch failed / null)
- **AI badge**: `uninitialized | ok | error` + provider name (e.g. `gemini`)
- **ET clock**: updates every second via `setInterval`; format `HH:MM ET`
- **Market hours badge**: `RTH` (green) / `Pre-Market` (yellow) / `Closed` (gray)
  - RTH = Mon–Fri 09:30–16:00 ET
- **Indexes toggle button** (far right): `PanelRightOpen` icon when panel is closed, `PanelRightClose` when open
  - Clicking toggles the `OtherIndexesPanel` (Task 57)
  - `indexesOpen: boolean` and `onToggleIndexes: () => void` received as props from `App`

Market hours logic (client-side, mirrors `server/src/utils/marketHours.ts`):
```typescript
function getMarketStatus(): "RTH" | "Pre-Market" | "Closed" {
  const now = new Date();
  const parts = Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "numeric", weekday: "short", hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value ?? "";
  if (["Sat", "Sun"].includes(weekday)) return "Closed";
  const h = parseInt(parts.find(p => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0");
  const total = h * 60 + m;
  if (total >= 570 && total < 960) return "RTH";      // 09:30–16:00
  return "Pre-Market";
}
```

## Done When

- Status bar renders in the top strip of the layout
- Health dot, AI state, ET clock, market hours badge all display correctly
- Clock ticks every second
- `☰` menu opens a dropdown with "Restart AI Session" and "Market Summary" items
- Restart AI Session calls the API and shows a brief "Restarting…" state in the menu item
- Clicking outside the menu closes it
- Indexes toggle button shows `PanelRightOpen` / `PanelRightClose` icon based on panel state
