import type { MarketSnapshot } from "../api/marketSnapshot";

interface SpxSummaryProps {
  spx: MarketSnapshot["spx"] | null;
}

export default function SpxSummary({ spx }: SpxSummaryProps) {
  if (!spx) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        SPX --
      </div>
    );
  }

  const isUp = spx.change >= 0;
  const changeColor = isUp ? "text-green-400" : "text-red-400";
  const sign = isUp ? "+" : "";

  return (
    <div
      className="rounded-lg px-3 py-2 flex justify-between"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Left: SPX label + price + change */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold">SPX</span>
          <span className={`text-xl font-semibold ${changeColor}`}>{spx.price.toFixed(2)}</span>
        </div>
        <div className={`text-xs ${changeColor}`}>
          {sign}{spx.change.toFixed(2)} ({sign}{spx.changePct.toFixed(2)}%)
        </div>
      </div>

      {/* Right: Open / High / Low */}
      <div className="text-xs text-right space-y-1.5">
        <div><span style={{ color: "var(--text-muted)" }}>Open </span><span className="text-gray-300">{spx.o.toFixed(2)}</span></div>
        <div><span style={{ color: "var(--text-muted)" }}>High </span><span className="text-gray-300">{spx.h.toFixed(2)}</span></div>
        <div><span style={{ color: "var(--text-muted)" }}>Low </span><span className="text-gray-300">{spx.l.toFixed(2)}</span></div>
      </div>
    </div>
  );
}
