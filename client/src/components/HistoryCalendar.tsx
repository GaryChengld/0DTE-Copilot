import { ChevronLeft, ChevronRight } from "lucide-react";

interface HistoryCalendarProps {
  selectedDate: string;       // "YYYY-MM-DD"
  journalDates: Set<string>;  // dates with a journal entry
  onSelectDate: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export default function HistoryCalendar({
  selectedDate,
  journalDates,
  onSelectDate,
  onMonthChange,
}: HistoryCalendarProps) {
  // Displayed year/month driven by selectedDate (parent controls navigation via onMonthChange)
  const displayYear = parseInt(selectedDate.slice(0, 4));
  const displayMonth = parseInt(selectedDate.slice(5, 7));

  const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();
  const startWeekday = new Date(displayYear, displayMonth - 1, 1).getDay(); // 0=Sun

  const today = todayET();

  function prevMonth() {
    let y = displayYear;
    let m = displayMonth - 1;
    if (m < 1) { m = 12; y--; }
    onMonthChange(y, m);
  }

  function nextMonth() {
    let y = displayYear;
    let m = displayMonth + 1;
    if (m > 12) { m = 1; y++; }
    onMonthChange(y, m);
  }

  // Build grid cells: leading empty slots + days of month
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-white">
          {MONTH_NAMES[displayMonth - 1]} {displayYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs py-0.5" style={{ color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} />;
          }

          const dateStr = toDateStr(displayYear, displayMonth, day);
          const isSelected = dateStr === selectedDate;
          const hasJournal = journalDates.has(dateStr);
          const isToday = dateStr === today;

          // Journal status (green) is always visible; selection adds a blue ring on top.
          const bgClass = hasJournal
            ? "bg-green-800 text-green-100"
            : isSelected
            ? "bg-blue-600 text-white"
            : "";

          const ringClass = isSelected
            ? "ring-2 ring-blue-400"
            : isToday
            ? "ring-1 ring-white/30"
            : "";

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className="text-xs py-1 text-center transition-colors hover:bg-white/10 flex items-center justify-center"
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full ${bgClass} ${ringClass}`}
                style={!bgClass ? { color: "var(--text-muted)" } : undefined}
              >
                {day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
