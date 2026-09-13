import prisma from "./client.js";
import { etDayRange, todayET } from "../utils/marketHours.js";

export async function getLatestAiAdvices(limit: number) {
  return prisma.aiAdvice.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}

export async function getTodaySessionSummary(): Promise<string | null> {
  const { start } = etDayRange(todayET());
  const record = await prisma.aiAdvice.findFirst({
    where: { source: "session_summary", timestamp: { gte: start } },
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

/** Return all source="user" AI advices whose timestamp falls on the given date (ET). */
export async function getAiAdvicesByDate(date: string) {
  const { start, end } = etDayRange(date);
  return prisma.aiAdvice.findMany({
    where: {
      source: "user",
      timestamp: { gte: start, lt: end },
    },
    orderBy: { timestamp: "asc" },
  });
}
