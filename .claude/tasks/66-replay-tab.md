# Task 66 — Replay Tab in Review Mode

## Goal

Add a "Replay" tab to the right panel in Review mode. When selected, it fetches and displays a historical AI analysis payload for the selected calendar date. The payload uses Yahoo Finance historical data for SPX/SPY and the local DB for VIX/ADD/TICK — giving an accurate picture of what the market looked like at the close of that day.

## Payload shape (differences from live `/api/ai/analyze/message`)

| Field | Live | Replay |
|---|---|---|
| `timestamp` | current ET time | `"YYYY-MM-DD 16:00 ET"` |
| `candles_15m` | included | **removed** |
| `candles_5m` | last 6 candles | **all RTH 5-min candles for that date** |
| `news` | included (when Finnhub key set) | **removed** |
| SPX/SPY source | Yahoo Finance (current day) | Yahoo Finance (historical, bounded to date) |
| RSI / MAs | computed from closes through today | computed from closes through selected date |
| VIX/ADD/TICK | today's `OtherIndexSnapshot` rows | DB rows for selected date |
| Positions | open trades + today's closed | all trades for selected date (via `findTradesByDate`) |

---

## Server

### Step 1 — New helpers in `server/src/services/marketData.ts`

**`fetchDailyClosesUpTo(symbol: string, days: number, upToDate: Date): Promise<number[]>`**
- Same as `fetchDailyCloses` but adds `period2: upToDate + 1 day` so RSI/MAs are historically bounded.

**`fetchDailyCandles UpTo(symbol: string, days: number, upToDate: Date): Promise<{high,low,close}[]>`**
- Same pattern as `fetchDailyCandles` but with `period2` bound. Used for ATR.

**`fetchSpxReplayData(date: string): Promise<{ candles_5m: Candle5m[]; daily_stats: DailyStats }>`**
1. Parse `date` as `targetDate = new Date(\`${date}T12:00:00Z\`)` (noon UTC → safe ET date anchor).
2. Fetch in parallel:
   - SPX 5-min: `period1 = date - 1 day`, `period2 = date + 2 days`, `interval = "5m"`. Filter to candles where ET date = target date and `isRTHCandle`.
   - SPY 5-min: same window. Filter same way. Used for VWAP volume.
   - Daily closes: `fetchDailyClosesUpTo("^GSPC", 300, targetDate)` for RSI/MAs.
3. Compute:
   - `candles_5m`: all that day's RTH SPX candles, with SPY volume, formatted as `Candle5m[]`.
   - `daily_stats`: `{ o, h, l, price (= last close), vwap (cumulative for that day using SPX prices + SPY volume), rsi: calcRSI(dailyCloses), ma: { 5, 20, 50, 100, 200 } }`.

**`fetchSpyReplayStats(date: string): Promise<{ daily_stats: DailyStats }>`**
1. Fetch SPY 5-min candles for exactly that date (same period window, filter to date + isRTH).
2. Fetch `fetchDailyClosesUpTo("SPY", 300, targetDate)`.
3. Compute `daily_stats` from SPY candles (VWAP, RSI, MAs).

### Step 2 — New route `server/src/routes/replay.ts`

`GET /api/ai/replay/message?date=YYYY-MM-DD`

```
1. Validate date param (must match /^\d{4}-\d{2}-\d{2}$/).
2. Fetch in parallel:
   - fetchSpxReplayData(date)
   - fetchSpyReplayStats(date)
   - getTodayOtherIndexSnapshots(date)   ← existing fn, takes any tradeDate string
   - findTradesByDate(date)              ← existing fn
3. Build payload:
   {
     timestamp: `${date} 16:00 ET`,
     market_data: {
       spx: { candles_5m, daily_stats },
       spy: { daily_stats },
       ...(otherIndexSnapshots.length > 0 && { other_indexes_history: [...] })
     },
     positions: trades
   }
4. Return res.json(payload).
```

`other_indexes_history` follows the same sparse format as the live payload (null fields omitted per entry).

### Step 3 — Wire up in `server/src/index.ts`

Import and register the replay router:
```typescript
import replayRouter from './routes/replay.js'
app.use('/api', replayRouter)
```

---

## Client

### Step 4 — New API client `client/src/api/replay.ts`

```typescript
export async function getReplayPayload(date: string): Promise<unknown> {
  const res = await fetch(`/api/ai/replay/message?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Step 5 — Update `client/src/components/HistoryPanel.tsx`

**Tab type:** Extend `RightTab` to `"advices" | "journal" | "replay"`.

**`ReplayView` sub-component (add near top of file):**
- Props: `date: string`, `active: boolean`
- Internal state: `payload: string | null`, `loading: boolean`, `error: string | null`, `copied: boolean`
- Fetch logic: call `getReplayPayload(date)` whenever `active` is true AND (`date` changes or `active` just became true). Reset state on new fetch.
- Render:
  - Loading: spinner + "Loading replay payload…"
  - Error: red error text
  - Payload: `<pre>` with formatted JSON + absolute-positioned Copy button (same pattern as `PreviewAnalysisPrompt`)
  - Empty (not yet fetched / tab not active): muted placeholder text

**Tab bar:** Add "Replay" button after "Journal" in the tab map.

**Scroll container:** Add a third `flex-1 overflow-y-auto p-4` div (display hidden when not active) containing `<ReplayView date={selectedDate} active={rightTab === "replay"} />`.

---

## File checklist

| File | Change |
|---|---|
| `server/src/services/marketData.ts` | Add `fetchDailyClosesUpTo`, `fetchDailyCandlesUpTo`, `fetchSpxReplayData`, `fetchSpyReplayStats` |
| `server/src/routes/replay.ts` | New file — `GET /api/ai/replay/message` |
| `server/src/index.ts` | Register replay router |
| `client/src/api/replay.ts` | New file — `getReplayPayload(date)` |
| `client/src/components/HistoryPanel.tsx` | Add `"replay"` tab, `ReplayView` sub-component |

## Build order

1. Server helpers (`marketData.ts`)
2. Server route + wire-up
3. Client API client
4. Client HistoryPanel update
