/**
 * materialCatalog.ts — Comprehensive engineering material database (H3-1).
 *
 * Each material has one entry per property (density, modulus, etc.).
 * The unified Material block reads from this catalog via getMaterialsCatalog().
 * Values are typical room-temperature (~20 C) unless noted.
 *
 * Sources: ASM Handbook, MatWeb, CES EduPack, NIST, engineering references.
 */

export interface MaterialCatalogEntry {
  /** Unique ID used as selectedMaterialId and Rust op dispatch key. */
  type: string
  /** Human-readable label shown in the dropdown. */
  label: string
  /** Category key for grouping (presetMaterials or presetFluids). */
  category: 'presetMaterials' | 'presetFluids'
  /** Subcategory for organizing within the dropdown. */
  subcategory: string
}

/** Full material entry for the multi-output Material Full block (Phase 10). */
export interface MaterialFullEntry {
  /** Material prefix, e.g. "preset.materials.steel_mild" */
  prefix: string
  /** Human-readable name, e.g. "Mild Steel (ASTM A36)" */
  name: string
  /** Solid or fluid */
  kind: 'solid' | 'fluid'
  /** Subcategory for grouping in the picker */
  subcategory: string
  /** All property values for this material */
  properties: Record<string, number>
}

// Helper to build entries for a material with multiple properties.
function mat(
  prefix: string,
  name: string,
  subcategory: string,
  props: Record<string, { label: string; value: number }>,
): MaterialCatalogEntry[] {
  return Object.entries(props).map(([key, { label }]) => ({
    type: `${prefix}.${key}`,
    label: `${name} ${label}`,
    category: 'presetMaterials' as const,
    subcategory,
  }))
}

function fluid(
  prefix: string,
  name: string,
  subcategory: string,
  props: Record<string, { label: string; value: number }>,
): MaterialCatalogEntry[] {
  return Object.entries(props).map(([key, { label }]) => ({
    type: `${prefix}.${key}`,
    label: `${name} ${label}`,
    category: 'presetFluids' as const,
    subcategory,
  }))
}

// ── Material value map (used by Rust dispatch) ──────────────────────────────

/** Map of material type → scalar value, used for Rust engine evaluation. */
export const MATERIAL_VALUES: Record<string, number> = {}

/** Full material data for multi-output Material Full block (Phase 10). */
const _fullEntries: MaterialFullEntry[] = []

function matWithValues(
  prefix: string,
  name: string,
  subcategory: string,
  props: Record<string, { label: string; value: number }>,
): MaterialCatalogEntry[] {
  const propValues: Record<string, number> = {}
  for (const [key, { value }] of Object.entries(props)) {
    MATERIAL_VALUES[`${prefix}.${key}`] = value
    propValues[key] = value
  }
  _fullEntries.push({ prefix, name, kind: 'solid', subcategory, properties: propValues })
  return mat(prefix, name, subcategory, props)
}

function fluidWithValues(
  prefix: string,
  name: string,
  subcategory: string,
  props: Record<string, { label: string; value: number }>,
): MaterialCatalogEntry[] {
  const propValues: Record<string, number> = {}
  for (const [key, { value }] of Object.entries(props)) {
    MATERIAL_VALUES[`${prefix}.${key}`] = value
    propValues[key] = value
  }
  _fullEntries.push({ prefix, name, kind: 'fluid', subcategory, properties: propValues })
  return fluid(prefix, name, subcategory, props)
}

