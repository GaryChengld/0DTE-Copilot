# Task 69 — Backtest Tab

## Goal

Add a "Backtest" tab to the Review mode right panel. On a selected date, load the cached `ReplayData`, then walk the scan bars in order as a live session would — exits for open positions are checked on each bar, then the rule evaluates entry with the simulated open positions and trade count. Display a per-bar result table and a trade summary.

---

## Architecture

- **Rule service is data-agnostic.** `evaluate()` is called identically for realtime and backtest — it does not know which context it is in. The backtest builds an `EvalContext` per bar from the simulated state.
- **Stateful sequential simulation.** Open positions and `tradesToday` carry across bars. Simulated positions are passed to the rule as `openTrades` (`TradeWithExits`-shaped: `optionType` CALL/PUT, `strike` "short/long", `entryPrice` = credit), so rule-level limits apply exactly as live: three-voter K4 halts while a position is open; sniper raises its threshold / halts at 2 trades and D4 scores only the first trade.
- **Missing VIX.** Null/0 VIX readings are skipped (last valid reading carries forward). A bar with no valid VIX yet is not evaluated and shows `MISSING DATA — no VIX reading` (decision `HALT`). A GO whose estimated credit is $0.00 is recorded but not entered.
- **Simulation logic lives in `server/src/rules/backtest.ts`** — a pure function `runBacktest()` with no Express dependency. The route (`server/src/routes/backtest.ts`) is a thin wrapper that loads replay data, fetches Yahoo Finance context, and delegates to `runBacktest()`.

---

## Data Flow

```
ReplayData (DB cache, keyed by date)
  └─ candles_5m                t = "HH:mm" ET (bar open time), includes per-candle vwap
  └─ other_indexes_history      time = "HH:MM" ET, VIX/ADD/TICK readings
  └─ market_summary             GEX data (gamma_flip, call_wall, put_wall, regime)

Yahoo Finance (fetched once per backtest request)
  └─ VIX daily closes BEFORE date  for O3a VIX MA, IVR and vixChg (the day's own close isn't known intraday)
  └─ prev SPX daily close          for K6 opening gap check (trading day before date)

For each scan bar (in order):
  evalTime = barOpenTime + 5min  (bar close time)
  1. for each open position: check SL1 / TP1 (intrabar) then TP2 / SL2 / FORCED (bar close)
     exit → fill exit fields on the entry bar's trade, remove from open list
  2. no valid VIX yet → record MISSING DATA bar, skip evaluation
  3. ctx = { openTrades: <simulated open positions>, tradesToday, closedCandles, addReadings, vixReadings, ... }
     evalResult = service.evaluate(ctx, config)
     GO with credit > 0 → open a position, tradesToday++, record bar with embedded trade
     otherwise          → record bar
```

---

## File Map

| File | Role |
|---|---|
| `server/src/rules/backtest.ts` | `runBacktest(ruleId, service, config, input)` — pure simulation, no Express |
| `server/src/routes/backtest.ts` | Thin Express wrapper: validate, fetch data, call `runBacktest()`, respond |
| `server/src/rules/types.ts` | `BacktestBarTrade`, `BacktestBarRow`, `BacktestTrade`, `BacktestResponse` |
| `server/src/rules/calculations.ts` | `addFiveMinutes()`, `remainingHoursFromBarTime()`, `computeCurrentSpreadPrice()` |
| `server/src/rules/engine.ts` | `getRuleServiceAndConfig()` used by the route |
| `server/src/services/marketData.ts` | `fetchVixDailyClosesBefore()`, `fetchSpxPrevDayCloseBefore()` (also used by live `POST /api/rules/:id/evaluate`) |
| `server/src/index.ts` | Registers backtest router at `POST /api/backtest/:ruleId` |
| `client/src/api/backtest.ts` | Client types + `runBacktest(ruleId, date)` fetch wrapper |
| `client/src/components/BacktestPanel.tsx` | Dropdown + Run button, bar table, detail panel, trade summary |
| `client/src/components/HistoryPanel.tsx` | Adds `"backtest"` tab, renders `BacktestPanel` |

---

## Key Types

### `BacktestBarTrade` — embedded trade in a GO bar

```typescript
export interface BacktestBarTrade {
  shortStrike:  number
  longStrike:   number
  entryCredit:  number
  exitTime?:    string
  exitPrice?:   number
  exitReason?:  'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
  pnl?:         number
}
```

### `BacktestBarRow` — one row per scan bar

```typescript
export interface BacktestBarRow {
  time:       string    // "HH:MM" ET — bar close time (bar open + 5 min)
  summary:    string    // rule-generated one-liner
  markdown?:  string    // full evaluation markdown (only set when evaluate() was called)
  decision:   'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?: 'bear_call' | 'bull_put'
  trade?:     BacktestBarTrade   // present only when decision === 'GO' and trade entered
}
```

### `BacktestTrade` + `BacktestResponse`

