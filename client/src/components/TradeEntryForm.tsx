import { useState } from "react";
import { openTrade } from "../api/trades";

interface TradeEntryFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TradeEntryForm({ onSuccess, onCancel }: TradeEntryFormProps) {
  const [symbol, setSymbol] = useState("SPX");
  const [tradeType, setTradeType] = useState("SPREAD");
  const [spreadType, setSpreadType] = useState("CREDIT");
  const [optionType, setOptionType] = useState("PUT");
  const [strike, setStrike] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [entryTime, setEntryTime] = useState(nowLocalDatetime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!symbol || !quantity || !entryPrice) {
      setError("Symbol, Quantity, and Entry Price are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await openTrade({
        symbol,
        tradeType,
        spreadType,
        optionType: optionType || undefined,
        strike: strike || undefined,
        quantity: parseInt(quantity, 10),
        entryPrice: entryPrice ? parseFloat(entryPrice) : undefined,
        entryTime: entryTime || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open trade.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500";
  const labelClass = "text-xs text-gray-400";

  return (
    <div className="border border-gray-700 rounded p-3 flex flex-col gap-2 bg-gray-850">
      <p className="text-xs font-semibold text-gray-300">New Trade</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Symbol</label>
          <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Quantity</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Trade Type</label>
          <select value={tradeType} onChange={(e) => setTradeType(e.target.value)} className={inputClass}>
            <option>SPREAD</option>
            <option>SINGLE</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Spread Type</label>
          <select value={spreadType} onChange={(e) => setSpreadType(e.target.value)} className={inputClass}>
            <option>CREDIT</option>
            <option>DEBIT</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Option Type</label>
          <select value={optionType} onChange={(e) => setOptionType(e.target.value)} className={inputClass}>
            <option>PUT</option>
            <option>CALL</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Strike</label>
          <input type="text" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="e.g. 5510/5500" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Entry Price</label>
          <input type="number" step="0.01" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Entry Time</label>
          <input type="datetime-local" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className={inputClass} />
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Opening…" : "Open Trade"}
        </button>
      </div>
    </div>
  );
}
