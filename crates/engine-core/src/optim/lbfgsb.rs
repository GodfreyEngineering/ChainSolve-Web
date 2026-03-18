//! L-BFGS-B: Limited-memory BFGS with bound constraints.
//!
//! Implements the L-BFGS-B algorithm for bound-constrained optimization.
//! Reference: Byrd, Lu, Nocedal & Zhu (1995) "A Limited Memory Algorithm
//! for Bound Constrained Optimization", SIAM J. Scientific Computing 16(5).
//!
//! # Algorithm
//!
//! At each iteration:
//! 1. Compute gradient g = ∇f(x) via central differences.
//! 2. Project gradient: g_proj_i = 0 if x_i at bound and g_i pushing out.
//! 3. Compute L-BFGS search direction d = -H_k · g using two-loop recursion
//!    on the stored (s, y) pairs (last m=10 steps).
//! 4. Clip d so x + α·d stays feasible, then backtracking Armijo line search.
//! 5. Project x to [lb, ub] after update.
//! 6. Update (s, y) memory if y·s > 1e-10 (positive curvature condition).
//! 7. Convergence: ||g_proj||∞ < tol.
//!
//! # Numerical gradient
//!
//! Central differences: g_i ≈ (f(x + h·eᵢ) - f(x - h·eᵢ)) / (2h)
//! where h = 1e-6 * max(1, |x_i|).

use super::{DesignVar, OptimResult};

