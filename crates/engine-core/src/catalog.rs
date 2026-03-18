//! Ops catalog — canonical metadata for every block type.
//!
//! This is the single source of truth for block metadata. The TypeScript
//! UI reads this catalog on startup to build the block library palette.

use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub op_id: &'static str,
    pub label: &'static str,
    pub category: &'static str,
    pub node_kind: &'static str,
    pub inputs: Vec<PortDef>,
    pub pro_only: bool,
    /// When true, this block supports a variable number of inputs (2..max_inputs).
    /// The UI can add/remove input ports dynamically. Input port IDs for variadic
    /// blocks follow the pattern `in_0`, `in_1`, ..., `in_N`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variadic: Option<bool>,
    /// Minimum number of inputs for variadic blocks (default: 2).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_inputs: Option<u32>,
    /// Maximum number of inputs for variadic blocks (default: 64).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_inputs: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortDef {
    pub id: &'static str,
    pub label: &'static str,
}

fn p(id: &'static str, label: &'static str) -> PortDef {
    PortDef { id, label }
}

/// Create a standard (non-variadic) catalog entry.
fn entry(
    op_id: &'static str,
    label: &'static str,
    category: &'static str,
    node_kind: &'static str,
    inputs: Vec<PortDef>,
    pro_only: bool,
) -> CatalogEntry {
    CatalogEntry {
        op_id,
        label,
        category,
        node_kind,
        inputs,
        pro_only,
        variadic: None,
        min_inputs: None,
        max_inputs: None,
    }
}

/// Create a variadic catalog entry (supports N inputs).
fn variadic_entry(
    op_id: &'static str,
    label: &'static str,
    category: &'static str,
    node_kind: &'static str,
    inputs: Vec<PortDef>,
    pro_only: bool,
    min_inputs: u32,
    max_inputs: u32,
) -> CatalogEntry {
    CatalogEntry {
        op_id,
        label,
        category,
        node_kind,
        inputs,
        pro_only,
        variadic: Some(true),
        min_inputs: Some(min_inputs),
        max_inputs: Some(max_inputs),
    }
}

