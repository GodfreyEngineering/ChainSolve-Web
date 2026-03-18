//! Trust-region dogleg optimizer (item 2.111).
//!
//! Implements the dogleg trust-region method (Powell 1970) for unconstrained
//! minimization with bound constraints enforced by projection.
//!
//! ## Algorithm
//!
//! At each iteration:
//! 1. Compute gradient g = ∇f(x) via central differences.
//! 2. Compute Hessian H = ∇²f(x) via finite differences of gradient.
//! 3. Solve the trust-region sub-problem via the dogleg path.
//! 4. Compute actual/predicted ratio ρ. Accept/reject step.
//! 5. Update trust-radius Δ based on ρ.
//!
//! ## Dogleg path
//!
//! * Cauchy (steepest descent) step: p_SD = -(gᵀg / gᵀHg) · g
//! * Full Newton step:              p_N  = −H⁻¹ g  (via Gauss-Jordan)
//! * If ‖p_N‖ ≤ Δ  → take p_N.
//! * If ‖p_SD‖ ≥ Δ → take (Δ / ‖p_SD‖) · p_SD.
//! * Otherwise interpolate: p = p_SD + τ(p_N − p_SD) where ‖p‖ = Δ.

use super::{DesignVar, OptimResult};

/// Run trust-region dogleg minimization.
///
/// `f`        — objective (lower is better).
/// `vars`     — design variables with bounds and initial values.
/// `max_iter` — iteration limit.
/// `tol`      — convergence tolerance on gradient norm.
pub fn trust_region_dogleg<F>(
    f: &F,
    vars: &[DesignVar],
    max_iter: usize,
    tol: f64,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    if n == 0 {
        return OptimResult {
            optimal_values: vec![],
            best_objective: f64::NAN,
            history: vec![],
            converged: false,
            iterations: 0,
        };
    }

    let lo: Vec<f64> = vars.iter().map(|v| v.min).collect();
    let hi: Vec<f64> = vars.iter().map(|v| v.max).collect();

    // Initial point (projected to bounds)
    let mut x: Vec<f64> = vars
        .iter()
        .map(|v| v.initial.clamp(v.min, v.max))
        .collect();

    let mut fx = f(&x);
    let mut delta = {
        // Initial trust radius: 10% of the average range
        let avg_range: f64 = vars.iter().map(|v| (v.max - v.min).abs()).sum::<f64>() / n as f64;
        (avg_range * 0.1).max(1.0)
    };

    let mut history = vec![fx];
    let delta_max = delta * 100.0;

    for _iter in 0..max_iter {
        // ── 1. Numerical gradient (central differences) ──────────────────
        let h_g = 1e-6;
        let mut g = vec![0.0_f64; n];
        for i in 0..n {
            let mut xp = x.clone();
            let mut xm = x.clone();
            let hi_step = h_g * x[i].abs().max(1.0);
            xp[i] += hi_step;
            xm[i] -= hi_step;
            g[i] = (f(&xp) - f(&xm)) / (2.0 * hi_step);
        }

        // Convergence check on gradient norm
        let g_norm: f64 = g.iter().map(|&gi| gi * gi).sum::<f64>().sqrt();
        if g_norm < tol {
            let iters = history.len() - 1;
            return OptimResult {
                optimal_values: x.clone(),
                best_objective: fx,
                converged: true,
                iterations: iters,
                history,
            };
        }

        // ── 2. Numerical Hessian (finite differences of gradient) ────────
        let h_h = 1e-5;
        let mut hess = vec![vec![0.0_f64; n]; n];
        for j in 0..n {
            let mut xp = x.clone();
            let mut xm = x.clone();
            let step = h_h * x[j].abs().max(1.0);
            xp[j] += step;
            xm[j] -= step;

            // Gradient at xp
            let mut gp = vec![0.0_f64; n];
            for i in 0..n {
                let mut xpp = xp.clone();
                let mut xpm = xp.clone();
                let hi_step = h_g * xp[i].abs().max(1.0);
                xpp[i] += hi_step;
                xpm[i] -= hi_step;
                gp[i] = (f(&xpp) - f(&xpm)) / (2.0 * hi_step);
            }
            // Gradient at xm
            let mut gm = vec![0.0_f64; n];
            for i in 0..n {
                let mut xmp = xm.clone();
                let mut xmm = xm.clone();
                let hi_step = h_g * xm[i].abs().max(1.0);
                xmp[i] += hi_step;
                xmm[i] -= hi_step;
                gm[i] = (f(&xmp) - f(&xmm)) / (2.0 * hi_step);
            }
            for i in 0..n {
                hess[i][j] = (gp[i] - gm[i]) / (2.0 * step);
            }
        }
        // Symmetrise
        for i in 0..n {
            for j in 0..n {
                let avg = (hess[i][j] + hess[j][i]) / 2.0;
                hess[i][j] = avg;
                hess[j][i] = avg;
            }
        }
        // Add small regularization for numerical stability
        for i in 0..n {
            hess[i][i] += 1e-8;
        }

        // ── 3. Dogleg step ────────────────────────────────────────────────
        // gᵀHg
        let gt_hg: f64 = (0..n)
            .map(|i| g[i] * (0..n).map(|j| hess[i][j] * g[j]).sum::<f64>())
            .sum();

        // Cauchy step magnitude and direction
        let g_sq: f64 = g.iter().map(|&gi| gi * gi).sum();
        let tau_sd = if gt_hg > 1e-15 { g_sq / gt_hg } else { delta / g_norm.max(1e-15) };
        let p_sd: Vec<f64> = g.iter().map(|&gi| -tau_sd * gi).collect();
        let p_sd_norm: f64 = p_sd.iter().map(|&pi| pi * pi).sum::<f64>().sqrt();

        // Full Newton step p_N = -H⁻¹ g via Gauss-Jordan
        let p_n_opt = solve_gauss_jordan(&hess, &g.iter().map(|&gi| -gi).collect::<Vec<_>>());
        let p_n_norm: f64 = p_n_opt
            .iter()
            .map(|&pi| pi * pi)
            .sum::<f64>()
            .sqrt();

        let step: Vec<f64> = if p_n_norm <= delta && !p_n_opt.iter().any(|v| v.is_nan()) {
            // Full Newton step fits inside trust region
            p_n_opt
        } else if p_sd_norm >= delta {
            // Cauchy step already exceeds trust radius — truncate
            let scale = delta / p_sd_norm.max(1e-15);
            p_sd.iter().map(|&pi| scale * pi).collect()
        } else {
            // Dogleg: interpolate between p_SD and p_N
            // ‖p_SD + τ(p_N - p_SD)‖² = Δ²  → solve for τ ∈ [0,1]
            let p_n = if p_n_opt.iter().any(|v| v.is_nan()) {
                // Fallback if Newton step failed: steepest descent beyond Cauchy
                let scale = delta / p_sd_norm.max(1e-15);
                p_sd.iter().map(|&pi| scale * pi).collect::<Vec<_>>()
            } else {
                p_n_opt
            };

            let diff: Vec<f64> = (0..n).map(|i| p_n[i] - p_sd[i]).collect();
            let a: f64 = diff.iter().map(|&di| di * di).sum();
            let b: f64 = 2.0 * (0..n).map(|i| p_sd[i] * diff[i]).sum::<f64>();
            let c = p_sd_norm * p_sd_norm - delta * delta;

            let tau = if a.abs() < 1e-15 {
                1.0
            } else {
                let disc = (b * b - 4.0 * a * c).max(0.0);
                let t = (-b + disc.sqrt()) / (2.0 * a);
                t.clamp(0.0, 1.0)
            };

            (0..n).map(|i| p_sd[i] + tau * diff[i]).collect()
        };

        // ── 4. Project step to bounds and compute x_new ───────────────────
        let x_new: Vec<f64> = (0..n)
            .map(|i| (x[i] + step[i]).clamp(lo[i], hi[i]))
            .collect();
        let fx_new = f(&x_new);

        // Actual reduction
        let actual = fx - fx_new;

        // Predicted reduction: m(0) - m(p) = -gᵀp - 0.5 pᵀHp
        let pred: f64 = {
            let gtp: f64 = (0..n).map(|i| g[i] * step[i]).sum();
            let pt_hp: f64 = (0..n)
                .map(|i| step[i] * (0..n).map(|j| hess[i][j] * step[j]).sum::<f64>())
                .sum();
            -gtp - 0.5 * pt_hp
        };

        let rho = if pred.abs() < 1e-15 { 1.0 } else { actual / pred };

        // ── 5. Update x and Δ ─────────────────────────────────────────────
        if rho > 0.1 {
            x = x_new;
            fx = fx_new;
        }

        delta = if rho < 0.25 {
            0.25 * delta
        } else if rho > 0.75 {
            (2.0 * delta).min(delta_max)
        } else {
            delta
        };

        history.push(fx);

        // Stagnation check
        if delta < tol * 1e-3 {
            break;
        }
    }

    OptimResult {
        best_objective: fx,
        optimal_values: x,
        converged: history.len() < max_iter,
        iterations: history.len() - 1,
        history,
    }
}

