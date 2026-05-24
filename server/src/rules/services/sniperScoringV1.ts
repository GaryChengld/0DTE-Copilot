import type { RuleService, EvalContext, EvaluationResult } from '../types.js'
import type { TradeWithExits } from '../../db/tradeRepository.js'
import {
  computeRsi5, computeVixChange,
  computeSpreadCredit,
  remainingHoursFromBarTime, remainingHoursToClose, currentEtTime,
  type Direction,
} from '../calculations.js'

interface SniperScoringConfig {
  scanWindowStart: string
  scanWindowEnd:   string
  entryWindowEnd?: string
  params: {
    vixMin:                    number
    vixKillThreshold:          number
    entryScoreThreshold:       number
    secondTradeScoreThreshold: number
    roundLevelPt:              number
    roundLevelWindow:          number
    rsiBullThreshold:          number
    rsiBearThreshold:          number
    ivrMinPct:                 number
    timeMinHours:              number
    tickBullExtreme:           number
    tickBearExtreme:           number
    riskFreeRate:              number
    sl1Multiplier:             number
    tp1Multiplier:             number
    tp2Multiplier:             number
    tp2TimeET:                 string
  }
}

interface CondResult {
  bull:    number
  bear:    number
  maxPts:  number
  detail:  string
}

const ok  = (s: string) => `✅ ${s}`
const bad = (s: string) => `❌ ${s}`
const na  = (s: string) => `⚪ ${s}`

// ── Gate checks ───────────────────────────────────────────────────────────────

function checkGates(ctx: EvalContext, cfg: SniperScoringConfig): string[] {
  const { params: p, scanWindowStart } = cfg
  const entryEnd = cfg.entryWindowEnd ?? cfg.scanWindowEnd
  const time     = ctx.currentTimeET ?? currentEtTime()
  const vix      = ctx.vixReadings.at(-1) ?? 0
  const failures: string[] = []

  if (time < scanWindowStart || time > entryEnd)
    failures.push(`G1: Outside time window ${scanWindowStart}–${entryEnd} ET (now ${time})`)

  if (vix > 0) {
    if (vix < p.vixMin)
      failures.push(`G2: VIX ${vix.toFixed(1)} < ${p.vixMin} (insufficient premium)`)
    else if (vix > p.vixKillThreshold)
      failures.push(`G2: VIX ${vix.toFixed(1)} > ${p.vixKillThreshold} (gap risk too high)`)
  }

  return failures
}

// ── Condition scorers ─────────────────────────────────────────────────────────

function scoreA1(candle: { c: number; vwap: number }): CondResult {
  const bull = candle.c > candle.vwap
  const bear = candle.c < candle.vwap
  const rel  = bull ? '>' : bear ? '<' : '='
  return {
    bull: bull ? 3 : 0, bear: bear ? 3 : 0, maxPts: 3,
    detail: `A1 VWAP: close ${candle.c.toFixed(2)} ${rel} VWAP ${candle.vwap.toFixed(2)}`,
  }
}

function scoreA2(spx: number, prevCandleClose: number | null, marketSummary: unknown, window: number): CondResult {
  const ms      = marketSummary as Record<string, unknown> | null
  const prevDay = ms?.previous_day as Record<string, unknown> | undefined
  const spxPrev = prevDay?.spx as Record<string, unknown> | undefined
  const prevHigh = typeof spxPrev?.daily_high === 'number' ? spxPrev.daily_high : null
  const prevLow  = typeof spxPrev?.daily_low  === 'number' ? spxPrev.daily_low  : null

  if (prevHigh === null || prevLow === null)
    return { bull: 0, bear: 0, maxPts: 3, detail: 'A2 Prior day H/L: N/A (no market_summary.previous_day.spx.daily_high/low)' }

  // Condition 1: approaching the level (within window, correct side)
  const bullApproach  = spx >= prevLow  && spx - prevLow  <= window
  const bearApproach  = spx <= prevHigh && prevHigh - spx <= window

  // Condition 2: crossed the level on this bar (prior candle was on opposite side)
  const bullBreakout  = spx > prevHigh && (prevCandleClose === null || prevCandleClose <= prevHigh)
  const bearBreakdown = spx < prevLow  && (prevCandleClose === null || prevCandleClose >= prevLow)

  const bull = bullApproach || bullBreakout
  const bear = bearApproach || bearBreakdown

  const trigger = bull
    ? (bullBreakout ? `bull: crossed above prev H ${prevHigh}` : `bull: approaching prev L ${prevLow} (${spx.toFixed(2)}, within ${window}pt)`)
    : bear
    ? (bearBreakdown ? `bear: crossed below prev L ${prevLow}` : `bear: approaching prev H ${prevHigh} (${spx.toFixed(2)}, within ${window}pt)`)
    : `no match (SPX ${spx.toFixed(2)}, prev H ${prevHigh} / L ${prevLow})`

  return {
    bull: bull ? 3 : 0, bear: bear ? 3 : 0, maxPts: 3,
    detail: `A2 Prior day H/L: prev H ${prevHigh} / L ${prevLow} — ${trigger}`,
  }
}

