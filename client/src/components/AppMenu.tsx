import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { restartSession } from "../api/session";

interface AppMenuProps {
  onOpenMarketSummary: () => void;
}

export default function AppMenu({ onOpenMarketSummary }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleRestartClick() {
    setOpen(false);
    setConfirmOpen(true);
  }

  async function handleConfirmRestart() {
    setConfirmOpen(false);
    setRestarting(true);
    try {
      await restartSession();
    } finally {
      setRestarting(false);
    }
  }

  function handleMarketSummary() {
    setOpen(false);
    onOpenMarketSummary();
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-colors"
          aria-label="Menu"
        >
          <Menu size={16} />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-48 rounded shadow-lg z-50" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <button
              onClick={handleRestartClick}
              disabled={restarting}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {restarting ? "Restarting…" : "Restart AI Session"}
            </button>
            <button
              onClick={handleMarketSummary}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              Market Summary
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="rounded-lg p-6 w-80 shadow-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-100 text-sm font-medium mb-1">Restart AI Session</p>
            <p className="text-gray-400 text-sm mb-6">
              The current session will be summarised and a new session will start. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-1.5 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
              >
                No
              </button>
              <button
                onClick={handleConfirmRestart}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
