/**
 * registerAllBlocks — lazily loaded block registration module (UI-PERF-05).
 *
 * All domain-specific block packs (engineering, finance, ML, etc.) are
 * registered here rather than in registry.ts so that they are excluded
 * from the initial JS bundle. This module is dynamically imported in
 * main.tsx after the WASM engine is ready.
 */

import type { BlockDef } from './types'
import { BLOCK_REGISTRY } from './registry'

import { registerVectorBlocks } from './vector-blocks'
import { registerTableBlocks } from './table-blocks'
import { registerPlotBlocks } from './plot-blocks'
import { registerEngBlocks } from './eng-blocks'
import { registerFinStatsBlocks } from './fin-stats-blocks'
import { registerConstantsBlocks } from './constants-blocks'
import { registerDistBlocks } from './dist-blocks'
import { registerChemBlocks } from './chem-blocks'
import { registerStructBlocks } from './struct-blocks'
import { registerAeroBlocks } from './aero-blocks'
import { registerCtrlBlocks } from './ctrl-blocks'
import { registerBioBlocks } from './bio-blocks'
import { registerFinOptionsBlocks } from './fin-options-blocks'
import { registerDateBlocks } from './date-blocks'
import { registerTextBlocks } from './text-blocks'
import { registerIntervalBlocks } from './interval-blocks'
import { registerSignalBlocks } from './signal-blocks'
import { registerComplexBlocks } from './complex-blocks'
import { registerMatrixBlocks } from './matrix-blocks'
import { registerNumericalBlocks } from './numerical-blocks'
import { registerOptimBlocks } from './optim-blocks'
import { registerMLBlocks } from './ml-blocks'
import { registerNNBlocks } from './nn-blocks'
import { registerLookupBlocks } from './lookup-blocks'
import { registerTestBlocks } from './test-blocks'
import { registerAssertionBlocks } from './assertion-blocks'
import { registerWebSocketBlocks } from './websocket-blocks'
import { registerRestBlocks } from './rest-blocks'
import { registerScopeBlocks } from './scope-blocks'
import { registerTimerBlocks } from './timer-blocks'
import { registerLoggerBlocks } from './logger-blocks'
import { SEARCH_METADATA } from './blockSearchMetadata'

function reg(
  def: Omit<BlockDef, 'synonyms' | 'tags' | 'description' | 'proOnly'> & { proOnly?: boolean },
): void {
  BLOCK_REGISTRY.set(def.type, def)
}

/** Register all domain block packs and apply search metadata. */
export function registerAllBlocks(): void {
  // Skip if already registered (idempotent).
  // Core registry has ~60 blocks; domain packs bring it to 300+.
  if (BLOCK_REGISTRY.size > 100) return

  registerVectorBlocks(reg)
  registerTableBlocks(reg)
  registerPlotBlocks(reg)
  registerEngBlocks(reg)
  registerFinStatsBlocks(reg)
  registerConstantsBlocks(reg)
  registerDistBlocks(reg)
  registerChemBlocks(reg)
  registerStructBlocks(reg)
  registerAeroBlocks(reg)
  registerCtrlBlocks(reg)
  registerBioBlocks(reg)
  registerFinOptionsBlocks(reg)
  registerDateBlocks(reg)
  registerTextBlocks(reg)
  registerIntervalBlocks(reg)
  registerSignalBlocks(reg)
  registerComplexBlocks(reg)
  registerMatrixBlocks(reg)
  registerLookupBlocks(reg)
  registerNumericalBlocks(reg)
  registerOptimBlocks(reg)
  registerMLBlocks(reg)
  registerNNBlocks(reg)
  registerTestBlocks(reg)
  registerAssertionBlocks(reg)
  registerWebSocketBlocks(reg)
  registerRestBlocks(reg)
  registerScopeBlocks(reg)
  registerTimerBlocks(reg)
  registerLoggerBlocks(reg)

  // E5-5: Apply search metadata (synonyms + tags) after all blocks are registered
  for (const [opId, meta] of Object.entries(SEARCH_METADATA)) {
    const def = BLOCK_REGISTRY.get(opId)
    if (def) {
      if (meta.synonyms) def.synonyms = meta.synonyms
      if (meta.tags) def.tags = meta.tags
    }
  }
}
