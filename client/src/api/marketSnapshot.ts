export interface MarketSnapshot {
  spx: {
    price: number;
    o: number;
    h: number;
    l: number;
    change: number;
    changePct: number;
  };
  indexes: {
    vix: number | null;
    add: number | null;
    tick: number | null;
  };
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const res = await fetch("/api/market-snapshot");
  if (!res.ok) throw new Error(`market-snapshot: ${res.status}`);
  return res.json();
}
