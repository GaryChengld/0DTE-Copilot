import prisma from "./client.js";

export async function getLatestAiAdvices(limit: number) {
  return prisma.aiAdvice.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}

export async function getTodaySessionSummary(): Promise<string | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const record = await prisma.aiAdvice.findFirst({
    where: { source: "session_summary", timestamp: { gte: todayStart } },
    orderBy: { timestamp: "desc" },
  });
  return record?.response ?? null;
}

export async function createAiAdvice(params: {
  source: string;
  prompt: string | null;
  response: string;
  provider: string;
}): Promise<void> {
  await prisma.aiAdvice.create({ data: params });
}
