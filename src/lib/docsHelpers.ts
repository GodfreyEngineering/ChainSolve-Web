/**
 * docsHelpers.ts — Maps block categories to docs page sections (I1-2).
 */

import type { BlockCategory } from '../blocks/types'
import type { DocsSection } from '../pages/DocsPage'

const CATEGORY_TO_DOCS: Record<BlockCategory, DocsSection> = {
  input: 'block-input',
  variable: 'variables',
  math: 'block-math',
  trig: 'block-trig',
  constants: 'block-constants',
  logic: 'block-logic',
  output: 'block-output',
  data: 'block-data',
  vectorOps: 'block-data',
  tableOps: 'block-data',
  plot: 'block-plot',
  engMechanics: 'block-engineering',
  engMaterials: 'block-engineering',
  engSections: 'block-engineering',
  engInertia: 'block-engineering',
  engFluids: 'block-engineering',
  engThermo: 'block-engineering',
  engElectrical: 'block-engineering',
  engConversions: 'block-engineering',
  finTvm: 'block-finance',
  finReturns: 'block-finance',
  finDepr: 'block-finance',
  statsDesc: 'block-stats',
  statsRel: 'block-stats',
  probComb: 'block-stats',
  probDist: 'block-stats',
  utilCalc: 'block-math',
  constMath: 'block-constants',
  constPhysics: 'block-constants',
  constAtmos: 'block-constants',
  constThermo: 'block-constants',
  constElec: 'block-constants',
  presetMaterials: 'materials',
  presetFluids: 'materials',
  customFunctions: 'block-library',
  chem: 'block-engineering',
  structural: 'block-engineering',
  aerospace: 'block-engineering',
  controlSystems: 'block-engineering',
  lifeSci: 'block-engineering',
  finOptions: 'block-finance',
  dateTime: 'block-math',
  text: 'block-math',
  interval: 'block-math',
  signal: 'block-math',
  complex: 'block-math',
  matrix: 'block-math',
  optimization: 'block-math',
  machineLearning: 'block-math',
  neuralNetworks: 'block-math',
}

export function getDocsSectionForCategory(category: BlockCategory): DocsSection {
  return CATEGORY_TO_DOCS[category] ?? 'block-library'
}
