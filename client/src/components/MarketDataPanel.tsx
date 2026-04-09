import SpxSummary from "./SpxSummary";
import IndexTicker from "./IndexTicker";
import SpxCandleChart from "./SpxCandleChart";
import TradingViewHeatmap from "./TradingViewHeatmap";
import { useMarketSnapshot } from "../hooks/useMarketSnapshot";
import { useSpxCandles } from "../hooks/useSpxCandles";

export default function MarketDataPanel() {
  const snapshot = useMarketSnapshot();
  const candles = useSpxCandles();

  return (
    <aside
      className="w-[20%] flex flex-col gap-2 p-2 overflow-hidden"
      style={{ background: "var(--bg-panel)", borderRight: "1px solid var(--border)" }}
    >
      {/* SPX summary — natural height */}
      <div className="shrink-0">
        <SpxSummary spx={snapshot?.spx ?? null} />
      </div>

      {/* Index ticker — natural height */}
      <div className="shrink-0">
        <IndexTicker indexes={snapshot?.indexes ?? null} />
      </div>

      {/* SPX Candle Chart */}
      <div className="h-[45%] shrink-0">
        <div
          className="h-full rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <SpxCandleChart candles={candles} />
        </div>
      </div>

      {/* S&P 500 Heatmap — fills remaining space */}
      <div className="flex-1 min-h-0">
        <div
          className="h-full rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <TradingViewHeatmap />
        </div>
      </div>
    </aside>
  );
}
