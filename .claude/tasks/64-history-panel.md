# Task 64 — Trading / Review Mode ✅ COMPLETED (2026-04-18)

## Goal

Replace the History tab in the middle panel with a two-mode application layout:

- **Trading mode** — current layout: Market Data panel (left), AI Conversation + Preview Prompt tabs (middle), News/Positions sidebar (right). No History tab.
- **Review mode** — left panel shows the calendar + SPX chart; middle panel shows AI Advice + Journal tabs for the selected date. Right sidebar unchanged.

Two toggle buttons in the status bar switch between modes.

## Status Bar — mode toggle

Add `mode` / `onSetMode` props to `StatusBar`. Render a pill-style toggle between the spacer and the existing right-side statuses:

```tsx
interface StatusBarProps {
  onOpenMarketSummary: () => void;
  indexesOpen: boolean;
  onToggleIndexes: () => void;
  mode: "trading" | "review";
  onSetMode: (mode: "trading" | "review") => void;
}
```

Toggle UI (between the flex-1 spacer and the status cluster):
```tsx
<div className="flex items-center rounded overflow-hidden border text-xs font-medium mr-3" style={{ borderColor: "var(--border)" }}>
  {(["trading", "review"] as const).map((m) => (
    <button
      key={m}
      onClick={() => onSetMode(m)}
      className={`px-3 py-1 capitalize transition-colors ${
        mode === m ? "bg-blue-600 text-white" : "hover:bg-white/10"
      }`}
      style={{ color: mode === m ? undefined : "var(--text-muted)" }}
    >
      {m}
    </button>
  ))}
</div>
```

## App.tsx changes

1. Add `mode` state: `const [mode, setMode] = useState<"trading" | "review">("trading")`
2. Pass `mode` + `onSetMode={setMode}` to `<StatusBar>`
3. Remove `"history"` from the `Tab` union — only `"conversation" | "preview"` remain
4. Remove the History tab button from the tab bar
5. Conditionally render the main area based on mode:

```tsx
{/* Main area */}
<div className="flex flex-1 overflow-hidden">
  {mode === "trading" ? (
    <>
      <MarketDataPanel />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Tab bar — conversation + preview only */}
        ...
        {/* Chat input — always visible in trading mode */}
        <div className="h-24 py-3 px-[1.5%] shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <ChatInputBar ... />
        </div>
      </div>
    </>
  ) : (
    <div className="flex-1 overflow-hidden">
      <HistoryPanel />
    </div>
  )}
  {/* Right sidebar — unchanged, always visible */}
  <aside ...>...</aside>
</div>
```

## HistoryPanel.tsx — no changes needed

The existing 35% calendar+chart / 65% AI advice+journal split maps directly to the review mode left+middle panel layout.

## Done When

- Trading and Review buttons appear in the status bar
- Clicking Review switches the main area to the HistoryPanel layout
- Clicking Trading switches back to Market Data + conversation/preview tabs
- No History tab in the middle panel tab bar
- ChatInputBar visible only in Trading mode
- No TypeScript or build errors
