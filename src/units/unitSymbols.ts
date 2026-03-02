/**
 * unitSymbols.ts — Compact unit-id to display-symbol map.
 *
 * Only entries where id !== symbol are stored. For all other units the id
 * is returned as-is (it already equals the display symbol). This keeps the
 * module tiny so it can be included in the initial JS bundle.
 *
 * The full structured catalog (UNIT_DIMENSIONS) lives in unitCatalog.ts and
 * is lazy-loaded by UnitPicker when the dropdown opens.
 */

/* eslint-disable @typescript-eslint/naming-convention */
const S: Record<string, string> = {
  um: '\u00B5m',
  tonne: 't',
  us: '\u00B5s',
  degC: '\u00B0C',
  degF: '\u00B0F',
  torr: 'Torr',
  m2: 'm\u00B2',
  cm2: 'cm\u00B2',
  mm2: 'mm\u00B2',
  km2: 'km\u00B2',
  in2: 'in\u00B2',
  ft2: 'ft\u00B2',
  m3: 'm\u00B3',
  cm3: 'cm\u00B3',
  ft3: 'ft\u00B3',
  in3: 'in\u00B3',
  knot: 'kn',
  'm/s2': 'm/s\u00B2',
  'ft/s2': 'ft/s\u00B2',
  g0: 'g',
  'kg/m3': 'kg/m\u00B3',
  'g/cm3': 'g/cm\u00B3',
  'lb/ft3': 'lb/ft\u00B3',
  Pa_s: 'Pa\u00B7s',
  mPa_s: 'mPa\u00B7s',
  N_m: 'N\u00B7m',
  kN_m: 'kN\u00B7m',
  ft_lbf: 'ft\u00B7lbf',
  in_lbf: 'in\u00B7lbf',
  m4: 'm\u2074',
  cm4: 'cm\u2074',
  mm4: 'mm\u2074',
  in4: 'in\u2074',
  deg: '\u00B0',
  ohm: '\u03A9',
  kohm: 'k\u03A9',
  F_cap: 'F',
  uF: '\u00B5F',
  H_ind: 'H',
  pct: '%',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
}

/** Get the display symbol for a unit id. Returns the id itself as fallback. */
export function getUnitSymbol(id: string): string {
  return S[id] ?? id
}
