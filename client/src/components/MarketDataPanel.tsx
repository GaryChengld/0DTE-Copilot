import TradingViewChart from "./TradingViewChart";
import SpxSummary from "./SpxSummary";
import IndexTicker from "./IndexTicker";
import { useMarketSnapshot } from "../hooks/useMarketSnapshot";

export default function MarketDataPanel() {
  const snapshot = useMarketSnapshot();

  return (
    <aside
      className="w-[20%] flex flex-col shrink-0 overflow-y-auto"
      style={{ background: "var(--bg-panel)", borderRight: "1px solid var(--border)" }}
    >
      {/* Market snapshot — above chart */}
      <div className="p-2 space-y-2 shrink-0">
        <SpxSummary spx={snapshot?.spx ?? null} />
        <IndexTicker indexes={snapshot?.indexes ?? null} />
      </div>

      {/* TradingView Chart */}
      <div className="h-[50%] shrink-0 p-2">
        <div
          className="h-full rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <TradingViewChart />
        </div>
      </div>

      {/* Future market data sections go here */}
    </aside>
  );
}
