//! Symplectic ODE integrators for Hamiltonian systems.
//!
//! Implements two structure-preserving integrators:
//!
//! * **Störmer-Verlet (velocity Verlet)** — 2nd-order symplectic, preserves
//!   the Hamiltonian to O(h²) per step for conservative systems. No secular
//!   energy drift over long integrations. Suitable for planetary orbits and
//!   molecular dynamics.
//!
//! * **Symplectic Euler** — 1st-order symplectic (semi-implicit Euler). Simpler
//!   and cheaper per step, still preserves a modified Hamiltonian but with
//!   O(h) energy oscillation.
//!
//! # System formulation
//!
//! The user provides a *second-order* mechanical system in split form:
//!
//! ```text
//!   dq_i/dt = v_i          (positions, trivial)
//!   dv_i/dt = a_i(q, v, t) (velocities from acceleration expressions)
//! ```
//!
//! State vector: `y = [q_0, ..., q_{N-1}, v_0, ..., v_{N-1}]`  (positions first).
//! Initial state: y0 has length 2N.
//! Acceleration expressions: `equations` has length N, indexed y0..y{N-1} for
//! positions and y{N}..y{2N-1} for velocities (same naming as other solvers).

use crate::expr::eval_expr;
use crate::ode::types::{OdeResult, OdeSolverConfig};
use std::collections::HashMap;

/// Symplectic integration method.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SympMethod {
    /// Velocity Verlet / Störmer-Verlet (2nd order).
    VelocityVerlet,
    /// Symplectic (semi-implicit) Euler (1st order).
    SympEuler,
}

/// Run a symplectic integrator for a split Hamiltonian system.
///
/// `accel_exprs` — N acceleration expressions a_i(q, v, t). Each expression
///     may use: `t`, `y0..y{N-1}` (positions), `y{N}..y{2N-1}` (velocities),
///     and named params.
///
/// `y0` — initial state [q_0..q_{N-1}, v_0..v_{N-1}], length 2N.
///
/// `state_names` — column header names for positions then velocities
///     (used in output table). If empty, defaults to `["q0".."qN", "v0".."vN"]`.
pub fn solve_symplectic(
    accel_exprs: &[String],
    y0: &[f64],
    config: &OdeSolverConfig,
    params: &HashMap<String, f64>,
    state_names: &[String],
    method: SympMethod,
) -> OdeResult {
    let n = accel_exprs.len();
    if y0.len() != 2 * n || n == 0 {
        return OdeResult {
            t: vec![],
            states: vec![],
            column_names: vec!["t".to_string()],
            steps: 0,
        };
    }

    let dt = config.dt;
    let t_start = config.t_start;
    let t_end = config.t_end;
    let max_steps = config.max_steps;

    // Build output column names
    let col_names: Vec<String> = if state_names.len() == 2 * n {
        state_names.to_vec()
    } else {
        let mut c: Vec<String> = (0..n).map(|i| format!("q{i}")).collect();
        c.extend((0..n).map(|i| format!("v{i}")));
        c
    };

    let mut t_vec = Vec::with_capacity(max_steps + 1);
    let mut states = Vec::with_capacity(max_steps + 1);

    // Initial state
    let mut q: Vec<f64> = y0[..n].to_vec();
    let mut v: Vec<f64> = y0[n..].to_vec();
    let mut t = t_start;

    t_vec.push(t);
    let mut row = q.clone();
    row.extend_from_slice(&v);
    states.push(row);

    let n_steps = ((t_end - t_start) / dt).ceil() as usize;
    let steps_limit = n_steps.min(max_steps);

    let mut step = 0;
    while t < t_end - 1e-12 * dt.abs() && step < steps_limit {
        let dt_actual = if t + dt > t_end { t_end - t } else { dt };

        match method {
            SympMethod::VelocityVerlet => {
                // 1. Compute acceleration at (q, v, t)
                let a0 = eval_accels(accel_exprs, &q, &v, t, params, n);
                // 2. Half-kick: v_half = v + a0 * dt/2
                let v_half: Vec<f64> = v.iter().zip(a0.iter()).map(|(&vi, &ai)| vi + ai * dt_actual * 0.5).collect();
                // 3. Full drift: q_new = q + v_half * dt
                let q_new: Vec<f64> = q.iter().zip(v_half.iter()).map(|(&qi, &vhi)| qi + vhi * dt_actual).collect();
                // 4. Compute new acceleration at (q_new, v_half, t+dt)
                let a1 = eval_accels(accel_exprs, &q_new, &v_half, t + dt_actual, params, n);
                // 5. Half-kick: v_new = v_half + a1 * dt/2
                let v_new: Vec<f64> = v_half.iter().zip(a1.iter()).map(|(&vhi, &ai)| vhi + ai * dt_actual * 0.5).collect();
                q = q_new;
                v = v_new;
            }
            SympMethod::SympEuler => {
                // Kick: v_new = v + a(q, v, t) * dt
                let a = eval_accels(accel_exprs, &q, &v, t, params, n);
                let v_new: Vec<f64> = v.iter().zip(a.iter()).map(|(&vi, &ai)| vi + ai * dt_actual).collect();
                // Drift: q_new = q + v_new * dt  (uses NEW velocity — symplectic)
                let q_new: Vec<f64> = q.iter().zip(v_new.iter()).map(|(&qi, &vni)| qi + vni * dt_actual).collect();
                q = q_new;
                v = v_new;
            }
        }

        t += dt_actual;
        step += 1;

        t_vec.push(t);
        let mut row = q.clone();
        row.extend_from_slice(&v);
        states.push(row);
    }

    let mut column_names = vec!["t".to_string()];
    column_names.extend(col_names);

    OdeResult { t: t_vec, states, column_names, steps: step }
}