function scoreA3(spx: number, levelPt: number, window: number): CondResult {
  const floor = Math.floor(spx / levelPt) * levelPt
  const ceil  = Math.ceil(spx  / levelPt) * levelPt
  const dFloor = spx - floor
  const dCeil  = ceil - spx
  const bull   = dFloor <= window
  const bear   = dCeil  <= window
  const lvl    = bull ? floor : bear ? ceil : (dFloor < dCeil ? floor : ceil)
  return {
    bull: bull ? 3 : 0, bear: bear ? 3 : 0, maxPts: 3,
    detail: `A3 Round level (${levelPt}pt): SPX ${spx.toFixed(2)}, nearest levels ${floor}↔${ceil} (need within ${window}pt)`,
  }
}

function scoreA4(candles: Array<{ t: string; h: number; l: number; c: number }>): CondResult {
  const orTimes = ['09:30', '09:35', '09:40']
  const orCandles = candles.filter(c => orTimes.includes(c.t.slice(-5)))
  if (orCandles.length < 2)
    return { bull: 0, bear: 0, maxPts: 3, detail: 'A4 Opening range: N/A (OR candles not yet available)' }
  const orHigh = Math.max(...orCandles.map(c => c.h))
  const orLow  = Math.min(...orCandles.map(c => c.l))
  const curr   = candles.at(-1)!.c
  const bull   = curr >= orHigh - 5
  const bear   = curr <= orLow + 5
  return {
    bull: bull ? 3 : 0, bear: bear ? 3 : 0, maxPts: 3,
    detail: `A4 Opening range: OR ${orLow.toFixed(0)}–${orHigh.toFixed(0)}, close ${curr.toFixed(2)} (bull ≥${(orHigh - 5).toFixed(0)}, bear ≤${(orLow + 5).toFixed(0)})`,
  }
}

function scoreB1(candles: Array<{ o: number; c: number }>): CondResult {
  if (candles.length < 2)
    return { bull: 0, bear: 0, maxPts: 2, detail: 'B1 Candle direction: N/A (need ≥2 candles)' }
  const last2 = candles.slice(-2)
  const bull  = last2.every(c => c.c > c.o)
  const bear  = last2.every(c => c.c < c.o)
  const dirs  = last2.map(c => c.c > c.o ? '▲' : c.c < c.o ? '▼' : '—').join('')
  return {
    bull: bull ? 2 : 0, bear: bear ? 2 : 0, maxPts: 2,
    detail: `B1 Last 2 candles: ${dirs} (bull=▲▲, bear=▼▼)`,
  }
}

function scoreB2(closes: number[], bullThr: number, bearThr: number): CondResult {
  const rsi = computeRsi5(closes)
  if (rsi === null)
    return { bull: 0, bear: 0, maxPts: 2, detail: `B2 RSI(5): N/A (need ≥6 closes, have ${closes.length})` }
  const bull = rsi < bullThr
  const bear = rsi > bearThr
  return {
    bull: bull ? 2 : 0, bear: bear ? 2 : 0, maxPts: 2,
    detail: `B2 RSI(5): ${rsi.toFixed(1)} (bull <${bullThr}, bear >${bearThr})`,
  }
}