// Property label shorthands
const rho = (v: number) => ({ label: '\u03C1 (' + v + ' kg/m\u00B3)', value: v })
const E = (v: number) => {
  const display = v >= 1e9 ? (v / 1e9).toString() + ' GPa' : (v / 1e6).toString() + ' MPa'
  return { label: 'E (' + display + ')', value: v }
}
const nu = (v: number) => ({ label: '\u03BD (' + v + ')', value: v })
const mu = (v: number) => {
  const display = v < 0.01 ? v.toExponential(3) + ' Pa\u00B7s' : v + ' Pa\u00B7s'
  return { label: '\u03BC (' + display + ')', value: v }
}
const k = (v: number) => ({ label: 'k (' + v + ' W/m\u00B7K)', value: v })
const cp = (v: number) => ({ label: 'cp (' + v + ' J/kg\u00B7K)', value: v })
const sigma_y = (v: number) => {
  const display = v >= 1e6 ? (v / 1e6).toString() + ' MPa' : v + ' Pa'
  return { label: '\u03C3y (' + display + ')', value: v }
}

// ── Structural Steels ───────────────────────────────────────────────────────

const STRUCTURAL_STEELS = [
  ...matWithValues('preset.materials.steel_mild', 'Mild Steel (ASTM A36)', 'Structural Steels', {
    rho: rho(7850),
    E: E(200e9),
    nu: nu(0.26),
    k: k(51.9),
    cp: cp(486),
    sigma_y: sigma_y(250e6),
  }),
  ...matWithValues('preset.materials.steel_a992', 'ASTM A992 Grade 50', 'Structural Steels', {
    rho: rho(7850),
    E: E(200e9),
    nu: nu(0.26),
    sigma_y: sigma_y(345e6),
  }),
  ...matWithValues('preset.materials.steel_4140', 'AISI 4140 (Cr-Mo)', 'Structural Steels', {
    rho: rho(7850),
    E: E(205e9),
    nu: nu(0.29),
    k: k(42.7),
    cp: cp(473),
    sigma_y: sigma_y(655e6),
  }),
  ...matWithValues('preset.materials.steel_4340', 'AISI 4340 (Ni-Cr-Mo)', 'Structural Steels', {
    rho: rho(7850),
    E: E(205e9),
    nu: nu(0.29),
    sigma_y: sigma_y(862e6),
  }),
]

// ── Stainless Steels ────────────────────────────────────────────────────────

const STAINLESS_STEELS = [
  ...matWithValues('preset.materials.ss304', '304 Stainless Steel', 'Stainless Steels', {
    rho: rho(8000),
    E: E(193e9),
    nu: nu(0.29),
    k: k(16.2),
    cp: cp(500),
    sigma_y: sigma_y(215e6),
  }),
  ...matWithValues('preset.materials.ss316', '316 Stainless Steel', 'Stainless Steels', {
    rho: rho(8000),
    E: E(193e9),
    nu: nu(0.3),
    k: k(16.3),
    cp: cp(500),
    sigma_y: sigma_y(205e6),
  }),
  ...matWithValues('preset.materials.ss410', '410 Stainless Steel', 'Stainless Steels', {
    rho: rho(7740),
    E: E(200e9),
    nu: nu(0.28),
    sigma_y: sigma_y(275e6),
  }),
  ...matWithValues('preset.materials.ss17_4ph', '17-4 PH Stainless', 'Stainless Steels', {
    rho: rho(7810),
    E: E(197e9),
    nu: nu(0.27),
    sigma_y: sigma_y(1170e6),
  }),
]

// ── Aluminium Alloys ────────────────────────────────────────────────────────

