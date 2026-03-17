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
import { buildStructuralBeam } from './structural-beam'
import { buildHeatTransfer } from './heat-transfer'
import { buildOhmsLaw } from './ohms-law'
import { buildFluidFlow } from './fluid-flow'
import { buildInvestmentReturns } from './investment-returns'
import { buildSpringMassDamper } from './spring-mass-damper'
import { buildPidController } from './pid-controller'
import { buildVehicleSuspension } from './vehicle-suspension'
import { buildCurveFitting } from './curve-fitting'
import { buildNeuralNetworkTraining } from './neural-network-training'
import { buildStructuralOptimisation } from './structural-optimisation'
import { buildBatteryThermal } from './battery-thermal'

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
  {
    id: 'structural-beam',
    name: 'Simply Supported Beam',
    description:
      'Bending stress and deflection for a simply supported beam with central point load \u2014 \u03c3 = PL/(4Z), \u03b4 = PL\u00b3/(48EI).',
    tags: ['structural', 'beam', 'civil', 'mechanics'],
    category: 'Engineering',
    buildGraph: buildStructuralBeam,
  },
  {
    id: 'heat-transfer',
    name: 'Conductive Heat Transfer',
    description:
      "Fourier's law through a flat wall: Q = k\u00b7A\u00b7\u0394T/L. Also computes thermal resistance R and heat flux q.",
    tags: ['thermodynamics', 'heat', 'conduction', 'thermal'],
    category: 'Engineering',
    buildGraph: buildHeatTransfer,
  },
  {
    id: 'ohms-law',
    name: "Ohm's Law & Power",
    description:
      "Ohm's law V = IR and electrical power P = IV, P = I\u00B2R \u2014 three classic electrical calculations sharing voltage, current, and resistance inputs.",
    tags: ['electronics', 'circuits', 'ohm', 'power'],
    category: 'Student',
    buildGraph: buildOhmsLaw,
  },
  {
    id: 'fluid-flow',
    name: 'Reynolds Number & Flow Regime',
    description:
      'Computes the Reynolds number Re = \u03C1vD/\u03BC and classifies flow as laminar (Re < 2300) or turbulent. Inputs: density, velocity, diameter, viscosity.',
    tags: ['fluids', 'reynolds', 'laminar', 'turbulent', 'pipe flow'],
    category: 'Engineering',
    buildGraph: buildFluidFlow,
  },
  {
    id: 'investment-returns',
    name: 'Investment Returns',
    description:
      'Side-by-side compound interest FV = PV(1+r/n)^(nt) and simple interest SI = Prt \u2014 compare growth strategies over time.',
    tags: ['finance', 'interest', 'compound', 'investment'],
    category: 'Finance',
    buildGraph: buildInvestmentReturns,
  },
  {
    id: 'spring-mass-damper',
    name: 'Spring-Mass-Damper Tutorial',
    description:
      'Interactive 5-minute tutorial: spring-mass-damper system — natural frequency ωn, damping ratio ζ, % overshoot, and step response y(t). Annotated step-by-step.',
    tags: ['tutorial', 'control', 'dynamics', 'spring', 'mechanical', 'damper'],
    category: 'Engineering',
    buildGraph: buildSpringMassDamper,
  },
  {
    id: 'pid-controller',
    name: 'PID Controller Tuning',
    description:
      'PID output u(t) = Kp·e(t) + Ki·∫e dt + Kd·Δe/Δt — tune proportional, integral, and derivative gains to explore controller response.',
    tags: ['control', 'pid', 'tuning', 'engineering', 'dynamics'],
    category: 'Engineering',
    buildGraph: buildPidController,
  },
  {
    id: 'vehicle-suspension',
    name: 'Vehicle Suspension K&C',
    description:
      'Quarter-car suspension model: sprung frequency fn_s, unsprung frequency fn_u, damping ratio ζ, and percent overshoot for ride and handling analysis.',
    tags: ['vehicle', 'suspension', 'dynamics', 'control', 'automotive'],
    category: 'Engineering',
    buildGraph: buildVehicleSuspension,
  },
  {
    id: 'curve-fitting',
    name: 'Curve Fitting',
    description:
      'Linear regression y = a + b·x — fit a line to your data, inspect slope, intercept, R² goodness-of-fit, and predict new values.',
    tags: ['statistics', 'regression', 'data', 'curve fitting', 'machine learning'],
    category: 'Science',
    buildGraph: buildCurveFitting,
  },
  {
    id: 'neural-network-training',
    name: 'Neural Network Training',
    description:
      'Feedforward network hyperparameter explorer: parameter count for a two-layer MLP, and cross-entropy loss H = −y·log(ŷ) for a single prediction.',
    tags: ['machine learning', 'neural network', 'deep learning', 'loss', 'hyperparameters'],
    category: 'Science',
    buildGraph: buildNeuralNetworkTraining,
  },
  {
    id: 'structural-optimisation',
    name: 'Structural Optimisation',
    description:
      'Minimise hollow circular beam mass subject to bending stress σ and central deflection δ constraints — tune outer radius R and wall thickness t.',
    tags: ['structural', 'optimisation', 'beam', 'civil', 'mechanics', 'engineering'],
    category: 'Engineering',
    buildGraph: buildStructuralOptimisation,
  },
  {
    id: 'battery-thermal',
    name: 'Battery Thermal Model',
    description:
      'Lumped thermal model of a Li-ion cell during discharge — Joule heat Q_gen = I²R, convective cooling Q_loss = hAΔT, and cell temperature T_cell.',
    tags: ['battery', 'thermal', 'EV', 'energy', 'electrical', 'engineering'],
    category: 'Engineering',
    buildGraph: buildBatteryThermal,
  },
]