/// Return the full ops catalog.
pub fn catalog() -> Vec<CatalogEntry> {
    vec![
        // ── Input ────────────────────────────────────────────────
        entry("number", "Number", "input", "csSource", vec![], false),
        entry("slider", "Slider", "input", "csSource", vec![], false),
        entry("variableSource", "Variable", "input", "csSource", vec![], false),
        entry("boolean_input", "Boolean Input", "input", "csSource", vec![], false),
        entry("parameter_sweep", "Parameter Sweep", "input", "csSource", vec![], false),
        // H4-1: Core constant catalog entries (pi, euler, tau, phi) removed.
        // The unified Constant picker resolves selections in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.
        // ── Math ─────────────────────────────────────────────────
        variadic_entry("add", "Add", "math", "csOperation", vec![p("a", "A"), p("b", "B")], false, 2, 64),
        entry("subtract", "Subtract", "math", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        variadic_entry("multiply", "Multiply", "math", "csOperation", vec![p("a", "A"), p("b", "B")], false, 2, 64),
        entry("divide", "Divide", "math", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        entry("negate", "Negate", "math", "csOperation", vec![p("a", "A")], false),
        entry("abs", "Abs", "math", "csOperation", vec![p("a", "A")], false),
        entry("sqrt", "Sqrt", "math", "csOperation", vec![p("a", "A")], false),
        entry("power", "Power", "math", "csOperation", vec![p("base", "Base"), p("exp", "Exp")], false),
        entry("floor", "Floor", "math", "csOperation", vec![p("a", "A")], false),
        entry("ceil", "Ceil", "math", "csOperation", vec![p("a", "A")], false),
        entry("round", "Round", "math", "csOperation", vec![p("a", "A")], false),
        entry("mod", "Mod", "math", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        entry("clamp", "Clamp", "math", "csOperation", vec![p("val", "Val"), p("min", "Min"), p("max", "Max")], false),
        entry("trunc", "Trunc", "math", "csOperation", vec![p("a", "A")], false),
        entry("sign", "Sign", "math", "csOperation", vec![p("a", "A")], false),
        entry("ln", "Ln", "math", "csOperation", vec![p("a", "A")], false),
        entry("log10", "Log10", "math", "csOperation", vec![p("a", "A")], false),
        entry("exp", "Exp", "math", "csOperation", vec![p("a", "A")], false),
        entry("log_base", "Log (base)", "math", "csOperation", vec![p("val", "Value"), p("base", "Base")], false),
        entry("roundn", "Round N", "math", "csOperation", vec![p("val", "Value"), p("digits", "Digits")], false),
        // ── Trig ─────────────────────────────────────────────────
        entry("sin", "Sin", "trig", "csOperation", vec![p("a", "\u{03B8} (rad)")], false),
        entry("cos", "Cos", "trig", "csOperation", vec![p("a", "\u{03B8} (rad)")], false),
        entry("tan", "Tan", "trig", "csOperation", vec![p("a", "\u{03B8} (rad)")], false),
        entry("asin", "Asin", "trig", "csOperation", vec![p("a", "A")], false),
        entry("acos", "Acos", "trig", "csOperation", vec![p("a", "A")], false),
        entry("atan", "Atan", "trig", "csOperation", vec![p("a", "A")], false),
        entry("atan2", "Atan2", "trig", "csOperation", vec![p("y", "Y"), p("x", "X")], false),
        entry("degToRad", "Deg \u{2192} Rad", "trig", "csOperation", vec![p("deg", "\u{00B0}")], false),
        entry("radToDeg", "Rad \u{2192} Deg", "trig", "csOperation", vec![p("rad", "rad")], false),
        // ── Logic ────────────────────────────────────────────────
        entry("greater", "Greater", "logic", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        entry("less", "Less", "logic", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        entry("equal", "Equal", "logic", "csOperation", vec![p("a", "A"), p("b", "B")], false),
        entry("ifthenelse", "If / Then / Else", "logic", "csOperation", vec![p("cond", "If (\u{2260}0)"), p("then", "Then"), p("else", "Else")], false),
        variadic_entry("max", "Max", "logic", "csOperation", vec![p("a", "A"), p("b", "B")], false, 2, 64),
        variadic_entry("min", "Min", "logic", "csOperation", vec![p("a", "A"), p("b", "B")], false, 2, 64),
        // ── Output ───────────────────────────────────────────────
        entry("display", "Display", "output", "csDisplay", vec![p("value", "Value")], false),
        // H7-1: Publish block captures incoming value under a named channel.
        entry("publish", "Publish", "output", "csPublish", vec![p("value", "Value")], false),
        // H7-1: Subscribe block reads a published channel value (resolved in TS bridge).
        entry("subscribe", "Subscribe", "input", "csSubscribe", vec![], false),
        // ── Data (Pro) ───────────────────────────────────────────
        entry("vectorInput", "Array Input", "data", "csData", vec![], true),
        entry("tableInput", "Table Input", "data", "csData", vec![], true),
        entry("table_extract_col", "Table Column", "tableOps", "csOperation", vec![p("table", "Table"), p("index", "Column Index")], true),
        // ── Material Full (Pro, Phase 10) ────────────────────────
        entry("material_full", "Material (Full)", "presetMaterials", "csMaterial", vec![], true),
        // ── List Ops (Pro) ──────────────────────────────────────
        entry("vectorLength", "List Length", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorSum", "List Sum", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorMean", "List Mean", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorMin", "List Min", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorMax", "List Max", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorSort", "List Sort", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorReverse", "List Reverse", "vectorOps", "csOperation", vec![p("vec", "List")], true),
        entry("vectorSlice", "List Slice", "vectorOps", "csOperation", vec![p("vec", "List"), p("start", "Start"), p("end", "End")], true),
        variadic_entry("vectorConcat", "List Concat", "vectorOps", "csOperation", vec![p("a", "A"), p("b", "B")], true, 2, 64),
        entry("vectorMap", "List \u{00D7} Scalar", "vectorOps", "csOperation", vec![p("vec", "List"), p("scalar", "Scalar")], true),
        // ── Plot (Pro) ───────────────────────────────────────────
        entry("xyPlot", "XY Plot", "plot", "csPlot", vec![p("data", "Data")], true),
        entry("histogram", "Histogram", "plot", "csPlot", vec![p("data", "Data")], true),
        entry("barChart", "Bar Chart", "plot", "csPlot", vec![p("data", "Data")], true),
        entry("heatmap", "Heatmap", "plot", "csPlot", vec![p("data", "Data")], true),
        entry("listTable", "List Table", "plot", "csListTable", vec![p("data", "Data")], true),
        // ── Engineering → Mechanics ──────────────────────────────────
        entry("eng.mechanics.v_from_uat", "v = u + at", "engMechanics", "csOperation", vec![p("u", "u (m/s)"), p("a", "a (m/s\u{00B2})"), p("t", "t (s)")], false),
        entry("eng.mechanics.s_from_ut_a_t", "s = ut + \u{00BD}at\u{00B2}", "engMechanics", "csOperation", vec![p("u", "u (m/s)"), p("t", "t (s)"), p("a", "a (m/s\u{00B2})")], false),
        entry("eng.mechanics.v2_from_u2_as", "v = \u{221A}(u\u{00B2}+2as)", "engMechanics", "csOperation", vec![p("u", "u (m/s)"), p("a", "a (m/s\u{00B2})"), p("s", "s (m)")], false),
        entry("eng.mechanics.force_ma", "F = ma", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("a", "a (m/s\u{00B2})")], false),
        entry("eng.mechanics.weight_mg", "W = mg", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("g", "g (m/s\u{00B2})")], false),
        entry("eng.mechanics.momentum_mv", "p = mv", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("v", "v (m/s)")], false),
        entry("eng.mechanics.kinetic_energy", "KE = \u{00BD}mv\u{00B2}", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("v", "v (m/s)")], false),
        entry("eng.mechanics.potential_energy", "PE = mgh", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("g", "g (m/s\u{00B2})"), p("h", "h (m)")], false),
        entry("eng.mechanics.work_Fs", "W = Fs", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("s", "s (m)")], false),
        entry("eng.mechanics.power_work_time", "P = W/t", "engMechanics", "csOperation", vec![p("W", "W (J)"), p("t", "t (s)")], false),
        entry("eng.mechanics.power_Fv", "P = Fv", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("v", "v (m/s)")], false),
        entry("eng.mechanics.torque_Fr", "T = Fr", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("r", "r (m)")], false),
        entry("eng.mechanics.omega_from_rpm", "\u{03C9} from RPM", "engMechanics", "csOperation", vec![p("rpm", "RPM")], false),
        entry("eng.mechanics.rpm_from_omega", "RPM from \u{03C9}", "engMechanics", "csOperation", vec![p("omega", "\u{03C9} (rad/s)")], false),
        entry("eng.mechanics.power_rot_Tomega", "P = T\u{03C9}", "engMechanics", "csOperation", vec![p("T", "T (N\u{00B7}m)"), p("omega", "\u{03C9} (rad/s)")], false),
        entry("eng.mechanics.centripetal_acc", "a = v\u{00B2}/r", "engMechanics", "csOperation", vec![p("v", "v (m/s)"), p("r", "r (m)")], false),
        entry("eng.mechanics.centripetal_force", "F = mv\u{00B2}/r", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("v", "v (m/s)"), p("r", "r (m)")], false),
        entry("eng.mechanics.friction_force", "F = μN", "engMechanics", "csOperation", vec![p("mu", "μ"), p("N", "N (N)")], false),
        entry("eng.mechanics.impulse", "J = FΔt", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("dt", "Δt (s)")], false),
        // ── Engineering → Materials & Strength ───────────────────────
        entry("eng.materials.stress_F_A", "\u{03C3} = F/A", "engMaterials", "csOperation", vec![p("F", "F (N)"), p("A", "A (m\u{00B2})")], false),
        entry("eng.materials.strain_dL_L", "\u{03B5} = \u{0394}L/L", "engMaterials", "csOperation", vec![p("dL", "\u{0394}L (m)"), p("L", "L (m)")], false),
        entry("eng.materials.youngs_modulus", "E = \u{03C3}/\u{03B5}", "engMaterials", "csOperation", vec![p("sigma", "\u{03C3} (Pa)"), p("epsilon", "\u{03B5}")], false),
        entry("eng.materials.pressure_F_A", "p = F/A", "engMaterials", "csOperation", vec![p("F", "F (N)"), p("A", "A (m\u{00B2})")], false),
        entry("eng.materials.safety_factor", "Safety Factor", "engMaterials", "csOperation", vec![p("strength", "Strength (Pa)"), p("stress", "Stress (Pa)")], false),
        entry("eng.materials.spring_force_kx", "F = kx", "engMaterials", "csOperation", vec![p("k", "k (N/m)"), p("x", "x (m)")], false),
        entry("eng.materials.spring_energy", "E = \u{00BD}kx\u{00B2}", "engMaterials", "csOperation", vec![p("k", "k (N/m)"), p("x", "x (m)")], false),
        // ── Engineering → Section Properties ─────────────────────────
        entry("eng.sections.area_circle", "Area Circle", "engSections", "csOperation", vec![p("d", "d (m)")], false),
        entry("eng.sections.area_annulus", "Area Annulus", "engSections", "csOperation", vec![p("d_outer", "d outer (m)"), p("d_inner", "d inner (m)")], false),
        entry("eng.sections.I_rect", "I Rectangle", "engSections", "csOperation", vec![p("b", "b (m)"), p("h", "h (m)")], false),
        entry("eng.sections.I_circle", "I Circle", "engSections", "csOperation", vec![p("d", "d (m)")], false),
        entry("eng.sections.J_circle", "J Circle", "engSections", "csOperation", vec![p("d", "d (m)")], false),
        entry("eng.sections.bending_stress", "\u{03C3} = My/I", "engSections", "csOperation", vec![p("M", "M (N\u{00B7}m)"), p("y", "y (m)"), p("I", "I (m\u{2074})")], false),
        entry("eng.sections.torsional_shear", "\u{03C4} = Tr/J", "engSections", "csOperation", vec![p("T", "T (N\u{00B7}m)"), p("r", "r (m)"), p("J", "J (m\u{2074})")], false),
        // ── Engineering → Rotational Inertia ─────────────────────────
        entry("eng.inertia.solid_cylinder", "I Solid Cylinder", "engInertia", "csOperation", vec![p("m", "m (kg)"), p("r", "r (m)")], false),
        entry("eng.inertia.hollow_cylinder", "I Hollow Cylinder", "engInertia", "csOperation", vec![p("m", "m (kg)"), p("r_inner", "r inner (m)"), p("r_outer", "r outer (m)")], false),
        entry("eng.inertia.solid_sphere", "I Solid Sphere", "engInertia", "csOperation", vec![p("m", "m (kg)"), p("r", "r (m)")], false),
        entry("eng.inertia.rod_center", "I Rod (center)", "engInertia", "csOperation", vec![p("m", "m (kg)"), p("L", "L (m)")], false),
        entry("eng.inertia.rod_end", "I Rod (end)", "engInertia", "csOperation", vec![p("m", "m (kg)"), p("L", "L (m)")], false),
        // ── Engineering → Fluids ─────────────────────────────────────
        entry("eng.fluids.flow_Q_from_Av", "Q = Av", "engFluids", "csOperation", vec![p("A", "A (m\u{00B2})"), p("v", "v (m/s)")], false),
        entry("eng.fluids.velocity_from_QA", "v = Q/A", "engFluids", "csOperation", vec![p("Q", "Q (m\u{00B3}/s)"), p("A", "A (m\u{00B2})")], false),
        entry("eng.fluids.mass_flow", "\u{1E41} = \u{03C1}Q", "engFluids", "csOperation", vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("Q", "Q (m\u{00B3}/s)")], false),
        entry("eng.fluids.reynolds", "Reynolds Re", "engFluids", "csOperation", vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)"), p("D", "D (m)"), p("mu", "\u{03BC} (Pa\u{00B7}s)")], false),
        entry("eng.fluids.dynamic_pressure", "q = \u{00BD}\u{03C1}v\u{00B2}", "engFluids", "csOperation", vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)")], false),
        entry("eng.fluids.hagen_poiseuille_dp", "Hagen-Poiseuille", "engFluids", "csOperation", vec![p("mu", "\u{03BC} (Pa\u{00B7}s)"), p("L", "L (m)"), p("Q", "Q (m\u{00B3}/s)"), p("D", "D (m)")], false),
        entry("eng.fluids.darcy_weisbach_dp", "Darcy-Weisbach", "engFluids", "csOperation", vec![p("f", "f"), p("L", "L (m)"), p("D", "D (m)"), p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)")], false),
        entry("eng.fluids.buoyancy", "F = \u{03C1}Vg", "engFluids", "csOperation", vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("V", "V (m\u{00B3})"), p("g", "g (m/s\u{00B2})")], false),
        // ── Engineering → Thermo ─────────────────────────────────────
        entry("eng.thermo.ideal_gas_P", "P = nRT/V", "engThermo", "csOperation", vec![p("n", "n (mol)"), p("R", "R (J/mol\u{00B7}K)"), p("T", "T (K)"), p("V", "V (m\u{00B3})")], false),
        entry("eng.thermo.ideal_gas_T", "T = PV/nR", "engThermo", "csOperation", vec![p("P", "P (Pa)"), p("V", "V (m\u{00B3})"), p("n", "n (mol)"), p("R", "R (J/mol\u{00B7}K)")], false),
        entry("eng.thermo.heat_Q_mcDT", "Q = mc\u{0394}T", "engThermo", "csOperation", vec![p("m", "m (kg)"), p("c", "c (J/kg\u{00B7}K)"), p("dT", "\u{0394}T (K)")], false),
        entry("eng.thermo.conduction_Qdot", "Conduction", "engThermo", "csOperation", vec![p("k", "k (W/m\u{00B7}K)"), p("A", "A (m\u{00B2})"), p("dT", "\u{0394}T (K)"), p("L", "L (m)")], false),
        entry("eng.thermo.convection_Qdot", "Convection", "engThermo", "csOperation", vec![p("h", "h (W/m\u{00B2}\u{00B7}K)"), p("A", "A (m\u{00B2})"), p("dT", "\u{0394}T (K)")], false),
        entry("eng.thermo.carnot_efficiency", "\u{03B7} = 1\u{2212}T\u{1D04}/T\u{1D34}", "engThermo", "csOperation", vec![p("T_cold", "T\u{1D04}\u{2092}\u{2097}\u{1D48} (K)"), p("T_hot", "T\u{2095}\u{2092}\u{209C} (K)")], false),
        entry("eng.thermo.thermal_expansion", "\u{0394}L = \u{03B1}L\u{0394}T", "engThermo", "csOperation", vec![p("alpha", "\u{03B1} (1/K)"), p("L", "L (m)"), p("dT", "\u{0394}T (K)")], false),
        // ── Engineering → Electrical ─────────────────────────────────
        entry("eng.elec.ohms_V", "V = IR", "engElectrical", "csOperation", vec![p("I", "I (A)"), p("R", "R (\u{03A9})")], false),
        entry("eng.elec.power_VI", "P = VI", "engElectrical", "csOperation", vec![p("V", "V (V)"), p("I", "I (A)")], false),
        entry("eng.elec.power_I2R", "P = I\u{00B2}R", "engElectrical", "csOperation", vec![p("I", "I (A)"), p("R", "R (\u{03A9})")], false),
        entry("eng.elec.power_V2R", "P = V\u{00B2}/R", "engElectrical", "csOperation", vec![p("V", "V (V)"), p("R", "R (\u{03A9})")], false),
        entry("eng.elec.capacitance_Q_V", "C = Q/V", "engElectrical", "csOperation", vec![p("Q", "Q (C)"), p("V", "V (V)")], false),
        entry("eng.elec.series_resistance", "R = R\u{2081}+R\u{2082}", "engElectrical", "csOperation", vec![p("R1", "R\u{2081} (\u{03A9})"), p("R2", "R\u{2082} (\u{03A9})")], false),
        entry("eng.elec.parallel_resistance", "R\u{2225} = R\u{2081}R\u{2082}/(R\u{2081}+R\u{2082})", "engElectrical", "csOperation", vec![p("R1", "R\u{2081} (\u{03A9})"), p("R2", "R\u{2082} (\u{03A9})")], false),
        // ── Engineering → Conversions ────────────────────────────────
        entry("eng.conv.deg_to_rad", "Deg \u{2192} Rad", "engConversions", "csOperation", vec![p("deg", "deg")], false),
        entry("eng.conv.rad_to_deg", "Rad \u{2192} Deg", "engConversions", "csOperation", vec![p("rad", "rad")], false),
        entry("eng.conv.mm_to_m", "mm \u{2192} m", "engConversions", "csOperation", vec![p("mm", "mm")], false),
        entry("eng.conv.m_to_mm", "m \u{2192} mm", "engConversions", "csOperation", vec![p("m", "m")], false),
        entry("eng.conv.bar_to_pa", "bar \u{2192} Pa", "engConversions", "csOperation", vec![p("bar", "bar")], false),
        entry("eng.conv.pa_to_bar", "Pa \u{2192} bar", "engConversions", "csOperation", vec![p("Pa", "Pa")], false),
        entry("eng.conv.lpm_to_m3s", "L/min \u{2192} m\u{00B3}/s", "engConversions", "csOperation", vec![p("lpm", "L/min")], false),
        entry("eng.conv.m3s_to_lpm", "m\u{00B3}/s \u{2192} L/min", "engConversions", "csOperation", vec![p("m3s", "m\u{00B3}/s")], false),
        entry("unit_convert", "Unit Convert", "engConversions", "csOperation", vec![p("value", "value")], false),
        // ── Finance → TVM ──────────────────────────────────────────────
        entry("fin.tvm.simple_interest", "Simple Interest", "finTvm", "csOperation", vec![p("P", "P"), p("r", "r"), p("t", "t")], true),
        entry("fin.tvm.compound_fv", "Compound FV", "finTvm", "csOperation", vec![p("PV", "PV"), p("r", "r"), p("n", "n"), p("t", "t")], true),
        entry("fin.tvm.compound_pv", "Compound PV", "finTvm", "csOperation", vec![p("FV", "FV"), p("r", "r"), p("n", "n"), p("t", "t")], true),
        entry("fin.tvm.continuous_fv", "Continuous FV", "finTvm", "csOperation", vec![p("PV", "PV"), p("r", "r"), p("t", "t")], true),
        entry("fin.tvm.annuity_pv", "Annuity PV", "finTvm", "csOperation", vec![p("PMT", "PMT"), p("r", "r"), p("n", "n")], true),
        entry("fin.tvm.annuity_fv", "Annuity FV", "finTvm", "csOperation", vec![p("PMT", "PMT"), p("r", "r"), p("n", "n")], true),
        entry("fin.tvm.annuity_pmt", "Annuity PMT", "finTvm", "csOperation", vec![p("PV", "PV"), p("r", "r"), p("n", "n")], true),
        entry("fin.tvm.npv", "NPV", "finTvm", "csOperation", vec![p("r", "r"), p("c", "Count"), p("cf0", "CF0"), p("cf1", "CF1"), p("cf2", "CF2"), p("cf3", "CF3"), p("cf4", "CF4"), p("cf5", "CF5")], true),
        entry("fin.tvm.rule_of_72", "Rule of 72", "finTvm", "csOperation", vec![p("r", "r (decimal)")], true),
        entry("fin.tvm.effective_rate", "Effective Rate", "finTvm", "csOperation", vec![p("r", "r (nominal)"), p("n", "n (periods)")], true),
        // ── Finance → Returns & Risk ───────────────────────────────────
        entry("fin.returns.pct_return", "% Return", "finReturns", "csOperation", vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}")], true),
        entry("fin.returns.log_return", "Log Return", "finReturns", "csOperation", vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}")], true),
        entry("fin.returns.cagr", "CAGR", "finReturns", "csOperation", vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}"), p("t", "t (yrs)")], true),
        entry("fin.returns.sharpe", "Sharpe Ratio", "finReturns", "csOperation", vec![p("ret", "Return"), p("rf", "R\u{1D193}"), p("sigma", "\u{03C3}")], true),
        entry("fin.returns.weighted_avg", "Weighted Avg", "finReturns", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "W1"), p("y2", "W2"), p("y3", "W3"), p("y4", "W4"), p("y5", "W5"), p("y6", "W6")], true),
        entry("fin.returns.portfolio_variance", "Portfolio Var (2-asset)", "finReturns", "csOperation", vec![p("w1", "w\u{2081}"), p("w2", "w\u{2082}"), p("s1", "\u{03C3}\u{2081}"), p("s2", "\u{03C3}\u{2082}"), p("rho", "\u{03C1}")], true),
        // ── Finance → Depreciation ─────────────────────────────────────
        entry("fin.depr.straight_line", "SL Depreciation", "finDepr", "csOperation", vec![p("cost", "Cost"), p("salvage", "Salvage"), p("life", "Life")], true),
        entry("fin.depr.declining_balance", "DB Depreciation", "finDepr", "csOperation", vec![p("cost", "Cost"), p("salvage", "Salvage"), p("life", "Life"), p("period", "Period")], true),
        // ── Stats → Descriptive ────────────────────────────────────────
        entry("stats.desc.mean", "Mean", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.median", "Median", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.mode_approx", "Mode (approx)", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.range", "Range", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.variance", "Variance", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.stddev", "Std Dev", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.sum", "Sum", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.geo_mean", "Geometric Mean", "statsDesc", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")], true),
        entry("stats.desc.zscore", "Z-Score", "statsDesc", "csOperation", vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], true),
        // ── Stats → Relationships ──────────────────────────────────────
        entry("stats.rel.covariance", "Covariance", "statsRel", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")], true),
        entry("stats.rel.correlation", "Correlation", "statsRel", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")], true),
        entry("stats.rel.linreg_slope", "LinReg Slope", "statsRel", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")], true),
        entry("stats.rel.linreg_intercept", "LinReg Intercept", "statsRel", "csOperation", vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")], true),
        // ── Probability → Combinatorics ────────────────────────────────
        entry("prob.comb.factorial", "n!", "probComb", "csOperation", vec![p("n", "n")], true),
        entry("prob.comb.permutation", "P(n,k)", "probComb", "csOperation", vec![p("n", "n"), p("k", "k")], true),
        entry("prob.comb.combination", "C(n,k)", "probComb", "csOperation", vec![p("n", "n"), p("k", "k")], false),
        // ── Probability → Distributions ────────────────────────────────
        entry("prob.dist.binomial_pmf", "Binomial PMF", "probDist", "csOperation", vec![p("n", "n"), p("k", "k"), p("p", "p")], true),
        entry("prob.dist.poisson_pmf", "Poisson PMF", "probDist", "csOperation", vec![p("k", "k"), p("lambda", "\u{03BB}")], true),
        entry("prob.dist.exponential_pdf", "Exponential PDF", "probDist", "csOperation", vec![p("x", "x"), p("lambda", "\u{03BB}")], true),
        entry("prob.dist.exponential_cdf", "Exponential CDF", "probDist", "csOperation", vec![p("x", "x"), p("lambda", "\u{03BB}")], true),
        entry("prob.dist.normal_pdf", "Normal PDF", "probDist", "csOperation", vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], true),
        // ── Utilities ──────────────────────────────────────────────────
        entry("util.round.to_dp", "Round to DP", "utilCalc", "csOperation", vec![p("x", "x"), p("dp", "DP")], true),
        entry("util.pct.to_decimal", "% \u{2192} Decimal", "utilCalc", "csOperation", vec![p("pct", "%")], true),
        // H4-1: Individual constant catalog entries removed.
        // The unified Constant picker resolves selections in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.
        // H3-1: Material/fluid preset catalog entries removed.
        // The unified Material node resolves presets in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.

        // ── SCI-11: Statistical distributions ──────────────────────────
        entry("prob.dist.normal_cdf", "Normal CDF", "probDist", "csOperation", vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], true),
        entry("prob.dist.normal_inv_cdf", "Normal InvCDF (Probit)", "probDist", "csOperation", vec![p("p", "p"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], true),
        entry("prob.dist.t_pdf", "t PDF", "probDist", "csOperation", vec![p("x", "x"), p("df", "df (\u{03BD})")], true),
        entry("prob.dist.t_cdf", "t CDF", "probDist", "csOperation", vec![p("x", "x"), p("df", "df (\u{03BD})")], true),
        entry("prob.dist.chi2_pdf", "Chi\u{00B2} PDF", "probDist", "csOperation", vec![p("x", "x"), p("k", "k (df)")], true),
        entry("prob.dist.chi2_cdf", "Chi\u{00B2} CDF", "probDist", "csOperation", vec![p("x", "x"), p("k", "k (df)")], true),
        entry("prob.dist.f_pdf", "F PDF", "probDist", "csOperation", vec![p("x", "x"), p("d1", "d1 (df1)"), p("d2", "d2 (df2)")], true),
        entry("prob.dist.f_cdf", "F CDF", "probDist", "csOperation", vec![p("x", "x"), p("d1", "d1 (df1)"), p("d2", "d2 (df2)")], true),
        entry("prob.dist.poisson_cdf", "Poisson CDF", "probDist", "csOperation", vec![p("k", "k"), p("lambda", "\u{03BB}")], true),
        entry("prob.dist.binomial_cdf", "Binomial CDF", "probDist", "csOperation", vec![p("k", "k"), p("n", "n"), p("p", "p")], true),
        entry("prob.dist.beta_pdf", "Beta PDF", "probDist", "csOperation", vec![p("x", "x"), p("a", "\u{03B1}"), p("b", "\u{03B2}")], true),
        entry("prob.dist.beta_cdf", "Beta CDF", "probDist", "csOperation", vec![p("x", "x"), p("a", "\u{03B1}"), p("b", "\u{03B2}")], true),
        entry("prob.dist.gamma_pdf", "Gamma PDF", "probDist", "csOperation", vec![p("x", "x"), p("alpha", "\u{03B1} (shape)"), p("beta", "\u{03B2} (scale)")], true),
        entry("prob.dist.weibull_pdf", "Weibull PDF", "probDist", "csOperation", vec![p("x", "x"), p("k", "k (shape)"), p("lambda", "\u{03BB} (scale)")], true),

        // ── BLK-05: Expanded Electrical ─────────────────────────────────
        entry("eng.elec.RC_tau", "RC Time Constant", "engElectrical", "csOperation", vec![p("R", "R (\u{03A9})"), p("C", "C (F)")], true),
        entry("eng.elec.RL_tau", "RL Time Constant", "engElectrical", "csOperation", vec![p("R", "R (\u{03A9})"), p("L", "L (H)")], true),
        entry("eng.elec.RLC_f0", "RLC Resonant Frequency", "engElectrical", "csOperation", vec![p("L", "L (H)"), p("C", "C (F)")], true),
        entry("eng.elec.RLC_Q", "RLC Quality Factor", "engElectrical", "csOperation", vec![p("R", "R (\u{03A9})"), p("L", "L (H)"), p("C", "C (F)")], true),
        entry("eng.elec.V_divider", "Voltage Divider", "engElectrical", "csOperation", vec![p("Vin", "Vin (V)"), p("R1", "R1 (\u{03A9})"), p("R2", "R2 (\u{03A9})")], true),
        entry("eng.elec.I_divider", "Current Divider", "engElectrical", "csOperation", vec![p("Iin", "Iin (A)"), p("R1", "R1 (\u{03A9})"), p("R2", "R2 (\u{03A9})")], true),
        entry("eng.elec.Z_cap", "Capacitive Reactance", "engElectrical", "csOperation", vec![p("f", "f (Hz)"), p("C", "C (F)")], true),
        entry("eng.elec.Z_ind", "Inductive Reactance", "engElectrical", "csOperation", vec![p("f", "f (Hz)"), p("L", "L (H)")], true),
        entry("eng.elec.filter_fc", "RC Filter Cutoff", "engElectrical", "csOperation", vec![p("R", "R (\u{03A9})"), p("C", "C (F)")], true),
        entry("eng.elec.transformer_v2", "Transformer Voltage", "engElectrical", "csOperation", vec![p("V1", "V1 (V)"), p("N1", "N1 (turns)"), p("N2", "N2 (turns)")], true),
        entry("eng.elec.three_phase_P", "Three-Phase Power", "engElectrical", "csOperation", vec![p("VL", "VL (V)"), p("IL", "IL (A)"), p("pf", "pf")], true),
        entry("eng.elec.diode_shockley", "Diode Current (Shockley)", "engElectrical", "csOperation", vec![p("Is", "Is (A)"), p("V", "V (V)"), p("eta", "\u{03B7}"), p("Vt", "Vt (V)")], true),

        // ── Multibody Mechanics (items 2.48–2.51) ───────────────────────
        entry("eng.multibody.spring_force", "Spring Force F=kx", "engMechanics", "csOperation", vec![p("k", "k (N/m)"), p("x", "x (m)")], true),
        entry("eng.multibody.damper_force", "Damper Force F=bv", "engMechanics", "csOperation", vec![p("b", "b (N·s/m)"), p("v", "v (m/s)")], true),
        entry("eng.multibody.mass_accel", "Mass Acceleration a=F/m", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("m", "m (kg)")], true),
        entry("eng.multibody.smd_natural_freq", "SMD Natural Frequency", "engMechanics", "csOperation", vec![p("k", "k (N/m)"), p("m", "m (kg)"), p("b", "b (N·s/m)")], true),
        entry("eng.multibody.rigid_body_1d", "Rigid Body 1D", "engMechanics", "csOperation", vec![p("m", "m (kg)"), p("F", "F (N)"), p("v", "v (m/s)"), p("mu", "\u{03BC}"), p("Fn", "F_n (N)")], true),
        entry("eng.multibody.joint_revolute", "Revolute Joint \u{03B1}=\u{03C4}/I", "engMechanics", "csOperation", vec![p("tau", "\u{03C4} (N·m)"), p("I", "I (kg·m\u{00B2})")], true),
        entry("eng.multibody.joint_prismatic", "Prismatic Joint a=F/m", "engMechanics", "csOperation", vec![p("F", "F (N)"), p("m", "m (kg)")], true),
        entry("eng.multibody.dh_transform", "DH Transform Matrix", "engMechanics", "csOperation", vec![p("theta", "\u{03B8} (rad)"), p("d", "d (m)"), p("a", "a (m)"), p("alpha", "\u{03B1} (rad)")], true),
        entry("eng.multibody.contact_penalty", "Contact Model (Penalty)", "engMechanics", "csOperation", vec![p("k_p", "k_p (N/m)"), p("gap", "gap (m)"), p("mu", "\u{03BC}")], true),
        entry("eng.multibody.stribeck_friction", "Stribeck Friction", "engMechanics", "csOperation", vec![p("mu_s", "\u{03BC}_s"), p("mu_k", "\u{03BC}_k"), p("vs", "v_s (m/s)"), p("v", "v (m/s)"), p("Fn", "F_n (N)")], true),
        entry("eng.multibody.fk_2dof_planar", "FK 2-DOF Planar Arm", "engMechanics", "csOperation", vec![p("l1", "l\u{2081} (m)"), p("l2", "l\u{2082} (m)"), p("theta1", "\u{03B8}\u{2081} (rad)"), p("theta2", "\u{03B8}\u{2082} (rad)")], true),
        entry("eng.multibody.ik_2dof_planar", "IK 2-DOF Planar Arm", "engMechanics", "csOperation", vec![p("l1", "l\u{2081} (m)"), p("l2", "l\u{2082} (m)"), p("x", "x (m)"), p("y", "y (m)")], true),

        // ── Active Electronics (items 2.54–2.57) ────────────────────────
        entry("eng.elec.diode_iv", "Diode I-V (Exponential)", "engElectrical", "csOperation", vec![p("Is", "Is (A)"), p("V", "V (V)"), p("n", "n"), p("Vt", "Vt (V)")], true),
        entry("eng.elec.mosfet_id", "MOSFET Drain Current", "engElectrical", "csOperation", vec![p("kp", "kp (A/V\u{00B2})"), p("Vgs", "Vgs (V)"), p("Vth", "Vth (V)"), p("Vds", "Vds (V)")], true),
        entry("eng.elec.igbt_vce_drop", "IGBT Vce Drop", "engElectrical", "csOperation", vec![p("Vce0", "Vce0 (V)"), p("Ic", "Ic (A)"), p("Rce", "Rce (\u{03A9})")], true),
        entry("eng.elec.opamp_vout", "OpAmp Output", "engElectrical", "csOperation", vec![p("Vp", "V+ (V)"), p("Vm", "V- (V)"), p("A", "A (gain)"), p("Vcc", "Vcc (V)")], true),
        entry("eng.elec.pwm_duty", "PWM Average Output", "engElectrical", "csOperation", vec![p("Vdc", "Vdc (V)"), p("duty", "duty (0-1)")], true),
        entry("eng.elec.hbridge_vout", "H-Bridge Output", "engElectrical", "csOperation", vec![p("Vdc", "Vdc (V)"), p("duty_a", "duty_a"), p("duty_b", "duty_b")], true),
        entry("eng.elec.three_phase_spwm", "3-Phase SPWM Voltage", "engElectrical", "csOperation", vec![p("Vdc", "Vdc (V)"), p("m", "m (mod. index)")], true),
        entry("eng.elec.dc_motor", "DC Motor Steady-State", "engElectrical", "csOperation", vec![p("V", "V (V)"), p("Ia", "Ia (A)"), p("Ra", "Ra (\u{03A9})"), p("Ke", "Ke (V·s/rad)"), p("Kt", "Kt (N·m/A)")], true),
        entry("eng.elec.pmsm_torque", "PMSM Torque (dq-frame)", "engElectrical", "csOperation", vec![p("P", "P (pole pairs)"), p("lambda", "\u{03BB} (Wb)"), p("Ld", "Ld (H)"), p("Lq", "Lq (H)"), p("id", "id (A)"), p("iq", "iq (A)")], true),
        entry("eng.elec.pmsm_vd_vq", "PMSM Vd/Vq Equations", "engElectrical", "csOperation", vec![p("Rs", "Rs (\u{03A9})"), p("Ld", "Ld (H)"), p("Lq", "Lq (H)"), p("lambda", "\u{03BB} (Wb)"), p("omega", "\u{03C9}_e (rad/s)"), p("id", "id (A)"), p("iq", "iq (A)")], true),
        entry("eng.elec.battery_thevenin", "Battery (Thevenin ECM)", "engElectrical", "csOperation", vec![p("OCV", "OCV (V)"), p("I", "I (A)"), p("R0", "R0 (\u{03A9})"), p("R1", "R1 (\u{03A9})"), p("C1", "C1 (F)"), p("dt", "dt (s)")], true),
        entry("eng.elec.battery_soc", "Battery SOC Update", "engElectrical", "csOperation", vec![p("SOC0", "SOC0 (0-1)"), p("I", "I (A)"), p("dt", "dt (s)"), p("Q_nom", "Q_nom (Ah)")], true),

        // ── Thermal Network (item 2.59) ──────────────────────────────────
        entry("eng.thermal.conductor_R", "Thermal Conduction Q=k\u{00B7}A\u{00B7}\u{0394}T/L", "engThermo", "csOperation", vec![p("L", "L (m)"), p("k", "k (W/mK)"), p("A", "A (m\u{00B2})"), p("dT", "\u{0394}T (K)")], true),
        entry("eng.thermal.capacitor_dT", "Thermal Mass \u{0394}T=Q\u{00B7}dt/(m\u{00B7}c)", "engThermo", "csOperation", vec![p("m", "m (kg)"), p("c", "c (J/kgK)"), p("Q", "Q (W)"), p("dt", "dt (s)")], true),
        entry("eng.thermal.convection", "Convection Q=h\u{00B7}A\u{00B7}\u{0394}T", "engThermo", "csOperation", vec![p("h", "h (W/m\u{00B2}K)"), p("A", "A (m\u{00B2})"), p("Ts", "T_s (K)"), p("Tf", "T_f (K)")], true),
        entry("eng.thermal.radiation", "Radiation Q=\u{03B5}\u{03C3}A(T\u{2074}-T_amb\u{2074})", "engThermo", "csOperation", vec![p("eps", "\u{03B5}"), p("A", "A (m\u{00B2})"), p("Ts", "T_s (K)"), p("Tamb", "T_amb (K)")], true),

        // ── Heat Exchanger (item 2.60) ───────────────────────────────────
        entry("eng.thermal.hx_lmtd", "Heat Exchanger (LMTD)", "engThermo", "csOperation", vec![p("U", "U (W/m\u{00B2}K)"), p("A", "A (m\u{00B2})"), p("dT1", "\u{0394}T1 (K)"), p("dT2", "\u{0394}T2 (K)")], true),
        entry("eng.thermal.hx_ntu", "Heat Exchanger (\u{03B5}-NTU)", "engThermo", "csOperation", vec![p("NTU", "NTU"), p("Cr", "C_r"), p("Q_max", "Q_max (W)")], true),

        // ── Pipe / Valve / Pump / Hydraulics (items 2.61–2.63) ──────────
        entry("eng.fluids.pipe_dp", "Pipe Pressure Drop (Darcy-Weisbach)", "engFluids", "csOperation", vec![p("f", "f (Darcy)"), p("L", "L (m)"), p("D", "D (m)"), p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)"), p("K_minor", "K_minor")], true),
        entry("eng.fluids.valve_cv", "Valve Flow (Cv)", "engFluids", "csOperation", vec![p("Cv", "Cv"), p("dP", "\u{0394}P (bar)"), p("SG", "SG")], true),
        entry("eng.fluids.pump_power", "Pump Power", "engFluids", "csOperation", vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("g", "g (m/s\u{00B2})"), p("H", "H (m)"), p("Q", "Q (m\u{00B3}/s)"), p("eta", "\u{03B7}")], true),
        entry("eng.fluids.orifice_flow", "Orifice Flow (Cd)", "engFluids", "csOperation", vec![p("Cd", "Cd"), p("A", "A (m\u{00B2})"), p("dP", "\u{0394}P (Pa)"), p("rho", "\u{03C1} (kg/m\u{00B3})")], true),
        entry("eng.fluids.accumulator", "Gas Accumulator P2=P1(V1/V2)^\u{03B3}", "engFluids", "csOperation", vec![p("P1", "P1 (Pa)"), p("V1", "V1 (m\u{00B3})"), p("V2", "V2 (m\u{00B3})"), p("gamma", "\u{03B3}")], true),
        entry("eng.fluids.hydraulic_cylinder", "Hydraulic Cylinder", "engFluids", "csOperation", vec![p("P_bore", "P_bore (Pa)"), p("A_bore", "A_bore (m\u{00B2})"), p("P_rod", "P_rod (Pa)"), p("A_rod", "A_rod (m\u{00B2})"), p("Q", "Q (m\u{00B3}/s)")], true),
        entry("eng.fluids.hydraulic_motor", "Hydraulic Motor", "engFluids", "csOperation", vec![p("dP", "\u{0394}P (Pa)"), p("D", "D (m\u{00B3}/rev)"), p("Q", "Q (m\u{00B3}/s)"), p("eta", "\u{03B7}")], true),
        entry("eng.fluids.water_density", "Water Density \u{03C1}(T)", "engFluids", "csOperation", vec![p("T", "T (\u{00B0}C)")], true),
        entry("eng.fluids.water_viscosity", "Water Viscosity \u{03BC}(T)", "engFluids", "csOperation", vec![p("T", "T (\u{00B0}C)")], true),
        entry("eng.fluids.oil_viscosity", "Oil Viscosity (Walther ASTM D341)", "engFluids", "csOperation", vec![p("nu40", "\u{03BD}40 (cSt)"), p("nu100", "\u{03BD}100 (cSt)"), p("T", "T (\u{00B0}C)")], true),

        // ── BLK-01: Chemical Engineering ────────────────────────────────
        entry("chem.ideal_gas_n", "n = PV/RT", "chem", "csOperation", vec![p("P", "P (Pa)"), p("V", "V (m3)"), p("R", "R (J/molK)"), p("T", "T (K)")], true),
        entry("chem.antoine_vp", "Antoine VP", "chem", "csOperation", vec![p("A", "A"), p("B", "B"), p("C", "C"), p("T", "T (C)")], true),
        entry("chem.raoults_partial", "Raoult's P_partial", "chem", "csOperation", vec![p("x", "x (mol frac)"), p("Psat", "P_sat")], true),
        entry("chem.equilibrium_K", "K = exp(-dG/RT)", "chem", "csOperation", vec![p("dG", "dG (J/mol)"), p("R", "R (J/molK)"), p("T", "T (K)")], true),
        entry("chem.arrhenius_rate", "k = A*exp(-Ea/RT)", "chem", "csOperation", vec![p("A", "A (pre-exp)"), p("Ea", "Ea (J/mol)"), p("R", "R (J/molK)"), p("T", "T (K)")], true),
        entry("chem.heat_reaction", "dH_rxn", "chem", "csOperation", vec![p("H_prod", "H_products"), p("H_react", "H_reactants")], true),
        entry("chem.mole_fraction", "x = n/n_total", "chem", "csOperation", vec![p("n_comp", "n_comp (mol)"), p("n_total", "n_total (mol)")], true),
        entry("chem.ficks_flux", "Fick's Flux J", "chem", "csOperation", vec![p("D", "D (m2/s)"), p("dC_dx", "dC/dx (mol/m4)")], true),
        entry("chem.CSTR_conv", "CSTR X (1st order)", "chem", "csOperation", vec![p("k", "k (s-1)"), p("tau", "tau (s)")], true),
        entry("chem.enthalpy_sensible", "dH = Cp*dT", "chem", "csOperation", vec![p("Cp", "Cp (J/molK)"), p("T1", "T1 (K)"), p("T2", "T2 (K)")], true),

        // ── BLK-02: Structural Engineering ──────────────────────────────
        entry("struct.beam_deflect_ss", "delta = PL3/48EI", "structural", "csOperation", vec![p("P", "P (N)"), p("L", "L (m)"), p("E", "E (Pa)"), p("I", "I (m4)")], true),
        entry("struct.beam_deflect_cantilever", "delta = PL3/3EI", "structural", "csOperation", vec![p("P", "P (N)"), p("L", "L (m)"), p("E", "E (Pa)"), p("I", "I (m4)")], true),
        entry("struct.beam_moment_ss", "M = Pab/L", "structural", "csOperation", vec![p("P", "P (N)"), p("a", "a (m)"), p("b", "b (m)"), p("L", "L (m)")], true),
        entry("struct.euler_buckling", "P_cr = pi2EI/(KL)2", "structural", "csOperation", vec![p("E", "E (Pa)"), p("I", "I (m4)"), p("L", "L (m)"), p("K", "K (eff. len)")], true),
        entry("struct.von_mises", "sigma_vm (Von Mises)", "structural", "csOperation", vec![p("sx", "sx (Pa)"), p("sy", "sy (Pa)"), p("txy", "txy (Pa)")], true),
        entry("struct.combined_stress", "sigma = sigma_ax + sigma_bend", "structural", "csOperation", vec![p("s_ax", "s_axial (Pa)"), p("s_bend", "s_bending (Pa)")], true),
        entry("struct.steel_check", "Util = sigma/(Fy*phi)", "structural", "csOperation", vec![p("sigma", "sigma (Pa)"), p("Fy", "F_y (Pa)"), p("phi", "phi")], true),
        entry("struct.bearing_capacity", "q_ult (Terzaghi)", "structural", "csOperation", vec![p("c", "c (Pa)"), p("gamma", "gamma (kN/m3)"), p("D", "D_f (m)"), p("B", "B (m)"), p("Nc", "N_c"), p("Nq", "N_q"), p("Ngamma", "N_gamma")], true),
        entry("struct.concrete_moment_aci", "M_n (ACI)", "structural", "csOperation", vec![p("fc", "f'c (Pa)"), p("b", "b (m)"), p("d", "d (m)"), p("As", "A_s (m2)"), p("fy", "f_y (Pa)")], true),

        // ── BLK-03: Aerospace Engineering ───────────────────────────────
        entry("aero.ISA_T", "ISA T(h)", "aerospace", "csOperation", vec![p("h", "h (m)")], true),
        entry("aero.ISA_P", "ISA P(h)", "aerospace", "csOperation", vec![p("h", "h (m)")], true),
        entry("aero.ISA_rho", "ISA rho(h)", "aerospace", "csOperation", vec![p("h", "h (m)")], true),
        entry("aero.ISA_a", "ISA a(h)", "aerospace", "csOperation", vec![p("h", "h (m)")], true),
        entry("aero.mach_from_v", "M = v/a", "aerospace", "csOperation", vec![p("v", "v (m/s)"), p("a", "a (m/s)")], true),
        entry("aero.dynamic_q", "q = 0.5*rho*v2", "aerospace", "csOperation", vec![p("rho", "rho (kg/m3)"), p("v", "v (m/s)")], true),
        entry("aero.lift", "L = CL*q*S", "aerospace", "csOperation", vec![p("CL", "C_L"), p("q", "q (Pa)"), p("S", "S (m2)")], true),
        entry("aero.drag", "D = CD*q*S", "aerospace", "csOperation", vec![p("CD", "C_D"), p("q", "q (Pa)"), p("S", "S (m2)")], true),
        entry("aero.tsfc", "TSFC", "aerospace", "csOperation", vec![p("thrust", "Thrust (N)"), p("fuel_flow", "fuel_flow (kg/s)")], true),
        entry("aero.tsiolkovsky", "dv = Isp*g0*ln(m0/mf)", "aerospace", "csOperation", vec![p("Isp", "Isp (s)"), p("g0", "g0 (m/s2)"), p("m0", "m0 (kg)"), p("mf", "mf (kg)")], true),
        entry("aero.orbital_v", "v = sqrt(GM/r)", "aerospace", "csOperation", vec![p("GM", "GM (m3/s2)"), p("r", "r (m)")], true),
        entry("aero.escape_v", "v_esc = sqrt(2GM/r)", "aerospace", "csOperation", vec![p("GM", "GM (m3/s2)"), p("r", "r (m)")], true),
        entry("aero.hohmann_dv1", "Hohmann dv1", "aerospace", "csOperation", vec![p("GM", "GM (m3/s2)"), p("r1", "r1 (m)"), p("r2", "r2 (m)")], true),
        entry("aero.hohmann_dv2", "Hohmann dv2", "aerospace", "csOperation", vec![p("GM", "GM (m3/s2)"), p("r1", "r1 (m)"), p("r2", "r2 (m)")], true),

        // ── BLK-04: Control Systems ──────────────────────────────────────
        entry("ctrl.step_1st_order", "Step 1st Order", "controlSystems", "csOperation", vec![p("K", "K (gain)"), p("tau", "tau (s)"), p("t", "t (s)")], true),
        entry("ctrl.step_2nd_order", "Step 2nd Order", "controlSystems", "csOperation", vec![p("K", "K (gain)"), p("wn", "wn (rad/s)"), p("zeta", "zeta"), p("t", "t (s)")], true),
        entry("ctrl.pid_output", "PID Output", "controlSystems", "csOperation", vec![p("Kp", "K_p"), p("Ki", "K_i"), p("Kd", "K_d"), p("error", "e(t)"), p("integral", "int e dt"), p("dt", "dt (s)")], true),
        entry("ctrl.rms", "RMS", "controlSystems", "csOperation", vec![p("y", "y (vector)")], true),
        entry("ctrl.peak2peak", "Peak-to-Peak", "controlSystems", "csOperation", vec![p("y", "y (vector)")], true),
        entry("ctrl.settling_time_2pct", "t_s = 4*tau", "controlSystems", "csOperation", vec![p("tau", "tau (s)")], true),
        entry("ctrl.overshoot_2nd", "%OS", "controlSystems", "csOperation", vec![p("zeta", "zeta (damping)")], true),
        entry("ctrl.natural_freq", "wn = sqrt(k/m)", "controlSystems", "csOperation", vec![p("k", "k (N/m)"), p("m", "m (kg)")], true),
        entry("ctrl.damping_ratio", "zeta = c/(2*sqrt(km))", "controlSystems", "csOperation", vec![p("c", "c (Ns/m)"), p("k", "k (N/m)"), p("m", "m (kg)")], true),
        entry("ctrl.bode_mag_1st", "|H(jw)| 1st Order", "controlSystems", "csOperation", vec![p("K", "K (gain)"), p("omega", "omega (rad/s)"), p("tau", "tau (s)")], true),

        // ── BLK-06: Life Sciences ────────────────────────────────────────
        entry("bio.michaelis_menten", "Michaelis-Menten", "lifeSci", "csOperation", vec![p("Vmax", "V_max"), p("Km", "K_m"), p("S", "[S]")], true),
        entry("bio.hill_eq", "Hill Equation", "lifeSci", "csOperation", vec![p("n", "n (Hill coef)"), p("Kd", "K_d"), p("L", "[L]")], true),
        entry("bio.logistic_growth", "Logistic Growth", "lifeSci", "csOperation", vec![p("r", "r (growth rate)"), p("K", "K (capacity)"), p("N0", "N0 (initial)"), p("t", "t")], true),
        entry("bio.exp_decay", "N = N0*e^(-lambda*t)", "lifeSci", "csOperation", vec![p("N0", "N0"), p("lambda", "lambda (decay rate)"), p("t", "t")], true),
        entry("bio.half_life", "t1/2 = ln2/lambda", "lifeSci", "csOperation", vec![p("lambda", "lambda (decay rate)")], true),
        entry("bio.drug_1cmp", "1-Compartment PK", "lifeSci", "csOperation", vec![p("D", "D (dose)"), p("V", "V_d (L)"), p("k", "k_el (1/h)"), p("t", "t (h)")], true),
        entry("bio.henderson_hasselbalch", "Henderson-Hasselbalch", "lifeSci", "csOperation", vec![p("pKa", "pKa"), p("A", "[A-]"), p("HA", "[HA]")], true),
        entry("bio.nernst", "Nernst Equation", "lifeSci", "csOperation", vec![p("R", "R (J/molK)"), p("T", "T (K)"), p("z", "z (valence)"), p("F", "F (C/mol)"), p("C_out", "[out]"), p("C_in", "[in]")], true),
        entry("bio.BMI", "BMI", "lifeSci", "csOperation", vec![p("mass_kg", "mass (kg)"), p("height_m", "height (m)")], true),
        entry("bio.BSA_dubois", "BSA (DuBois)", "lifeSci", "csOperation", vec![p("W_kg", "W (kg)"), p("H_cm", "H (cm)")], true),

        // ── BLK-07: Finance Options ──────────────────────────────────────
        entry("fin.options.bs_call", "Black-Scholes Call", "finOptions", "csOperation", vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], true),
        entry("fin.options.bs_put", "Black-Scholes Put", "finOptions", "csOperation", vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], true),
        entry("fin.options.bs_delta", "BS Delta", "finOptions", "csOperation", vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], true),
        entry("fin.options.bs_gamma", "BS Gamma", "finOptions", "csOperation", vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], true),
        entry("fin.options.bs_vega", "BS Vega", "finOptions", "csOperation", vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], true),
        entry("fin.options.kelly", "Kelly Criterion", "finOptions", "csOperation", vec![p("p_win", "p (win prob)"), p("b", "b (odds)")], true),
        entry("fin.options.var_hist", "VaR (historical)", "finOptions", "csOperation", vec![p("returns", "Returns (vector)"), p("conf", "Confidence")], true),
        entry("fin.options.cvar_hist", "CVaR (historical)", "finOptions", "csOperation", vec![p("returns", "Returns (vector)"), p("conf", "Confidence")], true),
        entry("fin.options.bond_duration", "Macaulay Duration", "finOptions", "csOperation", vec![p("coupon", "Coupon ($)"), p("face", "Face ($)"), p("ytm", "YTM"), p("n", "n (periods)")], true),
        entry("fin.options.dcf", "DCF Valuation", "finOptions", "csOperation", vec![p("fcf", "FCF ($)"), p("wacc", "WACC"), p("g", "g (terminal)"), p("n", "n (years)")], true),

        // ── BLK-09: Date & Time ──────────────────────────────────────────
        entry("date.from_ymd", "Date from Y/M/D", "dateTime", "csOperation", vec![p("y", "Year"), p("m", "Month"), p("d", "Day")], true),
        entry("date.year", "Year of date", "dateTime", "csOperation", vec![p("day", "date (days)")], true),
        entry("date.month", "Month of date", "dateTime", "csOperation", vec![p("day", "date (days)")], true),
        entry("date.day_of_month", "Day of month", "dateTime", "csOperation", vec![p("day", "date (days)")], true),
        entry("date.days_between", "Days Between", "dateTime", "csOperation", vec![p("d1", "Date 1"), p("d2", "Date 2")], true),
        entry("date.add_days", "Add Days", "dateTime", "csOperation", vec![p("d", "Date"), p("n", "n (days)")], true),
        entry("date.is_leap_year", "Is Leap Year", "dateTime", "csOperation", vec![p("y", "Year")], true),
        entry("date.days_in_month", "Days in Month", "dateTime", "csOperation", vec![p("m", "Month"), p("y", "Year")], true),

        // ── BLK-08: Text / String (SCI-08 text) ──────────────────────────
        entry("num_to_text", "Number to Text", "text", "csOperation", vec![p("value", "Value"), p("format", "Format")], false),
        variadic_entry("text_concat", "Concat Text", "text", "csOperation", vec![p("a", "A"), p("b", "B")], false, 2, 64),
        entry("text_length", "Text Length", "text", "csOperation", vec![p("text", "Text")], false),
        entry("text_to_num", "Text to Number", "text", "csOperation", vec![p("text", "Text")], false),

        // ── SCI-04: Interval Arithmetic ───────────────────────────────────
        entry("interval_from", "Interval (center ± hw)", "interval", "csOperation", vec![p("center", "Center"), p("half_width", "±hw")], true),
        entry("interval_from_bounds", "Interval [lo, hi]", "interval", "csOperation", vec![p("lo", "Lo"), p("hi", "Hi")], true),
        entry("interval_lo", "Interval Lo", "interval", "csOperation", vec![p("interval", "Interval")], true),
        entry("interval_hi", "Interval Hi", "interval", "csOperation", vec![p("interval", "Interval")], true),
        entry("interval_mid", "Interval Mid", "interval", "csOperation", vec![p("interval", "Interval")], true),
        entry("interval_width", "Interval Width", "interval", "csOperation", vec![p("interval", "Interval")], true),
        entry("interval_contains", "Interval Contains", "interval", "csOperation", vec![p("interval", "Interval"), p("x", "x")], true),
        entry("interval_add", "Interval Add", "interval", "csOperation", vec![p("a", "A"), p("b", "B")], true),
        entry("interval_sub", "Interval Subtract", "interval", "csOperation", vec![p("a", "A"), p("b", "B")], true),
        entry("interval_mul", "Interval Multiply", "interval", "csOperation", vec![p("a", "A"), p("b", "B")], true),
        entry("interval_div", "Interval Divide", "interval", "csOperation", vec![p("a", "A"), p("b", "B")], true),
        entry("interval_pow", "Interval Power", "interval", "csOperation", vec![p("a", "A"), p("b", "B")], true),

        // ── SCI-08: Complex Numbers ───────────────────────────────────────
        entry("complex_from", "Complex From Re/Im", "complex", "csOperation", vec![p("re", "Re"), p("im", "Im")], true),
        entry("complex_re", "Real Part", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_im", "Imaginary Part", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_mag", "Magnitude |z|", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_arg", "Argument ∠z", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_conj", "Conjugate z*", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_add", "Complex Add", "complex", "csOperation", vec![p("a", "z₁"), p("b", "z₂")], true),
        entry("complex_mul", "Complex Multiply", "complex", "csOperation", vec![p("a", "z₁"), p("b", "z₂")], true),
        entry("complex_div", "Complex Divide", "complex", "csOperation", vec![p("a", "z₁"), p("b", "z₂")], true),
        entry("complex_exp", "Complex Exp eᶻ", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_ln", "Complex Ln", "complex", "csOperation", vec![p("z", "z")], true),
        entry("complex_pow", "Complex Power", "complex", "csOperation", vec![p("z", "z"), p("n", "n")], true),

        // ── SCI-09: Matrix Operations ─────────────────────────────────────
        entry("matrix_from_table", "Table to Matrix", "matrix", "csOperation", vec![p("table", "Table")], true),
        entry("matrix_to_table", "Matrix to Table", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_multiply", "Matrix Multiply", "matrix", "csOperation", vec![p("a", "A"), p("b", "B")], true),
        entry("matrix_transpose", "Matrix Transpose", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_inverse", "Matrix Inverse", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_det", "Determinant", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_trace", "Trace", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_solve", "Solve Ax = b", "matrix", "csOperation", vec![p("a", "A (matrix)"), p("b", "b (vector)")], true),
        entry("matrix_lu", "LU Decompose", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_qr", "QR Decompose", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_svd", "SVD", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_cholesky", "Cholesky", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_eigen", "Eigendecomposition", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_schur", "Schur Decompose", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),
        entry("matrix_cond", "Condition Number", "matrix", "csOperation", vec![p("matrix", "Matrix")], true),

        // ── Rootfinding ──────────────────────────────────────────────────
        entry("root_newton", "Newton-Raphson Root", "numerical", "csOperation", vec![p("x0", "Initial Guess")], true),
        entry("root_brent", "Brent Root", "numerical", "csOperation", vec![p("a", "Bracket a"), p("b", "Bracket b")], true),
        entry("root_polynomial", "Polynomial Roots", "numerical", "csOperation", vec![p("coeffs", "Coefficients")], true),

        // ── Numerical Integration ────────────────────────────────────────
        entry("integrate_gk", "Gauss-Kronrod Integral", "numerical", "csOperation", vec![p("a", "Lower Bound"), p("b", "Upper Bound")], true),
        entry("integrate_cc", "Clenshaw-Curtis Integral", "numerical", "csOperation", vec![p("a", "Lower Bound"), p("b", "Upper Bound")], true),
        entry("integrate_mc", "Monte Carlo Integral", "numerical", "csOperation", vec![p("a", "Lower Bound"), p("b", "Upper Bound")], true),

        // ── Curve Fitting ────────────────────────────────────────────────
        entry("curve_fit_poly", "Polynomial Fit", "numerical", "csOperation", vec![p("x", "X Data"), p("y", "Y Data")], false),
        entry("curve_fit_lm", "Curve Fit (LM)", "numerical", "csOperation", vec![p("x", "X Data"), p("y", "Y Data")], true),

        // ── Norms ────────────────────────────────────────────────────────
        entry("norm_l1", "L1 Norm", "math", "csOperation", vec![p("a", "Input")], false),
        entry("norm_l2", "L2 Norm", "math", "csOperation", vec![p("a", "Input")], false),
        entry("norm_linf", "L-Infinity Norm", "math", "csOperation", vec![p("a", "Input")], false),
        entry("norm_frobenius", "Frobenius Norm", "math", "csOperation", vec![p("a", "Input")], false),

        // ── Interpolation ───────────────────────────────────────────────
        entry("interp_cubic_spline", "Cubic Spline Interpolation", "numerical", "csOperation", vec![p("xs", "X Points"), p("ys", "Y Points"), p("query", "Query")], false),
        entry("interp_akima", "Akima Interpolation", "numerical", "csOperation", vec![p("xs", "X Points"), p("ys", "Y Points"), p("query", "Query")], false),
        entry("interp_bspline", "B-Spline Evaluation", "numerical", "csOperation", vec![p("ctrl", "Control Points"), p("query", "Parameter t")], false),

        // ── Random Number Generation ────────────────────────────────────
        entry("rng_uniform", "Random Uniform", "numerical", "csOperation", vec![p("lo", "Lower Bound"), p("hi", "Upper Bound")], false),
        entry("rng_lhs", "Latin Hypercube Sample", "numerical", "csOperation", vec![], false),
        entry("rng_sobol", "Sobol Sequence", "numerical", "csOperation", vec![], false),
        entry("rng_halton", "Halton Sequence", "numerical", "csOperation", vec![], false),
        entry("rng_normal", "Random Normal", "numerical", "csOperation", vec![p("mu", "Mean"), p("sigma", "Std Dev")], false),
        entry("rng_lognormal", "Random Log-Normal", "numerical", "csOperation", vec![p("mu", "Log Mean"), p("sigma", "Log Std Dev")], false),

        // ── BLK-10: Lookup Table Interpolation ───────────────────────────
        entry("lookup.1d", "Lookup Table 1D", "tableOps", "csOperation", vec![p("x_vec", "X (vector)"), p("y_vec", "Y (vector)"), p("x", "Query X")], false),
        entry("lookup.2d", "Lookup Table 2D", "tableOps", "csOperation", vec![p("x_vec", "X axis"), p("y_vec", "Y axis"), p("z_mat", "Z (table)"), p("x", "Query X"), p("y", "Query Y")], false),

        // ── SCI-12: Signal Processing / FFT ──────────────────────────────
        entry("signal.fft_magnitude", "FFT Magnitude", "signal", "csOperation", vec![p("y", "y (vector)")], true),
        entry("signal.fft_power", "FFT Power", "signal", "csOperation", vec![p("y", "y (vector)")], true),
        entry("signal.fft_freq_bins", "FFT Freq Bins", "signal", "csOperation", vec![p("n", "N (samples)"), p("sample_rate", "fs (Hz)")], true),
        entry("signal.window_hann", "Hann Window", "signal", "csOperation", vec![p("n", "N (length)")], true),
        entry("signal.window_hamming", "Hamming Window", "signal", "csOperation", vec![p("n", "N (length)")], true),
        entry("signal.window_blackman", "Blackman Window", "signal", "csOperation", vec![p("n", "N (length)")], true),
        entry("signal.filter_lowpass_fir", "Low-pass FIR Filter", "signal", "csOperation", vec![p("y", "y (vector)"), p("cutoff_norm", "f_c/f_s"), p("taps", "Taps")], true),
        entry("signal.filter_highpass_fir", "High-pass FIR Filter", "signal", "csOperation", vec![p("y", "y (vector)"), p("cutoff_norm", "f_c/f_s"), p("taps", "Taps")], true),
        // IIR filter design and application
        entry("signal.filter_butter", "Butterworth IIR Filter", "signal", "csOperation", vec![p("y", "Signal"), p("cutoff", "Cutoff (0-1)")], true),
        entry("signal.filter_cheby1", "Chebyshev I IIR Filter", "signal", "csOperation", vec![p("y", "Signal"), p("cutoff", "Cutoff (0-1)")], true),
        entry("signal.filter_zero_phase", "Zero-Phase Filter", "signal", "csOperation", vec![p("y", "Signal"), p("cutoff", "Cutoff (0-1)")], true),

        // ── Optimization ──────────────────────────────────────────────
        entry("optim.designVariable", "Design Variable", "optimization", "csSource", vec![], false),
        entry("optim.objectiveFunction", "Objective Function", "optimization", "csOperation", vec![p("value", "Value to minimize")], false),
        entry("optim.gradientDescent", "Gradient Descent", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], false),
        entry("optim.geneticAlgorithm", "Genetic Algorithm", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], false),
        entry("optim.nelderMead", "Nelder-Mead", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], false),
        entry("optim.lbfgsb", "L-BFGS-B", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], true),
        entry("optim.cmaes", "CMA-ES", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], true),
        entry("optim.convergencePlot", "Convergence Plot", "optimization", "csPlot", vec![p("data", "Optimizer output")], false),
        entry("optim.resultsTable", "Optimization Results", "optimization", "csDisplay", vec![p("data", "Optimizer output")], false),
        entry("optim.parametricSweep", "Parametric Sweep", "optimization", "csOperation", vec![p("objective", "Function"), p("variable", "Variable")], false),
        entry("optim.monteCarlo", "Monte Carlo", "optimization", "csOperation", vec![p("objective", "Function"), p("variables", "Variables")], false),
        entry("optim.sensitivity", "Sensitivity Analysis", "optimization", "csOperation", vec![p("objective", "Function"), p("variables", "Variables")], false),
        entry("optim.doe", "Design of Experiments", "optimization", "csOperation", vec![p("variables", "Variables")], false),
        entry("optim.responseSurface", "Response Surface", "optimization", "csOperation", vec![p("x", "Feature columns (table)"), p("y", "Response vector")], true),
        entry("optim.sqp", "SQP", "optimization", "csOptimizer", vec![p("objective", "Objective"), p("variables", "Variables"), p("eq_constraints", "Equality constraints"), p("ineq_constraints", "Inequality constraints")], true),
        entry("optim.trustRegion", "Trust-Region", "optimization", "csOptimizer", vec![p("objective", "Objective"), p("variables", "Variables")], true),
        entry("optim.uqPce", "UQ / PCE", "optimization", "csOperation", vec![p("x", "Samples (table)"), p("y", "Responses")], true),
        entry("optim.form", "FORM Reliability", "optimization", "csOperation", vec![p("variables", "Variables")], true),
        entry("optim.robustDesign", "Robust Design", "optimization", "csOperation", vec![p("objective", "Objective"), p("variables", "Variables")], true),
        entry("optim.topologyOpt", "Topology Optimisation", "optimization", "csOperation", vec![], true),
        entry("optim.paramEst", "Parameter Estimation", "optimization", "csOperation", vec![p("data", "Observed data (table)"), p("y0", "Initial state")], true),
        entry("optim.bayesian", "Bayesian Optimisation", "optimization", "csOperation", vec![p("variables", "Variables")], true),
        entry("optim.nsga3", "NSGA-III", "optimization", "csOperation", vec![p("variables", "Variables")], true),

        // ── Machine Learning ──────────────────────────────────────────
        entry("ml.trainTestSplit", "Train/Test Split", "machineLearning", "csOperation", vec![p("data", "Dataset (table)")], false),
        entry("ml.linearRegression", "Linear Regression", "machineLearning", "csOperation", vec![p("trainX", "Training features"), p("trainY", "Training labels")], false),
        entry("ml.polynomialRegression", "Polynomial Regression", "machineLearning", "csOperation", vec![p("trainX", "Training features"), p("trainY", "Training labels")], false),
        entry("ml.knnClassifier", "KNN Classifier", "machineLearning", "csOperation", vec![p("trainX", "Training features"), p("trainY", "Training labels")], false),
        entry("ml.decisionTree", "Decision Tree", "machineLearning", "csOperation", vec![p("trainX", "Training features"), p("trainY", "Training labels")], false),
        entry("ml.predict", "ML Predict", "machineLearning", "csOperation", vec![p("model", "Trained model"), p("data", "New data")], false),
        entry("ml.mse", "Mean Squared Error", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("predicted", "Predicted")], false),
        entry("ml.r2", "R² Score", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("predicted", "Predicted")], false),
        entry("ml.confusionMatrix", "Confusion Matrix", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("predicted", "Predicted")], false),

        // ── Neural Network ────────────────────────────────────────────
        entry("nn.input", "NN Input", "neuralNetworks", "csSource", vec![], true),
        entry("nn.dense", "Dense Layer", "neuralNetworks", "csOperation", vec![p("input", "Input")], true),
        entry("nn.conv1d", "Conv1D Layer", "neuralNetworks", "csOperation", vec![p("input", "Input")], true),
        entry("nn.dropout", "Dropout Layer", "neuralNetworks", "csOperation", vec![p("input", "Input")], true),
        entry("nn.activation", "Activation", "neuralNetworks", "csOperation", vec![p("input", "Input")], true),
        entry("nn.sequential", "Sequential Model", "neuralNetworks", "csOperation", vec![p("layers", "Layers")], true),
        entry("nn.trainer", "NN Trainer", "neuralNetworks", "csOperation", vec![p("model", "Model"), p("trainX", "Training data"), p("trainY", "Training labels")], true),
        entry("nn.predict", "NN Predict", "neuralNetworks", "csOperation", vec![p("model", "Trained model"), p("data", "Input data")], true),
        entry("nn.export", "NN Export", "neuralNetworks", "csOperation", vec![p("model", "Trained model")], true),
        entry("nn.lstm", "LSTM", "neuralNetworks", "csOperation", vec![p("sequence", "Sequence (table)")], true),
        entry("nn.gru", "GRU", "neuralNetworks", "csOperation", vec![p("sequence", "Sequence (table)")], true),
        entry("nn.attention", "Attention", "neuralNetworks", "csOperation", vec![p("query", "Query (table)"), p("key", "Key (table)"), p("value", "Value (table)")], true),
        entry("nn.conv2d", "Conv2D", "neuralNetworks", "csOperation", vec![p("input", "Input (Matrix/Table)")], true),

        // ── Symbolic Math (CAS) ────────────────────────────────────────
        entry("sym.differentiate", "Differentiate", "math", "csOperation", vec![p("expr", "Expression (text)"), p("var", "Variable (text)")], true),
        entry("sym.integrate", "Integrate", "math", "csOperation", vec![p("expr", "Expression (text)"), p("var", "Variable (text)")], true),
        entry("sym.simplify", "Simplify", "math", "csOperation", vec![p("expr", "Expression (text)")], true),
        entry("sym.expand", "Expand", "math", "csOperation", vec![p("expr", "Expression (text)")], true),
        entry("sym.substitute", "Substitute", "math", "csOperation", vec![p("expr", "Expression (text)"), p("var", "Variable (text)"), p("value", "Value")], true),

        // ── ODE Solvers (Phase 4) ──────────────────────────────────────
        entry("ode.rk4", "ODE Solver (RK4)", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial state")], true),
        entry("ode.rk45", "ODE Solver (Adaptive)", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial state")], true),
        entry("ode.event", "ODE Event Solver", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial state")], true),
        entry("ode.symplectic", "Symplectic ODE Solver", "odeSolvers", "csOperation", vec![p("accelerations", "Accelerations (text)"), p("y0", "Initial state [q, v]")], true),
        entry("ode.steady_state", "Steady-State Solver", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial guess")], true),
        entry("ode.bdf", "ODE Solver (BDF)", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial state")], true),
        entry("ode.radau", "ODE Solver (Radau)", "odeSolvers", "csOperation", vec![p("equations", "Equations (text)"), p("y0", "Initial state")], true),
        entry("ode.dae", "DAE Solver", "odeSolvers", "csOperation", vec![p("diff_eqs", "Differential eqs (text)"), p("alg_eqs", "Algebraic eqs (text)"), p("y0", "Diff initial state"), p("z0", "Alg initial guess")], true),
        entry("ode.pde1d", "PDE 1D Solver", "odeSolvers", "csOperation", vec![p("u0", "Initial condition (vector)")], true),

        // ── Vehicle Simulation (Phase 5) ───────────────────────────────
        entry("veh.tire.lateralForce", "Pacejka Lateral Fy", "vehicleSim", "csOperation", vec![p("slip_angle", "Slip angle (rad)"), p("Fz", "Fz (N)"), p("B", "B"), p("C", "C"), p("D", "D"), p("E", "E")], true),
        entry("veh.tire.longForce", "Pacejka Longitudinal Fx", "vehicleSim", "csOperation", vec![p("slip_ratio", "Slip ratio"), p("Fz", "Fz (N)"), p("B", "B"), p("C", "C"), p("D", "D"), p("E", "E")], true),
        entry("veh.tire.sweep", "Tire Force Sweep", "vehicleSim", "csOperation", vec![p("Fz", "Fz (N)"), p("B", "B"), p("C", "C"), p("D", "D"), p("E", "E")], true),
        entry("veh.aero.drag", "Aero Drag", "vehicleSim", "csOperation", vec![p("rho", "ρ (kg/m³)"), p("Cd", "Cd"), p("A", "A (m²)"), p("v", "v (m/s)")], true),
        entry("veh.aero.downforce", "Aero Downforce", "vehicleSim", "csOperation", vec![p("rho", "ρ (kg/m³)"), p("Cl", "Cl"), p("A", "A (m²)"), p("v", "v (m/s)")], true),
        entry("veh.aero.balance", "Aero Balance", "vehicleSim", "csOperation", vec![p("f_front", "F front (N)"), p("f_total", "F total (N)")], true),
        entry("veh.powertrain.gearRatio", "Gear Ratio", "vehicleSim", "csOperation", vec![p("torque", "Torque (Nm)"), p("rpm", "RPM"), p("ratio", "Ratio")], true),
        entry("veh.powertrain.wheelSpeed", "Wheel Speed", "vehicleSim", "csOperation", vec![p("rpm", "RPM"), p("radius", "Radius (m)"), p("ratio", "Overall ratio")], true),
        entry("veh.powertrain.drivetrainLoss", "Drivetrain Loss", "vehicleSim", "csOperation", vec![p("power", "Power (W)"), p("efficiency", "η")], true),
        entry("veh.suspension.quarterCar", "Quarter Car", "vehicleSim", "csOperation", vec![p("road_step", "Road step (m)")], true),
        entry("veh.suspension.halfCar", "Half Car (4-DOF)", "vehicleSim", "csOperation", vec![p("road_front", "Road front (m)"), p("road_rear", "Road rear (m)")], true),
        entry("veh.suspension.fullCar", "Full Vehicle (7-DOF)", "vehicleSim", "csOperation", vec![p("road_fl", "Road FL (m)"), p("road_fr", "Road FR (m)"), p("road_rl", "Road RL (m)"), p("road_rr", "Road RR (m)")], true),
        entry("veh.suspension.kc", "K&C Analysis", "vehicleSim", "csOperation", vec![], true),
        entry("veh.event.stepSteer", "Step Steer Event", "vehicleSim", "csOperation", vec![], true),
        entry("veh.event.sineSweep", "Sine Steer Sweep", "vehicleSim", "csOperation", vec![], true),
        entry("veh.event.laneChange", "ISO Lane Change", "vehicleSim", "csOperation", vec![], true),
        entry("veh.event.brakeInTurn", "Brake in Turn", "vehicleSim", "csOperation", vec![], true),
        entry("veh.event.constantRadius", "Constant Radius", "vehicleSim", "csOperation", vec![], true),
        entry("veh.lap.simulate", "Lap Simulation", "vehicleSim", "csOperation", vec![p("track", "Track (table)")], true),
        entry("veh.brake.energy", "Brake Energy", "vehicleSim", "csOperation", vec![p("mass", "Mass (kg)"), p("v1", "V1 (m/s)"), p("v2", "V2 (m/s)")], true),
        entry("veh.brake.power", "Brake Power", "vehicleSim", "csOperation", vec![p("energy", "Energy (J)"), p("dt", "Δt (s)")], true),
        // Compiled expression eval & Gröbner bases
        entry("sym.compiledEval", "Compiled Eval", "math", "csOperation", vec![], false),
        entry("sym.groebner", "Gröbner Basis", "symbolic", "csOperation", vec![], false),
        // ExpressionInput (2.12)
        entry("sym.expressionInput", "Expression Input", "input", "csSource", vec![], false),
        // Mixed-mode AD (1.32)
        entry("ad.mixedJacobian", "Mixed-Mode Jacobian", "math", "csOperation", vec![p("x", "Eval point (vector)")], false),
        // Surrogate, AutoML & Hyperopt
        entry("optim.hyperopt", "Hyperparameter Opt.", "optimization", "csOperation", vec![], false),
        entry("optim.surrogate", "GP Surrogate", "optimization", "csOperation", vec![p("train", "Train (table)"), p("query", "Query (table)")], false),
        entry("optim.automl", "AutoML", "machineLearning", "csOperation", vec![p("data", "Data (table)")], false),
        // ML
        entry("ml.featureScale", "Feature Scale", "machineLearning", "csOperation", vec![p("data", "Data (table)")], false),
        entry("ml.classMetrics", "Classification Metrics", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("predicted", "Predicted")], false),
        entry("ml.rocCurve", "ROC Curve", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("scores", "Scores")], false),
        entry("ml.auc", "AUC Score", "machineLearning", "csOperation", vec![p("actual", "Actual"), p("scores", "Scores")], false),
    ]
}

/// Serialize the catalog as JSON.
pub fn catalog_json() -> String {
    serde_json::to_string(&catalog()).expect("catalog serialization")
}

/// Compute constant values for all zero-input source blocks.
///
/// Evaluates each `csSource` block with no inputs using `evaluate_node`
/// and collects those that return a finite scalar. This gives the TS side
/// access to constant values (e.g. pi, g0, steel_E) without duplicating
/// the Rust definitions.
pub fn constant_values() -> HashMap<String, f64> {
    use crate::ops::evaluate_node;

    let cat = catalog();
    let empty_inputs: HashMap<String, crate::types::Value> = HashMap::new();
    let empty_data: HashMap<String, serde_json::Value> = HashMap::new();
    let mut map = HashMap::new();

    for entry in &cat {
        if entry.node_kind == "csSource" && entry.inputs.is_empty() {
            let result = evaluate_node(entry.op_id, &empty_inputs, &empty_data);
            if let Some(v) = result.as_scalar() {
                if v.is_finite() {
                    map.insert(entry.op_id.to_string(), v);
                }
            }
        }
    }

    map
}

/// Serialize constant values as a JSON object { opId: number, ... }.
pub fn constant_values_json() -> String {
    serde_json::to_string(&constant_values()).expect("constant_values serialization")
}

/// Return the engine crate version.
pub fn engine_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Semantic contract version. Bumped when broadcasting rules, value semantics,
/// or correctness guarantees change in a way that consumers must acknowledge.
///
/// If you bump this, you must also:
/// 1. Update the expected version check in `src/engine/index.ts` (TypeScript host).
/// 2. Document the change in `docs/W9_3_CORRECTNESS.md`.
pub const ENGINE_CONTRACT_VERSION: u32 = 4;

pub fn engine_contract_version() -> u32 {
    ENGINE_CONTRACT_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_expected_count() {
        let cat = catalog();
        assert_eq!(cat.len(), 389);
    }

    #[test]
    fn catalog_json_roundtrip() {
        let json = catalog_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.as_array().unwrap().len(), 389);
    }

    #[test]
    fn catalog_op_ids_are_unique() {
        let cat = catalog();
        let mut seen = std::collections::HashSet::new();
        for entry in &cat {
            assert!(
                seen.insert(entry.op_id),
                "Duplicate op_id in catalog: {}",
                entry.op_id
            );
        }
    }

    #[test]
    fn known_ops_present() {
        let cat = catalog();
        let ids: Vec<&str> = cat.iter().map(|e| e.op_id).collect();
        for expected in &["add", "sin", "vectorSum", "xyPlot", "display", "eng.mechanics.force_ma", "eng.elec.ohms_V", "fin.tvm.compound_fv", "stats.desc.mean", "prob.dist.binomial_pmf", "unit_convert"] {
            assert!(ids.contains(expected), "Missing op: {}", expected);
        }
    }
}
