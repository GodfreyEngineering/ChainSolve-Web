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
}

#[derive(Debug, Clone, Serialize)]
pub struct PortDef {
    pub id: &'static str,
    pub label: &'static str,
}

fn p(id: &'static str, label: &'static str) -> PortDef {
    PortDef { id, label }
}

/// Return the full ops catalog.
pub fn catalog() -> Vec<CatalogEntry> {
    vec![
        // ── Input ────────────────────────────────────────────────
        CatalogEntry {
            op_id: "number",
            label: "Number",
            category: "input",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "slider",
            label: "Slider",
            category: "input",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "variableSource",
            label: "Variable",
            category: "input",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        // H4-1: Core constant catalog entries (pi, euler, tau, phi) removed.
        // The unified Constant picker resolves selections in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.
        // ── Math ─────────────────────────────────────────────────
        CatalogEntry {
            op_id: "add",
            label: "Add",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "subtract",
            label: "Subtract",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "multiply",
            label: "Multiply",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "divide",
            label: "Divide",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "negate",
            label: "Negate",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "abs",
            label: "Abs",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "sqrt",
            label: "Sqrt",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "power",
            label: "Power",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("base", "Base"), p("exp", "Exp")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "floor",
            label: "Floor",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "ceil",
            label: "Ceil",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "round",
            label: "Round",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "mod",
            label: "Mod",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "clamp",
            label: "Clamp",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("val", "Val"), p("min", "Min"), p("max", "Max")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "trunc",
            label: "Trunc",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "sign",
            label: "Sign",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "ln",
            label: "Ln",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "log10",
            label: "Log10",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "exp",
            label: "Exp",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "log_base",
            label: "Log (base)",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("val", "Value"), p("base", "Base")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "roundn",
            label: "Round N",
            category: "math",
            node_kind: "csOperation",
            inputs: vec![p("val", "Value"), p("digits", "Digits")],
            pro_only: false,
        },
        // ── Trig ─────────────────────────────────────────────────
        CatalogEntry {
            op_id: "sin",
            label: "Sin",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "\u{03B8} (rad)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "cos",
            label: "Cos",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "\u{03B8} (rad)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "tan",
            label: "Tan",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "\u{03B8} (rad)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "asin",
            label: "Asin",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "acos",
            label: "Acos",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "atan",
            label: "Atan",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("a", "A")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "atan2",
            label: "Atan2",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("y", "Y"), p("x", "X")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "degToRad",
            label: "Deg \u{2192} Rad",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("deg", "\u{00B0}")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "radToDeg",
            label: "Rad \u{2192} Deg",
            category: "trig",
            node_kind: "csOperation",
            inputs: vec![p("rad", "rad")],
            pro_only: false,
        },
        // ── Logic ────────────────────────────────────────────────
        CatalogEntry {
            op_id: "greater",
            label: "Greater",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "less",
            label: "Less",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "equal",
            label: "Equal",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "ifthenelse",
            label: "If / Then / Else",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("cond", "If (\u{2260}0)"), p("then", "Then"), p("else", "Else")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "max",
            label: "Max",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "min",
            label: "Min",
            category: "logic",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: false,
        },
        // ── Output ───────────────────────────────────────────────
        CatalogEntry {
            op_id: "display",
            label: "Display",
            category: "output",
            node_kind: "csDisplay",
            inputs: vec![p("value", "Value")],
            pro_only: false,
        },
        // H7-1: Publish block captures incoming value under a named channel.
        CatalogEntry {
            op_id: "publish",
            label: "Publish",
            category: "output",
            node_kind: "csPublish",
            inputs: vec![p("value", "Value")],
            pro_only: false,
        },
        // H7-1: Subscribe block reads a published channel value (resolved in TS bridge).
        CatalogEntry {
            op_id: "subscribe",
            label: "Subscribe",
            category: "input",
            node_kind: "csSubscribe",
            inputs: vec![],
            pro_only: false,
        },
        // ── Data (Pro) ───────────────────────────────────────────
        CatalogEntry {
            op_id: "vectorInput",
            label: "Array Input",
            category: "data",
            node_kind: "csData",
            inputs: vec![],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "tableInput",
            label: "Table Input",
            category: "data",
            node_kind: "csData",
            inputs: vec![],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "table_extract_col",
            label: "Table Column",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("table", "Table"), p("index", "Column Index")],
            pro_only: true,
        },
        // ── Material Full (Pro, Phase 10) ────────────────────────
        CatalogEntry {
            op_id: "material_full",
            label: "Material (Full)",
            category: "presetMaterials",
            node_kind: "csMaterial",
            inputs: vec![],
            pro_only: true,
        },
        // ── List Ops (Pro) ──────────────────────────────────────
        CatalogEntry {
            op_id: "vectorLength",
            label: "List Length",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSum",
            label: "List Sum",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMean",
            label: "List Mean",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMin",
            label: "List Min",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMax",
            label: "List Max",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSort",
            label: "List Sort",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorReverse",
            label: "List Reverse",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSlice",
            label: "List Slice",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List"), p("start", "Start"), p("end", "End")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorConcat",
            label: "List Concat",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMap",
            label: "List \u{00D7} Scalar",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "List"), p("scalar", "Scalar")],
            pro_only: true,
        },
        // ── Plot (Pro) ───────────────────────────────────────────
        CatalogEntry {
            op_id: "xyPlot",
            label: "XY Plot",
            category: "plot",
            node_kind: "csPlot",
            inputs: vec![p("data", "Data")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "histogram",
            label: "Histogram",
            category: "plot",
            node_kind: "csPlot",
            inputs: vec![p("data", "Data")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "barChart",
            label: "Bar Chart",
            category: "plot",
            node_kind: "csPlot",
            inputs: vec![p("data", "Data")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "heatmap",
            label: "Heatmap",
            category: "plot",
            node_kind: "csPlot",
            inputs: vec![p("data", "Data")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "listTable",
            label: "List Table",
            category: "plot",
            node_kind: "csListTable",
            inputs: vec![p("data", "Data")],
            pro_only: true,
        },
        // ── Engineering → Mechanics ──────────────────────────────────
        CatalogEntry {
            op_id: "eng.mechanics.v_from_uat",
            label: "v = u + at",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("u", "u (m/s)"), p("a", "a (m/s\u{00B2})"), p("t", "t (s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.s_from_ut_a_t",
            label: "s = ut + \u{00BD}at\u{00B2}",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("u", "u (m/s)"), p("t", "t (s)"), p("a", "a (m/s\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.v2_from_u2_as",
            label: "v = \u{221A}(u\u{00B2}+2as)",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("u", "u (m/s)"), p("a", "a (m/s\u{00B2})"), p("s", "s (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.force_ma",
            label: "F = ma",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("a", "a (m/s\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.weight_mg",
            label: "W = mg",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("g", "g (m/s\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.momentum_mv",
            label: "p = mv",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.kinetic_energy",
            label: "KE = \u{00BD}mv\u{00B2}",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.potential_energy",
            label: "PE = mgh",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("g", "g (m/s\u{00B2})"), p("h", "h (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.work_Fs",
            label: "W = Fs",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("s", "s (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.power_work_time",
            label: "P = W/t",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("W", "W (J)"), p("t", "t (s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.power_Fv",
            label: "P = Fv",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.torque_Fr",
            label: "T = Fr",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("r", "r (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.omega_from_rpm",
            label: "\u{03C9} from RPM",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("rpm", "RPM")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.rpm_from_omega",
            label: "RPM from \u{03C9}",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("omega", "\u{03C9} (rad/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.power_rot_Tomega",
            label: "P = T\u{03C9}",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("T", "T (N\u{00B7}m)"), p("omega", "\u{03C9} (rad/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.centripetal_acc",
            label: "a = v\u{00B2}/r",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("v", "v (m/s)"), p("r", "r (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.centripetal_force",
            label: "F = mv\u{00B2}/r",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("v", "v (m/s)"), p("r", "r (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.friction_force",
            label: "F = μN",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("mu", "μ"), p("N", "N (N)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.mechanics.impulse",
            label: "J = FΔt",
            category: "engMechanics",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("dt", "Δt (s)")],
            pro_only: false,
        },
        // ── Engineering → Materials & Strength ───────────────────────
        CatalogEntry {
            op_id: "eng.materials.stress_F_A",
            label: "\u{03C3} = F/A",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("A", "A (m\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.strain_dL_L",
            label: "\u{03B5} = \u{0394}L/L",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("dL", "\u{0394}L (m)"), p("L", "L (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.youngs_modulus",
            label: "E = \u{03C3}/\u{03B5}",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("sigma", "\u{03C3} (Pa)"), p("epsilon", "\u{03B5}")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.pressure_F_A",
            label: "p = F/A",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("F", "F (N)"), p("A", "A (m\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.safety_factor",
            label: "Safety Factor",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("strength", "Strength (Pa)"), p("stress", "Stress (Pa)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.spring_force_kx",
            label: "F = kx",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("k", "k (N/m)"), p("x", "x (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.materials.spring_energy",
            label: "E = \u{00BD}kx\u{00B2}",
            category: "engMaterials",
            node_kind: "csOperation",
            inputs: vec![p("k", "k (N/m)"), p("x", "x (m)")],
            pro_only: false,
        },
        // ── Engineering → Section Properties ─────────────────────────
        CatalogEntry {
            op_id: "eng.sections.area_circle",
            label: "Area Circle",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("d", "d (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.area_annulus",
            label: "Area Annulus",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("d_outer", "d outer (m)"), p("d_inner", "d inner (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.I_rect",
            label: "I Rectangle",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("b", "b (m)"), p("h", "h (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.I_circle",
            label: "I Circle",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("d", "d (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.J_circle",
            label: "J Circle",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("d", "d (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.bending_stress",
            label: "\u{03C3} = My/I",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("M", "M (N\u{00B7}m)"), p("y", "y (m)"), p("I", "I (m\u{2074})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.sections.torsional_shear",
            label: "\u{03C4} = Tr/J",
            category: "engSections",
            node_kind: "csOperation",
            inputs: vec![p("T", "T (N\u{00B7}m)"), p("r", "r (m)"), p("J", "J (m\u{2074})")],
            pro_only: false,
        },
        // ── Engineering → Rotational Inertia ─────────────────────────
        CatalogEntry {
            op_id: "eng.inertia.solid_cylinder",
            label: "I Solid Cylinder",
            category: "engInertia",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("r", "r (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.inertia.hollow_cylinder",
            label: "I Hollow Cylinder",
            category: "engInertia",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("r_inner", "r inner (m)"), p("r_outer", "r outer (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.inertia.solid_sphere",
            label: "I Solid Sphere",
            category: "engInertia",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("r", "r (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.inertia.rod_center",
            label: "I Rod (center)",
            category: "engInertia",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("L", "L (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.inertia.rod_end",
            label: "I Rod (end)",
            category: "engInertia",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("L", "L (m)")],
            pro_only: false,
        },
        // ── Engineering → Fluids ─────────────────────────────────────
        CatalogEntry {
            op_id: "eng.fluids.flow_Q_from_Av",
            label: "Q = Av",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("A", "A (m\u{00B2})"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.velocity_from_QA",
            label: "v = Q/A",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("Q", "Q (m\u{00B3}/s)"), p("A", "A (m\u{00B2})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.mass_flow",
            label: "\u{1E41} = \u{03C1}Q",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("Q", "Q (m\u{00B3}/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.reynolds",
            label: "Reynolds Re",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)"), p("D", "D (m)"), p("mu", "\u{03BC} (Pa\u{00B7}s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.dynamic_pressure",
            label: "q = \u{00BD}\u{03C1}v\u{00B2}",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.hagen_poiseuille_dp",
            label: "Hagen-Poiseuille",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("mu", "\u{03BC} (Pa\u{00B7}s)"), p("L", "L (m)"), p("Q", "Q (m\u{00B3}/s)"), p("D", "D (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.darcy_weisbach_dp",
            label: "Darcy-Weisbach",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("f", "f"), p("L", "L (m)"), p("D", "D (m)"), p("rho", "\u{03C1} (kg/m\u{00B3})"), p("v", "v (m/s)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.fluids.buoyancy",
            label: "F = \u{03C1}Vg",
            category: "engFluids",
            node_kind: "csOperation",
            inputs: vec![p("rho", "\u{03C1} (kg/m\u{00B3})"), p("V", "V (m\u{00B3})"), p("g", "g (m/s\u{00B2})")],
            pro_only: false,
        },
        // ── Engineering → Thermo ─────────────────────────────────────
        CatalogEntry {
            op_id: "eng.thermo.ideal_gas_P",
            label: "P = nRT/V",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("n", "n (mol)"), p("R", "R (J/mol\u{00B7}K)"), p("T", "T (K)"), p("V", "V (m\u{00B3})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.ideal_gas_T",
            label: "T = PV/nR",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("P", "P (Pa)"), p("V", "V (m\u{00B3})"), p("n", "n (mol)"), p("R", "R (J/mol\u{00B7}K)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.heat_Q_mcDT",
            label: "Q = mc\u{0394}T",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("m", "m (kg)"), p("c", "c (J/kg\u{00B7}K)"), p("dT", "\u{0394}T (K)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.conduction_Qdot",
            label: "Conduction",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("k", "k (W/m\u{00B7}K)"), p("A", "A (m\u{00B2})"), p("dT", "\u{0394}T (K)"), p("L", "L (m)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.convection_Qdot",
            label: "Convection",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("h", "h (W/m\u{00B2}\u{00B7}K)"), p("A", "A (m\u{00B2})"), p("dT", "\u{0394}T (K)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.carnot_efficiency",
            label: "\u{03B7} = 1\u{2212}T\u{1D04}/T\u{1D34}",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("T_cold", "T\u{1D04}\u{2092}\u{2097}\u{1D48} (K)"), p("T_hot", "T\u{2095}\u{2092}\u{209C} (K)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.thermo.thermal_expansion",
            label: "\u{0394}L = \u{03B1}L\u{0394}T",
            category: "engThermo",
            node_kind: "csOperation",
            inputs: vec![p("alpha", "\u{03B1} (1/K)"), p("L", "L (m)"), p("dT", "\u{0394}T (K)")],
            pro_only: false,
        },
        // ── Engineering → Electrical ─────────────────────────────────
        CatalogEntry {
            op_id: "eng.elec.ohms_V",
            label: "V = IR",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("I", "I (A)"), p("R", "R (\u{03A9})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.power_VI",
            label: "P = VI",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("V", "V (V)"), p("I", "I (A)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.power_I2R",
            label: "P = I\u{00B2}R",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("I", "I (A)"), p("R", "R (\u{03A9})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.power_V2R",
            label: "P = V\u{00B2}/R",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("V", "V (V)"), p("R", "R (\u{03A9})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.capacitance_Q_V",
            label: "C = Q/V",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("Q", "Q (C)"), p("V", "V (V)")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.series_resistance",
            label: "R = R\u{2081}+R\u{2082}",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("R1", "R\u{2081} (\u{03A9})"), p("R2", "R\u{2082} (\u{03A9})")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.elec.parallel_resistance",
            label: "R\u{2225} = R\u{2081}R\u{2082}/(R\u{2081}+R\u{2082})",
            category: "engElectrical",
            node_kind: "csOperation",
            inputs: vec![p("R1", "R\u{2081} (\u{03A9})"), p("R2", "R\u{2082} (\u{03A9})")],
            pro_only: false,
        },
        // ── Engineering → Conversions ────────────────────────────────
        CatalogEntry {
            op_id: "eng.conv.deg_to_rad",
            label: "Deg \u{2192} Rad",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("deg", "deg")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.rad_to_deg",
            label: "Rad \u{2192} Deg",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("rad", "rad")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.mm_to_m",
            label: "mm \u{2192} m",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("mm", "mm")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.m_to_mm",
            label: "m \u{2192} mm",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("m", "m")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.bar_to_pa",
            label: "bar \u{2192} Pa",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("bar", "bar")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.pa_to_bar",
            label: "Pa \u{2192} bar",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("Pa", "Pa")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.lpm_to_m3s",
            label: "L/min \u{2192} m\u{00B3}/s",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("lpm", "L/min")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "eng.conv.m3s_to_lpm",
            label: "m\u{00B3}/s \u{2192} L/min",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("m3s", "m\u{00B3}/s")],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "unit_convert",
            label: "Unit Convert",
            category: "engConversions",
            node_kind: "csOperation",
            inputs: vec![p("value", "value")],
            pro_only: false,
        },
        // ── Finance → TVM ──────────────────────────────────────────────
        CatalogEntry {
            op_id: "fin.tvm.simple_interest",
            label: "Simple Interest",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("P", "P"), p("r", "r"), p("t", "t")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.compound_fv",
            label: "Compound FV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("PV", "PV"), p("r", "r"), p("n", "n"), p("t", "t")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.compound_pv",
            label: "Compound PV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("FV", "FV"), p("r", "r"), p("n", "n"), p("t", "t")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.continuous_fv",
            label: "Continuous FV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("PV", "PV"), p("r", "r"), p("t", "t")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.annuity_pv",
            label: "Annuity PV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("PMT", "PMT"), p("r", "r"), p("n", "n")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.annuity_fv",
            label: "Annuity FV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("PMT", "PMT"), p("r", "r"), p("n", "n")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.annuity_pmt",
            label: "Annuity PMT",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("PV", "PV"), p("r", "r"), p("n", "n")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.npv",
            label: "NPV",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("r", "r"), p("c", "Count"), p("cf0", "CF0"), p("cf1", "CF1"), p("cf2", "CF2"), p("cf3", "CF3"), p("cf4", "CF4"), p("cf5", "CF5")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.rule_of_72",
            label: "Rule of 72",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("r", "r (decimal)")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.tvm.effective_rate",
            label: "Effective Rate",
            category: "finTvm",
            node_kind: "csOperation",
            inputs: vec![p("r", "r (nominal)"), p("n", "n (periods)")],
            pro_only: true,
        },
        // ── Finance → Returns & Risk ───────────────────────────────────
        CatalogEntry {
            op_id: "fin.returns.pct_return",
            label: "% Return",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.returns.log_return",
            label: "Log Return",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.returns.cagr",
            label: "CAGR",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("v0", "V\u{2080}"), p("v1", "V\u{2081}"), p("t", "t (yrs)")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.returns.sharpe",
            label: "Sharpe Ratio",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("ret", "Return"), p("rf", "R\u{1D193}"), p("sigma", "\u{03C3}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.returns.weighted_avg",
            label: "Weighted Avg",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "W1"), p("y2", "W2"), p("y3", "W3"), p("y4", "W4"), p("y5", "W5"), p("y6", "W6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.returns.portfolio_variance",
            label: "Portfolio Var (2-asset)",
            category: "finReturns",
            node_kind: "csOperation",
            inputs: vec![p("w1", "w\u{2081}"), p("w2", "w\u{2082}"), p("s1", "\u{03C3}\u{2081}"), p("s2", "\u{03C3}\u{2082}"), p("rho", "\u{03C1}")],
            pro_only: true,
        },
        // ── Finance → Depreciation ─────────────────────────────────────
        CatalogEntry {
            op_id: "fin.depr.straight_line",
            label: "SL Depreciation",
            category: "finDepr",
            node_kind: "csOperation",
            inputs: vec![p("cost", "Cost"), p("salvage", "Salvage"), p("life", "Life")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "fin.depr.declining_balance",
            label: "DB Depreciation",
            category: "finDepr",
            node_kind: "csOperation",
            inputs: vec![p("cost", "Cost"), p("salvage", "Salvage"), p("life", "Life"), p("period", "Period")],
            pro_only: true,
        },
        // ── Stats → Descriptive ────────────────────────────────────────
        CatalogEntry {
            op_id: "stats.desc.mean",
            label: "Mean",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.median",
            label: "Median",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.mode_approx",
            label: "Mode (approx)",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.range",
            label: "Range",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.variance",
            label: "Variance",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.stddev",
            label: "Std Dev",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.sum",
            label: "Sum",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.geo_mean",
            label: "Geometric Mean",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.desc.zscore",
            label: "Z-Score",
            category: "statsDesc",
            node_kind: "csOperation",
            inputs: vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")],
            pro_only: true,
        },
        // ── Stats → Relationships ──────────────────────────────────────
        CatalogEntry {
            op_id: "stats.rel.covariance",
            label: "Covariance",
            category: "statsRel",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.rel.correlation",
            label: "Correlation",
            category: "statsRel",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.rel.linreg_slope",
            label: "LinReg Slope",
            category: "statsRel",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "stats.rel.linreg_intercept",
            label: "LinReg Intercept",
            category: "statsRel",
            node_kind: "csOperation",
            inputs: vec![p("c", "Count"), p("x1", "X1"), p("x2", "X2"), p("x3", "X3"), p("x4", "X4"), p("x5", "X5"), p("x6", "X6"), p("y1", "Y1"), p("y2", "Y2"), p("y3", "Y3"), p("y4", "Y4"), p("y5", "Y5"), p("y6", "Y6")],
            pro_only: true,
        },
        // ── Probability → Combinatorics ────────────────────────────────
        CatalogEntry {
            op_id: "prob.comb.factorial",
            label: "n!",
            category: "probComb",
            node_kind: "csOperation",
            inputs: vec![p("n", "n")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.comb.permutation",
            label: "P(n,k)",
            category: "probComb",
            node_kind: "csOperation",
            inputs: vec![p("n", "n"), p("k", "k")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.comb.combination",
            label: "C(n,k)",
            category: "probComb",
            node_kind: "csOperation",
            inputs: vec![p("n", "n"), p("k", "k")],
            pro_only: false,
        },
        // ── Probability → Distributions ────────────────────────────────
        CatalogEntry {
            op_id: "prob.dist.binomial_pmf",
            label: "Binomial PMF",
            category: "probDist",
            node_kind: "csOperation",
            inputs: vec![p("n", "n"), p("k", "k"), p("p", "p")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.dist.poisson_pmf",
            label: "Poisson PMF",
            category: "probDist",
            node_kind: "csOperation",
            inputs: vec![p("k", "k"), p("lambda", "\u{03BB}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.dist.exponential_pdf",
            label: "Exponential PDF",
            category: "probDist",
            node_kind: "csOperation",
            inputs: vec![p("x", "x"), p("lambda", "\u{03BB}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.dist.exponential_cdf",
            label: "Exponential CDF",
            category: "probDist",
            node_kind: "csOperation",
            inputs: vec![p("x", "x"), p("lambda", "\u{03BB}")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "prob.dist.normal_pdf",
            label: "Normal PDF",
            category: "probDist",
            node_kind: "csOperation",
            inputs: vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")],
            pro_only: true,
        },
        // ── Utilities ──────────────────────────────────────────────────
        CatalogEntry {
            op_id: "util.round.to_dp",
            label: "Round to DP",
            category: "utilCalc",
            node_kind: "csOperation",
            inputs: vec![p("x", "x"), p("dp", "DP")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "util.pct.to_decimal",
            label: "% \u{2192} Decimal",
            category: "utilCalc",
            node_kind: "csOperation",
            inputs: vec![p("pct", "%")],
            pro_only: true,
        },
        // H4-1: Individual constant catalog entries removed.
        // The unified Constant picker resolves selections in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.
        // H3-1: Material/fluid preset catalog entries removed.
        // The unified Material node resolves presets in the TS bridge layer.
        // Rust eval handlers remain in ops.rs for backward compatibility.

        // ── SCI-11: Statistical distributions ──────────────────────────
        CatalogEntry { op_id: "prob.dist.normal_cdf", label: "Normal CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.normal_inv_cdf", label: "Normal InvCDF (Probit)", category: "probDist", node_kind: "csOperation", inputs: vec![p("p", "p"), p("mu", "\u{03BC}"), p("sigma", "\u{03C3}")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.t_pdf", label: "t PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("df", "df (\u{03BD})")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.t_cdf", label: "t CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("df", "df (\u{03BD})")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.chi2_pdf", label: "Chi\u{00B2} PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("k", "k (df)")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.chi2_cdf", label: "Chi\u{00B2} CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("k", "k (df)")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.f_pdf", label: "F PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("d1", "d1 (df1)"), p("d2", "d2 (df2)")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.f_cdf", label: "F CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("d1", "d1 (df1)"), p("d2", "d2 (df2)")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.poisson_cdf", label: "Poisson CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("k", "k"), p("lambda", "\u{03BB}")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.binomial_cdf", label: "Binomial CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("k", "k"), p("n", "n"), p("p", "p")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.beta_pdf", label: "Beta PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("a", "\u{03B1}"), p("b", "\u{03B2}")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.beta_cdf", label: "Beta CDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("a", "\u{03B1}"), p("b", "\u{03B2}")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.gamma_pdf", label: "Gamma PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("alpha", "\u{03B1} (shape)"), p("beta", "\u{03B2} (scale)")], pro_only: true },
        CatalogEntry { op_id: "prob.dist.weibull_pdf", label: "Weibull PDF", category: "probDist", node_kind: "csOperation", inputs: vec![p("x", "x"), p("k", "k (shape)"), p("lambda", "\u{03BB} (scale)")], pro_only: true },

        // ── BLK-05: Expanded Electrical ─────────────────────────────────
        CatalogEntry { op_id: "eng.elec.RC_tau", label: "RC Time Constant", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("R", "R (\u{03A9})"), p("C", "C (F)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.RL_tau", label: "RL Time Constant", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("R", "R (\u{03A9})"), p("L", "L (H)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.RLC_f0", label: "RLC Resonant Frequency", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("L", "L (H)"), p("C", "C (F)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.RLC_Q", label: "RLC Quality Factor", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("R", "R (\u{03A9})"), p("L", "L (H)"), p("C", "C (F)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.V_divider", label: "Voltage Divider", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("Vin", "Vin (V)"), p("R1", "R1 (\u{03A9})"), p("R2", "R2 (\u{03A9})")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.I_divider", label: "Current Divider", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("Iin", "Iin (A)"), p("R1", "R1 (\u{03A9})"), p("R2", "R2 (\u{03A9})")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.Z_cap", label: "Capacitive Reactance", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("f", "f (Hz)"), p("C", "C (F)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.Z_ind", label: "Inductive Reactance", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("f", "f (Hz)"), p("L", "L (H)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.filter_fc", label: "RC Filter Cutoff", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("R", "R (\u{03A9})"), p("C", "C (F)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.transformer_v2", label: "Transformer Voltage", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("V1", "V1 (V)"), p("N1", "N1 (turns)"), p("N2", "N2 (turns)")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.three_phase_P", label: "Three-Phase Power", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("VL", "VL (V)"), p("IL", "IL (A)"), p("pf", "pf")], pro_only: true },
        CatalogEntry { op_id: "eng.elec.diode_shockley", label: "Diode Current (Shockley)", category: "engElectrical", node_kind: "csOperation", inputs: vec![p("Is", "Is (A)"), p("V", "V (V)"), p("eta", "\u{03B7}"), p("Vt", "Vt (V)")], pro_only: true },

        // ── BLK-01: Chemical Engineering ────────────────────────────────
        CatalogEntry { op_id: "chem.ideal_gas_n", label: "n = PV/RT", category: "chem", node_kind: "csOperation", inputs: vec![p("P", "P (Pa)"), p("V", "V (m3)"), p("R", "R (J/molK)"), p("T", "T (K)")], pro_only: true },
        CatalogEntry { op_id: "chem.antoine_vp", label: "Antoine VP", category: "chem", node_kind: "csOperation", inputs: vec![p("A", "A"), p("B", "B"), p("C", "C"), p("T", "T (C)")], pro_only: true },
        CatalogEntry { op_id: "chem.raoults_partial", label: "Raoult's P_partial", category: "chem", node_kind: "csOperation", inputs: vec![p("x", "x (mol frac)"), p("Psat", "P_sat")], pro_only: true },
        CatalogEntry { op_id: "chem.equilibrium_K", label: "K = exp(-dG/RT)", category: "chem", node_kind: "csOperation", inputs: vec![p("dG", "dG (J/mol)"), p("R", "R (J/molK)"), p("T", "T (K)")], pro_only: true },
        CatalogEntry { op_id: "chem.arrhenius_rate", label: "k = A*exp(-Ea/RT)", category: "chem", node_kind: "csOperation", inputs: vec![p("A", "A (pre-exp)"), p("Ea", "Ea (J/mol)"), p("R", "R (J/molK)"), p("T", "T (K)")], pro_only: true },
        CatalogEntry { op_id: "chem.heat_reaction", label: "dH_rxn", category: "chem", node_kind: "csOperation", inputs: vec![p("H_prod", "H_products"), p("H_react", "H_reactants")], pro_only: true },
        CatalogEntry { op_id: "chem.mole_fraction", label: "x = n/n_total", category: "chem", node_kind: "csOperation", inputs: vec![p("n_comp", "n_comp (mol)"), p("n_total", "n_total (mol)")], pro_only: true },
        CatalogEntry { op_id: "chem.ficks_flux", label: "Fick's Flux J", category: "chem", node_kind: "csOperation", inputs: vec![p("D", "D (m2/s)"), p("dC_dx", "dC/dx (mol/m4)")], pro_only: true },
        CatalogEntry { op_id: "chem.CSTR_conv", label: "CSTR X (1st order)", category: "chem", node_kind: "csOperation", inputs: vec![p("k", "k (s-1)"), p("tau", "tau (s)")], pro_only: true },
        CatalogEntry { op_id: "chem.enthalpy_sensible", label: "dH = Cp*dT", category: "chem", node_kind: "csOperation", inputs: vec![p("Cp", "Cp (J/molK)"), p("T1", "T1 (K)"), p("T2", "T2 (K)")], pro_only: true },

        // ── BLK-02: Structural Engineering ──────────────────────────────
        CatalogEntry { op_id: "struct.beam_deflect_ss", label: "delta = PL3/48EI", category: "structural", node_kind: "csOperation", inputs: vec![p("P", "P (N)"), p("L", "L (m)"), p("E", "E (Pa)"), p("I", "I (m4)")], pro_only: true },
        CatalogEntry { op_id: "struct.beam_deflect_cantilever", label: "delta = PL3/3EI", category: "structural", node_kind: "csOperation", inputs: vec![p("P", "P (N)"), p("L", "L (m)"), p("E", "E (Pa)"), p("I", "I (m4)")], pro_only: true },
        CatalogEntry { op_id: "struct.beam_moment_ss", label: "M = Pab/L", category: "structural", node_kind: "csOperation", inputs: vec![p("P", "P (N)"), p("a", "a (m)"), p("b", "b (m)"), p("L", "L (m)")], pro_only: true },
        CatalogEntry { op_id: "struct.euler_buckling", label: "P_cr = pi2EI/(KL)2", category: "structural", node_kind: "csOperation", inputs: vec![p("E", "E (Pa)"), p("I", "I (m4)"), p("L", "L (m)"), p("K", "K (eff. len)")], pro_only: true },
        CatalogEntry { op_id: "struct.von_mises", label: "sigma_vm (Von Mises)", category: "structural", node_kind: "csOperation", inputs: vec![p("sx", "sx (Pa)"), p("sy", "sy (Pa)"), p("txy", "txy (Pa)")], pro_only: true },
        CatalogEntry { op_id: "struct.combined_stress", label: "sigma = sigma_ax + sigma_bend", category: "structural", node_kind: "csOperation", inputs: vec![p("s_ax", "s_axial (Pa)"), p("s_bend", "s_bending (Pa)")], pro_only: true },
        CatalogEntry { op_id: "struct.steel_check", label: "Util = sigma/(Fy*phi)", category: "structural", node_kind: "csOperation", inputs: vec![p("sigma", "sigma (Pa)"), p("Fy", "F_y (Pa)"), p("phi", "phi")], pro_only: true },
        CatalogEntry { op_id: "struct.bearing_capacity", label: "q_ult (Terzaghi)", category: "structural", node_kind: "csOperation", inputs: vec![p("c", "c (Pa)"), p("gamma", "gamma (kN/m3)"), p("D", "D_f (m)"), p("B", "B (m)"), p("Nc", "N_c"), p("Nq", "N_q"), p("Ngamma", "N_gamma")], pro_only: true },
        CatalogEntry { op_id: "struct.concrete_moment_aci", label: "M_n (ACI)", category: "structural", node_kind: "csOperation", inputs: vec![p("fc", "f'c (Pa)"), p("b", "b (m)"), p("d", "d (m)"), p("As", "A_s (m2)"), p("fy", "f_y (Pa)")], pro_only: true },

        // ── BLK-03: Aerospace Engineering ───────────────────────────────
        CatalogEntry { op_id: "aero.ISA_T", label: "ISA T(h)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("h", "h (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.ISA_P", label: "ISA P(h)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("h", "h (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.ISA_rho", label: "ISA rho(h)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("h", "h (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.ISA_a", label: "ISA a(h)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("h", "h (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.mach_from_v", label: "M = v/a", category: "aerospace", node_kind: "csOperation", inputs: vec![p("v", "v (m/s)"), p("a", "a (m/s)")], pro_only: true },
        CatalogEntry { op_id: "aero.dynamic_q", label: "q = 0.5*rho*v2", category: "aerospace", node_kind: "csOperation", inputs: vec![p("rho", "rho (kg/m3)"), p("v", "v (m/s)")], pro_only: true },
        CatalogEntry { op_id: "aero.lift", label: "L = CL*q*S", category: "aerospace", node_kind: "csOperation", inputs: vec![p("CL", "C_L"), p("q", "q (Pa)"), p("S", "S (m2)")], pro_only: true },
        CatalogEntry { op_id: "aero.drag", label: "D = CD*q*S", category: "aerospace", node_kind: "csOperation", inputs: vec![p("CD", "C_D"), p("q", "q (Pa)"), p("S", "S (m2)")], pro_only: true },
        CatalogEntry { op_id: "aero.tsfc", label: "TSFC", category: "aerospace", node_kind: "csOperation", inputs: vec![p("thrust", "Thrust (N)"), p("fuel_flow", "fuel_flow (kg/s)")], pro_only: true },
        CatalogEntry { op_id: "aero.tsiolkovsky", label: "dv = Isp*g0*ln(m0/mf)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("Isp", "Isp (s)"), p("g0", "g0 (m/s2)"), p("m0", "m0 (kg)"), p("mf", "mf (kg)")], pro_only: true },
        CatalogEntry { op_id: "aero.orbital_v", label: "v = sqrt(GM/r)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("GM", "GM (m3/s2)"), p("r", "r (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.escape_v", label: "v_esc = sqrt(2GM/r)", category: "aerospace", node_kind: "csOperation", inputs: vec![p("GM", "GM (m3/s2)"), p("r", "r (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.hohmann_dv1", label: "Hohmann dv1", category: "aerospace", node_kind: "csOperation", inputs: vec![p("GM", "GM (m3/s2)"), p("r1", "r1 (m)"), p("r2", "r2 (m)")], pro_only: true },
        CatalogEntry { op_id: "aero.hohmann_dv2", label: "Hohmann dv2", category: "aerospace", node_kind: "csOperation", inputs: vec![p("GM", "GM (m3/s2)"), p("r1", "r1 (m)"), p("r2", "r2 (m)")], pro_only: true },

        // ── BLK-04: Control Systems ──────────────────────────────────────
        CatalogEntry { op_id: "ctrl.step_1st_order", label: "Step 1st Order", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("K", "K (gain)"), p("tau", "tau (s)"), p("t", "t (s)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.step_2nd_order", label: "Step 2nd Order", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("K", "K (gain)"), p("wn", "wn (rad/s)"), p("zeta", "zeta"), p("t", "t (s)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.pid_output", label: "PID Output", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("Kp", "K_p"), p("Ki", "K_i"), p("Kd", "K_d"), p("error", "e(t)"), p("integral", "int e dt"), p("dt", "dt (s)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.rms", label: "RMS", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("y", "y (vector)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.peak2peak", label: "Peak-to-Peak", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("y", "y (vector)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.settling_time_2pct", label: "t_s = 4*tau", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("tau", "tau (s)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.overshoot_2nd", label: "%OS", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("zeta", "zeta (damping)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.natural_freq", label: "wn = sqrt(k/m)", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("k", "k (N/m)"), p("m", "m (kg)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.damping_ratio", label: "zeta = c/(2*sqrt(km))", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("c", "c (Ns/m)"), p("k", "k (N/m)"), p("m", "m (kg)")], pro_only: true },
        CatalogEntry { op_id: "ctrl.bode_mag_1st", label: "|H(jw)| 1st Order", category: "controlSystems", node_kind: "csOperation", inputs: vec![p("K", "K (gain)"), p("omega", "omega (rad/s)"), p("tau", "tau (s)")], pro_only: true },

        // ── BLK-06: Life Sciences ────────────────────────────────────────
        CatalogEntry { op_id: "bio.michaelis_menten", label: "Michaelis-Menten", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("Vmax", "V_max"), p("Km", "K_m"), p("S", "[S]")], pro_only: true },
        CatalogEntry { op_id: "bio.hill_eq", label: "Hill Equation", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("n", "n (Hill coef)"), p("Kd", "K_d"), p("L", "[L]")], pro_only: true },
        CatalogEntry { op_id: "bio.logistic_growth", label: "Logistic Growth", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("r", "r (growth rate)"), p("K", "K (capacity)"), p("N0", "N0 (initial)"), p("t", "t")], pro_only: true },
        CatalogEntry { op_id: "bio.exp_decay", label: "N = N0*e^(-lambda*t)", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("N0", "N0"), p("lambda", "lambda (decay rate)"), p("t", "t")], pro_only: true },
        CatalogEntry { op_id: "bio.half_life", label: "t1/2 = ln2/lambda", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("lambda", "lambda (decay rate)")], pro_only: true },
        CatalogEntry { op_id: "bio.drug_1cmp", label: "1-Compartment PK", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("D", "D (dose)"), p("V", "V_d (L)"), p("k", "k_el (1/h)"), p("t", "t (h)")], pro_only: true },
        CatalogEntry { op_id: "bio.henderson_hasselbalch", label: "Henderson-Hasselbalch", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("pKa", "pKa"), p("A", "[A-]"), p("HA", "[HA]")], pro_only: true },
        CatalogEntry { op_id: "bio.nernst", label: "Nernst Equation", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("R", "R (J/molK)"), p("T", "T (K)"), p("z", "z (valence)"), p("F", "F (C/mol)"), p("C_out", "[out]"), p("C_in", "[in]")], pro_only: true },
        CatalogEntry { op_id: "bio.BMI", label: "BMI", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("mass_kg", "mass (kg)"), p("height_m", "height (m)")], pro_only: true },
        CatalogEntry { op_id: "bio.BSA_dubois", label: "BSA (DuBois)", category: "lifeSci", node_kind: "csOperation", inputs: vec![p("W_kg", "W (kg)"), p("H_cm", "H (cm)")], pro_only: true },

        // ── BLK-07: Finance Options ──────────────────────────────────────
        CatalogEntry { op_id: "fin.options.bs_call", label: "Black-Scholes Call", category: "finOptions", node_kind: "csOperation", inputs: vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.bs_put", label: "Black-Scholes Put", category: "finOptions", node_kind: "csOperation", inputs: vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.bs_delta", label: "BS Delta", category: "finOptions", node_kind: "csOperation", inputs: vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.bs_gamma", label: "BS Gamma", category: "finOptions", node_kind: "csOperation", inputs: vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.bs_vega", label: "BS Vega", category: "finOptions", node_kind: "csOperation", inputs: vec![p("S", "S (spot)"), p("K", "K (strike)"), p("T", "T (years)"), p("r", "r (risk-free)"), p("sigma", "sigma (vol)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.kelly", label: "Kelly Criterion", category: "finOptions", node_kind: "csOperation", inputs: vec![p("p_win", "p (win prob)"), p("b", "b (odds)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.var_hist", label: "VaR (historical)", category: "finOptions", node_kind: "csOperation", inputs: vec![p("returns", "Returns (vector)"), p("conf", "Confidence")], pro_only: true },
        CatalogEntry { op_id: "fin.options.cvar_hist", label: "CVaR (historical)", category: "finOptions", node_kind: "csOperation", inputs: vec![p("returns", "Returns (vector)"), p("conf", "Confidence")], pro_only: true },
        CatalogEntry { op_id: "fin.options.bond_duration", label: "Macaulay Duration", category: "finOptions", node_kind: "csOperation", inputs: vec![p("coupon", "Coupon ($)"), p("face", "Face ($)"), p("ytm", "YTM"), p("n", "n (periods)")], pro_only: true },
        CatalogEntry { op_id: "fin.options.dcf", label: "DCF Valuation", category: "finOptions", node_kind: "csOperation", inputs: vec![p("fcf", "FCF ($)"), p("wacc", "WACC"), p("g", "g (terminal)"), p("n", "n (years)")], pro_only: true },

        // ── BLK-09: Date & Time ──────────────────────────────────────────
        CatalogEntry { op_id: "date.from_ymd", label: "Date from Y/M/D", category: "dateTime", node_kind: "csOperation", inputs: vec![p("y", "Year"), p("m", "Month"), p("d", "Day")], pro_only: true },
        CatalogEntry { op_id: "date.year", label: "Year of date", category: "dateTime", node_kind: "csOperation", inputs: vec![p("day", "date (days)")], pro_only: true },
        CatalogEntry { op_id: "date.month", label: "Month of date", category: "dateTime", node_kind: "csOperation", inputs: vec![p("day", "date (days)")], pro_only: true },
        CatalogEntry { op_id: "date.day_of_month", label: "Day of month", category: "dateTime", node_kind: "csOperation", inputs: vec![p("day", "date (days)")], pro_only: true },
        CatalogEntry { op_id: "date.days_between", label: "Days Between", category: "dateTime", node_kind: "csOperation", inputs: vec![p("d1", "Date 1"), p("d2", "Date 2")], pro_only: true },
        CatalogEntry { op_id: "date.add_days", label: "Add Days", category: "dateTime", node_kind: "csOperation", inputs: vec![p("d", "Date"), p("n", "n (days)")], pro_only: true },
        CatalogEntry { op_id: "date.is_leap_year", label: "Is Leap Year", category: "dateTime", node_kind: "csOperation", inputs: vec![p("y", "Year")], pro_only: true },
        CatalogEntry { op_id: "date.days_in_month", label: "Days in Month", category: "dateTime", node_kind: "csOperation", inputs: vec![p("m", "Month"), p("y", "Year")], pro_only: true },

        // ── BLK-08: Text / String (SCI-08 text) ──────────────────────────
        CatalogEntry { op_id: "num_to_text", label: "Number to Text", category: "text", node_kind: "csOperation", inputs: vec![p("value", "Value"), p("format", "Format")], pro_only: false },
        CatalogEntry { op_id: "text_concat", label: "Concat Text", category: "text", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: false },
        CatalogEntry { op_id: "text_length", label: "Text Length", category: "text", node_kind: "csOperation", inputs: vec![p("text", "Text")], pro_only: false },
        CatalogEntry { op_id: "text_to_num", label: "Text to Number", category: "text", node_kind: "csOperation", inputs: vec![p("text", "Text")], pro_only: false },

        // ── SCI-04: Interval Arithmetic ───────────────────────────────────
        CatalogEntry { op_id: "interval_from", label: "Interval (center ± hw)", category: "interval", node_kind: "csOperation", inputs: vec![p("center", "Center"), p("half_width", "±hw")], pro_only: true },
        CatalogEntry { op_id: "interval_from_bounds", label: "Interval [lo, hi]", category: "interval", node_kind: "csOperation", inputs: vec![p("lo", "Lo"), p("hi", "Hi")], pro_only: true },
        CatalogEntry { op_id: "interval_lo", label: "Interval Lo", category: "interval", node_kind: "csOperation", inputs: vec![p("interval", "Interval")], pro_only: true },
        CatalogEntry { op_id: "interval_hi", label: "Interval Hi", category: "interval", node_kind: "csOperation", inputs: vec![p("interval", "Interval")], pro_only: true },
        CatalogEntry { op_id: "interval_mid", label: "Interval Mid", category: "interval", node_kind: "csOperation", inputs: vec![p("interval", "Interval")], pro_only: true },
        CatalogEntry { op_id: "interval_width", label: "Interval Width", category: "interval", node_kind: "csOperation", inputs: vec![p("interval", "Interval")], pro_only: true },
        CatalogEntry { op_id: "interval_contains", label: "Interval Contains", category: "interval", node_kind: "csOperation", inputs: vec![p("interval", "Interval"), p("x", "x")], pro_only: true },
        CatalogEntry { op_id: "interval_add", label: "Interval Add", category: "interval", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },
        CatalogEntry { op_id: "interval_sub", label: "Interval Subtract", category: "interval", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },
        CatalogEntry { op_id: "interval_mul", label: "Interval Multiply", category: "interval", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },
        CatalogEntry { op_id: "interval_div", label: "Interval Divide", category: "interval", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },
        CatalogEntry { op_id: "interval_pow", label: "Interval Power", category: "interval", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },

        // ── SCI-08: Complex Numbers ───────────────────────────────────────
        CatalogEntry { op_id: "complex_from", label: "Complex From Re/Im", category: "complex", node_kind: "csOperation", inputs: vec![p("re", "Re"), p("im", "Im")], pro_only: true },
        CatalogEntry { op_id: "complex_re", label: "Real Part", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_im", label: "Imaginary Part", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_mag", label: "Magnitude |z|", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_arg", label: "Argument ∠z", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_conj", label: "Conjugate z*", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_add", label: "Complex Add", category: "complex", node_kind: "csOperation", inputs: vec![p("a", "z₁"), p("b", "z₂")], pro_only: true },
        CatalogEntry { op_id: "complex_mul", label: "Complex Multiply", category: "complex", node_kind: "csOperation", inputs: vec![p("a", "z₁"), p("b", "z₂")], pro_only: true },
        CatalogEntry { op_id: "complex_div", label: "Complex Divide", category: "complex", node_kind: "csOperation", inputs: vec![p("a", "z₁"), p("b", "z₂")], pro_only: true },
        CatalogEntry { op_id: "complex_exp", label: "Complex Exp eᶻ", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_ln", label: "Complex Ln", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z")], pro_only: true },
        CatalogEntry { op_id: "complex_pow", label: "Complex Power", category: "complex", node_kind: "csOperation", inputs: vec![p("z", "z"), p("n", "n")], pro_only: true },

        // ── SCI-09: Matrix Operations ─────────────────────────────────────
        CatalogEntry { op_id: "matrix_from_table", label: "Table to Matrix", category: "matrix", node_kind: "csOperation", inputs: vec![p("table", "Table")], pro_only: true },
        CatalogEntry { op_id: "matrix_to_table", label: "Matrix to Table", category: "matrix", node_kind: "csOperation", inputs: vec![p("matrix", "Matrix")], pro_only: true },
        CatalogEntry { op_id: "matrix_multiply", label: "Matrix Multiply", category: "matrix", node_kind: "csOperation", inputs: vec![p("a", "A"), p("b", "B")], pro_only: true },
        CatalogEntry { op_id: "matrix_transpose", label: "Matrix Transpose", category: "matrix", node_kind: "csOperation", inputs: vec![p("matrix", "Matrix")], pro_only: true },
        CatalogEntry { op_id: "matrix_inverse", label: "Matrix Inverse", category: "matrix", node_kind: "csOperation", inputs: vec![p("matrix", "Matrix")], pro_only: true },
        CatalogEntry { op_id: "matrix_det", label: "Determinant", category: "matrix", node_kind: "csOperation", inputs: vec![p("matrix", "Matrix")], pro_only: true },
        CatalogEntry { op_id: "matrix_trace", label: "Trace", category: "matrix", node_kind: "csOperation", inputs: vec![p("matrix", "Matrix")], pro_only: true },
        CatalogEntry { op_id: "matrix_solve", label: "Solve Ax = b", category: "matrix", node_kind: "csOperation", inputs: vec![p("a", "A (matrix)"), p("b", "b (vector)")], pro_only: true },

        // ── BLK-10: Lookup Table Interpolation ───────────────────────────
        CatalogEntry { op_id: "lookup.1d", label: "Lookup Table 1D", category: "tableOps", node_kind: "csOperation", inputs: vec![p("x_vec", "X (vector)"), p("y_vec", "Y (vector)"), p("x", "Query X")], pro_only: false },
        CatalogEntry { op_id: "lookup.2d", label: "Lookup Table 2D", category: "tableOps", node_kind: "csOperation", inputs: vec![p("x_vec", "X axis"), p("y_vec", "Y axis"), p("z_mat", "Z (table)"), p("x", "Query X"), p("y", "Query Y")], pro_only: false },

        // ── SCI-12: Signal Processing / FFT ──────────────────────────────
        CatalogEntry { op_id: "signal.fft_magnitude", label: "FFT Magnitude", category: "signal", node_kind: "csOperation", inputs: vec![p("y", "y (vector)")], pro_only: true },
        CatalogEntry { op_id: "signal.fft_power", label: "FFT Power", category: "signal", node_kind: "csOperation", inputs: vec![p("y", "y (vector)")], pro_only: true },
        CatalogEntry { op_id: "signal.fft_freq_bins", label: "FFT Freq Bins", category: "signal", node_kind: "csOperation", inputs: vec![p("n", "N (samples)"), p("sample_rate", "fs (Hz)")], pro_only: true },
        CatalogEntry { op_id: "signal.window_hann", label: "Hann Window", category: "signal", node_kind: "csOperation", inputs: vec![p("n", "N (length)")], pro_only: true },
        CatalogEntry { op_id: "signal.window_hamming", label: "Hamming Window", category: "signal", node_kind: "csOperation", inputs: vec![p("n", "N (length)")], pro_only: true },
        CatalogEntry { op_id: "signal.window_blackman", label: "Blackman Window", category: "signal", node_kind: "csOperation", inputs: vec![p("n", "N (length)")], pro_only: true },
        CatalogEntry { op_id: "signal.filter_lowpass_fir", label: "Low-pass FIR Filter", category: "signal", node_kind: "csOperation", inputs: vec![p("y", "y (vector)"), p("cutoff_norm", "f_c/f_s"), p("taps", "Taps")], pro_only: true },
        CatalogEntry { op_id: "signal.filter_highpass_fir", label: "High-pass FIR Filter", category: "signal", node_kind: "csOperation", inputs: vec![p("y", "y (vector)"), p("cutoff_norm", "f_c/f_s"), p("taps", "Taps")], pro_only: true },
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
pub const ENGINE_CONTRACT_VERSION: u32 = 3;

pub fn engine_contract_version() -> u32 {
    ENGINE_CONTRACT_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_expected_count() {
        let cat = catalog();
        assert_eq!(cat.len(), 313);
    }

    #[test]
    fn catalog_json_roundtrip() {
        let json = catalog_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.as_array().unwrap().len(), 313);
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
