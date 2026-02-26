/**
 * BindingContext — provides constants lookup and catalog to ValueEditor (W12.2).
 *
 * Provided by CanvasArea. Consumed by ValueEditor and any component that
 * needs to resolve or display constant bindings.
 */

import { createContext, useContext } from 'react'
import type { ConstantsLookup } from '../engine/resolveBindings'
import type { CatalogEntry } from '../engine/wasm-types'

export interface BindingContextValue {
  /** Map of opId → scalar value for zero-input source blocks. */
  constants: ConstantsLookup
  /** Full catalog entries (for searchable constant picker — labels + categories). */
  catalog: CatalogEntry[]
}

const defaultValue: BindingContextValue = {
  constants: new Map(),
  catalog: [],
}

export const BindingContext = createContext<BindingContextValue>(defaultValue)

export function useBindingContext(): BindingContextValue {
  return useContext(BindingContext)
}
