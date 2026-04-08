import type { MarketSnapshot } from "../api/marketSnapshot";

interface IndexTickerProps {
  indexes: MarketSnapshot["indexes"] | null;
}

function valueColor(label: string, value: number | null): string {
  if (value === null) return "";
  if (label === "VIX") {
    if (value > 20) return "text-red-400";
    if (value < 15) return "text-green-400";
    return "";
  }
  // ADD and TICK: green positive, red negative
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-400";
  return "";
}

const items: { label: string; key: keyof MarketSnapshot["indexes"] }[] = [
  { label: "VIX", key: "vix" },
  { label: "ADD", key: "add" },
  { label: "TICK", key: "tick" },
];

export default function IndexTicker({ indexes }: IndexTickerProps) {
  return (
    <div
      className="rounded-lg px-3 py-2 grid grid-cols-3 gap-x-2 text-center"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {items.map(({ label, key }) => {
        const val = indexes?.[key] ?? null;
        return (
          <div key={key}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className={`text-sm font-medium ${valueColor(label, val)}`}>
              {val !== null ? val.toFixed(label === "VIX" ? 2 : 0) : "--"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
