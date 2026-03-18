//! Radau IIA implicit Runge-Kutta solver, order 5 (3-stage).
//!
//! Radau IIA is L-stable and highly effective for very stiff problems with
//! discontinuities. The 3-stage method achieves order 5 and damps spurious
//! oscillations at infinity.
//!
//! The stage equations are solved simultaneously using Newton iteration on
//! the block system with a finite-difference Jacobian.
//!
//! Reference: Hairer & Wanner, "Solving ODEs II" (2010), Chapter IV.

use super::rk4::eval_rhs_pub;
use super::types::{OdeResult, OdeSolverConfig, OdeSystem};

// ── Radau IIA (3-stage, order 5) Butcher tableau ────────────────────────────
// c = [(4-√6)/10, (4+√6)/10, 1]
// The A matrix (3×3) of Radau IIA is derived from the collocation conditions.
// We use the well-known numerical values.

const S6: f64 = 2.449_489_742_783_178; // √6

const C1: f64 = (4.0 - S6) / 10.0;
const C2: f64 = (4.0 + S6) / 10.0;
const C3: f64 = 1.0;

// A-matrix rows (Radau IIA order 5, 3 stages)
const A11: f64 = (88.0 - 7.0 * S6) / 360.0;
const A12: f64 = (296.0 - 169.0 * S6) / 1800.0;
const A13: f64 = (-2.0 + 3.0 * S6) / 225.0;

const A21: f64 = (296.0 + 169.0 * S6) / 1800.0;
const A22: f64 = (88.0 + 7.0 * S6) / 360.0;
const A23: f64 = (-2.0 - 3.0 * S6) / 225.0;

const A31: f64 = (16.0 - S6) / 36.0;
const A32: f64 = (16.0 + S6) / 36.0;
const A33: f64 = 1.0 / 9.0;

// Output weights (b_i = a_{3,i} for Radau since c_3 = 1)
const B1: f64 = A31;
const B2: f64 = A32;
const B3: f64 = A33;

