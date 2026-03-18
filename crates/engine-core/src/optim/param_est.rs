//! Parameter Estimation: fit ODE model parameters to experimental data.
//!
//! Minimises the sum of squared residuals between ODE model output and
//! observed data using the Levenberg-Marquardt algorithm.
//!
//! The ODE is solved with RK4 for efficiency. The Jacobian is approximated
//! by finite differences (perturbing each parameter).
//!
//! Reference: Moré, "The Levenberg-Marquardt Algorithm: Implementation and Theory" (1978).

use crate::ode::{OdeSolverConfig, OdeSystem};
use crate::ode::rk4::solve_rk4;
use std::collections::HashMap;

/// Configuration for parameter estimation.
pub struct ParamEstConfig {
    /// ODE differential equations (semicolon-separated strings).
    pub diff_eqs: Vec<String>,
    /// Initial state y0 for the ODE.
    pub y0: Vec<f64>,
    /// Parameter names to estimate.
    pub param_names: Vec<String>,
    /// Initial guesses for the parameters.
    pub param_init: Vec<f64>,
    /// Lower bounds for parameters (same length as param_names).
    pub param_lower: Vec<f64>,
    /// Upper bounds for parameters (same length as param_names).
    pub param_upper: Vec<f64>,
    /// Experimental time points.
    pub t_data: Vec<f64>,
    /// Observed state values at each time point.
    /// `y_data[i]` is the vector of observed states at t_data[i].
    pub y_data: Vec<Vec<f64>>,
    /// Which state indices to compare against data (subset of 0..n_states).
    /// If empty, all states are compared.
    pub observed_states: Vec<usize>,
    /// ODE solver configuration (t_end is set to max(t_data) automatically).
    pub solver: OdeSolverConfig,
    /// LM algorithm maximum iterations.
    pub max_iter: usize,
    /// LM convergence tolerance.
    pub tol: f64,
}

/// Result of a parameter estimation run.
pub struct ParamEstResult {
    /// Estimated parameter values.
    pub params: Vec<f64>,
    /// Final sum of squared residuals.
    pub residual_sum_sq: f64,
    /// Number of LM iterations taken.
    pub iterations: usize,
    /// Whether the algorithm converged.
    pub converged: bool,
    /// Approximate parameter uncertainties (diagonal of (JᵀJ)⁻¹ * σ²).
    pub param_std: Vec<f64>,
}

/// Simulate the ODE with given parameter values and return interpolated outputs at t_data.
fn simulate(cfg: &ParamEstConfig, params: &[f64]) -> Vec<Vec<f64>> {
    let n_p = cfg.param_names.len();
    let t_max = cfg.t_data.iter().cloned().fold(0.0_f64, f64::max);

    let mut param_map: HashMap<String, f64> = HashMap::new();
    for i in 0..n_p {
        param_map.insert(cfg.param_names[i].clone(), params[i]);
    }

    let system = OdeSystem {
        equations: cfg.diff_eqs.clone(),
        state_names: (0..cfg.y0.len()).map(|i| format!("y{i}")).collect(),
        params: param_map,
    };

    let solver_cfg = OdeSolverConfig {
        t_start: 0.0,
        t_end: t_max,
        dt: cfg.solver.dt,
        tolerance: cfg.solver.tolerance,
        max_steps: cfg.solver.max_steps,
    };

    let result = solve_rk4(&system, &cfg.y0, &solver_cfg);

    // Interpolate output at t_data time points
    let n_states = cfg.y0.len();
    let obs = if cfg.observed_states.is_empty() {
        (0..n_states).collect::<Vec<_>>()
    } else {
        cfg.observed_states.clone()
    };

    let mut outputs = Vec::with_capacity(cfg.t_data.len());
    for &t_obs in &cfg.t_data {
        // Find interval in result.t that brackets t_obs
        let n_pts = result.t.len();
        if n_pts == 0 {
            outputs.push(vec![f64::NAN; obs.len()]);
            continue;
        }
        let idx = result.t.partition_point(|&tt| tt <= t_obs).saturating_sub(1);
        let idx = idx.min(n_pts - 1);

        let y_at_t = if idx + 1 < n_pts && result.t[idx + 1] > result.t[idx] {
            // Linear interpolation
            let frac = (t_obs - result.t[idx]) / (result.t[idx + 1] - result.t[idx]);
            obs.iter().map(|&s| {
                result.states[idx][s] + frac * (result.states[idx + 1][s] - result.states[idx][s])
            }).collect()
        } else {
            obs.iter().map(|&s| result.states[idx][s]).collect()
        };
        outputs.push(y_at_t);
    }
    outputs
}

