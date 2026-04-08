# Task 60 — Market Snapshot Display in Market Data Panel ✅ COMPLETED (2026-04-08)

## Goal

Display SPX daily stats and latest VIX/$ADD/$TICK values above the TradingView chart in the left Market Data Panel. Data is polled from `GET /api/market-snapshot` (Task 19) every 30 seconds.

## Layout

```
┌────────────────────┐
│  SPX    5623.50    │
│  +13.50  (+0.24%)  │
│  O 5610  H 5635    │
│  L 5605             │
├────────────────────┤
│  VIX    ADD   TICK │
│  18.5  -320  -280  │
├────────────────────┤
│                    │
│  TradingView Chart │
│  (existing h-[50%])│
│                    │
├────────────────────┤
│  RSI: 58.2  ATR: 42.5  │
│  MA20  MA50  MA100 MA200 │  ← green if MA < price, red if MA > price
├────────────────────┤
│  (future sections) │
└────────────────────┘
```

## Changes

### New: `client/src/api/marketSnapshot.ts`

Fetch wrapper and TypeScript interface:

```typescript
export interface MarketSnapshot {
  spx: {
    price: number;
    o: number;
    h: number;
    l: number;
    change: number;
    changePct: number;
    rsi: number | null;
    atr: number | null;
    ma: { "20": number | null; "50": number | null; "100": number | null; "200": number | null };
  };
  indexes: {
    vix: number | null;
    add: number | null;
    tick: number | null;
  };
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const res = await fetch("/api/market-snapshot");
  if (!res.ok) throw new Error(`market-snapshot: ${res.status}`);
  return res.json();
}
```

### New: `client/src/hooks/useMarketSnapshot.ts`

Polling hook mirroring `useStatus` pattern (30s interval):

```typescript
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
```

### New: `client/src/components/SpxSummary.tsx`

Compact card showing SPX price, change (points + %), and O/H/L:

- Price in `text-base font-semibold`
- Change colored green (positive) / red (negative)
- O/H/L in `text-xs` with muted labels
- `--` placeholders when data is null
- Card styled with `var(--bg-card)` background, `var(--border)` border, rounded-lg

Props: `{ spx: MarketSnapshot["spx"] | null }`

### New: `client/src/components/IndexTicker.tsx`

Single row showing VIX, $ADD, $TICK as label + value pairs:

- Three items side by side, each with `text-xs` label and `text-sm` value
- Color coding:
  - VIX: red if > 20, green if < 15, default otherwise
  - ADD: green if > 0, red if < 0
  - TICK: green if > 0, red if < 0
- `--` placeholder when null
- Same card styling as SpxSummary

Props: `{ indexes: MarketSnapshot["indexes"] | null }`

### Modify: `client/src/components/MarketDataPanel.tsx`

Add hook and new components above the chart container:

```tsx
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
```

## Dependencies

- Task 19 (`GET /api/market-snapshot`) must be implemented first

## Done When

- SPX price, change, changePct, O/H/L display above the chart
- VIX/ADD/TICK display below SPX summary, above the chart
- Data refreshes every 30 seconds
- Graceful handling when data is unavailable (null/loading state)
- No TypeScript or build errors (`npm run build`)
