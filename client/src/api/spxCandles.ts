export interface SpxCandle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vwap: number;
  rsi: number | null;
  open: boolean;
}

export async function fetchSpxCandles(): Promise<SpxCandle[]> {
  const res = await fetch("/api/spx/candles");
  if (!res.ok) throw new Error(`spx/candles: ${res.status}`);
  const data = await res.json();
  return data.candles;
}

export async function fetchSpxCandlesByDate(date: string): Promise<SpxCandle[]> {
  const res = await fetch(`/api/spx/candles?date=${date}`);
  if (!res.ok) throw new Error(`spx/candles?date: ${res.status}`);
  const data = await res.json();
  return data.candles;
}
