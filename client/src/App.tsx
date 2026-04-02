import { useState } from "react";
import StatusBar from "./components/StatusBar";
import ConversationPanel from "./components/ConversationPanel";
import ChatInputBar from "./components/ChatInputBar";

type Tab = "conversation" | "preview";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("conversation");
  const [marketSummaryOpen, setMarketSummaryOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <StatusBar onOpenMarketSummary={() => setMarketSummaryOpen(true)} />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tabbed panel + chat input */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === "conversation"
                  ? "border-blue-500 text-gray-100"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("conversation")}
            >
              AI Conversation
            </button>
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === "preview"
                  ? "border-blue-500 text-gray-100"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("preview")}
            >
              Preview Prompt
            </button>
          </div>

          {/* Active tab content */}
          <div className="flex-1 overflow-y-auto py-4 px-[4%]">
            {activeTab === "conversation" && <ConversationPanel />}
            {activeTab === "preview" && (
              <p className="text-gray-500 text-sm">Preview Prompt — Task 54</p>
            )}
          </div>

          {/* Chat input bar */}
          <div className="h-24 border-t border-gray-800 py-3 px-[4%] shrink-0">
            <ChatInputBar />
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-[30%] border-l border-gray-800 overflow-y-auto flex flex-col gap-4 p-4 shrink-0">
          <p className="text-gray-500 text-sm">Open Positions + Trade Form — Task 55</p>
        </aside>
      </div>

      {/* Market Summary modal placeholder — Task 56 */}
      {marketSummaryOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-40"
          onClick={() => setMarketSummaryOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded p-6 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-400 text-sm">Market Summary — Task 56</p>
            <button
              className="mt-4 text-xs text-gray-500 hover:text-gray-300"
              onClick={() => setMarketSummaryOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Other Indexes slide-out — Task 57 */}
    </div>
  );
}
