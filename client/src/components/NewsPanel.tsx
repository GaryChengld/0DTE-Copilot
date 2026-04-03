import { RefreshCw, Loader2 } from "lucide-react";
import type { NewsItem } from "../api/news";

interface Props {
  news: NewsItem[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function NewsPanel({ news, loading, error, onRefresh }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Economic News
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Refresh news"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : (
            <RefreshCw size={14} style={{ color: "var(--text-muted)" }} />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="text-xs px-4 py-3" style={{ color: "#f85149" }}>
            {error}
          </p>
        )}

        {!error && news && news.length === 0 && (
          <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)" }}>
            No economic news found.
          </p>
        )}

        {!error && news && news.length > 0 && (
          <ul>
            {news.map((item, i) => (
              <li
                key={i}
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm leading-snug hover:underline"
                  style={{ color: "#58a6ff" }}
                >
                  {item.title}
                </a>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {item.source} · {item.publishedAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
