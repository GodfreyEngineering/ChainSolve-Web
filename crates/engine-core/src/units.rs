//! Units tracking system: SI, CGS, and imperial unit systems.
//!
//! Each unit is described by its dimension vector \[M, L, T, I, Θ, N, J\]
//! (mass, length, time, electric current, temperature, amount, luminous intensity)
//! and a scale factor relative to the corresponding SI base unit.
//!
//! Reference: NIST SP 811 (2008) "Guide for the Use of the International System of Units"

use std::collections::HashMap;

/// SI base dimensions: \[M, L, T, I, Θ, N, J\].
/// Exponents are stored as i8 to allow dimensions like m/s (L=1, T=-1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Dimension {
    pub mass:        i8,  // M  — kilograms
    pub length:      i8,  // L  — metres
    pub time:        i8,  // T  — seconds
    pub current:     i8,  // I  — amperes
    pub temperature: i8,  // Θ  — kelvin
    pub amount:      i8,  // N  — moles
    pub luminosity:  i8,  // J  — candelas
}

impl Dimension {
    pub const DIMENSIONLESS: Dimension = Dimension { mass: 0, length: 0, time: 0, current: 0, temperature: 0, amount: 0, luminosity: 0 };

    pub fn is_dimensionless(&self) -> bool { *self == Self::DIMENSIONLESS }

    /// Human-readable dimension string, e.g. "M¹L¹T⁻²".
    pub fn display(&self) -> String {
        let names = [("M", self.mass), ("L", self.length), ("T", self.time),
                     ("I", self.current), ("Θ", self.temperature), ("N", self.amount), ("J", self.luminosity)];
        let parts: Vec<String> = names.iter().filter_map(|(sym, exp)| {
            if *exp == 0 { None }
            else if *exp == 1 { Some(sym.to_string()) }
            else { Some(format!("{sym}{exp}")) }
        }).collect();
        if parts.is_empty() { "1".to_string() } else { parts.join("⋅") }
    }
}

/// A unit definition: dimension + scale factor (value in SI base units per 1 unit of this).
/// For temperature units with offsets, `offset` is added before scaling (Celsius/Fahrenheit).
#[derive(Debug, Clone)]
pub struct UnitDef {
    pub name:       &'static str,
    pub symbol:     &'static str,
    pub dimension:  Dimension,
    pub scale:      f64,    // 1 [this unit] = scale [SI base unit]
    pub offset:     f64,    // for temperature offsets (add to value before scaling)
    pub system:     UnitSystem,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnitSystem { SI, CGS, Imperial, Metric, Other }

macro_rules! dim {
    ($m:expr, $l:expr, $t:expr, $i:expr, $th:expr, $n:expr, $j:expr) => {
        Dimension { mass: $m, length: $l, time: $t, current: $i,
                    temperature: $th, amount: $n, luminosity: $j }
    };
}

const D_MASS:    Dimension = dim!(1, 0, 0, 0, 0, 0, 0);
const D_LENGTH:  Dimension = dim!(0, 1, 0, 0, 0, 0, 0);
const D_TIME:    Dimension = dim!(0, 0, 1, 0, 0, 0, 0);
const D_CURRENT: Dimension = dim!(0, 0, 0, 1, 0, 0, 0);
const D_TEMP:    Dimension = dim!(0, 0, 0, 0, 1, 0, 0);
const D_AMOUNT:  Dimension = dim!(0, 0, 0, 0, 0, 1, 0);
const D_FORCE:   Dimension = dim!(1, 1,-2, 0, 0, 0, 0);
const D_PRESSURE:Dimension = dim!(1,-1,-2, 0, 0, 0, 0);
const D_ENERGY:  Dimension = dim!(1, 2,-2, 0, 0, 0, 0);
const D_POWER:   Dimension = dim!(1, 2,-3, 0, 0, 0, 0);
const D_VELOCITY:Dimension = dim!(0, 1,-1, 0, 0, 0, 0);
const D_ACCEL:   Dimension = dim!(0, 1,-2, 0, 0, 0, 0);
const D_AREA:    Dimension = dim!(0, 2, 0, 0, 0, 0, 0);
const D_VOLUME:  Dimension = dim!(0, 3, 0, 0, 0, 0, 0);
const D_DENSITY: Dimension = dim!(1,-3, 0, 0, 0, 0, 0);
const D_VOLTAGE: Dimension = dim!(1, 2,-3,-1, 0, 0, 0);
const D_RESIST:  Dimension = dim!(1, 2,-3,-2, 0, 0, 0);
const D_CHARGE:  Dimension = dim!(0, 0, 1, 1, 0, 0, 0);
const D_CAPAC:   Dimension = dim!(-1,-2,4,2, 0, 0, 0);
const D_INDUCT:  Dimension = dim!(1, 2,-2,-2, 0, 0, 0);
const D_FREQ:    Dimension = dim!(0, 0,-1, 0, 0, 0, 0);
const D_ANGLE:   Dimension = Dimension::DIMENSIONLESS;
const D_VISC_DYN:Dimension = dim!(1,-1,-1, 0, 0, 0, 0); // Pa⋅s
const D_VISC_KIN:Dimension = dim!(0, 2,-1, 0, 0, 0, 0); // m²/s
const D_THERM_COND: Dimension = dim!(1, 1,-3, 0,-1, 0, 0); // W/(m⋅K)
const D_HEAT_CAP:   Dimension = dim!(0, 2,-2, 0,-1, 0, 0); // J/(kg⋅K)

fn u(name: &'static str, symbol: &'static str, dim: Dimension, scale: f64, system: UnitSystem) -> UnitDef {
    UnitDef { name, symbol, dimension: dim, scale, offset: 0.0, system }
}

fn u_offset(name: &'static str, symbol: &'static str, dim: Dimension, scale: f64, offset: f64, system: UnitSystem) -> UnitDef {
    UnitDef { name, symbol, dimension: dim, scale, offset, system }
}

/// The global unit database (symbol → UnitDef).
pub fn unit_database() -> HashMap<&'static str, UnitDef> {
    let mut db = HashMap::new();
    let mut add = |def: UnitDef| { db.insert(def.symbol, def); };

