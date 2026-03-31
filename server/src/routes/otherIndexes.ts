import { Router, Request, Response } from "express";
import { appendOtherIndexSnapshots } from "../db/otherIndexesRepository.js";

const router = Router();

router.post("/other_indexes", async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { time: timeInput, vix, add, tick } = (req.body ?? {}) as any;

  if (vix === undefined && add === undefined && tick === undefined) {
    res.status(400).json({ error: "At least one of vix, add, or tick must be provided" });
    return;
  }

  try {
    const now = new Date();
    const tradeDate = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const time = timeInput?.trim() || now.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    await appendOtherIndexSnapshots(tradeDate, [{ time, vix: vix ?? null, add: add ?? null, tick: tick ?? null }]);
    res.status(201).json({ message: "Snapshot saved", time });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[other_indexes] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
