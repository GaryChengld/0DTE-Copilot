export async function getAnalysisPayload(userNotes?: string): Promise<unknown> {
  const res = await fetch("/api/ai/analyze/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userNotes ? { user_notes: userNotes } : {}),
  });
  return res.json();
}
