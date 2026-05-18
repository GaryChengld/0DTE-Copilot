# Task 69 — Backtest Tab

## Goal

Add a "Backtest" tab to the Review mode right panel. On a selected date, load the cached `ReplayData`, then simulate the rule engine bar by bar from 10:15 ET through 14:00 ET, tracking entries and exits. Display a per-bar vote table and an end-of-day trade summary.

---

## Architecture

- **Rule service is data-agnostic.** `evaluate()` is called identically for realtime and backtest — it does not know which context it is in. The backtest route generates an `EvalContext` snapshot per bar (candles/ADD/VIX up to that bar) and calls `evaluate()` repeatedly until end of scan window.
- **`EvaluationResult` gains a `voterDetail` field** — a short structured result containing T/O/B pass/fail for both directions. Realtime evaluation populates it too; the existing `markdown` field is unchanged. The backtest reads `voterDetail` for the bar table display.
- **`threeVoterV1.evaluate()` is enriched** to compute voters for both directions (Bull Put and Bear Call) and always populate `voterDetail`. The GO/NO-GO markdown and logic are unchanged.
- **New `POST /api/backtest/:ruleId?date=YYYY-MM-DD` route** — loads `ReplayData` from SQLite, fetches VIX history, iterates bars, calls `evaluate()` each iteration, tracks position state with SL/TP exit logic.

---

## Data Flow

```
ReplayData (DB cache, keyed by date)
  └─ candles_5m                t = "HH:mm" ET, includes per-candle vwap
  └─ other_indexes_history      time = "HH:MM" ET, VIX/ADD/TICK readings
  └─ market_summary             GEX data (gamma_flip, call_wall, put_wall, regime)

Yahoo Finance (fetched once per backtest request)
  └─ VIX daily closes up to date   for O3a 20-day MA
  └─ prev SPX daily close          for K6 opening gap

Backtest loop (10:15 → 14:00 ET, one iteration per replay candle):
  buildSnapshot(closedCandles, snapshotsUpToEvalTime) → EvalContext (openTrades: [])
  service.evaluate(ctx, config) → EvaluationResult { result, voterDetail, ... }
  if activePosition → computeCurrentSpreadPrice → check SL1/TP1/TP2/SL2 → exit or hold
  if no position and result === 'GO' → open position
```

---

## File Map

### New / Modified — Server

| File | Action | What changes |
|---|---|---|
| `server/src/rules/types.ts` | Modify | Add `VoterDetail`; add `voterDetail?` to `EvaluationResult`; add `BacktestBarRow`, `BacktestTrade`, `BacktestResponse` |
| `server/src/rules/calculations.ts` | Modify | Export `computeCurrentSpreadPrice()`, `remainingHoursFromBarTime()` |
| `server/src/services/marketData.ts` | Modify | Export `fetchVixDailyClosesUpTo()`, `fetchSpxPrevDayCloseFor()` |
| `server/src/rules/services/threeVoterV1.ts` | Modify | Enrich `evaluate()` to compute both directions and populate `voterDetail` |
| `server/src/rules/engine.ts` | Modify | Export `getRuleServiceAndConfig()` helper |
| `server/src/routes/backtest.ts` | Create | `POST /api/backtest/:ruleId` — bar loop, position tracking, response |
| `server/src/index.ts` | Modify | Register backtest router |

### New / Modified — Client

| File | Action | What changes |
|---|---|---|
| `client/src/api/backtest.ts` | Create | `runBacktest(ruleId, date)` |
| `client/src/components/BacktestPanel.tsx` | Create | Dropdown + button, bar table, trade summary |
| `client/src/components/HistoryPanel.tsx` | Modify | Add `"backtest"` to `RightTab`, render `BacktestPanel` |

---

## Key Types

### `VoterDetail` — short structured result added to `EvaluationResult`

```typescript
export interface VoterDetail {
  bullPut:  { t: boolean; o: boolean; b: boolean }
  bearCall: { t: boolean; o: boolean; b: boolean }
}
```

### Updated `EvaluationResult`

```typescript
export interface EvaluationResult {
  result:           'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:       'bear_call' | 'bull_put'
  addMode?:         string
  shortStrike?:     number
  longStrike?:      number
  estimatedCredit?: number
  markdown:         string
  voterDetail?:     VoterDetail   // ← new: always populated by threeVoterV1
}
```

### `BacktestBarRow` — one row in the response table

```typescript
export interface BacktestBarRow {
  time:          string   // "HH:MM" ET — evaluation time (bar open + 5 min)
  voterDetail?:  VoterDetail
  decision:      'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:    'bear_call' | 'bull_put'
  addMode?:      string
  haltReason?:   string
  hasPosition:   boolean
  isEntry?:      boolean
  isExit?:       boolean
  exitReason?:   'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
  shortStrike?:  number
  longStrike?:   number
  entryCredit?:  number
  currentPrice?: number
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
  trades:   BacktestTrade[]
  totalPnl: number
}
```

---

## Scan Window & Bar Iteration

Replay candles have `t: "HH:mm"` (bar open time in ET). One candle = 5 minutes.

