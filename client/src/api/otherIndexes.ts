export async function saveOtherIndexes(data: {
  time?: string;
  vix?: number | null;
  add?: number | null;
  tick?: number | null;
}): Promise<{ time: string }> {
  const res = await fetch("/api/other_indexes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
