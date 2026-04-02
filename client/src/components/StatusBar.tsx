import { useEffect, useState } from "react";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useStatus } from "../hooks/useStatus";
import AppMenu from "./AppMenu";

function getETTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " ET";
}

function getMarketStatus(): "RTH" | "Pre-Market" | "Closed" {
  const now = new Date();
  const parts = Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (["Sat", "Sun"].includes(weekday)) return "Closed";
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const total = h * 60 + m;
  if (total >= 570 && total < 960) return "RTH";
  return "Pre-Market";
}

interface StatusBarProps {
  onOpenMarketSummary: () => void;
  indexesOpen: boolean;
  onToggleIndexes: () => void;
}

export default function StatusBar({ onOpenMarketSummary, indexesOpen, onToggleIndexes }: StatusBarProps) {
  const status = useStatus();
  const [clock, setClock] = useState(getETTime);

  useEffect(() => {
    const id = setInterval(() => setClock(getETTime()), 1000);
    return () => clearInterval(id);
  }, []);

  const marketStatus = getMarketStatus();

  const healthColor =
    status === null
      ? "bg-red-500"
      : status.status === "ok"
      ? "bg-green-500"
      : "bg-yellow-500";

  const aiColor =
    !status
      ? "text-gray-500"
      : status.ai.status === "ok"
      ? "text-green-400"
      : status.ai.status === "error"
      ? "text-red-400"
      : "text-gray-400";

  const marketBadgeClass =
    marketStatus === "RTH"
      ? "bg-green-900 text-green-300"
      : marketStatus === "Pre-Market"
      ? "bg-yellow-900 text-yellow-300"
      : "bg-gray-800 text-gray-400";

  return (
    <header className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 shrink-0">
      {/* Left: menu + title */}
      <AppMenu onOpenMarketSummary={onOpenMarketSummary} />
      <span className="ml-2 text-base font-bold text-gray-100 tracking-wide">0 DTE Copilot</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: statuses */}
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${healthColor}`} />
        <span className={`text-xs font-mono ${aiColor}`}>
          AI: {status ? `${status.ai.status} · ${status.ai.provider}` : "—"}
        </span>
        <span className="text-gray-700">|</span>
        <span className="text-xs font-mono text-gray-300">{clock}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${marketBadgeClass}`}>
          {marketStatus}
        </span>
        <button
          onClick={onToggleIndexes}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-colors"
          title={indexesOpen ? "Close Indexes panel" : "Open Indexes panel"}
        >
          {indexesOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
    </header>
  );
}
