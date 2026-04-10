import { Router } from "express";
import { fetchSectorEtfs } from "../services/marketData.js";

const router = Router();

router.get("/etf/sectors", async (_req, res) => {
  try {
    const etfs = await fetchSectorEtfs();
    res.json({ etfs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /etf/sectors] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
