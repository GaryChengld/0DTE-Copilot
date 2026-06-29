import { Router, Request, Response } from 'express'
import { fetchSpxReplayData, fetchSpyReplayStats } from '../services/marketData.js'
import { getTodayOtherIndexSnapshots } from '../db/otherIndexesRepository.js'
import { findTradesByDate } from '../db/tradeRepository.js'
import { getMarketSummaryByDate } from '../db/marketSummaryRepository.js'
import { getReplayDataByDate, saveReplayData } from '../db/replayDataRepository.js'

const router = Router()

function getTodayEt(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

router.get('/ai/replay/message', async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date query param is required in YYYY-MM-DD format' })
    return
  }

  try {
    // Skip cache for today — data is still live and may change
    const isToday = date === getTodayEt()

    // Cache hit — return stored payload immediately (past dates only)
    if (!isToday) {
      const cached = await getReplayDataByDate(date)
      if (cached) {
        res.json(cached)
        return
      }
    }

    // Cache miss — fetch from Yahoo Finance + DB, then store
    const [spxData, spyData, otherIndexSnapshots, trades, marketSummary] = await Promise.all([
      fetchSpxReplayData(date),
      fetchSpyReplayStats(date),
      getTodayOtherIndexSnapshots(date),
      findTradesByDate(date),
      getMarketSummaryByDate(date),
    ])

    const marketDataPayload: Record<string, unknown> = {
      spx: spxData,
      spy: spyData,
    }

    if (otherIndexSnapshots.length > 0) {
      marketDataPayload.other_indexes_history = otherIndexSnapshots.map((s) => {
        const entry: Record<string, unknown> = { time: s.time }
        if (s.vix !== null) entry.vix = s.vix
        if (s.add !== null) entry.add = s.add
        if (s.tick !== null) entry.tick = s.tick
        return entry
      })
    }

    const payload: Record<string, unknown> = {
      timestamp: `${date} 16:00 ET`,
      market_data: marketDataPayload,
      positions: trades,
    }
    if (marketSummary) payload.market_summary = marketSummary

    saveReplayData(date, payload).catch((err) =>
      console.error('[replay] failed to cache payload:', err instanceof Error ? err.message : err)
    )

    res.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[replay] error:', message)
    res.status(500).json({ error: message })
  }
})

export default router
