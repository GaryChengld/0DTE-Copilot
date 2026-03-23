import { fetchMarketData } from "./marketData.js";

export interface MarketSnapshot {
  timestamp: string;
  market_data: {
    spx: {
      current: { open: number; high: number; low: number; close: number; volume: number };
      daily: { open: number; high: number; low: number; volume: number };
      vwap: number | null;
    };
    spy: {
      current: { open: number; high: number; low: number; close: number; volume: number };
      daily: { open: number; high: number; low: number; volume: number };
      vwap: number | null;
    };
    vix: number;
  };
}

function toETISOString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "shortOffset",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const tzName = get("timeZoneName"); // e.g. "GMT-4"
  const offsetMatch = tzName.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
  const offset = `${offsetHours >= 0 ? "+" : "-"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset}`;
}

export async function buildSnapshot(): Promise<MarketSnapshot> {
  const data = await fetchMarketData();

  return {
    timestamp: toETISOString(new Date()),
    market_data: {
      spx: {
        current: data.spx.current,
        daily: data.spx.daily,
        vwap: data.spx.vwap,
      },
      spy: {
        current: data.spy.current,
        daily: data.spy.daily,
        vwap: data.spy.vwap,
      },
      vix: data.vix,
    },
  };
}
