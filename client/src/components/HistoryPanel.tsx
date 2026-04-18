import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2 } from "lucide-react";
import SpxCandleChart from "./SpxCandleChart";
import HistoryCalendar from "./HistoryCalendar";
import JournalModal from "./JournalModal";
import { fetchSpxCandlesByDate, type SpxCandle } from "../api/spxCandles";
import {
  fetchJournalByDate,
  fetchJournalDates,
  fetchAiAdvicesByDate,
  upsertJournal,
  deleteJournal,
  type JournalEntry,
  type AiAdviceEntry,
} from "../api/journal";

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
      {/* Rendered markdown */}
      <div className="prose prose-invert max-w-none text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {ensureParagraphBreaks(journal.journal)}
        </ReactMarkdown>
      </div>

      {/* Updated timestamp */}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Updated {toETTime(journal.updatedAt)}
      </p>

      {/* Action row */}
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

// ── Main component ─────────────────────────────────────────────────────────

type RightTab = "advices" | "journal";

export default function HistoryPanel() {
  const today = todayET();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarYear, setCalendarYear] = useState(() => parseInt(today.slice(0, 4)));
  const [calendarMonth, setCalendarMonth] = useState(() => parseInt(today.slice(5, 7)));
  const [journalDates, setJournalDates] = useState<Set<string>>(new Set());
  const [candles, setCandles] = useState<SpxCandle[]>([]);
  const [advices, setAdvices] = useState<AiAdviceEntry[]>([]);
  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("advices");
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);

  // Fetch journal dates whenever the displayed month changes
  useEffect(() => {
    fetchJournalDates(calendarYear, calendarMonth)
      .then((dates) => setJournalDates(new Set(dates)))
      .catch(() => {});
  }, [calendarYear, calendarMonth]);

  // Fetch data for the selected date
  useEffect(() => {
    setDateLoading(true);
    setCandles([]);
    setAdvices([]);
    setJournal(null);
    setDeleteConfirm(false);

    Promise.all([
      fetchSpxCandlesByDate(selectedDate).catch(() => [] as SpxCandle[]),
      fetchAiAdvicesByDate(selectedDate).catch(() => [] as AiAdviceEntry[]),
      fetchJournalByDate(selectedDate).catch(() => null),
    ]).then(([c, a, j]) => {
      setCandles(c);
      setAdvices(a);
      setJournal(j);
      setDateLoading(false);
    });
  }, [selectedDate]);

  function handleMonthChange(year: number, month: number) {
    setCalendarYear(year);
    setCalendarMonth(month);
    // Move selectedDate to the first of the new month so the calendar stays in sync
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
    setJournalDates((prev) => new Set([...prev, selectedDate]));
    setJournalModalOpen(false);
  }

  async function handleDeleteJournal() {
    if (!journal) return;
    await deleteJournal(journal.id);
    setJournal(null);
    setJournalDates((prev) => {
      const s = new Set(prev);
      s.delete(selectedDate);
      return s;
    });
    setDeleteConfirm(false);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column (35%) ───────────────────────────── */}
      <div
        className="w-[25%] flex flex-col shrink-0 overflow-hidden border-r"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Calendar */}
        <div className="shrink-0 p-3">
          <HistoryCalendar
            selectedDate={selectedDate}
            journalDates={journalDates}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
          />
        </div>

        {/* SPX Chart — h-[45%] shrink-0 matches left panel proportions */}
        <div className="h-[45%] shrink-0 p-2">
          <div
            className="h-full rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <SpxCandleChart key={selectedDate} candles={candles} />
          </div>
        </div>
      </div>

      {/* ── Right column (65%) ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Right tab bar */}
        <div
          className="flex shrink-0 border-b px-3 pt-2 gap-1"
          style={{ borderColor: "var(--border)" }}
        >
          {(["advices", "journal"] as RightTab[]).map((tab) => (
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
              {tab === "advices" ? "AI Advice" : "Journal"}
            </button>
          ))}
          <span
            className="ml-auto self-center text-xs pb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {selectedDate}
          </span>
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-4">
          {rightTab === "advices" && (
            <AdvicesView advices={advices} loading={dateLoading} />
          )}
          {rightTab === "journal" && (
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
          )}
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