const ALUMINIUM_ALLOYS = [
  ...matWithValues('preset.materials.al_1100', 'Aluminium 1100-O', 'Aluminium Alloys', {
    rho: rho(2710),
    E: E(69e9),
    nu: nu(0.33),
    k: k(222),
    cp: cp(904),
    sigma_y: sigma_y(34e6),
  }),
  ...matWithValues('preset.materials.al_2024_t3', 'Aluminium 2024-T3', 'Aluminium Alloys', {
    rho: rho(2780),
    E: E(73.1e9),
    nu: nu(0.33),
    k: k(121),
    cp: cp(875),
    sigma_y: sigma_y(345e6),
  }),
  ...matWithValues('preset.materials.al_6061_t6', 'Aluminium 6061-T6', 'Aluminium Alloys', {
    rho: rho(2700),
    E: E(68.9e9),
    nu: nu(0.33),
    k: k(167),
    cp: cp(896),
    sigma_y: sigma_y(276e6),
  }),
  ...matWithValues('preset.materials.al_7075_t6', 'Aluminium 7075-T6', 'Aluminium Alloys', {
    rho: rho(2810),
    E: E(71.7e9),
    nu: nu(0.33),
    k: k(130),
    cp: cp(960),
    sigma_y: sigma_y(503e6),
  }),
  ...matWithValues('preset.materials.al_5052_h32', 'Aluminium 5052-H32', 'Aluminium Alloys', {
    rho: rho(2680),
    E: E(70.3e9),
    nu: nu(0.33),
    sigma_y: sigma_y(193e6),
  }),
]

// ── Titanium Alloys ─────────────────────────────────────────────────────────

const TITANIUM_ALLOYS = [
  ...matWithValues('preset.materials.ti_cp2', 'Ti CP Grade 2', 'Titanium Alloys', {
    rho: rho(4510),
    E: E(103e9),
    nu: nu(0.34),
    k: k(16.4),
    cp: cp(523),
    sigma_y: sigma_y(275e6),
  }),
  ...matWithValues('preset.materials.ti_6al4v', 'Ti-6Al-4V (Grade 5)', 'Titanium Alloys', {
    rho: rho(4430),
    E: E(114e9),
    nu: nu(0.34),
    k: k(6.7),
    cp: cp(526),
    sigma_y: sigma_y(880e6),
  }),
]

// ── Copper and Alloys ───────────────────────────────────────────────────────

const COPPER_ALLOYS = [
  ...matWithValues('preset.materials.copper_pure', 'Copper (C11000)', 'Copper and Alloys', {
    rho: rho(8960),
    E: E(117e9),
    nu: nu(0.34),
    k: k(398),
    cp: cp(385),
  }),
  ...matWithValues('preset.materials.brass_c260', 'Brass (C26000, 70-30)', 'Copper and Alloys', {
    rho: rho(8530),
    E: E(110e9),
    nu: nu(0.35),
    k: k(120),
    cp: cp(375),
  }),
  ...matWithValues('preset.materials.bronze_c93200', 'Bronze (C93200)', 'Copper and Alloys', {
    rho: rho(8930),
    E: E(100e9),
    nu: nu(0.34),
    k: k(59),
    cp: cp(376),
  }),
]

// ── Nickel Alloys ───────────────────────────────────────────────────────────

const NICKEL_ALLOYS = [
  ...matWithValues('preset.materials.ni_200', 'Nickel 200', 'Nickel Alloys', {
    rho: rho(8890),
    E: E(204e9),
    nu: nu(0.31),
    k: k(70),
    cp: cp(456),
  }),
  ...matWithValues('preset.materials.inconel_625', 'Inconel 625', 'Nickel Alloys', {
    rho: rho(8440),
    E: E(206e9),
    nu: nu(0.28),
    k: k(9.8),
    cp: cp(410),
    sigma_y: sigma_y(460e6),
  }),
  ...matWithValues('preset.materials.inconel_718', 'Inconel 718', 'Nickel Alloys', {
    rho: rho(8190),
    E: E(200e9),
    nu: nu(0.29),
    sigma_y: sigma_y(1034e6),
  }),
]

// ── Other Metals ────────────────────────────────────────────────────────────

