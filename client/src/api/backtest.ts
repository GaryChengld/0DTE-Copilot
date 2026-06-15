export interface BacktestBarTrade {
  shortStrike:  number
  longStrike:   number
  entryCredit:  number
  exitTime?:    string
  exitPrice?:   number
  exitReason?:  string
  pnl?:         number
}

export interface BacktestBarRow {
  time:       string
  summary:    string    // rule-generated one-liner; display without knowing voter structure
  markdown?:  string    // full evaluation markdown for detail panel
  decision:   'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?: string
  trade?:     BacktestBarTrade   // present only when decision === 'GO' and trade was entered
}

export interface BacktestTrade {
  direction:   string
  entryTime:   string
  shortStrike: number
  longStrike:  number
  entryCredit: number
  exitTime?:   string
  exitPrice?:  number
  exitReason?: string
  pnl?:        number
}

export interface BacktestResponse {
  date:     string
  ruleId:   string
  bars:     BacktestBarRow[]
  trades:   BacktestTrade[]
  totalPnl: number
}

export async function runBacktest(ruleId: string, date: string): Promise<BacktestResponse> {
  const res = await fetch(
    `/api/backtest/${encodeURIComponent(ruleId)}?date=${encodeURIComponent(date)}`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
