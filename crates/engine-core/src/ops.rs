//! Per-node evaluation dispatch for all ~60 block types.
//!
//! # Entry point
//!
//! [`evaluate_node`] (and the dataset-aware [`evaluate_node_with_datasets`]) are
//! the only public functions. The graph evaluator calls one of them once per node
//! in topological order.
//!
//! # Broadcasting
//!
//! Most binary ops (add, multiply, …) support mixed Scalar/Vector operands:
//!
//! - Scalar  ⊕ Scalar  → Scalar
//! - Scalar  ⊕ Vector  → Vector (broadcast scalar across each element)
//! - Vector  ⊕ Scalar  → Vector
//! - Vector  ⊕ Vector  → Vector (element-wise; lengths must match or Error)
//! - Any     ⊕ Error   → Error  (error propagates)
//! - Table inputs pass through unchanged for ops that accept them.
//!
//! # Error propagation
//!
//! If any required input is `Value::Error`, the node immediately returns
//! `Value::Error` without computing. NaN and Inf propagate for scalar paths
//! (e.g. `1.0 / 0.0 → Inf`, `0.0 / 0.0 → NaN`).

use crate::types::Value;
use std::collections::HashMap;

/// Evaluate a single node given its block type, resolved input values,
/// the node's own data map, and an optional dataset registry.
///
/// Unknown block types return `Value::Error`.
pub fn evaluate_node(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
) -> Value {
    evaluate_node_with_datasets(block_type, inputs, data, None)
}

/// Like `evaluate_node` but with access to a dataset registry.
/// Data blocks (`vectorInput`, `tableInput`, `csvImport`) will check
/// `data.datasetRef` and look up large arrays from the registry.
pub fn evaluate_node_with_datasets(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
    datasets: Option<&HashMap<String, Vec<f64>>>,
) -> Value {
    let raw = evaluate_node_inner(block_type, inputs, data, datasets);
    canonicalize_value(raw)
}