- **Scan candles:** `t >= "10:10"` and `t <= "13:55"` (the "10:10" bar closes at 10:15 — first scan moment).
- **Eval time displayed:** bar open time + 5 min (e.g., "10:10" → "10:15").
- **Candle snapshot:** `allCandles.filter(c => c.t <= barOpenTime)` — candles closed by this bar.
- **ADD/VIX snapshot:** `allSnapshots.filter(s => s.time <= evalTime)` — readings up to eval time.

```typescript
function addFiveMinutes(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total  = h * 60 + m + 5
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
```

---

## Position Tracking Logic (in route — not in rule service)

```
activePosition = null

for each scanCandle:
  evalTime  = barOpenTime + 5min
  ctx       = buildSnapshot(closedCandles, snapshotsUpToEvalTime)
              with openTrades: []   ← K4 never fires; position tracked here

  if activePosition:
    currentPrice = computeCurrentSpreadPrice(spx, dir, shortStrike, longStrike, vix, hoursLeft)
    check:
      SL1: currentPrice >= entryCredit × sl1Multiplier   → exit
      TP1: currentPrice <= entryCredit × tp1Multiplier   → exit
      TP2: evalTime >= "13:45" AND
           currentPrice <= entryCredit × tp2Multiplier   → exit
      SL2: last 3 ADD all oppose position direction      → exit
    emit HALT bar row with currentPrice; on exit → close trade
  else:
    result = service.evaluate(ctx, config)   ← same function as realtime
    if result.result === 'GO' → open position, emit GO bar row
    else                      → emit normal bar row (read voterDetail for display)

if position still open after loop → FORCED exit at last bar price
```

---

## How `threeVoterV1.evaluate()` Is Enriched

The existing `evaluate()` function is modified to:

1. Evaluate T/O/B for **Bull Put** direction in trend-aligned mode (for display).
2. Evaluate T/O/B for **Bear Call** direction in trend-aligned mode (for display).
3. Determine actual ADD mode and direction as before.
4. Run GO/NO-GO with mode-correct B threshold as before.
5. Attach `voterDetail` to the returned `EvaluationResult`.

Using trend-aligned mode for the display columns means: no directional confirmation check is applied to the per-direction voter columns — each direction's T/O/B is evaluated on its own merits. The actual GO uses the proper mode (oscillation/conflict/trend-aligned) as before.

```
tBP = voterT(ctx, 'bull_put',  p)
oBP = voterO(spx, 'bull_put',  'trend-aligned', gex, vix, vixCloses, p)
bBP = voterB('bull_put',  'trend-aligned', addReadings, vixChg, 2, p)

tBC = voterT(ctx, 'bear_call', p)
oBC = voterO(spx, 'bear_call', 'trend-aligned', gex, vix, vixCloses, p)
bBC = voterB('bear_call', 'trend-aligned', addReadings, vixChg, 2, p)

voterDetail = {
  bullPut:  { t: tBP.pass, o: oBP.pass, b: bBP.pass },
  bearCall: { t: tBC.pass, o: oBC.pass, b: bBC.pass },
}

// Then existing GO/NO-GO logic unchanged; append voterDetail to result before returning
```

---

## Task 1: Types & Calculations

**Files:**
- Modify: `server/src/rules/types.ts`
- Modify: `server/src/rules/calculations.ts`

- [ ] **Step 1: Update `server/src/rules/types.ts`**

Add `VoterDetail` before `EvaluationResult`:

```typescript
export interface VoterDetail {
  bullPut:  { t: boolean; o: boolean; b: boolean }
  bearCall: { t: boolean; o: boolean; b: boolean }
}
```

Add `voterDetail?` to `EvaluationResult`:

```typescript
export interface EvaluationResult {
  result:           'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:       'bear_call' | 'bull_put'
  addMode?:         string
  shortStrike?:     number
  longStrike?:      number
  estimatedCredit?: number
  markdown:         string
  voterDetail?:     VoterDetail
}
```

Add after `RuleInfo`:

```typescript
export interface BacktestBarRow {
  time:          string
  voterDetail?:  VoterDetail
  decision:      'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:    'bear_call' | 'bull_put'
  addMode?:      string
  haltReason?:   string
  hasPosition:   boolean
  isEntry?:      boolean
  isExit?:       boolean
  exitReason?:   'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
  shortStrike?:  number
  longStrike?:   number
  entryCredit?:  number
  currentPrice?: number
}

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
  trades:   BacktestTrade[]
  totalPnl: number
}
```

`RuleService` is **unchanged** — no `evaluateBar()` needed.

- [ ] **Step 2: Add helpers to `server/src/rules/calculations.ts`**

Append after `currentEtDate()`:

```typescript
// Hours from a "HH:MM" bar time string until 16:00 ET (clamped to 0).
export function remainingHoursFromBarTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Math.max(0, (16 * 60 - (h * 60 + m)) / 60)
}

// Theoretical price of an existing spread position using Black-Scholes.
// direction/shortStrike/longStrike come from the original entry.
export function computeCurrentSpreadPrice(
  spx: number,
  direction: Direction,
  shortStrike: number,
  longStrike:  number,
  vix: number,
  remainingHours: number,
  r = 0.04
): number {
  const T     = remainingHours / 6.5 / 252
  const sigma = vix / 100
  const price = direction === 'bear_call'
    ? bsCall(spx, shortStrike, T, r, sigma) - bsCall(spx, longStrike, T, r, sigma)
    : bsPut(spx,  shortStrike, T, r, sigma) - bsPut(spx,  longStrike, T, r, sigma)
  return Math.max(0, Math.round(price * 100) / 100)
}
```

