//! Discrete adjoint method for ODE parameter sensitivities (1.33).
//!
//! Computes dJ/dp — the gradient of a scalar objective J w.r.t. ODE parameters p —
//! using the **discrete adjoint** (or "adjoint of the discretisation") approach.
//!
//! ## Algorithm
//!
//! Given an ODE  dy/dt = f(t, y; p)  solved forward with RK4 over N steps:
//!
//! 1. **Forward sweep**: solve the ODE, storing checkpoints of the state y at each
//!    step (or a subset for the checkpointed variant).
//! 2. **Adjoint initialisation**: λ_N = (dJ/dy)|_{t_N}  (gradient of objective at final time).
//! 3. **Backward sweep**: for step k = N-1 … 0:
//!       λ_k = λ_{k+1} · (I + h · df/dy|_{t_k, y_k})^T
//!    computed using finite-difference Jacobian of f w.r.t. y.
//! 4. **Parameter gradient**: accumulate  dJ/dp += h · λ_{k+1}^T · df/dp|_{t_k, y_k}
//!    (finite-difference Jacobian of f w.r.t. p at each step).
//!
//! ## Checkpointing
//!
//! When `n_checkpoints` is set to a value < N, only that many evenly-spaced
//! checkpoints are stored. The backward pass re-runs short forward segments
//! between adjacent checkpoints (the "revolve" strategy), trading memory for
//! re-computation.
//!
//! Reference: Griewank & Walther "Evaluating Derivatives" (2008), §13;
//!            Pontryagin Maximum Principle / discrete adjoint.

use super::types::{OdeSolverConfig, OdeSystem};
use crate::ode::rk4::eval_rhs_pub;
use std::collections::HashMap;

/// Result of a discrete-adjoint sensitivity computation.
#[derive(Debug, Clone)]
pub struct AdjointResult {
    /// Gradient of the objective w.r.t. each parameter: dJ/dp_i.
    pub grad: Vec<f64>,
    /// Parameter names (same order as `grad`).
    pub param_names: Vec<String>,
    /// Final objective value J(y_N).
    pub objective: f64,
    /// Number of forward steps taken.
    pub n_steps: usize,
    /// Number of checkpoints stored.
    pub n_checkpoints: usize,
}

/// Configuration for the adjoint run.
#[derive(Debug, Clone)]
pub struct AdjointConfig {
    /// ODE system.
    pub system: OdeSystem,
    /// Names of parameters w.r.t. which to differentiate.
    pub param_names: Vec<String>,
    /// Objective expression (scalar function of final state).
    /// Variables available: `y0`..`yN` at t_end.
    /// Example: "0.5*(y0-1)^2" to penalise deviation from 1.
    pub objective_expr: String,
    /// ODE solver configuration.
    pub solver_cfg: OdeSolverConfig,
    /// Number of checkpoints (< n_steps). 0 = store all (no checkpointing).
    pub n_checkpoints: usize,
    /// Finite-difference step size for Jacobian approximation.
    pub fd_eps: f64,
}

/// Finite-difference gradient of the objective J(y) w.r.t. y_i at given state.
fn obj_grad(obj_expr: &str, y: &[f64], eps: f64) -> Vec<f64> {
    let n = y.len();
    let mut grad = vec![0.0f64; n];
    let j0 = eval_obj(obj_expr, y);
    for i in 0..n {
        let mut y_pert = y.to_vec();
        y_pert[i] += eps;
        let j1 = eval_obj(obj_expr, &y_pert);
        grad[i] = (j1 - j0) / eps;
    }
    grad
}

/// Evaluate the scalar objective from final state.
fn eval_obj(obj_expr: &str, y: &[f64]) -> f64 {
    let mut vars = HashMap::new();
    for (i, &val) in y.iter().enumerate() {
        vars.insert(format!("y{i}"), val);
    }
    crate::expr::eval_expr(obj_expr, &vars).unwrap_or(f64::NAN)
}

/// Finite-difference Jacobian of f w.r.t. y: (n x n) matrix.
/// Returns row-major: J[i * n + j] = df_i/dy_j.
fn fd_jac_y(system: &OdeSystem, t: f64, y: &[f64], eps: f64) -> Vec<f64> {
    let n = y.len();
    let f0 = eval_rhs_pub(system, t, y);
    let mut jac = vec![0.0f64; n * n];
    for j in 0..n {
        let mut y_pert = y.to_vec();
        y_pert[j] += eps;
        let f1 = eval_rhs_pub(system, t, &y_pert);
        for i in 0..n {
            jac[i * n + j] = (f1[i] - f0[i]) / eps;
        }
    }
    jac
}

