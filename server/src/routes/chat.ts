import { Router, Request, Response } from 'express'
import { sendToAI, restartAISession, getAISessionState } from '../services/aiSession.js'
import { createAiAdvice, getLatestAiAdvices } from '../db/ingestionRepository.js'
import { config } from '../config.js'

const router = Router()

router.post('/chat', async (req: Request, res: Response) => {
  const { message } = req.body

  if (!message || !message.trim()) {
    res.status(400).json({ error: 'Missing required field: message' })
    return
  }

  const response = await sendToAI(message)

  await createAiAdvice({ source: 'user', prompt: message, response, provider: config.llm.provider })

  res.json({ response })
})

router.get('/ai-advices', async (_req: Request, res: Response) => {
  const advices = await getLatestAiAdvices(20)
  res.json(advices)
})

router.post('/ai-session/restart', async (_req: Request, res: Response) => {
  try {
    await restartAISession()
    res.json(getAISessionState())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Failed to restart AI session: ${message}` })
  }
})

export default router
