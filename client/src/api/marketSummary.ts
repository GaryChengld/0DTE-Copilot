export async function saveMarketSummary(content: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = content;
  }
  await fetch("/api/market-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: parsed }),
  });
}
