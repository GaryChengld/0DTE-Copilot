import type { RuleService, EvalContext, EvaluationResult } from '../types.js'
import type { TradeWithExits } from '../../db/tradeRepository.js'
import {
  computeRsi5, computeCandleShadows, computeOpeningGap,
  computeVixChange, computeVix20MA, computeSpreadCredit,
  extractGexData, currentEtTime, remainingHoursToClose,
  type Direction,
} from '../calculations.js'

interface ThreeVoterConfig {
  scanWindowStart: string
  scanWindowEnd:   string
  params: {
    rsiOverbought:        number
    rsiOverboughtConfirm: number
    rsiOversold:          number
    rsiOversoldConfirm:   number
    shadowMinPt:          number
    addTrendThreshold:    number
    b2Readings:           number
    vixKillThreshold:     number
    vixChangeKillPt:      number
    vixChangeStopPt:      number
    openingGapKillPct:    number
    gammaFlipOffsetPt:    number
    distanceMinPt:        number
    ivCompressionFactor:  number
    vix20MAPeriod:        number
    riskFreeRate:         number
    sl1Multiplier:        number
    tp1Multiplier:        number
    tp2Multiplier:        number
  }
}

type AddMode = 'trend-aligned' | 'oscillation' | 'conflict'
type VoterResult = { pass: boolean; details: string[] }

const ok  = (s: string) => `✅ ${s}`
const bad = (s: string) => `❌ ${s}`

// ── Kill Switches (Layer 1) ───────────────────────────────────────────────────

function checkKillSwitches(ctx: EvalContext, cfg: ThreeVoterConfig): string[] {
  const { params: p, scanWindowStart, scanWindowEnd } = cfg
  const reasons: string[] = []
  const time   = currentEtTime()
  const vix    = ctx.vixReadings.at(-1) ?? 0
  const vixChg = computeVixChange(vix, ctx.vixDailyCloses.at(-1) ?? 0)

  if (vix > p.vixKillThreshold)
    reasons.push(`K1: VIX ${vix.toFixed(1)} > ${p.vixKillThreshold}`)
  if (vixChg > p.vixChangeKillPt)
    reasons.push(`K2: VIX change +${vixChg.toFixed(1)}pt > +${p.vixChangeKillPt}pt`)
  if (ctx.openTrades.length > 0)
    reasons.push(`K4: Position currently open`)
  if (time < scanWindowStart || time > scanWindowEnd)
    reasons.push(`K5: Outside scan window ${scanWindowStart}–${scanWindowEnd} ET (now ${time})`)
  if (ctx.prevSpxClose !== null && ctx.todayCandles.length > 0) {
    const gap = computeOpeningGap(ctx.todayCandles[0].o, ctx.prevSpxClose)
    if (gap > p.openingGapKillPct)
      reasons.push(`K6: Opening gap ${(gap * 100).toFixed(2)}% > ${(p.openingGapKillPct * 100).toFixed(1)}%`)
  }
  return reasons
}

// ── ADD Mode (Layer 2) ────────────────────────────────────────────────────────

function determineMode(add: number, t2Dir: Direction, thr: number) {
  const bull = add >  thr
  const bear = add < -thr
  if (bull && t2Dir === 'bull_put')  return { mode: 'trend-aligned' as AddMode, direction: 'bull_put'  as Direction, bThr: 2, label: `Trend-aligned (Bull Put, 2/3)` }
  if (bear && t2Dir === 'bear_call') return { mode: 'trend-aligned' as AddMode, direction: 'bear_call' as Direction, bThr: 2, label: `Trend-aligned (Bear Call, 2/3)` }
  if (!bull && !bear)                return { mode: 'oscillation'   as AddMode, direction: t2Dir,                    bThr: 3, label: `Oscillation (±${thr}, 3/3)` }
  if (bull && t2Dir === 'bear_call') return { mode: 'conflict'      as AddMode, direction: 'bear_call' as Direction, bThr: 3, label: `Conflict (ADD bullish vs T2 Bear Call, 3/3)` }
  return                              { mode: 'conflict'      as AddMode, direction: 'bull_put'  as Direction, bThr: 3, label: `Conflict (ADD bearish vs T2 Bull Put, 3/3)` }
}

// ── Voter T ───────────────────────────────────────────────────────────────────

