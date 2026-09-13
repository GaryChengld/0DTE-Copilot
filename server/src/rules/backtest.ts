import type { RuleService } from './types.js'
import type { SpxCandle } from '../services/marketData.js'
import type { TradeWithExits } from '../db/tradeRepository.js'
import { computeCurrentSpreadPrice, remainingHoursFromBarTime, addFiveMinutes, type Direction } from './calculations.js'
import type { EvalContext, BacktestBarRow, BacktestBarTrade, BacktestTrade, BacktestResponse } from './types.js'

export interface BacktestInput {
  date:           string
  allCandles:     SpxCandle[]
  allSnapshots:   { time: string; vix?: number | null; add?: number | null; tick?: number | null }[]
  marketSummary:  unknown
  vixDailyCloses: number[]
  prevSpxClose:   number | null
}

type ExitReason = NonNullable<BacktestBarTrade['exitReason']>

// A simulated position, carried across bars until an exit fires
interface OpenPosition {
  direction:       Direction
  shortStrike:     number
  longStrike:      number
  entryCredit:     number
  entryAdd:        number
  entryAddPresent: boolean
  barTrade:        BacktestBarTrade   // shown on the entry bar row; exit fields filled in on exit
  trade:           BacktestTrade      // same trade in the flat summary list
  asTrade:         TradeWithExits     // what the rule sees in ctx.openTrades
}

