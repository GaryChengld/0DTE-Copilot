import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { SpxCandle } from "../api/spxCandles";

interface ChartSeries {
  candleSeries: ISeriesApi<"Candlestick">;
  vwapSeries: ISeriesApi<"Line">;
  volSeries: ISeriesApi<"Histogram">;
  rsiSeries: ISeriesApi<"Line">;
  rsi70Series: ISeriesApi<"Line">;
  rsi30Series: ISeriesApi<"Line">;
}

interface SpxCandleChartProps {
  candles: SpxCandle[];
}

// Convert "YYYY-MM-DDTHH:mm" ET string to Unix seconds.
// We treat the ET datetime as UTC ("fake UTC") so the chart displays correct ET labels
// without any timezone offset — lightweight-charts displays timestamps in UTC by default.
function toUnixET(timeStr: string): UTCTimestamp {
  return Math.floor(new Date(`${timeStr}:00Z`).getTime() / 1000) as UTCTimestamp;
}


export default function SpxCandleChart({ candles }: SpxCandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "#1c2333" },
        textColor: "#8b949e",
        attributionLogo: false,
        panes: {
          separatorColor: "#30363d",
          separatorHoverColor: "#444d56",
        },
      },
      grid: {
        vertLines: { color: "#30363d" },
        horzLines: { color: "#30363d" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: "#30363d",
        // Push candles up so volume fits in the bottom 25% of the main pane
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#30363d",
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    // Pane 0 — candlesticks + VWAP
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Volume overlaid in pane 0 — uses a separate overlay scale pinned to the bottom
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    // Pane 1 — RSI
    const rsiPane = chart.addPane();
    const rsiSeries = rsiPane.addSeries(LineSeries, {
      color: "#ce93d8",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const rsi70Series = rsiPane.addSeries(LineSeries, {
      color: "#ef5350",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const rsi30Series = rsiPane.addSeries(LineSeries, {
      color: "#26a69a",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // RSI pane takes ~25% of total height, set after a frame so clientHeight is ready
    // Also re-apply separator color here so it takes effect after the pane DOM element exists
    requestAnimationFrame(() => {
      const totalHeight = container.clientHeight;
      if (totalHeight > 0) {
        chart.panes()[0].setHeight(Math.floor(totalHeight * 0.75));
        chart.panes()[1].setHeight(Math.floor(totalHeight * 0.25));
      }
      chart.applyOptions({
        layout: {
          panes: {
            separatorColor: "#30363d",
            separatorHoverColor: "#444d56",
          },
        },
      });
      // Direct DOM override: find the thin separator row(s) lightweight-charts renders
      // between panes and force the background color, since inline styles can race
      container.querySelectorAll<HTMLElement>("tr").forEach((tr) => {
        if (tr.clientHeight > 0 && tr.clientHeight <= 6) {
          tr.style.setProperty("background", "#30363d", "important");
          tr.querySelectorAll<HTMLElement>("td").forEach((td) => {
            td.style.setProperty("background", "#30363d", "important");
          });
        }
      });
    });

    seriesRef.current = { candleSeries, vwapSeries, volSeries, rsiSeries, rsi70Series, rsi30Series };

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Update data when candles change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !seriesRef.current || candles.length === 0) return;

    const { candleSeries, vwapSeries, volSeries, rsiSeries, rsi70Series, rsi30Series } = seriesRef.current;

    candleSeries.setData(candles.map((c) => ({
      time: toUnixET(c.t),
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    })));

    vwapSeries.setData(candles.map((c) => ({
      time: toUnixET(c.t),
      value: c.vwap,
    })));

    volSeries.setData(candles.map((c) => ({
      time: toUnixET(c.t),
      value: c.v,
      color: c.c >= c.o ? "#26a69a80" : "#ef535080",
    })));

    const rsiData = candles
      .filter((c) => c.rsi !== null)
      .map((c) => ({ time: toUnixET(c.t), value: c.rsi! }));

    if (rsiData.length > 0) {
      rsiSeries.setData(rsiData);
      // Reference lines need at least 2 distinct timestamps
      if (candles.length >= 2) {
        const t0 = toUnixET(candles[0].t);
        const t1 = toUnixET(candles[candles.length - 1].t);
        rsi70Series.setData([{ time: t0, value: 70 }, { time: t1, value: 70 }]);
        rsi30Series.setData([{ time: t0, value: 30 }, { time: t1, value: 30 }]);
      }
    }

    if (!fittedRef.current) {
      chart.timeScale().fitContent();
      fittedRef.current = true;
    }
  }, [candles]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {candles.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}
