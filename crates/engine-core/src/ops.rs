use crate::types::Value;
use std::collections::HashMap;

/// Evaluate a single node given its block type, resolved input values,
/// and the node's own data map.
///
/// Unknown block types return `Value::Error`.
pub fn evaluate_node(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
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
        "add" => binary(inputs, |a, b| a + b),
        "subtract" => binary(inputs, |a, b| a - b),
        "multiply" => binary(inputs, |a, b| a * b),
        "divide" => binary(inputs, |a, b| a / b),
        "power" => {
            let base = scalar_or_nan(inputs, "base");
            let exp = scalar_or_nan(inputs, "exp");
            Value::scalar(base.powf(exp))
        }
        "mod" => binary(inputs, |a, b| a % b),
        "clamp" => {
            let x = scalar_or_nan(inputs, "val");
            let lo = scalar_or_nan(inputs, "min");
            let hi = scalar_or_nan(inputs, "max");
            Value::scalar(x.max(lo).min(hi))
        }
        "negate" => unary(inputs, |x| -x),
        "abs" => unary(inputs, |x| x.abs()),
        "sqrt" => unary(inputs, |x| x.sqrt()),
        "floor" => unary(inputs, |x| x.floor()),
        "ceil" => unary(inputs, |x| x.ceil()),
        "round" => unary(inputs, |x| x.round()),

        // ── Trig ──────────────────────────────────────────────────
        "sin" => unary(inputs, |x| x.sin()),
        "cos" => unary(inputs, |x| x.cos()),
        "tan" => unary(inputs, |x| x.tan()),
        "asin" => unary(inputs, |x| x.asin()),
        "acos" => unary(inputs, |x| x.acos()),
        "atan" => unary(inputs, |x| x.atan()),
        "atan2" => {
            let y = scalar_or_nan(inputs, "y");
            let x = scalar_or_nan(inputs, "x");
            Value::scalar(y.atan2(x))
        }
        "degToRad" => {
            let d = scalar_or_nan(inputs, "deg");
            Value::scalar(d.to_radians())
        }
        "radToDeg" => {
            let r = scalar_or_nan(inputs, "rad");
            Value::scalar(r.to_degrees())
        }

        // ── Logic ─────────────────────────────────────────────────
        "greater" => binary(inputs, |a, b| if a > b { 1.0 } else { 0.0 }),
        "less" => binary(inputs, |a, b| if a < b { 1.0 } else { 0.0 }),
        "equal" => binary(inputs, |a, b| if (a - b).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
        "max" => binary(inputs, |a, b| a.max(b)),
        "min" => binary(inputs, |a, b| a.min(b)),
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

        // ── Data blocks (0 inputs, read from node data) ────────
        "vectorInput" => {
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

// ── Helpers ───────────────────────────────────────────────────────

fn scalar_or_nan(inputs: &HashMap<String, Value>, port: &str) -> f64 {
    inputs
        .get(port)
        .and_then(|v| v.as_scalar())
        .unwrap_or(f64::NAN)
}

fn unary(inputs: &HashMap<String, Value>, f: impl Fn(f64) -> f64) -> Value {
    let x = scalar_or_nan(inputs, "a");
    Value::scalar(f(x))
}

fn binary(inputs: &HashMap<String, Value>, f: impl Fn(f64, f64) -> f64) -> Value {
    let a = scalar_or_nan(inputs, "a");
    let b = scalar_or_nan(inputs, "b");
    Value::scalar(f(a, b))
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
}
