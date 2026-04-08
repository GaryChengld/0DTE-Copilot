import type { MarketSnapshot } from "../api/marketSnapshot";

interface SpxSummaryProps {
  spx: MarketSnapshot["spx"] | null;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function maColor(ma: number | null, price: number): string {
  if (ma === null) return "";
  return ma < price ? "text-green-400" : "text-red-400";
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

  const maEntries: [string, number | null][] = [
    ["MA20", spx.ma["20"]],
    ["MA50", spx.ma["50"]],
    ["MA100", spx.ma["100"]],
    ["MA200", spx.ma["200"]],
  ];

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Top row: SPX + price on left, O/H/L on right */}
      <div className="flex justify-between">
        {/* Left: SPX label + price + change */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold">SPX</span>
            <span className={`text-2xl font-semibold ${changeColor}`}>{fmt(spx.price)}</span>
          </div>
          <div className={`text-xs ${changeColor}`}>
            {sign}{fmt(spx.change)} ({sign}{fmt(spx.changePct)}%)
          </div>
        </div>

        {/* Right: Open / High / Low */}
        <div className="text-xs space-y-1.5">
          <div className="flex justify-between gap-3">
            <span style={{ color: "var(--text-muted)" }}>Open</span><span className="text-gray-300">{fmt(spx.o)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: "var(--text-muted)" }}>High</span><span className="text-gray-300">{fmt(spx.h)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span style={{ color: "var(--text-muted)" }}>Low</span><span className="text-gray-300">{fmt(spx.l)}</span>
          </div>
        </div>
      </div>

      {/* RSI + ATR (aligned to MA20/MA50 columns) */}
      <div className="grid grid-cols-4 mt-2">
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded py-0.5 text-center w-12 shrink-0 text-blue-400" style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}>RSI</span>
          <span className="text-gray-300">{spx.rsi !== null ? fmt(spx.rsi, 1) : "--"}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded py-0.5 text-center w-12 shrink-0 text-blue-400" style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}>ATR</span>
          <span className="text-gray-300">{spx.atr !== null ? fmt(spx.atr) : "--"}</span>
        </div>
      </div>

      {/* MAs */}
      <div className="grid grid-cols-4 mt-1.5">
        {maEntries.map(([label, val]) => (
          <div key={label} className="flex items-center gap-1 text-xs">
            <span className="rounded py-0.5 text-center w-12 shrink-0 text-blue-400" style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}>{label}</span>
            <span className={`font-medium ${maColor(val, spx.price)}`}>
              {val !== null ? fmt(val, 0) : "--"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
