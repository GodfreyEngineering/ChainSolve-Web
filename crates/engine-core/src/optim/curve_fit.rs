//! Levenberg-Marquardt (LM) nonlinear least-squares curve fitting.
//!
//! Fits a model f(x, params) to observed (x_data, y_data) by minimising the
//! sum of squared residuals ||y_data - f(x_data, params)||².
//!
//! Uses the LM update Δp = (JᵀJ + λI)⁻¹ Jᵀr with adaptive damping λ.
//! Jacobian is approximated by central finite differences.
//!
//! References:
//!   K. Levenberg (1944), D. Marquardt (1963).

/// Result returned by the curve-fitting routines.
#[derive(Debug, Clone)]
pub struct CurveFitResult {
    /// Fitted parameter values.
    pub params: Vec<f64>,
    /// Coefficient of determination R² ∈ (-∞, 1].
    pub r_squared: f64,
    /// Residuals r_i = y_i − f(x_i, params).
    pub residuals: Vec<f64>,
    /// Number of LM iterations used.
    pub iterations: usize,
    /// Whether the algorithm converged within the requested tolerance.
    pub converged: bool,
}

/// Fit a user-defined model to data using Levenberg-Marquardt.
///
/// # Arguments
/// * `f_model` — model closure: `(x: f64, params: &[f64]) -> f64`
/// * `x_data`  — independent variable observations
/// * `y_data`  — dependent variable observations (same length as `x_data`)
/// * `initial_params` — starting parameter guesses
/// * `max_iter` — maximum LM iterations (200 is a sensible default)
/// * `tol`     — convergence: stop when relative cost reduction < `tol`
pub fn levenberg_marquardt<F>(
    f_model: &F,
    x_data: &[f64],
    y_data: &[f64],
    initial_params: &[f64],
    max_iter: usize,
    tol: f64,
) -> CurveFitResult
where
    F: Fn(f64, &[f64]) -> f64,
{
    let n_data = x_data.len();
    let n_params = initial_params.len();

    if n_data == 0 || n_params == 0 || n_data != y_data.len() {
        return CurveFitResult {
            params: initial_params.to_vec(),
            r_squared: f64::NAN,
            residuals: vec![],
            iterations: 0,
            converged: false,
        };
    }

    let h = 1e-6_f64; // central-difference step for Jacobian
    let mut params = initial_params.to_vec();
    let mut lambda = 1e-3_f64;
    let mut prev_cost = f64::INFINITY;

    for iter in 0..max_iter {
        // Residuals r_i = y_i − f(x_i, p)
        let residuals: Vec<f64> = x_data
            .iter()
            .zip(y_data.iter())
            .map(|(&xi, &yi)| yi - f_model(xi, &params))
            .collect();
        let cost: f64 = residuals.iter().map(|r| r * r).sum();

        // Convergence check on relative cost reduction
        if iter > 0 && (prev_cost - cost).abs() / (prev_cost.abs() + 1e-30) < tol {
            return build_result(params, x_data, y_data, f_model, iter + 1, true);
        }
        prev_cost = cost;

        // Numerical Jacobian J[i * n_params + j] = ∂f(xi, p) / ∂pj  (central diff)
        let mut jac = vec![0.0_f64; n_data * n_params];
        for j in 0..n_params {
            let mut p_plus = params.clone();
            let mut p_minus = params.clone();
            p_plus[j] += h;
            p_minus[j] -= h;
            for i in 0..n_data {
                jac[i * n_params + j] =
                    (f_model(x_data[i], &p_plus) - f_model(x_data[i], &p_minus)) / (2.0 * h);
            }
        }

        // JᵀJ  (n_params × n_params, row-major)  and  Jᵀr  (n_params)
        let mut jtj = vec![0.0_f64; n_params * n_params];
        let mut jtr = vec![0.0_f64; n_params];
        for i in 0..n_data {
            for a in 0..n_params {
                jtr[a] += jac[i * n_params + a] * residuals[i];
                for b in 0..n_params {
                    jtj[a * n_params + b] += jac[i * n_params + a] * jac[i * n_params + b];
                }
            }
        }

        // Try damped normal equations (JᵀJ + λI) Δp = Jᵀr
        // Increase λ up to 10 times until a cost-reducing step is found.
        let mut step_accepted = false;
        for _ in 0..10 {
            let mut a = jtj.clone();
            for k in 0..n_params {
                a[k * n_params + k] += lambda;
            }
            if let Some(delta) = solve_linsys(&a, &jtr, n_params) {
                let new_params: Vec<f64> =
                    params.iter().zip(delta.iter()).map(|(&p, &dp)| p + dp).collect();
                let new_cost: f64 = x_data
                    .iter()
                    .zip(y_data.iter())
                    .map(|(&xi, &yi)| {
                        let r = yi - f_model(xi, &new_params);
                        r * r
                    })
                    .sum();
                if new_cost < cost {
                    params = new_params;
                    lambda = (lambda / 10.0).max(1e-20);
                    step_accepted = true;
                    break;
                }
            }
            lambda = (lambda * 10.0).min(1e20);
        }

        if !step_accepted {
            break; // Stalled — return best found so far
        }
    }

    build_result(params, x_data, y_data, f_model, max_iter, false)
}

