# Task 54 — Preview Analysis Prompt ✅ COMPLETED (2026-04-01)

## Goal

Build the "Preview Prompt" tab content. It fetches and displays the analysis prompt JSON without
sending it to AI. Includes a Copy button. No history — each fetch overwrites the previous result.

The Chat Input Bar below is shared between both tabs. On the "Preview Prompt" tab, the input bar
shows a textarea + "Preview Analysis" button. Typing user notes and clicking the button triggers
a fetch and populates this panel.

## Changes

### New: `client/src/api/analysis.ts`

```typescript
export async function getAnalysisPayload(userNotes?: string): Promise<unknown> {
  const res = await fetch("/api/ai/analyze/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userNotes ? { user_notes: userNotes } : {}),
  });
  return res.json();
}
```

### New: `client/src/components/PreviewAnalysisPrompt.tsx`

Props: `trigger: PreviewTrigger | null`

```typescript
export interface PreviewTrigger {
  userNotes: string;
  id: number;
}
```

- Watches `trigger` via `useEffect`. When `trigger` changes (new `id`), fetches `POST /api/ai/analyze/message` with `trigger.userNotes`
- Shows loading indicator while fetching
- On success: renders the JSON in a `<pre>` code block (`JSON.stringify(data, null, 2)`)
- Each fetch overwrites previous result — no history
- `[Copy]` button (top-right of code block):
  - Copies raw JSON string to clipboard via `navigator.clipboard.writeText()`
  - Shows "Copied ✓" for 2 seconds then reverts
- Empty state: "Use the input below to preview the analysis prompt."

### Updated: `client/src/App.tsx`

- Holds `previewTrigger: PreviewTrigger | null` state and `previewCounter: number`
- `handlePreview(userNotes)`: increments counter, sets `previewTrigger = { userNotes, id: counter }`
- Passes `activeTab` and `onPreview={handlePreview}` to `ChatInputBar`
- Passes `trigger={previewTrigger}` to `PreviewAnalysisPrompt`

### Updated: `client/src/components/ChatInputBar.tsx`

See Task 53 for full ChatInputBar spec including preview tab button.

## Done When

- "Preview Prompt" tab shows this component when active
- Typing in the shared textarea and clicking "Preview Analysis" fetches and displays the full JSON prompt
- `user_notes` from the textarea is included in the request
- Copy button copies to clipboard and shows brief confirmation
- Fetching again overwrites the previous result
