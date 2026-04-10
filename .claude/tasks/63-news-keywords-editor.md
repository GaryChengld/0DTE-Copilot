# Task 63 — News Keywords Editor (Client) ✅ COMPLETED (2026-04-09)

## Goal

Add a "News Keywords" button to the News panel header that opens a modal editor. The modal displays all current keywords in a spreadsheet-style list — one keyword per row — where the user can edit existing keywords inline, add new ones at the bottom, and delete any row with a trash icon. Saving calls `PUT /api/news/keywords` to replace the keyword list.

## Dependencies

- Task 20 (`GET /api/news/keywords` and `PUT /api/news/keywords`) must be complete (it is).

## Layout

```
News panel header:
┌────────────────────────────────────────┐
│  Economic News          [⚙] [↺]        │  ← ⚙ opens keywords modal
└────────────────────────────────────────┘

Keywords modal (centered, ~480px wide):
┌─────────────────────────────────────┐
│  News Keywords                   [X]│
├─────────────────────────────────────┤
│  [ fed                          ] 🗑 │
│  [ federal reserve              ] 🗑 │
│  [ fomc                         ] 🗑 │
│  [ ...                          ] 🗑 │
│  [ (new keyword...)             ] 🗑 │  ← last empty row for new entry
├─────────────────────────────────────┤
│  [+ Add]            [Cancel] [Save] │
└─────────────────────────────────────┘
```

## Changes

### New: `client/src/api/newsKeywords.ts`

```typescript
export async function fetchNewsKeywords(): Promise<string[]> {
  const res = await fetch("/api/news/keywords");
  if (!res.ok) throw new Error(`news/keywords: ${res.status}`);
  const data = await res.json();
  return data.keywords;
}

export async function saveNewsKeywords(keywords: string[]): Promise<string[]> {
  const res = await fetch("/api/news/keywords", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords }),
  });
  if (!res.ok) throw new Error(`news/keywords PUT: ${res.status}`);
  const data = await res.json();
  return data.keywords;
}
```

### New: `client/src/components/NewsKeywordsModal.tsx`

Modal with a spreadsheet-style keyword list. State is a local `string[]` copy of the server list — edits are local until Save is clicked.

**Behavior:**
- On open: fetch keywords from `GET /api/news/keywords`, populate rows
- Each row: an `<input>` with the keyword value + a trash `<Trash2>` icon button on the right
- Inputs are full-width and borderless (like a spreadsheet cell), with a bottom border only, matching the dark theme
- "Add" button appends an empty string row and focuses it
- Trash icon removes that row immediately from local state
- Pressing Enter on any row appends a new empty row below and focuses it
- "Save" button: filters out blank rows, deduplicates, calls `PUT /api/news/keywords`, then closes modal on success
- "Cancel" / X closes without saving
- Saving state: "Save" button shows "Saving…" while in flight; shows inline error on failure

**Props:** `{ onClose: () => void }`

**Pattern:** Follow `MarketSummaryModal.tsx` for modal backdrop, container, header, and button styles.

```tsx
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
    // Focus last input after render
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
      const saved = await saveNewsKeywords(trimmed);
      setRows(saved);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="rounded-lg shadow-xl w-[480px] flex flex-col max-h-[80vh]"
        style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-gray-100 text-sm font-semibold">News Keywords</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Keyword list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : (
            rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 py-1" style={{ borderBottom: "1px solid var(--border)" }}>
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700 shrink-0">
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-muted)" }}>
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
```

### Modify: `client/src/components/NewsPanel.tsx`

- Add a settings gear icon (`<Settings size={14}>`) button next to the refresh button in the panel header
- Accept new prop `onKeywords: () => void` and call it when the gear is clicked

```tsx
interface Props {
  news: NewsItem[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onKeywords: () => void;  // ← new
}

// In the header:
<button onClick={onKeywords} className="p-1 rounded hover:bg-white/10 transition-colors" title="Edit keywords">
  <Settings size={14} style={{ color: "var(--text-muted)" }} />
</button>
```

### Modify: `client/src/App.tsx`

- Add `useState` for `keywordsOpen`
- Pass `onKeywords={() => setKeywordsOpen(true)}` to `<NewsPanel>`
- Conditionally render `<NewsKeywordsModal onClose={() => setKeywordsOpen(false)} />` alongside other modals

```tsx
const [keywordsOpen, setKeywordsOpen] = useState(false);

// In NewsPanel usage:
<NewsPanel ... onKeywords={() => setKeywordsOpen(true)} />

// With other modals:
{keywordsOpen && <NewsKeywordsModal onClose={() => setKeywordsOpen(false)} />}
```

## Done When

- Gear icon appears in the News panel header
- Clicking it opens the Keywords modal, which loads current keywords from the server
- Each keyword is editable inline; rows can be deleted with the trash icon
- "Add" button and Enter key both append a new empty row
- "Save" trims, deduplicates, sends `PUT /api/news/keywords`, closes on success
- No TypeScript or build errors (`npm run build`)