```typescript
export interface BacktestTrade {
  direction:   'bear_call' | 'bull_put'
  entryTime:   string
  shortStrike: number
  longStrike:  number
  entryCredit: number
  exitTime?:   string
  exitPrice?:  number
  exitReason?: string
  pnl?:        number
}

export interface BacktestResponse {
  date:     string
  ruleId:   string
  bars:     BacktestBarRow[]
  trades:   BacktestTrade[]   // flat list of GO bars' trades — same data as bar.trade
  totalPnl: number
}
```

---

## Scan Window & Bar Iteration

Replay candles have `t: "HH:mm"` (bar **open** time in ET). `addFiveMinutes()` converts open → close time. `addFiveMinutes` is exported from `server/src/rules/calculations.ts`.

- **Scan filter:** bars whose close time (`open + 5 min`) falls in `[scanWindowStart, scanWindowEnd]` from the rule config (e.g., three-voter: "10:15"–"15:00", sniper: "10:15"–"15:30").
- **Candle snapshot:** `allCandles.filter(c => c.t.slice(-5) <= barTime)` — all candles whose open time ≤ current bar's open time (= all bars closed by evalTime).
- **Snapshot filter:** `allSnapshots.filter(s => s.time <= evalTime)` — readings up to bar close time.

---

## Algorithm Detail (`server/src/rules/backtest.ts`)

```typescript
let open: OpenPosition[] = []
let tradesToday = 0

for (const bar of scanCandles) {
  const barTime  = bar.t.slice(-5)          // bar open time
  const evalTime = addFiveMinutes(barTime)  // bar close time → currentTimeET

  open = open.filter(pos => !exitIfTriggered(pos, bar))   // checkExit() → fills barTrade + trade

  if (vixReadings.length === 0) { bars.push(MISSING DATA); continue }

  const ctx = { todayCandles: closedCandles, addReadings, tickReadings, vixReadings,
                openTrades: open.map(p => p.asTrade), tradesToday,
                marketSummary, vixDailyCloses, prevSpxClose, currentTimeET: evalTime }

  const evalResult = service.evaluate(ctx, config)
  if (GO && credit > 0) { open.push(position); tradesToday++; bars.push({ ..., trade: barTrade }); trades.push(trade) }
  else bars.push({ ..., decision: evalResult.result })
}
```

---

## Exit Conditions

Checked in priority order on every bar after the entry bar:

| Condition | Trigger | Fill |
|---|---|---|
| SL1 | spread priced at the bar's adverse extreme (high for bear call, low for bull put) `>= entryCredit × sl1Multiplier` | the SL level, or the bar-open price if it gapped through |
| TP1 | spread priced at the bar's favorable extreme `<= entryCredit × tp1Multiplier` | the TP level, or the bar-open price if it gapped through |
| TP2 | `evalTime >= tp2Time AND closePrice <= entryCredit × tp2Multiplier` | bar close price |
| SL2 | ADD reversed for 3 consecutive readings against position direction (only when `addTrendThreshold` defined in config — skipped for sniper) | bar close price |
| FORCED | `evalTime >= scanEnd` (last bar in scan window) | bar close price |

Intrabar (SL1/TP1) prices use the bar **open** time for time-to-close (more time value — conservative for both). If a bar touches both SL1 and TP1, SL1 wins.

`tp2Time` is read from `params.tp2TimeET` (string field, e.g., sniper: "13:45") with `'13:45'` fallback.

---

## UI (`client/src/components/BacktestPanel.tsx`)

- **Bar table:** one row per scan bar — Time, Result (colored by decision), Notes (shows trade details inline for GO rows)
- **Notes column for GO bars:** `"Bear Call 5500/5510 @ $1.20 → TP1 $0.36 (+84.00)"`
- **Row background:** green tint (`#0d2b1a`) for GO rows with a trade
- **Detail panel (right):** click any bar to see `TradeInfo` (entry/exit summary) + full markdown from `evaluate()`
- **Trade summary table:** lists each trade (Type, Entry, Credit, Exit, Price, Reason, PnL); Total PnL at bottom

---

## Verification

1. In Review mode, select a past date with cached ReplayData (visit Replay tab first if needed)
2. Click the "Backtest" tab → dropdown shows available rules
3. Click "Backtest" → bar table appears with one row per scan bar
4. Confirm (three-voter): bars between an entry and its exit show `HALT — K4: Position currently open`; trades never overlap
5. GO bars show full trade inline in Notes column (entry + exit + PnL)
6. Clicking a GO bar shows entry/exit summary and rule markdown in detail panel
7. Trade summary lists one entry per GO signal; Total PnL correct
8. Changing the calendar date clears the result automatically
9. Run for sniper-scoring-v1 — confirm no SL2 exits (no `addTrendThreshold` in sniper config)

---

## Status

Complete. Implemented across commits `2996cc1`–`0c913e4`.
