import { createContext, useContext } from 'react'
import type { Value } from '../engine/value'

/** Map from node id → computed Value (error kind = error/disconnected). */
export const ComputedContext = createContext<ReadonlyMap<string, Value>>(new Map())

export function useComputed(): ReadonlyMap<string, Value> {
  return useContext(ComputedContext)
}