function voterT(ctx: EvalContext, dir: Direction, p: ThreeVoterConfig['params']): VoterResult {
  const details: string[] = []
  const candles = ctx.todayCandles
  if (candles.length < 2) return { pass: false, details: ['Insufficient candles (need ≥2)'] }

  const curr   = candles.at(-1)!
  const closes = candles.map(c => c.c)
  const currRsi = computeRsi5(closes)
  const prevRsi = computeRsi5(closes.slice(0, -1))

  let t1 = false
  if (currRsi !== null && prevRsi !== null) {
    t1 = dir === 'bear_call'
      ? prevRsi > p.rsiOverbought      && currRsi < p.rsiOverboughtConfirm
      : prevRsi < p.rsiOversold        && currRsi > p.rsiOversoldConfirm
    const lbl = dir === 'bear_call'
      ? `prev ${prevRsi.toFixed(1)} > ${p.rsiOverbought} AND curr ${currRsi.toFixed(1)} < ${p.rsiOverboughtConfirm}`
      : `prev ${prevRsi.toFixed(1)} < ${p.rsiOversold} AND curr ${currRsi.toFixed(1)} > ${p.rsiOversoldConfirm}`
    details.push((t1 ? ok : bad)(`T1 RSI(5): ${lbl}`))
  } else {
    details.push(bad(`T1 RSI(5): need ≥7 closes, have ${closes.length}`))
  }

  const t2 = dir === 'bear_call' ? curr.c < curr.vwap : curr.c > curr.vwap
  details.push((t2 ? ok : bad)(
    `T2 VWAP: close ${curr.c.toFixed(2)} ${dir === 'bear_call' ? '<' : '>'} VWAP ${curr.vwap.toFixed(2)}`
  ))

  const sh = computeCandleShadows(curr.h, curr.l, curr.c)
  const sv = dir === 'bear_call' ? sh.upper : sh.lower
  const t3 = sv >= p.shadowMinPt
  details.push((t3 ? ok : bad)(
    `T3 ${dir === 'bear_call' ? 'upper' : 'lower'} shadow: ${sv.toFixed(1)}pt (need ≥${p.shadowMinPt}pt)`
  ))

  const passed = [t1, t2, t3].filter(Boolean).length
  return { pass: passed >= 2, details }
}

// ── Voter O ───────────────────────────────────────────────────────────────────

function voterO(
  spx: number, dir: Direction, mode: AddMode,
  gex: ReturnType<typeof extractGexData>,
  vix: number, vixCloses: number[],
  p: ThreeVoterConfig['params']
): VoterResult {
  const details: string[] = []

  if (!gex) {
    return { pass: false, details: [bad('No GEX data in market_summary — need gex_data.gamma_flip/call_wall/put_wall/gamma_regime')] }
  }

  const K = dir === 'bear_call'
    ? Math.ceil((spx + 65) / 5) * 5
    : Math.floor((spx - 65) / 5) * 5

  // O directional confirmation (oscillation + conflict modes only)
  if (mode !== 'trend-aligned') {
    const dc = dir === 'bear_call' ? spx > gex.gamma_flip : spx < gex.gamma_flip
    details.push((dc ? ok : bad)(
      `O Dir: SPX ${spx.toFixed(2)} ${dir === 'bear_call' ? '>' : '<'} Gamma Flip ${gex.gamma_flip}`
    ))
    if (!dc) {
      details.push('Direction mismatch → Voter O fails entirely')
      return { pass: false, details }
    }
  }

  const o1 = dir === 'bear_call'
    ? K > gex.gamma_flip + p.gammaFlipOffsetPt
    : K < gex.gamma_flip - p.gammaFlipOffsetPt
  const o1Target = dir === 'bear_call' ? gex.gamma_flip + p.gammaFlipOffsetPt : gex.gamma_flip - p.gammaFlipOffsetPt
  details.push((o1 ? ok : bad)(
    `O1 Gamma flip: strike ${K} ${dir === 'bear_call' ? '>' : '<'} flip ${gex.gamma_flip} ${dir === 'bear_call' ? '+' : '-'} ${p.gammaFlipOffsetPt} = ${o1Target}`
  ))

  const o2 = dir === 'bear_call' ? K >= gex.call_wall : K <= gex.put_wall
  const wall = dir === 'bear_call' ? gex.call_wall : gex.put_wall
  details.push((o2 ? ok : bad)(
    `O2 ${dir === 'bear_call' ? 'Call' : 'Put'} wall: strike ${K} ${dir === 'bear_call' ? '≥' : '≤'} wall ${wall}`
  ))

  const vix20ma = computeVix20MA(vixCloses)
  const ivFloor = vix20ma !== null ? vix20ma * p.ivCompressionFactor : null
  const o3a = ivFloor !== null && vix > ivFloor
  const o3b = Math.abs(K - spx) >= p.distanceMinPt
  const o3c = gex.gamma_regime === 'positive'
  const o3  = o3a && o3b && o3c

  details.push((o3a ? ok : bad)(
    `O3a IV: VIX ${vix.toFixed(1)} > 20MA×${p.ivCompressionFactor} = ${ivFloor?.toFixed(1) ?? 'n/a'}`
  ))
  details.push((o3b ? ok : bad)(
    `O3b Distance: |${K} − ${spx.toFixed(0)}| = ${Math.abs(K - spx).toFixed(0)}pt ≥ ${p.distanceMinPt}pt`
  ))
  details.push((o3c ? ok : bad)(
    `O3c Gamma regime: ${gex.gamma_regime} (need positive)`
  ))

  if (!o3) details.push('O3 mandatory — Voter O fails if O3 does not pass')

  const passed = [o1, o2, o3].filter(Boolean).length
  return { pass: passed >= 2 && o3, details }
}

