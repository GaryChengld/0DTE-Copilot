import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import SpxCandleChart from "./SpxCandleChart";
import BacktestPanel from "./BacktestPanel";
import HistoryCalendar from "./HistoryCalendar";
import JournalModal from "./JournalModal";
import { fetchSpxCandlesByDate, type SpxCandle } from "../api/spxCandles";
import {
  fetchJournalByDate,
  fetchAiAdvicesByDate,
  upsertJournal,
  deleteJournal,
  type JournalEntry,
  type AiAdviceEntry,
} from "../api/journal";
import { getReplayPayload } from "../api/replay";
import {
  getMonthlyPnl,
  getTradesByDate,
  type TradeWithExits,
} from "../api/trades";

// ── Helpers ────────────────────────────────────────────────────────────────

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function toETTime(iso: string): string {
  const d = new Date(iso.replace(/\+00:00$/, "Z"));
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

function ensureParagraphBreaks(text: string): string {
  return text.replace(/\n(\*\*[^*\n]+[：:]\*\*|\*\*[^*\n]+\*\*[：:])/g, "  \n$1");
}

function fmtPnl(pnl: number): string {
  return (pnl >= 0 ? "+" : "") + pnl.toFixed(2);
}

// ── Sub-component: MonthlyPnlPanel ────────────────────────────────────────

function MonthlyPnlPanel({ total }: { total: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        Monthly P&L
      </span>
      <span
        className="text-base font-semibold"
        style={{ color: total === null ? "var(--text-muted)" : total >= 0 ? "#4ade80" : "#f87171" }}
      >
        {total === null ? "—" : fmtPnl(total)}
      </span>
    </div>
  );
}

// ── Sub-component: DailyTradesPanel ───────────────────────────────────────

function DailyTradesPanel({ trades, loading }: { trades: TradeWithExits[]; loading: boolean }) {
  if (loading) {
    return (
      <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }
  if (trades.length === 0) {
    return (
      <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
        No trades on this date.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {trades.map((trade) => {
        const totalPnl = trade.exits.reduce((sum, e) => sum + (e.pnl ?? 0), 0);
        const hasPnl = trade.exits.some((e) => e.pnl != null);
        return (
          <div
            key={trade.id}
            className="rounded-lg px-3 py-2 flex flex-col gap-1"
            style={{ background: "#1c2333" }}
          >
            {/* Trade header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                {trade.symbol} {trade.optionType ?? ""} {trade.strike ?? ""} ×{trade.quantityInitial}
                <span
                  className="ml-1.5 text-xs font-normal"
                  style={{ color: trade.spreadType === "CREDIT" ? "#60a5fa" : "#f9a825" }}
                >
                  {trade.spreadType}
                </span>
              </span>
              {hasPnl && (
                <span
                  className="text-xs font-semibold"
                  style={{ color: totalPnl >= 0 ? "#4ade80" : "#f87171" }}
                >
                  {fmtPnl(totalPnl)}
                </span>
              )}
            </div>
            {/* Entry info */}
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Entry {trade.entryPrice != null ? `$${trade.entryPrice.toFixed(2)}` : "—"}
              {trade.entryTime ? ` @ ${trade.entryTime.slice(11, 16)}` : ""}
              {" · "}
              <span style={{ color: trade.status === "CLOSED" ? "var(--text-muted)" : "#60a5fa" }}>
                {trade.status.toLowerCase().replace("_", " ")}
              </span>
            </div>
            {/* Exits */}
            {trade.exits.length > 0 && (
              <div
                className="flex flex-col gap-0.5 pt-1 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                {trade.exits.map((exit) => (
                  <div
                    key={exit.id}
                    className="flex items-center justify-between text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>
                      ×{exit.exitQuantity} @ ${exit.exitPrice.toFixed(2)} · {exit.exitReason}
                      {exit.exitTime ? ` · ${exit.exitTime.slice(11, 16)}` : ""}
                    </span>
                    {exit.pnl != null && (
                      <span style={{ color: exit.pnl >= 0 ? "#4ade80" : "#f87171" }}>
                        {fmtPnl(exit.pnl)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-component: AdvicesView ─────────────────────────────────────────────

function AdvicesView({ advices, loading }: { advices: AiAdviceEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }
  if (advices.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
        No AI advice recorded for this date.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {advices.map((adv, idx) => (
        <div key={adv.id}>
          <div
            className="flex flex-col gap-2 rounded-lg py-3 px-4"
            style={{ background: "var(--bg-card)", borderLeft: "3px solid #58a6ff" }}
          >
            <div className="prose prose-invert max-w-none text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {ensureParagraphBreaks(adv.response)}
              </ReactMarkdown>
            </div>
            <span className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
              {toETTime(adv.timestamp)}
            </span>
          </div>
          {idx < advices.length - 1 && (
            <div className="border-t mt-4" style={{ borderColor: "var(--border)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sub-component: JournalView ─────────────────────────────────────────────

interface JournalViewProps {
  journal: JournalEntry | null;
  loading: boolean;
  deleteConfirm: boolean;
  onNew: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

function JournalView({
  journal,
  loading,
  deleteConfirm,
  onNew,
  onEdit,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: JournalViewProps) {
  if (loading) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }

  if (!journal) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No journal entry for this date.
        </p>
        <button
          onClick={onNew}
          className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          New Journal
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="prose prose-invert max-w-none text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {ensureParagraphBreaks(journal.journal)}
        </ReactMarkdown>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Updated {toETTime(journal.updatedAt)}
      </p>

      <div
        className="flex items-center gap-3 pt-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <Pencil size={13} /> Edit
        </button>

        {deleteConfirm ? (
          <div className="flex items-center gap-2 ml-auto text-sm">
            <span style={{ color: "var(--text-muted)" }}>Are you sure?</span>
            <button
              onClick={onDeleteConfirm}
              className="px-3 py-1 rounded bg-red-700 text-white hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onDeleteCancel}
              className="px-3 py-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onDeleteRequest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-white/10 transition-colors ml-auto"
            style={{ color: "#f85149" }}
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: ReplayView ──────────────────────────────────────────────

function ReplayView({ date, active }: { date: string; active: boolean }) {
  const [payload, setPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    if (lastFetchedRef.current === date) return;
    lastFetchedRef.current = date;
    setLoading(true);
    setPayload(null);
    setError(null);
    getReplayPayload(date)
      .then((data) => setPayload(JSON.stringify(data, null, 2)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load replay payload."))
      .finally(() => setLoading(false));
  }, [active, date]);

  async function handleCopy() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!active && !payload && !loading) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
        Select the Replay tab to generate the prompt.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm py-8" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={14} className="animate-spin" />
        Loading replay payload…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm py-8" style={{ color: "#f87171" }}>{error}</p>;
  }

  if (payload) {
    return (
      <div className="relative flex-1 min-h-0 h-full">
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
          style={{ background: "#1c2333", color: "var(--text-muted)" }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="h-full overflow-auto rounded p-4 pt-8 text-xs font-mono whitespace-pre" style={{ background: "#0d1117", border: "1px solid var(--border)", color: "#c9d1d9" }}>
          {payload}
        </pre>
      </div>
    );
  }

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────

type RightTab = "advices" | "journal" | "replay" | "backtest";

export default function HistoryPanel({ visible }: { visible: boolean }) {
  const today = todayET();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarYear, setCalendarYear] = useState(() => parseInt(today.slice(0, 4)));
  const [calendarMonth, setCalendarMonth] = useState(() => parseInt(today.slice(5, 7)));
  const [pnlByDate, setPnlByDate] = useState<Map<string, number>>(new Map());
  const [monthlyTotal, setMonthlyTotal] = useState<number | null>(null);
  const [candles, setCandles] = useState<SpxCandle[]>([]);
  const [advices, setAdvices] = useState<AiAdviceEntry[]>([]);
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [trades, setTrades] = useState<TradeWithExits[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("advices");
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);
  const prevVisibleRef = useRef(false);

  // Re-fetch all data when switching from Trading → Review mode so stale P&L and
  // trade data from activity in Trading mode are immediately reflected.
  useEffect(() => {
    if (!visible || prevVisibleRef.current) {
      prevVisibleRef.current = visible;
      return;
    }
    prevVisibleRef.current = true;

    getMonthlyPnl(calendarYear, calendarMonth)
      .then((entries) => {
        const map = new Map(entries.map((e) => [e.date, e.pnl]));
        setPnlByDate(map);
        setMonthlyTotal(entries.length > 0 ? entries.reduce((s, e) => s + e.pnl, 0) : null);
      })
      .catch(() => {});

    setDateLoading(true);
    setCandles([]);
    setAdvices([]);
    setJournal(null);
    setTrades([]);
    Promise.all([
      fetchSpxCandlesByDate(selectedDate).catch(() => [] as SpxCandle[]),
      fetchAiAdvicesByDate(selectedDate).catch(() => [] as AiAdviceEntry[]),
      fetchJournalByDate(selectedDate).catch(() => null),
      getTradesByDate(selectedDate).catch(() => [] as TradeWithExits[]),
    ]).then(([c, a, j, t]) => {
      setCandles(c);
      setAdvices(a);
      setJournal(j);
      setTrades(t);
      setDateLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Fetch monthly P&L whenever the displayed month changes
  useEffect(() => {
    getMonthlyPnl(calendarYear, calendarMonth)
      .then((entries) => {
        const map = new Map(entries.map((e) => [e.date, e.pnl]));
        setPnlByDate(map);
        setMonthlyTotal(entries.length > 0 ? entries.reduce((s, e) => s + e.pnl, 0) : null);
      })
      .catch(() => {});
  }, [calendarYear, calendarMonth]);

  // Fetch data for the selected date
  useEffect(() => {
    setDateLoading(true);
    setCandles([]);
    setAdvices([]);
    setJournal(null);
    setTrades([]);
    setDeleteConfirm(false);

    Promise.all([
      fetchSpxCandlesByDate(selectedDate).catch(() => [] as SpxCandle[]),
      fetchAiAdvicesByDate(selectedDate).catch(() => [] as AiAdviceEntry[]),
      fetchJournalByDate(selectedDate).catch(() => null),
      getTradesByDate(selectedDate).catch(() => [] as TradeWithExits[]),
    ]).then(([c, a, j, t]) => {
      setCandles(c);
      setAdvices(a);
      setJournal(j);
      setTrades(t);
      setDateLoading(false);
    });
  }, [selectedDate]);

  function handleMonthChange(year: number, month: number) {
    setCalendarYear(year);
    setCalendarMonth(month);
    const newSelected = `${year}-${String(month).padStart(2, "0")}-01`;
    setSelectedDate(newSelected);
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setDeleteConfirm(false);
  }

  async function handleSaveJournal(content: string) {
    const entry = await upsertJournal(selectedDate, content);
    setJournal(entry);
    setJournalModalOpen(false);
  }

  async function handleDeleteJournal() {
    if (!journal) return;
    await deleteJournal(journal.id);
    setJournal(null);
    setDeleteConfirm(false);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column (25%) ───────────────────────────── */}
      <div
        className="w-[25%] flex flex-col shrink-0 overflow-hidden border-r"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Monthly PNL summary */}
        <div className="shrink-0 px-4 py-3 rounded-lg mx-2 mt-2" style={{ background: "#1c2333" }}>
          <MonthlyPnlPanel total={monthlyTotal} />
        </div>

        {/* Calendar */}
        <div className="shrink-0 p-3 rounded-lg m-2" style={{ background: "#1c2333" }}>
          <HistoryCalendar
            selectedDate={selectedDate}
            pnlByDate={pnlByDate}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* SPX Chart */}
        <div className="h-[40%] shrink-0 p-2">
          <div
            className="h-full rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <SpxCandleChart key={selectedDate} candles={candles} />
          </div>
        </div>

        {/* Daily trade details */}
        <div className="flex-1 overflow-y-auto p-2">
          <p className="text-xs font-medium mb-1 px-1" style={{ color: "var(--text-muted)" }}>
            Trades
          </p>
          <DailyTradesPanel trades={trades} loading={dateLoading} />
        </div>
      </div>

      {/* ── Right column (75%) ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Right tab bar */}
        <div
          className="flex shrink-0 border-b px-3 pt-2 gap-1"
          style={{ borderColor: "var(--border)" }}
        >
          {(["advices", "journal", "replay", "backtest"] as RightTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`px-3 py-1.5 text-sm border-b-2 transition-colors ${
                rightTab === tab
                  ? "border-blue-500 text-white"
                  : "border-transparent hover:text-white"
              }`}
              style={{ color: rightTab === tab ? undefined : "var(--text-muted)" }}
            >
              {tab === "advices" ? "AI Advice"
                : tab === "journal" ? "Journal"
                : tab === "replay" ? "Replay"
                : "Backtest"}
            </button>
          ))}
          <span
            className="ml-auto self-center text-xs pb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {selectedDate}
          </span>
        </div>

        {/* Right content — each tab gets its own scroll container so positions are independent */}
        <div className="flex-1 overflow-y-auto p-4" style={{ display: rightTab === "advices" ? undefined : "none" }}>
          <AdvicesView advices={advices} loading={dateLoading} />
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ display: rightTab === "journal" ? undefined : "none" }}>
          <JournalView
            journal={journal}
            loading={dateLoading}
            deleteConfirm={deleteConfirm}
            onNew={() => setJournalModalOpen(true)}
            onEdit={() => setJournalModalOpen(true)}
            onDeleteRequest={() => setDeleteConfirm(true)}
            onDeleteCancel={() => setDeleteConfirm(false)}
            onDeleteConfirm={handleDeleteJournal}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col" style={{ display: rightTab === "replay" ? undefined : "none" }}>
          <ReplayView date={selectedDate} active={rightTab === "replay"} />
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col" style={{ display: rightTab === "backtest" ? undefined : "none" }}>
          <BacktestPanel date={selectedDate} active={rightTab === "backtest"} />
        </div>
      </div>

      {journalModalOpen && (
        <JournalModal
          date={selectedDate}
          initialContent={journal?.journal ?? ""}
          onSave={handleSaveJournal}
          onClose={() => setJournalModalOpen(false)}
        />
      )}
    </div>
  );
}
