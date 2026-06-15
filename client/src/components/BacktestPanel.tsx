import { useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listRules, type RuleInfo } from "../api/rules";
import {
  runBacktest,
  type BacktestResponse,
  type BacktestBarRow,
  type BacktestTrade,
} from "../api/backtest";

// ── Colour helpers ────────────────────────────────────────────────────────────

const DECISION_COLOR: Record<string, string> = {
  GO:      "#4ade80",
  "NO-GO": "#f87171",
  WAIT:    "#facc15",
  HALT:    "#6b7280",
};

const EXIT_COLOR: Record<string, string> = {
  TP1: "#4ade80", TP2: "#4ade80",
  SL1: "#f87171", SL2: "#f87171",
  FORCED: "#facc15",
};

// ── Notes helper ─────────────────────────────────────────────────────────────

function noteText(bar: BacktestBarRow): string {
  const t = bar.trade
  if (!t) return ""
  const dir   = bar.direction === "bear_call" ? "Bear Call" : "Bull Put"
  const entry = `${dir} ${t.shortStrike}/${t.longStrike} @ $${t.entryCredit.toFixed(2)}`
  if (!t.exitReason) return entry
  const pnlStr = t.pnl != null ? ` (${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)})` : ""
  return `${entry} → ${t.exitReason} $${t.exitPrice?.toFixed(2)}${pnlStr}`
}

// ── Left: Bar grid ────────────────────────────────────────────────────────────

