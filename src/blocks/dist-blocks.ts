/**
 * dist-blocks.ts — Extended statistical distribution block pack (SCI-11).
 *
 * Adds CDF/PDF variants missing from fin-stats-blocks.ts:
 * normal CDF, normal InvCDF, t PDF/CDF, chi2 PDF/CDF, F PDF/CDF,
 * Poisson CDF, binomial CDF, beta PDF/CDF, gamma PDF, Weibull PDF.
 *
 * Evaluation handled by Rust/WASM engine ops (prob.dist.* namespace).
 */

import type { BlockDef } from './types'

export function registerDistBlocks(register: (def: BlockDef) => void): void {
  // ── Normal distribution ─────────────────────────────────────────────

  register({
    type: 'prob.dist.normal_cdf',
    label: 'Normal CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'mu', label: 'μ' },
      { id: 'sigma', label: 'σ' },
    ],
    defaultData: {
      blockType: 'prob.dist.normal_cdf',
      label: 'Normal CDF',
      manualValues: { mu: 0, sigma: 1 },
    },
    synonyms: ['normal CDF', 'Gaussian CDF', 'Φ'],
    tags: ['statistics', 'distribution'],
  })

  register({
    type: 'prob.dist.normal_inv_cdf',
    label: 'Normal InvCDF (Probit)',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'p', label: 'p' },
      { id: 'mu', label: 'μ' },
      { id: 'sigma', label: 'σ' },
    ],
    defaultData: {
      blockType: 'prob.dist.normal_inv_cdf',
      label: 'Normal InvCDF',
      manualValues: { mu: 0, sigma: 1 },
    },
    synonyms: ['probit', 'normal quantile', 'inverse normal'],
  })

  // ── Student t distribution ──────────────────────────────────────────

  register({
    type: 'prob.dist.t_pdf',
    label: 't PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'df', label: 'df (ν)' },
    ],
    defaultData: { blockType: 'prob.dist.t_pdf', label: 't PDF' },
    synonyms: ["Student's t", 't distribution PDF'],
  })

  register({
    type: 'prob.dist.t_cdf',
    label: 't CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'df', label: 'df (ν)' },
    ],
    defaultData: { blockType: 'prob.dist.t_cdf', label: 't CDF' },
    synonyms: ["Student's t CDF", 't distribution CDF'],
  })

  // ── Chi-squared distribution ────────────────────────────────────────

  register({
    type: 'prob.dist.chi2_pdf',
    label: 'Chi² PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'k', label: 'k (df)' },
    ],
    defaultData: { blockType: 'prob.dist.chi2_pdf', label: 'Chi² PDF' },
    synonyms: ['chi squared', 'chi2 PDF'],
  })

  register({
    type: 'prob.dist.chi2_cdf',
    label: 'Chi² CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'k', label: 'k (df)' },
    ],
    defaultData: { blockType: 'prob.dist.chi2_cdf', label: 'Chi² CDF' },
    synonyms: ['chi squared CDF', 'chi2 CDF'],
  })

  // ── F distribution ──────────────────────────────────────────────────

  register({
    type: 'prob.dist.f_pdf',
    label: 'F PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'd1', label: 'd₁ (df₁)' },
      { id: 'd2', label: 'd₂ (df₂)' },
    ],
    defaultData: { blockType: 'prob.dist.f_pdf', label: 'F PDF' },
    synonyms: ['F distribution', 'Fisher PDF', 'ANOVA'],
  })

  register({
    type: 'prob.dist.f_cdf',
    label: 'F CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'd1', label: 'd₁ (df₁)' },
      { id: 'd2', label: 'd₂ (df₂)' },
    ],
    defaultData: { blockType: 'prob.dist.f_cdf', label: 'F CDF' },
    synonyms: ['F distribution CDF', 'Fisher CDF'],
  })

  // ── Discrete distribution CDFs ──────────────────────────────────────

  register({
    type: 'prob.dist.poisson_cdf',
    label: 'Poisson CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'k', label: 'k' },
      { id: 'lambda', label: 'λ' },
    ],
    defaultData: { blockType: 'prob.dist.poisson_cdf', label: 'Poisson CDF' },
    synonyms: ['Poisson CDF', 'cumulative Poisson'],
  })

  register({
    type: 'prob.dist.binomial_cdf',
    label: 'Binomial CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'k', label: 'k' },
      { id: 'n', label: 'n' },
      { id: 'p', label: 'p' },
    ],
    defaultData: { blockType: 'prob.dist.binomial_cdf', label: 'Binomial CDF' },
    synonyms: ['binomial CDF', 'cumulative binomial'],
  })

  // ── Continuous distributions ────────────────────────────────────────

  register({
    type: 'prob.dist.beta_pdf',
    label: 'Beta PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x ∈ [0,1]' },
      { id: 'a', label: 'α' },
      { id: 'b', label: 'β' },
    ],
    defaultData: { blockType: 'prob.dist.beta_pdf', label: 'Beta PDF' },
    synonyms: ['beta distribution PDF', 'beta PDF'],
  })

  register({
    type: 'prob.dist.beta_cdf',
    label: 'Beta CDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x ∈ [0,1]' },
      { id: 'a', label: 'α' },
      { id: 'b', label: 'β' },
    ],
    defaultData: { blockType: 'prob.dist.beta_cdf', label: 'Beta CDF' },
    synonyms: ['beta CDF', 'regularized incomplete beta'],
  })

  register({
    type: 'prob.dist.gamma_pdf',
    label: 'Gamma PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'alpha', label: 'α (shape)' },
      { id: 'beta', label: 'β (scale)' },
    ],
    defaultData: { blockType: 'prob.dist.gamma_pdf', label: 'Gamma PDF' },
    synonyms: ['gamma distribution', 'Erlang'],
  })

  register({
    type: 'prob.dist.weibull_pdf',
    label: 'Weibull PDF',
    category: 'probDist',
    nodeKind: 'csOperation',
    proOnly: true,
    inputs: [
      { id: 'x', label: 'x' },
      { id: 'k', label: 'k (shape)' },
      { id: 'lambda', label: 'λ (scale)' },
    ],
    defaultData: { blockType: 'prob.dist.weibull_pdf', label: 'Weibull PDF' },
    synonyms: ['Weibull', 'reliability', 'failure rate'],
  })
}
