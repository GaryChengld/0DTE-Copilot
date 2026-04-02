# Task 55 — Open Positions + Trade Entry Form ✅ COMPLETED (2026-04-01)

## Goal

Display open trades in the right sidebar as a drill-down list. Clicking a trade expands it
to show exits and reveals action choices. A header button opens a collapsible new trade form.

## Changes

### New: `client/src/api/trades.ts`

```typescript
export async function getOpenTrades(): Promise<Trade[]>
export async function openTrade(data: OpenTradeRequest): Promise<Trade>
export async function exitTrade(data: ExitTradeRequest): Promise<TradeExit>
export async function deleteTrade(id: number): Promise<void>
```

Key types:
```typescript
interface Trade {
  id: number;
  tradeDate: string;
  status: string;
  symbol: string;
  tradeType: string;
  spreadType: string;
  optionType: string | null;
  strike: string | null;
  quantity: number;
  quantityRemaining: number;
  entryPrice: number | null;
  entryTime: string | null;
  exits: TradeExit[];
}

interface TradeExit {
  id: number;
  exitQuantity: number;
  exitPrice: number | null;
  exitReason: string | null;
  exitTime: string | null;
}
```

### New: `client/src/hooks/useTrades.ts`

```typescript
export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const reload = () => getOpenTrades().then(setTrades);
  useEffect(() => { reload(); }, []);
  return { trades, reload };
}
```

### New: `client/src/components/OpenPositions.tsx`

Single container in the right sidebar. Structure:

**Header row:**
- Title: "Open Positions"
- **[+ New Trade]** button — toggles `TradeEntryForm` open/closed

**Trade list:**
- Each trade renders as a summary row: symbol, option type, strike, qty remaining / initial, entry price, entry time
- Clicking a trade row expands it (accordion) to show:
  - **Exits sub-list** (if any): each exit shows qty, price, reason, time
  - **Action buttons:**
    - **[Add Exit]** — visible only when `status !== "CLOSED"` — expands an inline exit form
    - **[Delete]** — shows a confirm prompt inline ("Delete trade #N?") before calling `DELETE /api/trades/:id`

**Inline exit form** (shown when [Add Exit] is clicked):
- Fields: exit quantity (number), exit price (number), exit reason (select: Take Profit / Stop Loss / Expired)
- **[Submit Exit]** → `POST /api/trades/exits`; on success: collapse form, reload positions
- **[Cancel]** → collapse form without submitting

**Empty state:** "No open positions"

### New: `client/src/components/TradeEntryForm.tsx`

Collapsible form rendered below the header, hidden by default, shown when `[+ New Trade]` is clicked:

Fields:
- Symbol (text, e.g. "SPX")
- Trade Type (select: SPREAD / SINGLE)
- Spread Type (select: CREDIT / DEBIT)
- Option Type (select: PUT / CALL)
- Strike (text, e.g. "5510/5500" for spread, "5505" for single)
- Quantity (number)
- Entry Price (number)
- Entry Time (datetime-local, defaults to now)

**[Open Trade]** → `POST /api/trades`; on success: collapse form, reload positions.

## Done When

- Open trades render as a list in the right sidebar
- Clicking a trade expands it to show exits and action buttons
- [Add Exit] is hidden for CLOSED trades
- Inline exit form submits and refreshes the list
- [Delete] shows inline confirmation before deleting
- New trade form opens in the header area, submits, and collapses on success
