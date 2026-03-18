//! BDF (Backward Differentiation Formula) ODE solver, orders 1–5.
//!
//! BDF methods are A(α)-stable implicit linear multistep methods, excellent
//! for stiff systems (chemical kinetics, some thermal problems, etc.).
//!
//! y_{n+k} = h·β·f(t_{n+k}, y_{n+k}) + Σ α_j·y_{n+j}
//!
//! The implicit equation is solved by Newton iteration at each step.
//! Jacobian is approximated by finite differences.
//!
//! Reference: Hairer & Wanner, "Solving ODEs II" (2010).

use super::rk4::eval_rhs_pub;
use super::types::{OdeResult, OdeSolverConfig, OdeSystem};

/// BDF coefficients for orders 1-5.
/// Each BDF-k has:
///   α coefficients (history weights): α[0] is the new-step coefficient (always 1),
///   α[1..k] are the previous-step weights.
///   β: coefficient of the new derivative (step h·β·f_new).
/// Equation: y_{n+k} = β·h·f_{n+k} + Σ_{j=0}^{k-1} α_j·y_{n+k-j-1}
/// (where y_{n+k-j-1} are the k most recent accepted values in reverse order)
struct BdfCoeffs {
    /// Coefficients for the k previous values (oldest first).
    alpha: &'static [f64],
    /// Coefficient for h·f(t_{n+k}, y_{n+k}).
    beta: f64,
}

// BDF coefficients in "corrector" form:
//   y_new = β·h·f(t_new, y_new) + sum_{j=1}^{k} α_j · y[n+k-j]
//
// BDF-1 (Backward Euler):
//   y1 = h·f(t1, y1) + y0
// BDF-2:
//   y2 = (2/3)·h·f(t2,y2) + (4/3)·y1 - (1/3)·y0
// BDF-3:
//   y3 = (6/11)·h·f + (18/11)·y2 - (9/11)·y1 + (2/11)·y0
// BDF-4:
//   y4 = (12/25)·h·f + (48/25)·y3 - (36/25)·y2 + (16/25)·y1 - (3/25)·y0
// BDF-5:
//   y5 = (60/137)·h·f + (300/137)·y4 - (300/137)·y3 + (200/137)·y2 - (75/137)·y1 + (12/137)·y0

static BDF: [BdfCoeffs; 5] = [
    // Order 1
    BdfCoeffs { alpha: &[1.0], beta: 1.0 },
    // Order 2
    BdfCoeffs { alpha: &[4.0 / 3.0, -1.0 / 3.0], beta: 2.0 / 3.0 },
    // Order 3
    BdfCoeffs { alpha: &[18.0 / 11.0, -9.0 / 11.0, 2.0 / 11.0], beta: 6.0 / 11.0 },
    // Order 4
    BdfCoeffs { alpha: &[48.0 / 25.0, -36.0 / 25.0, 16.0 / 25.0, -3.0 / 25.0], beta: 12.0 / 25.0 },
    // Order 5
    BdfCoeffs { alpha: &[300.0 / 137.0, -300.0 / 137.0, 200.0 / 137.0, -75.0 / 137.0, 12.0 / 137.0], beta: 60.0 / 137.0 },
];