/// Inner dispatch — not canonicalized. Called by evaluate_node_with_datasets.
fn evaluate_node_inner(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
    datasets: Option<&HashMap<String, Vec<f64>>>,
) -> Value {
    match block_type {
        // ── Sources (0 inputs) ────────────────────────────────────
        "number" | "slider" => {
            let v = data
                .get("value")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            Value::scalar(v)
        }

        // Constants
        "pi" => Value::scalar(std::f64::consts::PI),
        "euler" => Value::scalar(std::f64::consts::E),
        "tau" => Value::scalar(std::f64::consts::TAU),
        "phi" => Value::scalar(1.618_033_988_749_895),
        "ln2" => Value::scalar(std::f64::consts::LN_2),
        "ln10" => Value::scalar(std::f64::consts::LN_10),
        "sqrt2" => Value::scalar(std::f64::consts::SQRT_2),
        "inf" => Value::scalar(f64::INFINITY),

        // ── Math (2 inputs: a, b or 1 input: in) ─────────────────
        "add" => binary_broadcast(inputs, |a, b| a + b),
        "subtract" => binary_broadcast(inputs, |a, b| a - b),
        "multiply" => binary_broadcast(inputs, |a, b| a * b),
        "divide" => binary_broadcast(inputs, |a, b| a / b),
        "power" => binary_broadcast_ports(inputs, "base", "exp", |base, exp| base.powf(exp)),
        "mod" => binary_broadcast(inputs, |a, b| a % b),
        "clamp" => {
            let x = scalar_or_nan(inputs, "val");
            let lo = scalar_or_nan(inputs, "min");
            let hi = scalar_or_nan(inputs, "max");
            Value::scalar(x.max(lo).min(hi))
        }
        "negate" => unary_broadcast(inputs, |x| -x),
        "abs" => unary_broadcast(inputs, |x| x.abs()),
        "sqrt" => unary_broadcast(inputs, |x| x.sqrt()),
        "floor" => unary_broadcast(inputs, |x| x.floor()),
        "ceil" => unary_broadcast(inputs, |x| x.ceil()),
        "round" => unary_broadcast(inputs, |x| x.round()),

        // ── Trig ──────────────────────────────────────────────────
        "sin" => unary_broadcast(inputs, |x| x.sin()),
        "cos" => unary_broadcast(inputs, |x| x.cos()),
        "tan" => unary_broadcast(inputs, |x| x.tan()),
        "asin" => unary_broadcast(inputs, |x| x.asin()),
        "acos" => unary_broadcast(inputs, |x| x.acos()),
        "atan" => unary_broadcast(inputs, |x| x.atan()),
        "atan2" => binary_broadcast_ports(inputs, "y", "x", |y, x| y.atan2(x)),
        "degToRad" => unary_broadcast_port(inputs, "deg", |d| d.to_radians()),
        "radToDeg" => unary_broadcast_port(inputs, "rad", |r| r.to_degrees()),

        // ── Logic ─────────────────────────────────────────────────
        "greater" => binary_broadcast(inputs, |a, b| if a > b { 1.0 } else { 0.0 }),
        "less" => binary_broadcast(inputs, |a, b| if a < b { 1.0 } else { 0.0 }),
        "equal" => binary_broadcast(inputs, |a, b| if (a - b).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
        "max" => binary_broadcast(inputs, |a, b| a.max(b)),
        "min" => binary_broadcast(inputs, |a, b| a.min(b)),
        "ifthenelse" => {
            let cond = scalar_or_nan(inputs, "cond");
            let then = scalar_or_nan(inputs, "then");
            let els = scalar_or_nan(inputs, "else");
            Value::scalar(if cond != 0.0 { then } else { els })
        }

        // ── Output (pass-through) ────────────────────────────────
        "display" => {
            inputs
                .get("value")
                .cloned()
                .unwrap_or(Value::scalar(f64::NAN))
        }

        // ── Data blocks (0 inputs, read from node data or dataset registry) ────
        "vectorInput" => {
            // Check dataset registry first (zero-copy path for large arrays).
            if let Some(ds_id) = data.get("datasetRef").and_then(|v| v.as_str()) {
                if let Some(ds) = datasets.and_then(|d| d.get(ds_id)) {
                    return Value::Vector { value: ds.clone() };
                }
            }
            match data.get("vectorData").and_then(|v| v.as_array()) {
                Some(arr) => {
                    let values: Vec<f64> = arr.iter().filter_map(|v| v.as_f64()).collect();
                    Value::Vector { value: values }
                }
                None => Value::Vector { value: vec![] },
            }
        }
        "tableInput" => read_table_from_data(data, false),
        "csvImport" => read_table_from_data(data, true),

        // ── Vector ops ──────────────────────────────────────────
        "vectorLength" => match require_vector(inputs, "vec", "Length") {
            Ok(v) => Value::scalar(v.len() as f64),
            Err(e) => e,
        },
        "vectorSum" => match require_vector(inputs, "vec", "Sum") {
            Ok(v) => Value::scalar(v.iter().sum()),
            Err(e) => e,
        },
        "vectorMean" => match require_vector(inputs, "vec", "Mean") {
            Ok(v) if v.is_empty() => Value::error("Mean: empty vector"),
            Ok(v) => Value::scalar(v.iter().sum::<f64>() / v.len() as f64),
            Err(e) => e,
        },
        "vectorMin" => match require_vector(inputs, "vec", "Min") {
            Ok(v) if v.is_empty() => Value::error("Min: empty vector"),
            Ok(v) => Value::scalar(v.iter().cloned().fold(f64::INFINITY, f64::min)),
            Err(e) => e,
        },
        "vectorMax" => match require_vector(inputs, "vec", "Max") {
            Ok(v) if v.is_empty() => Value::error("Max: empty vector"),
            Ok(v) => Value::scalar(v.iter().cloned().fold(f64::NEG_INFINITY, f64::max)),
            Err(e) => e,
        },
        "vectorSort" => match require_vector(inputs, "vec", "Sort") {
            Ok(v) => {
                let mut sorted = v.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                Value::Vector { value: sorted }
            }
            Err(e) => e,
        },
        "vectorReverse" => match require_vector(inputs, "vec", "Reverse") {
            Ok(v) => {
                let mut rev = v.clone();
                rev.reverse();
                Value::Vector { value: rev }
            }
            Err(e) => e,
        },
        "vectorSlice" => match require_vector(inputs, "vec", "Slice") {
            Ok(v) => {
                let s = scalar_or_nan(inputs, "start");
                let e = scalar_or_nan(inputs, "end");
                let start = if s.is_nan() { 0 } else { s.floor() as usize };
                let end = if e.is_nan() { v.len() } else { e.floor() as usize };
                let start = start.min(v.len());
                let end = end.min(v.len()).max(start);
                Value::Vector { value: v[start..end].to_vec() }
            }
            Err(e) => e,
        },
        "vectorConcat" => {
            let a = require_vector(inputs, "a", "Concat");
            let b = require_vector(inputs, "b", "Concat");
            match (a, b) {
                (Ok(va), Ok(vb)) => {
                    let mut result = va.clone();
                    result.extend_from_slice(&vb);
                    Value::Vector { value: result }
                }
                (Err(e), _) | (_, Err(e)) => e,
            }
        }
        "vectorMap" => match require_vector(inputs, "vec", "Map") {
            Ok(v) => {
                let s = scalar_or_nan(inputs, "scalar");
                if s.is_nan() {
                    Value::error("Map: expected scalar multiplier")
                } else {
                    Value::Vector { value: v.iter().map(|x| x * s).collect() }
                }
            }
            Err(e) => e,
        },

        // ── Table ops ───────────────────────────────────────────
        "tableFilter" => match require_table(inputs, "table", "Filter") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                let threshold = scalar_or_nan(inputs, "threshold");
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Filter: column index out of range")
                } else if threshold.is_nan() {
                    Value::error("Filter: expected threshold")
                } else {
                    let ci = ci as usize;
                    let filtered: Vec<Vec<f64>> = rows.iter()
                        .filter(|row| row.get(ci).copied().unwrap_or(f64::NAN) > threshold)
                        .cloned()
                        .collect();
                    Value::Table { columns: cols.clone(), rows: filtered }
                }
            }
            Err(e) => e,
        },
        "tableSort" => match require_table(inputs, "table", "Sort") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Sort: column index out of range")
                } else {
                    let ci = ci as usize;
                    let mut sorted = rows.clone();
                    sorted.sort_by(|a, b| {
                        let va = a.get(ci).copied().unwrap_or(0.0);
                        let vb = b.get(ci).copied().unwrap_or(0.0);
                        va.partial_cmp(&vb).unwrap_or(std::cmp::Ordering::Equal)
                    });
                    Value::Table { columns: cols.clone(), rows: sorted }
                }
            }
            Err(e) => e,
        },
        "tableColumn" => match require_table(inputs, "table", "Column") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Column: column index out of range")
                } else {
                    let ci = ci as usize;
                    let values: Vec<f64> = rows.iter()
                        .map(|row| row.get(ci).copied().unwrap_or(f64::NAN))
                        .collect();
                    Value::Vector { value: values }
                }
            }
            Err(e) => e,
        },
        "tableAddColumn" => match require_table(inputs, "table", "AddColumn") {
            Ok((cols, rows)) => match require_vector(inputs, "vec", "AddColumn") {
                Ok(vec) => {
                    let col_name = format!("Col{}", cols.len() + 1);
                    let mut new_cols = cols.clone();
                    new_cols.push(col_name);
                    let max_len = rows.len().max(vec.len());
                    let mut new_rows: Vec<Vec<f64>> = Vec::with_capacity(max_len);
                    for i in 0..max_len {
                        let mut row = if i < rows.len() {
                            rows[i].clone()
                        } else {
                            vec![f64::NAN; cols.len()]
                        };
                        row.push(if i < vec.len() { vec[i] } else { f64::NAN });
                        new_rows.push(row);
                    }
                    Value::Table { columns: new_cols, rows: new_rows }
                }
                Err(e) => e,
            },
            Err(e) => e,
        },
        "tableJoin" => {
            let a = require_table(inputs, "a", "Join");
            let b = require_table(inputs, "b", "Join");
            match (a, b) {
                (Ok((ca, ra)), Ok((cb, rb))) => {
                    let mut new_cols = ca.clone();
                    new_cols.extend(cb.iter().cloned());
                    let max_len = ra.len().max(rb.len());
                    let mut new_rows: Vec<Vec<f64>> = Vec::with_capacity(max_len);
                    for i in 0..max_len {
                        let row_a = if i < ra.len() { ra[i].clone() } else { vec![f64::NAN; ca.len()] };
                        let row_b = if i < rb.len() { rb[i].clone() } else { vec![f64::NAN; cb.len()] };
                        let mut row = row_a;
                        row.extend(row_b);
                        new_rows.push(row);
                    }
                    Value::Table { columns: new_cols, rows: new_rows }
                }
                (Err(e), _) | (_, Err(e)) => e,
            }
        }

        // ── Plot blocks (terminal, return point count) ──────────
        "xyPlot" | "histogram" | "barChart" | "heatmap" => {
            data_point_count(inputs.get("data"))
        }

        _ => Value::error(format!("Unknown block type: {}", block_type)),
    }
}