`bsCall` and `bsPut` are already defined in the same file (not exported) — `computeCurrentSpreadPrice` calls them directly.

- [ ] **Step 3: Verify TypeScript**

Run from `server/`: `npx tsc --noEmit`
Expected: no errors

---

## Task 2: marketData Exports for Historical Date

**Files:**
- Modify: `server/src/services/marketData.ts`

- [ ] **Step 1: Append two exports after `fetchSpxPrevDayClose`**

```typescript
// Fetch last `days` VIX daily closes up to a specific historical date.
export async function fetchVixDailyClosesUpTo(days: number, upToDate: Date): Promise<number[]> {
  const closes = await fetchDailyClosesUpTo('^VIX', Math.ceil(days * 1.6), upToDate)
  return closes.slice(-days)
}

// Fetch the SPX daily close for the trading day before `date`.
export async function fetchSpxPrevDayCloseFor(date: Date): Promise<number | null> {
  const closes = await fetchDailyClosesUpTo('^GSPC', 5, date)
  // closes includes target date; second-to-last is the prior trading day
  return closes.length >= 2 ? closes[closes.length - 2] : null
}
```

- [ ] **Step 2: Verify TypeScript**

Run from `server/`: `npx tsc --noEmit`

---

## Task 3: Enrich `evaluate()` in threeVoterV1

**Files:**
- Modify: `server/src/rules/services/threeVoterV1.ts`

- [ ] **Step 1: Add `VoterDetail` import and both-direction evaluation inside `evaluate()`**

Add `VoterDetail` to the existing import from `'../types.js'`:

```typescript
import type { RuleService, EvalContext, EvaluationResult, VoterDetail } from '../types.js'
```

Add `remainingHoursFromBarTime` to the existing import from `'../calculations.js'`:

```typescript
import {
  ..., remainingHoursFromBarTime,
} from '../calculations.js'
```

- [ ] **Step 2: Compute both-direction voters inside `evaluate()` and attach `voterDetail`**

In the `evaluate()` function, right after the mode analysis block (after `determineMode(...)` is called and before the O directional confirmation check), insert:

```typescript
  // Compute voter results for both directions in trend-aligned mode (for voterDetail display).
  // trend-aligned mode skips directional confirmation — each direction evaluated independently.
  const tBP = voterT(ctx, 'bull_put',  p)
  const oBP = voterO(spx, 'bull_put',  'trend-aligned', gex, vix, ctx.vixDailyCloses, p)
  const bBP = voterB('bull_put',  'trend-aligned', ctx.addReadings, vixChg, 2, p)
  const tBC = voterT(ctx, 'bear_call', p)
  const oBC = voterO(spx, 'bear_call', 'trend-aligned', gex, vix, ctx.vixDailyCloses, p)
  const bBC = voterB('bear_call', 'trend-aligned', ctx.addReadings, vixChg, 2, p)

  const voterDetail: VoterDetail = {
    bullPut:  { t: tBP.pass, o: oBP.pass, b: bBP.pass },
    bearCall: { t: tBC.pass, o: oBC.pass, b: bBC.pass },
  }
```

Then, everywhere `evaluate()` returns an `EvaluationResult`, add `voterDetail` to the returned object. There are several early-return paths (kill switches, insufficient data, directional mismatch, final GO/WAIT/NO-GO). Add `voterDetail` to each:

Early returns before the voters are computed (HALT from kill switches, insufficient candles) get a zeroed-out detail:

```typescript
// In kill-switch HALT returns (before voterDetail is defined above):
const emptyDetail: VoterDetail = {
  bullPut:  { t: false, o: false, b: false },
  bearCall: { t: false, o: false, b: false },
}
// Return: { ..., voterDetail: emptyDetail }
```

All returns after the voterDetail block add `voterDetail` directly.

The structure looks like this after the change:

```typescript
function evaluate(ctx: EvalContext, config: unknown): EvaluationResult {
  const cfg  = config as ThreeVoterConfig
  const { params: p } = cfg
  const lines: string[] = []
  const time = currentEtTime()

  const emptyDetail: VoterDetail = {
    bullPut:  { t: false, o: false, b: false },
    bearCall: { t: false, o: false, b: false },
  }

  lines.push(`# Three-Voter Evaluation — v1.3 | ${time} ET`)
  lines.push('')

  // ── Kill switches ──
  const killReasons = checkKillSwitches(ctx, cfg)
  const k4Reason    = killReasons.find(r => r.startsWith('K4'))
  const otherKills  = killReasons.filter(r => !r.startsWith('K4'))

  lines.push('## Kill Switches')

  if (otherKills.length > 0) {
    otherKills.forEach(r => lines.push(`- ${bad(r)}`))
    lines.push(''); lines.push('**Status: HALT**')
    return { result: 'HALT', markdown: lines.join('\n'), voterDetail: emptyDetail }
  }

  if (k4Reason) {
    // ... position advisory ...
    return { result: 'HALT', markdown: lines.join('\n'), voterDetail: emptyDetail }
  }

  lines.push('- ' + ok('All clear'))
  lines.push('')

  const candles = ctx.todayCandles
  if (candles.length < 2) {
    lines.push('## Insufficient Data')
    lines.push('Need ≥2 closed candles.')
    return { result: 'WAIT', markdown: lines.join('\n'), voterDetail: emptyDetail }
  }

  const curr   = candles.at(-1)!
  const spx    = curr.c
  const vwap   = curr.vwap
  const t2Dir: Direction = spx < vwap ? 'bear_call' : 'bull_put'
  const add    = ctx.addReadings.at(-1) ?? 0
  const { mode, direction, bThr, label } = determineMode(add, t2Dir, p.addTrendThreshold)
  const vix    = ctx.vixReadings.at(-1) ?? 0
  const vixChg = computeVixChange(vix, ctx.vixDailyCloses.at(-1) ?? 0)
  const gex    = extractGexData(ctx.marketSummary)

  // Both-direction voter evaluation for voterDetail (trend-aligned mode for display)
  const tBP = voterT(ctx, 'bull_put',  p)
  const oBP = voterO(spx, 'bull_put',  'trend-aligned', gex, vix, ctx.vixDailyCloses, p)
  const bBP = voterB('bull_put',  'trend-aligned', ctx.addReadings, vixChg, 2, p)
  const tBC = voterT(ctx, 'bear_call', p)
  const oBC = voterO(spx, 'bear_call', 'trend-aligned', gex, vix, ctx.vixDailyCloses, p)
  const bBC = voterB('bear_call', 'trend-aligned', ctx.addReadings, vixChg, 2, p)
  const voterDetail: VoterDetail = {
    bullPut:  { t: tBP.pass, o: oBP.pass, b: bBP.pass },
    bearCall: { t: tBC.pass, o: oBC.pass, b: bBC.pass },
  }

  // Mode analysis markdown ...
  lines.push('## Mode Analysis')
  // ...

  // O directional confirmation (oscillation/conflict)
  if (mode !== 'trend-aligned' && gex) {
    const dc = direction === 'bear_call' ? spx > gex.gamma_flip : spx < gex.gamma_flip
    if (!dc) {
      // ...
      return { result: 'WAIT', direction, addMode: mode, markdown: lines.join('\n'), voterDetail }
    }
  }

  // Three voters (mode-correct)
  const tResult = voterT(ctx, direction, p)
  const oResult = voterO(spx, direction, mode, gex, vix, ctx.vixDailyCloses, p)
  const bResult = voterB(direction, mode, ctx.addReadings, vixChg, bThr, p)
  // ... markdown lines ...

  // Final decision
  if (votes >= 2 && o3Pass) {
    const hrs = remainingHoursToClose()
    const { shortStrike, longStrike, credit } = computeSpreadCredit(spx, direction, vix, hrs, p.riskFreeRate)
    // ... GO markdown ...
    return { result: 'GO', direction, addMode: mode, shortStrike, longStrike, estimatedCredit: credit, markdown: lines.join('\n'), voterDetail }
  }

  if (votes >= 1) {
    // ... WAIT markdown ...
    return { result: 'WAIT', direction, addMode: mode, markdown: lines.join('\n'), voterDetail }
  }

  // ... NO-GO markdown ...
  return { result: 'NO-GO', direction, addMode: mode, markdown: lines.join('\n'), voterDetail }
}
```

Note: The three voters called for the GO/NO-GO decision (`tResult`, `oResult`, `bResult`) use the mode-correct direction and `bThr`. These may differ from `tBP`/`tBC` etc. because the mode affects B voter behavior. The `voterDetail` uses trend-aligned voters for consistent, direction-independent display. The GO decision uses mode-correct voters for correctness.

- [ ] **Step 3: Verify TypeScript**

Run from `server/`: `npx tsc --noEmit`
Expected: no errors

---

## Task 4: Engine Helper + Route + Registration

**Files:**
- Modify: `server/src/rules/engine.ts`
- Create: `server/src/routes/backtest.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Export `getRuleServiceAndConfig` from `server/src/rules/engine.ts`**

Append after `evaluateRule`:

```typescript
export async function getRuleServiceAndConfig(
  ruleId: string
): Promise<{ service: RuleService; config: unknown }> {
  const entry = loadIndex().find(e => e.id === ruleId)
  if (!entry)         throw new Error(`Unknown rule: ${ruleId}`)
  if (!entry.enabled) throw new Error(`Rule '${ruleId}' is disabled`)
  const loader = SERVICE_REGISTRY[entry.service]
  if (!loader) throw new Error(`No service registered for: ${entry.service}`)
  const service = await loader()
  const config  = JSON.parse(readFileSync(join(CONFIGS, entry.configFile), 'utf-8'))
  return { service, config }
}
```

- [ ] **Step 2: Create `server/src/routes/backtest.ts`**

