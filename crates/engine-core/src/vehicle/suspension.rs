//! Vehicle suspension models.
//!
//! Quarter-car model (2-DOF):
//!   m_s * x_s'' = -k_s*(x_s - x_u) - c_s*(x_s' - x_u')
//!   m_u * x_u'' = k_s*(x_s - x_u) + c_s*(x_s' - x_u') - k_t*(x_u - x_r)
//!
//! State vector: [x_s, v_s, x_u, v_u] where v = dx/dt.
//!
//! Reference: Dixon, "Suspension Geometry and Computation" (2009).

use crate::ode::types::{OdeResult, OdeSolverConfig, OdeSystem};
use crate::ode::rk45::solve_rk45;
use std::collections::HashMap;

/// Parameters for a quarter-car suspension model.
#[derive(Debug, Clone)]
pub struct QuarterCarParams {
    /// Sprung mass (body) in kg.
    pub m_s: f64,
    /// Unsprung mass (wheel assembly) in kg.
    pub m_u: f64,
    /// Suspension spring stiffness in N/m.
    pub k_s: f64,
    /// Suspension damping coefficient in Ns/m.
    pub c_s: f64,
    /// Tire stiffness in N/m.
    pub k_t: f64,
}

/// Default passenger car quarter-car parameters.
pub const DEFAULT_PASSENGER: QuarterCarParams = QuarterCarParams {
    m_s: 250.0,   // 1/4 of ~1000 kg body
    m_u: 35.0,    // wheel + brake + suspension arm
    k_s: 16000.0, // typical spring rate
    c_s: 1000.0,  // typical damping
    k_t: 160000.0, // tire stiffness
};

/// Simulate a quarter-car suspension response to a step road input.
///
/// `road_step` is the road displacement (m) applied as a step at t=0.
/// Returns a table of [t, x_s, v_s, x_u, v_u] over time.
pub fn quarter_car_step_response(
    params: &QuarterCarParams,
    road_step: f64,
    t_end: f64,
    dt: f64,
) -> OdeResult {
    // State: y0 = x_s, y1 = v_s, y2 = x_u, y3 = v_u
    // dy0/dt = y1
    // dy1/dt = (-k_s*(y0-y2) - c_s*(y1-y3)) / m_s
    // dy2/dt = y3
    // dy3/dt = (k_s*(y0-y2) + c_s*(y1-y3) - k_t*(y2-road)) / m_u

    let mut params_map = HashMap::new();
    params_map.insert("m_s".to_string(), params.m_s);
    params_map.insert("m_u".to_string(), params.m_u);
    params_map.insert("k_s".to_string(), params.k_s);
    params_map.insert("c_s".to_string(), params.c_s);
    params_map.insert("k_t".to_string(), params.k_t);
    params_map.insert("road".to_string(), road_step);

    let system = OdeSystem {
        equations: vec![
            "y1".to_string(),
            "(-k_s * (y0 - y2) - c_s * (y1 - y3)) / m_s".to_string(),
            "y3".to_string(),
            "(k_s * (y0 - y2) + c_s * (y1 - y3) - k_t * (y2 - road)) / m_u".to_string(),
        ],
        state_names: vec![
            "x_sprung".to_string(),
            "v_sprung".to_string(),
            "x_unsprung".to_string(),
            "v_unsprung".to_string(),
        ],
        params: params_map,
    };

    let config = OdeSolverConfig {
        t_start: 0.0,
        t_end,
        dt,
        tolerance: 1e-6,
        max_steps: 100_000,
    };

    solve_rk45(&system, &[0.0, 0.0, 0.0, 0.0], &config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quarter_car_settles() {
        let result = quarter_car_step_response(&DEFAULT_PASSENGER, 0.05, 2.0, 0.01);
        assert!(result.steps > 0);

        // After 2 seconds, the system should have settled near the road step
        let final_state = result.states.last().unwrap();
        let x_s_final = final_state[0];
        let v_s_final = final_state[1];

        // Sprung mass should settle near the road input (0.05m)
        assert!(
            (x_s_final - 0.05).abs() < 0.01,
            "x_s should settle near 0.05m, got {}",
            x_s_final
        );
        // Velocity should be near zero (settled)
        assert!(
            v_s_final.abs() < 0.01,
            "v_s should be near zero, got {}",
            v_s_final
        );
    }

    #[test]
    fn quarter_car_oscillates() {
        // With low damping, should see oscillation
        let params = QuarterCarParams {
            m_s: 250.0,
            m_u: 35.0,
            k_s: 16000.0,
            c_s: 100.0, // Very low damping
            k_t: 160000.0,
        };
        let result = quarter_car_step_response(&params, 0.05, 1.0, 0.005);

        // Check that x_s overshoots the road input (oscillation)
        let max_x_s = result
            .states
            .iter()
            .map(|s| s[0])
            .fold(f64::NEG_INFINITY, f64::max);
        assert!(
            max_x_s > 0.05,
            "With low damping, x_s should overshoot 0.05m, max was {}",
            max_x_s
        );
    }
}
