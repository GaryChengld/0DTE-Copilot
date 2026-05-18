import type { SpxCandle } from '../services/marketData.js'
import type { TradeWithExits } from '../db/tradeRepository.js'

export interface EvalContext {
  todayCandles:    SpxCandle[]
  addReadings:     number[]
  vixReadings:     number[]
  openTrades:      TradeWithExits[]
  marketSummary:   unknown
  vixDailyCloses:  number[]
  prevSpxClose:    number | null
  currentTimeET?:  string   // "HH:MM" — overrides wall clock for K5 and spread pricing (used by backtest)
}

export interface VoterResult {
  pass:    boolean
  details: string[]
}

export interface VoterDetail {
  bullPut:  { t: VoterResult; o: VoterResult; b: VoterResult }
  bearCall: { t: VoterResult; o: VoterResult; b: VoterResult }
}

export interface EvaluationResult {
  result:            'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:        'bear_call' | 'bull_put'
  addMode?:          string
  shortStrike?:      number
  longStrike?:       number
  estimatedCredit?:  number
  haltReason?:       string
  markdown:          string
  voterDetail?:      VoterDetail
  backtestSummary?:  string   // compact one-line string for backtest bar table display
}

export interface RuleService {
  evaluate(ctx: EvalContext, config: unknown): EvaluationResult
}

export interface RuleInfo {
  id:          string
  name:        string
  version:     string
  description: string
}

export interface BacktestBarRow {
  time:          string
  summary:       string   // rule-generated one-liner; rule-agnostic display
  voterDetail?:  VoterDetail
  decision:      'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:    'bear_call' | 'bull_put'
  hasPosition:   boolean
  isEntry?:      boolean
  isExit?:       boolean
  exitReason?:   'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
  shortStrike?:  number
  longStrike?:   number
  entryCredit?:  number
  currentPrice?: number
}

export interface BacktestTrade {
  direction:   'bear_call' | 'bull_put'
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
