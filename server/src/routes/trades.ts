import { Router, Request, Response } from "express";
import {
  createTrade,
  findTradeById,
  findOpenTrades,
  createTradeExit,
  updateTradeAfterExit,
  deleteTrade,
} from "../db/tradeRepository.js";
import { sendToAI, isSessionAvailable } from "../services/aiSession.js";

const router = Router();

async function notifyAIWithOpenPositions(): Promise<void> {
  if (!isSessionAvailable()) return;
  try {
    const openPositions = await findOpenTrades();
    await sendToAI(JSON.stringify({ open_positions: openPositions }));
  } catch (err) {
    console.error("[trades] failed to notify AI with open positions:", err instanceof Error ? err.message : err);
  }
}

function getMarketDate(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

router.get("/trades/open", async (_req: Request, res: Response) => {
  const trades = await findOpenTrades();

  res.json(trades.map((trade) => ({
    id: trade.id,
    tradeDate: trade.tradeDate,
    status: trade.status,
    symbol: trade.symbol,
    tradeType: trade.tradeType,
    spreadType: trade.spreadType,
    optionType: trade.optionType,
    strike: trade.strike,
    quantity: trade.quantityInitial,
    quantityRemaining: trade.quantityRemaining,
    entryPrice: trade.entryPrice,
    entryTime: trade.entryTime,
    exits: trade.exits.map((exit) => ({
      id: exit.id,
      exitQuantity: exit.exitQuantity,
      exitPrice: exit.exitPrice,
      exitTime: exit.exitTime,
      exitReason: exit.exitReason,
      pnl: exit.pnl,
    })),
  })));
});

router.post("/trades", async (req: Request, res: Response) => {
  const { symbol, tradeType, spreadType, optionType, strike, quantity, entryPrice, entryTime } = req.body;

  if (!symbol || !tradeType || !spreadType || !optionType || !quantity || entryPrice == null) {
    res.status(400).json({ error: "Missing required fields: symbol, tradeType, spreadType, optionType, quantity, entryPrice" });
    return;
  }

  const trade = await createTrade({
    tradeDate: getMarketDate(entryTime),
    status: "OPEN",
    symbol,
    tradeType,
    spreadType,
    optionType,
    strike: strike ?? null,
    quantityInitial: quantity,
    quantityRemaining: quantity,
    entryPrice,
    entryTime: entryTime ?? new Date().toISOString(),
  });

  await notifyAIWithOpenPositions();

  res.status(201).json({
    id: trade.id,
    tradeDate: trade.tradeDate,
    status: trade.status,
    symbol: trade.symbol,
    tradeType: trade.tradeType,
    spreadType: trade.spreadType,
    optionType: trade.optionType,
    strike: trade.strike,
    quantity: trade.quantityInitial,
    quantityRemaining: trade.quantityRemaining,
    entryPrice: trade.entryPrice,
    entryTime: trade.entryTime,
  });
});

router.post("/trades/exits", async (req: Request, res: Response) => {
  const { tradeId, exitQuantity, exitPrice, exitTime, exitReason } = req.body;

  if (!tradeId || !exitQuantity || exitPrice == null || !exitReason) {
    res.status(400).json({ error: "Missing required fields: tradeId, exitQuantity, exitPrice, exitReason" });
    return;
  }

  const trade = await findTradeById(tradeId);

  if (!trade) {
    res.status(404).json({ error: `Trade ${tradeId} not found` });
    return;
  }

  if (exitQuantity > trade.quantityRemaining) {
    res.status(400).json({ error: `exitQuantity (${exitQuantity}) exceeds quantityRemaining (${trade.quantityRemaining})` });
    return;
  }

  const pnl = trade.entryPrice != null
    ? trade.spreadType === "CREDIT"
      ? (trade.entryPrice - exitPrice) * exitQuantity * 100
      : (exitPrice - trade.entryPrice) * exitQuantity * 100
    : null;

  const exit = await createTradeExit({
    tradeId,
    tradeDate: trade.tradeDate,
    exitQuantity,
    exitPrice,
    exitTime: exitTime ?? new Date().toISOString(),
    exitReason,
    pnl,
  });

  await updateTradeAfterExit(tradeId, trade.quantityRemaining - exitQuantity);
  await notifyAIWithOpenPositions();

  res.status(201).json({
    id: exit.id,
    tradeId: exit.tradeId,
    tradeDate: exit.tradeDate,
    exitQuantity: exit.exitQuantity,
    exitPrice: exit.exitPrice,
    exitTime: exit.exitTime,
    exitReason: exit.exitReason,
    pnl: exit.pnl,
  });
});

router.delete("/trades/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);

  const trade = await findTradeById(id);

  if (!trade) {
    res.status(404).json({ error: `Trade ${id} not found` });
    return;
  }

  const count = await deleteTrade(id);
  await notifyAIWithOpenPositions();

  res.json({ message: `Trade ${id} and ${count} exit(s) deleted` });
});

export default router;