/// Run L-BFGS-B to minimize `f(x)` subject to variable bounds.
///
/// Uses numerical (central-differences) gradients.
/// `m` = memory size (number of (s,y) pairs to store); default 10.
/// `max_iter` = maximum iterations; default 1000.
/// `tol` = convergence tolerance on ||∇f||∞; default 1e-8.
pub fn lbfgsb<F>(
    f: &F,
    vars: &[DesignVar],
    max_iter: usize,
    m_memory: usize,
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

    let lb: Vec<f64> = vars.iter().map(|v| v.min).collect();
    let ub: Vec<f64> = vars.iter().map(|v| v.max).collect();

    // Initial point (clamped to bounds)
    let mut x: Vec<f64> = vars.iter().map(|v| v.initial.clamp(v.min, v.max)).collect();

    // Circular buffer for (s, y) pairs
    let m = m_memory.max(1).min(50);
    let mut s_buf: Vec<Vec<f64>> = Vec::with_capacity(m);
    let mut y_buf: Vec<Vec<f64>> = Vec::with_capacity(m);
    let mut rho_buf: Vec<f64> = Vec::with_capacity(m); // 1/(yᵀs)

    let mut f_x = f(&x);
    let mut history = vec![f_x];
    let mut best_f = f_x;
    let mut best_x = x.clone();
    let mut converged = false;

    // Numerical gradient
    let grad = |x: &[f64], f_center: f64| -> Vec<f64> {
        let mut g = vec![0.0; n];
        for i in 0..n {
            let h = 1e-6 * x[i].abs().max(1.0);
            let mut xp = x.to_vec(); xp[i] += h;
            let mut xm = x.to_vec(); xm[i] -= h;
            // Clamp to bounds
            xp[i] = xp[i].clamp(lb[i], ub[i]);
            xm[i] = xm[i].clamp(lb[i], ub[i]);
            let dx = xp[i] - xm[i];
            if dx.abs() > 1e-15 {
                g[i] = (f(&xp) - f(&xm)) / dx;
            } else {
                let _ = f_center; // suppress unused
                g[i] = 0.0;
            }
        }
        g
    };

    // Project gradient at bounds: zero out components where x is at a bound
    // and the gradient would push outside.
    let project_gradient = |x: &[f64], g: &[f64]| -> Vec<f64> {
        g.iter().enumerate().map(|(i, &gi)| {
            if (x[i] <= lb[i] + 1e-14 && gi > 0.0) || (x[i] >= ub[i] - 1e-14 && gi < 0.0) {
                0.0
            } else {
                gi
            }
        }).collect()
    };

    let mut g = grad(&x, f_x);
    let mut g_proj = project_gradient(&x, &g);

    for iter in 0..max_iter {
        // Check convergence
        let g_inf = g_proj.iter().cloned().fold(0.0_f64, f64::max);
        if g_inf < tol {
            converged = true;
            break;
        }

        // ── Two-loop L-BFGS recursion ─────────────────────────────────────
        let k = s_buf.len();
        let mut q = g.clone(); // q starts as current gradient
        let mut alpha = vec![0.0_f64; k];

        // First loop (backward through history)
        for i in (0..k).rev() {
            let sq: f64 = s_buf[i].iter().zip(q.iter()).map(|(&si, &qi)| si * qi).sum();
            alpha[i] = rho_buf[i] * sq;
            for j in 0..n {
                q[j] -= alpha[i] * y_buf[i][j];
            }
        }

        // Scale initial Hessian approximation: H₀ = (sᵀy / yᵀy) * I
        let gamma = if k > 0 {
            let sy: f64 = s_buf[k-1].iter().zip(y_buf[k-1].iter()).map(|(&si, &yi)| si * yi).sum();
            let yy: f64 = y_buf[k-1].iter().map(|&yi| yi * yi).sum();
            if yy > 1e-14 { sy / yy } else { 1.0 }
        } else {
            1.0
        };
        let mut r: Vec<f64> = q.iter().map(|&qi| gamma * qi).collect();

        // Second loop (forward through history)
        for i in 0..k {
            let yr: f64 = y_buf[i].iter().zip(r.iter()).map(|(&yi, &ri)| yi * ri).sum();
            let beta = rho_buf[i] * yr;
            for j in 0..n {
                r[j] += s_buf[i][j] * (alpha[i] - beta);
            }
        }

        // Search direction: d = -r (projected to feasible)
        let d: Vec<f64> = r.iter().enumerate().map(|(i, &ri)| {
            let di = -ri;
            // Project: if x at bound and direction pushes out, zero it
            if (x[i] <= lb[i] + 1e-14 && di < 0.0) || (x[i] >= ub[i] - 1e-14 && di > 0.0) {
                0.0
            } else {
                di
            }
        }).collect();

        // ── Backtracking line search (Armijo condition) ───────────────────
        let dg: f64 = d.iter().zip(g.iter()).map(|(&di, &gi)| di * gi).sum();
        if dg >= 0.0 {
            // Not a descent direction — reset to steepest descent
            // Use steepest descent for this step
            let mut step_size = 1.0;
            let x_new: Vec<f64> = x.iter().enumerate().map(|(i, &xi)| (xi - step_size * g_proj[i]).clamp(lb[i], ub[i])).collect();
            let f_new = f(&x_new);
            if f_new < f_x {
                let s: Vec<f64> = x_new.iter().zip(x.iter()).map(|(&xni, &xi)| xni - xi).collect();
                let g_new = grad(&x_new, f_new);
                let y: Vec<f64> = g_new.iter().zip(g.iter()).map(|(&gni, &gi)| gni - gi).collect();
                update_memory(&mut s_buf, &mut y_buf, &mut rho_buf, s, y, m);
                x = x_new;
                f_x = f_new;
                g = g_new;
            } else {
                // Very small step — probably stuck at boundary or minimum
                step_size *= 0.1;
                let x_try: Vec<f64> = x.iter().enumerate().map(|(i, &xi)| (xi - step_size * g_proj[i]).clamp(lb[i], ub[i])).collect();
                let f_try = f(&x_try);
                if f_try < f_x {
                    x = x_try;
                    f_x = f_try;
                    g = grad(&x, f_x);
                }
            }
        } else {
            // Standard Armijo backtracking
            let c1 = 1e-4;
            let mut step_size = 1.0;
            let x_new = loop {
                let x_try: Vec<f64> = x.iter().enumerate().map(|(i, &xi)| (xi + step_size * d[i]).clamp(lb[i], ub[i])).collect();
                let f_try = f(&x_try);
                if f_try <= f_x + c1 * step_size * dg || step_size < 1e-14 {
                    break (x_try, f_try);
                }
                step_size *= 0.5;
            };
            let (x_new, f_new) = x_new;

            // Update L-BFGS memory
            let s: Vec<f64> = x_new.iter().zip(x.iter()).map(|(&xni, &xi)| xni - xi).collect();
            let g_new = grad(&x_new, f_new);
            let y: Vec<f64> = g_new.iter().zip(g.iter()).map(|(&gni, &gi)| gni - gi).collect();
            update_memory(&mut s_buf, &mut y_buf, &mut rho_buf, s, y, m);

            x = x_new;
            f_x = f_new;
            g = g_new;
        }

        g_proj = project_gradient(&x, &g);

        if f_x < best_f {
            best_f = f_x;
            best_x = x.clone();
        }
        history.push(best_f);

        let _ = iter; // suppress unused warning
    }

    if best_f.is_nan() {
        best_f = f_x;
        best_x = x.clone();
    }

    OptimResult {
        optimal_values: best_x,
        best_objective: best_f,
        iterations: history.len(),
        history,
        converged,
    }
}