const OTHER_METALS = [
  ...matWithValues('preset.materials.magnesium_az31', 'Magnesium AZ31B', 'Other Metals', {
    rho: rho(1770),
    E: E(45e9),
    nu: nu(0.35),
    k: k(96),
    cp: cp(1020),
    sigma_y: sigma_y(220e6),
  }),
  ...matWithValues('preset.materials.zinc_pure', 'Zinc (pure)', 'Other Metals', {
    rho: rho(7130),
    E: E(108e9),
    nu: nu(0.25),
    k: k(116),
    cp: cp(388),
  }),
  ...matWithValues('preset.materials.lead_pure', 'Lead (pure)', 'Other Metals', {
    rho: rho(11340),
    E: E(16e9),
    nu: nu(0.44),
    k: k(35.3),
    cp: cp(129),
  }),
  ...matWithValues('preset.materials.tungsten_pure', 'Tungsten (pure)', 'Other Metals', {
    rho: rho(19300),
    E: E(411e9),
    nu: nu(0.28),
    k: k(174),
    cp: cp(132),
  }),
  ...matWithValues('preset.materials.cast_iron_gray', 'Cast Iron (gray)', 'Other Metals', {
    rho: rho(7200),
    E: E(100e9),
    nu: nu(0.26),
    k: k(46),
    cp: cp(490),
  }),
]

// ── Polymers ────────────────────────────────────────────────────────────────

const POLYMERS = [
  ...matWithValues('preset.materials.abs', 'ABS', 'Polymers', {
    rho: rho(1050),
    E: E(2.3e9),
    nu: nu(0.35),
    k: k(0.17),
    cp: cp(1400),
    sigma_y: sigma_y(40e6),
  }),
  ...matWithValues('preset.materials.pla', 'PLA', 'Polymers', {
    rho: rho(1240),
    E: E(3.5e9),
    nu: nu(0.36),
    sigma_y: sigma_y(60e6),
  }),
  ...matWithValues('preset.materials.petg', 'PETG', 'Polymers', {
    rho: rho(1270),
    E: E(2.2e9),
    nu: nu(0.37),
    sigma_y: sigma_y(50e6),
  }),
  ...matWithValues('preset.materials.nylon_6', 'Nylon 6', 'Polymers', {
    rho: rho(1140),
    E: E(2.7e9),
    nu: nu(0.39),
    k: k(0.25),
    cp: cp(1700),
    sigma_y: sigma_y(70e6),
  }),
  ...matWithValues('preset.materials.polycarbonate', 'Polycarbonate', 'Polymers', {
    rho: rho(1200),
    E: E(2.4e9),
    nu: nu(0.37),
    k: k(0.2),
    cp: cp(1250),
    sigma_y: sigma_y(62e6),
  }),
  ...matWithValues('preset.materials.hdpe', 'HDPE', 'Polymers', {
    rho: rho(960),
    E: E(1.1e9),
    nu: nu(0.42),
    k: k(0.49),
    cp: cp(1900),
    sigma_y: sigma_y(26e6),
  }),
  ...matWithValues('preset.materials.pp', 'Polypropylene', 'Polymers', {
    rho: rho(905),
    E: E(1.5e9),
    nu: nu(0.4),
    k: k(0.22),
    cp: cp(1920),
    sigma_y: sigma_y(35e6),
  }),
  ...matWithValues('preset.materials.pvc_rigid', 'PVC (rigid)', 'Polymers', {
    rho: rho(1400),
    E: E(3.3e9),
    nu: nu(0.38),
    k: k(0.16),
    cp: cp(1000),
    sigma_y: sigma_y(45e6),
  }),
  ...matWithValues('preset.materials.ptfe', 'PTFE (Teflon)', 'Polymers', {
    rho: rho(2200),
    E: E(0.5e9),
    nu: nu(0.46),
    k: k(0.25),
    cp: cp(1050),
  }),
  ...matWithValues('preset.materials.epoxy', 'Epoxy resin', 'Polymers', {
    rho: rho(1200),
    E: E(3.5e9),
    nu: nu(0.35),
    k: k(0.2),
    cp: cp(1100),
  }),
  ...matWithValues('preset.materials.acetal', 'Acetal (POM)', 'Polymers', {
    rho: rho(1410),
    E: E(3.1e9),
    nu: nu(0.35),
    sigma_y: sigma_y(68e6),
  }),
]

