import { Router, Request, Response } from 'express'
import { getRuleServiceAndConfig } from '../rules/engine.js'
import { getReplayDataByDate } from '../db/replayDataRepository.js'
import {
  fetchVixDailyClosesUpTo,
  fetchSpxPrevDayCloseFor,
  type SpxCandle,
} from '../services/marketData.js'
import { runBacktest } from '../rules/backtest.js'

const router = Router()

interface ReplayCandle {
  t: string; o: number; h: number; l: number; c: number; v: number; vwap?: number
}
interface ReplayData {
  market_data: {
    spx: { candles_5m: ReplayCandle[] }
    other_indexes_history?: { time: string; vix?: number | null; add?: number | null; tick?: number | null }[]
  }
  market_summary?: unknown
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

    const upToDate = new Date(`${date}T20:00:00Z`)
    const [vixDailyCloses, prevSpxClose] = await Promise.all([
      fetchVixDailyClosesUpTo(22, upToDate),
      fetchSpxPrevDayCloseFor(upToDate),
    ])

    const { service, config } = await getRuleServiceAndConfig(ruleId)

    const result = runBacktest(ruleId, service, config, {
      date,
      allCandles:     (replay.market_data.spx.candles_5m ?? []).map(c => toSpxCandle(c, date)),
      allSnapshots:   replay.market_data.other_indexes_history ?? [],
      marketSummary:  replay.market_summary ?? null,
      vixDailyCloses,
      prevSpxClose,
    })

    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[backtest] error for ${ruleId} on ${date}:`, msg)
    res.status(500).json({ error: msg })
  }
})

export default router
