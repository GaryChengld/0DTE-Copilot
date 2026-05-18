import { Router, Request, Response } from 'express'
import { getRuleServiceAndConfig } from '../rules/engine.js'
import { getReplayDataByDate } from '../db/replayDataRepository.js'
import {
  fetchVixDailyClosesUpTo,
  fetchSpxPrevDayCloseFor,
  type SpxCandle,
} from '../services/marketData.js'
import { computeCurrentSpreadPrice, remainingHoursFromBarTime } from '../rules/calculations.js'
import type {
  EvalContext,
  BacktestBarRow, BacktestTrade, BacktestResponse, VoterDetail,
} from '../rules/types.js'

const router = Router()

interface ReplayCandle {
  t: string; o: number; h: number; l: number; c: number; v: number; vwap?: number
}
interface ReplaySnapshot {
  time: string; vix?: number | null; add?: number | null; tick?: number | null
}
interface ReplayData {
  market_data: {
    spx: { candles_5m: ReplayCandle[] }
    other_indexes_history?: ReplaySnapshot[]
  }
  market_summary?: unknown
}

const EMPTY_DETAIL: VoterDetail = {
  bullPut:  { t: false, o: false, b: false },
  bearCall: { t: false, o: false, b: false },
}

function addFiveMinutes(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total  = h * 60 + m + 5
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function toSpxCandle(c: ReplayCandle, date: string): SpxCandle {
  return {
    t: `${date}T${c.t}`,
    o: c.o, h: c.h, l: c.l, c: c.c, v: c.v,
    vwap: c.vwap ?? c.c,
    rsi:  null,
    open: false,
  }
}

router.post('/backtest/:ruleId', async (req: Request, res: Response) => {
  const ruleId = String(req.params.ruleId)
  const date   = String(req.query.date ?? '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date query param required in YYYY-MM-DD format' })
    return
  }

  try {
    const raw = await getReplayDataByDate(date)
    if (!raw) {
      res.status(404).json({ error: `No replay data cached for ${date}. Open the Replay tab for this date first to cache it.` })
      return
    }
    const replay = raw as ReplayData

    // Fetch historical market context from Yahoo Finance
    const upToDate = new Date(`${date}T20:00:00Z`)
    const [vixDailyCloses, prevSpxClose] = await Promise.all([
      fetchVixDailyClosesUpTo(22, upToDate),
      fetchSpxPrevDayCloseFor(upToDate),
    ])

    const allCandles:   SpxCandle[]      = (replay.market_data.spx.candles_5m ?? []).map(c => toSpxCandle(c, date))
    const allSnapshots: ReplaySnapshot[] = replay.market_data.other_indexes_history ?? []
    const marketSummary                  = replay.market_summary ?? null

    const { service, config } = await getRuleServiceAndConfig(ruleId)
    const params = (config as { params: Record<string, number> }).params

    // Scan window: bar open times 10:10–13:55 → eval times 10:15–14:00
    const scanCandles = allCandles.filter(c => {
      const t = c.t.slice(-5)
      return t >= '10:10' && t <= '13:55'
    })

    interface ActivePos {
      direction:   'bear_call' | 'bull_put'
      shortStrike: number
      longStrike:  number
      entryCredit: number
      entryTime:   string
    }
    let activePosition: ActivePos | null = null

    const bars:   BacktestBarRow[] = []
    const trades: BacktestTrade[]  = []

    for (let i = 0; i < scanCandles.length; i++) {
      const barCandle = scanCandles[i]
      const barTime   = barCandle.t.slice(-5)      // "HH:mm" bar open time
      const evalTime  = addFiveMinutes(barTime)     // "HH:mm" evaluation time (bar closed)

      // Snapshot: candles closed by this bar, snapshots up to eval time
      const closedCandles = allCandles.filter(c => c.t.slice(-5) <= barTime)
      const addReadings   = allSnapshots.filter(s => s.time <= evalTime && s.add  != null).map(s => s.add!)
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

        // SL2: last 3 ADD readings all opposing position direction (≥15-min reversal proxy)
        const last3Add = addReadings.slice(-3)
        const sl2      = last3Add.length >= 3 &&
          last3Add.every(a => pos.direction === 'bull_put' ? a < 0 : a > 0)

        let exitReason: BacktestBarRow['exitReason'] | null = null
        if      (currentPrice >= pos.entryCredit * (params.sl1Multiplier ?? 2.0))   exitReason = 'SL1'
        else if (currentPrice <= pos.entryCredit * (params.tp1Multiplier ?? 0.3))   exitReason = 'TP1'
        else if (evalTime >= '13:45' && currentPrice <= pos.entryCredit * (params.tp2Multiplier ?? 0.5)) exitReason = 'TP2'
        else if (sl2) exitReason = 'SL2'

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
            voterDetail:  EMPTY_DETAIL,
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
            voterDetail:  EMPTY_DETAIL,
            decision:     'HALT',
            hasPosition:  true,
            shortStrike:  pos.shortStrike,
            longStrike:   pos.longStrike,
            entryCredit:  pos.entryCredit,
            currentPrice,
          })
        }
      } else {
        // ── Call the same evaluate() as realtime — rule service is data-agnostic ──
        const ctx: EvalContext = {
          todayCandles:   closedCandles,
          addReadings,
          vixReadings,
          openTrades:     [],          // K4 managed by this loop; never pass real trades
          marketSummary,
          vixDailyCloses,
          prevSpxClose,
          currentTimeET:  evalTime,   // bar's time → correct K5 and spread-credit hours
        }

        const evalResult = service.evaluate(ctx, config)

        if (evalResult.result === 'GO' && evalResult.estimatedCredit != null && evalResult.shortStrike != null) {
          activePosition = {
            direction:   evalResult.direction!,
            shortStrike: evalResult.shortStrike,
            longStrike:  evalResult.longStrike!,
            entryCredit: evalResult.estimatedCredit,
            entryTime:   evalTime,
          }
          bars.push({
            time:         evalTime,
            voterDetail:  evalResult.voterDetail ?? EMPTY_DETAIL,
            decision:     'GO',
            direction:    evalResult.direction,
            addMode:      evalResult.addMode,
            hasPosition:  false,
            isEntry:      true,
            shortStrike:  evalResult.shortStrike,
            longStrike:   evalResult.longStrike,
            entryCredit:  evalResult.estimatedCredit,
          })
        } else {
          bars.push({
            time:        evalTime,
            voterDetail: evalResult.voterDetail ?? EMPTY_DETAIL,
            decision:    evalResult.result,
            direction:   evalResult.direction,
            addMode:     evalResult.addMode,
            haltReason:  evalResult.haltReason,
            hasPosition: false,
          })
        }
      }
    }

    // Force-close any remaining position at end of scan window
    if (activePosition && scanCandles.length > 0) {
      const last     = scanCandles.at(-1)!
      const evalTime = addFiveMinutes(last.t.slice(-5))
      const lastVix  = allSnapshots.filter(s => s.vix  != null).at(-1)?.vix  ?? 0
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
    }

    const totalPnl    = Math.round(trades.reduce((s, t) => s + (t.pnl ?? 0), 0) * 100) / 100
    const response: BacktestResponse = { date, ruleId, bars, trades, totalPnl }
    res.json(response)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[backtest] error for ${ruleId} on ${date}:`, msg)
    res.status(500).json({ error: msg })
  }
})

export default router
