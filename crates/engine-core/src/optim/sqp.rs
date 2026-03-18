//! Sequential Quadratic Programming via Augmented Lagrangian (item 2.110).
//!
//! Handles equality constraints `h(x) = 0` and inequality constraints
//! `g(x) ≤ 0`, plus variable bounds from [`DesignVar`].
//!
//! ## Method
//!
//! Uses the Augmented Lagrangian (multiplier) method (Hestenes 1969 / Powell 1969):
//!
//! ```text
//! L_A(x, λ, μ, ρ) = f(x)
//!     + Σᵢ μᵢ·hᵢ(x) + (ρ/2) Σᵢ hᵢ(x)²          ← equality terms
//!     + (ρ/2) Σⱼ max(0, gⱼ(x) + λⱼ/ρ)²            ← inequality terms
//! ```
//!
//! The inner loop minimizes L_A with respect to x (respecting bounds) using
//! projected gradient descent with Armijo backtracking.
//! The outer loop updates multipliers and increases the penalty ρ.
//!
//! ## Constraint specification
//!
//! Constraints are closures `Box<dyn Fn(&[f64]) -> f64>`:
//! - Equality: `h(x) = 0`
//! - Inequality: `g(x) ≤ 0`
//!
//! ## Output
//!
//! Returns [`SqpResult`] containing the primal solution, objective, constraint
//! residuals, and convergence history.

use super::{DesignVar, OptimResult};

/// Run SQP (augmented Lagrangian) minimization.
///
/// `f`           — objective function (minimise).
/// `vars`        — design variables with bounds + initial values.
/// `eq_constraints`   — equality constraints hᵢ(x) = 0.
/// `ineq_constraints` — inequality constraints gⱼ(x) ≤ 0.
/// `max_outer`   — outer (multiplier update) iteration limit.
/// `tol`         — convergence tolerance (constraint + gradient norms).
pub fn augmented_lagrangian<F, G, H>(
    f: &F,
    vars: &[DesignVar],
    eq_constraints: &[G],
    ineq_constraints: &[H],
    max_outer: usize,
    tol: f64,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
    G: Fn(&[f64]) -> f64,
    H: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    let n_eq = eq_constraints.len();
    let n_ineq = ineq_constraints.len();

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

    // Lagrange multipliers
    let mut mu = vec![0.0_f64; n_eq];    // equality multipliers
    let mut lam = vec![0.0_f64; n_ineq]; // inequality multipliers (≥ 0)

    let mut rho = 10.0_f64; // penalty parameter
    let mut history = vec![f(&x)];

    for outer in 0..max_outer {
        // ── Inner loop: minimise augmented Lagrangian ─────────────────────
        let inner_max = 200;
        let inner_tol = tol * 0.1;
        let alpha_init = 0.1;

        for _ in 0..inner_max {
            // Gradient of augmented Lagrangian via central differences
            let h_diff = 1e-6;
            let mut grad = vec![0.0_f64; n];
            for i in 0..n {
                let mut xp = x.clone();
                let mut xm = x.clone();
                let step = h_diff * x[i].abs().max(1.0);
                xp[i] += step;
                xm[i] -= step;
                grad[i] = (aug_lag(f, eq_constraints, ineq_constraints, &xp, &mu, &lam, rho)
                    - aug_lag(f, eq_constraints, ineq_constraints, &xm, &mu, &lam, rho))
                    / (2.0 * step);
            }

            // Projected gradient norm
            let pg_norm: f64 = (0..n)
                .map(|i| {
                    let pg = if x[i] <= lo[i] + 1e-15 {
                        grad[i].min(0.0)
                    } else if x[i] >= hi[i] - 1e-15 {
                        grad[i].max(0.0)
                    } else {
                        grad[i]
                    };
                    pg * pg
                })
                .sum::<f64>()
                .sqrt();

            if pg_norm < inner_tol {
                break;
            }

            // Armijo backtracking along projected gradient direction
            let la_cur = aug_lag(f, eq_constraints, ineq_constraints, &x, &mu, &lam, rho);
            let mut alpha = alpha_init;
            let c1 = 1e-4;

            for _ in 0..30 {
                let x_trial: Vec<f64> = (0..n)
                    .map(|i| (x[i] - alpha * grad[i]).clamp(lo[i], hi[i]))
                    .collect();
                let la_trial =
                    aug_lag(f, eq_constraints, ineq_constraints, &x_trial, &mu, &lam, rho);
                // Armijo sufficient decrease
                let dir_deriv: f64 = (0..n).map(|i| grad[i] * (x_trial[i] - x[i])).sum();
                if la_trial <= la_cur + c1 * dir_deriv {
                    x = x_trial;
                    break;
                }
                alpha *= 0.5;
            }
        }

        let fx = f(&x);
        history.push(fx);

        // ── Constraint residuals ──────────────────────────────────────────
        let eq_resid: Vec<f64> = eq_constraints.iter().map(|h| h(&x)).collect();
        let ineq_resid: Vec<f64> = ineq_constraints.iter().map(|g| g(&x)).collect();

        let eq_norm: f64 = eq_resid.iter().map(|&r| r * r).sum::<f64>().sqrt();
        let ineq_viol: f64 = ineq_resid.iter().map(|&r| r.max(0.0).powi(2)).sum::<f64>().sqrt();
        let feas = eq_norm + ineq_viol;

        // Check convergence
        if feas < tol && outer > 0 {
            let iters = history.len() - 1;
            return OptimResult {
                optimal_values: x,
                best_objective: fx,
                converged: true,
                iterations: iters,
                history,
            };
        }

        // ── Multiplier updates ────────────────────────────────────────────
        // Equality: μ += ρ · h(x)
        for i in 0..n_eq {
            mu[i] += rho * eq_resid[i];
        }
        // Inequality: λ = max(0, λ + ρ · g(x))
        for j in 0..n_ineq {
            lam[j] = (lam[j] + rho * ineq_resid[j]).max(0.0);
        }

        // Increase penalty
        if feas > 0.5 || outer < 3 {
            rho = (rho * 5.0).min(1e8);
        }
    }

    OptimResult {
        best_objective: f(&x),
        optimal_values: x,
        converged: false,
        iterations: history.len() - 1,
        history,
    }
}

