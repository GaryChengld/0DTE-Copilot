export interface JournalEntry {
  id: number;
  date: string;       // "YYYY-MM-DD"
  journal: string;    // markdown
  createdAt: string;
  updatedAt: string;
}

export interface AiAdviceEntry {
  id: number;
  timestamp: string;
  source: string;
  prompt: string | null;
  response: string;
  provider: string;
}

export async function fetchJournalByDate(date: string): Promise<JournalEntry | null> {
  const res = await fetch(`/api/journal?date=${date}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`journal: ${res.status}`);
  const data = await res.json();
  return data.journal;
}

export async function upsertJournal(date: string, journal: string): Promise<JournalEntry> {
  const res = await fetch("/api/journal", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, journal }),
  });
  if (!res.ok) throw new Error(`journal upsert: ${res.status}`);
  const data = await res.json();
  return data.journal;
}

export async function deleteJournal(id: number): Promise<void> {
  const res = await fetch(`/api/journal/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`journal delete: ${res.status}`);
}

export async function fetchJournalDates(year: number, month: number): Promise<string[]> {
  const res = await fetch(`/api/journal/months?year=${year}&month=${month}`);
  if (!res.ok) throw new Error(`journal/months: ${res.status}`);
  const data = await res.json();
  return data.dates;
}

export async function fetchAiAdvicesByDate(date: string): Promise<AiAdviceEntry[]> {
  const res = await fetch(`/api/ai-advices?date=${date}`);
  if (!res.ok) throw new Error(`ai-advices: ${res.status}`);
  return res.json();
}
