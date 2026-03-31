# Task 54 — Preview Analysis Prompt

## Goal

Build the "Preview Prompt" tab. It fetches and displays the analysis prompt JSON without
sending it to AI. Includes a Copy button. No history — each fetch overwrites the previous result.

The left main area has two tabs — "AI Conversation" (Task 53) and "Preview Prompt" (this task).
Switching to this tab shows the preview content; the Chat Input Bar below remains visible always.

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

Tab content rendered when "Preview Prompt" tab is active:

- `[Preview Analysis Prompt]` button at the top
  - Calls `POST /api/ai/analyze/message` (passes `user_notes` from the shared state in `ChatInputBar`)
  - Shows loading spinner while fetching
  - On success: renders the JSON in a `<pre>` code block (formatted with `JSON.stringify(data, null, 2)`)
  - Each fetch overwrites previous result — no history
- `[Copy]` button (top-right of code block):
  - Copies raw JSON string to clipboard via `navigator.clipboard.writeText()`
  - Shows "Copied ✓" for 2 seconds then reverts
- Empty state: "Click Preview to inspect the analysis prompt"

## Done When

- "Preview Prompt" tab renders this component when active
- Clicking Preview fetches and displays the full JSON prompt
- Copy button copies to clipboard and shows brief confirmation
- Fetching again overwrites the previous result
