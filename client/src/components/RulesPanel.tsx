import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Play } from "lucide-react";
import { listRules, evaluateRule, type RuleInfo, type EvaluationResult } from "../api/rules";

const STATUS_COLOR: Record<string, string> = {
  GO: "#4ade80",
  "NO-GO": "#f87171",
  WAIT: "#facc15",
  HALT: "#f97316",
};

export default function RulesPanel() {
  const [rules, setRules]       = useState<RuleInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<EvaluationResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    listRules()
      .then((r) => {
        setRules(r);
        if (r.length > 0) setSelected(r[0].id);
      })
      .catch(() => {});
  }, []);

  async function handleEvaluate() {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      setResult(await evaluateRule(selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded px-3 py-1.5 text-sm"
          style={{ background: "#1c2333", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          {rules.length === 0 ? (
            <option>Loading rules…</option>
          ) : (
            rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} v{r.version}
              </option>
            ))
          )}
        </select>
        <button
          onClick={handleEvaluate}
          disabled={loading || !selected}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "#1d4ed8", color: "white" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading ? "Evaluating…" : "Evaluate"}
        </button>
      </div>

      {/* Status badge */}
      {result && (
        <div
          className="shrink-0 rounded px-3 py-2 text-sm font-semibold"
          style={{ background: "#1c2333", color: STATUS_COLOR[result.result] ?? "white" }}
        >
          {result.result}
          {result.direction && ` — ${result.direction === "bear_call" ? "Bear Call" : "Bull Put"}`}
          {result.shortStrike != null && ` | Strike ${result.shortStrike}/${result.longStrike}`}
          {result.estimatedCredit != null && ` | Est. $${result.estimatedCredit.toFixed(2)}`}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm shrink-0" style={{ color: "#f87171" }}>
          Error: {error}
        </p>
      )}

      {/* Markdown result */}
      {result && (
        <div
          className="flex-1 overflow-y-auto rounded p-4"
          style={{ background: "#0d1117", border: "1px solid var(--border)" }}
        >
          <div className="prose prose-invert max-w-none text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Placeholder */}
      {!result && !loading && !error && (
        <div
          className="flex-1 flex items-center justify-center text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Select a rule and click Evaluate to run the signal check.
        </div>
      )}
    </div>
  );
}
