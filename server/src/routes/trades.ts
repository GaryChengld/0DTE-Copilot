import { Router, Request, Response } from "express";
import {
  createTrade,
  findTradeById,
  findOpenTrades,
  createTradeExit,
  updateTradeAfterExit,
  deleteTrade,
  getMonthlyPnl,
  findTradesByDate,
} from "../db/tradeRepository.js";
const router = Router();

function getMarketDate(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Current datetime as "YYYY-MM-DDTHH:mm:ss" in ET — no UTC offset suffix. */
function nowET(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T");
}

router.get("/trades/pnl", async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "year and month (1–12) query parameters are required" });
    return;
  }
  try {
    const pnl = await getMonthlyPnl(year, month);
    res.json({ pnl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /trades/pnl] error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/trades", async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string };
  if (!date) {
    res.status(400).json({ error: "date query parameter is required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    return;
  }
  try {
    const trades = await findTradesByDate(date);
    res.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /trades] error:", message);
    res.status(500).json({ error: message });
  }
});

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
    entryTime: entryTime ?? nowET(),
  });

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
    exitTime: exitTime ?? nowET(),
    exitReason,
    pnl,
  });

  await updateTradeAfterExit(tradeId, trade.quantityRemaining - exitQuantity);

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

  res.json({ message: `Trade ${id} and ${count} exit(s) deleted` });
});

export default router;
