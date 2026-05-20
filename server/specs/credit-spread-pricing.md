# SPX 0DTE Intraday Credit Spread Pricing Model (Calibrated Version)

## 1. Remaining Time (T)

T = Minutes remaining until market close (ET)

---

## 2. Expected Move (EM)

EM = SPX × (VIX / 100) × sqrt( T / (252 × 390) )

Where:

- SPX = current index level
- VIX = implied volatility proxy
- 252 = trading days per year
- 390 = trading minutes per day

---

## 3. Strike Distance (D)

For CALL spread:
D = Strike_short - SPX

For PUT spread:
D = SPX - Strike_short

---

## 4. Normalized Distance (N)

N = D / EM

---

## 5. Calibrated Intraday Spread Pricing Model (0DTE)

**OTM regime (N ≥ 0):**

SpreadPrice = min( Width × 0.3 × exp(-3.8 × N) × C(T) × M(T) × A(T),  Width )

**ITM regime (N < 0):**

SpreadPrice = max( 0,  min( −D,  Width ) )

Where:

- Width = spread width (e.g., 10 points)
- N = normalized distance in units of expected move
- D = signed strike distance (negative when short strike is breached)
- −D = amount the short strike is in-the-money
- C(T) = time-dependent calibration factor
- M(T) = midday stickiness factor
- A(T) = early-afternoon support factor

> **Rationale for ITM regime:** when N < 0 the exponential grows unboundedly and
> the calibrated formula is no longer valid. The spread's fair value converges to
> its intrinsic value — how far the short strike has been breached, capped at the
> spread width (maximum loss).

---

## 6. Time Calibration Factor (C(T))

C(T) = 1.34 × (T / 138)^0.45, clamped to [0.8, 2.1]

Where:

- T = minutes remaining until market close (ET)

---

## 7. Midday Stickiness Factor (M(T))

M(T) = 1 + 0.22 × exp(-(T - 240)^2 / (2 × 55^2))

Where:

- T = minutes remaining until market close (ET)

---

## 8. Early-Afternoon Support Factor (A(T))

A(T) = 1 + 0.22 × exp(-(T - 150)^2 / (2 × 45^2))

Where:

- T = minutes remaining until market close (ET)

---

## 9. Regime Interpretation

This model assumes intraday regime behavior:

- Morning session (higher liquidity, price discovery): higher spread value
- Midday session (compression phase): accelerated decay
- Afternoon session (gamma + theta acceleration): rapid premium collapse

---

## 10. Key Insight

0DTE credit spread pricing is dominated by:

- Intraday volatility compression (not full-day volatility)
- Exponential tail decay of probability of touch
- Dealer gamma exposure dynamics
- Time-of-day regime shifts

Therefore, pricing is not linear in time decay, but regime-dependent exponential decay.
