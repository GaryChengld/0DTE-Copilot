import prisma from "./client.js";
import type { Trade, TradeExit } from "../generated/prisma/client.js";

export type TradeWithExits = Trade & { exits: TradeExit[] };

export async function createTrade(data: {
  tradeDate: string;
  status: string;
  symbol: string;
  tradeType: string;
  spreadType: string;
  optionType: string;
  strike: string | null;
  quantityInitial: number;
  quantityRemaining: number;
  entryPrice: number;
  entryTime: string;
}): Promise<Trade> {
  return prisma.trade.create({ data });
}

export async function findTradeById(id: number): Promise<Trade | null> {
  return prisma.trade.findUnique({ where: { id } });
}

export async function findOpenTrades(): Promise<TradeWithExits[]> {
  return prisma.trade.findMany({
    where: { status: { not: "CLOSED" } },
    include: { exits: true },
    orderBy: { id: "asc" },
  });
}

export async function findTodayClosedTrades(tradeDate: string): Promise<TradeWithExits[]> {
  return prisma.trade.findMany({
    where: { tradeDate, status: "CLOSED" },
    include: { exits: true },
    orderBy: { id: "asc" },
  });
}

export async function createTradeExit(data: {
  tradeId: number;
  tradeDate: string;
  exitQuantity: number;
  exitPrice: number;
  exitTime: string;
  exitReason: string;
  pnl: number | null;
}): Promise<TradeExit> {
  return prisma.tradeExit.create({ data });
}

export async function updateTradeAfterExit(
  id: number,
  quantityRemaining: number
): Promise<void> {
  await prisma.trade.update({
    where: { id },
    data: {
      quantityRemaining,
      status: quantityRemaining > 0 ? "PARTIAL_CLOSED" : "CLOSED",
    },
  });
}

export async function deleteTrade(id: number): Promise<number> {
  const { count } = await prisma.tradeExit.deleteMany({ where: { tradeId: id } });
  await prisma.trade.delete({ where: { id } });
  return count;
}

export interface DailyPnl {
  date: string;
  pnl: number;
}

/** Aggregate daily P&L for a given year+month from TradeExit records. */
export async function getMonthlyPnl(year: number, month: number): Promise<DailyPnl[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const exits = await prisma.tradeExit.findMany({
    where: { tradeDate: { startsWith: prefix } },
    select: { tradeDate: true, pnl: true },
    orderBy: { tradeDate: "asc" },
  });

  const byDate = new Map<string, number>();
  for (const exit of exits) {
    byDate.set(exit.tradeDate, (byDate.get(exit.tradeDate) ?? 0) + (exit.pnl ?? 0));
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date, pnl }));
}

/** Return all trades opened or exited on a given date, with their full exits array. */
export async function findTradesByDate(date: string): Promise<TradeWithExits[]> {
  return prisma.trade.findMany({
    where: {
      OR: [
        { tradeDate: date },
        { exits: { some: { tradeDate: date } } },
      ],
    },
    include: { exits: true },
    orderBy: { id: "asc" },
  });
}