// ── Canonicalization ─────────────────────────────────────────────

/// Canonicalize NaN to a single bit pattern and normalize -0 to +0.
#[inline]
fn canonicalize(v: f64) -> f64 {
    if v.is_nan() {
        f64::NAN
    } else if v == 0.0 {
        0.0 // normalizes -0.0 to +0.0
    } else {
        v
    }
}

/// Canonicalize all f64 values in a Value.
fn canonicalize_value(v: Value) -> Value {
    match v {
        Value::Scalar { value } => Value::Scalar {
            value: canonicalize(value),
        },
        Value::Vector { value } => Value::Vector {
            value: value.into_iter().map(canonicalize).collect(),
        },
        Value::Table { columns, rows } => Value::Table {
            columns,
            rows: rows
                .into_iter()
                .map(|row| row.into_iter().map(canonicalize).collect())
                .collect(),
        },
        Value::Error { .. } => v,
    }
}

// ── Helpers ───────────────────────────────────────────────────────

fn scalar_or_nan(inputs: &HashMap<String, Value>, port: &str) -> f64 {
    inputs
        .get(port)
        .and_then(|v| v.as_scalar())
        .unwrap_or(f64::NAN)
}

// ── Broadcasting helpers ────────────────────────────────────────

/// Unary operation with broadcasting on a named port:
/// Scalar → Scalar, Vector → Vector (elementwise), Table → Table (elementwise),
/// Error → propagate, None → f(NaN).
fn unary_broadcast_port(
    inputs: &HashMap<String, Value>,
    port: &str,
    f: impl Fn(f64) -> f64,
) -> Value {
    match inputs.get(port) {
        Some(Value::Scalar { value }) => Value::scalar(f(*value)),
        Some(Value::Vector { value }) => Value::Vector {
            value: value.iter().map(|x| f(*x)).collect(),
        },
        Some(Value::Table { columns, rows }) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x)).collect())
                .collect(),
        },
        Some(Value::Error { message }) => Value::error(message.clone()),
        None => Value::scalar(f(f64::NAN)),
    }
}

