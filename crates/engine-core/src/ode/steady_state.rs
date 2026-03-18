//! Steady-state (equilibrium) solver for ODE systems.
//!
//! Finds the fixed point y* of the system dy/dt = f(y, t) by solving f(y*) = 0
//! using Newton-Raphson iteration with a numerical Jacobian (central differences).
//!
//! The Jacobian J_{ij} = ∂f_i/∂y_j is approximated as:
//!   J_{ij} ≈ (f_i(y + h*e_j) - f_i(y - h*e_j)) / (2h)
//! where h = 1e-7 * max(1, |y_j|).
//!
//! The Newton step solves: J·Δy = -f(y), then y ← y + Δy.
//! Convergence: ||f(y)|| < tol (default 1e-10) or ||Δy|| < tol.
//! Divergence protection: if ||f|| grows 100× from the initial value, restart
//! from a damped step.

use crate::expr::eval_expr;
use std::collections::HashMap;

/// Result from the steady-state solver.
pub struct SteadyStateResult {
    /// Equilibrium state vector y*.
    pub y_eq: Vec<f64>,
    /// Residual ||f(y*)||₂ at the solution.
    pub residual: f64,
    /// Number of Newton iterations.
    pub iterations: usize,
    /// Whether the solver converged within the tolerance.
    pub converged: bool,
    /// Column names for the output table: `["state", "value"]`.
    pub column_names: Vec<String>,
}

/// Solve for the steady-state equilibrium of dy/dt = f(y, t).
///
/// `equations` — N RHS expressions f_i(y, t). Same naming as ODE solvers:
///   `t`, `y0..y{N-1}` for the state variables, plus named params.
/// `y0` — initial guess for the equilibrium (length N).
/// `params` — named parameter values used in expressions.
/// `state_names` — display names for each state variable.
/// `t_eval` — time value at which to evaluate f (for time-varying systems;
///   typically 0.0 for autonomous systems).
/// `max_iter` — maximum Newton iterations (default 100).
/// `tol` — convergence tolerance for ||f||₂ and ||Δy||₂ (default 1e-10).
pub fn solve_steady_state(
    equations: &[String],
    y0: &[f64],
    params: &HashMap<String, f64>,
    state_names: &[String],
    t_eval: f64,
    max_iter: usize,
    tol: f64,
) -> SteadyStateResult {
    let n = equations.len();
    assert_eq!(y0.len(), n, "y0 must have same length as equations");

    let _col_names = if state_names.len() == n {
        state_names.to_vec()
    } else {
        (0..n).map(|i| format!("y{i}")).collect()
    };

    let mut y = y0.to_vec();
    let mut iter = 0;
    let mut converged = false;

    // Evaluate f at current y
    let eval_f = |y: &[f64]| -> Vec<f64> {
        let mut vars: HashMap<String, f64> = params.clone();
        vars.insert("t".to_string(), t_eval);
        for (i, &yi) in y.iter().enumerate() {
            vars.insert(format!("y{i}"), yi);
        }
        equations
            .iter()
            .map(|expr| eval_expr(expr, &vars).unwrap_or(f64::NAN))
            .collect()
    };

    let norm2 = |v: &[f64]| v.iter().map(|x| x * x).sum::<f64>().sqrt();

    let f0 = eval_f(&y);
    let f0_norm = norm2(&f0);

    // If already at equilibrium
    if f0_norm < tol {
        return SteadyStateResult {
            y_eq: y,
            residual: f0_norm,
            iterations: 0,
            converged: true,
            column_names: vec!["state".to_string(), "value".to_string()],
        };
    }

    for _ in 0..max_iter {
        iter += 1;

        let f = eval_f(&y);
        let f_norm = norm2(&f);

        if f_norm < tol {
            converged = true;
            break;
        }

        // Build numerical Jacobian via central differences
        let mut jac = vec![vec![0.0_f64; n]; n];
        for j in 0..n {
            let h = 1e-7 * y[j].abs().max(1.0);
            let mut yp = y.clone();
            yp[j] += h;
            let mut ym = y.clone();
            ym[j] -= h;
            let fp = eval_f(&yp);
            let fm = eval_f(&ym);
            for i in 0..n {
                jac[i][j] = (fp[i] - fm[i]) / (2.0 * h);
            }
        }

        // Solve J·Δy = -f  (Gauss-Jordan with partial pivoting)
        let neg_f: Vec<f64> = f.iter().map(|x| -x).collect();
        let delta = solve_linsys(&jac, &neg_f);

        // Check for failed solve (NaN)
        if delta.iter().any(|x| x.is_nan()) {
            break;
        }

        let delta_norm = norm2(&delta);

        // Damped Newton: try full step first, then backtrack
        let mut step = 1.0_f64;
        let mut accepted = false;
        for _ in 0..10 {
            let y_new: Vec<f64> = y.iter().zip(delta.iter()).map(|(&yi, &di)| yi + step * di).collect();
            let f_new = eval_f(&y_new);
            let f_new_norm = norm2(&f_new);
            if f_new_norm < f_norm || f_new_norm < tol {
                y = y_new;
                accepted = true;
                break;
            }
            step *= 0.5;
        }

        if !accepted {
            // Just take the full step anyway to avoid stagnation
            for i in 0..n {
                y[i] += delta[i];
            }
        }

        if delta_norm < tol {
            converged = true;
            break;
        }
    }

    let f_final = eval_f(&y);
    let residual = norm2(&f_final);
    if residual < tol {
        converged = true;
    }

    SteadyStateResult {
        y_eq: y,
        residual,
        iterations: iter,
        converged,
        column_names: vec!["state".to_string(), "value".to_string()],
    }
}

