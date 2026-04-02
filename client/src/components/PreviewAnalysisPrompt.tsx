import { useState, useEffect } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { getAnalysisPayload } from "../api/analysis";

export interface PreviewTrigger {
  userNotes: string;
  id: number;
}

interface PreviewAnalysisPromptProps {
  trigger: PreviewTrigger | null;
}

export default function PreviewAnalysisPrompt({ trigger }: PreviewAnalysisPromptProps) {
  const [payload, setPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trigger) return;
    setLoading(true);
    setError(null);
    getAnalysisPayload(trigger.userNotes || undefined)
      .then((data) => setPayload(JSON.stringify(data, null, 2)))
      .catch(() => setError("Failed to fetch analysis prompt."))
      .finally(() => setLoading(false));
  }, [trigger]);

  async function handleCopy() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Loading analysis prompt…
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {payload ? (
        <div className="relative flex-1 min-h-0">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 transition-colors flex items-center gap-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <pre className="h-full overflow-auto rounded bg-gray-900 border border-gray-700 p-4 pt-8 text-xs text-gray-300 font-mono whitespace-pre">
            {payload}
          </pre>
        </div>
      ) : (
        !loading && (
          <p className="text-gray-600 text-sm">Use the input below to preview the analysis prompt.</p>
        )
      )}
    </div>
  );
}
