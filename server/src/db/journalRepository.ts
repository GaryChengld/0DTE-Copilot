import prisma from "./client.js";

export interface JournalEntry {
  id: number;
  date: string; // "YYYY-MM-DD"
  journal: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Upsert: create if date is new, update if it already exists. */
export async function upsertJournal(date: string, journal: string): Promise<JournalEntry> {
  return prisma.journal.upsert({
    where: { date },
    create: { date, journal },
    update: { journal },
  });
}

/** Delete a journal entry by id. Returns null if not found. */
export async function deleteJournal(id: number): Promise<JournalEntry | null> {
  try {
    return await prisma.journal.delete({ where: { id } });
  } catch {
    return null;
  }
}

/** Retrieve a single journal entry by date ("YYYY-MM-DD"). Returns null if not found. */
export async function getJournalByDate(date: string): Promise<JournalEntry | null> {
  return prisma.journal.findUnique({ where: { date } });
}

/** List all journal dates for a given year + month. Returns dates only, sorted ascending. */
export async function listJournalDates(year: number, month: number): Promise<string[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const rows = await prisma.journal.findMany({
    where: { date: { startsWith: prefix } },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => r.date);
}
