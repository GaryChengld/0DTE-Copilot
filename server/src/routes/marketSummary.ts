import { Router, Request, Response } from "express";
import { createMarketSummary } from "../db/marketSummaryRepository.js";

const router = Router();

router.post("/market-summary", async (req: Request, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { content } = (req.body ?? {}) as any;

  if (content === undefined || content === null || content === "") {
    res.status(400).json({ error: "Missing required field: content" });
    return;
  }

  try {
    await createMarketSummary(content);
    res.status(201).json({ message: "Market summary saved" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[marketSummary] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