// ── Ceramics and Glass ──────────────────────────────────────────────────────

const CERAMICS = [
  ...matWithValues('preset.materials.alumina', 'Alumina (Al2O3)', 'Ceramics and Glass', {
    rho: rho(3960),
    E: E(370e9),
    nu: nu(0.22),
    k: k(30),
    cp: cp(880),
  }),
  ...matWithValues('preset.materials.sic', 'Silicon Carbide (SiC)', 'Ceramics and Glass', {
    rho: rho(3100),
    E: E(410e9),
    nu: nu(0.14),
    k: k(120),
    cp: cp(750),
  }),
  ...matWithValues('preset.materials.zirconia', 'Zirconia (ZrO2)', 'Ceramics and Glass', {
    rho: rho(5680),
    E: E(200e9),
    nu: nu(0.31),
    k: k(2),
    cp: cp(460),
  }),
  ...matWithValues('preset.materials.glass_soda', 'Soda-lime glass', 'Ceramics and Glass', {
    rho: rho(2500),
    E: E(70e9),
    nu: nu(0.22),
    k: k(1.0),
    cp: cp(840),
  }),
  ...matWithValues('preset.materials.glass_boro', 'Borosilicate glass', 'Ceramics and Glass', {
    rho: rho(2230),
    E: E(63e9),
    nu: nu(0.2),
    k: k(1.14),
    cp: cp(830),
  }),
]

// ── Composites ──────────────────────────────────────────────────────────────

const COMPOSITES = [
  ...matWithValues('preset.materials.cfrp_ud', 'CFRP unidirectional', 'Composites', {
    rho: rho(1600),
    E: E(135e9),
    nu: nu(0.28),
    sigma_y: sigma_y(1500e6),
  }),
  ...matWithValues('preset.materials.gfrp', 'GFRP (E-glass/epoxy)', 'Composites', {
    rho: rho(2000),
    E: E(40e9),
    nu: nu(0.28),
    sigma_y: sigma_y(500e6),
  }),
  ...matWithValues('preset.materials.kevlar_epoxy', 'Kevlar 49/epoxy', 'Composites', {
    rho: rho(1380),
    E: E(76e9),
    nu: nu(0.34),
  }),
]

// ── Natural and Construction ────────────────────────────────────────────────

const NATURAL = [
  ...matWithValues('preset.materials.concrete_c30', 'Concrete C30/37', 'Natural and Construction', {
    rho: rho(2400),
    E: E(33e9),
    nu: nu(0.2),
    k: k(1.7),
    cp: cp(880),
  }),
  ...matWithValues('preset.materials.wood_oak', 'Oak (along grain)', 'Natural and Construction', {
    rho: rho(720),
    E: E(12.5e9),
    nu: nu(0.35),
    k: k(0.17),
    cp: cp(2380),
  }),
  ...matWithValues('preset.materials.wood_pine', 'Pine (along grain)', 'Natural and Construction', {
    rho: rho(510),
    E: E(9e9),
    nu: nu(0.35),
    k: k(0.12),
    cp: cp(2300),
  }),
  ...matWithValues('preset.materials.plywood', 'Plywood (birch)', 'Natural and Construction', {
    rho: rho(680),
    E: E(12.4e9),
    nu: nu(0.3),
  }),
  ...matWithValues('preset.materials.granite', 'Granite', 'Natural and Construction', {
    rho: rho(2700),
    E: E(50e9),
    nu: nu(0.25),
    k: k(2.5),
    cp: cp(790),
  }),
  ...matWithValues('preset.materials.marble', 'Marble', 'Natural and Construction', {
    rho: rho(2700),
    E: E(50e9),
    nu: nu(0.2),
  }),
  ...matWithValues(
    'preset.materials.rubber_natural',
    'Natural rubber',
    'Natural and Construction',
    {
      rho: rho(930),
      E: E(0.01e9),
      nu: nu(0.49),
      k: k(0.13),
      cp: cp(2010),
    },
  ),
]

