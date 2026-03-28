import { Router, Request, Response } from "express";
import type { Server } from "socket.io";
import { fetchMarketData } from "../services/marketData.js";
import { sendToAI } from "../services/aiSession.js";
import { createAiAdvice } from "../db/ingestionRepository.js";
import { findOpenTrades } from "../db/tradeRepository.js";
import { config } from "../config.js";

export function createAnalysisRouter(io: Server) {
  const router = Router();

  router.post("/ai/analyze", async (_req: Request, res: Response) => {
    try {
      const [marketData, openTrades] = await Promise.all([fetchMarketData(), findOpenTrades()]);

      const message = JSON.stringify({ timestamp: new Date().toISOString(), market_data: marketData, open_positions: openTrades });
      const response = await sendToAI(message, true);

      await createAiAdvice({ source: "user", prompt: message, response, provider: config.llm.provider });
      io.emit("chat:response", { source: "user", response });

      res.json({ response });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[analysis] error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
