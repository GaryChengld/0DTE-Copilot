export interface RuleInfo {
  id:          string
  name:        string
  version:     string
  description: string
}

export interface EvaluationResult {
  result:           'GO' | 'NO-GO' | 'WAIT' | 'HALT'
  direction?:       string
  addMode?:         string
  shortStrike?:     number
  longStrike?:      number
  estimatedCredit?: number
  markdown:         string
}

export async function listRules(): Promise<RuleInfo[]> {
  const res = await fetch('/api/rules')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function evaluateRule(id: string): Promise<EvaluationResult> {
  const res = await fetch(`/api/rules/${encodeURIComponent(id)}/evaluate`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
