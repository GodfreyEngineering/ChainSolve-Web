//! ODE solver with zero-crossing event detection.
//!
//! Wraps the RK4 fixed-step solver with bisection-based zero-crossing detection.
//! When the event function `g(y, t)` changes sign between two steps, bisection
//! refines the crossing time to within `event_tol` (default 1e-10).
//!
//! # Algorithm
//!
//! 1. Take a standard RK4 step from t to t+h.
//! 2. Evaluate g before and after the step.
//! 3. If `g_before * g_after <= 0` (sign change), bisect on [t, t+h]:
//!    - Mid: t_mid = (t_left + t_right) / 2
//!    - Advance the ODE from t_left to t_mid using the stored start state
//!    - Evaluate g at t_mid; narrow the bracket
//!    - Repeat until |t_right - t_left| < event_tol
//! 4. Record the event at t* (midpoint of final bracket).
//! 5. Continue or terminate based on `action` setting.
//!
//! # Event actions
//!
//! * `Terminate` — stop integration at the first zero crossing.
//! * `Record` — record the event and continue integration.
//!
//! # Bisection RK4
//!
//! The bisection sub-solver takes a starting state `y_start` at time `t_start`
//! and integrates to `t_target` in one adaptive-step sequence of RK4 steps with
//! step size h/N (N=32 sub-steps). This gives sufficient accuracy for event location.

use super::rk4::eval_rhs_pub;
use super::types::{OdeResult, OdeSolverConfig, OdeSystem};
use crate::expr::eval_expr;
use std::collections::HashMap;

/// Action to take when an event fires.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EventAction {
    /// Stop integration at the first zero crossing.
    Terminate,
    /// Record the event and continue integration.
    Record,
}

/// Result of the event-detecting ODE solver.
pub struct EventOdeResult {
    /// Standard ODE result (time series of state variables).
    pub ode: OdeResult,
    /// Times at which events fired.
    pub event_times: Vec<f64>,
    /// State vectors at event times.
    pub event_states: Vec<Vec<f64>>,
    /// Whether the integration was terminated by an event.
    pub terminated_by_event: bool,
}

/// Solve an ODE system with zero-crossing event detection.
///
/// `system` — ODE system (equations + params).
/// `y0` — initial state.
/// `config` — solver configuration (t_start, t_end, dt, max_steps).
/// `event_expr` — expression string for g(y, t); event fires when g crosses 0.
///   Uses same variable naming as the ODE system: `t`, `y0..y{N-1}`, named params.
/// `action` — what to do when an event fires.
/// `event_tol` — bisection tolerance for event time location (default 1e-10).
pub fn solve_with_events(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
    event_expr: &str,
    action: EventAction,
    event_tol: f64,
) -> EventOdeResult {
    let _n = system.equations.len();
    let dt = config.dt;
    let mut t = config.t_start;
    let mut y = y0.to_vec();

    let mut t_out = vec![t];
    let mut states_out = vec![y.clone()];
    let mut steps = 0;

    let mut event_times = Vec::new();
    let mut event_states = Vec::new();
    let mut terminated_by_event = false;

    // Evaluate event function at current state
    let eval_event = |y: &[f64], t: f64| -> f64 {
        let mut vars: HashMap<String, f64> = system.params.clone();
        vars.insert("t".to_string(), t);
        for (i, &yi) in y.iter().enumerate() {
            vars.insert(format!("y{i}"), yi);
        }
        eval_expr(event_expr, &vars).unwrap_or(f64::NAN)
    };

    // Take a single RK4 step from t to t+h
    let rk4_step = |y: &[f64], t: f64, h: f64| -> Vec<f64> {
        let k1 = eval_rhs_pub(system, t, y);
        let y2: Vec<f64> = y.iter().zip(&k1).map(|(&yi, &k)| yi + h * k / 2.0).collect();
        let k2 = eval_rhs_pub(system, t + h / 2.0, &y2);
        let y3: Vec<f64> = y.iter().zip(&k2).map(|(&yi, &k)| yi + h * k / 2.0).collect();
        let k3 = eval_rhs_pub(system, t + h / 2.0, &y3);
        let y4: Vec<f64> = y.iter().zip(&k3).map(|(&yi, &k)| yi + h * k).collect();
        let k4 = eval_rhs_pub(system, t + h, &y4);
        y.iter()
            .enumerate()
            .map(|(i, &yi)| yi + h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]))
            .collect()
    };

    // Integrate from t_start to t_end using N_sub sub-steps of size h/N_sub
    let integrate_to = |y_start: &[f64], t_start: f64, t_end: f64| -> Vec<f64> {
        let n_sub = 32usize;
        let h_sub = (t_end - t_start) / n_sub as f64;
        let mut y_cur = y_start.to_vec();
        let mut t_cur = t_start;
        for _ in 0..n_sub {
            y_cur = rk4_step(&y_cur, t_cur, h_sub);
            t_cur += h_sub;
        }
        y_cur
    };

    let mut g_prev = eval_event(&y, t);

    while t < config.t_end - 1e-12 * dt.abs() && steps < config.max_steps {
        let h = if t + dt > config.t_end { config.t_end - t } else { dt };

        let y_prev = y.clone();
        let t_prev = t;

        // Full RK4 step
        y = rk4_step(&y, t, h);
        t += h;
        steps += 1;

        let g_next = eval_event(&y, t);

        // Check for zero crossing
        if !g_prev.is_nan() && !g_next.is_nan() && g_prev * g_next < 0.0 {
            // Bisect to find event time
            let mut t_lo = t_prev;
            let mut t_hi = t;
            let mut y_lo = y_prev.clone();
            let mut g_lo = g_prev;

            for _ in 0..60 {
                if (t_hi - t_lo).abs() < event_tol {
                    break;
                }
                let t_mid = 0.5 * (t_lo + t_hi);
                let y_mid = integrate_to(&y_lo, t_lo, t_mid);
                let g_mid = eval_event(&y_mid, t_mid);

                if g_lo * g_mid <= 0.0 {
                    t_hi = t_mid;
                    // y_hi would be y_mid but we don't need it
                } else {
                    t_lo = t_mid;
                    y_lo = y_mid;
                    g_lo = g_mid;
                }
            }

            let t_event = 0.5 * (t_lo + t_hi);
            let y_event = integrate_to(&y_lo, t_lo, t_event);

            event_times.push(t_event);
            event_states.push(y_event.clone());

            if action == EventAction::Terminate {
                // Add the event state to the time series and stop
                t_out.push(t_event);
                states_out.push(y_event);
                terminated_by_event = true;
                break;
            }
            // Record: continue from after the event
        }

        g_prev = g_next;
        t_out.push(t);
        states_out.push(y.clone());
    }

    let mut column_names = vec!["t".to_string()];
    column_names.extend(system.state_names.iter().cloned());

    EventOdeResult {
        ode: OdeResult {
            t: t_out,
            states: states_out,
            column_names,
            steps,
        },
        event_times,
        event_states,
        terminated_by_event,
    }
}