/// Convenience: unary broadcast on port "a".
fn unary_broadcast(inputs: &HashMap<String, Value>, f: impl Fn(f64) -> f64) -> Value {
    unary_broadcast_port(inputs, "a", f)
}

/// Binary operation with broadcasting on named ports.
///
/// Rules:
/// - Scalar ⊕ Scalar → Scalar
/// - Scalar ⊕ Vector → Vector (broadcast scalar)
/// - Vector ⊕ Scalar → Vector (broadcast scalar)
/// - Vector ⊕ Vector → Vector (same-length, else error)
/// - Scalar ⊕ Table → Table (broadcast scalar)
/// - Table ⊕ Scalar → Table (broadcast scalar)
/// - Table ⊕ Table → Table (same-shape, else error)
/// - Error on either side → propagate first error
/// - Vector ⊕ Table / Table ⊕ Vector → error
fn binary_broadcast_ports(
    inputs: &HashMap<String, Value>,
    port_a: &str,
    port_b: &str,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    let a = inputs.get(port_a);
    let b = inputs.get(port_b);

    // Propagate errors first.
    if let Some(Value::Error { message }) = a {
        return Value::error(message.clone());
    }
    if let Some(Value::Error { message }) = b {
        return Value::error(message.clone());
    }

    match (a, b) {
        // Scalar ⊕ Scalar
        (Some(Value::Scalar { value: va }), Some(Value::Scalar { value: vb })) => {
            Value::scalar(f(*va, *vb))
        }
        // None cases → treat missing as NaN scalar
        (None, None) => Value::scalar(f(f64::NAN, f64::NAN)),
        (Some(Value::Scalar { value: va }), None) => Value::scalar(f(*va, f64::NAN)),
        (None, Some(Value::Scalar { value: vb })) => Value::scalar(f(f64::NAN, *vb)),

        // Scalar ⊕ Vector → Vector
        (Some(Value::Scalar { value: s }), Some(Value::Vector { value: vec })) => Value::Vector {
            value: vec.iter().map(|x| f(*s, *x)).collect(),
        },
        // Vector ⊕ Scalar → Vector
        (Some(Value::Vector { value: vec }), Some(Value::Scalar { value: s })) => Value::Vector {
            value: vec.iter().map(|x| f(*x, *s)).collect(),
        },
        // Vector ⊕ Vector → same length
        (Some(Value::Vector { value: va }), Some(Value::Vector { value: vb })) => {
            if va.len() != vb.len() {
                return Value::error(format!(
                    "Vector length mismatch: {} vs {}",
                    va.len(),
                    vb.len()
                ));
            }
            Value::Vector {
                value: va.iter().zip(vb.iter()).map(|(a, b)| f(*a, *b)).collect(),
            }
        }

        // Scalar ⊕ Table → Table
        (Some(Value::Scalar { value: s }), Some(Value::Table { columns, rows })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*s, *x)).collect())
                .collect(),
        },
        // Table ⊕ Scalar → Table
        (Some(Value::Table { columns, rows }), Some(Value::Scalar { value: s })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x, *s)).collect())
                .collect(),
        },
        // Table ⊕ Table → same shape
        (
            Some(Value::Table {
                columns: ca,
                rows: ra,
            }),
            Some(Value::Table {
                columns: cb,
                rows: rb,
            }),
        ) => {
            if ca.len() != cb.len() || ra.len() != rb.len() {
                return Value::error(format!(
                    "Table shape mismatch: {}x{} vs {}x{}",
                    ra.len(),
                    ca.len(),
                    rb.len(),
                    cb.len()
                ));
            }
            Value::Table {
                columns: ca.clone(),
                rows: ra
                    .iter()
                    .zip(rb.iter())
                    .map(|(row_a, row_b)| {
                        row_a.iter().zip(row_b.iter()).map(|(a, b)| f(*a, *b)).collect()
                    })
                    .collect(),
            }
        }

        // Vector ⊕ None → broadcast NaN
        (Some(Value::Vector { value: vec }), None) => Value::Vector {
            value: vec.iter().map(|x| f(*x, f64::NAN)).collect(),
        },
        (None, Some(Value::Vector { value: vec })) => Value::Vector {
            value: vec.iter().map(|x| f(f64::NAN, *x)).collect(),
        },
        // Table ⊕ None → broadcast NaN
        (Some(Value::Table { columns, rows }), None) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x, f64::NAN)).collect())
                .collect(),
        },
        (None, Some(Value::Table { columns, rows })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(f64::NAN, *x)).collect())
                .collect(),
        },

        // Incompatible: Vector ⊕ Table, Table ⊕ Vector, or Error ⊕ None
        (Some(va), Some(vb)) => Value::error(format!(
            "Cannot broadcast {} with {}",
            va.kind_str(),
            vb.kind_str()
        )),
        (Some(Value::Error { message }), None) | (None, Some(Value::Error { message })) => {
            Value::error(message.clone())
        }
    }
}

