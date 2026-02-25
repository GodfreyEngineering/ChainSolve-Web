/**
 * React context for the WASM compute engine.
 *
 * The engine is initialized in main.tsx and provided to the entire app.
 * Components that need to evaluate graphs use `useEngine()`.
 */

import { createContext, useContext } from 'react'
import type { EngineAPI } from '../engine/index.ts'

export const EngineContext = createContext<EngineAPI | null>(null)

/**
 * Return the WASM engine instance.
 * Throws if called outside of an EngineContext provider (should never happen
 * in normal app flow since main.tsx gates rendering on engine readiness).
 */
export function useEngine(): EngineAPI {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useEngine() called outside EngineContext')
  return engine
}
