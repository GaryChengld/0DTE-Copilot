import { useState } from "react";
import StatusBar from "./components/StatusBar";
import ConversationPanel from "./components/ConversationPanel";
import ChatInputBar from "./components/ChatInputBar";
import PreviewAnalysisPrompt, { type PreviewTrigger } from "./components/PreviewAnalysisPrompt";
import MarketSummaryModal from "./components/MarketSummaryModal";
import OtherIndexesPanel from "./components/OtherIndexesPanel";

type Tab = "conversation" | "preview";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("conversation");
  const [marketSummaryOpen, setMarketSummaryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [previewTrigger, setPreviewTrigger] = useState<PreviewTrigger | null>(null);
  const [previewCounter, setPreviewCounter] = useState(0);
  const [indexesOpen, setIndexesOpen] = useState(false);

  function handlePreview(userNotes: string) {
    setPreviewCounter((n) => n + 1);
    setPreviewTrigger({ userNotes, id: previewCounter + 1 });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <StatusBar
        onOpenMarketSummary={() => setMarketSummaryOpen(true)}
        indexesOpen={indexesOpen}
        onToggleIndexes={() => setIndexesOpen((v) => !v)}
      />

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
            {activeTab === "preview" && <PreviewAnalysisPrompt trigger={previewTrigger} />}
          </div>

          {/* Chat input bar */}
          <div className="h-24 border-t border-gray-800 py-3 px-[4%] shrink-0">
            <ChatInputBar
              message={message}
              onMessageChange={setMessage}
              activeTab={activeTab}
              onPreview={handlePreview}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-[30%] border-l border-gray-800 overflow-y-auto flex flex-col gap-4 p-4 shrink-0">
          <p className="text-gray-500 text-sm">Open Positions + Trade Form — Task 55</p>
        </aside>
      </div>

      {marketSummaryOpen && (
        <MarketSummaryModal onClose={() => setMarketSummaryOpen(false)} />
      )}

      <OtherIndexesPanel open={indexesOpen} onClose={() => setIndexesOpen(false)} />
    </div>
  );
}
