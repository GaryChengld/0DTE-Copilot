import { useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { listRules, type RuleInfo } from "../api/rules";
import {
  runBacktest,
  type BacktestResponse,
  type BacktestBarRow,
  type BacktestTrade,
  type VoterDetail,
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
  if (bar.isEntry && bar.shortStrike != null)
    return `${bar.direction === "bear_call" ? "Bear Call" : "Bull Put"} ${bar.shortStrike}/${bar.longStrike} @ $${bar.entryCredit?.toFixed(2)}`
  if (bar.isExit && bar.currentPrice != null)
    return `$${bar.currentPrice.toFixed(2)}`
  if (bar.hasPosition && bar.currentPrice != null)
    return `Holding · $${bar.currentPrice.toFixed(2)}`
  return ""
}

// ── Voter columns ─────────────────────────────────────────────────────────────

function V({ v }: { v: boolean }) {
  return <span style={{ color: v ? "#4ade80" : "#4b5563" }}>{v ? "✓" : "✗"}</span>
}

function VoterCells({ vd }: { vd: VoterDetail }) {
  const tip = (r: { pass: boolean; details: string[] }) =>
    r.details.join('\n').replace(/[✅❌]/g, '').trim()
  return (
    <>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bullPut.t)}><V v={vd.bullPut.t.pass}  /></td>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bullPut.o)}><V v={vd.bullPut.o.pass}  /></td>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bullPut.b)}><V v={vd.bullPut.b.pass}  /></td>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bearCall.t)}><V v={vd.bearCall.t.pass} /></td>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bearCall.o)}><V v={vd.bearCall.o.pass} /></td>
      <td className="px-1 py-0.5 text-center" title={tip(vd.bearCall.b)}><V v={vd.bearCall.b.pass} /></td>
    </>
  )
}

function EmptyVoterCells() {
  return <td colSpan={6} className="px-2 py-0.5 text-center" style={{ color: "#4b5563" }}>—</td>
}

// ── Bar table ─────────────────────────────────────────────────────────────────

function BarTable({ bars }: { bars: BacktestBarRow[] }) {
  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-2 py-1 text-left" rowSpan={2}>Time</th>
            <th className="px-1 py-1 text-center" colSpan={3}>Bull Put</th>
            <th className="px-1 py-1 text-center" colSpan={3}>Bear Call</th>
            <th className="px-2 py-1 text-left"   rowSpan={2}>Result</th>
            <th className="px-2 py-1 text-left"   rowSpan={2}>Notes</th>
          </tr>
          <tr style={{ background: "#1c2333", color: "var(--text-muted)" }}>
            <th className="px-1 py-0.5 text-center">T</th>
            <th className="px-1 py-0.5 text-center">O</th>
            <th className="px-1 py-0.5 text-center">B</th>
            <th className="px-1 py-0.5 text-center">T</th>
            <th className="px-1 py-0.5 text-center">O</th>
            <th className="px-1 py-0.5 text-center">B</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, i) => {
            const rowBg    = bar.isEntry ? "#0d2b1a" : bar.isExit ? "#2b0d0d" : undefined
            const decColor = bar.isExit
              ? (EXIT_COLOR[bar.exitReason ?? ""] ?? "white")
              : DECISION_COLOR[bar.decision] ?? "var(--text-muted)"
            const showVoters = !bar.hasPosition && bar.voterDetail

            return (
              <tr key={i} style={{ background: rowBg, borderTop: "1px solid var(--border)" }}>
                <td className="px-2 py-0.5 font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                  {bar.time}
                </td>
                {showVoters ? <VoterCells vd={bar.voterDetail!} /> : <EmptyVoterCells />}
                <td className="px-2 py-0.5" style={{ color: decColor }}>
                  {bar.isExit ? bar.exitReason : bar.decision}
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

// ── Trade summary ─────────────────────────────────────────────────────────────

function TradeSummary({ trades, totalPnl }: { trades: BacktestTrade[]; totalPnl: number }) {
  if (trades.length === 0) {
    return (
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        No trades executed this day.
      </p>
    )
  }
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
      <p
        className="text-sm font-semibold text-right mt-2"
        style={{ color: totalPnl >= 0 ? "#4ade80" : "#f87171" }}
      >
        Total PnL: {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BacktestPanel({ date, active }: { date: string; active: boolean }) {
  const [rules, setRules]       = useState<RuleInfo[]>([])
  const [selected, setSelected] = useState("")
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<BacktestResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const lastDateRef             = useRef<string | null>(null)

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
    }
  }, [date])

  async function handleRun() {
    if (!selected || !date) return
    setLoading(true); setResult(null); setError(null)
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

  return (
    <div className="flex flex-col h-full gap-3 p-3">
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
        <div className="flex-1 overflow-y-auto">
          <BarTable bars={result.bars} />
          <TradeSummary trades={result.trades} totalPnl={result.totalPnl} />
        </div>
      )}
    </div>
  )
}
