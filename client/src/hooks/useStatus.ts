import { useEffect, useState } from "react";

export interface StatusResponse {
  status: "ok" | "degraded";
  uptime: number;
  db: "ok" | "error";
  latencyMs: number;
  ai: {
    status: "uninitialized" | "ok" | "error";
    provider: string;
    lastMessageAt: string | null;
    lastError: string | null;
  };
}

export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    const poll = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus(null));

    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
