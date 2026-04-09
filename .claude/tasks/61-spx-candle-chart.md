# Task 61 — SPX Candlestick Chart (Replace TradingView Embed) ✅ COMPLETED (2026-04-08)

## Goal

Replace the TradingView embed in the Market Data Panel with a self-drawn candlestick chart using the `lightweight-charts` v5 library (open-source, by TradingView). Data comes from `GET /api/spx/candles` (Task 21) and is polled every 30 seconds. The chart displays today's full RTH session: 5-minute candles with volume bars, VWAP overlay, and RSI(14) pane.

## Dependencies

- Task 21 (`GET /api/spx/candles`) must be implemented first
- Install: `npm install lightweight-charts` in `client/`

## Layout

```
┌──────────────────────────┐
│  Candlestick + VWAP line │  ← pane 0, 65% height
├──────────────────────────┤
│  Volume histogram        │  ← pane 1, 15% height
├──────────────────────────┤
│  RSI(14) line            │  ← pane 2, 20% height
│  — 70 / — 30 ref lines   │
└──────────────────────────┘
```

## Changes

### Install dependency

```bash
# From client/
npm install lightweight-charts
```

### New: `client/src/api/spxCandles.ts`

```typescript
export interface SpxCandle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vwap: number;
  open: boolean;
}

export async function fetchSpxCandles(): Promise<SpxCandle[]> {
  const res = await fetch("/api/spx/candles");
  if (!res.ok) throw new Error(`spx/candles: ${res.status}`);
  const data = await res.json();
  return data.candles;
}
```

### New: `client/src/components/SpxCandleChart.tsx`

Use `lightweight-charts` to render a candlestick chart with volume bars and VWAP line.

**Chart configuration:**
- Dark theme matching the app (`background: var(--bg-card)`, `textColor: var(--text-muted)`)
- Grid lines: subtle, using `var(--border)` color
- Two panes:
  - **Main pane** (80% height): `CandlestickSeries` + `LineSeries` for VWAP (blue, `lineWidth: 1`)
  - **Volume pane** (20% height): `HistogramSeries` — green for up candles, red for down candles

**Time format:** Convert `"HH:mm"` strings from the API to Unix timestamps using today's date in ET. Lightweight Charts requires Unix seconds for the `time` field.

**Data mapping:**
```typescript
// Convert "HH:mm" ET to Unix seconds
function toUnixET(timeStr: string): number {
  const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  return Math.floor(new Date(`${todayET}T${timeStr}:00-04:00`).getTime() / 1000);
}

// CandlestickSeries data
{ time: toUnixET(c.t), open: c.o, high: c.h, low: c.l, close: c.c }

// LineSeries (VWAP)
{ time: toUnixET(c.t), value: c.vwap }

// HistogramSeries (volume)
{ time: toUnixET(c.t), value: c.v, color: c.c >= c.o ? "#26a69a" : "#ef5350" }
```

**Polling:** Accept `candles` as a prop (data fetched by parent via `useSpxCandles` hook). Chart updates via `series.setData()` whenever candles prop changes.

**Empty state:** When `candles` is empty (outside RTH), show a centered "Market closed" message.

Props: `{ candles: SpxCandle[] }`

### New: `client/src/hooks/useSpxCandles.ts`

Poll `GET /api/spx/candles` every 30 seconds:

```typescript
import { useEffect, useState } from "react";
import { fetchSpxCandles, type SpxCandle } from "../api/spxCandles";

export function useSpxCandles() {
  const [candles, setCandles] = useState<SpxCandle[]>([]);

  useEffect(() => {
    const poll = () =>
      fetchSpxCandles()
        .then(setCandles)
        .catch(() => {});

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return candles;
}
```

### Modify: `client/src/components/MarketDataPanel.tsx`

- Remove `TradingViewChart` import and usage
- Import `SpxCandleChart` and `useSpxCandles`
- Pass candles to the chart:

```tsx
const candles = useSpxCandles();
// ...
<div className="h-[50%] shrink-0 p-2">
  <div className="h-full rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
    <SpxCandleChart candles={candles} />
  </div>
</div>
```

### Remove: `client/src/components/TradingViewChart.tsx`

No longer needed once `SpxCandleChart` is in place.

## Lightweight Charts v5 API Notes

- Import: `import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'`
- Use `createChart(container, options)` inside `useEffect` with a `ref`; call `chart.remove()` in cleanup
- Pane 0 (default): `chart.addSeries(CandlestickSeries)` + `chart.addSeries(LineSeries)` for VWAP
- Pane 1: `const volPane = chart.addPane(); volPane.addSeries(HistogramSeries)`
- Pane 2: `const rsiPane = chart.addPane(); rsiPane.addSeries(LineSeries)`
- Set pane heights via `chart.panes()[i].setHeight(pixels)` after chart creation
- Call `chart.timeScale().fitContent()` after `setData()` to auto-fit today's session
- RSI reference lines (70/30): add two additional `LineSeries` to the RSI pane with flat constant values

## RSI Calculation (client-side)

Use `technicalindicators` (install in `client/`):
```typescript
import { RSI } from 'technicalindicators';

function calcRsiSeries(candles: SpxCandle[]): { time: number; value: number }[] {
  const closes = candles.map((c) => c.c);
  const rsiValues = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - rsiValues.length;
  return rsiValues.map((value, i) => ({
    time: toUnixET(candles[offset + i].t),
    value: Math.round(value * 100) / 100,
  }));
}
```

## Done When

- Custom candlestick chart renders today's SPX 5-min candles with VWAP overlay, volume bars, and RSI(14) pane
- Chart auto-fits to today's RTH session
- Data refreshes every 30 seconds (live candle updates during market hours)
- "Market closed" message shown outside RTH
- No TypeScript or build errors (`npm run build`)
