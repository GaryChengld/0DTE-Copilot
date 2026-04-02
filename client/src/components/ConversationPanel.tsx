import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAiAdvices } from "../api/chat";
import { useSocket } from "../hooks/useSocket";

interface Message {
  key: string;
  source: string;
  response: string;
  displayTime: string;
}

function toETTime(isoString: string): string {
  // Normalize +00:00 → Z for broad browser compatibility
  const normalized = isoString.replace(/\+00:00$/, "Z");
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " ET"
  );
}

function nowETTime(): string {
  return (
    new Date().toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " ET"
  );
}

export default function ConversationPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  useEffect(() => {
    getAiAdvices()
      .then((data) =>
        setMessages(
          data
            .filter((m) => m.source !== "session_summary")
            .reverse()
            .map((m) => ({
              key: String(m.id),
              source: m.source,
              response: m.response,
              displayTime: toETTime(m.timestamp),
            }))
        )
      )
      .catch(() => setError("Failed to load messages."));
  }, []);

  useEffect(() => {
    if (!socket) return;

    function onResponse(msg: { source: string; response: string }) {
      setMessages((prev) => [
        ...prev,
        {
          key: `live-${Date.now()}`,
          source: msg.source,
          response: msg.response,
          displayTime: nowETTime(),
        },
      ]);
      setError(null);
    }

    function onError(msg: { message: string }) {
      setError(msg.message ?? "An error occurred.");
    }

    socket.on("chat:response", onResponse);
    socket.on("chat:error", onError);
    return () => {
      socket.off("chat:response", onResponse);
      socket.off("chat:error", onError);
    };
  }, [socket]);

  useEffect(() => {
    // On initial load: jump instantly; on new messages: smooth scroll
    const behavior = messages.length <= 3 ? "instant" : "smooth";
    bottomRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-3 py-2 rounded bg-red-900/50 border border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}

      {messages.length === 0 && !error && (
        <p className="text-gray-600 text-sm">No messages yet.</p>
      )}

      {messages.map((msg) => (
        <div key={msg.key} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-900 text-blue-300">
              {msg.source}
            </span>
            <span className="text-xs text-gray-400 ml-auto">{msg.displayTime}</span>
          </div>
          <div className="prose prose-invert max-w-none text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.response}</ReactMarkdown>
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
