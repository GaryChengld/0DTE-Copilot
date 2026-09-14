import prisma from "./client.js";

export async function getReplayDataByDate(date: string): Promise<unknown | null> {
  const record = await prisma.replayData.findUnique({ where: { date } });
  return record?.replayData ?? null;
}

/** All cached replay payloads, oldest date first. */
export async function listAllReplayData(): Promise<{ date: string; replayData: unknown }[]> {
  return prisma.replayData.findMany({
    select: { date: true, replayData: true },
    orderBy: { date: "asc" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveReplayData(date: string, data: any): Promise<void> {
  await prisma.replayData.upsert({
    where:  { date },
    create: { date, replayData: data },
    update: { replayData: data },
  });
}
