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
    inputs: [{ id: 'r', label: 'r (decimal)' }],
    defaultData: { blockType: 'fin.tvm.rule_of_72', label: 'Rule of 72' },
    proOnly: true,
  })

  register({
    type: 'fin.tvm.effective_rate',
    label: 'Effective Rate',
    category: 'finTvm',
    nodeKind: 'csOperation',
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
    inputs: [{ id: 'n', label: 'n' }],
    defaultData: { blockType: 'prob.comb.factorial', label: 'n!' },
    proOnly: true,
  })

  register({
    type: 'prob.comb.permutation',
    label: 'P(n,k)',
    category: 'probComb',
    nodeKind: 'csOperation',
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
    inputs: [{ id: 'pct', label: '%' }],
    defaultData: { blockType: 'util.pct.to_decimal', label: '% → Decimal' },
    proOnly: true,
  })
}
