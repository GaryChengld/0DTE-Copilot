import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Loader2, ScanSearch } from "lucide-react";
import { triggerAnalysis } from "../api/chat";
import { useSocket } from "../hooks/useSocket";

interface ChatInputBarProps {
  message: string;
  onMessageChange: (value: string) => void;
  activeTab: "conversation" | "preview";
  onPreview: (userNotes: string) => void;
}

export default function ChatInputBar({ message, onMessageChange, activeTab, onPreview }: ChatInputBarProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const socket = useSocket();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!socket) return;
    function onResponse() {
      setAnalyzing(false);
    }
    socket.on("chat:response", onResponse);
    return () => { socket.off("chat:response", onResponse); };
  }, [socket]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      if (activeTab === "conversation") handleSend();
    }
  }

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || !socket) return;
    onMessageChange("");
    socket.emit("chat:message", trimmed);
  }

  function handleAnalyze() {
    setAnalyzing(true);
    const notes = message.trim();
    onMessageChange("");
    triggerAnalysis(notes || undefined).catch(() => {
      setAnalyzing(false);
    });
  }

  function handlePreview() {
    onPreview(message.trim());
    onMessageChange("");
  }

  return (
    <div className="flex gap-2 h-full items-end">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          activeTab === "preview"
            ? "User notes for analysis prompt (optional)…"
            : "Message AI… (Ctrl+Enter to send)"
        }
        className="flex-1 h-full resize-none rounded px-3 py-2 text-sm placeholder-gray-600 focus:outline-none"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "#e6edf3" }}
      />

      <div className="flex flex-col gap-1 shrink-0">
        {activeTab === "conversation" ? (
          <>
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <SendHorizontal size={14} />
              Send
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-3 py-1.5 rounded bg-green-700 text-white text-sm hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {analyzing && <Loader2 size={14} className="animate-spin" />}
              Analyze
            </button>
          </>
        ) : (
          <button
            onClick={handlePreview}
            className="px-3 py-1.5 rounded bg-purple-700 text-white text-sm hover:bg-purple-600 transition-colors flex items-center gap-1"
          >
            <ScanSearch size={14} />
            Preview Analysis
          </button>
        )}
      </div>
    </div>
  );
}
