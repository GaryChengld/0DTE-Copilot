import { Router } from "express";
import {
  upsertJournal,
  deleteJournal,
  getJournalByDate,
  listJournalDates,
} from "../db/journalRepository.js";

const router = Router();

/**
 * PUT /api/journal
 * Body: { date: "YYYY-MM-DD", journal: string }
 * Creates or updates the entry for that date.
 */
router.put("/journal", async (req, res) => {
  const { date, journal } = req.body as { date?: string; journal?: string };
  if (!date || !journal) {
    res.status(400).json({ error: "date and journal are required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    return;
  }
  try {
    const entry = await upsertJournal(date, journal);
    res.json({ journal: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PUT /journal] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/journal/:id
 * Deletes the journal entry with the given id.
 */
router.delete("/journal/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "id must be a number" });
    return;
  }
  try {
    const deleted = await deleteJournal(id);
    if (!deleted) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
    res.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /journal/:id] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/journal/months?year=2026&month=4
 * Lists all dates that have a journal entry in the given year+month.
 * Must be declared before GET /journal to avoid Express matching "months" as a date param.
 */
router.get("/journal/months", async (req, res) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "year and month (1–12) query parameters are required" });
    return;
  }
  try {
    const dates = await listJournalDates(year, month);
    res.json({ dates });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /journal/months] error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/journal?date=YYYY-MM-DD
 * Retrieves the journal entry for the given date.
 */
router.get("/journal", async (req, res) => {
  const { date } = req.query as { date?: string };
  if (!date) {
    res.status(400).json({ error: "date query parameter is required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    return;
  }
  try {
    const entry = await getJournalByDate(date);
    if (!entry) {
      res.status(404).json({ error: "No journal entry found for this date" });
      return;
    }
    res.json({ journal: entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /journal] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
