# Task 68 — Trading Rules Engine

## Goal

Implement a factory-pattern trading rules engine. A `rules_index.json` registry maps rule IDs to named service modules + config files, with enable/disable support. All rule services share a common `RuleService` interface (same input/output), making adding new rules trivial. First rule: Three-Voter 0DTE credit spread entry system (spec: `server/specs/rules/three-voter-rules-v1.md`). Frontend: new "Rules" tab in Trading mode.

---

## Architecture

```
rules_index.json          ← master registry (id, name, service, configFile, enabled)
  └─ engine.ts            ← factory: reads index, lazy-loads service, calls evaluate()
       ├─ services/threeVoterV1.ts   ← implements RuleService
       ├─ calculations.ts            ← shared pure math utilities
       └─ types.ts                   ← EvalContext, EvaluationResult, RuleService interface
```

**Adding a new rule** requires only: (1) new `<rule>.json` config, (2) new entry in `rules_index.json`, (3) new service file implementing `RuleService`, (4) one line in `SERVICE_REGISTRY` in `engine.ts`.

---

## Data Sources

| Data | Source |
|---|---|
| SPX 5-min OHLCV + VWAP | `fetchSpxCandles()` — filter today + closed candles |
| VIX / ADD / TICK | `getTodayOtherIndexSnapshots()` → `OtherIndexSnapshot` table |
| GEX data | `getLatestMarketSummary()` → `MarketSummary` table, parse `gex_data` field |
| Open positions | `findOpenTrades()` → `Trade` table |
| VIX 20-day history | New: `fetchVixDailyCloses(22)` added to `marketData.ts` |
| Previous SPX close | New: `fetchSpxPrevDayClose()` added to `marketData.ts` |

---

## Three-Voter Rule Overview

Layer 1 — Kill Switches (K1–K2, K4–K6): VIX > 35, VIX spike > 4pt, position open, outside 10:15–14:00, opening gap > 0.5%. K3 (macro event) is omitted — user avoids evaluating on macro days manually.

Layer 2 — ADD Mode: determines direction (Bear Call / Bull Put) and B-threshold (2/3 or 3/3) based on ADD value vs. VWAP position.

Layer 3 — Three Voters:
- **T** (Technical): RSI(5) pullback + VWAP alignment + candle shadow
- **O** (Options): gamma flip distance + GEX wall support + IV environment (O3 mandatory)
- **B** (Breadth): ADD direction + ADD stability + VIX stability

Layer 4 — Decision: ≥2 voters pass AND O3 passes → GO; 1 voter → WAIT; 0 → NO-GO

When K4 active (position open): HALT + advisory for SL2 (ADD reversal), TP2 (time target), TP3 (Voter O reversal).

---

## File Map

### New Files — Server

| File | Purpose |
|---|---|
| `server/src/rules/types.ts` | `RuleService`, `EvalContext`, `EvaluationResult`, `RuleInfo` |
| `server/src/rules/calculations.ts` | computeRsi5, shadows, gap, VIX change/20MA, strike, Black-Scholes, extractGexData |
| `server/src/rules/services/threeVoterV1.ts` | Three-voter rule implementing `RuleService` |
| `server/src/rules/engine.ts` | Factory: reads `rules_index.json`, lazy-loads service |
| `server/src/routes/rules.ts` | GET /api/rules, POST /api/rules/:id/evaluate |
| `server/configs/rules/rules_index.json` | Master registry |
| `server/configs/rules/three-voter-v1.json` | Three-voter params |

### Modified Files — Server

| File | Change |
|---|---|
| `server/src/services/marketData.ts` | Export `fetchVixDailyCloses(days)`, `fetchSpxPrevDayClose()` |
| `server/src/index.ts` | Register rules router |

### New Files — Client

| File | Purpose |
|---|---|
| `client/src/api/rules.ts` | `listRules()`, `evaluateRule(id)` |
| `client/src/components/RulesPanel.tsx` | Dropdown + Evaluate button + ReactMarkdown result |

### Modified Files — Client

