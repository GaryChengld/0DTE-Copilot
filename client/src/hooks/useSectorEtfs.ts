import { useEffect, useState } from "react";
import { fetchSectorEtfs, type SectorEtf } from "../api/sectorEtfs";

export function useSectorEtfs() {
  const [etfs, setEtfs] = useState<SectorEtf[]>([]);

  useEffect(() => {
    const poll = () =>
      fetchSectorEtfs()
        .then(setEtfs)
        .catch(() => {});

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return etfs;
}
