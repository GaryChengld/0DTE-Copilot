# 0DTE SPX Credit Spread — Three-Voter System Rule Book v1.3

## Version History

- v1.0: Initial version
- v1.1: B1 converted to three-segment logic; oscillation mode added
- v1.2: Voter O fully rebuilt on GEX data; calculation methods section added
- v1.3: B2 relaxed to 2-of-3 same-direction; ADD/T2 conflict mode added

---

## System Overview

Runs every 5 minutes during the scan window 10:15–14:00 ET.
Outputs one of four states: GO / NO-GO / WAIT / HALT.
Only one position at a time. System locks while a position is open.

---

## Required Data

**Price Data**

- SPX 5-minute OHLCV
- SPX intraday cumulative VWAP (reset at 09:30 ET each day)
- SPX previous day close

**Breadth and Sentiment**

- ADD (NYSE Advance-Decline Difference) current reading, every 5 minutes
- Most recent 3 ADD readings (for B2)
- VIX current value
- VIX previous day close
- VIX daily close history, last 20 trading days (for VIX_20MA)

**GEX Data (updated pre-market each day)**

- Gamma Flip level
- Call Wall (largest positive GEX strike)
- Put Wall (largest negative GEX strike)
- Gamma Regime (positive / negative / neutral)

**Position State**

- Whether a position is currently open

---

## Calculation Methods

### 1. VWAP (Cumulative Intraday Volume-Weighted Average Price)

```
Typical Price = (High + Low + Close) / 3

VWAP_t = Σ(Typical Price_i × Volume_i) / Σ(Volume_i)
          where i accumulates from the first bar of the day (09:30) through bar t
```

Reset at 09:30 ET daily. Computed from 5-minute OHLCV bars.

---

### 2. RSI (Relative Strength Index, Wilder's Method)

Period N = 5. Requires at least N+1 = 6 bars.

**Step 1: Price change per bar**

```
Δ_i = Close_i − Close_{i-1}
```

**Step 2: Separate gains and losses**

```
Gain_i = Δ_i    (if Δ_i > 0, else 0)
Loss_i = |Δ_i|  (if Δ_i < 0, else 0)
```

**Step 3: Initial simple average over first N periods**

```
AvgGain = (Gain_1 + Gain_2 + ... + Gain_N) / N
AvgLoss = (Loss_1 + Loss_2 + ... + Loss_N) / N
```

**Step 4: Wilder smoothing for each subsequent bar**

```
AvgGain_t = (AvgGain_{t-1} × (N-1) + Gain_t) / N
AvgLoss_t = (AvgLoss_{t-1} × (N-1) + Loss_t) / N
```

**Step 5: RSI**

```
If AvgLoss = 0: RSI = 100
Otherwise:
  RS  = AvgGain / AvgLoss
  RSI = 100 − (100 / (1 + RS))
```

---

### 3. Candle Shadow Size

```
Upper shadow = High − Close
Lower shadow = Close − Low
```

---

### 4. Opening Gap

```
Gap% = |Open − Previous Close| / Previous Close
```

K6 triggers when Gap% > 0.005 (i.e. 0.5%).

---

### 5. VIX Daily Change

```
VIX Daily Change = VIX Current − VIX Previous Close
```

---

### 6. VIX 20-Day Moving Average

```
VIX_20MA = (VIX_{t-1} + VIX_{t-2} + ... + VIX_{t-20}) / 20
```

Uses the last 20 trading days of VIX daily closes, excluding the current day.

O3 Sub-condition A:

```
VIX Current > VIX_20MA × 0.85 → pass (IV not severely compressed)
VIX Current ≤ VIX_20MA × 0.85 → fail (IV extremely compressed)
```

---

### 7. Short Strike Selection (OTM Distance by VIX)

