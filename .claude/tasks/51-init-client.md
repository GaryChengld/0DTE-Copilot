# Task 51 — Initialize Client Application ✅ COMPLETED (2026-03-30)

## Goal

Scaffold the React frontend in a new `client/` directory at the repo root. Set up Vite + React +
TypeScript + Tailwind CSS dark theme, install required dependencies, configure the Vite dev proxy
to forward API and Socket.io traffic to the backend, and create the base shell layout with
placeholder panels.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  STATUS BAR (h-10)  · health · AI · ET clock · market hours   [☰]  │
│                                                             [Task 52]│
├──────────────────────────────────────────┬───────────────────────────┤
│ [ AI Conversation ] [ Preview Prompt ]   │                           │
│──────────────────────────────────────────│  OPEN POSITIONS           │
│                                          │  (drill-down list)        │
│  <active tab content, scrollable>        │                           │
│                              [Task 53/54]│  NEW TRADE FORM           │
│                                          │                           │
│                                          │               [Task 55]   │
├──────────────────────────────────────────┤                           │
│  CHAT INPUT BAR (h-24)        [Task 53]  │                           │
└──────────────────────────────────────────┴───────────────────────────┘
                                               ┌──┐
                                               │  │ ← Other Indexes
                                               │  │   slide-out tab
                                               │  │   (fixed, right edge)
                                               └──┘   [Task 57]

☰ Menu (Task 52):
  · Restart AI Session
  · Market Summary [Task 56]  ← opens modal overlay
```

- Main left area has two tabs at the top: "AI Conversation" (Task 53) and "Preview Prompt" (Task 54)
- Active tab content is scrollable; Chat Input Bar is always visible below the tabs
- Right sidebar (w-80) is always visible: Open Positions (drill-down) + New Trade Form
- Market Summary is accessible via the `☰` menu in the status bar (modal, not sidebar)
- Other Indexes panel is a fixed overlay tab on the right edge, hidden by default

## Changes

### New: `client/` directory at repo root

Scaffold with:
```bash
npm create vite@latest client -- --template react-ts
```

### Install dependencies

```bash
# From client/
npm install socket.io-client lucide-react react-markdown
npm install -D tailwindcss @tailwindcss/vite
```

### Configure: `client/vite.config.ts`

Add dev server proxy so all `/api` and `/socket.io` requests forward to the backend:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
```

### Configure: `client/src/index.css`

Enable Tailwind and set dark background as default:

```css
@import "tailwindcss";

body {
  @apply bg-gray-950 text-gray-100;
}
```

### New: `client/src/hooks/useSocket.ts`

Singleton Socket.io connection hook:

```typescript
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket() {
  const ref = useRef<Socket | null>(null);

  if (!socket) {
    socket = io({ path: "/socket.io" });
  }
  ref.current = socket;

  useEffect(() => {
    return () => {
      // do not disconnect on unmount — singleton
    };
  }, []);

  return ref.current;
}
```

### New: `client/src/App.tsx`

Shell layout with placeholder sections:

```tsx
export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top strip */}
      <header className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4">
        <span className="text-sm text-gray-400">Status Bar — Task 52</span>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tabbed panel + chat input */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 bg-gray-900">
            <button className="px-4 py-2 text-sm text-gray-400">AI Conversation</button>
            <button className="px-4 py-2 text-sm text-gray-400">Preview Prompt</button>
          </div>
          {/* Active tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-gray-500 text-sm">Tab content — Tasks 53 / 54</p>
          </div>
          {/* Chat input */}
          <div className="h-24 border-t border-gray-800 p-3">
            <p className="text-gray-500 text-sm">Chat Input — Task 53</p>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-80 border-l border-gray-800 overflow-y-auto flex flex-col gap-4 p-4">
          <p className="text-gray-500 text-sm">Open Positions + Trade Form — Task 55</p>
        </aside>
      </div>

      {/* Other Indexes slide-out — Task 57 */}
    </div>
  );
}
```

### New: `client/src/main.tsx`

Standard Vite React entry point importing `index.css`.

## Done When

- `npm run dev` from `client/` starts on `http://localhost:5173`
- Page renders dark shell layout with placeholder labels
- No TypeScript or build errors (`npm run build`)
- Vite proxy forwards `/api/*` to `http://localhost:3001` (verify with browser network tab)
