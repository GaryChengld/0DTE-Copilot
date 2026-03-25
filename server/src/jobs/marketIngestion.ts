import cron from "node-cron";
import type { Server } from "socket.io";
import { buildSnapshot } from "../services/snapshotBuilder.js";
import { sendToAI } from "../services/aiSession.js";
import prisma from "../db/client.js";
import { config } from "../config.js";
import { setJobSuccess, setJobError } from "./jobState.js";
import { isMarketHours } from "../utils/marketHours.js";

async function runIngestion(io: Server): Promise<void> {
  if (!isMarketHours()) return;

  try {
    const snapshot = await buildSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));

    await prisma.marketSnapshot.create({
      data: {
        id: Date.now(),
        ticker: "SPX",
        timestamp: new Date(snapshot.timestamp),
        marketData: snapshot.market_data,
      },
    });

    const response = await sendToAI(JSON.stringify(snapshot.market_data));

    await prisma.aiAdvice.create({
      data: {
        source: "job",
        prompt: null,
        response,
        provider: config.llm.provider,
      },
    });

    io.emit("chat:response", { source: "job", response });

    setJobSuccess(snapshot.timestamp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[marketIngestion] error:", message);
    setJobError(new Date().toISOString(), message);
  }
}

export function startMarketIngestionJob(io: Server): void {
  console.log("[marketIngestion] job scheduled (15s past every 5min, RTH only)");
  cron.schedule("15 */5 * * * *", () => runIngestion(io));
}