| VIX Range | Min OTM (D_min) | Bull Put short strike | Bear Call short strike |
|-----------|-----------------|----------------------|------------------------|
| < 15 | 25pt | `floor((SPX − 25) / 5) × 5` | `ceil((SPX + 25) / 5) × 5` |
| 15–20 | 35pt | `floor((SPX − 35) / 5) × 5` | `ceil((SPX + 35) / 5) × 5` |
| ≥ 20 | 45pt | `floor((SPX − 45) / 5) × 5` | `ceil((SPX + 45) / 5) × 5` |

**Long strike** = Short strike ∓ 10pt (fixed 10-point spread width).

---

### 8. Theoretical Option Credit Estimate (Black-Scholes with IV Adjustment)

Used when no live options chain is available.

**Inputs:**

```
S = SPX current price
K = short strike (Section 7)
T = remaining minutes to 16:15 ET / (252 × 6.5 × 60)
r = 0.04
```

**IV multiplier by OTM % and direction** (calibrated at VIX = 18, SPX = 7350, 10:30 ET):

| OTM % | Bull Put multiplier | Bear Call multiplier |
|--------|---------------------|----------------------|
| < 0.40% | 1.68× | 1.70× |
| 0.40–0.70% | 1.95× | 1.85× |
| 0.70–1.00% | 2.20× | 2.00× |
| > 1.00% | 2.45× | 2.15× |

```
OTM % = |K − S| / S
σ_eff = (VIX / 100) × multiplier
```

**d1 and d2:**

```
d1 = [ln(S/K) + (r + σ_eff² / 2) × T] / (σ_eff × √T)
d2 = d1 − σ_eff × √T
```

**Call and Put theoretical prices:**

```
Call(K) = S × N(d1)  − K × e^(−rT) × N(d2)
Put(K)  = K × e^(−rT) × N(−d2) − S × N(−d1)
```

**10-point spread credit estimate:**

```
Bear Call Spread Credit = Call(K_short) − Call(K_short + 10)
Bull Put  Spread Credit = Put(K_short)  − Put(K_short − 10)
```

**N(x) — Horner polynomial approximation (Abramowitz & Stegun 26.2.17, accuracy ±0.0001):**

```
t    = 1 / (1 + 0.2316419 × |x|)
poly = t × (0.319381530
       + t × (−0.356563782
       + t × ( 1.781477937
       + t × (−1.821255978
       + t ×   1.330274429))))
φ(x) = exp(−x² / 2) / √(2π)

N(x) = 1 − φ(x) × poly    if x ≥ 0
N(x) = φ(|x|) × poly       if x < 0
```

> **Note on IV multipliers**: Call skew historically assumed to be smaller than put skew.
> Calibration against actual market prices shows the gap is narrower than expected,
> likely driven by elevated 0DTE call buying activity. Recalibrate as more data points
> are collected across different VIX regimes.

---

### 9. Gamma Flip as Max Pain Substitute

```
Max Pain substitute = Gamma Flip
```

The Gamma Flip is the level where dealer net gamma transitions from positive to negative.
Dealer delta hedging creates a gravitational pull toward this level, making it functionally
equivalent to Max Pain as an anchor for price convergence.

O1 thresholds:

```
Bear Call: short strike > Gamma Flip + 50pt
Bull Put : short strike < Gamma Flip − 50pt
```

O directional confirmation (oscillation and conflict modes):

```
Bear Call: current SPX > Gamma Flip → confirmed
Bull Put : current SPX < Gamma Flip → confirmed
Mismatch → Voter O fails entirely
```

---

### 10. GEX Walls as OI Wall Substitute

```
Highest OI Call strike substitute = Call Wall (from GEX data)
Highest OI Put  strike substitute = Put Wall  (from GEX data)
```

O2 thresholds:

```
Bear Call: short strike ≥ Call Wall
Bull Put : short strike ≤ Put Wall
```

---

## Layer 1: Kill Switch

If any condition is true → output HALT. No new positions for the rest of the day.

