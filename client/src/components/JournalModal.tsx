import { useState } from "react";
import { X } from "lucide-react";

interface JournalModalProps {
  date: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function JournalModal({ date, initialContent, onSave, onClose }: JournalModalProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-5xl flex flex-col"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          height: "92vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-gray-700">
          <h2 className="text-gray-100 text-sm font-semibold">Journal — {date}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-0 px-5 py-4 text-sm resize-none focus:outline-none"
          style={{
            background: "var(--bg-card)",
            color: "#e6edf3",
            fontFamily: "ui-monospace, monospace",
          }}
          placeholder="Write your journal entry in Markdown..."
          autoFocus
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0 border-t border-gray-700">
          {error && <span className="text-xs text-red-400 mr-auto">{error}</span>}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
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
  );
}
