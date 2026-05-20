# SPX 0DTE Credit Spread — Sniper Scoring System Rule Book - V1.0

---

## I. System Overview

| Parameter | Specification |
|-----------|---------------|
| Underlying | SPX 0DTE options |
| Strategies | Bear Call Credit Spread / Bull Put Credit Spread |
| Short leg delta | 0.08 – 0.13 (target 0.10) |
| Spread width | 10 points |
| Stop loss | 100%–150% of credit received |
| Profit target | 70%–80% of credit received |
| Weekly frequency | 4–5 trades |
| Run frequency | Every 5 minutes |
| Entry threshold | All Gates pass + single direction score ≥ 14/22 |

---

## II. Gate Conditions (Hard Filters)

> **Any single Gate failure = no entry this cycle. Wait for the next 5-minute bar and re-evaluate.**

| # | Condition | Pass Criteria | On Failure |
|---|-----------|---------------|------------|
| G1 | Time window | 10:00–14:30 ET | No entry outside window |
| G2 | VIX range | VIX between 12 and 35 | <12 = insufficient premium; >35 = gap risk too high |
| G3 | Event risk | No Fed / CPI / NFP within next 30 minutes | No entry if event is imminent |

---

## III. Scoring Checklist

> For each condition, select a direction: **▲ Bullish** (supports Bull Put) / **▼ Bearish** (supports Bear Call) / **— Neutral** (0 points).
> Once all Gates pass, the first direction to reach 14/22 triggers entry.

### Category A — Structure & Price Location (3 pts each, 12 pts total)

| # | Condition | ▲ Bull Put | ▼ Bear Call |
|---|-----------|------------|-------------|
| A1 | **VWAP position** | Price above VWAP | Price below VWAP |
| A2 | **Prior day high/low** | Price testing prior day low as support | Price testing prior day high as resistance |
| A3 | **Round number level** | Within 15 pts of nearest 50/100-point level (below, acting as support) | Within 15 pts of nearest 50/100-point level (above, acting as resistance) |
| A4 | **Opening range (OR)** | OR established 09:30–09:45; price attempting OR low breakout | OR established 09:30–09:45; price attempting OR high breakout |

### Category B — Momentum & Trend (2 pts each, 8 pts total)

| # | Condition | ▲ Bull Put | ▼ Bear Call |
|---|-----------|------------|-------------|
| B1 | **5-min candle direction** | ≥ 2 consecutive bullish candles | ≥ 2 consecutive bearish candles |
| B2 | **RSI(14)** | RSI < 35 (oversold) | RSI > 65 (overbought) |
| B3 | **MACD histogram** | Histogram positive and expanding | Histogram negative and expanding |
| B4 | **NYSE ADD** | A/D Line trending upward | A/D Line trending downward |

### Category C — Volatility & Greeks (2 pts each, 8 pts total)

| # | Condition | ▲ Bull Put | ▼ Bear Call |
|---|-----------|------------|-------------|
| C1 | **IV Rank (IVR)** | IVR > 25% (applies to both directions) | IVR > 25% (applies to both directions) |
| C2 | **Short leg delta confirmation** | Δ 0.08–0.13 executable at target strike | Δ 0.08–0.13 executable at target strike |
| C3 | **Theta / time remaining** | > 2 hours to close | > 2 hours to close |
| C4 | **Volatility skew** | Call skew elevated (market paying up for upside protection) | Put skew elevated (market paying up for downside protection) |

> **Note:** C1, C2, and C3 are structural confirmations that apply equally to both directions. If IVR < 15%, treat as a soft Gate — entry not recommended.

### Category D — Market Breadth Confirmation (1 pt each, 6 pts total)

| # | Condition | ▲ Bull Put | ▼ Bear Call |
|---|-----------|------------|-------------|
| D1 | **QQQ alignment** | QQQ moving up in sync | QQQ moving down in sync |
| D2 | **ES futures direction** | ES futures at premium, trending up | ES futures at discount, trending down |
| D3 | **VIX direction** | VIX declining | VIX rising |
| D4 | **TICK extreme** | TICK < -1000 (short-term oversold) | TICK > +1000 (short-term overbought) |
| D5 | **Volume confirmation** | Decline accompanied by shrinking volume (selling exhaustion) | Rally accompanied by shrinking volume (buying exhaustion) |
| D6 | **Trade count today** | First trade of the day: standard threshold 14; second trade requires ≥ 17 | First trade of the day: standard threshold 14; second trade requires ≥ 17 |

---

## IV. Entry Decision Logic

```
Run every 5 minutes:

1. Check Gates G1 / G2 / G3
   → Any failure → WAIT, re-run next bar

2. Calculate Bull Put score  (sum of ▲ selections)
   Calculate Bear Call score (sum of ▼ selections)

3. Evaluate:
   ├─ Bull score ≥ 14 AND Bull > Bear  → Enter Bull Put Credit Spread
   ├─ Bear score ≥ 14 AND Bear > Bull  → Enter Bear Call Credit Spread
   ├─ Both ≥ 14                        → Conflicting signals — WAIT one bar
   └─ Both < 14                        → Insufficient conditions — WAIT

4. Pre-entry checks:
   → Already have 1 trade today? Raise threshold to 17/22
   → Already have 2 trades today? No further entries allowed
```

---


## V. Position Management & Exit Rules

| Situation | Action |
|-----------|--------|
| Unrealized loss reaches **100%** of credit | Alert — evaluate exit |
| Unrealized loss reaches **150%** of credit | Exit at market immediately, no hesitation |
| Unrealized gain reaches **70%–80%** of credit | Close position actively — do not hold for last cents |
| **< 30 minutes** to close with position near ITM | Evaluate immediately — prioritize early exit |
| VIX spikes > 5 points intraday | Exit immediately regardless of P&L |
| Short leg delta drifts above **0.25** | Treat as structural failure — consider exiting |

---

## VI. No-Trade Conditions (Additional Rules)

1. **First 30 minutes after open** (09:30–10:00 ET): observe only, no entries
2. **Last 30 minutes before close** (15:30–16:00 ET): do not open new positions
3. **Two losing trades in a single day**: halt trading for the remainder of the day
4. **Gap open > 0.5%**: wait for VWAP to re-establish directional context before evaluating
5. **OPEX week** (third Friday of each month): threshold automatically raised to 17/22

---

*Rules version: v1.0 | For analytical assistance only — not investment advice*