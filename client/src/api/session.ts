export async function restartSession(): Promise<void> {
  await fetch("/api/ai-session/restart", { method: "POST" });
}
