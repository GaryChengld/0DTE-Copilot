import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const STRATEGIC_PROMPT = readFileSync(
  join(__dirname, "strategicPrompt.md"),
  "utf-8"
);