| File | Change |
|---|---|
| `client/src/App.tsx` | Add "rules" tab type, render RulesPanel, hide ChatInputBar on rules tab |

---

## Key Interfaces

```typescript
// types.ts
interface EvalContext {
  todayCandles:   SpxCandle[]      // closed 5-min candles for today only
  addReadings:    number[]         // all today's non-null ADD values, ascending
  vixReadings:    number[]         // all today's non-null VIX values, ascending
  openTrades:     TradeWithExits[]
  marketSummary:  unknown          // MarketSummary.data — may contain gex_data
  vixDailyCloses: number[]         // last 22 daily VIX closes (oldest→newest)
  prevSpxClose:   number | null
}

interface EvaluationResult {
  result:           'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:       'bear_call' | 'bull_put'
  addMode?:         string
  shortStrike?:     number
  longStrike?:      number
  estimatedCredit?: number
  markdown:         string          // full formatted markdown report
}

interface RuleService {
  evaluate(ctx: EvalContext, config: unknown): EvaluationResult
}
```

---

## Config File Payloads

### `server/configs/rules/rules_index.json`

The master registry. Each entry maps a rule ID to its service module, config file, and enable flag. The frontend dropdown and `/api/rules` list auto-populate from this file.

```json
[
  {
    "id": "three-voter-v1",
    "name": "Three-Voter Credit Spread System",
    "version": "1.3",
    "description": "0DTE SPX credit spread entry signals using Technical, Options, and Breadth voters",
    "configFile": "three-voter-v1.json",
    "service": "threeVoterV1",
    "enabled": true
  }
]
```

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Unique rule identifier — used in `/api/rules/:id/evaluate` |
| `name` | string | Display name shown in the frontend dropdown |
| `version` | string | Display version shown alongside the name |
| `description` | string | Short description |
| `configFile` | string | Filename in `server/configs/rules/` containing rule parameters |
| `service` | string | Key in `SERVICE_REGISTRY` in `engine.ts` — maps to the service module |
| `enabled` | boolean | `false` hides the rule from the list and blocks evaluation |

---

### `server/configs/rules/three-voter-v1.json`

Parameters for the Three-Voter rule. All numeric thresholds match the spec (`server/specs/rules/three-voter-rules-v1.md`).

```json
{
  "scanWindowStart": "10:15",
  "scanWindowEnd": "14:00",
  "params": {
    "rsiOverbought": 70,
    "rsiOverboughtConfirm": 65,
    "rsiOversold": 30,
    "rsiOversoldConfirm": 35,
    "shadowMinPt": 3,
    "addTrendThreshold": 500,
    "b2Readings": 3,
    "vixKillThreshold": 35,
    "vixChangeKillPt": 4,
    "vixChangeStopPt": 2,
    "openingGapKillPct": 0.005,
    "gammaFlipOffsetPt": 50,
    "distanceMinPt": 60,
    "ivCompressionFactor": 0.85,
    "vix20MAPeriod": 20,
    "riskFreeRate": 0.04,
    "sl1Multiplier": 2.0,
    "tp1Multiplier": 0.3,
    "tp2Multiplier": 0.5
  }
}
```

