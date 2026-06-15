import type { RuleService } from './types.js'
import type { SpxCandle } from '../services/marketData.js'
import { computeCurrentSpreadPrice, remainingHoursFromBarTime, addFiveMinutes } from './calculations.js'
import type { EvalContext, BacktestBarRow, BacktestTrade, BacktestResponse } from './types.js'

export interface BacktestInput {
  date:           string
  allCandles:     SpxCandle[]
  allSnapshots:   { time: string; vix?: number | null; add?: number | null; tick?: number | null }[]
  marketSummary:  unknown
  vixDailyCloses: number[]
  prevSpxClose:   number | null
}

export function runBacktest(
  ruleId:  string,
  service: RuleService,
  config:  unknown,
  input:   BacktestInput,
): BacktestResponse {
  const { date, allCandles, allSnapshots, marketSummary, vixDailyCloses, prevSpxClose } = input

  const cfg       = config as { scanWindowStart: string; scanWindowEnd: string; params: Record<string, number> }
  const params    = cfg.params
  const scanStart = cfg.scanWindowStart ?? '10:15'
  const scanEnd   = cfg.scanWindowEnd   ?? '15:00'

  // t is bar open time; filter by close time (open + 5 min) so window boundaries are close times
  const scanCandles = allCandles.filter(c => {
    const closeTime = addFiveMinutes(c.t.slice(-5))
    return closeTime >= scanStart && closeTime <= scanEnd
  })

  const bars:   BacktestBarRow[] = []
  const trades: BacktestTrade[]  = []

  const tp2Time   = (params as unknown as Record<string, string>).tp2TimeET ?? '13:45'
  const sl2ThrRaw = params.addTrendThreshold  // undefined for rules that don't define it (e.g. sniper)

  // ── Outer loop: evaluate each bar independently with no prior state ────────
  for (let i = 0; i < scanCandles.length; i++) {
    const barCandle = scanCandles[i]
    const barTime   = barCandle.t.slice(-5)      // "HH:mm" bar open time
    const evalTime  = addFiveMinutes(barTime)     // "HH:mm" evaluation time (bar close)

    // Candles with open time ≤ barTime = all bars closed by evalTime
    const closedCandles = allCandles.filter(c => c.t.slice(-5) <= barTime)
    const addReadings   = allSnapshots.filter(s => s.time <= evalTime && s.add  != null).map(s => s.add!)
    const tickReadings  = allSnapshots.filter(s => s.time <= evalTime && s.tick != null).map(s => s.tick!)
    const vixReadings   = allSnapshots.filter(s => s.time <= evalTime && s.vix  != null).map(s => s.vix!)

    // Always clean slate: no open trades, no prior trade count
    const ctx: EvalContext = {
      todayCandles:   closedCandles,
      addReadings,
      tickReadings,
      vixReadings,
      openTrades:     [],
      tradesToday:    0,
      marketSummary,
      vixDailyCloses,
      prevSpxClose,
      currentTimeET:  evalTime,
    }

    const evalResult = service.evaluate(ctx, config)

    if (evalResult.result === 'GO' && evalResult.estimatedCredit != null && evalResult.shortStrike != null) {
      const direction     = evalResult.direction!
      const shortStrike   = evalResult.shortStrike
      const longStrike    = evalResult.longStrike!
      const entryCredit   = evalResult.estimatedCredit
      const entryAdd      = addReadings.at(-1) ?? 0
      const entryAddPresent = addReadings.length > 0

      // ── Inner loop: scan bars after X to find the exit ──────────────────
      type ExitReason = 'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
      let exitTime:   string    | undefined
      let exitPrice:  number    | undefined
      let exitReason: ExitReason | undefined

      for (let j = i + 1; j < scanCandles.length; j++) {
        const bY         = scanCandles[j]
        const evalTimeY  = addFiveMinutes(bY.t.slice(-5))
        const addY       = allSnapshots.filter(s => s.time <= evalTimeY && s.add != null).map(s => s.add!)
        const vixY       = allSnapshots.filter(s => s.time <= evalTimeY && s.vix != null).map(s => s.vix!).at(-1) ?? 0
        const hoursLeftY = remainingHoursFromBarTime(evalTimeY)
        const price      = computeCurrentSpreadPrice(bY.c, direction, shortStrike, longStrike, vixY, hoursLeftY, params.riskFreeRate ?? 0.04)

        const last3Add = addY.slice(-3)
        const entryWasOpposing = sl2ThrRaw !== undefined && entryAddPresent && (
          direction === 'bear_call' ? entryAdd > sl2ThrRaw : entryAdd < -sl2ThrRaw
        )
        const sl2 = sl2ThrRaw !== undefined &&
          entryAddPresent && !entryWasOpposing && last3Add.length >= 3 &&
          last3Add.every(a => direction === 'bull_put' ? a < -sl2ThrRaw : a > sl2ThrRaw)

        let reason: ExitReason | undefined
        if      (price >= entryCredit * (params.sl1Multiplier ?? 2.0))                         reason = 'SL1'
        else if (price <= entryCredit * (params.tp1Multiplier ?? 0.3))                         reason = 'TP1'
        else if (evalTimeY >= tp2Time && price <= entryCredit * (params.tp2Multiplier ?? 0.5)) reason = 'TP2'
        else if (sl2)                                                                           reason = 'SL2'
        else if (evalTimeY >= scanEnd)                                                          reason = 'FORCED'

        if (reason) {
          exitTime   = evalTimeY
          exitPrice  = price
          exitReason = reason
          break
        }
      }

      const pnl = exitPrice != null
        ? Math.round((entryCredit - exitPrice) * 100 * 100) / 100
        : undefined

      bars.push({
        time:      evalTime,
        summary:   evalResult.backtestSummary ?? evalResult.result,
        markdown:  evalResult.markdown,
        decision:  'GO',
        direction,
        trade: { shortStrike, longStrike, entryCredit, exitTime, exitPrice, exitReason, pnl },
      })
      trades.push({
        direction,
        entryTime:   evalTime,
        shortStrike,
        longStrike,
        entryCredit,
        exitTime,
        exitPrice,
        exitReason,
        pnl,
      })
    } else {
      bars.push({
        time:      evalTime,
        summary:   evalResult.backtestSummary ?? evalResult.result,
        markdown:  evalResult.markdown,
        decision:  evalResult.result,
        direction: evalResult.direction,
      })
    }
    // move to bar X+1 with clean slate — no state carried over
  }

  const totalPnl = Math.round(trades.reduce((s, t) => s + (t.pnl ?? 0), 0) * 100) / 100
  return { date, ruleId, bars, trades, totalPnl }
}
