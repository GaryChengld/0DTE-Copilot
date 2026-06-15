import type { SpxCandle } from '../services/marketData.js'
import type { TradeWithExits } from '../db/tradeRepository.js'

export interface EvalContext {
  todayCandles:    SpxCandle[]
  addReadings:     number[]
  tickReadings?:   number[]   // NYSE TICK values; optional — scored 0 when absent
  vixReadings:     number[]
  openTrades:      TradeWithExits[]
  tradesToday?:    number      // total trades entered today (open + closed); drives threshold and daily limit
  marketSummary:   unknown
  vixDailyCloses:  number[]
  prevSpxClose:    number | null
  currentTimeET?:  string   // "HH:MM" — overrides wall clock for spread pricing (used by backtest)
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

export interface BacktestBarTrade {
  shortStrike:  number
  longStrike:   number
  entryCredit:  number
  exitTime?:    string
  exitPrice?:   number
  exitReason?:  'TP1' | 'TP2' | 'SL1' | 'SL2' | 'FORCED'
  pnl?:         number
}

export interface BacktestBarRow {
  time:       string
  summary:    string    // rule-generated one-liner; rule-agnostic display
  markdown?:  string    // full evaluation markdown (only for bars where evaluate() was called)
  decision:   'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?: 'bear_call' | 'bull_put'
  trade?:     BacktestBarTrade   // present only when decision === 'GO' and trade was entered
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