// ── Fluids ──────────────────────────────────────────────────────────────────

const FLUIDS = [
  ...fluidWithValues('preset.fluids.water_20c', 'Water 20 C', 'Common Fluids', {
    rho: rho(998),
    mu: mu(1.002e-3),
    k: k(0.598),
    cp: cp(4182),
  }),
  ...fluidWithValues('preset.fluids.water_4c', 'Water 4 C', 'Common Fluids', {
    rho: rho(1000),
    mu: mu(1.568e-3),
  }),
  ...fluidWithValues('preset.fluids.water_100c', 'Water 100 C', 'Common Fluids', {
    rho: rho(958),
    mu: mu(0.282e-3),
  }),
  ...fluidWithValues('preset.fluids.seawater', 'Seawater (3.5%)', 'Common Fluids', {
    rho: rho(1025),
    mu: mu(1.08e-3),
  }),
  ...fluidWithValues('preset.fluids.air_20c', 'Air 20 C', 'Gases', {
    rho: rho(1.204),
    mu: mu(1.81e-5),
    k: k(0.0257),
    cp: cp(1005),
  }),
  ...fluidWithValues('preset.fluids.air_0c', 'Air 0 C', 'Gases', {
    rho: rho(1.293),
    mu: mu(1.71e-5),
  }),
  ...fluidWithValues('preset.fluids.nitrogen', 'Nitrogen (N2) 20 C', 'Gases', {
    rho: rho(1.165),
    mu: mu(1.76e-5),
    cp: cp(1040),
  }),
  ...fluidWithValues('preset.fluids.oxygen', 'Oxygen (O2) 20 C', 'Gases', {
    rho: rho(1.331),
    mu: mu(2.04e-5),
    cp: cp(918),
  }),
  ...fluidWithValues('preset.fluids.co2', 'CO2 20 C', 'Gases', {
    rho: rho(1.842),
    mu: mu(1.48e-5),
    cp: cp(844),
  }),
  ...fluidWithValues('preset.fluids.helium', 'Helium 20 C', 'Gases', {
    rho: rho(0.166),
    mu: mu(1.96e-5),
    cp: cp(5190),
  }),
  ...fluidWithValues('preset.fluids.hydrogen', 'Hydrogen (H2) 20 C', 'Gases', {
    rho: rho(0.084),
    mu: mu(0.88e-5),
    cp: cp(14300),
  }),
  ...fluidWithValues('preset.fluids.gasoline', 'Gasoline', 'Fuels and Oils', {
    rho: rho(745),
    mu: mu(6e-4),
  }),
  ...fluidWithValues('preset.fluids.diesel', 'Diesel', 'Fuels and Oils', {
    rho: rho(832),
    mu: mu(3.5e-3),
  }),
  ...fluidWithValues('preset.fluids.kerosene', 'Kerosene (Jet-A)', 'Fuels and Oils', {
    rho: rho(810),
    mu: mu(1.6e-3),
    cp: cp(2010),
  }),
  ...fluidWithValues('preset.fluids.engine_oil_sae30', 'Engine oil SAE 30', 'Fuels and Oils', {
    rho: rho(890),
    mu: mu(0.29),
    k: k(0.145),
    cp: cp(1900),
  }),
  ...fluidWithValues('preset.fluids.hydraulic_oil', 'Hydraulic oil ISO 46', 'Fuels and Oils', {
    rho: rho(870),
    mu: mu(0.046),
  }),
  ...fluidWithValues('preset.fluids.ethanol', 'Ethanol', 'Alcohols and Solvents', {
    rho: rho(789),
    mu: mu(1.2e-3),
    k: k(0.171),
    cp: cp(2440),
  }),
  ...fluidWithValues('preset.fluids.methanol', 'Methanol', 'Alcohols and Solvents', {
    rho: rho(791),
    mu: mu(5.9e-4),
    cp: cp(2530),
  }),
  ...fluidWithValues('preset.fluids.acetone', 'Acetone', 'Alcohols and Solvents', {
    rho: rho(784),
    mu: mu(3.1e-4),
  }),
  ...fluidWithValues('preset.fluids.glycerol', 'Glycerol', 'Alcohols and Solvents', {
    rho: rho(1261),
    mu: mu(1.5),
    cp: cp(2430),
  }),
  ...fluidWithValues('preset.fluids.ethylene_glycol', 'Ethylene glycol', 'Alcohols and Solvents', {
    rho: rho(1113),
    mu: mu(0.0161),
    k: k(0.258),
    cp: cp(2360),
  }),
  ...fluidWithValues('preset.fluids.mercury', 'Mercury', 'Liquid Metals', {
    rho: rho(13534),
    mu: mu(1.55e-3),
    k: k(8.54),
    cp: cp(139),
  }),
]

