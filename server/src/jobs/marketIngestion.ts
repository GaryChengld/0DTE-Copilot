import cron from "node-cron";
import type { Server } from "socket.io";
import { buildSnapshot } from "../services/snapshotBuilder.js";
import { sendToAI, isSessionAvailable } from "../services/aiSession.js";
import { createMarketSnapshot, createAiAdvice } from "../db/ingestionRepository.js";
import { findOpenTrades } from "../db/tradeRepository.js";
import { config } from "../config.js";
import { setJobSuccess, setJobError } from "./jobState.js";
import { isMarketHours } from "../utils/marketHours.js";

async function runIngestion(io: Server): Promise<void> {
  if (!isMarketHours()) return;

  try {
    const snapshot = await buildSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));

    await createMarketSnapshot({
      id: Date.now(),
      ticker: "SPX",
      timestamp: new Date(snapshot.timestamp),
      marketData: snapshot.market_data,
    });

    if (isSessionAvailable()) {
      const openTrades = await findOpenTrades();
      const payload = JSON.stringify({ market_data: snapshot.market_data, open_positions: openTrades });
      const response = await sendToAI(payload);

      await createAiAdvice({ source: "job", prompt: null, response, provider: config.llm.provider });

      io.emit("chat:response", { source: "job", response });
    } else {
      console.warn("[marketIngestion] skipping AI call — session is in error state");
    }

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
