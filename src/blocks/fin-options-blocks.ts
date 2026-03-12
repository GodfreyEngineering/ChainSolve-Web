/**
 * fin-options-blocks.ts — Finance: Options, bonds, risk (BLK-07).
 *
 * 10 blocks: Black-Scholes greeks, VaR/CVaR, Kelly, bond duration, DCF.
 * Evaluation handled by Rust/WASM engine ops (fin.options.* namespace).
 */

import type { BlockDef } from './types'

export function registerFinOptionsBlocks(register: (def: BlockDef) => void): void {
  const BSInputs = [
    { id: 'S', label: 'S (spot)' },
    { id: 'K', label: 'K (strike)' },
    { id: 'T', label: 'T (years)' },
    { id: 'r', label: 'r (risk-free)' },
    { id: 'sigma', label: 'σ (vol)' },
  ]

  register({
    type: 'fin.options.bs_call',
    label: 'Black-Scholes Call',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_call', label: 'BS Call' },
    synonyms: ['Black-Scholes', 'call option', 'options pricing'],
    tags: ['finance', 'options'],
  })

  register({
    type: 'fin.options.bs_put',
    label: 'Black-Scholes Put',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_put', label: 'BS Put' },
    synonyms: ['Black-Scholes', 'put option', 'options pricing'],
  })

  register({
    type: 'fin.options.bs_delta',
    label: 'BS Delta (Δ)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_delta', label: 'BS Delta' },
    synonyms: ['delta', 'option delta', 'hedge ratio'],
  })

  register({
    type: 'fin.options.bs_gamma',
    label: 'BS Gamma (Γ)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_gamma', label: 'BS Gamma' },
    synonyms: ['gamma', 'option gamma', 'convexity'],
  })

  register({
    type: 'fin.options.bs_vega',
    label: 'BS Vega (ν)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_vega', label: 'BS Vega' },
    synonyms: ['vega', 'option vega', 'volatility sensitivity'],
  })

  register({
    type: 'fin.options.kelly',
    label: 'Kelly Criterion',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'p_win', label: 'p (win prob)' },
      { id: 'b', label: 'b (odds)' },
    ],
    defaultData: { blockType: 'fin.options.kelly', label: 'Kelly f*' },
    synonyms: ['Kelly criterion', 'optimal bet', 'position sizing'],
  })

  register({
    type: 'fin.options.var_hist',
    label: 'VaR (historical)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'returns', label: 'Returns (vector)' },
      { id: 'conf', label: 'Confidence' },
    ],
    defaultData: {
      blockType: 'fin.options.var_hist',
      label: 'Historical VaR',
      manualValues: { conf: 0.95 },
    },
    synonyms: ['VaR', 'value at risk', 'historical simulation'],
  })

  register({
    type: 'fin.options.cvar_hist',
    label: 'CVaR (historical)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'returns', label: 'Returns (vector)' },
      { id: 'conf', label: 'Confidence' },
    ],
    defaultData: {
      blockType: 'fin.options.cvar_hist',
      label: 'Historical CVaR',
      manualValues: { conf: 0.95 },
    },
    synonyms: ['CVaR', 'expected shortfall', 'conditional VaR'],
  })

  register({
    type: 'fin.options.bond_duration',
    label: 'Macaulay Duration',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'coupon', label: 'Coupon ($)' },
      { id: 'face', label: 'Face ($)' },
      { id: 'ytm', label: 'YTM' },
      { id: 'n', label: 'n (periods)' },
    ],
    defaultData: { blockType: 'fin.options.bond_duration', label: 'Macaulay Duration' },
    synonyms: ['Macaulay duration', 'bond duration', 'interest rate sensitivity'],
  })

  register({
    type: 'fin.options.dcf',
    label: 'DCF Valuation',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'fcf', label: 'FCF ($)' },
      { id: 'wacc', label: 'WACC' },
      { id: 'g', label: 'g (terminal)' },
      { id: 'n', label: 'n (years)' },
    ],
    defaultData: {
      blockType: 'fin.options.dcf',
      label: 'DCF Valuation',
      manualValues: { g: 0.03, n: 5 },
    },
    synonyms: ['DCF', 'discounted cash flow', 'valuation', 'WACC'],
  })
}
