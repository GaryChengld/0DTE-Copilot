import { Router } from "express";
import { fetchSpxCandles } from "../services/marketData.js";

const router = Router();

router.get("/spx/candles", async (_req, res) => {
  try {
    const candles = await fetchSpxCandles();
    res.json({ candles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /spx/candles] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