/// Convenience: binary broadcast on ports "a" and "b".
fn binary_broadcast(
    inputs: &HashMap<String, Value>,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    binary_broadcast_ports(inputs, "a", "b", f)
}

fn require_vector<'a>(
    inputs: &'a HashMap<String, Value>,
    port: &str,
    name: &str,
) -> Result<&'a Vec<f64>, Value> {
    match inputs.get(port) {
        Some(Value::Vector { value }) => Ok(value),
        Some(_) => Err(Value::error(format!("{}: expected vector", name))),
        None => Err(Value::error(format!("{}: no input", name))),
    }
}

fn require_table<'a>(
    inputs: &'a HashMap<String, Value>,
    port: &str,
    name: &str,
) -> Result<(&'a Vec<String>, &'a Vec<Vec<f64>>), Value> {
    match inputs.get(port) {
        Some(Value::Table { columns, rows }) => Ok((columns, rows)),
        Some(_) => Err(Value::error(format!("{}: expected table", name))),
        None => Err(Value::error(format!("{}: no input", name))),
    }
}

fn read_table_from_data(data: &HashMap<String, serde_json::Value>, require: bool) -> Value {
    let td = data.get("tableData");
    match td {
        Some(td) => {
            let columns: Vec<String> = td
                .get("columns")
                .and_then(|c| c.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_else(|| vec!["A".to_string()]);
            let rows: Vec<Vec<f64>> = td
                .get("rows")
                .and_then(|r| r.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|row| {
                            row.as_array().map(|r| {
                                r.iter().map(|v| v.as_f64().unwrap_or(f64::NAN)).collect()
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Value::Table { columns, rows }
        }
        None => {
            if require {
                Value::error("No CSV loaded")
            } else {
                Value::Table {
                    columns: vec!["A".to_string()],
                    rows: vec![],
                }
            }
        }
    }
}

fn data_point_count(input: Option<&Value>) -> Value {
    match input {
        None => Value::error("No data"),
        Some(Value::Error { message }) => Value::error(message.clone()),
        Some(Value::Vector { value }) => Value::scalar(value.len() as f64),
        Some(Value::Table { rows, .. }) => Value::scalar(rows.len() as f64),
        Some(_) => Value::error("Expected vector or table"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_inputs(pairs: &[(&str, f64)]) -> HashMap<String, Value> {
        pairs.iter().map(|(k, v)| (k.to_string(), Value::scalar(*v))).collect()
    }

    #[test]
    fn number_block() {
        let mut data = HashMap::new();
        data.insert("value".into(), serde_json::json!(42.0));
        let v = evaluate_node("number", &HashMap::new(), &data);
        assert_eq!(v.as_scalar(), Some(42.0));
    }

    #[test]
    fn add_block() {
        let inputs = make_inputs(&[("a", 3.0), ("b", 4.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(7.0));
    }

    #[test]
    fn divide_by_zero() {
        let inputs = make_inputs(&[("a", 1.0), ("b", 0.0)]);
        let v = evaluate_node("divide", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(f64::INFINITY));
    }

    #[test]
    fn missing_input_produces_nan() {
        let v = evaluate_node("add", &HashMap::new(), &HashMap::new());
        assert!(v.as_scalar().unwrap().is_nan());
    }

    #[test]
    fn unknown_block_returns_error() {
        let v = evaluate_node("bogus", &HashMap::new(), &HashMap::new());
        matches!(v, Value::Error { .. });
    }

    #[test]
    fn sin_block() {
        let inputs = make_inputs(&[("a", 0.0)]);
        let v = evaluate_node("sin", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.0).abs() < 1e-10);
    }

    #[test]
    fn display_passthrough() {
        let inputs: HashMap<String, Value> =
            [("value".to_string(), Value::scalar(99.0))].into_iter().collect();
        let v = evaluate_node("display", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(99.0));
    }

    #[test]
    fn euler_constant() {
        let v = evaluate_node("euler", &HashMap::new(), &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::E).abs() < 1e-10);
    }

    #[test]
    fn power_block() {
        let inputs = make_inputs(&[("base", 2.0), ("exp", 3.0)]);
        let v = evaluate_node("power", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(8.0));
    }

    #[test]
    fn atan2_block() {
        let inputs = make_inputs(&[("y", 1.0), ("x", 0.0)]);
        let v = evaluate_node("atan2", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
    }

    #[test]
    fn clamp_block() {
        let inputs = make_inputs(&[("val", 15.0), ("min", 0.0), ("max", 10.0)]);
        let v = evaluate_node("clamp", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn deg_to_rad_block() {
        let inputs = make_inputs(&[("deg", 180.0)]);
        let v = evaluate_node("degToRad", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::PI).abs() < 1e-10);
    }

    #[test]
    fn rad_to_deg_block() {
        let inputs = make_inputs(&[("rad", std::f64::consts::PI)]);
        let v = evaluate_node("radToDeg", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 180.0).abs() < 1e-10);
    }

    #[test]
    fn vector_input_block() {
        let mut data = HashMap::new();
        data.insert("vectorData".into(), serde_json::json!([1.0, 2.0, 3.0]));
        let v = evaluate_node("vectorInput", &HashMap::new(), &data);
        match v {
            Value::Vector { value } => assert_eq!(value, vec![1.0, 2.0, 3.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn csv_import_no_data() {
        let v = evaluate_node("csvImport", &HashMap::new(), &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "No CSV loaded"),
            _ => panic!("Expected Error"),
        }
    }

    #[test]
    fn vector_sum_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![1.0, 2.0, 3.0, 4.0] });
        let v = evaluate_node("vectorSum", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn vector_mean_empty() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![] });
        let v = evaluate_node("vectorMean", &inputs, &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "Mean: empty vector"),
            _ => panic!("Expected Error"),
        }
    }

    #[test]
    fn vector_sort_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![3.0, 1.0, 2.0] });
        let v = evaluate_node("vectorSort", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![1.0, 2.0, 3.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn table_filter_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), Value::Table {
            columns: vec!["A".into()],
            rows: vec![vec![1.0], vec![5.0], vec![3.0], vec![7.0]],
        });
        inputs.insert("col".into(), Value::scalar(0.0));
        inputs.insert("threshold".into(), Value::scalar(3.0));
        let v = evaluate_node("tableFilter", &inputs, &HashMap::new());
        match v {
            Value::Table { rows, .. } => {
                assert_eq!(rows.len(), 2); // 5 and 7
                assert_eq!(rows[0], vec![5.0]);
                assert_eq!(rows[1], vec![7.0]);
            }
            _ => panic!("Expected Table"),
        }
    }

    #[test]
    fn table_column_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), Value::Table {
            columns: vec!["A".into(), "B".into()],
            rows: vec![vec![1.0, 10.0], vec![2.0, 20.0]],
        });
        inputs.insert("col".into(), Value::scalar(1.0));
        let v = evaluate_node("tableColumn", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![10.0, 20.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn plot_point_count() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("data".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("xyPlot", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(3.0));
    }

    #[test]
    fn plot_no_data() {
        let v = evaluate_node("histogram", &HashMap::new(), &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "No data"),
            _ => panic!("Expected Error"),
        }
    }

    // ── W9.3: Broadcasting tests ─────────────────────────────────

    #[test]
    fn add_scalar_plus_vector() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(10.0));
        inputs.insert("b".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![11.0, 12.0, 13.0]),
            _ => panic!("Expected Vector, got {:?}", v),
        }
    }

    #[test]
    fn multiply_vector_times_scalar() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![2.0, 4.0, 6.0] });
        inputs.insert("b".into(), Value::scalar(3.0));
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![6.0, 12.0, 18.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn add_vector_length_mismatch() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![1.0, 2.0] });
        inputs.insert("b".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn sin_of_vector() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "a".into(),
            Value::Vector {
                value: vec![0.0, std::f64::consts::FRAC_PI_2],
            },
        );
        let v = evaluate_node("sin", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert!((value[0] - 0.0).abs() < 1e-10);
                assert!((value[1] - 1.0).abs() < 1e-10);
            }
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn add_scalar_plus_table() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(100.0));
        inputs.insert(
            "b".into(),
            Value::Table {
                columns: vec!["X".into(), "Y".into()],
                rows: vec![vec![1.0, 2.0], vec![3.0, 4.0]],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Table { rows, .. } => {
                assert_eq!(rows, vec![vec![101.0, 102.0], vec![103.0, 104.0]]);
            }
            _ => panic!("Expected Table"),
        }
    }

    #[test]
    fn vector_cross_table_is_error() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![1.0] });
        inputs.insert(
            "b".into(),
            Value::Table {
                columns: vec!["X".into()],
                rows: vec![vec![1.0]],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn nan_canonicalization() {
        // Missing inputs default to NaN → result should be canonical NaN
        let v = evaluate_node("add", &HashMap::new(), &HashMap::new());
        match v {
            Value::Scalar { value } => {
                assert!(value.is_nan());
                assert_eq!(value.to_bits(), f64::NAN.to_bits());
            }
            _ => panic!("Expected Scalar"),
        }
    }

    #[test]
    fn negative_zero_normalized() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(0.0));
        inputs.insert("b".into(), Value::scalar(0.0));
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        match v {
            Value::Scalar { value } => {
                // 0 * 0 = 0, canonicalized to +0
                assert_eq!(value.to_bits(), 0.0_f64.to_bits());
            }
            _ => panic!("Expected Scalar"),
        }
    }

    #[test]
    fn power_broadcasts() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "base".into(),
            Value::Vector { value: vec![2.0, 3.0, 4.0] },
        );
        inputs.insert("exp".into(), Value::scalar(2.0));
        let v = evaluate_node("power", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![4.0, 9.0, 16.0]),
            _ => panic!("Expected Vector, got {:?}", v),
        }
    }

    #[test]
    fn deg_to_rad_broadcasts() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "deg".into(),
            Value::Vector { value: vec![0.0, 90.0, 180.0] },
        );
        let v = evaluate_node("degToRad", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert!((value[0] - 0.0).abs() < 1e-10);
                assert!((value[1] - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
                assert!((value[2] - std::f64::consts::PI).abs() < 1e-10);
            }
            _ => panic!("Expected Vector"),
        }
    }
}