/// Evaluate the augmented Lagrangian at point x.
fn aug_lag<F, G, H>(
    f: &F,
    eq: &[G],
    ineq: &[H],
    x: &[f64],
    mu: &[f64],
    lam: &[f64],
    rho: f64,
) -> f64
where
    F: Fn(&[f64]) -> f64,
    G: Fn(&[f64]) -> f64,
    H: Fn(&[f64]) -> f64,
{
    let mut val = f(x);

    // Equality terms: μᵢ·hᵢ + (ρ/2)·hᵢ²
    for (i, h) in eq.iter().enumerate() {
        let hi = h(x);
        val += mu[i] * hi + 0.5 * rho * hi * hi;
    }

    // Inequality terms: (ρ/2)·max(0, gⱼ + λⱼ/ρ)²
    for (j, g) in ineq.iter().enumerate() {
        let gj = g(x);
        let shifted = gj + lam[j] / rho;
        let clamped = shifted.max(0.0);
        val += 0.5 * rho * clamped * clamped;
    }

    val
}

/// Convenience wrapper: no constraints (reduces to bound-constrained descent).
pub fn sqp_unconstrained<F>(f: &F, vars: &[DesignVar], max_iter: usize, tol: f64) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    augmented_lagrangian(
        f,
        vars,
        &[] as &[fn(&[f64]) -> f64],
        &[] as &[fn(&[f64]) -> f64],
        max_iter,
        tol,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::optim::DesignVar;

    fn var(name: &str, min: f64, max: f64, init: f64) -> DesignVar {
        DesignVar { name: name.into(), min, max, initial: init, step: 0.01 }
    }

    /// Unconstrained sphere: f = x₀² + x₁², min at (0,0).
    #[test]
    fn sphere_unconstrained() {
        let vars = vec![var("x0", -5.0, 5.0, 2.0), var("x1", -5.0, 5.0, -3.0)];
        let f = |x: &[f64]| x.iter().map(|&xi| xi * xi).sum::<f64>();
        let result = augmented_lagrangian(
            &f,
            &vars,
            &[] as &[fn(&[f64]) -> f64],
            &[] as &[fn(&[f64]) -> f64],
            50,
            1e-6,
        );
        assert!(result.best_objective < 1e-4, "f*={}", result.best_objective);
    }

    /// Equality-constrained: minimise x₀² + x₁² s.t. x₀ + x₁ = 1.
    /// Analytical solution: x* = (0.5, 0.5), f* = 0.5.
    #[test]
    fn equality_constrained() {
        let vars = vec![var("x0", -5.0, 5.0, 0.0), var("x1", -5.0, 5.0, 0.0)];
        let f = |x: &[f64]| x[0] * x[0] + x[1] * x[1];
        let h = |x: &[f64]| x[0] + x[1] - 1.0; // h(x) = 0
        let result = augmented_lagrangian(
            &f,
            &vars,
            &[h],
            &[] as &[fn(&[f64]) -> f64],
            100,
            1e-5,
        );
        assert!((result.best_objective - 0.5).abs() < 0.02, "f*={}", result.best_objective);
        assert!((result.optimal_values[0] - 0.5).abs() < 0.05, "x0={}", result.optimal_values[0]);
    }

    /// Inequality-constrained: minimise x² s.t. x ≤ -2, so x* = -2.
    #[test]
    fn inequality_constrained() {
        let vars = vec![var("x", -10.0, 0.0, -1.0)];
        let f = |x: &[f64]| x[0] * x[0];
        // g(x) = x + 2 ≤ 0 means x ≤ -2
        let g = |x: &[f64]| x[0] + 2.0;
        let result = augmented_lagrangian(
            &f,
            &vars,
            &[] as &[fn(&[f64]) -> f64],
            &[g],
            100,
            1e-5,
        );
        // x* should be near -2 (satisfies g(x)=0, objective = 4)
        assert!(result.optimal_values[0] <= -1.9, "x*={}", result.optimal_values[0]);
    }
}