function scoreB3(addReadings: number[]): CondResult {
  const last3   = addReadings.slice(-3)
  const bullCnt = last3.filter(a => a > 0).length
  const bearCnt = last3.filter(a => a < 0).length
  const bull    = bullCnt >= 2
  const bear    = bearCnt >= 2
  return {
    bull: bull ? 2 : 0, bear: bear ? 2 : 0, maxPts: 2,
    detail: `B3 ADD trend: ${bullCnt}/${last3.length} positive, ${bearCnt}/${last3.length} negative [${last3.join(', ')}]`,
  }
}

function scoreC1(vix: number, vixDailyCloses: number[], ivrMin: number): CondResult {
  if (vixDailyCloses.length < 20)
    return { bull: 0, bear: 0, maxPts: 2, detail: 'C1 IVR: N/A (need ≥20 VIX daily closes)' }
  const last20 = vixDailyCloses.slice(-20)
  const hi     = Math.max(...last20)
  const lo     = Math.min(...last20)
  const range  = hi - lo
  const ivr    = range > 0 ? ((vix - lo) / range) * 100 : 0
  const pass   = ivr > ivrMin
  return {
    bull: pass ? 2 : 0, bear: pass ? 2 : 0, maxPts: 2,
    detail: `C1 IVR proxy: ${ivr.toFixed(1)}% (VIX ${vix.toFixed(1)}, 20d lo ${lo.toFixed(1)} hi ${hi.toFixed(1)}, need >${ivrMin}%)`,
  }
}

function scoreC2(hrs: number, minHours: number): CondResult {
  const pass = hrs > minHours
  return {
    bull: pass ? 2 : 0, bear: pass ? 2 : 0, maxPts: 2,
    detail: `C2 Theta / time remaining: ${hrs.toFixed(2)}h (need >${minHours}h to close)`,
  }
}

function scoreD1(vixReadings: number[]): CondResult {
  const last3 = vixReadings.slice(-3)
  if (last3.length < 2)
    return { bull: 0, bear: 0, maxPts: 1, detail: 'D1 VIX direction: N/A (need ≥2 VIX readings)' }
  const first = last3[0]
  const last  = last3.at(-1)!
  const bull  = last < first
  const bear  = last > first
  const arrow = bull ? '↓' : bear ? '↑' : '→'
  return {
    bull: bull ? 1 : 0, bear: bear ? 1 : 0, maxPts: 1,
    detail: `D1 VIX direction: ${first.toFixed(1)} → ${last.toFixed(1)} ${arrow}`,
  }
}

function scoreD2(tickReadings: number[] | undefined, bullExt: number, bearExt: number): CondResult {
  if (!tickReadings || tickReadings.length === 0)
    return { bull: 0, bear: 0, maxPts: 1, detail: 'D2 TICK extreme: N/A (no TICK data in context)' }
  const tick = tickReadings.at(-1)!
  const bull = tick < bullExt
  const bear = tick > bearExt
  return {
    bull: bull ? 1 : 0, bear: bear ? 1 : 0, maxPts: 1,
    detail: `D2 TICK: ${tick} (bull <${bullExt}, bear >${bearExt})`,
  }
}

function scoreD3(candles: Array<{ o: number; c: number; v: number }>): CondResult {
  if (candles.length < 4)
    return { bull: 0, bear: 0, maxPts: 1, detail: 'D3 Volume: N/A (need ≥4 candles)' }
  const last    = candles.at(-1)!
  const prior3  = candles.slice(-4, -1)
  const avgVol  = prior3.reduce((s, c) => s + c.v, 0) / 3
  const shrink  = last.v < avgVol
  const bullish = last.c > last.o
  const bearish = last.c < last.o
  const bull    = bullish && shrink
  const bear    = bearish && shrink
  return {
    bull: bull ? 1 : 0, bear: bear ? 1 : 0, maxPts: 1,
    detail: `D3 Volume: last ${last.v.toFixed(0)} vs prior3 avg ${avgVol.toFixed(0)} — ${shrink ? 'shrinking' : 'expanding'} (candle ${bullish ? '▲' : bearish ? '▼' : '—'})`,
  }
}

