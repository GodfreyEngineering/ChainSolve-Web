//! Sensitivity analysis — one-at-a-time (OAT) variable perturbation.
//!
//! Varies each input ±10% of its range while holding others at their initial
//! values. Produces a table suitable for tornado chart visualization.

use super::DesignVar;
use crate::types::Value;

/// Run one-at-a-time sensitivity analysis.
///
/// For each variable, evaluates `f` at (initial - delta) and (initial + delta)
/// where delta = 10% of range. Returns a Table with columns:
/// - "variable" (index), "low_value", "high_value", "low_output", "high_output", "sensitivity"
pub fn sensitivity_analysis<F>(f: &F, vars: &[DesignVar]) -> Value
where
    F: Fn(&[f64]) -> f64,
{
    if vars.is_empty() {
        return Value::error("Sensitivity analysis requires at least one variable");
    }

    let baseline: Vec<f64> = vars.iter().map(|v| v.initial).collect();
    let baseline_obj = f(&baseline);

    let columns = vec![
        "variable".to_string(),
        "low_value".to_string(),
        "high_value".to_string(),
        "low_output".to_string(),
        "high_output".to_string(),
        "sensitivity".to_string(),
    ];

    let mut rows = Vec::with_capacity(vars.len());

    for (i, var) in vars.iter().enumerate() {
        let delta = (var.max - var.min) * 0.10;
        let low_val = (var.initial - delta).max(var.min);
        let high_val = (var.initial + delta).min(var.max);

        let mut x_low = baseline.clone();
        x_low[i] = low_val;
        let low_output = f(&x_low);

        let mut x_high = baseline.clone();
        x_high[i] = high_val;
        let high_output = f(&x_high);

        // Sensitivity: normalized change in output per unit change in input
        let input_range = high_val - low_val;
        let output_range = high_output - low_output;
        let sensitivity = if input_range.abs() > 1e-15 {
            (output_range / baseline_obj.abs().max(1e-15)).abs()
        } else {
            0.0
        };

        rows.push(vec![
            i as f64,
            low_val,
            high_val,
            low_output,
            high_output,
            sensitivity,
        ]);
    }

    // Sort by sensitivity descending (for tornado chart ordering)
    rows.sort_by(|a, b| {
        b[5]
            .partial_cmp(&a[5])
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Value::Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sensitivity_linear() {
        // f(x, y) = 2x + y — x has twice the sensitivity of y
        let vars = vec![
            DesignVar { name: "x".into(), min: 0.0, max: 10.0, initial: 5.0, step: 0.1 },
            DesignVar { name: "y".into(), min: 0.0, max: 10.0, initial: 5.0, step: 0.1 },
        ];
        let result = sensitivity_analysis(&|x: &[f64]| 2.0 * x[0] + x[1], &vars);
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 2);
            // First row should be x (higher sensitivity)
            assert!(rows[0][5] > rows[1][5]);
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn sensitivity_five_inputs() {
        let vars: Vec<DesignVar> = (0..5)
            .map(|i| DesignVar {
                name: format!("x{}", i),
                min: 0.0,
                max: 10.0,
                initial: 5.0,
                step: 0.1,
            })
            .collect();
        // f = x0 + 2*x1 + 3*x2 + 4*x3 + 5*x4
        let result = sensitivity_analysis(
            &|x: &[f64]| {
                x.iter()
                    .enumerate()
                    .map(|(i, &v)| (i + 1) as f64 * v)
                    .sum()
            },
            &vars,
        );
        if let Value::Table { rows, .. } = &result {
            assert_eq!(rows.len(), 5);
            // Should be sorted by sensitivity descending
            for i in 0..4 {
                assert!(rows[i][5] >= rows[i + 1][5]);
            }
        } else {
            panic!("Expected Table");
        }
    }
}
