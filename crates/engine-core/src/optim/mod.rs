//! Optimization module: gradient descent, genetic algorithm, Nelder-Mead,
//! parametric sweep, Monte Carlo simulation, sensitivity analysis, DOE.
//!
//! Each optimizer evaluates a single-variable or multi-variable objective
//! function in-engine. The objective function is represented as a polynomial
//! or expression encoded in the node data, or a simple passthrough of the
//! upstream scalar value for design-variable-driven optimization.

pub mod cmaes;
pub mod curve_fit;
pub mod doe;
pub mod genetic;
pub mod gradient;
pub mod lp;
pub mod montecarlo;
pub mod pareto;
pub mod qp;
pub mod sensitivity;
pub mod simplex;
pub mod sobol_sensitivity;
pub mod sweep;

use crate::types::Value;
use std::collections::HashMap;

/// Extract design variable definitions from node data.
/// Each variable has: name, min, max, initial, step.
#[derive(Debug, Clone)]
pub struct DesignVar {
    pub name: String,
    pub min: f64,
    pub max: f64,
    pub initial: f64,
    pub step: f64,
}

/// Optimization result returned by all optimizers.
#[derive(Debug, Clone)]
pub struct OptimResult {
    /// Optimal variable values (one per design variable).
    pub optimal_values: Vec<f64>,
    /// Objective value at the optimum.
    pub best_objective: f64,
    /// Convergence history: objective value at each iteration.
    pub history: Vec<f64>,
    /// Whether the optimizer converged within tolerance.
    pub converged: bool,
    /// Number of iterations used.
    pub iterations: usize,
}

/// Parse design variables from the "variables" input port.
///
/// Variables come as a Table with columns ["name", "min", "max", "initial", "step"]
/// or as scalar metadata encoded in node data.
pub fn parse_design_vars(
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
) -> Result<Vec<DesignVar>, String> {
    // Try to get variables from the "variables" input (Table format)
    if let Some(Value::Table { columns, rows }) = inputs.get("variables") {
        return parse_vars_from_table(columns, rows);
    }

    // Fallback: single variable from "variable" input (for sweep/single-var optimization)
    if let Some(Value::Table { columns, rows }) = inputs.get("variable") {
        return parse_vars_from_table(columns, rows);
    }

    // Fallback: extract from node data (single variable case)
    let min = data
        .get("min")
        .and_then(|v| v.as_f64())
        .unwrap_or(-10.0);
    let max = data.get("max").and_then(|v| v.as_f64()).unwrap_or(10.0);
    let initial = data
        .get("value")
        .and_then(|v| v.as_f64())
        .unwrap_or((min + max) / 2.0);
    let step = data.get("step").and_then(|v| v.as_f64()).unwrap_or(0.1);
    let name = data
        .get("label")
        .and_then(|v| v.as_str())
        .unwrap_or("x")
        .to_string();

    Ok(vec![DesignVar {
        name,
        min,
        max,
        initial,
        step,
    }])
}

fn parse_vars_from_table(columns: &[String], rows: &[Vec<f64>]) -> Result<Vec<DesignVar>, String> {
    if rows.is_empty() {
        return Err("No design variables provided".into());
    }

    // Columns: min, max, initial, step (all numeric)
    // The "name" column would be in text metadata, but for numeric tables
    // we use generic names x0, x1, ...
    let col_idx = |name: &str| columns.iter().position(|c| c == name);

    let min_idx = col_idx("min").unwrap_or(0);
    let max_idx = col_idx("max").unwrap_or(1);
    let initial_idx = col_idx("initial").unwrap_or(2);
    let step_idx = col_idx("step");

    let mut vars = Vec::with_capacity(rows.len());
    for (i, row) in rows.iter().enumerate() {
        let min = row.get(min_idx).copied().unwrap_or(-10.0);
        let max = row.get(max_idx).copied().unwrap_or(10.0);
        let initial = row.get(initial_idx).copied().unwrap_or((min + max) / 2.0);
        let step = step_idx
            .and_then(|idx| row.get(idx).copied())
            .unwrap_or(0.1);
        vars.push(DesignVar {
            name: format!("x{}", i),
            min,
            max,
            initial,
            step,
        });
    }

    Ok(vars)
}

/// Build a Table Value from an OptimResult for display/downstream consumption.
pub fn result_to_table(result: &OptimResult, vars: &[DesignVar]) -> Value {
    let mut columns = vec!["iteration".to_string(), "objective".to_string()];
    for v in vars {
        columns.push(v.name.clone());
    }

    // Build rows: convergence history
    let mut rows = Vec::with_capacity(result.history.len());
    for (i, &obj) in result.history.iter().enumerate() {
        let mut row = vec![i as f64, obj];
        // For the final iteration, include optimal values
        if i == result.history.len() - 1 {
            for &val in &result.optimal_values {
                row.push(val);
            }
        } else {
            for _ in vars {
                row.push(f64::NAN);
            }
        }
        rows.push(row);
    }

    Value::Table { columns, rows }
}