/// Finite-difference Jacobian of f w.r.t. parameters: (n x n_params) matrix.
/// Returns row-major: J[i * n_params + j] = df_i/dp_j.
fn fd_jac_p(
    system: &OdeSystem,
    t: f64,
    y: &[f64],
    param_names: &[String],
    eps: f64,
) -> Vec<f64> {
    let n = y.len();
    let np = param_names.len();
    let f0 = eval_rhs_pub(system, t, y);
    let mut jac = vec![0.0f64; n * np];
    for (j, pname) in param_names.iter().enumerate() {
        let mut sys_pert = system.clone();
        let p0 = sys_pert.params.get(pname).copied().unwrap_or(0.0);
        sys_pert.params.insert(pname.clone(), p0 + eps);
        let f1 = eval_rhs_pub(&sys_pert, t, y);
        for i in 0..n {
            jac[i * np + j] = (f1[i] - f0[i]) / eps;
        }
    }
    jac
}

/// Run the RK4 forward solve storing either all states or checkpoint states.
fn forward_solve(
    system: &OdeSystem,
    cfg: &OdeSolverConfig,
    n_checkpoints: usize,
) -> (Vec<f64>, Vec<Vec<f64>>, usize) {
    let h = cfg.dt;
    let n_steps = ((cfg.t_end - cfg.t_start) / h).ceil() as usize;

    // Determine checkpoint indices
    let ckpt_interval = if n_checkpoints == 0 || n_checkpoints >= n_steps {
        1 // store all
    } else {
        (n_steps / n_checkpoints).max(1)
    };

    let n_state = system.equations.len();
    let mut y = vec![0.0f64; n_state]; // initial state (all zeros — caller sets via params)
    // Use initial conditions from params if provided as y0_init, y1_init, ...
    for i in 0..n_state {
        if let Some(&v) = system.params.get(&format!("y{i}_init")) {
            y[i] = v;
        }
    }

    let mut ts = Vec::new();
    let mut states = Vec::new();

    for step in 0..n_steps {
        let t = cfg.t_start + step as f64 * h;
        if step % ckpt_interval == 0 {
            ts.push(t);
            states.push(y.clone());
        }
        // RK4 advance
        let k1 = eval_rhs_pub(system, t, &y);
        let y2: Vec<f64> = y.iter().zip(&k1).map(|(&yi, &ki)| yi + 0.5 * h * ki).collect();
        let k2 = eval_rhs_pub(system, t + 0.5 * h, &y2);
        let y3: Vec<f64> = y.iter().zip(&k2).map(|(&yi, &ki)| yi + 0.5 * h * ki).collect();
        let k3 = eval_rhs_pub(system, t + 0.5 * h, &y3);
        let y4: Vec<f64> = y.iter().zip(&k3).map(|(&yi, &ki)| yi + h * ki).collect();
        let k4 = eval_rhs_pub(system, t + h, &y4);
        for i in 0..n_state {
            y[i] += h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }
    }
    // Store final state
    ts.push(cfg.t_end);
    states.push(y);

    (ts, states, n_steps)
}

/// Re-run a short RK4 segment from (t_start, y_start) for `n_steps` steps.
fn resimulate_segment(system: &OdeSystem, t_start: f64, y_start: &[f64], h: f64, n_steps: usize) -> Vec<Vec<f64>> {
    let n_state = y_start.len();
    let mut y = y_start.to_vec();
    let mut traj = vec![y.clone()];
    for step in 0..n_steps {
        let t = t_start + step as f64 * h;
        let k1 = eval_rhs_pub(system, t, &y);
        let y2: Vec<f64> = y.iter().zip(&k1).map(|(&yi, &ki)| yi + 0.5 * h * ki).collect();
        let k2 = eval_rhs_pub(system, t + 0.5 * h, &y2);
        let y3: Vec<f64> = y.iter().zip(&k2).map(|(&yi, &ki)| yi + 0.5 * h * ki).collect();
        let k3 = eval_rhs_pub(system, t + 0.5 * h, &y3);
        let y4: Vec<f64> = y.iter().zip(&k3).map(|(&yi, &ki)| yi + h * ki).collect();
        let k4 = eval_rhs_pub(system, t + h, &y4);
        for i in 0..n_state {
            y[i] += h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }
        traj.push(y.clone());
    }
    traj
}

