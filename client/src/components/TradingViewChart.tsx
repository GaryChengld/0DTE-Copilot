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
      studies: ["STD;VWAP", "STD;RSI"],
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