function BarTable({
  bars,
  selectedIdx,
  onSelect,
}: {
  bars: BacktestBarRow[]
  selectedIdx: number | null
  onSelect: (i: number) => void
}) {
  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-2 py-1 text-left w-14">Time</th>
            <th className="px-2 py-1 text-left">Result</th>
            <th className="px-2 py-1 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, i) => {
            const isSelected = selectedIdx === i
            const rowBg = isSelected
              ? "#1e3a5f"
              : bar.decision === "GO" && bar.trade ? "#0d2b1a"
              : undefined
            const decColor = DECISION_COLOR[bar.decision] ?? "var(--text-muted)"

            return (
              <tr
                key={i}
                onClick={() => onSelect(i)}
                style={{
                  background: rowBg,
                  borderTop: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <td className="px-2 py-0.5 font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                  {bar.time}
                </td>
                <td className="px-2 py-0.5" style={{ color: decColor }}>
                  {bar.summary}
                </td>
                <td className="px-2 py-0.5" style={{ color: "var(--text-muted)" }}>
                  {noteText(bar)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Right: Bar detail panel ───────────────────────────────────────────────────

function TradeInfo({ bar }: { bar: BacktestBarRow }) {
  const t = bar.trade
  if (!t) return null
  const dir = bar.direction === "bear_call" ? "Bear Call" : "Bull Put"
  return (
    <div className="rounded p-2 text-xs mb-3" style={{ background: "#1c2333" }}>
      <div style={{ color: "#4ade80" }}>
        {dir} {t.shortStrike}/{t.longStrike} @ ${t.entryCredit.toFixed(2)}
      </div>
      {t.exitReason ? (
        <div style={{ color: EXIT_COLOR[t.exitReason] ?? "white" }}>
          Exit {t.exitReason} @ ${t.exitPrice?.toFixed(2)}
          {t.pnl != null && ` · PnL: ${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`}
          {t.exitTime && ` · at ${t.exitTime}`}
        </div>
      ) : (
        <div style={{ color: "var(--text-muted)" }}>No exit found within scan window</div>
      )}
    </div>
  )
}

function BarDetail({ bar }: { bar: BacktestBarRow | null }) {
  if (!bar) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
        Click a bar to see details.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto rounded p-4" style={{ background: "#0d1117", border: "1px solid var(--border)" }}>
      <TradeInfo bar={bar} />
      {bar.markdown ? (
        <div className="prose prose-invert max-w-none text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bar.markdown}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No evaluation detail for this bar.
        </p>
      )}
    </div>
  )
}

// ── Trade summary ─────────────────────────────────────────────────────────────

function TradeSummary({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        No trades executed this day.
      </p>
    )
  }
  const wins   = trades.filter(t => (t.pnl ?? 0) >= 0).length
  const losses = trades.filter(t => (t.pnl ?? 0) <  0).length
  return (
    <div className="mt-5">
      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
        Trade Summary
      </p>
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Entry</th>
            <th className="px-2 py-1 text-right">Credit</th>
            <th className="px-2 py-1 text-left">Exit</th>
            <th className="px-2 py-1 text-right">Price</th>
            <th className="px-2 py-1 text-left">Reason</th>
            <th className="px-2 py-1 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const pnl = t.pnl ?? 0
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-0.5">
                  {t.direction === "bear_call" ? "Bear Call" : "Bull Put"}
                </td>
                <td className="px-2 py-0.5 font-mono">{t.entryTime}</td>
                <td className="px-2 py-0.5 text-right">${t.entryCredit.toFixed(2)}</td>
                <td className="px-2 py-0.5 font-mono">{t.exitTime ?? "—"}</td>
                <td className="px-2 py-0.5 text-right">${(t.exitPrice ?? 0).toFixed(2)}</td>
                <td className="px-2 py-0.5" style={{ color: "var(--text-muted)" }}>
                  {t.exitReason}
                </td>
                <td
                  className="px-2 py-0.5 text-right font-semibold"
                  style={{ color: pnl >= 0 ? "#4ade80" : "#f87171" }}
                >
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex justify-end gap-4 text-sm font-semibold mt-2">
        <span style={{ color: "#4ade80" }}>W: {wins}</span>
        <span style={{ color: "#f87171" }}>L: {losses}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BacktestPanel({ date, active }: { date: string; active: boolean }) {
  const [rules, setRules]           = useState<RuleInfo[]>([])
  const [selected, setSelected]     = useState("")
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<BacktestResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const lastDateRef                 = useRef<string | null>(null)

  useEffect(() => {
    listRules()
      .then(r => { setRules(r); if (r.length > 0) setSelected(r[0].id) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (lastDateRef.current !== date) {
      lastDateRef.current = date
      setResult(null)
      setError(null)
      setSelectedIdx(null)
    }
  }, [date])

  async function handleRun() {
    if (!selected || !date) return
    setLoading(true); setResult(null); setError(null); setSelectedIdx(null)
    try {
      setResult(await runBacktest(selected, date))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed")
    } finally {
      setLoading(false)
    }
  }

  if (!active && !result && !loading) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
        Select the Backtest tab to run a simulation.
      </p>
    )
  }

  const selectedBar = result && selectedIdx !== null ? result.bars[selectedIdx] : null

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 rounded px-2 py-1 text-xs"
          style={{ background: "#1c2333", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          {rules.length === 0
            ? <option>Loading…</option>
            : rules.map(r => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
        </select>
        <button
          onClick={handleRun}
          disabled={loading || !selected}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: "#1d4ed8", color: "white" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? "Running…" : "Backtest"}
        </button>
      </div>

      {error && (
        <p className="text-xs shrink-0" style={{ color: "#f87171" }}>Error: {error}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs py-4" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={12} className="animate-spin" />
          Running bar-by-bar simulation…
        </div>
      )}

      {result && (
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Left: bar grid + trade summary */}
          <div
            className="flex flex-col overflow-y-auto shrink-0"
            style={{ width: "55%", borderRight: "1px solid var(--border)" }}
          >
            <BarTable
              bars={result.bars}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
            />
            <TradeSummary trades={result.trades} />
          </div>

          {/* Right: detail panel */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ borderLeft: "none" }}>
            <BarDetail bar={selectedBar} />
          </div>
        </div>
      )}
    </div>
  )
}