    // ── Mass ─────────────────────────────────────────────────────────────────
    add(u("kilogram",  "kg",   D_MASS, 1.0,              UnitSystem::SI));
    add(u("gram",      "g",    D_MASS, 1e-3,             UnitSystem::SI));
    add(u("milligram", "mg",   D_MASS, 1e-6,             UnitSystem::SI));
    add(u("tonne",     "t",    D_MASS, 1e3,              UnitSystem::Metric));
    add(u("pound",     "lb",   D_MASS, 0.453_592_37,     UnitSystem::Imperial));
    add(u("ounce",     "oz",   D_MASS, 0.028_349_523,    UnitSystem::Imperial));
    add(u("slug",      "slug", D_MASS, 14.593_903,       UnitSystem::Imperial));
    add(u("tonne (US short)", "ton", D_MASS, 907.184_74, UnitSystem::Imperial));

    // ── Length ───────────────────────────────────────────────────────────────
    add(u("metre",       "m",   D_LENGTH, 1.0,              UnitSystem::SI));
    add(u("kilometre",   "km",  D_LENGTH, 1e3,              UnitSystem::SI));
    add(u("centimetre",  "cm",  D_LENGTH, 1e-2,             UnitSystem::SI));
    add(u("millimetre",  "mm",  D_LENGTH, 1e-3,             UnitSystem::SI));
    add(u("micrometre",  "μm",  D_LENGTH, 1e-6,             UnitSystem::SI));
    add(u("nanometre",   "nm",  D_LENGTH, 1e-9,             UnitSystem::SI));
    add(u("foot",        "ft",  D_LENGTH, 0.3048,           UnitSystem::Imperial));
    add(u("inch",        "in",  D_LENGTH, 0.0254,           UnitSystem::Imperial));
    add(u("yard",        "yd",  D_LENGTH, 0.9144,           UnitSystem::Imperial));
    add(u("mile",        "mi",  D_LENGTH, 1609.344,         UnitSystem::Imperial));
    add(u("nautical mile","nmi",D_LENGTH, 1852.0,           UnitSystem::Other));
    add(u("astronomical unit","au",D_LENGTH,1.495_978_707e11,UnitSystem::Other));

