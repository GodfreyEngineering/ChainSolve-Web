/**
 * chem-blocks.ts — Chemical Engineering block pack (BLK-01).
 *
 * 10 blocks covering core ChemE calculations.
 * Evaluation handled by Rust/WASM engine ops (chem.* namespace).
 */

import type { BlockDef } from './types'

export function registerChemBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'chem.ideal_gas_n',
    label: 'n = PV/RT',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (Pa)' },
      { id: 'V', label: 'V (m³)' },
      { id: 'R', label: 'R (J/mol·K)' },
      { id: 'T', label: 'T (K)' },
    ],
    defaultData: {
      blockType: 'chem.ideal_gas_n',
      label: 'n = PV/RT',
      manualValues: { R: 8.314462618 },
    },
    description: 'Ideal gas law solved for moles: n = PV/RT. R defaults to 8.314 J/(mol·K).',
    synonyms: ['ideal gas', 'PV=nRT', 'gas law', 'moles'],
    tags: ['chemical', 'thermodynamics'],
  })

  register({
    type: 'chem.antoine_vp',
    label: 'Antoine VP',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' },
      { id: 'T', label: 'T (°C)' },
    ],
    defaultData: { blockType: 'chem.antoine_vp', label: 'Antoine VP' },
    description:
      'Antoine equation for vapor pressure: log₁₀(P) = A − B/(C+T). T in °C, returns pressure in mmHg.',
    synonyms: ['vapor pressure', 'antoine equation'],
    tags: ['chemical', 'thermodynamics'],
  })

  register({
    type: 'chem.raoults_partial',
    label: "Raoult's P_partial",
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'x', label: 'x (mol frac)' },
      { id: 'Psat', label: 'P_sat' },
    ],
    defaultData: { blockType: 'chem.raoults_partial', label: "Raoult's P_partial" },
    description:
      "Raoult's law partial pressure: P_i = x_i · P_sat. Mole fraction times saturation pressure for ideal solutions.",
    synonyms: ["Raoult's law", 'partial pressure', 'VLE'],
    tags: ['chemical', 'thermodynamics'],
  })

  register({
    type: 'chem.equilibrium_K',
    label: 'K = exp(−ΔG/RT)',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'dG', label: 'ΔG (J/mol)' },
      { id: 'R', label: 'R (J/mol·K)' },
      { id: 'T', label: 'T (K)' },
    ],
    defaultData: {
      blockType: 'chem.equilibrium_K',
      label: 'K = exp(−ΔG/RT)',
      manualValues: { R: 8.314462618 },
    },
    description:
      'Thermodynamic equilibrium constant: K = exp(−ΔG/RT). Relates Gibbs free energy to equilibrium.',
    synonyms: ['equilibrium constant', 'Gibbs free energy', 'thermodynamic equilibrium'],
    tags: ['chemical', 'thermodynamics'],
  })

  register({
    type: 'chem.arrhenius_rate',
    label: 'k = A·exp(−Ea/RT)',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'A', label: 'A (pre-exp)' },
      { id: 'Ea', label: 'Ea (J/mol)' },
      { id: 'R', label: 'R (J/mol·K)' },
      { id: 'T', label: 'T (K)' },
    ],
    defaultData: {
      blockType: 'chem.arrhenius_rate',
      label: 'k = A·exp(−Ea/RT)',
      manualValues: { R: 8.314462618 },
    },
    description:
      'Arrhenius rate constant: k = A·exp(−Ea/RT). Models temperature dependence of reaction rates.',
    synonyms: ['reaction rate', 'activation energy', 'Arrhenius'],
    tags: ['chemical', 'kinetics'],
  })

  register({
    type: 'chem.heat_reaction',
    label: 'ΔH_rxn',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'H_prod', label: 'H_products' },
      { id: 'H_react', label: 'H_reactants' },
    ],
    defaultData: { blockType: 'chem.heat_reaction', label: 'ΔH_rxn' },
    description:
      'Heat of reaction: ΔH_rxn = H_products − H_reactants. Positive = endothermic, negative = exothermic.',
    synonyms: ['enthalpy of reaction', 'heat of reaction', 'exothermic'],
    tags: ['chemical', 'thermodynamics'],
  })

  register({
    type: 'chem.mole_fraction',
    label: 'x = n/n_total',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'n_comp', label: 'n_comp (mol)' },
      { id: 'n_total', label: 'n_total (mol)' },
    ],
    defaultData: { blockType: 'chem.mole_fraction', label: 'x = n/n_total' },
    description:
      'Mole fraction: x = n_component / n_total. Dimensionless ratio summing to 1 across all components.',
    synonyms: ['mole fraction', 'composition', 'molar ratio'],
    tags: ['chemical', 'composition'],
  })

  register({
    type: 'chem.ficks_flux',
    label: "Fick's Flux J",
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'D', label: 'D (m²/s)' },
      { id: 'dC_dx', label: 'dC/dx (mol/m⁴)' },
    ],
    defaultData: { blockType: 'chem.ficks_flux', label: "Fick's Flux" },
    description:
      "Fick's first law of diffusion: J = −D · (dC/dx). Molar flux proportional to concentration gradient.",
    synonyms: ['diffusion', 'mass transfer', "Fick's law"],
    tags: ['chemical', 'transport'],
  })

  register({
    type: 'chem.CSTR_conv',
    label: 'CSTR X (1st order)',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (s⁻¹)' },
      { id: 'tau', label: 'τ (s)' },
    ],
    defaultData: { blockType: 'chem.CSTR_conv', label: 'CSTR Conversion' },
    description:
      'CSTR conversion for first-order kinetics: X = kτ / (1 + kτ). Continuous stirred-tank reactor.',
    synonyms: ['reactor', 'conversion', 'CSTR'],
    tags: ['chemical', 'reactor'],
  })

  register({
    type: 'chem.enthalpy_sensible',
    label: 'ΔH = Cp·ΔT',
    category: 'chem',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Cp', label: 'Cp (J/mol·K)' },
      { id: 'T1', label: 'T₁ (K)' },
      { id: 'T2', label: 'T₂ (K)' },
    ],
    defaultData: { blockType: 'chem.enthalpy_sensible', label: 'ΔH = Cp·ΔT' },
    description:
      'Sensible enthalpy change: ΔH = Cp · (T₂ − T₁). Heat required for a temperature change at constant pressure.',
    synonyms: ['sensible heat', 'enthalpy change', 'heat capacity'],
    tags: ['chemical', 'thermodynamics'],
  })
}