// ── Voter B ───────────────────────────────────────────────────────────────────

function voterB(
  dir: Direction, mode: AddMode,
  addReadings: number[], vixChg: number,
  bThr: number, p: ThreeVoterConfig['params']
): VoterResult {
  const details: string[] = []
  const last3 = addReadings.slice(-p.b2Readings)
  const add   = addReadings.at(-1) ?? 0

  // B1
  let b1 = false
  if (mode !== 'trend-aligned') {
    b1 = true
    details.push(ok('B1 ADD direction: auto-pass (oscillation/conflict mode)'))
  } else {
    b1 = dir === 'bull_put' ? add > p.addTrendThreshold : add < -p.addTrendThreshold
    details.push((b1 ? ok : bad)(
      `B1 ADD: ${add.toFixed(0)} ${dir === 'bull_put' ? '> +' : '< -'}${p.addTrendThreshold}`
    ))
  }

  // B2
  let b2 = false
  if (mode === 'conflict') {
    const opposing = last3.map(a => dir === 'bull_put' ? a < -300 : a > 300)
    let maxConsec = 0, cur = 0
    for (const o of opposing) { cur = o ? cur + 1 : 0; maxConsec = Math.max(maxConsec, cur) }
    b2 = maxConsec < 2
    details.push((b2 ? ok : bad)(
      `B2 Conflict stability: max consecutive opposing |ADD|>300 = ${maxConsec} (need <2) [${last3.join(', ')}]`
    ))
  } else {
    const sameDir = last3.filter(a => dir === 'bull_put' ? a > 0 : a < 0).length
    b2 = sameDir >= 2
    details.push((b2 ? ok : bad)(
      `B2 Stability: ${sameDir}/${last3.length} readings ${dir === 'bull_put' ? 'positive' : 'negative'} [${last3.join(', ')}]`
    ))
  }

  // B3
  const b3 = vixChg < p.vixChangeStopPt
  details.push((b3 ? ok : bad)(
    `B3 VIX stability: change ${vixChg >= 0 ? '+' : ''}${vixChg.toFixed(1)}pt (need < +${p.vixChangeStopPt}pt)`
  ))

  const passed = [b1, b2, b3].filter(Boolean).length
  return { pass: passed >= bThr, details }
}

// ── Position Management (K4 active) ──────────────────────────────────────────