function scoreD4(tradesToday: number): CondResult {
  const pass = tradesToday === 0
  return {
    bull: pass ? 1 : 0, bear: pass ? 1 : 0, maxPts: 1,
    detail: `D4 Trade count: ${tradesToday} trade(s) entered today (1 pt if none — first trade of day)`,
  }
}

// ── Position advisory (K4 path) ──────────────────────────────────────────────

function positionAdvisory(trade: TradeWithExits, ctx: EvalContext, cfg: SniperScoringConfig): string {
  const p      = cfg.params
  const time   = ctx.currentTimeET ?? currentEtTime()
  const credit = trade.entryPrice ?? 0
  const lines: string[] = []

  lines.push('## Open Position')
  lines.push(
    `${trade.symbol} ${trade.optionType ?? ''} ${trade.strike ?? ''} ×${trade.quantityRemaining}` +
    ` CREDIT @ $${credit.toFixed(2)}`
  )
  lines.push('')
  lines.push('## Exit Condition Check')
  lines.push('')

  lines.push('### TP (70–80% profit)')
  lines.push(
    `> TP1 target: spread ≤ $${(credit * p.tp1Multiplier).toFixed(2)} (${((1 - p.tp1Multiplier) * 100).toFixed(0)}% profit)`
  )
  if (time >= p.tp2TimeET) {
    lines.push(`> ⚠️ **TP2 — ${p.tp2TimeET} ET reached. Exit if spread ≤ $${(credit * p.tp2Multiplier).toFixed(2)}.**`)
  } else {
    lines.push(`> TP2 window opens at ${p.tp2TimeET} ET.`)
  }
  lines.push('')

  lines.push('### SL (100–150% loss)')
  lines.push(
    `> SL alert at $${(credit * 2.0).toFixed(2)} (200% loss) — evaluate exit.`
  )
  lines.push(
    `> SL hard at $${(credit * p.sl1Multiplier).toFixed(2)} (${(p.sl1Multiplier * 100).toFixed(0)}% loss) — exit immediately.`
  )
  lines.push('')

  lines.push(`### Hard exit — ${cfg.scanWindowEnd} ET`)
  if (time >= cfg.scanWindowEnd) {
    lines.push(`> ⚠️ **EXIT NOW — ${cfg.scanWindowEnd} ET reached.**`)
  } else {
    lines.push(`> Hard exit at ${cfg.scanWindowEnd} ET.`)
  }

  return lines.join('\n')
}

// ── Scoring table markdown ────────────────────────────────────────────────────

function renderTable(conditions: CondResult[], header: string): string {
  const lines: string[] = []
  lines.push(`### ${header}`)
  lines.push('| # | Condition | Bull Put | Bear Call | Detail |')
  lines.push('|---|-----------|:--------:|:---------:|--------|')
  conditions.forEach(c => {
    const bp  = c.bull > 0 ? `✅ +${c.bull}` : '❌ 0'
    const bc  = c.bear > 0 ? `✅ +${c.bear}` : '❌ 0'
    const det = c.detail.replace(/^[✅❌⚠️⚪]\s+/, '')
    lines.push(`| | ${det.split(':')[0]} | ${bp} | ${bc} | ${det} |`)
  })
  return lines.join('\n')
}

// ── Main evaluate ─────────────────────────────────────────────────────────────

