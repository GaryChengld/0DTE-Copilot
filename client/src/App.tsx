import { useState, useEffect } from "react";
import StatusBar from "./components/StatusBar";
import ConversationPanel from "./components/ConversationPanel";
import ChatInputBar from "./components/ChatInputBar";
import PreviewAnalysisPrompt, { type PreviewTrigger } from "./components/PreviewAnalysisPrompt";
import MarketSummaryModal from "./components/MarketSummaryModal";
import OtherIndexesPanel from "./components/OtherIndexesPanel";
import OpenPositions from "./components/OpenPositions";
import NewsPanel from "./components/NewsPanel";
import NewsKeywordsModal from "./components/NewsKeywordsModal";
import MarketDataPanel from "./components/MarketDataPanel";
import RulesPanel from "./components/RulesPanel";
import HistoryPanel from "./components/HistoryPanel";
import { getNews, type NewsItem } from "./api/news";

type Tab = "conversation" | "preview" | "rules";
type AppMode = "trading" | "review";
type SidebarTab = "positions" | "news";

export default function App() {
  const [mode, setMode] = useState<AppMode>("trading");
  const [activeTab, setActiveTab] = useState<Tab>("conversation");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("news");
  const [marketSummaryOpen, setMarketSummaryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [previewTrigger, setPreviewTrigger] = useState<PreviewTrigger | null>(null);
  const [previewCounter, setPreviewCounter] = useState(0);
  const [indexesOpen, setIndexesOpen] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  async function loadNews() {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const data = await getNews();
      setNews(data.news);
    } catch (err) {
      setNewsError(err instanceof Error ? err.message : "Failed to load news");
    } finally {
      setNewsLoading(false);
    }
  }

  useEffect(() => { loadNews(); }, []);

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
        mode={mode}
        onSetMode={setMode}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Trading mode panels — always mounted to preserve scroll/state, hidden in review mode */}
        <div style={mode === "review" ? { display: "none" } : { display: "contents" }}>
          <MarketDataPanel />
        </div>
        <div className={`flex flex-col flex-1 overflow-hidden${mode === "review" ? " hidden" : ""}`}>
          {/* Tab bar */}
          <div className="flex border-b shrink-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === "conversation"
                  ? "border-blue-500 text-white"
                  : "border-transparent hover:text-white"
              }`}
              style={{ color: activeTab === "conversation" ? undefined : "var(--text-muted)" }}
              onClick={() => setActiveTab("conversation")}
            >
              AI Conversation
            </button>
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === "preview"
                  ? "border-blue-500 text-white"
                  : "border-transparent hover:text-white"
              }`}
              style={{ color: activeTab === "preview" ? undefined : "var(--text-muted)" }}
              onClick={() => setActiveTab("preview")}
            >
              Preview Prompt
            </button>
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                activeTab === "rules"
                  ? "border-blue-500 text-white"
                  : "border-transparent hover:text-white"
              }`}
              style={{ color: activeTab === "rules" ? undefined : "var(--text-muted)" }}
              onClick={() => setActiveTab("rules")}
            >
              Evaluation
</button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className={`absolute inset-0 overflow-y-auto py-4 px-[1.5%]${activeTab !== "conversation" ? " hidden" : ""}`}>
              <ConversationPanel />
            </div>
            <div className={`absolute inset-0 overflow-y-auto py-4 px-[1.5%]${activeTab !== "preview" ? " hidden" : ""}`}>
              <PreviewAnalysisPrompt trigger={previewTrigger} />
            </div>
            <div className={`absolute inset-0${activeTab !== "rules" ? " hidden" : ""}`}>
              <RulesPanel />
            </div>
          </div>

          {activeTab !== "rules" && (
            <div className="h-24 py-3 px-[1.5%] shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <ChatInputBar
                message={message}
                onMessageChange={setMessage}
                activeTab={activeTab}
                onPreview={handlePreview}
              />
            </div>
          )}
        </div>

        {/* Review mode panel — always mounted to preserve calendar state, hidden in trading mode */}
        <div className={`flex-1 overflow-hidden${mode === "trading" ? " hidden" : ""}`}>
          <HistoryPanel visible={mode === "review"} />
        </div>

        {/* Right sidebar */}
        <aside className="w-[20%] flex flex-col shrink-0" style={{ background: "var(--bg-panel)", borderLeft: "1px solid var(--border)" }}>
          {/* Sidebar tab bar */}
          <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {(["news", "positions"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors capitalize ${
                  sidebarTab === tab ? "border-blue-500 text-white" : "border-transparent hover:text-white"
                }`}
                style={{ color: sidebarTab === tab ? undefined : "var(--text-muted)" }}
              >
                {tab === "positions" ? "Positions" : "News"}
              </button>
            ))}
          </div>
          {/* Sidebar tab content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "positions" && (
              <div className="flex flex-col gap-4 p-4">
                <OpenPositions />
              </div>
            )}
            {sidebarTab === "news" && (
              <NewsPanel news={news} loading={newsLoading} error={newsError} onRefresh={loadNews} onKeywords={() => setKeywordsOpen(true)} />
            )}
          </div>
        </aside>
      </div>

      {marketSummaryOpen && (
        <MarketSummaryModal onClose={() => setMarketSummaryOpen(false)} />
      )}
      {keywordsOpen && (
        <NewsKeywordsModal onClose={() => setKeywordsOpen(false)} />
      )}

      <OtherIndexesPanel open={indexesOpen} />
    </div>
  );
}
