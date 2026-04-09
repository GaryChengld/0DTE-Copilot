import { useEffect, useState } from "react";
import { fetchSpxCandles, type SpxCandle } from "../api/spxCandles";

export function useSpxCandles() {
  const [candles, setCandles] = useState<SpxCandle[]>([]);

  useEffect(() => {
    const poll = () =>
      fetchSpxCandles()
        .then(setCandles)
        .catch(() => {});

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return candles;
}
