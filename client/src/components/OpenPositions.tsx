import { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useTrades } from "../hooks/useTrades";
import { exitTrade, deleteTrade, type Trade } from "../api/trades";
import TradeEntryForm from "./TradeEntryForm";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.replace(/\+00:00$/, "Z")).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface ExitFormState {
  exitQuantity: string;
  exitPrice: string;
  exitReason: string;
  submitting: boolean;
  error: string | null;
}

function TradeRow({ trade, onReload }: { trade: Trade; onReload: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exitForm, setExitForm] = useState<ExitFormState>({
    exitQuantity: "",
    exitPrice: "",
    exitReason: "Take Profit",
    submitting: false,
    error: null,
  });

  async function handleExit() {
    if (!exitForm.exitQuantity) {
      setExitForm((f) => ({ ...f, error: "Quantity is required." }));
      return;
    }
    setExitForm((f) => ({ ...f, submitting: true, error: null }));
    try {
      await exitTrade({
        tradeId: trade.id,
        exitQuantity: parseInt(exitForm.exitQuantity, 10),
        exitPrice: exitForm.exitPrice ? parseFloat(exitForm.exitPrice) : undefined,
        exitReason: exitForm.exitReason || undefined,
      });
      setShowExitForm(false);
      setExitForm({ exitQuantity: "", exitPrice: "", exitReason: "Take Profit", submitting: false, error: null });
      onReload();
    } catch {
      setExitForm((f) => ({ ...f, submitting: false, error: "Failed to submit exit." }));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTrade(trade.id);
      onReload();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const inputClass =
    "bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gray-500";

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800 transition-colors"
        onClick={() => { setExpanded((v) => !v); setShowExitForm(false); setConfirmDelete(false); }}
      >
        <span className="text-gray-500 shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="text-xs font-mono text-gray-100 font-semibold">{trade.symbol}</span>
        <span className="text-xs text-gray-400 capitalize">
          {[trade.spreadType, trade.optionType, trade.tradeType === "SPREAD" ? "Spread" : null]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {trade.strike && <span className="text-xs text-gray-500">{trade.strike}</span>}
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {trade.quantityRemaining}/{trade.quantity} · {trade.entryPrice ?? "—"}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-700 px-3 py-2 flex flex-col gap-2 bg-gray-900">
          {/* Meta */}
          <div className="flex gap-3 text-xs text-gray-500">
            <span>{trade.tradeType}</span>
            <span>{trade.spreadType}</span>
            <span>@ {formatTime(trade.entryTime)} ET</span>
            <span className="ml-auto">{trade.status}</span>
          </div>

          {/* Exits */}
          {trade.exits.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-500 font-medium">Exits</p>
              {trade.exits.map((exit) => (
                <div key={exit.id} className="flex gap-2 text-xs text-gray-400 pl-2">
                  <span>qty {exit.exitQuantity}</span>
                  <span>@ {exit.exitPrice ?? "—"}</span>
                  <span>{exit.exitReason ?? ""}</span>
                  <span className="ml-auto">{formatTime(exit.exitTime)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Inline exit form */}
          {showExitForm && (
            <div className="flex flex-col gap-2 border border-gray-700 rounded p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Qty</span>
                  <input
                    type="number"
                    value={exitForm.exitQuantity}
                    onChange={(e) => setExitForm((f) => ({ ...f, exitQuantity: e.target.value }))}
                    className={`${inputClass} w-full`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">Price</span>
                  <input
                    type="number"
                    step="0.01"
                    value={exitForm.exitPrice}
                    onChange={(e) => setExitForm((f) => ({ ...f, exitPrice: e.target.value }))}
                    className={`${inputClass} w-full`}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Reason</span>
                <select
                  value={exitForm.exitReason}
                  onChange={(e) => setExitForm((f) => ({ ...f, exitReason: e.target.value }))}
                  className={`${inputClass} w-full`}
                >
                  <option>Take Profit</option>
                  <option>Stop Loss</option>
                  <option>Expired</option>
                </select>
              </div>
              {exitForm.error && <p className="text-red-400 text-xs">{exitForm.error}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowExitForm(false)}
                  className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExit}
                  disabled={exitForm.submitting}
                  className="px-2 py-1 text-xs rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
                >
                  {exitForm.submitting ? "Saving…" : "Submit Exit"}
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Delete trade #{trade.id}?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                No
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-0.5 rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes"}
              </button>
            </div>
          )}

          {/* Action buttons */}
          {!showExitForm && !confirmDelete && (
            <div className="flex gap-2">
              {trade.status !== "CLOSED" && (
                <button
                  onClick={() => setShowExitForm(true)}
                  className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
                >
                  Add Exit
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-2 py-1 text-xs rounded bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OpenPositions() {
  const { trades, reload } = useTrades();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-200">Open Positions</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          <Plus size={12} />
          New Trade
        </button>
      </div>

      {/* New trade form */}
      {showForm && (
        <TradeEntryForm
          onSuccess={() => { setShowForm(false); reload(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Trade list */}
      {trades.length === 0 ? (
        <p className="text-gray-600 text-xs">No open positions</p>
      ) : (
        <div className="flex flex-col gap-2">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} onReload={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
