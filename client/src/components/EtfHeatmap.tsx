import { useSectorEtfs } from "../hooks/useSectorEtfs";

function tileBackground(changePct: number): string {
  if (changePct >= 2)  return "#1a4731";
  if (changePct >= 1)  return "#1a3a28";
  if (changePct > 0)   return "#162a20";
  if (changePct <= -2) return "#4a1a1a";
  if (changePct <= -1) return "#3a1a1a";
  if (changePct < 0)   return "#2d1a1a";
  return "var(--bg-card)";
}

function changeColor(changePct: number): string {
  if (changePct > 0) return "#4ade80";
  if (changePct < 0) return "#f87171";
  return "var(--text-muted)";
}

export default function EtfHeatmap() {
  const etfs = useSectorEtfs();

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-2">
        {etfs.map((etf) => (
          <div
            key={etf.symbol}
            className="p-2 flex flex-col gap-0.5"
            style={{ background: tileBackground(etf.changePct), border: "1px solid #30363d" }}
          >
            <span className="text-sm truncate text-gray-300">{etf.name}</span>
            <span className="text-sm font-bold" style={{ color: changeColor(etf.changePct) }}>
              {etf.changePct >= 0 ? "+" : ""}{etf.changePct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
