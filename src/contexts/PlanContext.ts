import { createContext, useContext } from 'react'
import type { Plan } from '../lib/entitlements'

export const PlanContext = createContext<Plan>('free')

export function usePlan(): Plan {
  return useContext(PlanContext)
}
