# Task 69 — Backtest Tab

## Goal

Add a "Backtest" tab to the Review mode right panel. On a selected date, load the cached `ReplayData`, then evaluate every scan bar independently — for each bar X, check the signal, and if GO, scan forward to find the exit. Display a per-bar result table and a trade summary.

---

## Architecture

- **Rule service is data-agnostic.** `evaluate()` is called identically for realtime and backtest — it does not know which context it is in. The backtest builds an `EvalContext` per bar and calls `evaluate()` with a clean slate (no prior trades).
- **Independent per-bar evaluation.** Each bar is evaluated as if the day started fresh (`openTrades: []`, `tradesToday: 0`). On GO, an inner loop scans subsequent bars for the exit. Bar X+1 is then evaluated with the same clean slate.
- **Simulation logic lives in `server/src/rules/backtest.ts`** — a pure function `runBacktest()` with no Express dependency. The route (`server/src/routes/backtest.ts`) is a thin wrapper that loads replay data, fetches Yahoo Finance context, and delegates to `runBacktest()`.

---

## Data Flow

```
ReplayData (DB cache, keyed by date)
  └─ candles_5m                t = "HH:mm" ET (bar open time), includes per-candle vwap
  └─ other_indexes_history      time = "HH:MM" ET, VIX/ADD/TICK readings
  └─ market_summary             GEX data (gamma_flip, call_wall, put_wall, regime)

Yahoo Finance (fetched once per backtest request)
  └─ VIX daily closes up to date   for O3a 20-day MA and vixChg
  └─ prev SPX daily close          for K6 opening gap check

For each scan bar X (outer loop, always advances):
  evalTime = barOpenTime + 5min  (bar close time)
  ctx = { openTrades: [], tradesToday: 0, closedCandles, addReadings, vixReadings, ... }
  evalResult = service.evaluate(ctx, config)

  if GO → inner loop over bars after X:
      for each bar Y:
          compute mark-to-market price at Y close time
          check SL1 / TP1 / TP2 / SL2 / FORCED
          if exit found → record, break
  record bar X with embedded trade (or no trade)
  advance to bar X+1 (clean slate — no state carried over)
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
| `server/src/services/marketData.ts` | `fetchVixDailyClosesUpTo()`, `fetchSpxPrevDayCloseFor()` |
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
for (let i = 0; i < scanCandles.length; i++) {
  const barTime  = scanCandles[i].t.slice(-5)   // bar open time
  const evalTime = addFiveMinutes(barTime)        // bar close time → currentTimeET

  const ctx = { todayCandles: closedCandles, addReadings, tickReadings, vixReadings,
                openTrades: [], tradesToday: 0,   // always clean slate
                marketSummary, vixDailyCloses, prevSpxClose, currentTimeET: evalTime }

  const evalResult = service.evaluate(ctx, config)

  if (evalResult.result === 'GO' && estimatedCredit/shortStrike defined) {
    // ≤ 1 trade per bar: open it, then inner loop finds exit
    let exitTime, exitPrice, exitReason

    for (let j = i + 1; j < scanCandles.length; j++) {
      const evalTimeY  = addFiveMinutes(scanCandles[j].t.slice(-5))
      const price      = computeCurrentSpreadPrice(...)
      check SL1 / TP1 / TP2(tp2Time) / SL2 / FORCED(evalTimeY >= scanEnd)
      if exit found → record exitTime/exitPrice/exitReason, break
    }

    bars.push({ ..., decision: 'GO', trade: { shortStrike, longStrike, entryCredit, exitTime, exitPrice, exitReason, pnl } })
    trades.push({ direction, entryTime: evalTime, shortStrike, ..., exitTime, exitPrice, exitReason, pnl })
  } else {
    bars.push({ ..., decision: evalResult.result })
  }
  // bar X+1 starts fresh — no activePosition state
}
```

---

## Exit Conditions (inner loop)

Checked in priority order at each bar Y after the entry:

| Condition | Trigger |
|---|---|
| SL1 | `currentPrice >= entryCredit × sl1Multiplier` |
| TP1 | `currentPrice <= entryCredit × tp1Multiplier` |
| TP2 | `evalTimeY >= tp2Time AND currentPrice <= entryCredit × tp2Multiplier` |
| SL2 | ADD reversed for 3 consecutive bars against position direction (only when `addTrendThreshold` defined in config — skipped for sniper) |
| FORCED | `evalTimeY >= scanEnd` (last bar in scan window) |

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
4. Confirm: no HALT rows between entry and exit — every bar stands alone
5. GO bars show full trade inline in Notes column (entry + exit + PnL)
6. Clicking a GO bar shows entry/exit summary and rule markdown in detail panel
7. Trade summary lists one entry per GO signal; Total PnL correct
8. Changing the calendar date clears the result automatically
9. Run for sniper-scoring-v1 — confirm no SL2 exits (no `addTrendThreshold` in sniper config)

---

## Status

Complete. Implemented across commits `2996cc1`–`0c913e4`.
