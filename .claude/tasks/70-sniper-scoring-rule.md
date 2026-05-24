# Task 70 — Sniper Scoring Rule v1.0

## Goal

Implement a second rule service — `sniperScoringV1` — based on `server/specs/rules/sniper-scoring-rules-v1.md`. The rule plugs into the existing rules engine and works identically in realtime evaluation and backtest. Uses the same `computeShortStrikeByDelta()`, `computeCurrentSpreadPrice()`, and `computeMacd()` helpers from `calculations.ts`.

---

## Architecture

- **Same `RuleService` interface** as `threeVoterV1` — single `evaluate(ctx, config)` method
- **Scoring model** instead of 3-voter pass/fail: 22-point weighted checklist across 4 categories
  - A: Structure & Price Location (3pt × 4 = 12 pts)
  - B: Momentum & Trend (2pt × 4 = 8 pts)
  - C: Volatility & Greeks (2pt × 4 = 8 pts)
  - D: Market Breadth (1pt × 6 = 6 pts)
- Entry when one direction scores ≥ 14/22 (first trade) or ≥ 17/22 (second trade)
- Same backtest loop as threeVoterV1 — no changes to backtest route logic

---

## Conditions

| Available from EvalContext | Approximated | Skipped (N/A) |
|----------------------------|--------------|---------------|
| A1 VWAP, A3 Round level, A4 OR | A2 prev close proxy (uses prevSpxClose) | C4 vol skew |
| B1 candles, B4 ADD, D3 VIX direction | B2 RSI5 (for RSI14), C1 IVR via VIX range | D1 QQQ, D2 ES futures |
| B3 MACD, C2 delta N-range, C3 time | | |
| D4 TICK (via tickReadings), D5 volume | | |

Max achievable: 18/22 (C4/D1/D2 unavailable) + D4 if TICK data is present.

---

## New Additions to Shared Modules

- `server/src/rules/types.ts`: `tickReadings?: number[]` added to `EvalContext`
- `server/src/rules/calculations.ts`: `computeShortStrikeByDelta()`, `computeMacd()` exported
- `server/src/routes/backtest.ts`: `tickReadings` extracted from snapshots and passed in EvalContext

---

## Files

| File | Action |
|------|--------|
| `server/src/rules/services/sniperScoringV1.ts` | Created |
| `server/configs/rules/sniper-scoring-v1.json` | Created |
| `server/configs/rules/rules_index.json` | Updated (sniper-scoring-v1 appended) |
| `server/src/rules/engine.ts` | Updated (sniperScoringV1 in SERVICE_REGISTRY) |
| `server/src/rules/types.ts` | Updated (tickReadings in EvalContext) |
| `server/src/rules/calculations.ts` | Updated (computeShortStrikeByDelta, computeMacd) |
| `server/src/routes/backtest.ts` | Updated (tickReadings in EvalContext) |

## Status

Completed 2026-05-20.
