/**
 * AI Copilot — barrel export.
 */

export * from './types'
export { AI_COPILOT_WINDOW_ID } from './constants'
export { assessRisk, requiresConfirmation } from './riskScoring'
export { applyPatchOps, type PatchResult, type PatchValidationError } from './patchExecutor'
export { sendCopilotRequest } from './aiService'
export {
  buildContextPack,
  estimateContextTokens,
  type ContextPack,
  type ContextDiagnostic,
  type MinimizeOptions,
} from './contextMinimizer'