    // ── Time ─────────────────────────────────────────────────────────────────
    add(u("second",  "s",   D_TIME, 1.0,    UnitSystem::SI));
    add(u("minute",  "min", D_TIME, 60.0,   UnitSystem::Other));
    add(u("hour",    "h",   D_TIME, 3600.0, UnitSystem::Other));
    add(u("day",     "d",   D_TIME, 86400.0,UnitSystem::Other));
    add(u("millisecond","ms",D_TIME,1e-3,   UnitSystem::SI));
    add(u("microsecond","μs",D_TIME,1e-6,   UnitSystem::SI));

    // ── Velocity ─────────────────────────────────────────────────────────────
    add(u("metre per second",  "m/s",   D_VELOCITY, 1.0,           UnitSystem::SI));
    add(u("kilometre per hour","km/h",  D_VELOCITY, 1.0/3.6,       UnitSystem::Metric));
    add(u("miles per hour",    "mph",   D_VELOCITY, 0.44704,        UnitSystem::Imperial));
    add(u("knot",              "kn",    D_VELOCITY, 1852.0/3600.0,  UnitSystem::Other));
    add(u("foot per second",   "ft/s",  D_VELOCITY, 0.3048,         UnitSystem::Imperial));

    // ── Acceleration ─────────────────────────────────────────────────────────
    add(u("metre per second squared","m/s²", D_ACCEL, 1.0,    UnitSystem::SI));
    add(u("standard gravity",        "g₀",   D_ACCEL, 9.80665,UnitSystem::Other));
    add(u("foot per second squared", "ft/s²",D_ACCEL, 0.3048, UnitSystem::Imperial));

    // ── Force ─────────────────────────────────────────────────────────────────
    add(u("newton",      "N",  D_FORCE, 1.0,         UnitSystem::SI));
    add(u("kilonewton",  "kN", D_FORCE, 1e3,         UnitSystem::SI));
    add(u("pound-force", "lbf",D_FORCE, 4.448_221_6, UnitSystem::Imperial));
    add(u("kilogram-force","kgf",D_FORCE,9.80665,    UnitSystem::Metric));
    add(u("dyne",        "dyn",D_FORCE, 1e-5,        UnitSystem::CGS));

    // ── Pressure ─────────────────────────────────────────────────────────────
    add(u("pascal",      "Pa",  D_PRESSURE, 1.0,           UnitSystem::SI));
    add(u("kilopascal",  "kPa", D_PRESSURE, 1e3,           UnitSystem::SI));
    add(u("megapascal",  "MPa", D_PRESSURE, 1e6,           UnitSystem::SI));
    add(u("gigapascal",  "GPa", D_PRESSURE, 1e9,           UnitSystem::SI));
    add(u("bar",         "bar", D_PRESSURE, 1e5,           UnitSystem::Metric));
    add(u("millibar",    "mbar",D_PRESSURE, 1e2,           UnitSystem::Metric));
    add(u("atmosphere",  "atm", D_PRESSURE, 101_325.0,     UnitSystem::Other));
    add(u("psi",         "psi", D_PRESSURE, 6894.757,      UnitSystem::Imperial));
    add(u("mmHg",        "mmHg",D_PRESSURE, 133.322,       UnitSystem::Other));
    add(u("torr",        "Torr",D_PRESSURE, 133.322,       UnitSystem::Other));

    // ── Energy ───────────────────────────────────────────────────────────────
    add(u("joule",         "J",    D_ENERGY, 1.0,           UnitSystem::SI));
    add(u("kilojoule",     "kJ",   D_ENERGY, 1e3,           UnitSystem::SI));
    add(u("megajoule",     "MJ",   D_ENERGY, 1e6,           UnitSystem::SI));
    add(u("calorie",       "cal",  D_ENERGY, 4.184,         UnitSystem::Other));
    add(u("kilocalorie",   "kcal", D_ENERGY, 4184.0,        UnitSystem::Other));
    add(u("watt-hour",     "Wh",   D_ENERGY, 3600.0,        UnitSystem::Other));
    add(u("kilowatt-hour", "kWh",  D_ENERGY, 3.6e6,         UnitSystem::Other));
    add(u("BTU",           "BTU",  D_ENERGY, 1055.056,      UnitSystem::Imperial));
    add(u("electronvolt",  "eV",   D_ENERGY, 1.602_176_634e-19, UnitSystem::Other));
    add(u("erg",           "erg",  D_ENERGY, 1e-7,          UnitSystem::CGS));
    add(u("foot-pound",    "ft⋅lbf",D_ENERGY,1.355_818,    UnitSystem::Imperial));

