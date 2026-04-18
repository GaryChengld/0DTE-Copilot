import { Router } from "express";
import { fetchSpxCandles, fetchSpxCandlesByDate } from "../services/marketData.js";

const router = Router();

router.get("/spx/candles", async (req, res) => {
  const { date } = req.query as { date?: string };

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
      return;
    }
    try {
      const candles = await fetchSpxCandlesByDate(date);
      res.json({ candles });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GET /spx/candles?date] error:", message);
      res.status(500).json({ error: message });
    }
    return;
  }

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
