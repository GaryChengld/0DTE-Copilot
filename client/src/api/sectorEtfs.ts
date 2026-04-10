export interface SectorEtf {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export async function fetchSectorEtfs(): Promise<SectorEtf[]> {
  const res = await fetch("/api/etf/sectors");
  if (!res.ok) throw new Error(`etf/sectors: ${res.status}`);
  const data = await res.json();
  return data.etfs;
}