/// Solve Ax = b via Gauss-Jordan with partial pivoting. Returns x.
fn solve_gauss_jordan(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    if n == 0 {
        return vec![];
    }

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
        // Partial pivot
        let pivot_row = (col..n).max_by(|&i, &j| {
            aug[i][col]
                .abs()
                .partial_cmp(&aug[j][col].abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        let pivot_row = match pivot_row {
            Some(r) => r,
            None => return vec![f64::NAN; n],
        };
        aug.swap(col, pivot_row);

        let pivot = aug[col][col];
        if pivot.abs() < 1e-14 {
            return vec![f64::NAN; n];
        }

        let inv = 1.0 / pivot;
        for k in 0..=n {
            aug[col][k] *= inv;
        }

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
    use crate::optim::DesignVar;

    fn make_var(name: &str, min: f64, max: f64, init: f64) -> DesignVar {
        DesignVar { name: name.into(), min, max, initial: init, step: 0.01 }
    }

    /// Sphere function — minimum at origin with value 0.
    #[test]
    fn sphere_converges() {
        let vars = vec![make_var("x0", -5.0, 5.0, 2.0), make_var("x1", -5.0, 5.0, -3.0)];
        let f = |x: &[f64]| x.iter().map(|&xi| xi * xi).sum::<f64>();
        let result = trust_region_dogleg(&f, &vars, 500, 1e-6);
        assert!(result.best_objective < 1e-6, "f* = {}", result.best_objective);
        assert!(result.converged, "did not converge");
    }

    /// Rosenbrock — minimum at (1,1), f* = 0.
    #[test]
    fn rosenbrock_converges() {
        let vars = vec![make_var("x", -2.0, 2.0, -1.0), make_var("y", -1.0, 3.0, 1.5)];
        let f = |x: &[f64]| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2);
        let result = trust_region_dogleg(&f, &vars, 2000, 1e-6);
        assert!(result.best_objective < 1e-4, "f* = {}", result.best_objective);
    }

    /// Bounded: f = (x-3)² on [-1, 2] → x* = 2, f* = 1.
    #[test]
    fn bounded_minimum() {
        let vars = vec![make_var("x", -1.0, 2.0, 0.0)];
        let f = |x: &[f64]| (x[0] - 3.0).powi(2);
        let result = trust_region_dogleg(&f, &vars, 200, 1e-8);
        assert!((result.optimal_values[0] - 2.0).abs() < 1e-6, "x* = {}", result.optimal_values[0]);
        assert!((result.best_objective - 1.0).abs() < 1e-6, "f* = {}", result.best_objective);
    }
}
