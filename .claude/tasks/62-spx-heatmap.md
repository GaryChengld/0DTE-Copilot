# Task 62 — Sector ETF Heatmap (Market Data Panel) ✅ COMPLETED (2026-04-09)

## Goal

Replace the TradingView heatmap widget with a custom sector ETF heatmap built from live Yahoo Finance data. The heatmap displays all 11 S&P 500 sector ETFs as a 2-column grid of colored tiles — green for up, red for down, with color intensity reflecting magnitude. Data comes from `GET /api/etf/sectors` (Task 22) and is polled every 30 seconds.

## Layout

```
┌──────────────────────────┐
│  SpxSummary              │  ← natural height
├──────────────────────────┤
│  IndexTicker             │  ← natural height
├──────────────────────────┤
│  SpxCandleChart          │  ← 45% panel height
├──────────────────────────┤
│  ETF Heatmap             │  ← fills remaining space
│  ┌──────────┬──────────┐ │
│  │Technology│ Financials│ │
│  │  XLK     │  XLF     │ │
│  │ +1.24%   │ -0.31%   │ │
│  ├──────────┼──────────┤ │
│  │  Energy  │Health Care│ │
│  │  XLE     │  XLV     │ │
│  │ +2.10%   │ +0.44%   │ │
│  └──────────┴──────────┘ │
│  ...                      │
└──────────────────────────┘
```

## Changes

### Remove: `client/src/components/TradingViewHeatmap.tsx`

No longer needed — replace with `EtfHeatmap`.

### New: `client/src/api/sectorEtfs.ts`

```typescript
export interface SectorEtf {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export async function fetchSectorEtfs(): Promise<SectorEtf[]> {
  const res = await fetch("/api/etf/sectors");
  if (!res.ok) throw new Error(`etf/sectors: ${res.status}`);
  const data = await res.json();
  return data.etfs;
}
```

### New: `client/src/hooks/useSectorEtfs.ts`

Poll every 30 seconds, same pattern as `useSpxCandles`:

```typescript
import { useEffect, useState } from "react";
import { fetchSectorEtfs, type SectorEtf } from "../api/sectorEtfs";

export function useSectorEtfs() {
  const [etfs, setEtfs] = useState<SectorEtf[]>([]);

  useEffect(() => {
    const poll = () =>
      fetchSectorEtfs()
        .then(setEtfs)
        .catch(() => {});

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return etfs;
}
```

### New: `client/src/components/EtfHeatmap.tsx`

A 2-column grid of ETF tiles. Each tile has:
- Sector name (top, small, muted)
- Symbol (middle, small)
- % change (bottom, bold, colored)
- Background color scaled by % change magnitude

**Color scale:**
- `changePct >= +2%` → `#1a4731` (deep green)
- `changePct >= +1%` → `#1a3a28` (medium green)
- `changePct > 0`    → `#162a20` (light green)
- `changePct === 0`  → `var(--bg-card)` (neutral)
- `changePct < 0`    → `#2d1a1a` (light red)
- `changePct <= -1%` → `#3a1a1a` (medium red)
- `changePct <= -2%` → `#4a1a1a` (deep red)

**Text color:** `text-green-400` for positive, `text-red-400` for negative, muted for zero.

**Empty state:** Show a subtle placeholder grid when `etfs` is empty (initial load).

```tsx
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
  if (changePct > 0) return "#4ade80";  // green-400
  if (changePct < 0) return "#f87171";  // red-400
  return "var(--text-muted)";
}

export default function EtfHeatmap() {
  const etfs = useSectorEtfs();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Sector ETFs
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {etfs.map((etf) => (
            <div
              key={etf.symbol}
              className="rounded p-2 flex flex-col gap-0.5"
              style={{ background: tileBackground(etf.changePct) }}
            >
              <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{etf.name}</span>
              <span className="text-xs font-medium text-gray-300">{etf.symbol}</span>
              <span className="text-sm font-bold" style={{ color: changeColor(etf.changePct) }}>
                {etf.changePct >= 0 ? "+" : ""}{etf.changePct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Modify: `client/src/components/MarketDataPanel.tsx`

- Remove `TradingViewHeatmap` import
- Import `EtfHeatmap`
- Replace `<TradingViewHeatmap />` with `<EtfHeatmap />`
- `useSectorEtfs` is called inside `EtfHeatmap` directly, no prop needed

## Done When

- 11 sector ETF tiles render in a 2-column grid below the SPX chart
- Tiles colored green/red with intensity by % change magnitude
- Data refreshes every 30 seconds during market hours
- No TypeScript or build errors (`npm run build`)