/// Compute residuals vector r_i = model(t_i, p) - y_data_i (flattened).
fn residuals(cfg: &ParamEstConfig, params: &[f64]) -> Vec<f64> {
    let simulated = simulate(cfg, params);
    let obs = if cfg.observed_states.is_empty() {
        (0..cfg.y0.len()).collect::<Vec<_>>()
    } else {
        cfg.observed_states.clone()
    };

    let mut r = Vec::new();
    for (i, &_t) in cfg.t_data.iter().enumerate() {
        for (j, &_s) in obs.iter().enumerate() {
            let model_val = simulated[i][j];
            let data_val = cfg.y_data[i][j];
            r.push(model_val - data_val);
        }
    }
    r
}

/// Fit ODE parameters using the Levenberg-Marquardt algorithm.
pub fn levenberg_marquardt(cfg: &ParamEstConfig) -> ParamEstResult {
    let n_p = cfg.param_names.len();
    let eps = 1e-6_f64;

    let mut p = cfg.param_init.clone();
    // Project onto bounds
    for i in 0..n_p {
        p[i] = p[i].clamp(cfg.param_lower[i], cfg.param_upper[i]);
    }

    let mut lambda = 1e-3_f64;
    let lambda_inc = 10.0_f64;
    let lambda_dec = 0.1_f64;

    let r = residuals(cfg, &p);
    let mut ssr = r.iter().map(|ri| ri * ri).sum::<f64>();

    let n_r = r.len();
    let mut converged = false;
    let mut iterations = 0usize;

    for _iter in 0..cfg.max_iter {
        // Build Jacobian J (n_r × n_p) via finite differences
        let r_curr = residuals(cfg, &p);
        let mut jac = vec![vec![0.0f64; n_p]; n_r];
        for col in 0..n_p {
            let mut p_pert = p.clone();
            let h = eps * (1.0 + p[col].abs());
            p_pert[col] += h;
            p_pert[col] = p_pert[col].clamp(cfg.param_lower[col], cfg.param_upper[col]);
            let r_pert = residuals(cfg, &p_pert);
            let actual_h = p_pert[col] - p[col];
            let dh = if actual_h.abs() > 1e-15 { actual_h } else { h };
            for row in 0..n_r {
                jac[row][col] = (r_pert[row] - r_curr[row]) / dh;
            }
        }

        // Build JᵀJ and Jᵀr
        let mut jtj = vec![vec![0.0f64; n_p]; n_p];
        let mut jtr = vec![0.0f64; n_p];
        for col1 in 0..n_p {
            for col2 in 0..n_p {
                jtj[col1][col2] = (0..n_r).map(|row| jac[row][col1] * jac[row][col2]).sum();
            }
            jtr[col1] = (0..n_r).map(|row| jac[row][col1] * r_curr[row]).sum();
        }

        // Gradient norm check
        let grad_norm: f64 = jtr.iter().map(|v| v * v).sum::<f64>().sqrt();
        if grad_norm < cfg.tol { converged = true; break; }

        // LM step: solve (JᵀJ + λI)·Δp = -Jᵀr
        let neg_jtr: Vec<f64> = jtr.iter().map(|v| -v).collect();
        let mut jtj_lm = jtj.clone();
        for i in 0..n_p { jtj_lm[i][i] += lambda * jtj[i][i].max(1e-10); }

        let dp = gauss_jordan_lm(&jtj_lm, &neg_jtr);

        // Propose new parameter set
        let p_new: Vec<f64> = (0..n_p)
            .map(|i| (p[i] + dp[i]).clamp(cfg.param_lower[i], cfg.param_upper[i]))
            .collect();

        let r_new = residuals(cfg, &p_new);
        let ssr_new: f64 = r_new.iter().map(|ri| ri * ri).sum();

        if ssr_new < ssr {
            ssr = ssr_new;
            p = p_new;
            lambda *= lambda_dec;
            if lambda < 1e-10 { lambda = 1e-10; }
        } else {
            lambda *= lambda_inc;
            if lambda > 1e10 { lambda = 1e10; }
        }
        iterations += 1;
    }

    // Estimate parameter uncertainties via (JᵀJ)⁻¹ * σ²
    let r_final = residuals(cfg, &p);
    let n_r = r_final.len();
    let sigma_sq = if n_r > n_p {
        r_final.iter().map(|ri| ri * ri).sum::<f64>() / (n_r - n_p) as f64
    } else {
        1.0
    };

    // Build JᵀJ at final parameters
    let r_curr = residuals(cfg, &p);
    let mut jac_final = vec![vec![0.0f64; n_p]; n_r];
    let eps_f = 1e-6_f64;
    for col in 0..n_p {
        let mut p_pert = p.clone();
        let h = eps_f * (1.0 + p[col].abs());
        p_pert[col] += h;
        let r_pert = residuals(cfg, &p_pert);
        let dh = h.max(1e-15);
        for row in 0..n_r {
            jac_final[row][col] = (r_pert[row] - r_curr[row]) / dh;
        }
    }
    let mut jtj_final = vec![vec![0.0f64; n_p]; n_p];
    for col1 in 0..n_p {
        for col2 in 0..n_p {
            jtj_final[col1][col2] = (0..n_r).map(|row| jac_final[row][col1] * jac_final[row][col2]).sum();
        }
    }

    // Invert JᵀJ to get covariance (diagonal only for std errors)
    let cov_diag = invert_diag(&jtj_final);
    let param_std: Vec<f64> = cov_diag.iter().map(|&v| (v * sigma_sq).abs().sqrt()).collect();

    ParamEstResult {
        params: p,
        residual_sum_sq: ssr,
        iterations,
        converged,
        param_std,
    }
}

