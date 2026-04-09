import { useState, useEffect, useRef } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { fetchNewsKeywords, saveNewsKeywords } from "../api/newsKeywords";

export default function NewsKeywordsModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNewsKeywords()
      .then((kws) => setRows(kws.length > 0 ? kws : [""]))
      .catch(() => setRows([""]))
      .finally(() => setLoading(false));
  }, []);

  function updateRow(i: number, val: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? val : r)));
  }

  function deleteRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [""];
    });
  }

  function addRow() {
    setRows((prev) => [...prev, ""]);
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input");
      inputs?.[inputs.length - 1]?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      setRows((prev) => {
        const next = [...prev];
        next.splice(i + 1, 0, "");
        return next;
      });
      requestAnimationFrame(() => {
        const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input");
        inputs?.[i + 1]?.focus();
      });
    }
  }

  async function handleSave() {
    const trimmed = [...new Set(rows.map((r) => r.trim().toLowerCase()).filter(Boolean))];
    setSaving(true);
    setError(null);
    try {
      await saveNewsKeywords(trimmed);
      onClose();
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
        className="rounded-lg shadow-xl w-[480px] flex flex-col"
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-700">
          <h2 className="text-gray-100 text-sm font-semibold">News Keywords</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Keyword list */}
        <div ref={listRef} className="h-[420px] overflow-y-auto px-5 py-2">
          {loading ? (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          ) : (
            rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <input
                  value={row}
                  onChange={(e) => updateRow(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  placeholder="keyword"
                  className="flex-1 bg-transparent text-sm focus:outline-none py-1"
                  style={{ color: "#e6edf3" }}
                />
                <button
                  onClick={() => deleteRow(i)}
                  className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-t border-gray-700">
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
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
