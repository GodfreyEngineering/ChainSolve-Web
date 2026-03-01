/**
 * blockSearchMetadata.ts — E5-5: Synonyms and tags for block search quality.
 *
 * Maps opId → { synonyms, tags } for blocks where the label alone is
 * insufficient for discovery. Applied by applySearchMetadata() after all
 * block registrations complete.
 */

interface SearchMeta {
  synonyms?: string[]
  tags?: string[]
}

/** Synonyms and tags keyed by block type (opId). */
export const SEARCH_METADATA: Record<string, SearchMeta> = {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  number: { synonyms: ['value', 'input', 'literal'], tags: ['input'] },
  slider: { synonyms: ['range', 'dial', 'knob'], tags: ['input', 'interactive'] },
  variableSource: { synonyms: ['var', 'parameter', 'named'], tags: ['input', 'binding'] },

  // ── Core math ───────────────────────────────────────────────────────────────
  add: { synonyms: ['plus', 'sum', '+'], tags: ['arithmetic'] },
  subtract: { synonyms: ['minus', 'difference', '-'], tags: ['arithmetic'] },
  multiply: { synonyms: ['times', 'product', '*', 'x'], tags: ['arithmetic'] },
  divide: { synonyms: ['quotient', 'ratio', '/'], tags: ['arithmetic'] },
  power: { synonyms: ['exponent', '^', 'raise', 'pow'], tags: ['arithmetic'] },
  sqrt: { synonyms: ['root', 'square root'], tags: ['arithmetic'] },
  abs: { synonyms: ['absolute', 'magnitude'], tags: ['arithmetic'] },
  round: { synonyms: ['nearest', 'rounding'], tags: ['arithmetic'] },
  floor: { synonyms: ['round down', 'truncate'], tags: ['arithmetic'] },
  ceil: { synonyms: ['round up', 'ceiling'], tags: ['arithmetic'] },
  negate: { synonyms: ['negative', 'flip sign', 'unary minus'], tags: ['arithmetic'] },
  modulo: { synonyms: ['remainder', 'mod', '%'], tags: ['arithmetic'] },
  ln: { synonyms: ['natural log', 'loge'], tags: ['logarithm'] },
  log10: { synonyms: ['common log', 'log base 10'], tags: ['logarithm'] },
  log2: { synonyms: ['log base 2', 'binary log'], tags: ['logarithm'] },
  exp: { synonyms: ['e^x', 'exponential'], tags: ['exponential'] },
  min: { synonyms: ['minimum', 'smallest', 'least'], tags: ['comparison'] },
  max: { synonyms: ['maximum', 'largest', 'greatest'], tags: ['comparison'] },
  clamp: { synonyms: ['constrain', 'limit', 'bound'], tags: ['comparison'] },
  ifthenelse: { synonyms: ['conditional', 'if else', 'branch', 'switch'], tags: ['logic'] },

  // ── Trig ────────────────────────────────────────────────────────────────────
  sin: { synonyms: ['sine'], tags: ['trigonometry'] },
  cos: { synonyms: ['cosine'], tags: ['trigonometry'] },
  tan: { synonyms: ['tangent'], tags: ['trigonometry'] },
  asin: { synonyms: ['arcsine', 'inverse sine'], tags: ['trigonometry'] },
  acos: { synonyms: ['arccosine', 'inverse cosine'], tags: ['trigonometry'] },
  atan: { synonyms: ['arctangent', 'inverse tangent'], tags: ['trigonometry'] },
  atan2: { synonyms: ['angle', 'arctangent2'], tags: ['trigonometry'] },
  deg2rad: { synonyms: ['degrees to radians', 'to radians'], tags: ['conversion', 'trigonometry'] },
  rad2deg: { synonyms: ['radians to degrees', 'to degrees'], tags: ['conversion', 'trigonometry'] },

  // ── Logic ───────────────────────────────────────────────────────────────────
  equal: { synonyms: ['equals', '==', 'compare'], tags: ['logic', 'comparison'] },
  not_equal: { synonyms: ['!=', 'different'], tags: ['logic', 'comparison'] },
  greater: { synonyms: ['>', 'more than'], tags: ['logic', 'comparison'] },
  less: { synonyms: ['<', 'fewer than'], tags: ['logic', 'comparison'] },
  'logic.and': { synonyms: ['&&', 'both'], tags: ['logic', 'boolean'] },
  'logic.or': { synonyms: ['||', 'either'], tags: ['logic', 'boolean'] },

  // ── Engineering: mechanics ──────────────────────────────────────────────────
  'eng.mechanics.force_ma': {
    synonyms: ['force', 'newton', 'f=ma', 'acceleration'],
    tags: ['mechanics', 'dynamics', 'physics'],
  },
  'eng.mechanics.power_work_time': {
    synonyms: ['power', 'energy rate', 'watt'],
    tags: ['mechanics', 'energy', 'physics'],
  },
  'eng.mechanics.work_fd': {
    synonyms: ['work', 'energy', 'joule'],
    tags: ['mechanics', 'energy', 'physics'],
  },
  'eng.mechanics.kinetic_energy': {
    synonyms: ['KE', 'kinetic', 'motion energy'],
    tags: ['mechanics', 'energy', 'physics'],
  },
  'eng.mechanics.potential_energy_gravity': {
    synonyms: ['PE', 'potential', 'gravity energy', 'mgh'],
    tags: ['mechanics', 'energy', 'physics'],
  },
  'eng.mechanics.hookes_law': {
    synonyms: ['spring', 'hooke', 'elastic', 'stiffness'],
    tags: ['mechanics', 'elasticity', 'physics'],
  },

  // ── Engineering: sections ───────────────────────────────────────────────────
  'eng.sections.bending_stress': {
    synonyms: ['bending', 'beam stress', 'flexure'],
    tags: ['structures', 'beams', 'stress'],
  },
  'eng.sections.area_annulus': {
    synonyms: ['ring', 'hollow circle', 'annular'],
    tags: ['geometry', 'cross-section'],
  },
  'eng.sections.area_rect': {
    synonyms: ['rectangle', 'rectangular area'],
    tags: ['geometry', 'cross-section'],
  },

  // ── Engineering: fluids ─────────────────────────────────────────────────────
  'eng.fluids.reynolds': {
    synonyms: ['reynolds number', 'Re', 'flow regime', 'laminar', 'turbulent'],
    tags: ['fluids', 'flow', 'dimensionless'],
  },

  // ── Engineering: thermo ─────────────────────────────────────────────────────
  'eng.thermo.heat_transfer_conduction': {
    synonyms: ['conduction', 'fourier', 'thermal'],
    tags: ['heat transfer', 'thermodynamics'],
  },

  // ── Engineering: electrical ─────────────────────────────────────────────────
  'eng.electrical.ohms_law_v': {
    synonyms: ['ohm', 'voltage', 'V=IR'],
    tags: ['electrical', 'circuits'],
  },
  'eng.electrical.ohms_law_i': {
    synonyms: ['current', 'I=V/R', 'ampere'],
    tags: ['electrical', 'circuits'],
  },
  'eng.electrical.ohms_law_r': {
    synonyms: ['resistance', 'R=V/I', 'ohm'],
    tags: ['electrical', 'circuits'],
  },
  'eng.electrical.power_vi': {
    synonyms: ['electrical power', 'P=VI', 'watt'],
    tags: ['electrical', 'power'],
  },

  // ── Finance ─────────────────────────────────────────────────────────────────
  'fin.tvm.compound_fv': {
    synonyms: ['future value', 'compound interest', 'growth'],
    tags: ['finance', 'time value', 'interest'],
  },
  'fin.tvm.compound_pv': {
    synonyms: ['present value', 'discount', 'NPV'],
    tags: ['finance', 'time value', 'interest'],
  },
  'fin.tvm.rule_of_72': {
    synonyms: ['doubling time', 'rule of 72'],
    tags: ['finance', 'heuristic'],
  },
  'fin.returns.roi': {
    synonyms: ['return on investment', 'profit rate'],
    tags: ['finance', 'returns'],
  },
  'fin.returns.cagr': {
    synonyms: ['compound growth rate', 'annualized return'],
    tags: ['finance', 'returns'],
  },
  'fin.depr.straight_line': {
    synonyms: ['depreciation', 'SLN', 'linear depreciation'],
    tags: ['finance', 'accounting'],
  },

  // ── Statistics ──────────────────────────────────────────────────────────────
  'stats.desc.mean': {
    synonyms: ['average', 'arithmetic mean', 'avg'],
    tags: ['statistics', 'descriptive'],
  },
  'stats.desc.median': {
    synonyms: ['middle value', 'central tendency'],
    tags: ['statistics', 'descriptive'],
  },
  'stats.desc.mode': {
    synonyms: ['most frequent', 'modal'],
    tags: ['statistics', 'descriptive'],
  },
  'stats.desc.stddev': {
    synonyms: ['standard deviation', 'sigma', 'spread', 'variability'],
    tags: ['statistics', 'descriptive'],
  },
  'stats.desc.variance': {
    synonyms: ['var', 'spread squared'],
    tags: ['statistics', 'descriptive'],
  },
  'stats.rel.linreg_slope': {
    synonyms: ['slope', 'regression', 'trend', 'line fit'],
    tags: ['statistics', 'regression'],
  },
  'stats.rel.linreg_intercept': {
    synonyms: ['intercept', 'y-intercept', 'regression'],
    tags: ['statistics', 'regression'],
  },
  'stats.rel.pearson': {
    synonyms: ['correlation', 'r', 'pearson r'],
    tags: ['statistics', 'correlation'],
  },

  // ── Combinatorics ───────────────────────────────────────────────────────────
  'prob.comb.factorial': {
    synonyms: ['n!', 'factorial'],
    tags: ['probability', 'combinatorics'],
  },
  'prob.comb.permutation': {
    synonyms: ['nPr', 'arrangement', 'ordering'],
    tags: ['probability', 'combinatorics'],
  },
  'prob.comb.combination': {
    synonyms: ['nCr', 'choose', 'binomial coefficient'],
    tags: ['probability', 'combinatorics'],
  },

  // ── Output ──────────────────────────────────────────────────────────────────
  display: { synonyms: ['result', 'answer', 'show', 'output'], tags: ['output'] },
  probe: { synonyms: ['debug', 'inspect', 'watch'], tags: ['output', 'debug'] },
}
