export interface TradeExit {
  id: number;
  exitQuantity: number;
  exitPrice: number | null;
  exitReason: string | null;
  exitTime: string | null;
}

export interface Trade {
  id: number;
  tradeDate: string;
  status: string;
  symbol: string;
  tradeType: string;
  spreadType: string;
  optionType: string | null;
  strike: string | null;
  quantity: number;
  quantityRemaining: number;
  entryPrice: number | null;
  entryTime: string | null;
  exits: TradeExit[];
}

export interface OpenTradeRequest {
  symbol: string;
  tradeType: string;
  spreadType: string;
  optionType?: string;
  strike?: string;
  quantity: number;
  entryPrice?: number;
  entryTime?: string;
}

export interface ExitTradeRequest {
  tradeId: number;
  exitQuantity: number;
  exitPrice?: number;
  exitReason?: string;
}

export async function getOpenTrades(): Promise<Trade[]> {
  const res = await fetch("/api/trades/open");
  return res.json();
}

export async function openTrade(data: OpenTradeRequest): Promise<Trade> {
  const res = await fetch("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function exitTrade(data: ExitTradeRequest): Promise<TradeExit> {
  const res = await fetch("/api/trades/exits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteTrade(id: number): Promise<void> {
  await fetch(`/api/trades/${id}`, { method: "DELETE" });
}
