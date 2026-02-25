import { createContext, useContext } from 'react'

/** Map from node id → computed scalar value (NaN = error/disconnected). */
export const ComputedContext = createContext<ReadonlyMap<string, number>>(new Map())

export function useComputed(): ReadonlyMap<string, number> {
  return useContext(ComputedContext)
}
