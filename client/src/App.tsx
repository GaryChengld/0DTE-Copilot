import { useState } from "react";

type Tab = "conversation" | "preview";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("conversation");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Status bar */}
      <header className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 shrink-0">
        <span className="text-sm text-gray-400">Status Bar — Task 52</span>
      </header>

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
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "conversation" && (
              <p className="text-gray-500 text-sm">AI Conversation — Task 53</p>
            )}
            {activeTab === "preview" && (
              <p className="text-gray-500 text-sm">Preview Prompt — Task 54</p>
            )}
          </div>

          {/* Chat input bar */}
          <div className="h-24 border-t border-gray-800 p-3 shrink-0">
            <p className="text-gray-500 text-sm">Chat Input — Task 53</p>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-[30%] border-l border-gray-800 overflow-y-auto flex flex-col gap-4 p-4 shrink-0">
          <p className="text-gray-500 text-sm">Open Positions + Trade Form — Task 55</p>
        </aside>
      </div>

      {/* Other Indexes slide-out — Task 57 */}
    </div>
  );
}
