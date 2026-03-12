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
import { buildScienceProjectile } from './science-projectile'
import { buildEngineeringRc } from './engineering-rc'
import { buildStudentQuadratic } from './student-quadratic'

export interface TemplateMeta {
  /** Stable unique key — never rename after shipping. */
  id: string
  name: string
  description: string
  tags: string[]
  /** Broad grouping used in the New Project modal gallery. */
  category: string
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
    category: 'Science',
    buildGraph: buildPhysics101,
  },
  {
    id: 'finance-101',
    name: 'Finance 101',
    description:
      'Compound future value and simple interest side-by-side, sharing principal, rate, and time inputs.',
    tags: ['finance', 'tvm', 'interest'],
    category: 'Finance',
    buildGraph: buildFinance101,
  },
  {
    id: 'stats-101',
    name: 'Stats 101',
    description:
      'Mean and standard deviation of a six-point dataset — wired and ready to extend with a plot.',
    tags: ['statistics', 'descriptive', 'dataset'],
    category: 'Student',
    buildGraph: buildStats101,
  },
  {
    id: 'science-projectile',
    name: 'Projectile Motion',
    description:
      'Computes the horizontal range R = v\u2080\u00b2 \u00b7 sin(2\u03b8) / g given initial velocity, launch angle, and gravity.',
    tags: ['physics', 'kinematics', 'projectile'],
    category: 'Science',
    buildGraph: buildScienceProjectile,
  },
  {
    id: 'engineering-rc',
    name: 'RC Circuit Time Constant',
    description:
      'Computes the RC time constant \u03c4 = R \u00b7 C — the time for the capacitor to charge to ~63% of supply voltage.',
    tags: ['electronics', 'circuits', 'rc'],
    category: 'Engineering',
    buildGraph: buildEngineeringRc,
  },
  {
    id: 'student-quadratic',
    name: 'Quadratic Formula',
    description:
      'Solves ax\u00b2 + bx + c = 0 for the positive root x\u2081 = (\u2212b + \u221a(b\u00b2\u22124ac)) / (2a).',
    tags: ['algebra', 'quadratic', 'roots'],
    category: 'Student',
    buildGraph: buildStudentQuadratic,
  },
]
