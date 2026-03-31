import prisma from "./client.js";

interface SnapshotInput {
  time: string;
  vix?: number | null;
  add?: number | null;
  tick?: number | null;
}

export async function appendOtherIndexSnapshots(
  tradeDate: string,
  snapshots: SnapshotInput[]
): Promise<void> {
  for (const s of snapshots) {
    await prisma.otherIndexSnapshot.upsert({
      where: { tradeDate_time: { tradeDate, time: s.time } },
      update: { vix: s.vix ?? null, add: s.add ?? null, tick: s.tick ?? null },
      create: { tradeDate, time: s.time, vix: s.vix ?? null, add: s.add ?? null, tick: s.tick ?? null },
    });
  }
}

export async function getTodayOtherIndexSnapshots(tradeDate: string) {
  return prisma.otherIndexSnapshot.findMany({
    where: { tradeDate },
    orderBy: { time: "asc" },
  });
}