/// Solve an ODE system using the 3-stage Radau IIA implicit Runge-Kutta method (order 5).
///
/// Excellent for stiff and very stiff problems. The stage equations form a
/// 3n×3n block system solved by Newton iteration per step.
pub fn solve_radau(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
) -> OdeResult {
    let n = system.equations.len();
    assert_eq!(n, y0.len(), "Equations must match initial state dimension");

    let tol = config.tolerance;
    let max_newton = 50usize;
    let max_steps = config.max_steps;

    let mut t = config.t_start;
    let mut y = y0.to_vec();
    let mut h = config.dt;

    let mut t_out = vec![t];
    let mut states_out = vec![y.clone()];
    let mut steps = 0usize;

    while t < config.t_end && steps < max_steps {
        if t + h > config.t_end {
            h = config.t_end - t;
        }
        if h < 1e-15 { break; }

        // Stage times
        let t1 = t + C1 * h;
        let t2 = t + C2 * h;
        let t3 = t + C3 * h;

        // Initial guess for stage values K1, K2, K3 (derivatives at each stage)
        // Use explicit Euler: Ki ≈ f(t, y)
        let f0 = eval_rhs_pub(system, t, &y);
        let mut k1 = f0.clone();
        let mut k2 = f0.clone();
        let mut k3 = f0.clone();

        // Newton iteration on the 3n × 3n stage system:
        // G_i(K) = K_i - f(t_i, y + h·Σ_j a_{ij}·K_j) = 0  for i=1,2,3
        let mut converged = false;
        for _iter in 0..max_newton {
            // Compute stage values Y1, Y2, Y3
            let y1: Vec<f64> = (0..n).map(|i| y[i] + h * (A11 * k1[i] + A12 * k2[i] + A13 * k3[i])).collect();
            let y2: Vec<f64> = (0..n).map(|i| y[i] + h * (A21 * k1[i] + A22 * k2[i] + A23 * k3[i])).collect();
            let y3: Vec<f64> = (0..n).map(|i| y[i] + h * (A31 * k1[i] + A32 * k2[i] + A33 * k3[i])).collect();

            // Evaluate f at stage points
            let f1 = eval_rhs_pub(system, t1, &y1);
            let f2 = eval_rhs_pub(system, t2, &y2);
            let f3 = eval_rhs_pub(system, t3, &y3);

            // Residuals G_i = K_i - f_i
            let r1: Vec<f64> = (0..n).map(|i| k1[i] - f1[i]).collect();
            let r2: Vec<f64> = (0..n).map(|i| k2[i] - f2[i]).collect();
            let r3: Vec<f64> = (0..n).map(|i| k3[i] - f3[i]).collect();

            let res_norm = r1.iter().chain(r2.iter()).chain(r3.iter())
                .map(|r| r * r).sum::<f64>().sqrt();

            let y_norm = 1.0 + y.iter().map(|v| v * v).sum::<f64>().sqrt();
            if res_norm < tol * y_norm {
                converged = true;
                break;
            }

            // Build block-diagonal Jacobian approximation (neglect off-diagonal stage couplings)
            // Full system Jacobian via finite differences for each stage
            let eps = 1e-7_f64;

            // We use a simplified approach: decouple stages and solve each 3n×3n system
            // as three n×n systems per Newton step (block-diagonal approximation).
            // Each block: ∂G_i/∂K_j = δ_{ij}I - h·a_{ij}·J_f(t_i, Y_i)

            // Compute J_f at each stage (n×n matrices)
            let jf1 = finite_diff_jacobian(system, t1, &y1, &f1, eps, n);
            let jf2 = finite_diff_jacobian(system, t2, &y2, &f2, eps, n);
            let jf3 = finite_diff_jacobian(system, t3, &y3, &f3, eps, n);

            // For the decoupled Newton step, use diagonal approximation:
            // ΔK_1 ≈ (I - h·A11·J1)⁻¹ · R1  (ignoring off-diagonal stage coupling)
            // This is a first-order approximation but effective in practice.
            let dk1 = solve_with_jacobian(&jf1, &r1, h * A11, n);
            let dk2 = solve_with_jacobian(&jf2, &r2, h * A22, n);
            let dk3 = solve_with_jacobian(&jf3, &r3, h * A33, n);

            for i in 0..n {
                k1[i] -= dk1[i];
                k2[i] -= dk2[i];
                k3[i] -= dk3[i];
            }
        }

        if !converged {
            // Reduce step size
            h *= 0.5;
            if h < 1e-14 { break; }
            continue;
        }

        // Advance solution using the last stage value (y3 ≈ y(t+h) since c3=1)
        let y_new: Vec<f64> = (0..n)
            .map(|i| y[i] + h * (B1 * k1[i] + B2 * k2[i] + B3 * k3[i]))
            .collect();

        t += h;
        y = y_new.clone();

        t_out.push(t);
        states_out.push(y_new);
        steps += 1;

        // Mild step size growth
        h = (h * 1.05).min(config.dt * 5.0);
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

/// Compute the n×n finite-difference Jacobian of f at (t, y).
fn finite_diff_jacobian(
    system: &OdeSystem,
    t: f64,
    y: &[f64],
    f0: &[f64],
    eps: f64,
    n: usize,
) -> Vec<Vec<f64>> {
    let mut jac = vec![vec![0.0; n]; n];
    for col in 0..n {
        let mut y_pert = y.to_vec();
        y_pert[col] += eps;
        let f_pert = eval_rhs_pub(system, t, &y_pert);
        for row in 0..n {
            jac[row][col] = (f_pert[row] - f0[row]) / eps;
        }
    }
    jac
}

/// Solve (I - scale·Jf)·x = rhs via Gauss-Jordan.
fn solve_with_jacobian(jf: &[Vec<f64>], rhs: &[f64], scale: f64, n: usize) -> Vec<f64> {
    // Build A = I - scale·Jf
    let mut a: Vec<Vec<f64>> = (0..n)
        .map(|row| {
            (0..n)
                .map(|col| {
                    let eye = if row == col { 1.0 } else { 0.0 };
                    eye - scale * jf[row][col]
                })
                .collect()
        })
        .collect();

    // Augment with rhs
    for (row, r) in rhs.iter().enumerate() {
        a[row].push(*r);
    }

    // Gauss-Jordan
    for col in 0..n {
        let mut max_row = col;
        let mut max_val = a[col][col].abs();
        for row in (col + 1)..n {
            if a[row][col].abs() > max_val {
                max_val = a[row][col].abs();
                max_row = row;
            }
        }
        a.swap(col, max_row);

        let pivot = a[col][col];
        if pivot.abs() < 1e-15 { continue; }

        for j in col..=n {
            a[col][j] /= pivot;
        }

        for row in 0..n {
            if row == col { continue; }
            let factor = a[row][col];
            for j in col..=n {
                a[row][j] -= factor * a[col][j];
            }
        }
    }

    (0..n).map(|i| a[i][n]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sys_decay() -> (OdeSystem, Vec<f64>) {
        let sys = OdeSystem {
            equations: vec!["-y0".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        (sys, vec![1.0])
    }

    fn cfg(t_end: f64, dt: f64) -> OdeSolverConfig {
        OdeSolverConfig { t_start: 0.0, t_end, dt, tolerance: 1e-6, max_steps: 50_000 }
    }

    #[test]
    fn radau_exponential_decay() {
        let (sys, y0) = sys_decay();
        let res = solve_radau(&sys, &y0, &cfg(2.0, 0.1));
        let final_t = *res.t.last().unwrap();
        let final_y = res.states.last().unwrap()[0];
        let expected = (-final_t).exp();
        assert!((final_y - expected).abs() < 1e-3,
            "Radau decay: expected={expected:.6}, got={final_y:.6}");
    }

    #[test]
    fn radau_harmonic_oscillator() {
        let sys = OdeSystem {
            equations: vec!["y1".to_string(), "-y0".to_string()],
            state_names: vec!["x".to_string(), "v".to_string()],
            params: HashMap::new(),
        };
        let res = solve_radau(&sys, &[1.0, 0.0], &cfg(std::f64::consts::PI, 0.05));
        let final_t = *res.t.last().unwrap();
        let final_x = res.states.last().unwrap()[0];
        let expected = final_t.cos();
        assert!((final_x - expected).abs() < 0.1,
            "Radau oscillator: t={final_t:.4}, expected={expected:.6}, got={final_x:.6}");
    }

    #[test]
    fn radau_stiff() {
        // dy/dt = -100*y + 100, y(0) = 0
        // Exact: y(t) = 1 - e^{-100t} → 1 for large t
        let sys = OdeSystem {
            equations: vec!["-100*y0 + 100".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let res = solve_radau(&sys, &[0.0], &cfg(0.1, 0.01));
        let final_y = res.states.last().unwrap()[0];
        assert!((final_y - 1.0).abs() < 0.01,
            "Radau stiff: expected ~1.0, got {final_y:.6}");
    }
}
