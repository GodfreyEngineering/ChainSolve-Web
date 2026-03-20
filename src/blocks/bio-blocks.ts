/**
 * bio-blocks.ts — Biology and Life Sciences block pack (BLK-06).
 *
 * 10 blocks: enzyme kinetics, pharmacokinetics, growth, biophysics, clinical.
 * Evaluation handled by Rust/WASM engine ops (bio.* namespace).
 */

import type { BlockDef } from './types'

export function registerBioBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'bio.michaelis_menten',
    label: 'Michaelis-Menten',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vmax', label: 'V_max' },
      { id: 'Km', label: 'K_m' },
      { id: 'S', label: '[S]' },
    ],
    defaultData: { blockType: 'bio.michaelis_menten', label: 'Michaelis-Menten' },
    description:
      'Michaelis-Menten enzyme kinetics: v = V_max · [S] / (K_m + [S]). Relates reaction velocity to substrate concentration.',
    synonyms: ['enzyme kinetics', 'Michaelis-Menten', 'reaction velocity'],
    tags: ['biology', 'biochemistry'],
  })

  register({
    type: 'bio.hill_eq',
    label: 'Hill Equation',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'n', label: 'n (Hill coef)' },
      { id: 'Kd', label: 'K_d' },
      { id: 'L', label: '[L]' },
    ],
    defaultData: { blockType: 'bio.hill_eq', label: 'Hill Equation' },
    description:
      'Hill equation: θ = [L]^n / (K_d^n + [L]^n). Models cooperative ligand binding with Hill coefficient n.',
    synonyms: ['Hill equation', 'cooperativity', 'binding'],
    tags: ['biology', 'biochemistry'],
  })

  register({
    type: 'bio.logistic_growth',
    label: 'Logistic Growth',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'r', label: 'r (growth rate)' },
      { id: 'K', label: 'K (capacity)' },
      { id: 'N0', label: 'N₀ (initial)' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'bio.logistic_growth', label: 'Logistic Growth' },
    description:
      'Logistic growth model: N(t) = K / (1 + ((K−N₀)/N₀)·e^(−r·t)). S-shaped growth with carrying capacity K.',
    synonyms: ['logistic growth', 'population dynamics', 'carrying capacity'],
    tags: ['biology', 'ecology'],
  })

  register({
    type: 'bio.exp_decay',
    label: 'N = N₀e^(−λt)',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'N0', label: 'N₀' },
      { id: 'lambda', label: 'λ (decay rate)' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'bio.exp_decay', label: 'Exponential Decay' },
    description:
      'Exponential decay: N(t) = N₀·e^(−λt). First-order decay for radioactive, chemical, or biological processes.',
    synonyms: ['exponential decay', 'radioactive decay', 'first order decay'],
    tags: ['biology', 'physics'],
  })

  register({
    type: 'bio.half_life',
    label: 't₁/₂ = ln2/λ',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [{ id: 'lambda', label: 'λ (decay rate)' }],
    defaultData: { blockType: 'bio.half_life', label: 'Half-Life' },
    description:
      'Half-life from decay constant: t₁/₂ = ln(2)/λ. Time for quantity to reduce by half.',
    synonyms: ['half life', 'radioactive', 'decay constant'],
    tags: ['biology', 'physics'],
  })

  register({
    type: 'bio.drug_1cmp',
    label: '1-Compartment PK',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'D', label: 'D (dose)' },
      { id: 'V', label: 'V_d (L)' },
      { id: 'k', label: 'k_el (1/h)' },
      { id: 't', label: 't (h)' },
    ],
    defaultData: { blockType: 'bio.drug_1cmp', label: '1-Cmp PK' },
    description:
      'One-compartment pharmacokinetics: C(t) = (D/V_d)·e^(−k_el·t). IV bolus drug concentration over time.',
    synonyms: ['pharmacokinetics', 'drug concentration', 'one compartment'],
    tags: ['biology', 'pharmacology'],
  })

  register({
    type: 'bio.henderson_hasselbalch',
    label: 'Henderson-Hasselbalch',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'pKa', label: 'pKa' },
      { id: 'A', label: '[A⁻]' },
      { id: 'HA', label: '[HA]' },
    ],
    defaultData: { blockType: 'bio.henderson_hasselbalch', label: 'Henderson-Hasselbalch' },
    description:
      'Henderson-Hasselbalch equation: pH = pKa + log₁₀([A⁻]/[HA]). Relates pH to acid dissociation.',
    synonyms: ['Henderson-Hasselbalch', 'pH buffer', 'acid-base'],
    tags: ['biology', 'chemistry'],
  })

  register({
    type: 'bio.nernst',
    label: 'Nernst Equation',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R', label: 'R (J/mol·K)' },
      { id: 'T', label: 'T (K)' },
      { id: 'z', label: 'z (valence)' },
      { id: 'F', label: 'F (C/mol)' },
      { id: 'C_out', label: '[out]' },
      { id: 'C_in', label: '[in]' },
    ],
    defaultData: {
      blockType: 'bio.nernst',
      label: 'Nernst Potential',
      manualValues: { R: 8.314462618, F: 96485.33212 },
    },
    description:
      'Nernst equation: E = (RT/(zF))·ln([out]/[in]). Equilibrium membrane potential for an ion species.',
    synonyms: ['Nernst', 'membrane potential', 'electrochemistry'],
    tags: ['biology', 'biophysics'],
  })

  register({
    type: 'bio.BMI',
    label: 'BMI',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'mass_kg', label: 'mass (kg)' },
      { id: 'height_m', label: 'height (m)' },
    ],
    defaultData: { blockType: 'bio.BMI', label: 'BMI' },
    description:
      'Body Mass Index: BMI = mass(kg) / height(m)². Standard clinical measure of body composition.',
    synonyms: ['BMI', 'body mass index'],
    tags: ['biology', 'clinical'],
  })

  register({
    type: 'bio.BSA_dubois',
    label: 'BSA (DuBois)',
    category: 'lifeSci',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'W_kg', label: 'W (kg)' },
      { id: 'H_cm', label: 'H (cm)' },
    ],
    defaultData: { blockType: 'bio.BSA_dubois', label: 'BSA DuBois' },
    description:
      'DuBois body surface area: BSA = 0.007184 · W^0.425 · H^0.725. Used for drug dosing (m²).',
    synonyms: ['BSA', 'body surface area', 'DuBois'],
    tags: ['biology', 'clinical'],
  })
}
