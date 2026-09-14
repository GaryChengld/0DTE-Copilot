export async function getReplayPayload(date: string): Promise<unknown> {
  const res = await fetch(`/api/ai/replay/message?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ReplayExportResult {
  dir: string;           // server-side output folder (REPLAY_EXPORT_DIR)
  writtenCount: number;
  skippedCount: number;  // files that already existed — never overwritten
  written: string[];     // YYYY-MM-DD
  skipped: string[];
}

/** Export every cached replay day to the server's export folder; existing files are skipped. */
export async function exportAllReplays(): Promise<ReplayExportResult> {
  const res = await fetch("/api/replay/export", { method: "POST" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Export failed (HTTP ${res.status})`);
  return body as ReplayExportResult;
}
