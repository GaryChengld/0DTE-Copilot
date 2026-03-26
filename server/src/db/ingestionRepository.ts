import prisma from "./client.js";

export async function createMarketSnapshot(params: {
  id: number;
  ticker: string;
  timestamp: Date;
  marketData: object;
}): Promise<void> {
  await prisma.marketSnapshot.create({ data: params });
}

export async function getTodayMarketSnapshots() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return prisma.marketSnapshot.findMany({
    where: { timestamp: { gte: todayStart } },
    orderBy: { timestamp: "asc" },
  });
}

export async function getLatestAiAdvices(limit: number) {
  return prisma.aiAdvice.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}

export async function createAiAdvice(params: {
  source: string;
  prompt: string | null;
  response: string;
  provider: string;
}): Promise<void> {
  await prisma.aiAdvice.create({ data: params });
}
