//! Types for ODE solvers.

use std::collections::HashMap;

/// Definition of an ODE system: dy/dt = f(t, y, params).
///
/// Each equation is a string expression (parsed by `expr::eval_expr`)
/// where `t` is the time variable, `y0`..`yN` are state variables,
/// and params are named constants.
#[derive(Debug, Clone)]
pub struct OdeSystem {
    /// Expression strings for each state derivative: dy_i/dt = equations[i].
    /// Variables available: `t`, `y0`, `y1`, ..., `yN`, plus any params.
    pub equations: Vec<String>,
    /// Names for each state variable (for output table column headers).
    pub state_names: Vec<String>,
    /// Named constant parameters available in expressions.
    pub params: HashMap<String, f64>,
}

/// Configuration for an ODE solver run.
#[derive(Debug, Clone)]
pub struct OdeSolverConfig {
    /// Start time.
    pub t_start: f64,
    /// End time.
    pub t_end: f64,
    /// Step size (for fixed-step solvers like RK4).
    pub dt: f64,
    /// Error tolerance (for adaptive solvers like RK45).
    pub tolerance: f64,
    /// Maximum number of steps (safety limit).
    pub max_steps: usize,
}

impl Default for OdeSolverConfig {
    fn default() -> Self {
        Self {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.01,
            tolerance: 1e-6,
            max_steps: 100_000,
        }
    }
}

/// Result of an ODE solver run: time series of state variables.
#[derive(Debug, Clone)]
pub struct OdeResult {
    /// Time values at each step.
    pub t: Vec<f64>,
    /// State values at each step. `states[i]` is the vector of state
    /// variable values at time `t[i]`.
    pub states: Vec<Vec<f64>>,
    /// Column names: ["t", state_names[0], state_names[1], ...]
    pub column_names: Vec<String>,
    /// Number of steps taken.
    pub steps: usize,
}
