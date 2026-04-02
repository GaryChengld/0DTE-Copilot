export async function saveMarketSummary(content: string): Promise<void> {
  let parsed: unknown;
  try {
    const normalized = content.replace(/(\d)_(\d)/g, "$1$2");
    parsed = JSON.parse(normalized);
  } catch {
    parsed = content;
  }
  await fetch("/api/market-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: parsed }),
  });
}