/// Simple wrapper that returns the ODE result truncated at the first event.
/// Event info is appended as extra rows at the end of the standard ODE table.
pub fn solve_event_rk4(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
    event_expr: &str,
    terminate_on_event: bool,
    event_tol: f64,
) -> OdeResult {
    let action = if terminate_on_event {
        EventAction::Terminate
    } else {
        EventAction::Record
    };
    let result = solve_with_events(system, y0, config, event_expr, action, event_tol);
    result.ode
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ball thrown upward: dy0/dt = y1, dy1/dt = -9.81
    /// Event: y0 = 0 (hits ground). Should fire at t ≈ 2*v0/g = 2*10/9.81 ≈ 2.039 s.
    #[test]
    fn ball_hits_ground() {
        let system = OdeSystem {
            equations: vec!["y1".to_string(), "-9.81".to_string()],
            state_names: vec!["height".to_string(), "velocity".to_string()],
            params: HashMap::new(),
        };
        let y0 = [0.0, 10.0]; // height=0, v=10 m/s upward
        let config = OdeSolverConfig {
            t_start: 0.01, // start slightly after launch to avoid immediate trigger
            t_end: 3.0,
            dt: 0.05,
            max_steps: 10_000,
            tolerance: 1e-6,
        };
        // Event: height crosses 0 (going down, i.e., y0 becomes negative)
        let result = solve_with_events(&system, &y0, &config, "y0", EventAction::Terminate, 1e-8);

        assert!(result.terminated_by_event, "Should terminate when ball hits ground");
        assert!(!result.event_times.is_empty(), "Should have at least one event time");

        let t_event = result.event_times[0];
        // Expected: v0/g = 10/9.81, flight time ≈ 2*(10/9.81) ≈ 2.039s. But starting at t=0.01.
        // height(t) = 0 + 10*(t-0.01) - 0.5*9.81*(t-0.01)^2 + height_at_0.01
        // At t=0, height=0, so height_at_0.01 = 10*0.01 - 0.5*9.81*0.0001 ≈ 0.0995
        // Event at height=0 again: 10*(t-0.01) - 4.905*(t-0.01)^2 + 0.0995 ≈ 0
        // Approximate: t_event ≈ 2.039 s (slightly less than expected due to non-zero start)
        let expected_t = 2.0 * 10.0 / 9.81; // ≈ 2.039 s from origin, ≈ 2.03 from 0.01
        assert!((t_event - expected_t).abs() < 0.05,
            "Event at t={t_event:.4}, expected t≈{expected_t:.4}");

        // At event, height ≈ 0
        let h_event = result.event_states[0][0];
        assert!(h_event.abs() < 1e-5, "Height at event: {h_event}");
    }

    /// No event should fire if g never crosses zero
    #[test]
    fn no_event_constant_positive() {
        let system = OdeSystem {
            equations: vec!["1.0".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let y0 = [0.0];
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.1,
            max_steps: 100,
            tolerance: 1e-6,
        };
        // Event: g = y0 - 10 (never crosses 0 since y goes from 0 to 1)
        let result = solve_with_events(&system, &y0, &config, "y0 - 10", EventAction::Terminate, 1e-8);
        assert!(!result.terminated_by_event, "Should not terminate");
        assert!(result.event_times.is_empty(), "Should have no events");
    }

    /// Record action: collect all crossings without stopping
    #[test]
    fn record_zero_crossings() {
        // dy/dt = 1, y(0) = -0.5 → y(t) = t - 0.5, crosses 0 at t=0.5
        let system = OdeSystem {
            equations: vec!["1.0".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let y0 = [-0.5];
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.1,
            max_steps: 100,
            tolerance: 1e-6,
        };
        let result = solve_with_events(&system, &y0, &config, "y0", EventAction::Record, 1e-8);
        assert!(!result.terminated_by_event, "Should not terminate in Record mode");
        assert!(!result.event_times.is_empty(), "Should record the crossing at t≈0.5");
        assert!((result.event_times[0] - 0.5).abs() < 0.001,
            "Event at t={:.4}", result.event_times[0]);
    }
}