fn gauss_jordan_lm(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = a.len();
    if n == 0 { return vec![]; }
    let mut mat: Vec<Vec<f64>> = a.iter().zip(b.iter()).map(|(row, &bi)| {
        let mut r = row.clone(); r.push(bi); r
    }).collect();
    for col in 0..n {
        let mut max_row = col;
        let mut max_val = mat[col][col].abs();
        for row in (col + 1)..n {
            if mat[row][col].abs() > max_val { max_val = mat[row][col].abs(); max_row = row; }
        }
        mat.swap(col, max_row);
        let pivot = mat[col][col];
        if pivot.abs() < 1e-15 { continue; }
        for j in col..=n { mat[col][j] /= pivot; }
        for row in 0..n {
            if row == col { continue; }
            let factor = mat[row][col];
            for j in col..=n { mat[row][j] -= factor * mat[col][j]; }
        }
    }
    (0..n).map(|i| mat[i][n]).collect()
}

/// Invert a matrix and return its diagonal elements.
fn invert_diag(a: &[Vec<f64>]) -> Vec<f64> {
    let n = a.len();
    if n == 0 { return vec![]; }
    // Build augmented [A|I]
    let mut mat: Vec<Vec<f64>> = a.iter().enumerate().map(|(i, row)| {
        let mut r = row.clone();
        for j in 0..n { r.push(if i == j { 1.0 } else { 0.0 }); }
        r
    }).collect();

    for col in 0..n {
        let mut max_row = col;
        let mut max_val = mat[col][col].abs();
        for row in (col + 1)..n {
            if mat[row][col].abs() > max_val { max_val = mat[row][col].abs(); max_row = row; }
        }
        mat.swap(col, max_row);
        let pivot = mat[col][col];
        if pivot.abs() < 1e-15 { continue; }
        for j in 0..(2 * n) { mat[col][j] /= pivot; }
        for row in 0..n {
            if row == col { continue; }
            let factor = mat[row][col];
            for j in 0..(2 * n) { mat[row][j] -= factor * mat[col][j]; }
        }
    }

    // Return diagonal of the inverted matrix
    (0..n).map(|i| mat[i][n + i]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_solver() -> OdeSolverConfig {
        OdeSolverConfig { t_start: 0.0, t_end: 5.0, dt: 0.05, tolerance: 1e-6, max_steps: 10_000 }
    }

    #[test]
    fn fit_exponential_decay() {
        // Model: dy/dt = -k*y, y(0)=1
        // True k = 0.5, data generated from exact solution y(t) = e^{-0.5t}
        let t_data: Vec<f64> = (0..=10).map(|i| i as f64 * 0.5).collect();
        let y_data: Vec<Vec<f64>> = t_data.iter().map(|&t| vec![(-0.5 * t).exp()]).collect();

        let cfg = ParamEstConfig {
            diff_eqs: vec!["-k * y0".to_string()],
            y0: vec![1.0],
            param_names: vec!["k".to_string()],
            param_init: vec![0.2], // wrong initial guess
            param_lower: vec![0.0],
            param_upper: vec![10.0],
            t_data,
            y_data,
            observed_states: vec![0],
            solver: default_solver(),
            max_iter: 50,
            tol: 1e-8,
        };

        let result = levenberg_marquardt(&cfg);
        assert!((result.params[0] - 0.5).abs() < 0.05,
            "k should be ~0.5, got {}", result.params[0]);
        assert!(result.residual_sum_sq < 0.01,
            "SSR should be small, got {}", result.residual_sum_sq);
    }

    #[test]
    fn fit_two_params() {
        // Model: dy/dt = -k*y + b, y(0)=0
        // Exact: y(t) = (b/k)(1 - e^{-kt})
        // True: k=1, b=2
        let (k_true, b_true) = (1.0_f64, 2.0_f64);
        let t_data: Vec<f64> = (0..=10).map(|i| i as f64 * 0.3).collect();
        let y_data: Vec<Vec<f64>> = t_data.iter().map(|&t| {
            vec![(b_true / k_true) * (1.0 - (-k_true * t).exp())]
        }).collect();

        let cfg = ParamEstConfig {
            diff_eqs: vec!["-k * y0 + b".to_string()],
            y0: vec![0.0],
            param_names: vec!["k".to_string(), "b".to_string()],
            param_init: vec![0.5, 1.0],
            param_lower: vec![0.0, 0.0],
            param_upper: vec![10.0, 10.0],
            t_data,
            y_data,
            observed_states: vec![0],
            solver: default_solver(),
            max_iter: 100,
            tol: 1e-8,
        };

        let result = levenberg_marquardt(&cfg);
        assert!((result.params[0] - k_true).abs() < 0.1,
            "k should be ~{k_true}, got {}", result.params[0]);
        assert!((result.params[1] - b_true).abs() < 0.1,
            "b should be ~{b_true}, got {}", result.params[1]);
    }

    #[test]
    fn result_has_std_errors() {
        let t_data: Vec<f64> = (0..=5).map(|i| i as f64).collect();
        let y_data: Vec<Vec<f64>> = t_data.iter().map(|&t| vec![(-t).exp()]).collect();

        let cfg = ParamEstConfig {
            diff_eqs: vec!["-k * y0".to_string()],
            y0: vec![1.0],
            param_names: vec!["k".to_string()],
            param_init: vec![1.0],
            param_lower: vec![0.0],
            param_upper: vec![5.0],
            t_data,
            y_data,
            observed_states: vec![0],
            solver: default_solver(),
            max_iter: 30,
            tol: 1e-8,
        };

        let result = levenberg_marquardt(&cfg);
        assert!(result.param_std.len() == 1, "Should return one std error");
        assert!(result.param_std[0].is_finite(), "std error should be finite");
    }
}
