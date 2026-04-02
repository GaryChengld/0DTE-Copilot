import { useState } from "react";
import { X } from "lucide-react";
import { saveMarketSummary } from "../api/marketSummary";

interface MarketSummaryModalProps {
  onClose: () => void;
}

function nowETTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MarketSummaryModal({ onClose }: MarketSummaryModalProps) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      await saveMarketSummary(content.trim());
      setSavedAt(nowETTime());
      setTimeout(() => setSavedAt(null), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-[720px] flex flex-col"
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-gray-100 text-sm font-semibold">Market Summary</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={11}
            placeholder="GEX flip 5500, call wall 5700, put wall 5300, VIX 18..."
            className="w-full resize-none rounded px-3 py-2 text-sm placeholder-gray-600 focus:outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "#e6edf3" }}
          />

          <div className="flex items-center justify-between">
            <div className="text-sm">
              {savedAt && (
                <span className="text-green-400">Saved ✓ {savedAt} ET</span>
              )}
              {error && (
                <span className="text-red-400">{error}</span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
