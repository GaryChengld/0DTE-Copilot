import prisma from "./client.js";

export async function getReplayDataByDate(date: string): Promise<unknown | null> {
  const record = await prisma.replayData.findUnique({ where: { date } });
  return record?.replayData ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveReplayData(date: string, data: any): Promise<void> {
  await prisma.replayData.upsert({
    where:  { date },
    create: { date, replayData: data },
    update: { replayData: data },
  });
}