// ── Legacy aliases (backward compat for pre-H3-1 projects) ─────────────────

// Map old preset IDs to new ones so the bridge can resolve them.
MATERIAL_VALUES['preset.materials.steel_rho'] = 7850
MATERIAL_VALUES['preset.materials.steel_E'] = 200e9
MATERIAL_VALUES['preset.materials.steel_nu'] = 0.3
MATERIAL_VALUES['preset.materials.al_rho'] = 2700
MATERIAL_VALUES['preset.materials.al_E'] = 69e9
MATERIAL_VALUES['preset.materials.al_nu'] = 0.33
MATERIAL_VALUES['preset.materials.ti_rho'] = 4430
MATERIAL_VALUES['preset.materials.ti_E'] = 116e9
MATERIAL_VALUES['preset.materials.ti_nu'] = 0.34
MATERIAL_VALUES['preset.fluids.water_rho_20c'] = 998
MATERIAL_VALUES['preset.fluids.water_mu_20c'] = 1.002e-3
MATERIAL_VALUES['preset.fluids.gasoline_rho'] = 745
MATERIAL_VALUES['preset.fluids.diesel_rho'] = 832

// ── Export ───────────────────────────────────────────────────────────────────

export const MATERIAL_CATALOG: MaterialCatalogEntry[] = [
  ...STRUCTURAL_STEELS,
  ...STAINLESS_STEELS,
  ...ALUMINIUM_ALLOYS,
  ...TITANIUM_ALLOYS,
  ...COPPER_ALLOYS,
  ...NICKEL_ALLOYS,
  ...OTHER_METALS,
  ...POLYMERS,
  ...CERAMICS,
  ...COMPOSITES,
  ...NATURAL,
  ...FLUIDS,
]

/** Full material data for multi-output Material Full block (Phase 10). */
export const MATERIAL_FULL_DATA: readonly MaterialFullEntry[] = _fullEntries

/** Property metadata for display in MaterialNode. */
export const PROPERTY_META: Record<string, { label: string; unit: string }> = {
  rho: { label: 'ρ (Density)', unit: 'kg/m³' },
  E: { label: "E (Young's Modulus)", unit: 'Pa' },
  nu: { label: "ν (Poisson's Ratio)", unit: '—' },
  k: { label: 'k (Thermal Cond.)', unit: 'W/m·K' },
  cp: { label: 'cp (Specific Heat)', unit: 'J/kg·K' },
  sigma_y: { label: 'σy (Yield Strength)', unit: 'Pa' },
  mu: { label: 'μ (Viscosity)', unit: 'Pa·s' },
}

/** Canonical order for property output handles. */
export const PROPERTY_ORDER = ['rho', 'E', 'nu', 'k', 'cp', 'sigma_y', 'mu'] as const