```typescript
import { Router, Request, Response } from 'express'
import { getRuleServiceAndConfig } from '../rules/engine.js'
import { getReplayDataByDate } from '../db/replayDataRepository.js'
import {
  fetchVixDailyClosesUpTo,
  fetchSpxPrevDayCloseFor,
  type SpxCandle,
} from '../services/marketData.js'
import { computeCurrentSpreadPrice, remainingHoursFromBarTime } from '../rules/calculations.js'
import type {
  EvalContext,
  BacktestBarRow, BacktestTrade, BacktestResponse, VoterDetail,
} from '../rules/types.js'

const router = Router()

interface ReplayCandle {
  t: string; o: number; h: number; l: number; c: number; v: number; vwap?: number
}
interface ReplaySnapshot {
  time: string; vix?: number | null; add?: number | null; tick?: number | null
}
interface ReplayData {
  market_data: {
    spx: { candles_5m: ReplayCandle[] }
    other_indexes_history?: ReplaySnapshot[]
  }
  market_summary?: unknown
}

const emptyVoterDetail: VoterDetail = {
  bullPut:  { t: false, o: false, b: false },
  bearCall: { t: false, o: false, b: false },
}

function addFiveMinutes(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total  = h * 60 + m + 5
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function toSpxCandle(c: ReplayCandle, date: string): SpxCandle {
  return {
    t: `${date}T${c.t}`, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v,
    vwap: c.vwap ?? c.c, rsi: null, open: false,
  }
}

router.post('/backtest/:ruleId', async (req: Request, res: Response) => {
  const ruleId = String(req.params.ruleId)
  const date   = String(req.query.date ?? '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date query param required in YYYY-MM-DD format' })
    return
  }

  try {
    const raw = await getReplayDataByDate(date)
    if (!raw) {
      res.status(404).json({ error: `No replay data cached for ${date}. Open the Replay tab for this date first.` })
      return
    }
    const replay = raw as ReplayData

    const upToDate = new Date(`${date}T20:00:00Z`)
    const [vixDailyCloses, prevSpxClose] = await Promise.all([
      fetchVixDailyClosesUpTo(22, upToDate),
      fetchSpxPrevDayCloseFor(upToDate),
    ])

    const allCandles:   SpxCandle[]      = (replay.market_data.spx.candles_5m ?? []).map(c => toSpxCandle(c, date))
    const allSnapshots: ReplaySnapshot[] = replay.market_data.other_indexes_history ?? []
    const marketSummary                  = replay.market_summary ?? null

    const { service, config } = await getRuleServiceAndConfig(ruleId)
    const params = (config as { params: Record<string, number> }).params

    // Bars covering the scan window: candle open times 10:10–13:55
    const scanCandles = allCandles.filter(c => {
      const t = c.t.slice(-5)
      return t >= '10:10' && t <= '13:55'
    })

    interface ActivePos {
      direction:   'bear_call' | 'bull_put'
      shortStrike: number; longStrike: number; entryCredit: number; entryTime: string
    }
    let activePosition: ActivePos | null = null

    const bars:   BacktestBarRow[] = []
    const trades: BacktestTrade[]  = []

    for (let i = 0; i < scanCandles.length; i++) {
      const barCandle = scanCandles[i]
      const barTime   = barCandle.t.slice(-5)
      const evalTime  = addFiveMinutes(barTime)

      const closedCandles = allCandles.filter(c => c.t.slice(-5) <= barTime)
      const addReadings   = allSnapshots.filter(s => s.time <= evalTime && s.add  != null).map(s => s.add!)
      const vixReadings   = allSnapshots.filter(s => s.time <= evalTime && s.vix  != null).map(s => s.vix!)
      const currentVix    = vixReadings.at(-1) ?? 0
      const currentSpx    = barCandle.c
      const hoursLeft     = remainingHoursFromBarTime(evalTime)

      if (activePosition) {
        const pos          = activePosition
        const currentPrice = computeCurrentSpreadPrice(
          currentSpx, pos.direction, pos.shortStrike, pos.longStrike,
          currentVix, hoursLeft, params.riskFreeRate ?? 0.04
        )
        const last3Add = addReadings.slice(-3)
        const sl2      = last3Add.length >= 3 &&
          last3Add.every(a => pos.direction === 'bull_put' ? a < 0 : a > 0)

        let exitReason: BacktestBarRow['exitReason'] | null = null
        if      (currentPrice >= pos.entryCredit * (params.sl1Multiplier ?? 2.0))    exitReason = 'SL1'
        else if (currentPrice <= pos.entryCredit * (params.tp1Multiplier ?? 0.3))    exitReason = 'TP1'
        else if (evalTime >= '13:45' && currentPrice <= pos.entryCredit * (params.tp2Multiplier ?? 0.5)) exitReason = 'TP2'
        else if (sl2)                                                                  exitReason = 'SL2'

        if (exitReason) {
          const pnl = Math.round((pos.entryCredit - currentPrice) * 100 * 100) / 100
          trades.push({ direction: pos.direction, entryTime: pos.entryTime, shortStrike: pos.shortStrike, longStrike: pos.longStrike, entryCredit: pos.entryCredit, exitTime: evalTime, exitPrice: currentPrice, exitReason, pnl })
          bars.push({ time: evalTime, voterDetail: emptyVoterDetail, decision: 'HALT', hasPosition: true, isExit: true, exitReason, shortStrike: pos.shortStrike, longStrike: pos.longStrike, entryCredit: pos.entryCredit, currentPrice })
          activePosition = null
        } else {
          bars.push({ time: evalTime, voterDetail: emptyVoterDetail, decision: 'HALT', hasPosition: true, shortStrike: pos.shortStrike, longStrike: pos.longStrike, entryCredit: pos.entryCredit, currentPrice })
        }
      } else {
        // ── Same evaluate() call as realtime — rule service is data-agnostic ──
        const ctx: EvalContext = {
          todayCandles: closedCandles, addReadings, vixReadings,
          openTrades: [],   // K4 never fires — position managed by this loop
          marketSummary, vixDailyCloses, prevSpxClose,
        }
        const evalResult = service.evaluate(ctx, config)

        if (evalResult.result === 'GO' && evalResult.estimatedCredit && evalResult.shortStrike) {
          activePosition = {
            direction:   evalResult.direction!,
            shortStrike: evalResult.shortStrike,
            longStrike:  evalResult.longStrike!,
            entryCredit: evalResult.estimatedCredit,
            entryTime:   evalTime,
          }
          bars.push({ time: evalTime, voterDetail: evalResult.voterDetail ?? emptyVoterDetail, decision: 'GO', direction: evalResult.direction, addMode: evalResult.addMode, hasPosition: false, isEntry: true, shortStrike: evalResult.shortStrike, longStrike: evalResult.longStrike, entryCredit: evalResult.estimatedCredit })
        } else {
          bars.push({ time: evalTime, voterDetail: evalResult.voterDetail ?? emptyVoterDetail, decision: evalResult.result, direction: evalResult.direction, addMode: evalResult.addMode, hasPosition: false })
        }
      }
    }

    // Force-close remaining position at end of scan window
    if (activePosition && scanCandles.length > 0) {
      const last     = scanCandles.at(-1)!
      const evalTime = addFiveMinutes(last.t.slice(-5))
      const lastVix  = allSnapshots.filter(s => s.vix != null).at(-1)?.vix ?? 0
      const exitPx   = computeCurrentSpreadPrice(last.c, activePosition.direction, activePosition.shortStrike, activePosition.longStrike, lastVix, remainingHoursFromBarTime(evalTime), params.riskFreeRate ?? 0.04)
      const pnl      = Math.round((activePosition.entryCredit - exitPx) * 100 * 100) / 100
      trades.push({ direction: activePosition.direction, entryTime: activePosition.entryTime, shortStrike: activePosition.shortStrike, longStrike: activePosition.longStrike, entryCredit: activePosition.entryCredit, exitTime: evalTime, exitPrice: exitPx, exitReason: 'FORCED', pnl })
    }

    const totalPnl    = Math.round(trades.reduce((s, t) => s + (t.pnl ?? 0), 0) * 100) / 100
    const response: BacktestResponse = { date, ruleId, bars, trades, totalPnl }
    res.json(response)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[backtest] error for ${ruleId} on ${date}:`, msg)
    res.status(500).json({ error: msg })
  }
})

