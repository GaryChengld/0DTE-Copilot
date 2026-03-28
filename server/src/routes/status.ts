import { Router, Request, Response } from "express";
import prisma from "../db/client.js";
import { getAISessionState } from "../services/aiSession.js";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  const startTime = process.hrtime.bigint();

  let dbStatus = "ok";
  try {
    await prisma.trade.count();
  } catch {
    dbStatus = "error";
  }

  const latencyMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
  const ai = getAISessionState();
  const status = dbStatus === "ok" && ai.status !== "error" ? "ok" : "degraded";

  res.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
    latencyMs: parseFloat(latencyMs.toFixed(2)),
    ai,
  });
});

export default router;
