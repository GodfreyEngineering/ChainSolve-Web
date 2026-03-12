/**
 * React context for the parallel worker pool (ENG-04).
 *
 * The pool is initialized in main.tsx alongside the primary engine.
 * Canvas components acquire a dedicated engine via useCanvasEngine().
 */

import { createContext, useContext } from 'react'
import type { WorkerPoolAPI } from '../engine/workerPool.ts'

export const WorkerPoolContext = createContext<WorkerPoolAPI | null>(null)

/**
 * Return the worker pool. Returns null if no pool is provided (e.g. in tests
 * that don't render the full provider tree).
 */
export function useWorkerPool(): WorkerPoolAPI | null {
  return useContext(WorkerPoolContext)
}
