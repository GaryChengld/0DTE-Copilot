import { useEffect, useState } from "react";
import { getOpenTrades, type Trade } from "../api/trades";

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);

  function reload() {
    getOpenTrades().then(setTrades).catch(() => setTrades([]));
  }

  useEffect(() => {
    reload();
  }, []);

  return { trades, reload };
}