/// Compute residuals, R², and build the result struct.
fn build_result<F>(
    params: Vec<f64>,
    x_data: &[f64],
    y_data: &[f64],
    f_model: &F,
    iterations: usize,
    converged: bool,
) -> CurveFitResult
where
    F: Fn(f64, &[f64]) -> f64,
{
    let residuals: Vec<f64> = x_data
        .iter()
        .zip(y_data.iter())
        .map(|(&xi, &yi)| yi - f_model(xi, &params))
        .collect();
    let ss_res: f64 = residuals.iter().map(|r| r * r).sum();
    let n = y_data.len() as f64;
    let y_mean = y_data.iter().copied().sum::<f64>() / n;
    let ss_tot: f64 = y_data.iter().map(|&yi| (yi - y_mean).powi(2)).sum();
    let r_squared = if ss_tot > 1e-30 { 1.0 - ss_res / ss_tot } else { 1.0 };
    CurveFitResult { params, r_squared, residuals, iterations, converged }
}

/// Solve Ax = b using Gauss-Jordan elimination with partial pivoting.
/// `a` is row-major, size n×n. Returns `None` if the matrix is singular.
fn solve_linsys(a: &[f64], b: &[f64], n: usize) -> Option<Vec<f64>> {
    let w = n + 1;
    let mut m = vec![0.0_f64; n * w];
    for i in 0..n {
        for j in 0..n {
            m[i * w + j] = a[i * n + j];
        }
        m[i * w + n] = b[i];
    }

    for col in 0..n {
        // Partial pivot: find row with largest |value| in this column
        let mut max_abs = m[col * w + col].abs();
        let mut max_row = col;
        for row in (col + 1)..n {
            let v = m[row * w + col].abs();
            if v > max_abs {
                max_abs = v;
                max_row = row;
            }
        }
        if max_abs < 1e-14 {
            return None; // Singular
        }
        // Swap rows
        if max_row != col {
            for j in 0..w {
                m.swap(col * w + j, max_row * w + j);
            }
        }
        // Normalise pivot row
        let pivot = m[col * w + col];
        for j in col..w {
            m[col * w + j] /= pivot;
        }
        // Eliminate column in all other rows
        for row in 0..n {
            if row == col {
                continue;
            }
            let factor = m[row * w + col];
            for j in col..w {
                let t = m[col * w + j];
                m[row * w + j] -= factor * t;
            }
        }
    }

    Some((0..n).map(|i| m[i * w + n]).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    /// Fit a*sin(b*x) + c to noisy data — 3-parameter nonlinear fit.
    #[test]
    fn fit_sinusoid() {
        // True params: a=2, b=1.5, c=0.5
        let x_data: Vec<f64> = (0..20).map(|i| i as f64 * 0.5).collect();
        let y_data: Vec<f64> = x_data
            .iter()
            .map(|&x| 2.0 * (1.5 * x).sin() + 0.5)
            .collect();
        let result = levenberg_marquardt(
            &|x, p| p[0] * (p[1] * x).sin() + p[2],
            &x_data,
            &y_data,
            &[1.0, 1.0, 0.0], // initial guess
            500,
            1e-10,
        );
        assert!(result.r_squared > 0.999, "R² = {}", result.r_squared);
        assert!(approx_eq(result.params[0].abs(), 2.0, 0.01), "a = {}", result.params[0]);
    }

    /// Fit y = a*x² + b*x + c (quadratic, linear in params → converge in 1 iter).
    #[test]
    fn fit_quadratic() {
        let x_data: Vec<f64> = (-5..=5).map(|i| i as f64).collect();
        let y_data: Vec<f64> = x_data.iter().map(|&x| 3.0 * x * x - 2.0 * x + 1.0).collect();
        let result = levenberg_marquardt(
            &|x, p| p[0] * x * x + p[1] * x + p[2],
            &x_data,
            &y_data,
            &[1.0, 0.0, 0.0],
            100,
            1e-10,
        );
        assert!(result.r_squared > 0.9999, "R² = {}", result.r_squared);
        assert!(approx_eq(result.params[0], 3.0, 1e-4), "a = {}", result.params[0]);
        assert!(approx_eq(result.params[1], -2.0, 1e-4), "b = {}", result.params[1]);
        assert!(approx_eq(result.params[2], 1.0, 1e-4), "c = {}", result.params[2]);
    }

    #[test]
    fn solve_2x2() {
        // 2x + y = 5, x + 3y = 10  → x=1, y=3
        let a = [2.0, 1.0, 1.0, 3.0];
        let b = [5.0, 10.0];
        let sol = solve_linsys(&a, &b, 2).unwrap();
        assert!(approx_eq(sol[0], 1.0, 1e-10));
        assert!(approx_eq(sol[1], 3.0, 1e-10));
    }
}