    // ── Power ────────────────────────────────────────────────────────────────
    add(u("watt",        "W",   D_POWER, 1.0,      UnitSystem::SI));
    add(u("kilowatt",    "kW",  D_POWER, 1e3,      UnitSystem::SI));
    add(u("megawatt",    "MW",  D_POWER, 1e6,      UnitSystem::SI));
    add(u("horsepower",  "hp",  D_POWER, 745.6999, UnitSystem::Imperial));

    // ── Temperature ──────────────────────────────────────────────────────────
    add(u("kelvin",     "K",  D_TEMP, 1.0,    UnitSystem::SI));
    add(u_offset("celsius",     "°C", D_TEMP, 1.0,       273.15,              UnitSystem::SI));
    add(u_offset("fahrenheit",  "°F", D_TEMP, 5.0/9.0,   459.67 * 5.0/9.0,  UnitSystem::Imperial));
    // Rankine
    add(u("rankine", "°R", D_TEMP, 5.0/9.0, UnitSystem::Imperial));

    // ── Electric ─────────────────────────────────────────────────────────────
    add(u("ampere",  "A",  D_CURRENT, 1.0,    UnitSystem::SI));
    add(u("volt",    "V",  D_VOLTAGE, 1.0,    UnitSystem::SI));
    add(u("ohm",     "Ω",  D_RESIST,  1.0,    UnitSystem::SI));
    add(u("farad",   "F",  D_CAPAC,   1.0,    UnitSystem::SI));
    add(u("henry",   "H",  D_INDUCT,  1.0,    UnitSystem::SI));
    add(u("coulomb", "C",  D_CHARGE,  1.0,    UnitSystem::SI));
    add(u("watt (electric)", "W", D_POWER,1.0,UnitSystem::SI));

    // ── Area ─────────────────────────────────────────────────────────────────
    add(u("square metre",     "m²",  D_AREA, 1.0,        UnitSystem::SI));
    add(u("square centimetre","cm²", D_AREA, 1e-4,       UnitSystem::SI));
    add(u("square millimetre","mm²", D_AREA, 1e-6,       UnitSystem::SI));
    add(u("square foot",      "ft²", D_AREA, 0.09290304, UnitSystem::Imperial));
    add(u("square inch",      "in²", D_AREA, 6.4516e-4,  UnitSystem::Imperial));
    add(u("hectare",          "ha",  D_AREA, 1e4,        UnitSystem::Metric));

    // ── Volume ───────────────────────────────────────────────────────────────
    add(u("cubic metre",  "m³",  D_VOLUME, 1.0,           UnitSystem::SI));
    add(u("litre",        "L",   D_VOLUME, 1e-3,          UnitSystem::Metric));
    add(u("millilitre",   "mL",  D_VOLUME, 1e-6,          UnitSystem::Metric));
    add(u("cubic foot",   "ft³", D_VOLUME, 0.028_316_85,  UnitSystem::Imperial));
    add(u("cubic inch",   "in³", D_VOLUME, 1.638_706e-5,  UnitSystem::Imperial));
    add(u("US gallon",    "gal", D_VOLUME, 3.785_411_8e-3,UnitSystem::Imperial));

    // ── Frequency ────────────────────────────────────────────────────────────
    add(u("hertz",     "Hz",  D_FREQ, 1.0,  UnitSystem::SI));
    add(u("kilohertz", "kHz", D_FREQ, 1e3,  UnitSystem::SI));
    add(u("megahertz", "MHz", D_FREQ, 1e6,  UnitSystem::SI));
    add(u("gigahertz", "GHz", D_FREQ, 1e9,  UnitSystem::SI));
    add(u("RPM",       "rpm", D_FREQ, 1.0/60.0, UnitSystem::Other));

