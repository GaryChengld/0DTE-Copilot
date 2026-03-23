import cron from "node-cron";
import { buildSnapshot } from "../services/snapshotBuilder.js";
import prisma from "../db/client.js";

function isMarketHours(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date());

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (["Sat", "Sun"].includes(weekday)) return false;

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const total = hour * 60 + minute;

  return total >= 9 * 60 + 30 && total < 16 * 60;
}

async function runIngestion(): Promise<void> {
  if (!isMarketHours()) return;

  try {
    const snapshot = await buildSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));

    await prisma.marketSnapshot.create({
      data: {
        spxClose: snapshot.market_data.spx.current.close,
        spxVwap: snapshot.market_data.spx.vwap ?? 0,
        spyClose: snapshot.market_data.spy.current.close,
        spyVwap: snapshot.market_data.spy.vwap ?? 0,
        vix: snapshot.market_data.vix,
      },
    });
  } catch (err) {
    console.error("[marketIngestion] error:", err);
  }
}

export function startMarketIngestionJob(): void {
  console.log("[marketIngestion] job scheduled (*/5 * * * *, RTH only)");
  cron.schedule("*/5 * * * *", runIngestion);
}
