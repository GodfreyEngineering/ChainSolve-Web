//! Parametric sweep — evaluate a function over linearly spaced values.

use super::DesignVar;
use crate::types::Value;

/// Run a parametric sweep: evaluate `f(x)` for `steps` linearly spaced values
/// of a single design variable from `var.min` to `var.max`.
///
/// Returns a Table with columns `["input", "output"]` and `steps` rows.
pub fn parametric_sweep<F>(f: &F, var: &DesignVar, steps: usize) -> Value
where
    F: Fn(&[f64]) -> f64,
{
    let steps = steps.max(2); // at least 2 steps
    let columns = vec!["input".to_string(), "output".to_string()];
    let mut rows = Vec::with_capacity(steps);

    for i in 0..steps {
        let t = i as f64 / (steps - 1) as f64;
        let x = var.min + t * (var.max - var.min);
        let y = f(&[x]);
        rows.push(vec![x, y]);
    }

    Value::Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sweep_sin() {
        let var = DesignVar {
            name: "x".into(),
            min: 0.0,
            max: 10.0,
            initial: 0.0,
            step: 0.1,
        };
        let result = parametric_sweep(&|x: &[f64]| x[0].sin(), &var, 100);
        if let Value::Table { columns, rows } = &result {
            assert_eq!(columns, &["input", "output"]);
            assert_eq!(rows.len(), 100);
            // First row: x=0, sin(0)=0
            assert!((rows[0][0] - 0.0).abs() < 1e-10);
            assert!((rows[0][1] - 0.0).abs() < 1e-10);
            // Last row: x=10
            assert!((rows[99][0] - 10.0).abs() < 1e-10);
            assert!((rows[99][1] - 10.0_f64.sin()).abs() < 1e-10);
        } else {
            panic!("Expected Table value");
        }
    }

    #[test]
    fn sweep_minimum_steps() {
        let var = DesignVar {
            name: "x".into(),
            min: 0.0,
            max: 1.0,
            initial: 0.0,
            step: 0.1,
        };
        let result = parametric_sweep(&|x: &[f64]| x[0], &var, 1);
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 2); // clamped to minimum 2
        } else {
            panic!("Expected Table value");
        }
    }
}
