//! ChainSolve CLI — headless graph execution (10.5).
//!
//! Reads a `.chainsolve` or `.json` snapshot file (EngineSnapshotV1 format),
//! evaluates all blocks, and outputs results to stdout.
//!
//! ## Usage
//!
//! ```text
//! chainsolve [OPTIONS] <graph.chainsolve>
//!
//! OPTIONS:
//!   --output json          Output full result JSON (default)
//!   --output csv           Output node values as CSV
//!   --output summary       Output human-readable summary
//!   --node <id>            Filter output to a single node ID
//!   --param <id>=<value>   Override a Number node's value before evaluation
//!   --no-diagnostics       Suppress diagnostics in output
//!   --timing               Print evaluation timing to stderr
//!   --version              Print version and exit
//!   --help                 Print this help and exit
//! ```
//!
//! ## Exit codes
//!
//! - 0: success (even if some nodes produced errors)
//! - 1: fatal error (bad JSON, file not found, invalid snapshot)
//! - 2: invalid arguments

use std::collections::HashMap;
use std::process;

use engine_core::types::{EvalResult, Value};

/// Print usage to stderr.
fn usage() {
    eprintln!(
        "ChainSolve CLI v{ver}
Headless graph evaluation for CI/CD and batch workflows.

USAGE:
    chainsolve [OPTIONS] <graph.chainsolve>

OPTIONS:
    --output json          Output full EvalResult as JSON (default)
    --output csv           Output node values as CSV (id,type,value)
    --output summary       Human-readable summary of node values
    --node <id>            Restrict output to a single node by ID
    --param <id>=<value>   Override a number node's value (repeatable)
    --no-diagnostics       Suppress diagnostic messages in output
    --timing               Print timing information to stderr
    --version              Print version and exit
    --help                 Print this help and exit

INPUT FORMAT:
    EngineSnapshotV1 JSON — {{\"version\":1,\"nodes\":[...],\"edges\":[...]}}

EXIT CODES:
    0  Success (graph evaluated; individual node errors are reported, not fatal)
    1  Fatal error (file not found, invalid JSON, snapshot version mismatch)
    2  Invalid arguments",
        ver = env!("CARGO_PKG_VERSION")
    );
}

/// Parse `--param id=value` overrides into a map.
fn parse_param(s: &str) -> Option<(String, f64)> {
    let (id, val) = s.split_once('=')?;
    let v: f64 = val.trim().parse().ok()?;
    Some((id.trim().to_string(), v))
}

/// Serialize a `Value` to a compact human-readable string for CSV/summary output.
fn value_to_display(v: &Value) -> String {
    match v {
        Value::Scalar { value } => format!("{value}"),
        Value::Vector { value } => {
            let preview: Vec<String> = value.iter().take(6).map(|x| format!("{x}")).collect();
            if value.len() > 6 {
                format!("[{}… ({} items)]", preview.join(", "), value.len())
            } else {
                format!("[{}]", preview.join(", "))
            }
        }
        Value::Matrix { rows, cols, data } => {
            let total = rows * cols;
            let preview: Vec<String> = data.iter().take(4).map(|x| format!("{x:.4}")).collect();
            if total > 4 {
                format!("Matrix({rows}×{cols})[{}…]", preview.join(", "))
            } else {
                format!("Matrix({rows}×{cols})[{}]", preview.join(", "))
            }
        }
        Value::Table { columns, rows } => {
            format!("Table({}cols×{}rows)", columns.len(), rows.len())
        }
        Value::Text { value } => {
            if value.len() > 60 {
                format!("\"{}…\"", &value[..60])
            } else {
                format!("\"{value}\"")
            }
        }
        Value::Error { message } => format!("ERROR: {message}"),
        Value::Interval { lo, hi } => format!("[{lo}, {hi}]"),
        Value::Complex { re, im } => {
            if *im >= 0.0 {
                format!("{re}+{im}i")
            } else {
                format!("{re}{im}i")
            }
        }
        Value::HighPrecision { display, .. } => display.clone(),
    }
}

/// Value type name for CSV output.
fn value_type_name(v: &Value) -> &'static str {
    match v {
        Value::Scalar { .. } => "scalar",
        Value::Vector { .. } => "vector",
        Value::Matrix { .. } => "matrix",
        Value::Table { .. } => "table",
        Value::Text { .. } => "text",
        Value::Error { .. } => "error",
        Value::Interval { .. } => "interval",
        Value::Complex { .. } => "complex",
        Value::HighPrecision { .. } => "high_precision",
    }
}

/// Apply `--param id=value` overrides by patching the snapshot JSON.
///
/// Finds nodes with `block_type == "number"` (or any source node) whose `id`
/// matches the override key and updates their `data.value` field.
fn apply_param_overrides(
    snapshot_json: &str,
    overrides: &HashMap<String, f64>,
) -> String {
    if overrides.is_empty() {
        return snapshot_json.to_string();
    }

    // Parse as generic JSON, mutate, re-serialize
    let mut v: serde_json::Value = match serde_json::from_str(snapshot_json) {
        Ok(v) => v,
        Err(_) => return snapshot_json.to_string(),
    };

    if let Some(nodes) = v.get_mut("nodes").and_then(|n| n.as_array_mut()) {
        for node in nodes.iter_mut() {
            let id = node.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
            if let Some(&val) = overrides.get(&id) {
                if let Some(data) = node.get_mut("data") {
                    data["value"] = serde_json::json!(val);
                }
            }
        }
    }

    serde_json::to_string(&v).unwrap_or_else(|_| snapshot_json.to_string())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // --- Argument parsing (no external deps, hand-rolled) ---
    let mut file_path: Option<String> = None;
    let mut output_format = "json";
    let mut filter_node: Option<String> = None;
    let mut param_overrides: HashMap<String, f64> = HashMap::new();
    let mut show_diagnostics = true;
    let mut show_timing = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--help" | "-h" => {
                usage();
                process::exit(0);
            }
            "--version" | "-V" => {
                println!("chainsolve {}", env!("CARGO_PKG_VERSION"));
                process::exit(0);
            }
            "--output" => {
                i += 1;
                if i >= args.len() {
                    eprintln!("error: --output requires an argument (json|csv|summary)");
                    process::exit(2);
                }
                output_format = match args[i].as_str() {
                    "json" | "csv" | "summary" => {
                        // store as static str via leak (args live for the whole program)
                        Box::leak(args[i].clone().into_boxed_str())
                    }
                    other => {
                        eprintln!("error: unknown output format '{other}' (expected json|csv|summary)");
                        process::exit(2);
                    }
                };
            }
            "--node" => {
                i += 1;
                if i >= args.len() {
                    eprintln!("error: --node requires an argument");
                    process::exit(2);
                }
                filter_node = Some(args[i].clone());
            }
            "--param" => {
                i += 1;
                if i >= args.len() {
                    eprintln!("error: --param requires an argument (id=value)");
                    process::exit(2);
                }
                match parse_param(&args[i]) {
                    Some((id, val)) => { param_overrides.insert(id, val); }
                    None => {
                        eprintln!("error: --param '{}' is not valid (expected id=<number>)", args[i]);
                        process::exit(2);
                    }
                }
            }
            "--no-diagnostics" => { show_diagnostics = false; }
            "--timing" => { show_timing = true; }
            arg if arg.starts_with("--") => {
                eprintln!("error: unknown option '{arg}'. Run with --help for usage.");
                process::exit(2);
            }
            path => {
                if file_path.is_some() {
                    eprintln!("error: multiple input files specified");
                    process::exit(2);
                }
                file_path = Some(path.to_string());
            }
        }
        i += 1;
    }

    let file_path = match file_path {
        Some(p) => p,
        None => {
            usage();
            process::exit(2);
        }
    };

    // --- Read input file ---
    let snapshot_json = match std::fs::read_to_string(&file_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: cannot read '{}': {}", file_path, e);
            process::exit(1);
        }
    };

    // --- Apply parameter overrides ---
    let snapshot_json = apply_param_overrides(&snapshot_json, &param_overrides);

    // --- Evaluate ---
    let result: EvalResult = match engine_core::run(&snapshot_json) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("error: evaluation failed: {}", e);
            process::exit(1);
        }
    };

    // --- Timing ---
    if show_timing {
        eprintln!(
            "timing: {:.3}ms ({} nodes evaluated)",
            result.elapsed_us as f64 / 1000.0,
            result.values.len()
        );
    }

    // --- Filter to single node if requested ---
    let values: HashMap<&str, &Value> = if let Some(ref id) = filter_node {
        result
            .values
            .iter()
            .filter(|(k, _)| k.as_str() == id.as_str())
            .map(|(k, v)| (k.as_str(), v))
            .collect()
    } else {
        result
            .values
            .iter()
            .map(|(k, v)| (k.as_str(), v))
            .collect()
    };

    // --- Output ---
    match output_format {
        "csv" => {
            println!("node_id,type,value");
            let mut ids: Vec<&&str> = values.keys().collect();
            ids.sort();
            for id in ids {
                let v = values[id];
                println!("{},{},{}", id, value_type_name(v), value_to_display(v));
            }
        }
        "summary" => {
            let mut ids: Vec<&&str> = values.keys().collect();
            ids.sort();
            for id in ids {
                let v = values[id];
                println!("[{id}] ({}) = {}", value_type_name(v), value_to_display(v));
            }
            if show_diagnostics && !result.diagnostics.is_empty() {
                eprintln!("\n--- Diagnostics ---");
                for d in &result.diagnostics {
                    eprintln!("{:?}", d);
                }
            }
        }
        _ => {
            // json (default)
            // Build filtered output object
            let mut out = serde_json::Map::new();

            // Values
            let vals_obj: serde_json::Map<String, serde_json::Value> = values
                .iter()
                .map(|(&id, &v)| {
                    (id.to_string(), serde_json::to_value(v).unwrap_or(serde_json::Value::Null))
                })
                .collect();
            out.insert("values".to_string(), serde_json::Value::Object(vals_obj));

            // Diagnostics (optional)
            if show_diagnostics {
                out.insert(
                    "diagnostics".to_string(),
                    serde_json::to_value(&result.diagnostics).unwrap_or_default(),
                );
            }

            // Timing
            out.insert(
                "elapsed_us".to_string(),
                serde_json::Value::Number(result.elapsed_us.into()),
            );

            match serde_json::to_string_pretty(&serde_json::Value::Object(out)) {
                Ok(s) => println!("{s}"),
                Err(e) => {
                    eprintln!("error: failed to serialize output: {e}");
                    process::exit(1);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use engine_core::types::Value;

    #[test]
    fn parse_param_valid() {
        assert_eq!(parse_param("x=3.14"), Some(("x".to_string(), 3.14)));
        assert_eq!(parse_param("myNode=0"), Some(("myNode".to_string(), 0.0)));
        assert_eq!(parse_param("n1=-5.5"), Some(("n1".to_string(), -5.5)));
    }

    #[test]
    fn parse_param_invalid() {
        assert_eq!(parse_param("no_equals"), None);
        assert_eq!(parse_param("x=notanumber"), None);
        assert_eq!(parse_param(""), None);
    }

    #[test]
    fn value_display_scalar() {
        let v = Value::Scalar { value: 42.0 };
        assert_eq!(value_to_display(&v), "42");
    }

    #[test]
    fn value_display_vector_short() {
        let v = Value::Vector { value: vec![1.0, 2.0, 3.0] };
        assert_eq!(value_to_display(&v), "[1, 2, 3]");
    }

    #[test]
    fn value_display_vector_long_truncated() {
        let v = Value::Vector { value: vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0] };
        let d = value_to_display(&v);
        assert!(d.contains("(7 items)"), "Expected truncation: {d}");
    }

    #[test]
    fn value_display_error() {
        let v = Value::Error { message: "divide by zero".to_string() };
        assert_eq!(value_to_display(&v), "ERROR: divide by zero");
    }

    #[test]
    fn value_display_complex() {
        let v = Value::Complex { re: 1.0, im: 2.0 };
        assert_eq!(value_to_display(&v), "1+2i");
        let v2 = Value::Complex { re: 1.0, im: -2.0 };
        assert_eq!(value_to_display(&v2), "1-2i");
    }

    #[test]
    fn apply_param_overrides_empty() {
        let json = r#"{"version":1,"nodes":[],"edges":[]}"#;
        let result = apply_param_overrides(json, &HashMap::new());
        assert_eq!(result, json);
    }

    #[test]
    fn apply_param_overrides_updates_node() {
        let json = r#"{"version":1,"nodes":[{"id":"n1","blockType":"number","data":{"value":1.0}}],"edges":[]}"#;
        let mut overrides = HashMap::new();
        overrides.insert("n1".to_string(), 99.0);
        let result = apply_param_overrides(json, &overrides);
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let new_val = v["nodes"][0]["data"]["value"].as_f64().unwrap();
        assert!((new_val - 99.0).abs() < 1e-10, "Expected 99.0, got {new_val}");
    }

    #[test]
    fn cli_evaluates_simple_graph() {
        // Direct API test: evaluate a number → add graph
        let snapshot = r#"{"version":1,"nodes":[
            {"id":"a","blockType":"number","data":{"value":10}},
            {"id":"b","blockType":"number","data":{"value":5}},
            {"id":"c","blockType":"add","data":{}}
        ],"edges":[
            {"id":"e1","source":"a","sourceHandle":"out","target":"c","targetHandle":"in_0"},
            {"id":"e2","source":"b","sourceHandle":"out","target":"c","targetHandle":"in_1"}
        ]}"#;
        let result = engine_core::run(snapshot).unwrap();
        if let Some(Value::Scalar { value }) = result.values.get("c") {
            assert!((value - 15.0).abs() < 1e-10, "Expected 15, got {value}");
        } else {
            panic!("Expected scalar at node 'c', got {:?}", result.values.get("c"));
        }
    }
}