export default router
```

- [ ] **Step 3: Register in `server/src/index.ts`**

Add import:
```typescript
import backtestRouter from './routes/backtest.js'
```
Add registration after `app.use("/api", replayRouter)`:
```typescript
app.use("/api", backtestRouter)
```

- [ ] **Step 4: Verify and smoke-test**

Run: `npx tsc --noEmit` from `server/`

Start server. POST to an existing cached date:
```
POST http://localhost:3001/api/backtest/three-voter-v1?date=2026-05-15
→ { date, ruleId, bars: [...], trades: [], totalPnl: 0 }
```
Each bar in `bars` has `voterDetail: { bullPut: { t, o, b }, bearCall: { t, o, b } }`.

- [ ] **Step 5: Commit server work**

```bash
git add server/src/rules/types.ts server/src/rules/calculations.ts \
        server/src/rules/services/threeVoterV1.ts server/src/rules/engine.ts \
        server/src/routes/backtest.ts server/src/index.ts \
        server/src/services/marketData.ts
git commit -m "feat: add backtest route; enrich evaluate() with voterDetail for both directions"
```

---

## Task 5: Frontend API + Component + HistoryPanel

**Files:**
- Create: `client/src/api/backtest.ts`
- Create: `client/src/components/BacktestPanel.tsx`
- Modify: `client/src/components/HistoryPanel.tsx`

- [ ] **Step 1: Create `client/src/api/backtest.ts`**

```typescript
export interface BarVoters { t: boolean; o: boolean; b: boolean }
export interface VoterDetail { bullPut: BarVoters; bearCall: BarVoters }

export interface BacktestBarRow {
  time:          string
  voterDetail?:  VoterDetail
  decision:      'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:    string
  addMode?:      string
  hasPosition:   boolean
  isEntry?:      boolean
  isExit?:       boolean
  exitReason?:   string
  shortStrike?:  number
  longStrike?:   number
  entryCredit?:  number
  currentPrice?: number
}

