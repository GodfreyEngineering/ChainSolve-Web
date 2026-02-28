/**
 * templates/index.ts — Sample template registry.
 *
 * Each template entry provides metadata and a factory function that
 * produces a populated CanvasJSON when given a canvasId + projectId.
 */

import type { CanvasJSON } from '../lib/canvasSchema'
import { buildPhysics101 } from './physics-101'
import { buildFinance101 } from './finance-101'
import { buildStats101 } from './stats-101'

export interface TemplateMeta {
  /** Stable unique key — never rename after shipping. */
  id: string
  name: string
  description: string
  tags: string[]
  /** Produce a ready-to-use CanvasJSON for this template. */
  buildGraph: (canvasId: string, projectId: string) => CanvasJSON
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'physics-101',
    name: 'Physics 101',
    description:
      "Newton's second law (F = ma) and kinetic energy (KE = \u00bdmv\u00b2) \u2014 two calculations sharing a common mass input.",
    tags: ['physics', 'mechanics', 'engineering'],
    buildGraph: buildPhysics101,
  },
  {
    id: 'finance-101',
    name: 'Finance 101',
    description:
      'Compound future value and simple interest side-by-side, sharing principal, rate, and time inputs.',
    tags: ['finance', 'tvm', 'interest'],
    buildGraph: buildFinance101,
  },
  {
    id: 'stats-101',
    name: 'Stats 101',
    description:
      'Mean and standard deviation of a six-point dataset — wired and ready to extend with a plot.',
    tags: ['statistics', 'descriptive', 'dataset'],
    buildGraph: buildStats101,
  },
]
