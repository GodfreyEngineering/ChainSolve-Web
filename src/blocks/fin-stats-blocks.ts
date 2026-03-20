/**
 * fin-stats-blocks.ts — Finance & Statistics block pack (W11b).
 *
 * 40 blocks across 8 categories: TVM, Returns & Risk, Depreciation,
 * Descriptive Stats, Relationships, Combinatorics, Distributions, Utilities.
 *
 * Evaluation handled by Rust/WASM engine ops (fin.*, stats.*, prob.*, util.*).
 * Exports a registration function called by registry.ts.
 */

import type { BlockDef } from './types'

export function registerFinStatsBlocks(register: (def: BlockDef) => void): void {
  // ── Finance → TVM ──────────────────────────────────────────────────

  register({
    type: 'fin.tvm.simple_interest',
    label: 'Simple Interest',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Simple interest. I = P*r*t. Principal times rate times time.',
    synonyms: ['interest', 'P*r*t', 'basic interest'],
    tags: ['finance', 'interest'],
    inputs: [
      { id: 'P', label: 'P' },
      { id: 'r', label: 'r' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'fin.tvm.simple_interest', label: 'Simple Int.' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.compound_fv',
    label: 'Compound FV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Compound interest future value. FV = PV*(1+r/n)^(n*t).',
    synonyms: ['future value', 'compound interest', 'growth'],
    tags: ['finance', 'time value', 'interest'],
    inputs: [
      { id: 'PV', label: 'PV' },
      { id: 'r', label: 'r' },
      { id: 'n', label: 'n' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'fin.tvm.compound_fv', label: 'Compound FV' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.compound_pv',
    label: 'Compound PV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Compound interest present value. PV = FV/(1+r/n)^(n*t).',
    synonyms: ['present value', 'discount', 'NPV'],
    tags: ['finance', 'time value', 'interest'],
    inputs: [
      { id: 'FV', label: 'FV' },
      { id: 'r', label: 'r' },
      { id: 'n', label: 'n' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'fin.tvm.compound_pv', label: 'Compound PV' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.continuous_fv',
    label: 'Continuous FV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Continuous compounding future value. FV = PV*e^(r*t).',
    synonyms: ['continuous compounding', 'exponential growth', 'e^rt'],
    tags: ['finance', 'time value', 'interest'],
    inputs: [
      { id: 'PV', label: 'PV' },
      { id: 'r', label: 'r' },
      { id: 't', label: 't' },
    ],
    defaultData: { blockType: 'fin.tvm.continuous_fv', label: 'Continuous FV' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.annuity_pv',
    label: 'Annuity PV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Present value of an ordinary annuity. PV = PMT * (1 - (1+r)^-n) / r.',
    synonyms: ['annuity present value', 'loan value', 'pension value'],
    tags: ['finance', 'time value'],
    inputs: [
      { id: 'PMT', label: 'PMT' },
      { id: 'r', label: 'r' },
      { id: 'n', label: 'n' },
    ],
    defaultData: { blockType: 'fin.tvm.annuity_pv', label: 'Annuity PV' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.annuity_fv',
    label: 'Annuity FV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Future value of an ordinary annuity. FV = PMT * ((1+r)^n - 1) / r.',
    synonyms: ['annuity future value', 'savings plan', 'sinking fund'],
    tags: ['finance', 'time value'],
    inputs: [
      { id: 'PMT', label: 'PMT' },
      { id: 'r', label: 'r' },
      { id: 'n', label: 'n' },
    ],
    defaultData: { blockType: 'fin.tvm.annuity_fv', label: 'Annuity FV' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.annuity_pmt',
    label: 'Annuity PMT',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Payment amount for an annuity. PMT = PV * r / (1 - (1+r)^-n).',
    synonyms: ['loan payment', 'mortgage payment', 'instalment'],
    tags: ['finance', 'time value'],
    inputs: [
      { id: 'PV', label: 'PV' },
      { id: 'r', label: 'r' },
      { id: 'n', label: 'n' },
    ],
    defaultData: { blockType: 'fin.tvm.annuity_pmt', label: 'Annuity PMT' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.npv',
    label: 'NPV',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Net present value. Discounts a series of cash flows at rate r.',
    synonyms: ['net present value', 'discounted cash flow', 'DCF'],
    tags: ['finance', 'time value'],
    inputs: [
      { id: 'r', label: 'r' },
      { id: 'c', label: 'Count' },
      { id: 'cf0', label: 'CF0' },
      { id: 'cf1', label: 'CF1' },
      { id: 'cf2', label: 'CF2' },
      { id: 'cf3', label: 'CF3' },
      { id: 'cf4', label: 'CF4' },
      { id: 'cf5', label: 'CF5' },
    ],
    defaultData: { blockType: 'fin.tvm.npv', label: 'NPV', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.rule_of_72',
    label: 'Rule of 72',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description:
      'Rule of 72 approximation. Years to double = 72 / (r*100). Quick doubling-time estimate.',
    synonyms: ['doubling time', 'rule of 72'],
    tags: ['finance', 'heuristic'],
    inputs: [{ id: 'r', label: 'r (decimal)' }],
    defaultData: { blockType: 'fin.tvm.rule_of_72', label: 'Rule of 72' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.effective_rate',
    label: 'Effective Rate',
    category: 'finTvm',
    nodeKind: 'csOperation',
    description: 'Effective annual rate from nominal rate. EAR = (1+r/n)^n - 1.',
    synonyms: ['EAR', 'APY', 'annual percentage yield'],
    tags: ['finance', 'interest'],
    inputs: [
      { id: 'r', label: 'r (nominal)' },
      { id: 'n', label: 'n (periods)' },
    ],
    defaultData: { blockType: 'fin.tvm.effective_rate', label: 'Effective Rate' },
    proOnly: true,
  })

  // ── Finance → Returns & Risk ─────────────────────────────────────

  register({
    type: 'fin.returns.pct_return',
    label: '% Return',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Percentage return. (V1 - V0) / V0. Simple holding-period return.',
    synonyms: ['percentage return', 'ROI', 'holding period return'],
    tags: ['finance', 'returns'],
    inputs: [
      { id: 'v0', label: 'V₀' },
      { id: 'v1', label: 'V₁' },
    ],
    defaultData: { blockType: 'fin.returns.pct_return', label: '% Return' },
    proOnly: true,
  })

  register({
    type: 'fin.returns.log_return',
    label: 'Log Return',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Logarithmic return. ln(V1/V0). Continuously compounded return.',
    synonyms: ['logarithmic return', 'continuous return', 'ln return'],
    tags: ['finance', 'returns'],
    inputs: [
      { id: 'v0', label: 'V₀' },
      { id: 'v1', label: 'V₁' },
    ],
    defaultData: { blockType: 'fin.returns.log_return', label: 'Log Return' },
    proOnly: true,
  })

  register({
    type: 'fin.returns.cagr',
    label: 'CAGR',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Compound annual growth rate. CAGR = (V1/V0)^(1/t) - 1.',
    synonyms: ['compound growth rate', 'annualized return'],
    tags: ['finance', 'returns'],
    inputs: [
      { id: 'v0', label: 'V₀' },
      { id: 'v1', label: 'V₁' },
      { id: 't', label: 't (yrs)' },
    ],
    defaultData: { blockType: 'fin.returns.cagr', label: 'CAGR' },
    proOnly: true,
  })

  register({
    type: 'fin.returns.sharpe',
    label: 'Sharpe Ratio',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Sharpe ratio. (Return - Rf) / sigma. Risk-adjusted return measure.',
    synonyms: ['risk-adjusted return', 'reward-to-variability'],
    tags: ['finance', 'returns', 'risk'],
    inputs: [
      { id: 'ret', label: 'Return' },
      { id: 'rf', label: 'Rf' },
      { id: 'sigma', label: 'σ' },
    ],
    defaultData: { blockType: 'fin.returns.sharpe', label: 'Sharpe' },
    proOnly: true,
  })

  register({
    type: 'fin.returns.weighted_avg',
    label: 'Weighted Avg',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Weighted average. Sum of X_i * W_i / Sum of W_i. Up to 6 value-weight pairs.',
    synonyms: ['weighted mean', 'portfolio weight', 'weighted sum'],
    tags: ['finance', 'statistics'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
      { id: 'y1', label: 'W1' },
      { id: 'y2', label: 'W2' },
      { id: 'y3', label: 'W3' },
      { id: 'y4', label: 'W4' },
      { id: 'y5', label: 'W5' },
      { id: 'y6', label: 'W6' },
    ],
    defaultData: {
      blockType: 'fin.returns.weighted_avg',
      label: 'Weighted Avg',
      manualValues: { c: 3 },
    },
    proOnly: true,
  })

  register({
    type: 'fin.returns.portfolio_variance',
    label: 'Portfolio Var (2-asset)',
    category: 'finReturns',
    nodeKind: 'csOperation',
    description: 'Two-asset portfolio variance. Accounts for individual variances and correlation.',
    synonyms: ['portfolio risk', 'diversification', 'two-asset variance'],
    tags: ['finance', 'risk'],
    inputs: [
      { id: 'w1', label: 'w₁' },
      { id: 'w2', label: 'w₂' },
      { id: 's1', label: 'σ₁' },
      { id: 's2', label: 'σ₂' },
      { id: 'rho', label: 'ρ' },
    ],
    defaultData: { blockType: 'fin.returns.portfolio_variance', label: 'Portfolio Var' },
    proOnly: true,
  })

  // ── Finance → Depreciation ───────────────────────────────────────

  register({
    type: 'fin.depr.straight_line',
    label: 'SL Depreciation',
    category: 'finDepr',
    nodeKind: 'csOperation',
    description: 'Straight-line depreciation per period. (Cost - Salvage) / Life.',
    synonyms: ['depreciation', 'SLN', 'linear depreciation'],
    tags: ['finance', 'accounting'],
    inputs: [
      { id: 'cost', label: 'Cost' },
      { id: 'salvage', label: 'Salvage' },
      { id: 'life', label: 'Life' },
    ],
    defaultData: { blockType: 'fin.depr.straight_line', label: 'SL Depr.' },
    proOnly: true,
  })

  register({
    type: 'fin.depr.declining_balance',
    label: 'DB Depreciation',
    category: 'finDepr',
    nodeKind: 'csOperation',
    description: 'Declining-balance depreciation for a specific period.',
    synonyms: ['DDB', 'accelerated depreciation', 'reducing balance'],
    tags: ['finance', 'accounting'],
    inputs: [
      { id: 'cost', label: 'Cost' },
      { id: 'salvage', label: 'Salvage' },
      { id: 'life', label: 'Life' },
      { id: 'period', label: 'Period' },
    ],
    defaultData: { blockType: 'fin.depr.declining_balance', label: 'DB Depr.' },
    proOnly: true,
  })

  // ── Stats → Descriptive ──────────────────────────────────────────

  register({
    type: 'stats.desc.mean',
    label: 'Mean',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Arithmetic mean (average) of up to 6 values.',
    synonyms: ['average', 'arithmetic mean', 'avg'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.mean', label: 'Mean', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.median',
    label: 'Median',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Median (middle value) of up to 6 values.',
    synonyms: ['middle value', 'central tendency'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.median', label: 'Median', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.mode_approx',
    label: 'Mode (approx)',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Approximate mode (most frequent value) of up to 6 values.',
    synonyms: ['most frequent', 'modal', 'mode'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.mode_approx', label: 'Mode', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.range',
    label: 'Range',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Range (max minus min) of up to 6 values.',
    synonyms: ['spread', 'max minus min', 'data range'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.range', label: 'Range', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.variance',
    label: 'Variance',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Population variance of up to 6 values.',
    synonyms: ['var', 'spread squared'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.variance', label: 'Variance', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.stddev',
    label: 'Std Dev',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Population standard deviation of up to 6 values.',
    synonyms: ['standard deviation', 'sigma', 'spread', 'variability'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.stddev', label: 'Std Dev', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.sum',
    label: 'Sum',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Sum of up to 6 values.',
    synonyms: ['total', 'add all', 'summation'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.sum', label: 'Sum', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.geo_mean',
    label: 'Geometric Mean',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Geometric mean of up to 6 positive values. Used for growth rates.',
    synonyms: ['geometric average', 'growth mean', 'multiplicative mean'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
    ],
    defaultData: { blockType: 'stats.desc.geo_mean', label: 'Geo Mean', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.desc.zscore',
    label: 'Z-Score',
    category: 'statsDesc',
    nodeKind: 'csOperation',
    description: 'Z-score. (x - mu) / sigma. How many standard deviations from the mean.',
    synonyms: ['standard score', 'normal deviate', 'z value'],
    tags: ['statistics', 'descriptive'],
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'mu', label: 'μ' },
      { id: 'sigma', label: 'σ' },
    ],
    defaultData: { blockType: 'stats.desc.zscore', label: 'Z-Score' },
    proOnly: true,
  })

  // ── Stats → Relationships ────────────────────────────────────────

  register({
    type: 'stats.rel.covariance',
    label: 'Covariance',
    category: 'statsRel',
    nodeKind: 'csOperation',
    description: 'Sample covariance between two data series (up to 6 paired values).',
    synonyms: ['cov', 'joint variability', 'co-variance'],
    tags: ['statistics', 'relationships'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
      { id: 'y1', label: 'Y1' },
      { id: 'y2', label: 'Y2' },
      { id: 'y3', label: 'Y3' },
      { id: 'y4', label: 'Y4' },
      { id: 'y5', label: 'Y5' },
      { id: 'y6', label: 'Y6' },
    ],
    defaultData: { blockType: 'stats.rel.covariance', label: 'Covariance', manualValues: { c: 3 } },
    proOnly: true,
  })

  register({
    type: 'stats.rel.correlation',
    label: 'Correlation',
    category: 'statsRel',
    nodeKind: 'csOperation',
    description: 'Pearson correlation coefficient between two data series. Range: [-1, 1].',
    synonyms: ['pearson r', 'correlation coefficient', 'r value'],
    tags: ['statistics', 'correlation'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
      { id: 'y1', label: 'Y1' },
      { id: 'y2', label: 'Y2' },
      { id: 'y3', label: 'Y3' },
      { id: 'y4', label: 'Y4' },
      { id: 'y5', label: 'Y5' },
      { id: 'y6', label: 'Y6' },
    ],
    defaultData: {
      blockType: 'stats.rel.correlation',
      label: 'Correlation',
      manualValues: { c: 3 },
    },
    proOnly: true,
  })

  register({
    type: 'stats.rel.linreg_slope',
    label: 'LinReg Slope',
    category: 'statsRel',
    nodeKind: 'csOperation',
    description: 'Linear regression slope (m in y = mx + b). Best-fit line through paired data.',
    synonyms: ['slope', 'regression', 'trend', 'line fit'],
    tags: ['statistics', 'regression'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
      { id: 'y1', label: 'Y1' },
      { id: 'y2', label: 'Y2' },
      { id: 'y3', label: 'Y3' },
      { id: 'y4', label: 'Y4' },
      { id: 'y5', label: 'Y5' },
      { id: 'y6', label: 'Y6' },
    ],
    defaultData: {
      blockType: 'stats.rel.linreg_slope',
      label: 'LinReg Slope',
      manualValues: { c: 3 },
    },
    proOnly: true,
  })

  register({
    type: 'stats.rel.linreg_intercept',
    label: 'LinReg Intercept',
    category: 'statsRel',
    nodeKind: 'csOperation',
    description:
      'Linear regression intercept (b in y = mx + b). Y-value where the line crosses x = 0.',
    synonyms: ['intercept', 'y-intercept', 'regression constant'],
    tags: ['statistics', 'regression'],
    inputs: [
      { id: 'c', label: 'Count' },
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x4', label: 'X4' },
      { id: 'x5', label: 'X5' },
      { id: 'x6', label: 'X6' },
      { id: 'y1', label: 'Y1' },
      { id: 'y2', label: 'Y2' },
      { id: 'y3', label: 'Y3' },
      { id: 'y4', label: 'Y4' },
      { id: 'y5', label: 'Y5' },
      { id: 'y6', label: 'Y6' },
    ],
    defaultData: {
      blockType: 'stats.rel.linreg_intercept',
      label: 'LinReg Intercept',
      manualValues: { c: 3 },
    },
    proOnly: true,
  })

  // ── Probability → Combinatorics ──────────────────────────────────

  register({
    type: 'prob.comb.factorial',
    label: 'n!',
    category: 'probComb',
    nodeKind: 'csOperation',
    description: 'Factorial. n! = n * (n-1) * ... * 1. Number of permutations of n items.',
    synonyms: ['n!', 'factorial'],
    tags: ['probability', 'combinatorics'],
    inputs: [{ id: 'n', label: 'n' }],
    defaultData: { blockType: 'prob.comb.factorial', label: 'n!' },
    proOnly: true,
  })

  register({
    type: 'prob.comb.permutation',
    label: 'P(n,k)',
    category: 'probComb',
    nodeKind: 'csOperation',
    description: 'Permutations. P(n,k) = n! / (n-k)!. Ordered arrangements of k items from n.',
    synonyms: ['nPr', 'arrangement', 'ordering'],
    tags: ['probability', 'combinatorics'],
    inputs: [
      { id: 'n', label: 'n' },
      { id: 'k', label: 'k' },
    ],
    defaultData: { blockType: 'prob.comb.permutation', label: 'P(n,k)' },
    proOnly: true,
  })

  register({
    type: 'prob.comb.combination',
    label: 'C(n,k)',
    category: 'probComb',
    nodeKind: 'csOperation',
    description: 'Combinations. C(n,k) = n! / (k!(n-k)!). Unordered selections of k items from n.',
    synonyms: ['nCr', 'choose', 'binomial coefficient'],
    tags: ['probability', 'combinatorics'],
    inputs: [
      { id: 'n', label: 'n' },
      { id: 'k', label: 'k' },
    ],
    defaultData: { blockType: 'prob.comb.combination', label: 'C(n,k)' },
    proOnly: true,
  })

  // ── Probability → Distributions ──────────────────────────────────

  register({
    type: 'prob.dist.binomial_pmf',
    label: 'Binomial PMF',
    category: 'probDist',
    nodeKind: 'csOperation',
    description:
      'Binomial PMF. Probability of exactly k successes in n independent trials with success probability p.',
    synonyms: ['binomial probability', 'Bernoulli trials', 'discrete probability'],
    tags: ['probability', 'distribution'],
    inputs: [
      { id: 'n', label: 'n' },
      { id: 'k', label: 'k' },
      { id: 'p', label: 'p' },
    ],
    defaultData: { blockType: 'prob.dist.binomial_pmf', label: 'Binomial PMF' },
    proOnly: true,
  })

  register({
    type: 'prob.dist.poisson_pmf',
    label: 'Poisson PMF',
    category: 'probDist',
    nodeKind: 'csOperation',
    description: 'Poisson PMF. Probability of k events given average rate lambda.',
    synonyms: ['poisson probability', 'event count', 'arrival rate'],
    tags: ['probability', 'distribution'],
    inputs: [
      { id: 'k', label: 'k' },
      { id: 'lambda', label: 'λ' },
    ],
    defaultData: { blockType: 'prob.dist.poisson_pmf', label: 'Poisson PMF' },
    proOnly: true,
  })

  register({
    type: 'prob.dist.exponential_pdf',
    label: 'Exponential PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    description: 'Exponential PDF. Probability density for time between events at rate lambda.',
    synonyms: ['exponential density', 'waiting time', 'memoryless'],
    tags: ['probability', 'distribution'],
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'lambda', label: 'λ' },
    ],
    defaultData: { blockType: 'prob.dist.exponential_pdf', label: 'Exp PDF' },
    proOnly: true,
  })

  register({
    type: 'prob.dist.exponential_cdf',
    label: 'Exponential CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    description: 'Exponential CDF. Probability that event occurs by time x at rate lambda.',
    synonyms: ['exponential cumulative', 'cumulative exponential'],
    tags: ['probability', 'distribution'],
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'lambda', label: 'λ' },
    ],
    defaultData: { blockType: 'prob.dist.exponential_cdf', label: 'Exp CDF' },
    proOnly: true,
  })

  register({
    type: 'prob.dist.normal_pdf',
    label: 'Normal PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    description: 'Normal (Gaussian) PDF. Bell-curve density at x with mean mu and std dev sigma.',
    synonyms: ['gaussian', 'bell curve', 'normal density'],
    tags: ['probability', 'distribution'],
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'mu', label: 'μ' },
      { id: 'sigma', label: 'σ' },
    ],
    defaultData: { blockType: 'prob.dist.normal_pdf', label: 'Normal PDF' },
    proOnly: true,
  })

  // ── Utilities ────────────────────────────────────────────────────

  register({
    type: 'util.round.to_dp',
    label: 'Round to DP',
    category: 'utilCalc',
    nodeKind: 'csOperation',
    description: 'Rounds a value to a specified number of decimal places.',
    synonyms: ['decimal places', 'truncate decimals', 'precision'],
    tags: ['utility', 'rounding'],
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'dp', label: 'DP' },
    ],
    defaultData: { blockType: 'util.round.to_dp', label: 'Round to DP', manualValues: { dp: 2 } },
    proOnly: true,
  })

  register({
    type: 'util.pct.to_decimal',
    label: '% → Decimal',
    category: 'utilCalc',
    nodeKind: 'csOperation',
    description: 'Converts a percentage to a decimal. Output = input / 100.',
    synonyms: ['percent to decimal', 'divide by 100', 'percentage conversion'],
    tags: ['utility', 'conversion'],
    inputs: [{ id: 'pct', label: '%' }],
    defaultData: { blockType: 'util.pct.to_decimal', label: '% → Decimal' },
    proOnly: true,
  })
}
