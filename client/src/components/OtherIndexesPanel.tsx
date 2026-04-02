import { useEffect, useState } from "react";
import { saveOtherIndexes } from "../api/otherIndexes";

function currentETTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface OtherIndexesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function OtherIndexesPanel({ open, onClose }: OtherIndexesPanelProps) {
  const [time, setTime] = useState("");
  const [vix, setVix] = useState("");
  const [add, setAdd] = useState("");
  const [tick, setTick] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTime, setSavedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTime(currentETTime());
    }
  }, [open]);

  async function handleSave() {
    if (!vix && !add && !tick) {
      setError("Enter at least one value (VIX, ADD, or TICK).");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedTime(null);
    try {
      const payload: Parameters<typeof saveOtherIndexes>[0] = { time: time || undefined };
      if (vix) payload.vix = parseFloat(vix);
      if (add) payload.add = parseInt(add, 10);
      if (tick) payload.tick = parseInt(tick, 10);
      const res = await saveOtherIndexes(payload);
      setVix("");
      setAdd("");
      setTick("");
      setSavedTime(res.time);
      setTimeout(() => setSavedTime(null), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Slide-out panel */}
      <div
        className={`fixed top-10 right-0 h-[calc(100%-2.5rem)] w-[220px] bg-gray-900 border-l border-gray-700 shadow-xl z-30 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-4 py-3 border-b border-gray-700 shrink-0">
          <p className="text-sm font-semibold text-gray-100">Other Indexes</p>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 flex-1">
          {/* Time */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Time (HH:MM)</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="HH:MM"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* VIX */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">VIX</label>
            <input
              type="number"
              step="0.01"
              value={vix}
              onChange={(e) => setVix(e.target.value)}
              placeholder="e.g. 18.50"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* ADD */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">$ADD</label>
            <input
              type="number"
              step="1"
              value={add}
              onChange={(e) => setAdd(e.target.value)}
              placeholder="e.g. -320"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* TICK */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">$TICK</label>
            <input
              type="number"
              step="1"
              value={tick}
              onChange={(e) => setTick(e.target.value)}
              placeholder="e.g. -280"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Feedback */}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {savedTime && <p className="text-green-400 text-xs">Saved ✓ {savedTime}</p>}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-auto px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Backdrop when open */}
    </>
  );
}
