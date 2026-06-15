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

interface ActivePos {
  direction:       'bear_call' | 'bull_put'
  shortStrike:     number
  longStrike:      number
  entryCredit:     number
  entryTime:       string
  entryAdd:        number
  entryAddPresent: boolean
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

  let activePosition: ActivePos | null = null
  const bars:   BacktestBarRow[] = []
  const trades: BacktestTrade[]  = []

  for (let i = 0; i < scanCandles.length; i++) {
    const barCandle = scanCandles[i]
    const barTime   = barCandle.t.slice(-5)      // "HH:mm" bar open time
    const evalTime  = addFiveMinutes(barTime)     // "HH:mm" evaluation time (bar close)

    // Candles with open time ≤ barTime = all bars closed by evalTime; snapshots up to evalTime
    const closedCandles = allCandles.filter(c => c.t.slice(-5) <= barTime)
    const addReadings   = allSnapshots.filter(s => s.time <= evalTime && s.add  != null).map(s => s.add!)
    const tickReadings  = allSnapshots.filter(s => s.time <= evalTime && s.tick != null).map(s => s.tick!)
    const vixReadings   = allSnapshots.filter(s => s.time <= evalTime && s.vix  != null).map(s => s.vix!)
    const currentVix    = vixReadings.at(-1) ?? 0
    const currentSpx    = barCandle.c
    const hoursLeft     = remainingHoursFromBarTime(evalTime)

    if (activePosition) {
      const pos          = activePosition
      const currentPrice = computeCurrentSpreadPrice(
        currentSpx, pos.direction, pos.shortStrike, pos.longStrike,
        currentVix, hoursLeft, params.riskFreeRate ?? 0.04
      )

      // SL2: ADD reversed to opposing trend since entry (three-voter concept; skipped when param absent)
      const last3Add   = addReadings.slice(-3)
      const sl2ThrRaw  = params.addTrendThreshold  // undefined for rules that don't define it
      const entryWasOpposing = sl2ThrRaw !== undefined && pos.entryAddPresent && (
        pos.direction === 'bear_call' ? pos.entryAdd > sl2ThrRaw : pos.entryAdd < -sl2ThrRaw
      )
      const sl2 = sl2ThrRaw !== undefined &&
        pos.entryAddPresent && !entryWasOpposing && last3Add.length >= 3 &&
        last3Add.every(a => pos.direction === 'bull_put' ? a < -sl2ThrRaw : a > sl2ThrRaw)

      const tp2Time = (params as unknown as Record<string, string>).tp2TimeET ?? '13:45'

      let exitReason: BacktestBarRow['exitReason'] | null = null
      if      (currentPrice >= pos.entryCredit * (params.sl1Multiplier ?? 2.0))                        exitReason = 'SL1'
      else if (currentPrice <= pos.entryCredit * (params.tp1Multiplier ?? 0.3))                        exitReason = 'TP1'
      else if (evalTime >= tp2Time && currentPrice <= pos.entryCredit * (params.tp2Multiplier ?? 0.5)) exitReason = 'TP2'
      else if (sl2)                                                                                     exitReason = 'SL2'
      else if (evalTime >= scanEnd)                                                                     exitReason = 'FORCED'

      if (exitReason) {
        const pnl = Math.round((pos.entryCredit - currentPrice) * 100 * 100) / 100
        trades.push({
          direction:   pos.direction,
          entryTime:   pos.entryTime,
          shortStrike: pos.shortStrike,
          longStrike:  pos.longStrike,
          entryCredit: pos.entryCredit,
          exitTime:    evalTime,
          exitPrice:   currentPrice,
          exitReason,
          pnl,
        })
        bars.push({
          time:         evalTime,
          summary:      `EXIT (${exitReason})`,
          decision:     'HALT',
          hasPosition:  true,
          isExit:       true,
          exitReason,
          shortStrike:  pos.shortStrike,
          longStrike:   pos.longStrike,
          entryCredit:  pos.entryCredit,
          currentPrice,
        })
        activePosition = null
      } else {
        bars.push({
          time:         evalTime,
          summary:      'HALT (position open)',
          decision:     'HALT',
          hasPosition:  true,
          shortStrike:  pos.shortStrike,
          longStrike:   pos.longStrike,
          entryCredit:  pos.entryCredit,
          currentPrice,
        })
      }
    } else {
      const ctx: EvalContext = {
        todayCandles:   closedCandles,
        addReadings,
        tickReadings,
        vixReadings,
        openTrades:     [],
        tradesToday:    trades.length,
        marketSummary,
        vixDailyCloses,
        prevSpxClose,
        currentTimeET:  evalTime,
      }

      const evalResult = service.evaluate(ctx, config)

      if (evalResult.result === 'GO' && evalResult.estimatedCredit != null && evalResult.shortStrike != null) {
        activePosition = {
          direction:       evalResult.direction!,
          shortStrike:     evalResult.shortStrike,
          longStrike:      evalResult.longStrike!,
          entryCredit:     evalResult.estimatedCredit,
          entryTime:       evalTime,
          entryAdd:        addReadings.at(-1) ?? 0,
          entryAddPresent: addReadings.length > 0,
        }
        bars.push({
          time:         evalTime,
          summary:      evalResult.backtestSummary ?? evalResult.result,
          markdown:     evalResult.markdown,
          decision:     'GO',
          direction:    evalResult.direction,
          hasPosition:  false,
          isEntry:      true,
          shortStrike:  evalResult.shortStrike,
          longStrike:   evalResult.longStrike,
          entryCredit:  evalResult.estimatedCredit,
        })
      } else {
        bars.push({
          time:        evalTime,
          summary:     evalResult.backtestSummary ?? evalResult.result,
          markdown:    evalResult.markdown,
          decision:    evalResult.result,
          direction:   evalResult.direction,
          hasPosition: false,
        })
      }
    }
  }

  // Force-close any remaining position (fires when GO fires on the last scanCandle)
  if (activePosition && scanCandles.length > 0) {
    const last      = scanCandles.at(-1)!
    const evalTime  = addFiveMinutes(last.t.slice(-5))
    const lastVix   = allSnapshots.filter(s => s.vix != null && s.time <= evalTime).at(-1)?.vix ?? 0
    const hoursLeft = remainingHoursFromBarTime(evalTime)
    const exitPrice = computeCurrentSpreadPrice(
      last.c, activePosition.direction,
      activePosition.shortStrike, activePosition.longStrike,
      lastVix, hoursLeft, params.riskFreeRate ?? 0.04
    )
    const pnl = Math.round((activePosition.entryCredit - exitPrice) * 100 * 100) / 100
    trades.push({
      direction:   activePosition.direction,
      entryTime:   activePosition.entryTime,
      shortStrike: activePosition.shortStrike,
      longStrike:  activePosition.longStrike,
      entryCredit: activePosition.entryCredit,
      exitTime:    evalTime,
      exitPrice,
      exitReason:  'FORCED',
      pnl,
    })
    bars.push({
      time:         evalTime,
      summary:      'EXIT (FORCED)',
      decision:     'HALT',
      hasPosition:  true,
      isExit:       true,
      exitReason:   'FORCED',
      shortStrike:  activePosition.shortStrike,
      longStrike:   activePosition.longStrike,
      entryCredit:  activePosition.entryCredit,
      currentPrice: exitPrice,
    })
  }

  const totalPnl = Math.round(trades.reduce((s, t) => s + (t.pnl ?? 0), 0) * 100) / 100
  return { date, ruleId, bars, trades, totalPnl }
}
