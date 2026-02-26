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
        assert_eq!(cat.len(), 57);
    }

    #[test]
    fn catalog_json_roundtrip() {
        let json = catalog_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.as_array().unwrap().len(), 57);
    }

    #[test]
    fn known_ops_present() {
        let cat = catalog();
        let ids: Vec<&str> = cat.iter().map(|e| e.op_id).collect();
        for expected in &["add", "sin", "vectorSum", "tableFilter", "xyPlot", "display"] {
            assert!(ids.contains(expected), "Missing op: {}", expected);
        }
    }
}
