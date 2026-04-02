import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Loader2 } from "lucide-react";
import { triggerAnalysis } from "../api/chat";
import { useSocket } from "../hooks/useSocket";

export default function ChatInputBar() {
  const [message, setMessage] = useState("");
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
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || !socket) return;
    setMessage("");
    socket.emit("chat:message", trimmed);
  }

  function handleAnalyze() {
    setAnalyzing(true);
    const notes = message.trim();
    setMessage("");
    triggerAnalysis(notes || undefined).catch(() => {
      setAnalyzing(false);
    });
  }

  return (
    <div className="flex gap-2 h-full items-end">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message AI… (Ctrl+Enter to send)"
        className="flex-1 h-full resize-none bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
      />

      <div className="flex flex-col gap-1 shrink-0">
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
      </div>
    </div>
  );
}
