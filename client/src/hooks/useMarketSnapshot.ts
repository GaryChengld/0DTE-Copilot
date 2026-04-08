import { useEffect, useState } from "react";
import { fetchMarketSnapshot, type MarketSnapshot } from "../api/marketSnapshot";

export function useMarketSnapshot() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);

  useEffect(() => {
    const poll = () =>
      fetchMarketSnapshot()
        .then(setSnapshot)
        .catch(() => setSnapshot(null));

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return snapshot;
}
