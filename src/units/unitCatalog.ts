/**
 * unitCatalog.ts — Unit definitions for the H1-1 units system.
 *
 * Units are organised by physical dimension. Each unit has a unique ID
 * (ASCII-safe string) and a display symbol (may contain Unicode).
 * The catalog covers common engineering, physics, and general-purpose units.
 */

export interface UnitDef {
  /** Unique ASCII-safe identifier persisted in node data. */
  id: string
  /** Display symbol shown in the UI (may contain Unicode). */
  symbol: string
}

export interface UnitDimension {
  id: string
  /** i18n key suffix — actual label resolved at render time. */
  labelKey: string
  units: UnitDef[]
}

/** Master catalog of all supported unit dimensions and their units. */
export const UNIT_DIMENSIONS: readonly UnitDimension[] = [
  {
    id: 'length',
    labelKey: 'units.dim.length',
    units: [
      { id: 'm', symbol: 'm' },
      { id: 'cm', symbol: 'cm' },
      { id: 'mm', symbol: 'mm' },
      { id: 'um', symbol: '\u00B5m' },
      { id: 'km', symbol: 'km' },
      { id: 'in', symbol: 'in' },
      { id: 'ft', symbol: 'ft' },
      { id: 'yd', symbol: 'yd' },
      { id: 'mi', symbol: 'mi' },
    ],
  },
  {
    id: 'mass',
    labelKey: 'units.dim.mass',
    units: [
      { id: 'kg', symbol: 'kg' },
      { id: 'g', symbol: 'g' },
      { id: 'mg', symbol: 'mg' },
      { id: 'lb', symbol: 'lb' },
      { id: 'oz', symbol: 'oz' },
      { id: 'tonne', symbol: 't' },
    ],
  },
  {
    id: 'time',
    labelKey: 'units.dim.time',
    units: [
      { id: 's', symbol: 's' },
      { id: 'ms', symbol: 'ms' },
      { id: 'us', symbol: '\u00B5s' },
      { id: 'min', symbol: 'min' },
      { id: 'h', symbol: 'h' },
      { id: 'day', symbol: 'day' },
    ],
  },
  {
    id: 'temperature',
    labelKey: 'units.dim.temperature',
    units: [
      { id: 'K', symbol: 'K' },
      { id: 'degC', symbol: '\u00B0C' },
      { id: 'degF', symbol: '\u00B0F' },
    ],
  },
  {
    id: 'force',
    labelKey: 'units.dim.force',
    units: [
      { id: 'N', symbol: 'N' },
      { id: 'kN', symbol: 'kN' },
      { id: 'MN', symbol: 'MN' },
      { id: 'lbf', symbol: 'lbf' },
      { id: 'kip', symbol: 'kip' },
    ],
  },
  {
    id: 'pressure',
    labelKey: 'units.dim.pressure',
    units: [
      { id: 'Pa', symbol: 'Pa' },
      { id: 'kPa', symbol: 'kPa' },
      { id: 'MPa', symbol: 'MPa' },
      { id: 'GPa', symbol: 'GPa' },
      { id: 'bar', symbol: 'bar' },
      { id: 'atm', symbol: 'atm' },
      { id: 'psi', symbol: 'psi' },
      { id: 'ksi', symbol: 'ksi' },
      { id: 'torr', symbol: 'Torr' },
    ],
  },
  {
    id: 'energy',
    labelKey: 'units.dim.energy',
    units: [
      { id: 'J', symbol: 'J' },
      { id: 'kJ', symbol: 'kJ' },
      { id: 'MJ', symbol: 'MJ' },
      { id: 'cal', symbol: 'cal' },
      { id: 'kcal', symbol: 'kcal' },
      { id: 'BTU', symbol: 'BTU' },
      { id: 'eV', symbol: 'eV' },
      { id: 'kWh', symbol: 'kWh' },
    ],
  },
  {
    id: 'power',
    labelKey: 'units.dim.power',
    units: [
      { id: 'W', symbol: 'W' },
      { id: 'kW', symbol: 'kW' },
      { id: 'MW', symbol: 'MW' },
      { id: 'hp', symbol: 'hp' },
    ],
  },
  {
    id: 'area',
    labelKey: 'units.dim.area',
    units: [
      { id: 'm2', symbol: 'm\u00B2' },
      { id: 'cm2', symbol: 'cm\u00B2' },
      { id: 'mm2', symbol: 'mm\u00B2' },
      { id: 'km2', symbol: 'km\u00B2' },
      { id: 'in2', symbol: 'in\u00B2' },
      { id: 'ft2', symbol: 'ft\u00B2' },
      { id: 'acre', symbol: 'acre' },
      { id: 'ha', symbol: 'ha' },
    ],
  },
  {
    id: 'volume',
    labelKey: 'units.dim.volume',
    units: [
      { id: 'm3', symbol: 'm\u00B3' },
      { id: 'cm3', symbol: 'cm\u00B3' },
      { id: 'L', symbol: 'L' },
      { id: 'mL', symbol: 'mL' },
      { id: 'gal', symbol: 'gal' },
      { id: 'ft3', symbol: 'ft\u00B3' },
      { id: 'in3', symbol: 'in\u00B3' },
    ],
  },
  {
    id: 'velocity',
    labelKey: 'units.dim.velocity',
    units: [
      { id: 'm/s', symbol: 'm/s' },
      { id: 'km/h', symbol: 'km/h' },
      { id: 'mph', symbol: 'mph' },
      { id: 'ft/s', symbol: 'ft/s' },
      { id: 'knot', symbol: 'kn' },
    ],
  },
  {
    id: 'acceleration',
    labelKey: 'units.dim.acceleration',
    units: [
      { id: 'm/s2', symbol: 'm/s\u00B2' },
      { id: 'ft/s2', symbol: 'ft/s\u00B2' },
      { id: 'g0', symbol: 'g' },
    ],
  },
  {
    id: 'density',
    labelKey: 'units.dim.density',
    units: [
      { id: 'kg/m3', symbol: 'kg/m\u00B3' },
      { id: 'g/cm3', symbol: 'g/cm\u00B3' },
      { id: 'lb/ft3', symbol: 'lb/ft\u00B3' },
    ],
  },
  {
    id: 'viscosity',
    labelKey: 'units.dim.viscosity',
    units: [
      { id: 'Pa_s', symbol: 'Pa\u00B7s' },
      { id: 'mPa_s', symbol: 'mPa\u00B7s' },
    ],
  },
  {
    id: 'torque',
    labelKey: 'units.dim.torque',
    units: [
      { id: 'N_m', symbol: 'N\u00B7m' },
      { id: 'kN_m', symbol: 'kN\u00B7m' },
      { id: 'ft_lbf', symbol: 'ft\u00B7lbf' },
      { id: 'in_lbf', symbol: 'in\u00B7lbf' },
    ],
  },
  {
    id: 'momentOfInertia',
    labelKey: 'units.dim.momentOfInertia',
    units: [
      { id: 'm4', symbol: 'm\u2074' },
      { id: 'cm4', symbol: 'cm\u2074' },
      { id: 'mm4', symbol: 'mm\u2074' },
      { id: 'in4', symbol: 'in\u2074' },
    ],
  },
  {
    id: 'angle',
    labelKey: 'units.dim.angle',
    units: [
      { id: 'rad', symbol: 'rad' },
      { id: 'deg', symbol: '\u00B0' },
      { id: 'rev', symbol: 'rev' },
    ],
  },
  {
    id: 'frequency',
    labelKey: 'units.dim.frequency',
    units: [
      { id: 'Hz', symbol: 'Hz' },
      { id: 'kHz', symbol: 'kHz' },
      { id: 'MHz', symbol: 'MHz' },
      { id: 'GHz', symbol: 'GHz' },
      { id: 'rpm', symbol: 'rpm' },
    ],
  },
  {
    id: 'electrical',
    labelKey: 'units.dim.electrical',
    units: [
      { id: 'V', symbol: 'V' },
      { id: 'mV', symbol: 'mV' },
      { id: 'kV', symbol: 'kV' },
      { id: 'A', symbol: 'A' },
      { id: 'mA', symbol: 'mA' },
      { id: 'ohm', symbol: '\u03A9' },
      { id: 'kohm', symbol: 'k\u03A9' },
      { id: 'F_cap', symbol: 'F' },
      { id: 'uF', symbol: '\u00B5F' },
      { id: 'nF', symbol: 'nF' },
      { id: 'pF', symbol: 'pF' },
      { id: 'H_ind', symbol: 'H' },
      { id: 'mH', symbol: 'mH' },
    ],
  },
  {
    id: 'ratio',
    labelKey: 'units.dim.ratio',
    units: [
      { id: 'pct', symbol: '%' },
      { id: 'ppm', symbol: 'ppm' },
    ],
  },
  {
    id: 'currency',
    labelKey: 'units.dim.currency',
    units: [
      { id: 'USD', symbol: '$' },
      { id: 'EUR', symbol: '\u20AC' },
      { id: 'GBP', symbol: '\u00A3' },
      { id: 'JPY', symbol: '\u00A5' },
    ],
  },
] as const

// ── Lookup helpers (used by tests) ──────────────────────────────────────────

/** Flat array of all unit IDs. */
export function allUnitIds(): string[] {
  return UNIT_DIMENSIONS.flatMap((dim) => dim.units.map((u) => u.id))
}
