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
    synonyms: ['reaction rate', 'activation energy'],
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
    synonyms: ['diffusion', 'mass transfer'],
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
    synonyms: ['reactor', 'conversion', 'CSTR'],
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
  })
}
