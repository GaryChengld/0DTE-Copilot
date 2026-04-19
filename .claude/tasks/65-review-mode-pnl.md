# Task 65 — Review Mode: Monthly PNL Panel + Trade Details ✅ COMPLETED (2026-04-18)

## Goal

Extend the Review mode left panel with two additions:

1. **Monthly PNL summary** — a panel above the calendar showing total P&L for the displayed month, with per-day breakdown as colored badges
2. **Calendar highlights driven by P&L** — replace journal-based green highlights with P&L-based green/red highlights (positive day = green, negative day = red)
3. **Daily trade details panel** — below the SPX chart, show trades opened or exited on the selected date with their full exit records

---

## New API wrappers — `client/src/api/trades.ts`

Add two new types and two new fetch functions to the existing file:

```typescript
export interface DailyPnl {
  date: string;  // "YYYY-MM-DD"
  pnl: number;
}

export interface TradeWithExits {
  id: number;
  tradeDate: string;
  status: string;
  symbol: string;
  tradeType: string;
  spreadType: string;
  optionType: string | null;
  strike: string | null;
  quantityInitial: number;
  quantityRemaining: number;
  entryPrice: number | null;
  entryTime: string | null;
  exits: TradeExitFull[];
}

export interface TradeExitFull {
  id: number;
  tradeId: number;
  tradeDate: string;
  exitQuantity: number;
  exitPrice: number;
  exitTime: string;
  exitReason: string;
  pnl: number | null;
}

/** GET /api/trades/pnl?year=YYYY&month=M — returns daily P&L entries for the month */
export async function getMonthlyPnl(year: number, month: number): Promise<DailyPnl[]> {
  const res = await fetch(`/api/trades/pnl?year=${year}&month=${month}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.pnl;
}

