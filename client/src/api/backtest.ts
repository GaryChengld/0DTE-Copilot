export interface BarVoterResult { pass: boolean; details: string[] }
export interface BarVoters { t: BarVoterResult; o: BarVoterResult; b: BarVoterResult }
export interface VoterDetail { bullPut: BarVoters; bearCall: BarVoters }

export interface BacktestBarRow {
  time:          string
  summary:       string   // rule-generated one-liner; display without knowing voter structure
  voterDetail?:  VoterDetail
  decision:      'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:    string
  hasPosition:   boolean
  isEntry?:      boolean
  isExit?:       boolean
  exitReason?:   string
  shortStrike?:  number
  longStrike?:   number
  entryCredit?:  number
  currentPrice?: number
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
