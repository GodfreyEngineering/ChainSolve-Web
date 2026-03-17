//! Dormand-Prince RK4(5) adaptive-step ODE solver.
//!
//! An embedded Runge-Kutta pair where the 4th-order solution is used to advance
//! the state and the 5th-order solution provides an error estimate for automatic
//! step size control.
//!
//! Reference: Dormand & Prince, "A Family of Embedded Runge-Kutta Formulae" (1980).
//! This is equivalent to MATLAB's `ode45`.

use super::rk4::eval_rhs_pub;
use super::types::{OdeResult, OdeSolverConfig, OdeSystem};

// ── Dormand-Prince coefficients ─────────────────────────────────────

const A2: f64 = 1.0 / 5.0;
const A3: f64 = 3.0 / 10.0;
const A4: f64 = 4.0 / 5.0;
const A5: f64 = 8.0 / 9.0;

const B21: f64 = 1.0 / 5.0;
const B31: f64 = 3.0 / 40.0;
const B32: f64 = 9.0 / 40.0;
const B41: f64 = 44.0 / 45.0;
const B42: f64 = -56.0 / 15.0;
const B43: f64 = 32.0 / 9.0;
const B51: f64 = 19372.0 / 6561.0;
const B52: f64 = -25360.0 / 2187.0;
const B53: f64 = 64448.0 / 6561.0;
const B54: f64 = -212.0 / 729.0;
const B61: f64 = 9017.0 / 3168.0;
const B62: f64 = -355.0 / 33.0;
const B63: f64 = 46732.0 / 5247.0;
const B64: f64 = 49.0 / 176.0;
const B65: f64 = -5103.0 / 18656.0;

// 4th-order weights (for advancing the solution)
const C1: f64 = 35.0 / 384.0;
const C3: f64 = 500.0 / 1113.0;
const C4: f64 = 125.0 / 192.0;
const C5: f64 = -2187.0 / 6784.0;
const C6: f64 = 11.0 / 84.0;

// 5th-order weights (for error estimation)
const D1: f64 = 5179.0 / 57600.0;
const D3: f64 = 7571.0 / 16695.0;
const D4: f64 = 393.0 / 640.0;
const D5: f64 = -92097.0 / 339200.0;
const D6: f64 = 187.0 / 2100.0;
const D7: f64 = 1.0 / 40.0;

/// Solve an ODE system using the Dormand-Prince RK4(5) adaptive method.
pub fn solve_rk45(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
) -> OdeResult {
    let n = system.equations.len();
    assert_eq!(n, y0.len(), "Equations must match initial state dimension");

    let tol = config.tolerance;
    let mut t = config.t_start;
    let mut y = y0.to_vec();
    let mut h = config.dt; // initial step size guess

    let mut t_out = vec![t];
    let mut states_out = vec![y.clone()];
    let mut steps = 0;

    while t < config.t_end && steps < config.max_steps {
        // Don't overshoot t_end
        if t + h > config.t_end {
            h = config.t_end - t;
        }
        if h < 1e-15 {
            break;
        }

        // Compute 6 stages
        let k1 = eval_rhs_pub(system, t, &y);

        let y2: Vec<f64> = (0..n).map(|i| y[i] + h * B21 * k1[i]).collect();
        let k2 = eval_rhs_pub(system, t + A2 * h, &y2);

        let y3: Vec<f64> = (0..n).map(|i| y[i] + h * (B31 * k1[i] + B32 * k2[i])).collect();
        let k3 = eval_rhs_pub(system, t + A3 * h, &y3);

        let y4: Vec<f64> = (0..n)
            .map(|i| y[i] + h * (B41 * k1[i] + B42 * k2[i] + B43 * k3[i]))
            .collect();
        let k4 = eval_rhs_pub(system, t + A4 * h, &y4);

        let y5: Vec<f64> = (0..n)
            .map(|i| y[i] + h * (B51 * k1[i] + B52 * k2[i] + B53 * k3[i] + B54 * k4[i]))
            .collect();
        let k5 = eval_rhs_pub(system, t + A5 * h, &y5);

        let y6: Vec<f64> = (0..n)
            .map(|i| {
                y[i] + h
                    * (B61 * k1[i] + B62 * k2[i] + B63 * k3[i] + B64 * k4[i] + B65 * k5[i])
            })
            .collect();
        let k6 = eval_rhs_pub(system, t + h, &y6);

        // 4th-order solution (used to advance)
        let y_new: Vec<f64> = (0..n)
            .map(|i| y[i] + h * (C1 * k1[i] + C3 * k3[i] + C4 * k4[i] + C5 * k5[i] + C6 * k6[i]))
            .collect();

        // Compute 7th stage for error estimate
        let k7 = eval_rhs_pub(system, t + h, &y_new);

        // Error estimate: difference between 4th and 5th order solutions
        let err: f64 = (0..n)
            .map(|i| {
                let e = h
                    * ((C1 - D1) * k1[i]
                        + (C3 - D3) * k3[i]
                        + (C4 - D4) * k4[i]
                        + (C5 - D5) * k5[i]
                        + (C6 - D6) * k6[i]
                        - D7 * k7[i]);
                e * e
            })
            .sum::<f64>()
            .sqrt()
            / (n as f64).sqrt();

        if err <= tol || h <= 1e-15 {
            // Accept step
            t += h;
            y = y_new;
            steps += 1;
            t_out.push(t);
            states_out.push(y.clone());
        }

        // Adjust step size: h_new = h * min(5, max(0.2, 0.9 * (tol/err)^(1/5)))
        let factor = if err > 0.0 {
            0.9 * (tol / err).powf(0.2)
        } else {
            5.0
        };
        h *= factor.clamp(0.2, 5.0);
    }

    let mut column_names = vec!["t".to_string()];
    column_names.extend(system.state_names.iter().cloned());

    OdeResult {
        t: t_out,
        states: states_out,
        column_names,
        steps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn exponential_growth_adaptive() {
        let system = OdeSystem {
            equations: vec!["y0".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.1,
            tolerance: 1e-8,
            max_steps: 10000,
        };
        let result = solve_rk45(&system, &[1.0], &config);

        let y_final = result.states.last().unwrap()[0];
        let expected = std::f64::consts::E;
        let rel_error = (y_final - expected).abs() / expected;
        assert!(
            rel_error < 1e-6,
            "y(1) = {}, expected {}, rel_error = {}",
            y_final, expected, rel_error
        );
        // Adaptive solver should use fewer steps than fixed RK4
        assert!(result.steps < 100, "Expected fewer steps, got {}", result.steps);
    }

    #[test]
    fn harmonic_oscillator_adaptive() {
        let system = OdeSystem {
            equations: vec!["y1".to_string(), "-y0".to_string()],
            state_names: vec!["x".to_string(), "v".to_string()],
            params: HashMap::new(),
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 2.0 * std::f64::consts::PI, // Full period
            dt: 0.1,
            tolerance: 1e-8,
            max_steps: 10000,
        };
        let result = solve_rk45(&system, &[1.0, 0.0], &config);

        // After one full period, x should be back to ~1, v back to ~0
        let x_final = result.states.last().unwrap()[0];
        let v_final = result.states.last().unwrap()[1];
        assert!(
            (x_final - 1.0).abs() < 1e-4,
            "x(2π) = {}, expected 1.0",
            x_final
        );
        assert!(
            v_final.abs() < 1e-4,
            "v(2π) = {}, expected 0.0",
            v_final
        );
    }
}