/** GET /api/trades?date=YYYY-MM-DD — returns trades opened or exited on a date */
export async function getTradesByDate(date: string): Promise<TradeWithExits[]> {
  const res = await fetch(`/api/trades?date=${date}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.trades;
}
```

---

## Changes to `HistoryCalendar.tsx`

Replace `journalDates: Set<string>` prop with `pnlByDate: Map<string, number>` (date → pnl value).

Updated prop interface:
```typescript
interface HistoryCalendarProps {
  selectedDate: string;
  pnlByDate: Map<string, number>;   // replaces journalDates
  onSelectDate: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}
```

Updated cell color logic — replace `hasJournal` with P&L check:
```typescript
const pnl = pnlByDate.get(dateStr);
const hasPnl = pnl !== undefined;
const isProfit = hasPnl && pnl > 0;
const isLoss = hasPnl && pnl < 0;

const bgClass = isProfit
  ? "bg-green-800 text-green-100"
  : isLoss
  ? "bg-red-900 text-red-100"
  : isSelected
  ? "bg-blue-600 text-white"
  : "";

const ringClass = isSelected
  ? "ring-2 ring-blue-400"
  : isToday
  ? "ring-1 ring-white/30"
  : "";
```

---

## Changes to `HistoryPanel.tsx`

### State changes

Replace `journalDates` state with `pnlByDate`:

```typescript
const [pnlByDate, setPnlByDate] = useState<Map<string, number>>(new Map());
const [monthlyTotal, setMonthlyTotal] = useState<number | null>(null);
const [trades, setTrades] = useState<TradeWithExits[]>([]);
```

### Fetch monthly P&L when displayed month changes

Replace the `fetchJournalDates` effect with `getMonthlyPnl`:

```typescript
useEffect(() => {
  getMonthlyPnl(calendarYear, calendarMonth)
    .then((entries) => {
      const map = new Map(entries.map((e) => [e.date, e.pnl]));
      setPnlByDate(map);
      const total = entries.reduce((sum, e) => sum + e.pnl, 0);
      setMonthlyTotal(entries.length > 0 ? total : null);
    })
    .catch(() => {});
}, [calendarYear, calendarMonth]);
```

### Fetch trades when selected date changes

Add `getTradesByDate` to the existing `Promise.all` in the date-change effect:

```typescript
Promise.all([
  fetchSpxCandlesByDate(selectedDate).catch(() => [] as SpxCandle[]),
  fetchAiAdvicesByDate(selectedDate).catch(() => [] as AiAdviceEntry[]),
  fetchJournalByDate(selectedDate).catch(() => null),
  getTradesByDate(selectedDate).catch(() => [] as TradeWithExits[]),
]).then(([c, a, j, t]) => {
  setCandles(c);
  setAdvices(a);
  setJournal(j);
  setTrades(t);
  setDateLoading(false);
});
```

### Pass updated props to HistoryCalendar

```tsx
<HistoryCalendar
  selectedDate={selectedDate}
  pnlByDate={pnlByDate}
  onSelectDate={handleSelectDate}
  onMonthChange={handleMonthChange}
/>
```

---

## New sub-component: `MonthlyPnlPanel`

Render above the calendar inside the left column. Shows the monthly total P&L and a compact list of daily entries.

```tsx
function MonthlyPnlPanel({ total, entries }: { total: number | null; entries: { date: string; pnl: number }[] }) {
  if (total === null) {
    return (
      <p className="text-xs text-center py-2" style={{ color: "var(--text-muted)" }}>
        No trades this month
      </p>
    );
  }

  const isProfit = total >= 0;
  return (
    <div className="flex flex-col gap-1">
      {/* Monthly total */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Monthly P&L
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: isProfit ? "#4ade80" : "#f87171" }}
        >
          {isProfit ? "+" : ""}
          {total.toFixed(2)}
        </span>
      </div>
      {/* Per-day rows */}
      <div className="flex flex-col gap-0.5 max-h-[80px] overflow-y-auto">
        {entries.map((e) => (
          <div key={e.date} className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-muted)" }}>{e.date.slice(5)}</span>
            <span style={{ color: e.pnl >= 0 ? "#4ade80" : "#f87171" }}>
              {e.pnl >= 0 ? "+" : ""}
              {e.pnl.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Place it in the left column, above the calendar container:

```tsx
{/* Monthly PNL summary */}
<div
  className="shrink-0 px-3 py-2 rounded-lg mx-2 mt-2"
  style={{ background: "#1c2333" }}
>
  <MonthlyPnlPanel
    total={monthlyTotal}
    entries={[...pnlByDate.entries()].map(([date, pnl]) => ({ date, pnl })).sort((a, b) => a.date.localeCompare(b.date))}
  />
</div>
```

---

## New sub-component: `DailyTradesPanel`

Add below the SPX chart in the left column. Shows all trades opened or exited on the selected date.

```tsx
function DailyTradesPanel({ trades, loading }: { trades: TradeWithExits[]; loading: boolean }) {
  if (loading) {
    return (
      <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }
  if (trades.length === 0) {
    return (
      <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
        No trades on this date.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {trades.map((trade) => {
        const totalPnl = trade.exits.reduce((sum, e) => sum + (e.pnl ?? 0), 0);
        const hasPnl = trade.exits.some((e) => e.pnl != null);
        return (
          <div
            key={trade.id}
            className="rounded-lg px-3 py-2 flex flex-col gap-1"
            style={{ background: "#1c2333" }}
          >
            {/* Trade header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                {trade.symbol} {trade.optionType} {trade.strike} ×{trade.quantityInitial}
              </span>
              {hasPnl && (
                <span
                  className="text-xs font-semibold"
                  style={{ color: totalPnl >= 0 ? "#4ade80" : "#f87171" }}
                >
                  {totalPnl >= 0 ? "+" : ""}
                  {totalPnl.toFixed(2)}
                </span>
              )}
            </div>
            {/* Entry info */}
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Entry {trade.entryPrice != null ? `$${trade.entryPrice.toFixed(2)}` : "—"}
              {trade.entryTime ? ` @ ${trade.entryTime.slice(11, 16)}` : ""}
              {" · "}
              <span
                className="capitalize"
                style={{ color: trade.status === "CLOSED" ? "var(--text-muted)" : "#60a5fa" }}
              >
                {trade.status.toLowerCase().replace("_", " ")}
              </span>
            </div>
            {/* Exits */}
            {trade.exits.length > 0 && (
              <div className="flex flex-col gap-0.5 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                {trade.exits.map((exit) => (
                  <div key={exit.id} className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>
                      Exit ×{exit.exitQuantity} @ ${exit.exitPrice.toFixed(2)}
                      {" · "}
                      {exit.exitReason}
                    </span>
                    {exit.pnl != null && (
                      <span style={{ color: exit.pnl >= 0 ? "#4ade80" : "#f87171" }}>
                        {exit.pnl >= 0 ? "+" : ""}
                        {exit.pnl.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

Place it in the left column, below the SPX chart, in a scrollable container:

```tsx
{/* Daily trade details */}
<div className="flex-1 overflow-y-auto p-2">
  <p className="text-xs font-medium mb-1 px-1" style={{ color: "var(--text-muted)" }}>
    Trades
  </p>
  <DailyTradesPanel trades={trades} loading={dateLoading} />
</div>
```

The left column layout (top to bottom) becomes:
1. `MonthlyPnlPanel` (shrink-0)
2. Calendar container (shrink-0)
3. SPX chart (h-[40%] shrink-0 — reduce slightly to make room)
4. Daily trades panel (flex-1 overflow-y-auto)

---

## Done When

- Monthly P&L panel appears above the calendar in Review mode, showing month total (green if ≥ 0, red if < 0) and per-day rows
- Calendar date circles are green for profitable days, red for losing days, blue for selected days with no trade (ring-2 for selected)
- Daily trades panel appears below the SPX chart showing trades for the selected date, with each trade's header, entry info, and exit rows
- Switching months fetches fresh P&L data and updates both the monthly panel and calendar highlights
- Selecting a new date fetches trade details for that date
- No TypeScript or build errors (`npm run build` in `client/`)