function positionAdvisory(
  trade: TradeWithExits,
  ctx: EvalContext,
  gex: ReturnType<typeof extractGexData>,
  p: ThreeVoterConfig['params']
): string {
  const dir: Direction = trade.optionType === 'CALL' ? 'bear_call' : 'bull_put'
  const credit = trade.entryPrice ?? 0
  const time   = currentEtTime()
  const lines: string[] = []

  lines.push('## Open Position')
  lines.push(
    `${trade.symbol} ${trade.optionType ?? ''} ${trade.strike ?? ''} ×${trade.quantityRemaining} ` +
    `CREDIT @ $${credit.toFixed(2)} | Direction: ${dir === 'bear_call' ? 'Bear Call' : 'Bull Put'}`
  )
  lines.push('')
  lines.push('## Exit Condition Check')
  lines.push('')

  // TP2 — time target
  lines.push('### TP2 — Time Target (13:45 ET)')
  if (time >= '13:45') {
    lines.push(`> ⚠️ **CONSIDER TAKING PROFIT** — ${time} ET ≥ 13:45 ET.`)
    lines.push(`> Exit if spread ≤ ${(p.tp2Multiplier * 100).toFixed(0)}% of entry credit ($${(credit * p.tp2Multiplier).toFixed(2)}).`)
  } else {
    lines.push(`> ${time} ET — TP2 window not yet open.`)
  }
  lines.push('')

  // SL2 — ADD reversal
  lines.push('### SL2 — ADD Reversal')
  const last3 = ctx.addReadings.slice(-3)
  if (last3.length < 2) {
    lines.push('> Insufficient ADD readings (need ≥2).')
  } else {
    const reversedCount = last3.filter(a => dir === 'bull_put' ? a < 0 : a > 0).length
    if (reversedCount >= 2) {
      lines.push(`> ⚠️ **MONITOR FOR STOP LOSS** — ADD showing reversal [${last3.join(', ')}].`)
      lines.push(`> Stop loss triggers at ${(p.sl1Multiplier * 100).toFixed(0)}% loss — spread price ≥ $${(credit * p.sl1Multiplier).toFixed(2)}.`)
    } else {
      lines.push(`> ADD not persistently reversed [${last3.join(', ')}] — HOLD.`)
    }
  }
  lines.push('')

  // TP3 — Voter O reversal
  lines.push('### TP3 — Voter O Reversal')
  if (!gex) {
    lines.push('> GEX data unavailable — cannot evaluate TP3.')
  } else {
    const vix = ctx.vixReadings.at(-1) ?? 0
    const spx = ctx.todayCandles.at(-1)?.c ?? 0
    const o = voterO(spx, dir, 'trend-aligned', gex, vix, ctx.vixDailyCloses, p)
    if (!o.pass) {
      lines.push('> ⚠️ **Voter O has reversed — consider TP3 exit.**')
      o.details.forEach(d => lines.push(`> - ${d}`))
    } else {
      lines.push('> Voter O still holds — HOLD.')
    }
  }

  return lines.join('\n')
}

// ── Main evaluate ─────────────────────────────────────────────────────────────