/// Build a summary Table with the final optimization result.
pub fn result_to_summary(result: &OptimResult, vars: &[DesignVar]) -> Value {
    let mut columns = Vec::with_capacity(vars.len() + 2);
    columns.push("variable".to_string());
    columns.push("optimal_value".to_string());

    let mut rows = Vec::with_capacity(vars.len() + 1);
    for (i, _v) in vars.iter().enumerate() {
        rows.push(vec![i as f64, result.optimal_values.get(i).copied().unwrap_or(f64::NAN)]);
    }
    // Add objective row
    rows.push(vec![vars.len() as f64, result.best_objective]);

    Value::Table { columns, rows }
}

/// Simple objective function evaluator for single-variable optimization.
/// Uses the objective input as the current value and evaluates a quadratic
/// approximation based on design variable perturbation.
///
/// In the real graph, the objective comes from upstream computation.
/// For in-engine optimization, we use a polynomial encoded in node data,
/// or treat the objective input as f(x) for the current x.
pub fn get_objective_fn(
    data: &HashMap<String, serde_json::Value>,
) -> Box<dyn Fn(&[f64]) -> f64> {
    // Check for polynomial coefficients in node data
    if let Some(coeffs) = data.get("coefficients") {
        if let Some(arr) = coeffs.as_array() {
            let c: Vec<f64> = arr.iter().filter_map(|v| v.as_f64()).collect();
            if !c.is_empty() {
                return Box::new(move |x: &[f64]| {
                    let xv = x[0];
                    c.iter()
                        .enumerate()
                        .map(|(i, &ci)| ci * xv.powi(i as i32))
                        .sum()
                });
            }
        }
    }

    // Check for expression string
    if let Some(expr_val) = data.get("expression") {
        if let Some(expr_str) = expr_val.as_str() {
            let expr = expr_str.to_string();
            return Box::new(move |x: &[f64]| {
                // Simple variable substitution for common patterns
                let mut vars = HashMap::new();
                for (i, &val) in x.iter().enumerate() {
                    vars.insert(format!("x{}", i), val);
                    if i == 0 {
                        vars.insert("x".to_string(), val);
                    }
                }
                crate::expr::eval_expr(&expr, &vars).unwrap_or(f64::NAN)
            });
        }
    }

    // Default: Rosenbrock function (for testing/demo)
    // f(x,y) = (1-x)² + 100(y-x²)² — minimum at (1,1)
    Box::new(|x: &[f64]| {
        if x.len() == 1 {
            // Single variable: x² (minimum at 0)
            x[0] * x[0]
        } else {
            // Multi-variable: Rosenbrock
            let mut sum = 0.0;
            for i in 0..x.len() - 1 {
                sum += (1.0 - x[i]).powi(2) + 100.0 * (x[i + 1] - x[i].powi(2)).powi(2);
            }
            sum
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_vars_single() {
        let data: HashMap<String, serde_json::Value> = [
            ("min".into(), serde_json::json!(-5.0)),
            ("max".into(), serde_json::json!(5.0)),
            ("value".into(), serde_json::json!(0.0)),
            ("step".into(), serde_json::json!(0.01)),
        ]
        .into();
        let vars = parse_design_vars(&HashMap::new(), &data).unwrap();
        assert_eq!(vars.len(), 1);
        assert_eq!(vars[0].min, -5.0);
        assert_eq!(vars[0].max, 5.0);
    }

    #[test]
    fn parse_vars_from_table_value() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "variables".to_string(),
            Value::Table {
                columns: vec![
                    "min".into(),
                    "max".into(),
                    "initial".into(),
                    "step".into(),
                ],
                rows: vec![vec![-10.0, 10.0, 0.0, 0.1], vec![-5.0, 5.0, 1.0, 0.05]],
            },
        );
        let vars = parse_design_vars(&inputs, &HashMap::new()).unwrap();
        assert_eq!(vars.len(), 2);
        assert_eq!(vars[0].min, -10.0);
        assert_eq!(vars[1].max, 5.0);
    }

    #[test]
    fn default_objective_fn_single_var() {
        let f = get_objective_fn(&HashMap::new());
        assert!((f(&[0.0]) - 0.0).abs() < 1e-10);
        assert!((f(&[3.0]) - 9.0).abs() < 1e-10);
    }

    #[test]
    fn polynomial_objective_fn() {
        let data: HashMap<String, serde_json::Value> = [(
            "coefficients".into(),
            serde_json::json!([3.0, -4.0, 1.0]), // 3 - 4x + x² = (x-2)² - 1
        )]
        .into();
        let f = get_objective_fn(&data);
        assert!((f(&[2.0]) - -1.0).abs() < 1e-10);
    }
}