    // ── Angle ────────────────────────────────────────────────────────────────
    add(u("radian",  "rad", D_ANGLE, 1.0,                   UnitSystem::SI));
    add(u("degree",  "deg", D_ANGLE, std::f64::consts::PI/180.0, UnitSystem::Other));
    add(u("gradian", "grad",D_ANGLE, std::f64::consts::PI/200.0, UnitSystem::Other));
    add(u("revolution","rev",D_ANGLE,2.0*std::f64::consts::PI,   UnitSystem::Other));

    // ── Density ──────────────────────────────────────────────────────────────
    add(u("kg/m³",  "kg/m³",D_DENSITY,1.0,         UnitSystem::SI));
    add(u("g/cm³",  "g/cm³",D_DENSITY,1e3,         UnitSystem::CGS));
    add(u("lb/ft³", "lb/ft³",D_DENSITY,16.01846,   UnitSystem::Imperial));
    add(u("lb/in³", "lb/in³",D_DENSITY,27679.9,    UnitSystem::Imperial));

    // ── Amount ───────────────────────────────────────────────────────────────
    add(u("mole",      "mol", D_AMOUNT, 1.0,   UnitSystem::SI));
    add(u("kilomole",  "kmol",D_AMOUNT, 1e3,   UnitSystem::SI));
    add(u("millimole", "mmol",D_AMOUNT, 1e-3,  UnitSystem::SI));

    // ── Thermal ──────────────────────────────────────────────────────────────
    add(u("W/(m⋅K)",     "W/(m⋅K)",D_THERM_COND,1.0,     UnitSystem::SI));
    add(u("J/(kg⋅K)",    "J/(kg⋅K)",D_HEAT_CAP,  1.0,    UnitSystem::SI));
    add(u("kJ/(kg⋅K)",   "kJ/(kg⋅K)",D_HEAT_CAP, 1e3,   UnitSystem::SI));
    add(u("BTU/(lb⋅°F)", "BTU/(lb⋅°F)",D_HEAT_CAP,4186.8,UnitSystem::Imperial));

    // ── Viscosity ─────────────────────────────────────────────────────────────
    add(u("pascal-second","Pa⋅s",D_VISC_DYN,1.0,    UnitSystem::SI));
    add(u("poise",         "P",  D_VISC_DYN,0.1,    UnitSystem::CGS));
    add(u("centipoise",    "cP", D_VISC_DYN,1e-3,   UnitSystem::CGS));
    add(u("m²/s",          "m²/s",D_VISC_KIN,1.0,  UnitSystem::SI));
    add(u("stokes",        "St", D_VISC_KIN,1e-4,   UnitSystem::CGS));
    add(u("centistokes",   "cSt",D_VISC_KIN,1e-6,  UnitSystem::CGS));

    db
}

/// Parse a unit symbol and return its definition.
/// Accepts common alternative spellings (e.g. "C" for Celsius, "F" for Fahrenheit).
pub fn lookup_unit(symbol: &str) -> Option<UnitDef> {
    let db = unit_database();
    // Try exact match first
    if let Some(def) = db.get(symbol) {
        return Some(def.clone());
    }
    // Case-insensitive fallback for common variants
    let s = symbol.to_lowercase();
    for (k, v) in &db {
        if k.to_lowercase() == s || v.name.to_lowercase() == s {
            return Some(v.clone());
        }
    }
    None
}

/// Check whether two units are dimensionally compatible (same dimension vector).
pub fn are_compatible(a: &UnitDef, b: &UnitDef) -> bool {
    a.dimension == b.dimension
}

/// Compute the conversion factor: value in `from` → value in `to`.
/// Returns None if the units are dimensionally incompatible.
/// For temperature with offsets, use `convert_temperature()` instead.
pub fn conversion_factor(from: &UnitDef, to: &UnitDef) -> Option<f64> {
    if !are_compatible(from, to) { return None; }
    Some(from.scale / to.scale)
}