function evaluate(ctx: EvalContext, config: unknown): EvaluationResult {
  const cfg  = config as ThreeVoterConfig
  const { params: p } = cfg
  const lines: string[] = []
  const time = currentEtTime()

  lines.push(`# Three-Voter Evaluation — v1.3 | ${time} ET`)
  lines.push('')

  // Layer 1: Kill switches
  const killReasons = checkKillSwitches(ctx, cfg)
  const k4Reason    = killReasons.find(r => r.startsWith('K4'))
  const otherKills  = killReasons.filter(r => !r.startsWith('K4'))

  lines.push('## Kill Switches')

  if (otherKills.length > 0) {
    otherKills.forEach(r => lines.push(`- ${bad(r)}`))
    lines.push('')
    lines.push('**Status: HALT**')
    return { result: 'HALT', markdown: lines.join('\n') }
  }

  if (k4Reason) {
    lines.push('- ' + ok('K1–K2, K5–K6: Clear'))
    lines.push(`- ${bad(k4Reason)}`)
    lines.push('')
    const gex    = extractGexData(ctx.marketSummary)
    lines.push(positionAdvisory(ctx.openTrades[0], ctx, gex, p))
    lines.push('')
    lines.push('---')
    lines.push('**Status: HALT** — No new positions while a position is open.')
    return { result: 'HALT', markdown: lines.join('\n') }
  }

  lines.push('- ' + ok('All clear'))
  lines.push('')

  // Need ≥2 closed candles
  const candles = ctx.todayCandles
  if (candles.length < 2) {
    lines.push('## Insufficient Data')
    lines.push('Need ≥2 closed 5-min candles. Market may not have opened yet.')
    return { result: 'WAIT', markdown: lines.join('\n') }
  }

  // Layer 2: ADD mode
  const curr   = candles.at(-1)!
  const spx    = curr.c
  const vwap   = curr.vwap
  const t2Dir: Direction = spx < vwap ? 'bear_call' : 'bull_put'
  const add    = ctx.addReadings.at(-1) ?? 0
  const { mode, direction, bThr, label } = determineMode(add, t2Dir, p.addTrendThreshold)

  lines.push('## Mode Analysis')
  lines.push(`- SPX: ${spx.toFixed(2)} | VWAP: ${vwap.toFixed(2)} → T2 direction: **${t2Dir === 'bear_call' ? 'Bear Call' : 'Bull Put'}**`)
  lines.push(`- ADD: ${add.toFixed(0)} (threshold ±${p.addTrendThreshold})`)
  lines.push(`- **Mode: ${label}**`)
  lines.push(`- **Evaluation direction: ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'}**`)
  lines.push('')

  // O directional confirmation early exit (oscillation + conflict modes)
  const gex = extractGexData(ctx.marketSummary)
  if (mode !== 'trend-aligned' && gex) {
    const dc = direction === 'bear_call' ? spx > gex.gamma_flip : spx < gex.gamma_flip
    if (!dc) {
      lines.push('## O Directional Confirmation — ❌ Failed')
      lines.push(
        `SPX ${spx.toFixed(2)} does not confirm ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'} ` +
        `direction relative to Gamma Flip ${gex.gamma_flip}`
      )
      lines.push('')
      lines.push('**Status: WAIT** — Directional confirmation required in oscillation/conflict mode.')
      return { result: 'WAIT', direction, addMode: mode, markdown: lines.join('\n') }
    }
  }

  const vix    = ctx.vixReadings.at(-1) ?? 0
  const vixChg = computeVixChange(vix, ctx.vixDailyCloses.at(-1) ?? 0)

  // Layer 3: voters
  const tResult = voterT(ctx, direction, p)
  lines.push(`## Voter T — Technical ${tResult.pass ? '✅ PASS' : '❌ FAIL'}`)
  tResult.details.forEach(d => lines.push(`- ${d}`))
  lines.push('')

  const oResult = voterO(spx, direction, mode, gex, vix, ctx.vixDailyCloses, p)
  lines.push(`## Voter O — Options Structure ${oResult.pass ? '✅ PASS' : '❌ FAIL'}`)
  oResult.details.forEach(d => lines.push(`- ${d}`))
  lines.push('')

  const bResult = voterB(direction, mode, ctx.addReadings, vixChg, bThr, p)
  lines.push(`## Voter B — Breadth ${bResult.pass ? '✅ PASS' : '❌ FAIL'} (threshold ${bThr}/3)`)
  bResult.details.forEach(d => lines.push(`- ${d}`))
  lines.push('')

  // Layer 4: decision
  const votes  = [tResult.pass, oResult.pass, bResult.pass].filter(Boolean).length
  const o3Pass = oResult.details.some(d => d.includes('O3a') && d.startsWith('✅'))
             && oResult.details.some(d => d.includes('O3b') && d.startsWith('✅'))
             && oResult.details.some(d => d.includes('O3c') && d.startsWith('✅'))

  lines.push('---')
  lines.push(
    `**Votes: ${votes}/3** — ` +
    `T: ${tResult.pass ? 'PASS' : 'FAIL'} | ` +
    `O: ${oResult.pass ? 'PASS' : 'FAIL'} | ` +
    `B: ${bResult.pass ? 'PASS' : 'FAIL'}`
  )
  lines.push('')

  if (votes >= 2 && o3Pass) {
    const hrs = remainingHoursToClose()
    const { shortStrike, longStrike, credit } = computeSpreadCredit(spx, direction, vix, hrs, p.riskFreeRate)
    lines.push(`# ✅ GO — ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'}`)
    lines.push('')
    lines.push('## Trade Parameters')
    lines.push(`- **Direction:** ${direction === 'bear_call' ? 'Bear Call' : 'Bull Put'}`)
    lines.push(`- **Short Strike:** ${shortStrike} | **Long Strike:** ${longStrike}`)
    lines.push(`- **Est. Credit:** $${credit.toFixed(2)} (VIX ${vix.toFixed(1)}, ${hrs.toFixed(1)}h remaining)`)
    lines.push(`- **Stop Loss (SL1):** spread ≥ $${(credit * p.sl1Multiplier).toFixed(2)} (${(p.sl1Multiplier * 100).toFixed(0)}% loss)`)
    lines.push(`- **Take Profit (TP1):** spread ≤ $${(credit * p.tp1Multiplier).toFixed(2)} (${((1 - p.tp1Multiplier) * 100).toFixed(0)}% profit)`)
    lines.push(`- **Take Profit (TP2):** spread ≤ $${(credit * p.tp2Multiplier).toFixed(2)} after 13:45 ET`)
    return { result: 'GO', direction, addMode: mode, shortStrike, longStrike, estimatedCredit: credit, markdown: lines.join('\n') }
  }

  if (votes >= 1 || (votes === 2 && !o3Pass)) {
    const reason = votes >= 2 && !o3Pass ? ' (O3 mandatory — did not pass)' : ''
    lines.push(`# ⏳ WAIT — ${votes}/3 voters pass${reason}`)
    return { result: 'WAIT', direction, addMode: mode, markdown: lines.join('\n') }
  }

  lines.push('# ❌ NO-GO — 0/3 voters pass')
  return { result: 'NO-GO', direction, addMode: mode, markdown: lines.join('\n') }
}

export const threeVoterV1Service: RuleService = { evaluate }