| #   | Condition                                     | Reference         |
| --- | --------------------------------------------- | ----------------- |
| K1  | VIX > 35                                      | Section 5         |
| K2  | VIX daily change > +4pt                       | Section 5         |
| K3  | Scheduled macro event today (Fed / CPI / NFP) | Economic calendar |
| K4  | A position is currently open                  | Position state    |
| K5  | Current time < 10:15 ET or > 14:00 ET         | System clock      |
| K6  | Opening gap > 0.5%                            | Section 4         |

---

## Layer 2: ADD Mode Determination

Runs at the start of every scan cycle, before the three voters are evaluated.

**Step 1: Determine ADD direction**

Threshold is configurable via `addTrendThreshold` in the rule config (default 500).

```
ADD > +addTrendThreshold  → ADD bullish
ADD < −addTrendThreshold  → ADD bearish
ADD within ±addTrendThreshold  → ADD neutral
```

**Step 2: Determine T2 direction (requires VWAP)**

```
SPX > VWAP → T2 = Bull Put
SPX < VWAP → T2 = Bear Call
```

**Step 3: Assign mode**

```
ADD bullish AND T2 = Bull Put  → Trend-aligned mode, direction Bull Put,  B threshold 2/3
ADD bearish AND T2 = Bear Call → Trend-aligned mode, direction Bear Call, B threshold 2/3
ADD neutral (±addTrendThreshold) → Oscillation mode,   direction from T2 + O, B threshold 3/3
ADD bullish AND T2 = Bear Call → Conflict mode, trend takes priority, direction Bear Call, B threshold 3/3
ADD bearish AND T2 = Bull Put  → Conflict mode, T2 takes priority,    direction Bull Put,  B threshold 3/3
```

---

## Layer 3: Three-Voter System

Each voter evaluates independently. **≥ 2 of 3 voters pass → GO.**

---

## Voter T: Technical (Timing Layer)

Answers: "Is this the right moment to enter based on momentum exhaustion?"

Each voter passes when **≥ 2 of its 3 conditions** are met.

### T1 — RSI(5) Pullback Confirmation (Section 2)

```
Bear Call: previous bar RSI > 70  AND  current bar RSI < 65
Bull Put : previous bar RSI < 30  AND  current bar RSI > 35
```

### T2 — VWAP Directional Alignment (Section 1)

```
Bear Call: Close < VWAP
Bull Put : Close > VWAP
```

### T3 — Candle Shadow Confirmation (Section 3)

```
Bear Call: upper shadow ≥ 3pt
Bull Put : lower shadow ≥ 3pt
```

**Voter T result: ≥ 2 of T1 / T2 / T3 pass → Voter T votes YES**

---

## Voter O: Options Structure (Positioning Layer)

Answers: "Is the short strike structurally safe, and does sufficient edge exist?"

### O1 — Outside Gamma Flip (Section 9)

```
Bear Call: short strike > Gamma Flip + 50pt
Bull Put : short strike < Gamma Flip − 50pt
```

### O2 — GEX Wall Support (Section 10)

```
Bear Call: short strike ≥ Call Wall
Bull Put : short strike ≤ Put Wall
```

### O3 — IV Environment + Distance Threshold (required; mandatory condition)

All three sub-conditions must be met:

```
Sub-condition A: VIX Current > VIX_20MA × 0.85
Sub-condition B: |short strike − SPX current price| ≥ 60pt
Sub-condition C: Gamma Regime = positive
```

### O Directional Confirmation (oscillation and conflict modes only)

See Section 9.

```
Bear Call: SPX > Gamma Flip → confirmed
Bull Put : SPX < Gamma Flip → confirmed
Direction mismatch → Voter O fails entirely regardless of O1/O2/O3
```

Trend-aligned mode does not require this check.

**Voter O result: ≥ 2 of O1 / O2 / O3 pass, AND O3 must be one of them → Voter O votes YES**

---

