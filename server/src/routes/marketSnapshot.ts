import { Router } from "express";
import { fetchSpxDailySnapshot } from "../services/marketData.js";
import { getTodayOtherIndexSnapshots } from "../db/otherIndexesRepository.js";

const router = Router();

function getTradeDateET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

router.get("/market-snapshot", async (_req, res) => {
  try {
    const tradeDate = getTradeDateET();
    const [spx, snapshots] = await Promise.all([
      fetchSpxDailySnapshot(),
      getTodayOtherIndexSnapshots(tradeDate),
    ]);

    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const indexes = {
      vix: latest?.vix ?? null,
      add: latest?.add ?? null,
      tick: latest?.tick ?? null,
    };

    res.json({ spx, indexes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /market-snapshot] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