/// Evaluate acceleration expressions at the current state.
fn eval_accels(
    exprs: &[String],
    q: &[f64],
    v: &[f64],
    t: f64,
    params: &HashMap<String, f64>,
    n: usize,
) -> Vec<f64> {
    let mut vars: HashMap<String, f64> = params.clone();
    vars.insert("t".to_string(), t);
    // Positions: y0..yN-1
    for (i, &qi) in q.iter().enumerate() {
        vars.insert(format!("y{i}"), qi);
    }
    // Velocities: yN..y2N-1
    for (i, &vi) in v.iter().enumerate() {
        vars.insert(format!("y{}", i + n), vi);
    }
    exprs.iter().map(|expr| eval_expr(expr, &vars).unwrap_or(f64::NAN)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ode::types::OdeSolverConfig;

    /// Harmonic oscillator: dq/dt = v, dv/dt = -q
    /// Exact solution: q(t) = cos(t), v(t) = -sin(t)
    /// Total energy H = 0.5*(v² + q²) = 0.5 (conserved)
    #[test]
    fn verlet_harmonic_oscillator_energy_conserved() {
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 100.0, // many oscillation periods
            dt: 0.1,
            tolerance: 1e-6,
            max_steps: 10_000,
        };
        let accel = vec!["-y0".to_string()]; // d²q/dt² = -q
        let y0 = [1.0_f64, 0.0]; // q=1, v=0
        let params = HashMap::new();
        let result = solve_symplectic(&accel, &y0, &config, &params, &[], SympMethod::VelocityVerlet);

        // Check final energy H = 0.5*(v² + q²) ≈ 0.5
        let last = result.states.last().unwrap();
        let q_final = last[0];
        let v_final = last[1];
        let energy = 0.5 * (q_final * q_final + v_final * v_final);
        assert!((energy - 0.5).abs() < 0.001, "Energy drift: H={energy}");
    }

    #[test]
    fn symp_euler_harmonic_oscillator_no_diverge() {
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 10.0,
            dt: 0.05,
            tolerance: 1e-6,
            max_steps: 1_000,
        };
        let accel = vec!["-y0".to_string()];
        let y0 = [1.0_f64, 0.0];
        let params = HashMap::new();
        let result = solve_symplectic(&accel, &y0, &config, &params, &[], SympMethod::SympEuler);
        // Symplectic Euler doesn't blow up — amplitude stays bounded
        let last = result.states.last().unwrap();
        let amp_sq = last[0] * last[0] + last[1] * last[1];
        assert!(amp_sq < 4.0, "Amplitude exploded: q={}, v={}", last[0], last[1]);
    }

    #[test]
    fn verlet_column_names() {
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.1,
            ..Default::default()
        };
        let accel = vec!["-y0".to_string(), "-y1".to_string()]; // 2-DOF
        let y0 = [1.0_f64, 0.0, 0.0, 1.0]; // q0=1, q1=0, v0=0, v1=1
        let params = HashMap::new();
        let result = solve_symplectic(&accel, &y0, &config, &params, &[], SympMethod::VelocityVerlet);
        assert_eq!(result.column_names, vec!["t", "q0", "q1", "v0", "v1"]);
    }
}