## Voter B: Breadth (Direction Confirmation Layer)

Answers: "Does market breadth support this direction, and is volatility stable?"

### Passing threshold by mode

```
Trend-aligned mode: ≥ 2 of B1 / B2 / B3 pass
Oscillation mode  : all 3 of B1 / B2 / B3 pass (3/3)
Conflict mode     : all 3 of B1 / B2 / B3 pass (3/3)
```

### B1 — ADD Direction

**Trend-aligned mode:**

```
Bull Put : ADD > +addTrendThreshold → pass
Bear Call: ADD < −addTrendThreshold → pass
```

**Oscillation mode:**

```
B1 passes automatically
```

**Conflict mode:**

```
B1 passes automatically (ADD conflict with T2 is already known and accepted)
```

### B2 — ADD Stability (updated in v1.3)

Uses the most recent 3 ADD readings. **≥ 2 of 3 readings in the same direction** → pass.
Consecutive readings are not required.

**Trend-aligned and oscillation modes:**

```
Bull Put : ≥ 2 of the last 3 ADD readings are positive
Bear Call: ≥ 2 of the last 3 ADD readings are negative
```

**Conflict mode (ADD opposes T2 direction):**

B2 uses a conflict stability check instead:

```
Among the last 3 ADD readings, there are no 2 consecutive readings
with absolute value > 300 in the direction opposing T2.
```

If 2 or more consecutive ADD readings have |ADD| > 300 opposing T2 → B2 fails.
This means breadth is strongly and persistently opposing T2, making the conflict too severe to trade.

### B3 — VIX Stability

```
VIX daily change < +2.0pt → pass
VIX daily change ≥ +2.0pt → fail
```

---

## Layer 4: Final Decision Logic

```
If any Kill Switch is true → output HALT, stop

Determine ADD mode (trend-aligned / oscillation / conflict)

Determine direction for this scan cycle

If oscillation or conflict mode:
    Compute O directional confirmation
    If O direction does not match evaluation direction → output WAIT, end cycle

Evaluate Voter T, Voter O, Voter B

votes = (T pass) + (O pass) + (B pass)

If votes ≥ 2 AND O3 passes → output GO
If votes = 1               → output WAIT
If votes = 0               → output NO-GO
```

---

## Exit Rules

### Stop Loss (first trigger exits immediately)

- **SL1**: Spread market price ≥ entry credit × 2.0 (100% loss on premium)
- **SL2**: ADD direction fully reverses and holds for ≥ 15 minutes
- **SL3**: Gamma Flip shifts > 30pt within 2 hours of market close

### Profit Target (in priority order)

- **TP1**: Spread market price ≤ entry credit × 0.30 → exit immediately (70% profit)
- **TP2**: Still in position at 13:45 ET and spread ≤ entry credit × 0.50 → exit (50% profit)
- **TP3**: Voter O conditions reverse → exit before TP1 is reached

### Expiry Handling

- Still in position at 15:45 ET with profit > 0 → force close
- Still in position at 15:45 ET with a loss → hold until 15:55 ET force close

---

## Trade Log Format

Record the following for every GO signal:

- Signal time
- ADD mode (trend-aligned / oscillation / conflict)
- ADD current value
- Direction (Bear Call / Bull Put)
- SPX price at entry
- Short strike (Section 7)
- Long strike (short strike ± 10pt)
- Estimated credit (Section 8)
- T1 / T2 / T3: pass or fail
- O1 / O2 / O3: pass or fail
- O directional confirmation result (oscillation and conflict modes)
- B1 / B2 / B3: pass or fail
- B passing threshold applied (2/3 or 3/3)
- VIX at entry
- VIX_20MA at entry
- Gamma Regime
- Exit time
- Exit reason (TP1 / TP2 / TP3 / SL1 / SL2 / SL3 / forced)
- Exit credit
- P&L in dollars
- P&L as percentage of max profit