/// Update the circular (s, y, ρ) memory, discarding oldest if full.
fn update_memory(
    s_buf: &mut Vec<Vec<f64>>,
    y_buf: &mut Vec<Vec<f64>>,
    rho_buf: &mut Vec<f64>,
    s: Vec<f64>,
    y: Vec<f64>,
    m: usize,
) {
    let sy: f64 = s.iter().zip(y.iter()).map(|(&si, &yi)| si * yi).sum();
    if sy <= 1e-10 { return; } // Skip if curvature condition not satisfied

    if s_buf.len() >= m {
        s_buf.remove(0);
        y_buf.remove(0);
        rho_buf.remove(0);
    }
    rho_buf.push(1.0 / sy);
    s_buf.push(s);
    y_buf.push(y);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_vars(n: usize) -> Vec<DesignVar> {
        (0..n).map(|i| DesignVar {
            name: format!("x{i}"),
            min: -5.0, max: 5.0, initial: 1.5, step: 0.1,
        }).collect()
    }

    /// Minimize sphere: f(x) = Σx_i² → x*=(0,...,0), f*=0
    #[test]
    fn lbfgsb_sphere() {
        let vars = make_vars(3);
        let result = lbfgsb(&|x: &[f64]| x.iter().map(|&xi| xi * xi).sum::<f64>(), &vars, 200, 10, 1e-6);
        assert!(result.best_objective < 1e-6,
            "Sphere: f* = {}", result.best_objective);
        for (i, &xi) in result.optimal_values.iter().enumerate() {
            assert!(xi.abs() < 1e-3, "x{i} = {xi}");
        }
    }

    /// Minimize Rosenbrock f(x,y) = (1-x)² + 100(y-x²)² → (1,1), f=0
    #[test]
    fn lbfgsb_rosenbrock() {
        let vars = vec![
            DesignVar { name: "x".into(), min: -2.0, max: 2.0, initial: 0.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -2.0, max: 2.0, initial: 0.0, step: 0.1 },
        ];
        let result = lbfgsb(
            &|x: &[f64]| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0].powi(2)).powi(2),
            &vars, 500, 10, 1e-6,
        );
        assert!(result.best_objective < 1e-4,
            "Rosenbrock: f* = {}", result.best_objective);
    }

    /// Bound-constrained: f(x) = (x-3)², bounds [-1, 2] → x* = 2, f* = 1
    #[test]
    fn lbfgsb_bounded() {
        let vars = vec![DesignVar { name: "x".into(), min: -1.0, max: 2.0, initial: 0.0, step: 0.1 }];
        let result = lbfgsb(&|x: &[f64]| (x[0] - 3.0).powi(2), &vars, 100, 10, 1e-8);
        assert!((result.optimal_values[0] - 2.0).abs() < 1e-5,
            "x* = {}, expected 2.0", result.optimal_values[0]);
        assert!((result.best_objective - 1.0).abs() < 1e-5,
            "f* = {}, expected 1.0", result.best_objective);
    }
}
