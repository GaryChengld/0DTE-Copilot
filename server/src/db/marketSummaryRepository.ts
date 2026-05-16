import prisma from "./client.js";

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
  // Span the full ET calendar day in both EDT (UTC-4) and EST (UTC-5):
  // from = date 04:00 UTC (ET midnight in EDT)
  // to   = date+1 05:00 UTC (ET midnight in EST on the next day)
  const from = new Date(`${date}T04:00:00Z`);
  const to   = new Date(`${date}T05:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1);

  const record = await prisma.marketSummary.findFirst({
    where: { timestamp: { gte: from, lt: to } },
    orderBy: { timestamp: "desc" },
  });
  return record?.data ?? null;
}
