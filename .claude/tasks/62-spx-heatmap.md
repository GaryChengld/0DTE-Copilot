# Task 62 — S&P 500 Heatmap (TradingView Widget) ✅ COMPLETED (2026-04-08)

## Goal

Add a TradingView Stock Heatmap widget below the SPX candlestick chart in the Market Data Panel. The heatmap shows S&P 500 stocks sized by market cap and colored by % change, grouped by sector — giving instant visual context for sector rotation during 0DTE trading sessions.

## Layout

```
┌──────────────────────────┐
│  SpxSummary              │  ← natural height
├──────────────────────────┤
│  IndexTicker             │  ← natural height
├──────────────────────────┤
│  SpxCandleChart          │  ← 45% panel height
├──────────────────────────┤
│  TradingView Heatmap     │  ← fills remaining space
└──────────────────────────┘
```

## Changes

### New: `client/src/components/TradingViewHeatmap.tsx`

Embed TradingView's Stock Heatmap widget using a `<script>` injected into a container div via `useEffect` (same pattern as `TradingViewChart.tsx`).

```tsx
import { useEffect, useRef } from "react";

export default function TradingViewHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      exchanges: [],
      dataSource: "SPX500",
      grouping: "sector",
      blockSize: "market_cap_basic",
      blockColor: "change",
      locale: "en",
      colorTheme: "dark",
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%",
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={containerRef} />
  );
}
```

Key decisions:
- `dataSource: "SPX500"` — S&P 500 constituents only (relevant to SPX 0DTE)
- `blockSize: "market_cap_basic"` — tiles sized by market cap weight (reflects actual index composition)
- `blockColor: "change"` — colored by % change from previous close
- `grouping: "sector"` — grouped by GICS sector for rotation visibility
- `hasTopBar: false` — hides TradingView header to save vertical space
- `colorTheme: "dark"` — matches app dark theme

### Modify: `client/src/components/MarketDataPanel.tsx`

- Import `TradingViewHeatmap`
- Add heatmap section below the chart using `flex-1 min-h-0` to fill remaining space

```tsx
{/* Heatmap — fills remaining space */}
<div className="flex-1 min-h-0">
  <div className="h-full rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
    <TradingViewHeatmap />
  </div>
</div>
```

## Done When

- TradingView heatmap renders below the SPX chart in the Market Data panel
- Heatmap fills remaining vertical space after the chart
- S&P 500 stocks shown sized by market cap, colored by % change, grouped by sector
- Dark theme matches app
- No TypeScript or build errors (`npm run build`)
