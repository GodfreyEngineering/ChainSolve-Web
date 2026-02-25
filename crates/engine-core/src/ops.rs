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
        "e" => Value::scalar(std::f64::consts::E),
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
        "power" => binary(inputs, |a, b| a.powf(b)),
        "mod" => binary(inputs, |a, b| a % b),
        "clamp" => {
            let x = scalar_or_nan(inputs, "in");
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
        "atan2" => binary(inputs, |y, x| y.atan2(x)),
        "degToRad" => unary(inputs, |x| x.to_radians()),
        "radToDeg" => unary(inputs, |x| x.to_degrees()),

        // ── Logic ─────────────────────────────────────────────────
        "greater" => binary(inputs, |a, b| if a > b { 1.0 } else { 0.0 }),
        "less" => binary(inputs, |a, b| if a < b { 1.0 } else { 0.0 }),
        "equal" => binary(inputs, |a, b| if (a - b).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
        "max" => binary(inputs, |a, b| a.max(b)),
        "min" => binary(inputs, |a, b| a.min(b)),
        "ifThenElse" => {
            let cond = scalar_or_nan(inputs, "cond");
            let then = scalar_or_nan(inputs, "then");
            let els = scalar_or_nan(inputs, "else");
            Value::scalar(if cond != 0.0 { then } else { els })
        }

        // ── Output (pass-through) ────────────────────────────────
        "display" => {
            inputs
                .get("in")
                .cloned()
                .unwrap_or(Value::scalar(f64::NAN))
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
    let x = scalar_or_nan(inputs, "in");
    Value::scalar(f(x))
}

fn binary(inputs: &HashMap<String, Value>, f: impl Fn(f64, f64) -> f64) -> Value {
    let a = scalar_or_nan(inputs, "a");
    let b = scalar_or_nan(inputs, "b");
    Value::scalar(f(a, b))
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
        let inputs = make_inputs(&[("in", 0.0)]);
        let v = evaluate_node("sin", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.0).abs() < 1e-10);
    }

    #[test]
    fn display_passthrough() {
        let inputs: HashMap<String, Value> =
            [("in".to_string(), Value::scalar(99.0))].into_iter().collect();
        let v = evaluate_node("display", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(99.0));
    }
}
