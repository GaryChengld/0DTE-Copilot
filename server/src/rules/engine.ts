import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { RuleService, RuleInfo, EvalContext, EvaluationResult } from './types.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const CONFIGS = join(__dir, '../../configs/rules')

interface IndexEntry {
  id:          string
  name:        string
  version:     string
  description: string
  configFile:  string
  service:     string
  enabled:     boolean
}

// Service registry: service name → lazy loader.
// Add new rules here alongside their entry in rules_index.json.
const SERVICE_REGISTRY: Record<string, () => Promise<RuleService>> = {
  threeVoterV1: () => import('./services/threeVoterV1.js').then(m => m.threeVoterV1Service),
}

function loadIndex(): IndexEntry[] {
  return JSON.parse(readFileSync(join(CONFIGS, 'rules_index.json'), 'utf-8')) as IndexEntry[]
}

export function listRules(): RuleInfo[] {
  return loadIndex()
    .filter(e => e.enabled)
    .map(({ id, name, version, description }) => ({ id, name, version, description }))
}

export async function getRuleServiceAndConfig(
  ruleId: string
): Promise<{ service: RuleService; config: unknown }> {
  const entry = loadIndex().find(e => e.id === ruleId)
  if (!entry)         throw new Error(`Unknown rule: ${ruleId}`)
  if (!entry.enabled) throw new Error(`Rule '${ruleId}' is disabled`)
  const loader = SERVICE_REGISTRY[entry.service]
  if (!loader) throw new Error(`No service registered for: ${entry.service}`)
  const service = await loader()
  const config  = JSON.parse(readFileSync(join(CONFIGS, entry.configFile), 'utf-8'))
  return { service, config }
}

export async function evaluateRule(ruleId: string, ctx: EvalContext): Promise<EvaluationResult> {
  const entry = loadIndex().find(e => e.id === ruleId)
  if (!entry)         throw new Error(`Unknown rule: ${ruleId}`)
  if (!entry.enabled) throw new Error(`Rule '${ruleId}' is disabled`)

  const loader = SERVICE_REGISTRY[entry.service]
  if (!loader) throw new Error(`No service registered for: ${entry.service}`)

  const service = await loader()
  const config  = JSON.parse(readFileSync(join(CONFIGS, entry.configFile), 'utf-8'))
  return service.evaluate(ctx, config)
}
