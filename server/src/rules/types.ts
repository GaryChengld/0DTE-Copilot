import type { SpxCandle } from '../services/marketData.js'
import type { TradeWithExits } from '../db/tradeRepository.js'

export interface EvalContext {
  todayCandles:   SpxCandle[]
  addReadings:    number[]
  vixReadings:    number[]
  openTrades:     TradeWithExits[]
  marketSummary:  unknown
  vixDailyCloses: number[]
  prevSpxClose:   number | null
}

export interface EvaluationResult {
  result:           'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:       'bear_call' | 'bull_put'
  addMode?:         string
  shortStrike?:     number
  longStrike?:      number
  estimatedCredit?: number
  markdown:         string
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
