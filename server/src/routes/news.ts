import { Router } from "express";
import { config } from "../config.js";
import { fetchLatestNews } from "../services/news.js";

const router = Router();

function formatET(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "") + " ET";
}

router.get("/news", async (_req, res) => {
  if (!config.finnhubApiKey) {
    res.status(503).json({ error: "News service not configured" });
    return;
  }
  try {
    const news = await fetchLatestNews(10);
    res.json({ timestamp: formatET(new Date()), news });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /news] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
