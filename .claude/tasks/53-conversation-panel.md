# Task 53 — AI Conversation Panel + Chat Input

## Goal

Build the "AI Conversation" tab and the chat/analyze input bar that sits below the tabbed area.
The left main area has two tabs at the top — "AI Conversation" (this task) and "Preview Prompt"
(Task 54). The Chat Input Bar is always visible regardless of the active tab.

## Changes

### New: `client/src/api/chat.ts`

```typescript
export async function getAiAdvices(): Promise<AiAdvice[]>
export async function sendChat(message: string): Promise<{ response: string }>
export async function triggerAnalysis(userNotes?: string): Promise<{ response: string }>
```

`AiAdvice` shape:
```typescript
interface AiAdvice {
  id: number;
  timestamp: string;
  source: string;   // "user" | "session_summary"
  prompt: string | null;
  response: string;
  provider: string;
}
```

### New: `client/src/components/ConversationPanel.tsx`

- On mount: fetch `GET /api/ai-advices`; filter out records where `source === "session_summary"`; display remaining as AI messages
- Socket.io: subscribe to `chat:response` event via `useSocket()`; append new messages as they arrive
- Each message shows:
  - Source badge: `chat` (blue) or `analysis` (green)
  - AI response rendered with `react-markdown`
  - Timestamp (right-aligned, small)
- Auto-scroll to bottom on new message
- `chat:error` event → display inline error banner

### New: `client/src/components/ChatInputBar.tsx`

Two modes in one bar:

**Chat mode:**
- Textarea (Ctrl+Enter or [Send] button) → `POST /api/chat` with `{ message }`
- Response arrives via Socket.io; no need to parse HTTP response body for display

**Analyze mode:**
- Optional `user_notes` text input (single line, collapsible)
- `[Analyze ▶]` button → `POST /api/ai/analyze` with optional `{ user_notes }`
- Button disables + shows spinner on click
- Re-enables when `chat:response` Socket.io event is received
- Note: session restarts in background after analysis — no UI action needed

## Done When

- On load, last 3 AI advice records appear (session_summary entries excluded)
- Sending a chat message shows the response in the panel via Socket.io
- Triggering analysis disables the button until Socket.io response arrives
- New messages auto-scroll into view
- AI response text renders Markdown (bold, lists, headings)