/// Convert a numeric value from one unit to another.
/// Handles temperature offsets (°C ↔ K ↔ °F).
pub fn convert(value: f64, from: &UnitDef, to: &UnitDef) -> Option<f64> {
    if !are_compatible(from, to) { return None; }
    // Convert to SI base: si = value * from.scale + from.offset
    let si = value * from.scale + from.offset;
    // Convert from SI base to target: result = (si - to.offset) / to.scale
    Some((si - to.offset) / to.scale)
}

/// Analyse dimensional consistency of a list of (value, unit_symbol) pairs.
/// Returns a report indicating whether all units are compatible.
#[derive(Debug, Clone)]
pub struct UnitAnalysis {
    /// The common dimension (None if inconsistent or no units provided).
    pub common_dimension: Option<Dimension>,
    /// Whether all units are dimensionally consistent.
    pub is_consistent:    bool,
    /// Human-readable summary.
    pub summary:          String,
    /// Per-entry results: (symbol, dimension_str, scale_factor_to_si, ok)
    pub entries:          Vec<UnitEntry>,
}

#[derive(Debug, Clone)]
pub struct UnitEntry {
    pub symbol:    String,
    pub dimension: String,
    pub scale:     f64,
    pub ok:        bool,
}

pub fn analyse_units(symbols: &[&str]) -> UnitAnalysis {
    let mut entries = Vec::new();
    let mut common: Option<Dimension> = None;
    let mut is_consistent = true;

    for &sym in symbols {
        match lookup_unit(sym) {
            Some(def) => {
                let dim_str = def.dimension.display();
                let ok = match &common {
                    None => { common = Some(def.dimension); true }
                    Some(d) => def.dimension == *d,
                };
                if !ok { is_consistent = false; }
                entries.push(UnitEntry { symbol: sym.to_string(), dimension: dim_str, scale: def.scale, ok });
            }
            None => {
                is_consistent = false;
                entries.push(UnitEntry { symbol: sym.to_string(), dimension: "?".to_string(), scale: f64::NAN, ok: false });
            }
        }
    }

    let summary = if symbols.is_empty() {
        "No units provided".to_string()
    } else if is_consistent {
        format!("Consistent: {} ({})", common.map(|d| d.display()).unwrap_or_default(),
                entries[0].dimension.clone())
    } else {
        let dims: Vec<String> = entries.iter().map(|e| format!("{}={}", e.symbol, e.dimension)).collect();
        format!("Inconsistent: {}", dims.join(", "))
    };

    UnitAnalysis { common_dimension: common, is_consistent, summary, entries }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kg_to_lb() {
        let kg = lookup_unit("kg").unwrap();
        let lb = lookup_unit("lb").unwrap();
        let factor = conversion_factor(&kg, &lb).unwrap();
        // 1 kg = 2.20462 lb
        assert!((factor - 2.20462).abs() < 0.001, "factor = {factor}");
    }

    #[test]
    fn celsius_to_kelvin() {
        let c = lookup_unit("°C").unwrap();
        let k = lookup_unit("K").unwrap();
        let result = convert(0.0, &c, &k).unwrap();
        assert!((result - 273.15).abs() < 1e-9, "0°C = {result} K");
        let result2 = convert(100.0, &c, &k).unwrap();
        assert!((result2 - 373.15).abs() < 1e-9, "100°C = {result2} K");
    }

    #[test]
    fn incompatible_units() {
        let kg = lookup_unit("kg").unwrap();
        let m = lookup_unit("m").unwrap();
        assert!(conversion_factor(&kg, &m).is_none());
    }

    #[test]
    fn consistent_analysis() {
        let a = analyse_units(&["kg", "g", "lb"]);
        assert!(a.is_consistent, "all mass units should be consistent");
    }

    #[test]
    fn inconsistent_analysis() {
        let a = analyse_units(&["kg", "m"]);
        assert!(!a.is_consistent, "mass and length should be inconsistent");
    }

    #[test]
    fn psi_to_pa() {
        let psi = lookup_unit("psi").unwrap();
        let pa  = lookup_unit("Pa").unwrap();
        let factor = conversion_factor(&psi, &pa).unwrap();
        assert!((factor - 6894.757).abs() < 0.01, "1 psi = {factor} Pa");
    }
}