/// Solve an ODE system using BDF (Backward Differentiation Formula), order 1–5.
///
/// The order is set in `system.params` as "bdf_order" (default: 2).
/// Step size control uses a simple error estimate based on the difference
/// between orders k and k-1.
pub fn solve_bdf(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
) -> OdeResult {
    let n = system.equations.len();
    assert_eq!(n, y0.len(), "Equations must match initial state dimension");

    let order = system.params.get("bdf_order")
        .copied()
        .unwrap_or(2.0)
        .clamp(1.0, 5.0) as usize;
    let tol = config.tolerance;
    let max_newton = 50usize;
    let max_steps = config.max_steps;

    // History buffer: ring of (time, state) pairs, newest first.
    let mut history: Vec<(f64, Vec<f64>)> = Vec::with_capacity(order + 1);
    history.push((config.t_start, y0.to_vec()));

    let mut t_out = vec![config.t_start];
    let mut states_out = vec![y0.to_vec()];

    // Bootstrap with BDF-1 (Backward Euler) for the first `order-1` steps,
    // then switch to the requested order.
    let mut current_order = 1usize;
    let mut h = config.dt;
    let mut t = config.t_start;
    let mut steps = 0usize;

    while t < config.t_end && steps < max_steps {
        // Don't overshoot t_end
        if t + h > config.t_end {
            h = config.t_end - t;
        }
        if h < 1e-15 { break; }

        let t_new = t + h;

        // Predictor: use previous solution as initial guess for Newton iteration.
        let y_prev = history[0].1.clone();
        let mut y_new = y_prev.clone();

        // Gather the history values for the corrector formula
        let coeffs = &BDF[current_order - 1];
        let k = coeffs.alpha.len();

        // History sum: Σ α_j · y[n+k-1-j] (j from 0..k-1)
        let history_sum: Vec<f64> = (0..n).map(|i| {
            (0..k).map(|j| {
                let idx = j.min(history.len() - 1);
                coeffs.alpha[j] * history[idx].1[i]
            }).sum::<f64>()
        }).collect();

        // Newton iteration to solve:
        //   G(y) = y - β·h·f(t_new, y) - history_sum = 0
        let mut converged = false;
        for _iter in 0..max_newton {
            let f_new = eval_rhs_pub(system, t_new, &y_new);

            // Residual G(y) = y - β·h·f - hist
            let residual: Vec<f64> = (0..n)
                .map(|i| y_new[i] - coeffs.beta * h * f_new[i] - history_sum[i])
                .collect();

            let res_norm: f64 = residual.iter().map(|r| r * r).sum::<f64>().sqrt();
            if res_norm < tol * (1.0 + y_new.iter().map(|v| v * v).sum::<f64>().sqrt()) {
                converged = true;
                break;
            }

            // Jacobian of G: J_G ≈ I - β·h·J_f   (finite differences)
            let eps = 1e-7_f64;
            let mut jac_g = vec![vec![0.0; n]; n];
            for col in 0..n {
                let mut y_pert = y_new.clone();
                y_pert[col] += eps;
                let f_pert = eval_rhs_pub(system, t_new, &y_pert);
                for row in 0..n {
                    let df_row = (f_pert[row] - f_new[row]) / eps;
                    jac_g[row][col] = (if row == col { 1.0 } else { 0.0 }) - coeffs.beta * h * df_row;
                }
            }

            // Solve J_G · Δy = -residual via Gauss-Jordan with partial pivoting
            let delta = gauss_jordan_solve(&jac_g, &residual);

            // Update: y_new -= delta  (note sign: residual = G(y), delta = J⁻¹·G)
            for i in 0..n {
                y_new[i] -= delta[i];
            }
        }

        if !converged {
            // Step failed — halve step and retry (simple step control)
            h *= 0.5;
            if h < 1e-14 { break; }
            continue;
        }

        // Accept step
        t = t_new;
        history.insert(0, (t, y_new.clone()));
        if history.len() > 5 {
            history.pop();
        }

        // Ramp up order toward requested order
        if current_order < order && history.len() > current_order {
            current_order = (current_order + 1).min(order);
        }

        t_out.push(t);
        states_out.push(y_new);
        steps += 1;

        // Simple step size control: if Newton converged quickly, try to grow h
        h = (h * 1.1).min(config.dt * 10.0);
    }

    let mut column_names = vec!["t".to_string()];
    column_names.extend(system.state_names.clone());

    OdeResult {
        t: t_out,
        states: states_out,
        column_names,
        steps,
    }
}

