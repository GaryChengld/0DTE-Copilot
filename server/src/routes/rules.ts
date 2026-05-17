import { Router, Request, Response } from 'express'
import { listRules, evaluateRule } from '../rules/engine.js'
import { fetchSpxCandles, fetchVixDailyCloses, fetchSpxPrevDayClose } from '../services/marketData.js'
import { findOpenTrades } from '../db/tradeRepository.js'
import { getLatestMarketSummary } from '../db/marketSummaryRepository.js'
import { getTodayOtherIndexSnapshots } from '../db/otherIndexesRepository.js'
import type { EvalContext } from '../rules/types.js'

const router = Router()

function tradeDateET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

router.get('/rules', (_req: Request, res: Response) => {
  try {
    res.json(listRules())
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/rules/:id/evaluate', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const tradeDate = tradeDateET()
    const [spxCandles, openTrades, marketSummary, snapshots, vixDailyCloses, prevSpxClose] =
      await Promise.all([
        fetchSpxCandles(),
        findOpenTrades(),
        getLatestMarketSummary(),
        getTodayOtherIndexSnapshots(tradeDate),
        fetchVixDailyCloses(22),
        fetchSpxPrevDayClose(),
      ])

    const todayCandles = spxCandles.filter(c => c.t.startsWith(tradeDate) && !c.open)

    const ctx: EvalContext = {
      todayCandles,
      addReadings:    snapshots.filter(s => s.add != null).map(s => s.add!),
      vixReadings:    snapshots.filter(s => s.vix != null).map(s => s.vix!),
      openTrades,
      marketSummary,
      vixDailyCloses,
      prevSpxClose,
    }

    res.json(await evaluateRule(id, ctx))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[rules] error evaluating ${id}:`, msg)
    res.status(500).json({ error: msg })
  }
})

export default router
