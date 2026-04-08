# Task 59 — Market Data Panel (Left Panel) ✅ COMPLETED (2026-04-08)

## Goal

Add a left "Market Data" panel (w-[25%]) to the main layout. The initial content is an embedded TradingView Advanced Chart widget showing the SPX intraday chart. The panel is designed to host additional market data components in the future.

## Layout Reference

From Task 51 layout spec, the left panel sits between the status bar and the bottom of the viewport:

```
┌──────────────────┬───────────────────────────────┬────────────────────────┐
│                  │ [ AI Conversation ] [ Preview ]│ [ Positions ] [ News ] │
│  MARKET DATA     │───────────────────────────────│────────────────────────│
│  PANEL           │                               │                        │
│  (TradingView +  │  <active tab content>         │  <active sidebar tab>  │
│   future items)  │                   [Task 53/54]│                        │
│                  │                               │                        │
│                  ├───────────────────────────────┤                        │
│                  │  CHAT INPUT BAR    [Task 53]  │                        │
└──────────────────┴───────────────────────────────┴────────────────────────┘
```

- **Left panel**: `w-[20%]`, border-right, full height below status bar
- **Middle area**: `w-[60%]` / `flex-1` (unchanged — AI Conversation / Preview + Chat Input)
- **Right sidebar**: `w-[20%]` (unchanged)

## Changes

### New: `client/src/components/TradingViewChart.tsx`

Embed TradingView's Advanced Chart widget using a `<script>` injected into a container div via `useEffect`.

```tsx
import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
}

export default function TradingViewChart({
  symbol = "AMEX:SPY",
  interval = "5",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      studies: ["STD;VWAP"],
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={containerRef} />
  );
}
```

Key decisions:
- `autosize: true` makes the widget fill its container
- Default symbol `AMEX:SPY` with 5-minute interval for 0DTE intraday trading (SPX not available in free embed)
- `allow_symbol_change: true` so user can switch to SPY or VIX if needed
- Dark theme to match the app

### New: `client/src/components/MarketDataPanel.tsx`

Container component for the left panel. Initially renders only the TradingView chart, but structured to accommodate additional market data sections later.

```tsx
import TradingViewChart from "./TradingViewChart";

export default function MarketDataPanel() {
  return (
    <aside
      className="w-[20%] flex flex-col shrink-0 overflow-y-auto"
      style={{ background: "var(--bg-panel)", borderRight: "1px solid var(--border)" }}
    >
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
```

### Modify: `client/src/App.tsx`

Add the market data panel before the middle area inside the main `flex` container:

1. Import `MarketDataPanel`
2. Add `<MarketDataPanel />` as the first child of the main flex area

The middle area keeps `flex-1` and adjusts naturally.

## Done When

- Market Data panel renders at 20% width with the TradingView Advanced Chart widget in a 50%-height container
- Chart shows SPY with 5-minute candles, VWAP indicator, dark theme
- Middle and right panels are unaffected and still functional
- No TypeScript or build errors (`npm run build`)
- Layout matches the 3-column design from Task 51
