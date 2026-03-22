import { Router, Request, Response } from "express";
import prisma from "../db/client.js";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  const startTime = process.hrtime.bigint();

  let dbStatus = "ok";
  try {
    await prisma.tradeLog.count();
  } catch {
    dbStatus = "error";
  }

  const latencyMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
    latencyMs: parseFloat(latencyMs.toFixed(2)),
  });
});

export default router;
