import { Router } from "express";
import { getAllKeywords, saveKeywords } from "../db/newsKeywordsRepository.js";

const router = Router();

router.get("/news/keywords", async (_req, res) => {
  try {
    const keywords = await getAllKeywords();
    res.json({ keywords });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /news/keywords] error:", message);
    res.status(500).json({ error: message });
  }
});

router.put("/news/keywords", async (req, res) => {
  const { keywords } = req.body ?? {};
  if (!Array.isArray(keywords) || keywords.some((k) => typeof k !== "string")) {
    res.status(400).json({ error: "keywords must be an array of strings" });
    return;
  }
  try {
    const trimmed = [...new Set(
      keywords.map((k: string) => k.trim().toLowerCase()).filter(Boolean)
    )];
    await saveKeywords(trimmed);
    res.json({ keywords: trimmed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PUT /news/keywords] error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