const r2 = (n: number) => Math.round(n * 100) / 100

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

  // VIX readings up to `time`; null/0 readings are dropped so the last valid reading carries forward
  const vixUpTo = (time: string) =>
    allSnapshots.filter(s => s.time <= time && s.vix != null && s.vix > 0).map(s => s.vix!)

  // Exit check for an open position on one bar.
  // SL1 / TP1 are resting orders: triggered by the bar's high/low, filled at the level (or at the
  // bar open if price gapped through it). SL1 wins when both are touched in the same bar.
  // TP2 / SL2 / FORCED are decided on the bar close.
  function checkExit(
    pos: OpenPosition, bar: SpxCandle, barTime: string, evalTime: string, addReadings: number[],
  ): { reason: ExitReason; price: number } | null {
    const vix   = vixUpTo(evalTime).at(-1)!   // non-empty: the position was entered with a valid VIX
    // Intrabar prices use the bar open time (more time value) — conservative for both SL and TP
    const price = (spx: number, time: string) =>
      computeCurrentSpreadPrice(spx, pos.direction, pos.shortStrike, pos.longStrike, vix, remainingHoursFromBarTime(time))

    const adverseSpx   = pos.direction === 'bear_call' ? bar.h : bar.l
    const favorableSpx = pos.direction === 'bear_call' ? bar.l : bar.h
    const openPx       = price(bar.o, barTime)
    const sl1Level     = pos.entryCredit * (params.sl1Multiplier ?? 2.0)
    const tp1Level     = pos.entryCredit * (params.tp1Multiplier ?? 0.3)

    if (price(adverseSpx, barTime)   >= sl1Level) return { reason: 'SL1', price: r2(Math.max(sl1Level, openPx)) }
    if (price(favorableSpx, barTime) <= tp1Level) return { reason: 'TP1', price: r2(Math.min(tp1Level, openPx)) }

    const closePx = price(bar.c, evalTime)

    const last3Add = addReadings.slice(-3)
    const entryWasOpposing = sl2ThrRaw !== undefined && pos.entryAddPresent && (
      pos.direction === 'bear_call' ? pos.entryAdd > sl2ThrRaw : pos.entryAdd < -sl2ThrRaw
    )
    const sl2 = sl2ThrRaw !== undefined &&
      pos.entryAddPresent && !entryWasOpposing && last3Add.length >= 3 &&
      last3Add.every(a => pos.direction === 'bull_put' ? a < -sl2ThrRaw : a > sl2ThrRaw)

    if (evalTime >= tp2Time && closePx <= pos.entryCredit * (params.tp2Multiplier ?? 0.5)) return { reason: 'TP2', price: closePx }
    if (sl2)                                                                             return { reason: 'SL2', price: closePx }
    if (evalTime >= scanEnd)                                                             return { reason: 'FORCED', price: closePx }
    return null
  }

  let open: OpenPosition[] = []
  let tradesToday = 0

  // ── Walk the day bar by bar; open positions and the trade count carry forward ──
  for (const bar of scanCandles) {
    const barTime  = bar.t.slice(-5)          // "HH:mm" bar open time
    const evalTime = addFiveMinutes(barTime)  // "HH:mm" evaluation time (bar close)

    // Candles with open time ≤ barTime = all bars closed by evalTime
    const closedCandles = allCandles.filter(c => c.t.slice(-5) <= barTime)
    const addReadings   = allSnapshots.filter(s => s.time <= evalTime && s.add  != null).map(s => s.add!)
    const tickReadings  = allSnapshots.filter(s => s.time <= evalTime && s.tick != null).map(s => s.tick!)
    const vixReadings   = vixUpTo(evalTime)

    // 1. Exits for positions entered on earlier bars
    open = open.filter(pos => {
      const exit = checkExit(pos, bar, barTime, evalTime, addReadings)
      if (!exit) return true
      const pnl = r2((pos.entryCredit - exit.price) * 100)
      const fields = { exitTime: evalTime, exitPrice: exit.price, exitReason: exit.reason, pnl }
      Object.assign(pos.barTrade, fields)
      Object.assign(pos.trade, fields)
      return false
    })

    // No valid VIX yet — spread pricing is meaningless, so skip evaluation and enter no trade
    if (vixReadings.length === 0) {
      bars.push({
        time:     evalTime,
        summary:  'MISSING DATA — no VIX reading',
        markdown: `# ⚪ MISSING DATA | ${evalTime} ET\n\nNo valid VIX reading (null or 0) at or before ${evalTime} ET. Bar not evaluated — no trade entered.`,
        decision: 'HALT',
      })
      continue
    }

    // 2. Entry evaluation — the rule sees the simulated open positions and today's trade count
    const ctx: EvalContext = {
      todayCandles:   closedCandles,
      addReadings,
      tickReadings,
      vixReadings,
      openTrades:     open.map(p => p.asTrade),
      tradesToday,
      marketSummary,
      vixDailyCloses,
      prevSpxClose,
      currentTimeET:  evalTime,
    }

    const evalResult = service.evaluate(ctx, config)
    const summary    = evalResult.backtestSummary ?? evalResult.result

    const credit = evalResult.estimatedCredit
    if (evalResult.result === 'GO' && credit != null && evalResult.shortStrike != null) {
      if (credit <= 0) {
        bars.push({
          time: evalTime, summary: `${summary} — not entered (est. credit $0.00)`, markdown: evalResult.markdown,
          decision: 'GO', direction: evalResult.direction,
        })
        continue
      }

      const direction   = evalResult.direction!
      const shortStrike = evalResult.shortStrike
      const longStrike  = evalResult.longStrike!
      const barTrade: BacktestBarTrade = { shortStrike, longStrike, entryCredit: credit }
      const trade:    BacktestTrade    = { direction, entryTime: evalTime, shortStrike, longStrike, entryCredit: credit }

      tradesToday++
      open.push({
        direction, shortStrike, longStrike, entryCredit: credit,
        entryAdd:        addReadings.at(-1) ?? 0,
        entryAddPresent: addReadings.length > 0,
        barTrade, trade,
        asTrade: {
          id: tradesToday, tradeDate: date, status: 'OPEN', symbol: 'SPX',
          tradeType: 'SPREAD', spreadType: 'CREDIT',
          optionType: direction === 'bear_call' ? 'CALL' : 'PUT',
          strike: `${shortStrike}/${longStrike}`,
          quantityInitial: 1, quantityRemaining: 1,
          entryPrice: credit, entryTime: `${date}T${evalTime}:00`,
          exits: [],
        },
      })

      bars.push({ time: evalTime, summary, markdown: evalResult.markdown, decision: 'GO', direction, trade: barTrade })
      trades.push(trade)
    } else {
      bars.push({ time: evalTime, summary, markdown: evalResult.markdown, decision: evalResult.result, direction: evalResult.direction })
    }
  }

  const totalPnl = r2(trades.reduce((s, t) => s + (t.pnl ?? 0), 0))
  return { date, ruleId, bars, trades, totalPnl }
}