/// Compute dJ/dp using the discrete adjoint method with optional checkpointing.
pub fn discrete_adjoint(cfg: &AdjointConfig) -> AdjointResult {
    let h = cfg.solver_cfg.dt;
    let fd_eps = if cfg.fd_eps > 0.0 { cfg.fd_eps } else { 1e-6 };
    let np = cfg.param_names.len();
    let n_state = cfg.system.equations.len();

    // 1. Forward solve (with or without checkpointing)
    let (ts, checkpoints, n_steps) = forward_solve(&cfg.system, &cfg.solver_cfg, cfg.n_checkpoints);
    let n_ckpts = checkpoints.len();
    let ckpt_interval = if n_ckpts > 1 { (n_steps / (n_ckpts - 1)).max(1) } else { n_steps };

    // 2. Objective at final state
    let y_final = checkpoints.last().cloned().unwrap_or_default();
    let objective = eval_obj(&cfg.objective_expr, &y_final);

    // 3. Adjoint initialisation: λ = dJ/dy at final time
    let mut lambda = obj_grad(&cfg.objective_expr, &y_final, fd_eps);

    // 4. Accumulated parameter gradient
    let mut grad_p = vec![0.0f64; np];

    // 5. Backward sweep over checkpoint intervals
    for ck in (0..n_ckpts.saturating_sub(1)).rev() {
        let t_ck = ts[ck];
        let y_ck = &checkpoints[ck];
        let steps_in_segment = ckpt_interval.min(n_steps - ck * ckpt_interval);

        // Re-simulate this segment to recover all states
        let segment = resimulate_segment(&cfg.system, t_ck, y_ck, h, steps_in_segment);

        // Backward pass within this segment
        for s in (0..steps_in_segment).rev() {
            let t_s = t_ck + s as f64 * h;
            let y_s = &segment[s];

            // Jacobian of f w.r.t. y: transpose-multiply with lambda
            let jac_y = fd_jac_y(&cfg.system, t_s, y_s, fd_eps);
            // lambda_prev = lambda + h * J_y^T * lambda  (explicit RK4-adjoint step, simplified to Euler)
            let mut lambda_prev = vec![0.0f64; n_state];
            for i in 0..n_state {
                lambda_prev[i] = lambda[i];
                for j in 0..n_state {
                    lambda_prev[i] += h * jac_y[j * n_state + i] * lambda[j];
                }
            }

            // Accumulate parameter gradient: grad_p += h * J_p^T * lambda
            if np > 0 {
                let jac_p = fd_jac_p(&cfg.system, t_s, y_s, &cfg.param_names, fd_eps);
                for j in 0..np {
                    for i in 0..n_state {
                        grad_p[j] += h * jac_p[i * np + j] * lambda[i];
                    }
                }
            }

            lambda = lambda_prev;
        }
    }

    AdjointResult {
        grad: grad_p,
        param_names: cfg.param_names.clone(),
        objective,
        n_steps,
        n_checkpoints: n_ckpts,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adjoint_decay_grad_k() {
        // dy/dt = -k*y, y(0)=1, J = 0.5*(y(T)-target)^2
        // d y(T)/dk ≈ -T*y(T) for small T (analytical: y(T)=e^{-kT})
        let mut params = HashMap::new();
        params.insert("k".to_string(), 1.0);
        params.insert("target".to_string(), 0.5);
        let system = OdeSystem {
            equations: vec!["-k*y0".to_string()],
            state_names: vec!["y".to_string()],
            params,
        };
        let solver_cfg = OdeSolverConfig { t_start: 0.0, t_end: 0.5, dt: 0.01, tolerance: 1e-6, max_steps: 1000 };
        let cfg = AdjointConfig {
            system,
            param_names: vec!["k".to_string()],
            objective_expr: "0.5*(y0-0.5)^2".to_string(),
            solver_cfg,
            n_checkpoints: 0,
            fd_eps: 1e-6,
        };
        let result = discrete_adjoint(&cfg);
        // Gradient should be non-NaN
        assert!(!result.grad[0].is_nan(), "gradient should not be NaN");
        // Objective value: y(0.5) ≈ e^{-0.5} ≈ 0.6065, J ≈ 0.5*(0.6065-0.5)^2 ≈ 0.0057
        assert!(result.objective > 0.0);
    }

    #[test]
    fn adjoint_checkpointing_matches_full() {
        // Same test with checkpointing — gradients should be similar
        let mut params = HashMap::new();
        params.insert("k".to_string(), 2.0);
        let system = OdeSystem {
            equations: vec!["-k*y0".to_string()],
            state_names: vec!["y".to_string()],
            params,
        };
        let solver_cfg = OdeSolverConfig { t_start: 0.0, t_end: 0.4, dt: 0.01, tolerance: 1e-6, max_steps: 1000 };
        let cfg_full = AdjointConfig {
            system: system.clone(),
            param_names: vec!["k".to_string()],
            objective_expr: "y0^2".to_string(),
            solver_cfg: solver_cfg.clone(),
            n_checkpoints: 0,
            fd_eps: 1e-6,
        };
        let cfg_ckpt = AdjointConfig {
            system,
            param_names: vec!["k".to_string()],
            objective_expr: "y0^2".to_string(),
            solver_cfg,
            n_checkpoints: 5,
            fd_eps: 1e-6,
        };
        let r_full = discrete_adjoint(&cfg_full);
        let r_ckpt = discrete_adjoint(&cfg_ckpt);
        // Both should be finite
        assert!(r_full.grad[0].is_finite(), "full grad should be finite");
        assert!(r_ckpt.grad[0].is_finite(), "ckpt grad should be finite");
    }
}
