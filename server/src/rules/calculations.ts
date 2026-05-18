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

// Short strike selection. Spec Section 7.
export function computeShortStrike(spx: number, direction: Direction): number {
  return direction === 'bear_call' ? Math.ceil((spx + 37) / 5) * 5 : Math.floor((spx - 37) / 5) * 5
}

// Normal CDF approximation. Spec Section 8.
function normalCdf(x: number): number {
  return 1 / (1 + Math.exp(-1.7 * x))
}

function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(S - K, 0)
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  return S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d1 - sigma * Math.sqrt(T))
}

function bsPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(K - S, 0)
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  return K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1)
}

// 10-point spread credit estimate. Spec Section 8. remainingHours = hours until 16:00 ET.
export function computeSpreadCredit(
  spx: number,
  direction: Direction,
  vix: number,
  remainingHours: number,
  r = 0.04,
): { shortStrike: number; longStrike: number; credit: number } {
  const K = computeShortStrike(spx, direction)
  const Kl = direction === 'bear_call' ? K + 10 : K - 10
  const T = remainingHours / 6.5 / 252
  const sigma = vix / 100
  const credit =
    direction === 'bear_call'
      ? bsCall(spx, K, T, r, sigma) - bsCall(spx, Kl, T, r, sigma)
      : bsPut(spx, K, T, r, sigma) - bsPut(spx, Kl, T, r, sigma)
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

// Theoretical price of an existing spread position using Black-Scholes.
// direction/shortStrike/longStrike come from the original entry.
export function computeCurrentSpreadPrice(
  spx: number,
  direction: Direction,
  shortStrike: number,
  longStrike: number,
  vix: number,
  remainingHours: number,
  r = 0.04,
): number {
  const T = remainingHours / 6.5 / 252
  const sigma = vix / 100
  const price =
    direction === 'bear_call'
      ? bsCall(spx, shortStrike, T, r, sigma) - bsCall(spx, longStrike, T, r, sigma)
      : bsPut(spx, shortStrike, T, r, sigma) - bsPut(spx, longStrike, T, r, sigma)
  return Math.max(0, Math.round(price * 100) / 100)
}
