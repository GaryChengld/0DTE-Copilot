import prisma from "./client.js";
import { etDayRange } from "../utils/marketHours.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createMarketSummary(data: any): Promise<void> {
  await prisma.marketSummary.create({ data: { data } });
}

export async function getLatestMarketSummary(): Promise<unknown> {
  const record = await prisma.marketSummary.findFirst({
    orderBy: { timestamp: "desc" },
  });
  return record?.data ?? null;
}

export async function getMarketSummaryByDate(date: string): Promise<unknown> {
  const { start, end } = etDayRange(date);

  const record = await prisma.marketSummary.findFirst({
    where: { timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: "desc" },
  });
  return record?.data ?? null;
}
