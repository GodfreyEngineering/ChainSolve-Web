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
    description:
      'Black-Scholes call option price: C = S·N(d₁) − K·e^(−rT)·N(d₂). European call option valuation.',
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
    description:
      'Black-Scholes put option price: P = K·e^(−rT)·N(−d₂) − S·N(−d₁). European put option valuation.',
    synonyms: ['Black-Scholes', 'put option', 'options pricing'],
    tags: ['finance', 'options'],
  })

  register({
    type: 'fin.options.bs_delta',
    label: 'BS Delta (Δ)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_delta', label: 'BS Delta' },
    description:
      'Black-Scholes delta (Δ): rate of change of option price with respect to spot price. N(d₁) for calls.',
    synonyms: ['delta', 'option delta', 'hedge ratio'],
    tags: ['finance', 'options', 'greeks'],
  })

  register({
    type: 'fin.options.bs_gamma',
    label: 'BS Gamma (Γ)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_gamma', label: 'BS Gamma' },
    description:
      'Black-Scholes gamma (Γ): second derivative of option price with respect to spot. Measures delta convexity.',
    synonyms: ['gamma', 'option gamma', 'convexity'],
    tags: ['finance', 'options', 'greeks'],
  })

  register({
    type: 'fin.options.bs_vega',
    label: 'BS Vega (ν)',
    category: 'finOptions',
    nodeKind: 'csOperation',
    inputs: BSInputs,
    defaultData: { blockType: 'fin.options.bs_vega', label: 'BS Vega' },
    description: 'Black-Scholes vega (ν): sensitivity of option price to implied volatility σ.',
    synonyms: ['vega', 'option vega', 'volatility sensitivity'],
    tags: ['finance', 'options', 'greeks'],
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
    description:
      'Kelly criterion: f* = (p·b − (1−p)) / b. Optimal fraction of capital to wager for maximum growth.',
    synonyms: ['Kelly criterion', 'optimal bet', 'position sizing'],
    tags: ['finance', 'risk'],
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
    description:
      'Historical Value at Risk: the loss threshold exceeded with probability (1 − confidence). Uses percentile of historical returns.',
    synonyms: ['VaR', 'value at risk', 'historical simulation'],
    tags: ['finance', 'risk'],
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
    description:
      'Conditional VaR (Expected Shortfall): average loss beyond the VaR threshold. More conservative risk measure than VaR.',
    synonyms: ['CVaR', 'expected shortfall', 'conditional VaR'],
    tags: ['finance', 'risk'],
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
    description:
      'Macaulay duration: weighted average time to receive bond cash flows. Measures interest rate sensitivity.',
    synonyms: ['Macaulay duration', 'bond duration', 'interest rate sensitivity'],
    tags: ['finance', 'bonds'],
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
    description:
      'Discounted cash flow valuation with terminal value. Discounts FCF at WACC, adds Gordon growth terminal value.',
    synonyms: ['DCF', 'discounted cash flow', 'valuation', 'WACC'],
    tags: ['finance', 'valuation'],
  })
}
