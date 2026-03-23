interface Candle {
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function calculateVwap(candles: Candle[]): number | null {
  const valid = candles.filter(
    (c) => c.volume > 0 && c.high != null && c.low != null && c.close != null
  );
  if (valid.length === 0) return null;

  let sumTPV = 0;
  let sumV = 0;
  for (const c of valid) {
    const tp = (c.high + c.low + c.close) / 3;
    sumTPV += tp * c.volume;
    sumV += c.volume;
  }

  return Math.round((sumTPV / sumV) * 100) / 100;
}