export interface BacktestTrade {
  direction:   string
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
  trades:   BacktestTrade[]
  totalPnl: number
}

export async function runBacktest(ruleId: string, date: string): Promise<BacktestResponse> {
  const res = await fetch(
    `/api/backtest/${encodeURIComponent(ruleId)}?date=${encodeURIComponent(date)}`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

- [ ] **Step 2: Create `client/src/components/BacktestPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { listRules, type RuleInfo } from "../api/rules";
import { runBacktest, type BacktestResponse, type BacktestBarRow, type BacktestTrade, type VoterDetail } from "../api/backtest";

const DECISION_COLOR: Record<string, string> = {
  GO: "#4ade80", "NO-GO": "#f87171", WAIT: "#facc15", HALT: "#6b7280",
};
const EXIT_COLOR: Record<string, string> = {
  TP1: "#4ade80", TP2: "#4ade80", SL1: "#f87171", SL2: "#f87171", FORCED: "#facc15",
};

function V({ v }: { v: boolean }) {
  return <span style={{ color: v ? "#4ade80" : "#4b5563" }}>{v ? "✓" : "✗"}</span>;
}

function VoterCells({ vd }: { vd: VoterDetail }) {
  return (
    <>
      <td className="px-1 py-0.5 text-center"><V v={vd.bullPut.t}  /></td>
      <td className="px-1 py-0.5 text-center"><V v={vd.bullPut.o}  /></td>
      <td className="px-1 py-0.5 text-center"><V v={vd.bullPut.b}  /></td>
      <td className="px-1 py-0.5 text-center"><V v={vd.bearCall.t} /></td>
      <td className="px-1 py-0.5 text-center"><V v={vd.bearCall.o} /></td>
      <td className="px-1 py-0.5 text-center"><V v={vd.bearCall.b} /></td>
    </>
  );
}

function EmptyCells() {
  return <><td colSpan={6} className="px-2 py-0.5 text-center" style={{ color: "#4b5563" }}>—</td></>;
}

function noteText(bar: BacktestBarRow): string {
  if (bar.isExit && bar.currentPrice != null)
    return `Exit $${bar.currentPrice.toFixed(2)} (${bar.exitReason})`
  if (bar.isEntry && bar.shortStrike != null)
    return `Enter ${bar.direction === "bear_call" ? "Bear Call" : "Bull Put"} ${bar.shortStrike}/${bar.longStrike} @ $${bar.entryCredit?.toFixed(2)}`
  if (bar.hasPosition && bar.currentPrice != null)
    return `Holding · $${bar.currentPrice.toFixed(2)}`
  return ""
}

function BarTable({ bars }: { bars: BacktestBarRow[] }) {
  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-2 py-1 text-left" rowSpan={2}>Time</th>
            <th className="px-2 py-1 text-center" colSpan={3}>Bull Put</th>
            <th className="px-2 py-1 text-center" colSpan={3}>Bear Call</th>
            <th className="px-2 py-1 text-left"   rowSpan={2}>Result</th>
            <th className="px-2 py-1 text-left"   rowSpan={2}>Notes</th>
          </tr>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-1 py-0.5">T</th><th className="px-1 py-0.5">O</th><th className="px-1 py-0.5">B</th>
            <th className="px-1 py-0.5">T</th><th className="px-1 py-0.5">O</th><th className="px-1 py-0.5">B</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, i) => {
            const rowBg   = bar.isEntry ? "#0d2b1a" : bar.isExit ? "#2b0d0d" : undefined
            const decColor = bar.isExit
              ? (EXIT_COLOR[bar.exitReason ?? ""] ?? "white")
              : DECISION_COLOR[bar.decision] ?? "var(--text-muted)"
            const showVoters = !bar.hasPosition || bar.isExit
            return (
              <tr key={i} style={{ background: rowBg, borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{bar.time}</td>
                {showVoters && bar.voterDetail
                  ? <VoterCells vd={bar.voterDetail} />
                  : <EmptyCells />
                }
                <td className="px-2 py-0.5 font-medium" style={{ color: decColor }}>
                  {bar.isExit ? `${bar.exitReason}` : bar.decision}
                </td>
                <td className="px-2 py-0.5" style={{ color: "var(--text-muted)" }}>{noteText(bar)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TradeSummary({ trades, totalPnl }: { trades: BacktestTrade[]; totalPnl: number }) {
  if (trades.length === 0) {
    return <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>No trades executed this day.</p>
  }
  return (
    <div className="mt-4">
      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Trade Summary</p>
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Entry</th>
            <th className="px-2 py-1 text-right">Credit</th>
            <th className="px-2 py-1 text-left">Exit</th>
            <th className="px-2 py-1 text-right">Price</th>
            <th className="px-2 py-1 text-left">Reason</th>
            <th className="px-2 py-1 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const pnl = t.pnl ?? 0
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-0.5">{t.direction === "bear_call" ? "Bear Call" : "Bull Put"}</td>
                <td className="px-2 py-0.5 font-mono">{t.entryTime}</td>
                <td className="px-2 py-0.5 text-right">${t.entryCredit.toFixed(2)}</td>
                <td className="px-2 py-0.5 font-mono">{t.exitTime ?? "—"}</td>
                <td className="px-2 py-0.5 text-right">${(t.exitPrice ?? 0).toFixed(2)}</td>
                <td className="px-2 py-0.5" style={{ color: "var(--text-muted)" }}>{t.exitReason}</td>
                <td className="px-2 py-0.5 text-right font-semibold"
                  style={{ color: pnl >= 0 ? "#4ade80" : "#f87171" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-sm font-semibold text-right mt-2"
        style={{ color: totalPnl >= 0 ? "#4ade80" : "#f87171" }}>
        Total PnL: {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
      </p>
    </div>
  )
}

export default function BacktestPanel({ date, active }: { date: string; active: boolean }) {
  const [rules, setRules]       = useState<RuleInfo[]>([])
  const [selected, setSelected] = useState("")
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<BacktestResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const lastDateRef             = useRef<string | null>(null)

  useEffect(() => {
    listRules().then(r => { setRules(r); if (r.length > 0) setSelected(r[0].id) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (lastDateRef.current !== date) { lastDateRef.current = date; setResult(null); setError(null) }
  }, [date])

  async function handleRun() {
    if (!selected || !date) return
    setLoading(true); setResult(null); setError(null)
    try { setResult(await runBacktest(selected, date)) }
    catch (e) { setError(e instanceof Error ? e.message : "Backtest failed") }
    finally { setLoading(false) }
  }

  if (!active && !result && !loading) {
    return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Select the Backtest tab to run a simulation.</p>
  }

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      <div className="flex items-center gap-2 shrink-0">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="flex-1 rounded px-2 py-1 text-xs"
          style={{ background: "#1c2333", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          {rules.length === 0
            ? <option>Loading…</option>
            : rules.map(r => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
        </select>
        <button onClick={handleRun} disabled={loading || !selected}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: "#1d4ed8", color: "white" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? "Running…" : "Backtest"}
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: "#f87171" }}>Error: {error}</p>}
      {loading && (
        <div className="flex items-center gap-2 text-xs py-4" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={12} className="animate-spin" /> Running bar-by-bar simulation…
        </div>
      )}
      {result && (
        <div className="flex-1 overflow-y-auto">
          <BarTable bars={result.bars} />
          <TradeSummary trades={result.trades} totalPnl={result.totalPnl} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add Backtest tab to `client/src/components/HistoryPanel.tsx`**

Change `type RightTab`:
```typescript
type RightTab = "advices" | "journal" | "replay" | "backtest";
```

Add import alongside other component imports:
```typescript
import BacktestPanel from "./BacktestPanel";
```

In the tab bar array, add `"backtest"`:
```typescript
{(["advices", "journal", "replay", "backtest"] as RightTab[]).map((tab) => (
  <button key={tab} onClick={() => setRightTab(tab)} ...>
    {tab === "advices" ? "AI Advice"
      : tab === "journal"  ? "Journal"
      : tab === "replay"   ? "Replay"
      : "Backtest"}
  </button>
))}
```

After the existing Replay scroll container, add:
```tsx
<div
  className="flex-1 overflow-y-auto flex flex-col"
  style={{ display: rightTab === "backtest" ? undefined : "none" }}
>
  <BacktestPanel date={selectedDate} active={rightTab === "backtest"} />
</div>
```

- [ ] **Step 4: Verify TypeScript**

Run from `client/`: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add client/src/api/backtest.ts client/src/components/BacktestPanel.tsx \
        client/src/components/HistoryPanel.tsx
git commit -m "feat: add Backtest tab with bar-by-bar vote table and trade summary"
```

---

## Verification

1. In Review mode, select a past date with cached ReplayData (visit Replay tab first if needed)
2. Click the "Backtest" tab — dropdown shows available rules
3. Click "Backtest" — loading spinner, bar table appears
4. Bar rows from 10:15 to 14:00; when no position: T/O/B columns for both directions visible
5. GO row highlighted green, shows entry direction + strikes + credit; subsequent rows show "Holding · $X.XX"
6. Exit row shows exit price and reason (TP1/TP2/SL1/SL2/FORCED)
7. Trade summary lists all trades; Total PnL shown at bottom
8. Changing the calendar date clears the result automatically

---

## Notes

- **Same `evaluate()` for realtime and backtest.** The rule service receives an `EvalContext` and has no awareness of whether data is live or historical.
- **ReplayData prerequisite.** The backtest reads from the SQLite cache. If no row exists for the date, the user must open the Replay tab first.
- **`voterDetail` in realtime too.** `EvaluationResult.voterDetail` is now always populated by `threeVoterV1`. The RulesPanel ignores it (renders markdown only) but it is available for future use.
- **Spread pricing.** Both entry and exit prices use Black-Scholes estimates — not live options chain data. Treat results as indicative.
- **SL2.** Implemented as: last 3 ADD readings all opposing the position direction (proxy for 15-minute reversal in 5-min bar data).
- **TP3 / SL3.** Not implemented — TP3 requires live Voter O reassessment with manual judgment; SL3 requires historical GEX shift data unavailable from replay.

## Status

Plan complete. Not yet implemented.