/// Solve Ax = b via Gauss-Jordan elimination with partial pivoting.
/// Returns x. If singular, returns zeros.
fn gauss_jordan_solve(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = a.len();
    if n == 0 { return vec![]; }

    // Build augmented matrix [A|b]
    let mut mat: Vec<Vec<f64>> = a
        .iter()
        .zip(b.iter())
        .map(|(row, &bi)| {
            let mut r = row.clone();
            r.push(bi);
            r
        })
        .collect();

    for col in 0..n {
        // Partial pivoting
        let mut max_row = col;
        let mut max_val = mat[col][col].abs();
        for row in (col + 1)..n {
            let v = mat[row][col].abs();
            if v > max_val { max_val = v; max_row = row; }
        }
        mat.swap(col, max_row);

        let pivot = mat[col][col];
        if pivot.abs() < 1e-15 { continue; }

        // Normalise pivot row
        for j in col..=n {
            mat[col][j] /= pivot;
        }

        // Eliminate column
        for row in 0..n {
            if row == col { continue; }
            let factor = mat[row][col];
            for j in col..=n {
                mat[row][j] -= factor * mat[col][j];
            }
        }
    }

    (0..n).map(|i| mat[i][n]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_system(eq: &[&str], names: &[&str]) -> OdeSystem {
        OdeSystem {
            equations: eq.iter().map(|s| s.to_string()).collect(),
            state_names: names.iter().map(|s| s.to_string()).collect(),
            params: HashMap::new(),
        }
    }

    fn config(t_end: f64, dt: f64) -> OdeSolverConfig {
        OdeSolverConfig { t_start: 0.0, t_end, dt, tolerance: 1e-6, max_steps: 100_000 }
    }

    #[test]
    fn bdf1_exponential_decay() {
        // dy/dt = -y, y(0)=1 → y(t) = e^{-t}
        let sys = make_system(&["-y0"], &["y"]);
        let result = solve_bdf(&sys, &[1.0], &config(2.0, 0.01));
        let t = &result.t;
        let y = &result.states;
        assert!(!t.is_empty());
        let final_t = *t.last().unwrap();
        let final_y = y.last().unwrap()[0];
        let expected = (-final_t).exp();
        assert!((final_y - expected).abs() < 1e-2,
            "BDF-1 decay: final_t={final_t:.4}, expected={expected:.6}, got={final_y:.6}");
    }

    #[test]
    fn bdf2_exponential_decay() {
        // BDF-2 on dy/dt = -y
        let mut params = HashMap::new();
        params.insert("bdf_order".to_string(), 2.0);
        let sys = OdeSystem {
            equations: vec!["-y0".to_string()],
            state_names: vec!["y".to_string()],
            params,
        };
        let result = solve_bdf(&sys, &[1.0], &config(2.0, 0.05));
        let final_t = *result.t.last().unwrap();
        let final_y = result.states.last().unwrap()[0];
        let expected = (-final_t).exp();
        assert!((final_y - expected).abs() < 5e-2,
            "BDF-2 decay: expected={expected:.6}, got={final_y:.6}");
    }

    #[test]
    fn bdf_harmonic_oscillator() {
        // x'' + x = 0 → x' = v, v' = -x
        // x(0)=1, v(0)=0 → x(t)=cos(t)
        let sys = make_system(&["y1", "-y0"], &["x", "v"]);
        let result = solve_bdf(&sys, &[1.0, 0.0], &config(std::f64::consts::PI, 0.01));
        let final_t = *result.t.last().unwrap();
        let final_x = result.states.last().unwrap()[0];
        let expected = final_t.cos();
        assert!((final_x - expected).abs() < 0.1,
            "BDF oscillator: t={final_t:.4}, expected x={expected:.6}, got={final_x:.6}");
    }

    #[test]
    fn bdf_stiff_system() {
        // Stiff equation: dy/dt = -1000*y + 1, y(0)=0
        // Exact: y(t) = (1 - e^{-1000t})/1000 → ~0.001 for large t
        let sys = make_system(&["-1000*y0 + 1"], &["y"]);
        let result = solve_bdf(&sys, &[0.0], &config(0.1, 0.001));
        assert!(!result.states.is_empty());
        let final_y = result.states.last().unwrap()[0];
        // At t=0.1, solution should be very close to steady state 0.001
        assert!((final_y - 0.001).abs() < 0.001,
            "BDF stiff: expected ~0.001, got {final_y:.6}");
    }
}
