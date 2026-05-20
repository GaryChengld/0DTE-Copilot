export type Direction = 'bear_call' | 'bull_put'

export interface GexData {
  gamma_flip: number
  call_wall: number
  put_wall: number
  gamma_regime: 'positive' | 'negative' | 'neutral'
}

// RSI(5) via Wilder's smoothing. Spec Section 2. Returns null if < 6 closes.
export function computeRsi5(closes: number[]): number | null {
  const N = 5
  if (closes.length < N + 1) return null
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map((d) => (d > 0 ? d : 0))
  const losses = changes.map((d) => (d < 0 ? -d : 0))
  let avgGain = gains.slice(0, N).reduce((a, b) => a + b, 0) / N
  let avgLoss = losses.slice(0, N).reduce((a, b) => a + b, 0) / N
  for (let i = N; i < changes.length; i++) {
    avgGain = (avgGain * (N - 1) + gains[i]) / N
    avgLoss = (avgLoss * (N - 1) + losses[i]) / N
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

// Candle shadow sizes in points. Spec Section 3.
export function computeCandleShadows(h: number, l: number, c: number): { upper: number; lower: number } {
  return { upper: h - c, lower: c - l }
}

// Opening gap as fraction. Spec Section 4. K6 triggers when > openingGapKillPct.
export function computeOpeningGap(open: number, prevClose: number): number {
  return prevClose === 0 ? 0 : Math.abs(open - prevClose) / prevClose
}

// VIX daily change. Spec Section 5.
export function computeVixChange(current: number, prevClose: number): number {
  return current - prevClose
}

// VIX 20-day MA from daily closes array (oldest→newest). Spec Section 6.
export function computeVix20MA(closes: number[]): number | null {
  if (closes.length < 20) return null
  const last20 = closes.slice(-20)
  return last20.reduce((a, b) => a + b, 0) / 20
}

// Short strike selection — OTM distance depends on VIX. Spec Section 7.
function otmDistancePt(vix: number): number {
  return vix < 15 ? 25 : vix < 20 ? 35 : 45
}

export function computeShortStrike(spx: number, direction: Direction, vix: number): number {
  const d = otmDistancePt(vix)
  return direction === 'bear_call'
    ? Math.ceil((spx + d) / 5) * 5
    : Math.floor((spx - d) / 5) * 5
}


// Core pricing: credit-spread-pricing.md — Width × 0.3 × exp(−3.8 × N) × C(T) × M(T) × A(T)
// EM = SPX × (VIX/100) × sqrt(T_min / (252×390)),  N = D / EM
// C(T) = 1.34 × (T/138)^0.45, clamped to [0.8, 2.1]
// M(T) = 1 + 0.22 × exp(-(T-240)² / (2×55²))   midday stickiness
// A(T) = 1 + 0.22 × exp(-(T-150)² / (2×45²))   early-afternoon support
// Capped at width so a deep-ITM position never exceeds max payout.
function spreadPrice(
  spx: number, direction: Direction,
  shortStrike: number, longStrike: number,
  vix: number, remainingHours: number,
): number {
  const T = remainingHours * 60
  if (T <= 0) return 0
  const width = Math.abs(longStrike - shortStrike)
  const em    = spx * (vix / 100) * Math.sqrt(T / (252 * 390))
  const D     = direction === 'bear_call' ? shortStrike - spx : spx - shortStrike
  const N     = D / em
  if (N < 0) return Math.max(0, Math.min(-D, width))   // ITM: intrinsic value
  const cT    = Math.min(Math.max(1.34 * Math.pow(T / 138, 0.45), 0.8), 2.1)
  const mT    = 1 + 0.22 * Math.exp(-Math.pow(T - 240, 2) / (2 * 55 * 55))
  const aT    = 1 + 0.22 * Math.exp(-Math.pow(T - 150, 2) / (2 * 45 * 45))
  return Math.min(width * 0.3 * Math.exp(-3.8 * N) * cT * mT * aT, width)
}

// Entry credit for a new spread — strikes auto-selected by VIX. remainingHours = hours until 16:00 ET.
export function computeSpreadCredit(
  spx: number,
  direction: Direction,
  vix: number,
  remainingHours: number,
  _r = 0.04,
): { shortStrike: number; longStrike: number; credit: number } {
  const K      = computeShortStrike(spx, direction, vix)
  const Kl     = direction === 'bear_call' ? K + 10 : K - 10
  const credit = spreadPrice(spx, direction, K, Kl, vix, remainingHours)
  return { shortStrike: K, longStrike: Kl, credit: Math.max(0, Math.round(credit * 100) / 100) }
}

// Extract GEX data from market_summary JSON. Returns null if missing or malformed.
export function extractGexData(marketSummary: unknown): GexData | null {
  if (!marketSummary || typeof marketSummary !== 'object') return null
  const s = marketSummary as Record<string, unknown>
  const g = s.gex_data
  if (!g || typeof g !== 'object') return null
  const gex = g as Record<string, unknown>
  if (typeof gex.gamma_flip !== 'number' || typeof gex.call_wall !== 'number' || typeof gex.put_wall !== 'number')
    return null
  const regime = gex.gamma_regime
  if (regime !== 'positive' && regime !== 'negative' && regime !== 'neutral') return null
  return { gamma_flip: gex.gamma_flip, call_wall: gex.call_wall, put_wall: gex.put_wall, gamma_regime: regime }
}

// Current ET time as "HH:MM".
export function currentEtTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Hours from now until 16:00 ET (clamped to 0).
export function remainingHoursToClose(): number {
  const et = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(et)
  const close = new Date(etDate)
  close.setHours(16, 0, 0, 0)
  return Math.max(0, (close.getTime() - etDate.getTime()) / 3_600_000)
}

// Today's date in ET as "YYYY-MM-DD".
export function currentEtDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// Hours from a "HH:MM" bar time string until 16:00 ET (clamped to 0).
export function remainingHoursFromBarTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Math.max(0, (16 * 60 - (h * 60 + m)) / 60)
}

// Mark-to-market price of an open spread using original strikes and current SPX/VIX.
export function computeCurrentSpreadPrice(
  spx: number,
  direction: Direction,
  shortStrike: number,
  longStrike: number,
  vix: number,
  remainingHours: number,
  _r = 0.04,
): number {
  return Math.max(0, Math.round(spreadPrice(spx, direction, shortStrike, longStrike, vix, remainingHours) * 100) / 100)
}
