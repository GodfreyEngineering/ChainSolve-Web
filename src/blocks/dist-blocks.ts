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
    description:
      'Cumulative distribution function of the normal (Gaussian) distribution. Returns P(X ≤ x) for N(μ, σ²).',
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
    description:
      'Inverse CDF (probit) of the normal distribution. Returns x such that P(X ≤ x) = p for N(μ, σ²).',
    synonyms: ['probit', 'normal quantile', 'inverse normal'],
    tags: ['statistics', 'distribution'],
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
    description:
      "Probability density function of Student's t-distribution with ν degrees of freedom.",
    synonyms: ["Student's t", 't distribution PDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      "Cumulative distribution function of Student's t-distribution. Returns P(T ≤ x) with ν degrees of freedom.",
    synonyms: ["Student's t CDF", 't distribution CDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Probability density function of the chi-squared distribution with k degrees of freedom.',
    synonyms: ['chi squared', 'chi2 PDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Cumulative distribution function of the chi-squared distribution. Returns P(X ≤ x) with k degrees of freedom.',
    synonyms: ['chi squared CDF', 'chi2 CDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Probability density function of the F-distribution with d₁ and d₂ degrees of freedom. Used in ANOVA.',
    synonyms: ['F distribution', 'Fisher PDF', 'ANOVA'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Cumulative distribution function of the F-distribution. Returns P(F ≤ x) with d₁ and d₂ degrees of freedom.',
    synonyms: ['F distribution CDF', 'Fisher CDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Cumulative distribution function of the Poisson distribution. Returns P(X ≤ k) for rate λ.',
    synonyms: ['Poisson CDF', 'cumulative Poisson'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Cumulative distribution function of the binomial distribution. Returns P(X ≤ k) for n trials with probability p.',
    synonyms: ['binomial CDF', 'cumulative binomial'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Probability density function of the beta distribution for x in [0,1] with shape parameters α and β.',
    synonyms: ['beta distribution PDF', 'beta PDF'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Cumulative distribution function of the beta distribution. Uses the regularized incomplete beta function.',
    synonyms: ['beta CDF', 'regularized incomplete beta'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Probability density function of the gamma distribution with shape α and scale β. Includes Erlang as a special case.',
    synonyms: ['gamma distribution', 'Erlang'],
    tags: ['statistics', 'distribution'],
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
    description:
      'Probability density function of the Weibull distribution with shape k and scale λ. Widely used in reliability and survival analysis.',
    synonyms: ['Weibull', 'reliability', 'failure rate'],
    tags: ['statistics', 'distribution', 'reliability'],
  })
}
