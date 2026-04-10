import { Router, Request, Response } from 'express'
import type { Server } from 'socket.io'
import { fetchMarketData } from '../services/marketData.js'
import { sendToAI } from '../services/aiSession.js'
import { createAiAdvice } from '../db/ingestionRepository.js'
import { findOpenTrades } from '../db/tradeRepository.js'
import { getLatestMarketSummary } from '../db/marketSummaryRepository.js'
import { getTodayOtherIndexSnapshots } from '../db/otherIndexesRepository.js'
import { fetchLatestNews } from '../services/news.js'
import { config } from '../config.js'

const router = Router()
let io: Server

export function initAnalysisRouter(ioInstance: Server): void {
  io = ioInstance
}

function getTradeDateET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

async function buildAnalysisPayload(userNotes?: string) {
  const tradeDate = getTradeDateET()
  const [marketData, openTrades, marketSummary, otherIndexSnapshots, newsItems] = await Promise.all([
    fetchMarketData(),
    findOpenTrades(),
    getLatestMarketSummary(),
    getTodayOtherIndexSnapshots(tradeDate),
    config.finnhubApiKey ? fetchLatestNews(10).catch(() => []) : Promise.resolve([]),
  ])
  const marketDataPayload: Record<string, unknown> = { ...marketData }
  if (otherIndexSnapshots.length > 0) {
    marketDataPayload.other_indexes_history = otherIndexSnapshots.map((s) => {
      const entry: Record<string, unknown> = { time: s.time }
      if (s.vix !== null) entry.vix = s.vix
      if (s.add !== null) entry.add = s.add
      if (s.tick !== null) entry.tick = s.tick
      return entry
    })
  }
  const timestamp =
    new Date()
      .toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(',', '') + ' ET'
  const payload: Record<string, unknown> = {
    timestamp,
    market_data: marketDataPayload,
    open_positions: openTrades,
  }
  if (newsItems.length > 0) {
    payload.news = newsItems.map((n) => ({ datetime: n.publishedAt, title: n.title }))
  }
  if (marketSummary) payload.market_summary = marketSummary
  if (userNotes) payload.user_notes = userNotes
  return payload
}

router.post('/ai/analyze/message', async (req: Request, res: Response) => {
  try {
    const { user_notes } = req.body ?? {}
    res.json(await buildAnalysisPayload(user_notes))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analysis] error:', message)
    res.status(500).json({ error: message })
  }
})

router.post('/ai/analyze', async (req: Request, res: Response) => {
  try {
    const { user_notes } = req.body ?? {}
    const message = JSON.stringify(await buildAnalysisPayload(user_notes))
    const response = await sendToAI(message, true)

    await createAiAdvice({ source: 'user', prompt: message, response, provider: config.llm.provider })
    io.emit('chat:response', { source: 'user', response })

    res.json({ response })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analysis] error:', message)
    res.status(500).json({ error: message })
  }
})

export default router