| Field | Spec ref | Purpose |
|---|---|---|
| `scanWindowStart` / `scanWindowEnd` | K5 | ET clock boundaries — outside this window returns HALT |
| `rsiOverbought` / `rsiOverboughtConfirm` | T1 Bear Call | prev RSI > 70 AND curr RSI < 65 |
| `rsiOversold` / `rsiOversoldConfirm` | T1 Bull Put | prev RSI < 30 AND curr RSI > 35 |
| `shadowMinPt` | T3 | Minimum upper/lower candle shadow in points (3pt) |
| `addTrendThreshold` | Layer 2, B1 | ADD > +500 = bullish, < −500 = bearish, else neutral |
| `b2Readings` | B2 | Number of recent ADD readings to check for stability (3) |
| `vixKillThreshold` | K1 | VIX above this → HALT (35) |
| `vixChangeKillPt` | K2 | VIX daily change above this → HALT (+4pt) |
| `vixChangeStopPt` | B3 | VIX daily change above this → B3 fails (+2pt) |
| `openingGapKillPct` | K6 | Opening gap fraction above this → HALT (0.5%) |
| `gammaFlipOffsetPt` | O1 | Short strike must be this many points beyond gamma flip (50pt) |
| `distanceMinPt` | O3b | Minimum OTM distance from SPX to short strike (60pt) |
| `ivCompressionFactor` | O3a | VIX must exceed `VIX_20MA × factor`; below = IV too compressed (0.85) |
| `vix20MAPeriod` | O3a | Period for VIX moving average (20 trading days) |
| `riskFreeRate` | Section 8 | Black-Scholes risk-free rate for credit estimate (0.04) |
| `sl1Multiplier` | SL1 | Stop loss triggers when spread price ≥ entry credit × this value (2.0 = 100% loss on premium) |
| `tp1Multiplier` | TP1 | Take profit triggers when spread price ≤ entry credit × this value (0.3 = 70% profit) |
| `tp2Multiplier` | TP2 | Time-based take profit at 13:45 ET when spread ≤ entry credit × this value (0.5 = 50% profit) |

---

### GEX Data Expected in `market_summary`

Voter O reads `gex_data` from the `MarketSummary` record saved via `POST /api/market-summary`. The payload must include:

```json
{
  "gex_data": {
    "gamma_flip": 7425,
    "call_wall": 7500,
    "put_wall": 7000,
    "gamma_regime": "positive"
  }
}
```

`gamma_regime` must be `"positive"`, `"negative"`, or `"neutral"`. If `market_summary` is null or `gex_data` is missing, Voter O fails with a clear explanation in the markdown output.

Full example of a `market_summary` payload (extra fields are ignored — only `gex_data` is extracted by the rules engine):

```json
{
  "timestamp": "2026-05-17T08:30:00-04:00",
  "previous_day": {
    "spx": { "close": 7501.24, "daily_high": 7513.7, "daily_low": 7469.65, "open": 7472.4 },
    "vix": 17.26,
    "add_nyse": -420
  },
  "premarket": {
    "vix": 19.17,
    "spx_future": "-0.65%"
  },
  "gex_data": {
    "net_gex_min": -8500000000,
    "net_gex_max": 12500000000,
    "gamma_regime": "positive",
    "gamma_flip": 7425,
    "call_wall": 7500,
    "put_wall": 7000,
    "largest_negative_gamma_strike": 7000,
    "largest_positive_gamma_strike": 7500
  },
  "dealer_positioning": {
    "gamma_regime": "positive",
    "volatility_behavior": "mean-reverting",
    "expected_behavior": "dealers selling rallies and buying dips, pinning near 7500"
  },
  "options_flow": {
    "put_call_ratio_oi": 1.98,
    "put_call_ratio_volume": 0.78,
    "skew": "put skew significantly elevated",
    "zero_dte_dominance": true
  },
  "volatility_surface": {
    "vix": 19.17,
    "iv_30d_range": [0.15, 0.19],
    "iv_percentile": 0.42,
    "term_structure": "backwardation risk in short-end"
  }
}
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rules` | List all enabled rules from `rules_index.json` |
| POST | `/api/rules/:id/evaluate` | Build live context, evaluate named rule, return result + markdown |

---

## Notes

- **GEX data**: Must save market_summary with `gex_data` via `POST /api/market-summary` each morning before evaluating. Voter O fails gracefully if absent.
- **K3 (macro events)**: Not implemented. User manually avoids clicking Evaluate on Fed/CPI/NFP days.
- **RSI(5)**: Computed from intraday closes only — different from the RSI(14) seeded with daily closes that `fetchSpxCandles()` provides. Wilder's method from spec Section 2.
- **VIX 20-day MA**: Uses last 20 entries of `vixDailyCloses` (yesterday's close is the last entry).

## Status

Plan complete. Not yet implemented.