function evaluate(ctx: EvalContext, config: unknown): EvaluationResult {
  const cfg  = config as SniperScoringConfig
  const { params: p } = cfg
  const lines: string[] = []
  const time = ctx.currentTimeET ?? currentEtTime()

  lines.push(`# Sniper Scoring — v1.0 | ${time} ET`)
  lines.push('')

  // ── Gate checks (G1 / G2 / G3) ──
  const gateFailures = checkGates(ctx, cfg)
  const vix          = ctx.vixReadings.at(-1) ?? 0
  const entryEnd     = cfg.entryWindowEnd ?? cfg.scanWindowEnd

  lines.push('## Gates')
  if (gateFailures.length > 0) {
    gateFailures.forEach(r => lines.push(`- ${bad(r)}`))
    lines.push(`- ${na('G3 Macro event: auto-pass — verify manually')}`)
    lines.push('')
    lines.push('**Status: HALT**')
    const hr = gateFailures.join('; ')
    return { result: 'HALT', haltReason: hr, backtestSummary: `HALT — ${hr}`, markdown: lines.join('\n') }
  }

  if ((ctx.tradesToday ?? 0) >= 2) {
    const reason = 'K4: 2 trades already entered today — daily limit reached'
    lines.push(`- ${ok(`G1 Time: ${time} ET (window ${cfg.scanWindowStart}–${entryEnd})`)}`)
    lines.push(`- ${vix > 0 ? ok(`G2 VIX: ${vix.toFixed(1)} (range ${p.vixMin}–${p.vixKillThreshold})`) : na('G2 VIX: no data — auto-pass')}`)
    lines.push(`- ${na('G3 Macro event: auto-pass — verify manually')}`)
    lines.push(`- ${bad(reason)}`)
    lines.push('')
    lines.push('**Status: HALT** — Daily position limit reached.')
    return { result: 'HALT', haltReason: reason, backtestSummary: `HALT — ${reason}`, markdown: lines.join('\n') }
  }

  lines.push(`- ${ok(`G1 Time: ${time} ET (window ${cfg.scanWindowStart}–${entryEnd})`)}`)
  lines.push(`- ${ok(`G2 VIX: ${vix.toFixed(1)} (range ${p.vixMin}–${p.vixKillThreshold})`)}`)
  if ((ctx.tradesToday ?? 0) === 1) {
    lines.push(`- ${na(`K4: 1 trade entered today — second trade evaluation (threshold raised to ${p.secondTradeScoreThreshold})`)}`)
  }
  lines.push(`- ${na('G3 Macro event: auto-pass — verify manually')}`)
  lines.push('')

  if (ctx.openTrades.length === 1) {
    lines.push(positionAdvisory(ctx.openTrades[0], ctx, cfg))
    lines.push('')
  }

  // Need ≥2 closed candles
  const candles = ctx.todayCandles
  if (candles.length < 2) {
    lines.push('## Insufficient Data')
    lines.push('Need ≥2 closed 5-min candles.')
    return { result: 'WAIT', backtestSummary: 'WAIT — insufficient candles', markdown: lines.join('\n') }
  }

  const curr           = candles.at(-1)!
  const spx            = curr.c
  const prevCandleClose = candles.length >= 2 ? candles.at(-2)!.c : null
  const closes         = candles.map(c => c.c)
  const hrs    = ctx.currentTimeET ? remainingHoursFromBarTime(ctx.currentTimeET) : remainingHoursToClose()
  const vixChg = computeVixChange(vix, ctx.vixDailyCloses.at(-1) ?? 0)

  lines.push(`## Scores (SPX: ${spx.toFixed(2)} | VIX: ${vix.toFixed(1)} | VIX chg: ${vixChg >= 0 ? '+' : ''}${vixChg.toFixed(2)})`)
  lines.push('')

  // ── Score all conditions ──
  const a: CondResult[] = [
    scoreA1(curr),
    scoreA2(spx, prevCandleClose, ctx.marketSummary, p.roundLevelWindow),
    scoreA3(spx, p.roundLevelPt, p.roundLevelWindow),
    scoreA4(candles),
  ]
  const b: CondResult[] = [
    scoreB1(candles),
    scoreB2(closes, p.rsiBullThreshold, p.rsiBearThreshold),
    scoreB3(ctx.addReadings),
  ]
  const c: CondResult[] = [
    scoreC1(vix, ctx.vixDailyCloses, p.ivrMinPct),
    scoreC2(hrs, p.timeMinHours),
  ]
  const d: CondResult[] = [
    scoreD1(ctx.vixReadings),
    scoreD2(ctx.tickReadings, p.tickBullExtreme, p.tickBearExtreme),
    scoreD3(candles),
    scoreD4(ctx.tradesToday ?? 0),
  ]

  const all = [...a, ...b, ...c, ...d]
  const bullTotal = all.reduce((s, r) => s + r.bull, 0)
  const bearTotal = all.reduce((s, r) => s + r.bear, 0)
  const maxTotal  = all.reduce((s, r) => s + r.maxPts, 0)

  const aMax = a.reduce((s, r) => s + r.maxPts, 0)
  const bMax = b.reduce((s, r) => s + r.maxPts, 0)
  const cMax = c.reduce((s, r) => s + r.maxPts, 0)
  const dMax = d.reduce((s, r) => s + r.maxPts, 0)

  lines.push(renderTable(a, `A — Structure & Price Location (max ${aMax} pts)`))
  lines.push('')
  lines.push(renderTable(b, `B — Momentum & Trend (max ${bMax} pts)`))
  lines.push('')
  lines.push(renderTable(c, `C — Volatility & Greeks (max ${cMax} pts)`))
  lines.push('')
  lines.push(renderTable(d, `D — Market Breadth (max ${dMax} pts)`))
  lines.push('')
  lines.push('---')

  const thr = (ctx.tradesToday ?? 0) >= 1 ? p.secondTradeScoreThreshold : p.entryScoreThreshold

  lines.push(`**Bull Put: ${bullTotal}/${maxTotal} | Bear Call: ${bearTotal}/${maxTotal}** (threshold: ${thr})`)
  lines.push('')

  const bsStr = `BP:${bullTotal}/${maxTotal} BC:${bearTotal}/${maxTotal}`

  // ── Entry decision ──
  const bullGo = bullTotal >= thr
  const bearGo = bearTotal >= thr

  if (bullGo && bearGo) {
    lines.push('# ⏳ WAIT — Conflicting signals (both directions meet threshold)')
    return { result: 'WAIT', backtestSummary: `${bsStr} → WAIT (conflict)`, markdown: lines.join('\n') }
  }

  if (!bullGo && !bearGo) {
    lines.push(`# ⏳ WAIT — Insufficient score (need ${thr}/${maxTotal})`)
    return { result: 'WAIT', backtestSummary: `${bsStr} → WAIT (need ${thr})`, markdown: lines.join('\n') }
  }

  const direction: Direction = bullGo ? 'bull_put' : 'bear_call'
  const score = bullGo ? bullTotal : bearTotal

  const { shortStrike, longStrike, credit } = computeSpreadCredit(spx, direction, vix, hrs, p.riskFreeRate)

  lines.push(`# ✅ GO — ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'} (score ${score}/${maxTotal})`)
  lines.push('')
  lines.push('## Trade Parameters')
  lines.push(`- **Direction:** ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'}`)
  lines.push(`- **Short Strike:** ${shortStrike} | **Long Strike:** ${longStrike}`)
  lines.push(`- **Est. Credit:** $${credit.toFixed(2)} (VIX ${vix.toFixed(1)}, ${hrs.toFixed(1)}h remaining)`)
  lines.push(`- **SL Alert:** spread ≥ $${(credit * 2.0).toFixed(2)} (200% loss)`)
  lines.push(`- **SL Hard (SL1):** spread ≥ $${(credit * p.sl1Multiplier).toFixed(2)} (${(p.sl1Multiplier * 100).toFixed(0)}% loss)`)
  lines.push(`- **Take Profit (TP1):** spread ≤ $${(credit * p.tp1Multiplier).toFixed(2)} (${((1 - p.tp1Multiplier) * 100).toFixed(0)}% profit)`)
  lines.push(`- **Take Profit (TP2):** spread ≤ $${(credit * p.tp2Multiplier).toFixed(2)} after ${p.tp2TimeET} ET`)

  return {
    result: 'GO', direction, shortStrike, longStrike, estimatedCredit: credit,
    backtestSummary: `${bsStr} → GO (${direction === 'bull_put' ? 'Bull Put' : 'Bear Call'})${(ctx.tradesToday ?? 0) >= 1 ? ' [2nd]' : ''}`,
    markdown: lines.join('\n'),
  }
}

export const sniperScoringV1Service: RuleService = { evaluate }