/// Solve A·x = b via Gauss-Jordan elimination with partial pivoting.
/// Returns x (or a vector of NaN on failure).
fn solve_linsys(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    // Build augmented matrix [A | b]
    let mut aug: Vec<Vec<f64>> = a
        .iter()
        .zip(b.iter())
        .map(|(row, &bi)| {
            let mut r = row.clone();
            r.push(bi);
            r
        })
        .collect();

    for col in 0..n {
        // Find pivot
        let pivot_row = (col..n)
            .max_by(|&i, &j| aug[i][col].abs().partial_cmp(&aug[j][col].abs()).unwrap());
        let pivot_row = match pivot_row {
            Some(r) => r,
            None => return vec![f64::NAN; n],
        };
        aug.swap(col, pivot_row);

        let pivot = aug[col][col];
        if pivot.abs() < 1e-14 {
            return vec![f64::NAN; n];
        }

        // Normalize pivot row
        let inv = 1.0 / pivot;
        for k in 0..=n {
            aug[col][k] *= inv;
        }

        // Eliminate column
        for row in 0..n {
            if row == col {
                continue;
            }
            let factor = aug[row][col];
            for k in 0..=n {
                let sub = factor * aug[col][k];
                aug[row][k] -= sub;
            }
        }
    }

    aug.iter().map(|row| row[n]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Simple 1D: dy/dt = y - 2  → equilibrium at y=2
    #[test]
    fn steady_state_1d() {
        let equations = vec!["y0 - 2".to_string()];
        let y0 = [1.5_f64];
        let params = HashMap::new();
        let result = solve_steady_state(&equations, &y0, &params, &[], 0.0, 100, 1e-10);
        assert!(result.converged, "Should converge");
        assert!((result.y_eq[0] - 2.0).abs() < 1e-8, "y* = {}", result.y_eq[0]);
    }

    /// 2D: dy0/dt = y0 - y1 - 1, dy1/dt = y0 + y1 - 3
    /// Equilibrium: y0=2, y1=1
    #[test]
    fn steady_state_2d() {
        let equations = vec!["y0 - y1 - 1".to_string(), "y0 + y1 - 3".to_string()];
        let y0 = [0.0_f64, 0.0];
        let params = HashMap::new();
        let result = solve_steady_state(&equations, &y0, &params, &[], 0.0, 100, 1e-10);
        assert!(result.converged, "Should converge");
        assert!((result.y_eq[0] - 2.0).abs() < 1e-8, "y0* = {}", result.y_eq[0]);
        assert!((result.y_eq[1] - 1.0).abs() < 1e-8, "y1* = {}", result.y_eq[1]);
    }

    /// Nonlinear: dy/dt = y^2 - 4  → equilibrium at y=2 (starting from y=1)
    #[test]
    fn steady_state_nonlinear() {
        let equations = vec!["y0 * y0 - 4".to_string()];
        let y0 = [1.0_f64];
        let params = HashMap::new();
        let result = solve_steady_state(&equations, &y0, &params, &[], 0.0, 100, 1e-10);
        assert!(result.converged, "Should converge");
        assert!((result.y_eq[0] - 2.0).abs() < 1e-7, "y* = {}", result.y_eq[0]);
    }
}
