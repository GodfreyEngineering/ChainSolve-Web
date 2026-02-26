//! Ops catalog — canonical metadata for every block type.
//!
//! This is the single source of truth for block metadata. The TypeScript
//! UI reads this catalog on startup to build the block library palette.

use serde::Serialize;

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
        // ── Constants ────────────────────────────────────────────
        CatalogEntry {
            op_id: "pi",
            label: "Pi (\u{03C0})",
            category: "constants",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "euler",
            label: "E (e)",
            category: "constants",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "tau",
            label: "Tau (\u{03C4})",
            category: "constants",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
        CatalogEntry {
            op_id: "phi",
            label: "Phi (\u{03C6})",
            category: "constants",
            node_kind: "csSource",
            inputs: vec![],
            pro_only: false,
        },
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
        // ── Data (Pro) ───────────────────────────────────────────
        CatalogEntry {
            op_id: "vectorInput",
            label: "Vector Input",
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
            op_id: "csvImport",
            label: "CSV Import",
            category: "data",
            node_kind: "csData",
            inputs: vec![],
            pro_only: true,
        },
        // ── Vector Ops (Pro) ─────────────────────────────────────
        CatalogEntry {
            op_id: "vectorLength",
            label: "Vec Length",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSum",
            label: "Vec Sum",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMean",
            label: "Vec Mean",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMin",
            label: "Vec Min",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMax",
            label: "Vec Max",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSort",
            label: "Vec Sort",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorReverse",
            label: "Vec Reverse",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorSlice",
            label: "Vec Slice",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec"), p("start", "Start"), p("end", "End")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorConcat",
            label: "Vec Concat",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("a", "A"), p("b", "B")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "vectorMap",
            label: "Vec \u{00D7} Scalar",
            category: "vectorOps",
            node_kind: "csOperation",
            inputs: vec![p("vec", "Vec"), p("scalar", "Scalar")],
            pro_only: true,
        },
        // ── Table Ops (Pro) ──────────────────────────────────────
        CatalogEntry {
            op_id: "tableFilter",
            label: "Table Filter",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("table", "Table"), p("col", "Col #"), p("threshold", "Threshold")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "tableSort",
            label: "Table Sort",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("table", "Table"), p("col", "Col #")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "tableColumn",
            label: "Table Column",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("table", "Table"), p("col", "Col #")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "tableAddColumn",
            label: "Add Column",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("table", "Table"), p("vec", "Vec")],
            pro_only: true,
        },
        CatalogEntry {
            op_id: "tableJoin",
            label: "Table Join",
            category: "tableOps",
            node_kind: "csOperation",
            inputs: vec![p("a", "Table A"), p("b", "Table B")],
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
    ]
}

/// Serialize the catalog as JSON.
pub fn catalog_json() -> String {
    serde_json::to_string(&catalog()).expect("catalog serialization")
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
pub const ENGINE_CONTRACT_VERSION: u32 = 1;

pub fn engine_contract_version() -> u32 {
    ENGINE_CONTRACT_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_expected_count() {
        let cat = catalog();
        assert_eq!(cat.len(), 117);
    }

    #[test]
    fn catalog_json_roundtrip() {
        let json = catalog_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.as_array().unwrap().len(), 117);
    }

    #[test]
    fn known_ops_present() {
        let cat = catalog();
        let ids: Vec<&str> = cat.iter().map(|e| e.op_id).collect();
        for expected in &["add", "sin", "vectorSum", "tableFilter", "xyPlot", "display", "eng.mechanics.force_ma", "eng.elec.ohms_V"] {
            assert!(ids.contains(expected), "Missing op: {}", expected);
        }
    }
}
