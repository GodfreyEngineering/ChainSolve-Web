//! Classic 4th-order Runge-Kutta solver (fixed step).
//!
//! Reference: Hairer, Norsett, Wanner "Solving Ordinary Differential Equations I" (1993).
//!
//! For a system dy/dt = f(t, y), the RK4 method advances by:
//!   k1 = f(t, y)
//!   k2 = f(t + h/2, y + h*k1/2)
//!   k3 = f(t + h/2, y + h*k2/2)
//!   k4 = f(t + h, y + h*k3)
//!   y_next = y + h/6 * (k1 + 2*k2 + 2*k3 + k4)

use super::types::{OdeResult, OdeSolverConfig, OdeSystem};
use crate::expr::{eval_expr, compile, CompiledExpr};
use std::collections::HashMap;

/// Pre-compile ODE system equations for fast repeated evaluation.
///
/// Falls back to string evaluation if compilation fails for any equation.
pub fn compile_system(system: &OdeSystem) -> Vec<Option<CompiledExpr>> {
    system.equations.iter().map(|eq| compile(eq).ok()).collect()
}

/// Evaluate the RHS using pre-compiled expressions (fast path).
fn eval_rhs_compiled(
    compiled: &[Option<CompiledExpr>],
    equations: &[String],
    vars: &HashMap<String, f64>,
) -> Vec<f64> {
    compiled.iter().zip(equations.iter()).map(|(c, eq)| {
        match c {
            Some(compiled_eq) => compiled_eq.eval(vars).unwrap_or(f64::NAN),
            None => eval_expr(eq, vars).unwrap_or(f64::NAN),
        }
    }).collect()
}

/// Public eval_rhs for use by other solvers (RK45, BDF) that haven't yet adopted CompiledExpr.
pub fn eval_rhs_pub(system: &OdeSystem, t: f64, y: &[f64]) -> Vec<f64> {
    let n = system.equations.len();
    let mut vars: HashMap<String, f64> = system.params.clone();
    vars.insert("t".to_string(), t);
    for i in 0..n {
        vars.insert(format!("y{}", i), y[i]);
    }

    system
        .equations
        .iter()
        .map(|eq| {
            eval_expr(eq, &vars).unwrap_or(f64::NAN)
        })
        .collect()
}

/// Solve an ODE system using the classic 4th-order Runge-Kutta method.
///
/// Pre-compiles all equations once for fast repeated evaluation (1.29 JIT).
/// Returns a table of (t, y0, y1, ..., yN) at each time step.
pub fn solve_rk4(
    system: &OdeSystem,
    y0: &[f64],
    config: &OdeSolverConfig,
) -> OdeResult {
    let n = system.equations.len();
    assert_eq!(n, y0.len(), "Number of equations must match initial state dimension");

    // Pre-compile equations once (JIT optimisation: avoids re-parsing every step)
    let compiled = compile_system(system);

    let eval = |t: f64, y: &[f64]| -> Vec<f64> {
        let mut vars: HashMap<String, f64> = system.params.clone();
        vars.insert("t".to_string(), t);
        for i in 0..y.len() {
            vars.insert(format!("y{}", i), y[i]);
        }
        eval_rhs_compiled(&compiled, &system.equations, &vars)
    };

    let dt = config.dt;
    let mut t = config.t_start;
    let mut y = y0.to_vec();

    let mut t_out = vec![t];
    let mut states_out = vec![y.clone()];
    let mut steps = 0;

    while t < config.t_end && steps < config.max_steps {
        // Adjust last step to land exactly on t_end
        let h = if t + dt > config.t_end {
            config.t_end - t
        } else {
            dt
        };

        let k1 = eval(t, &y);

        let y_k2: Vec<f64> = y.iter().zip(&k1).map(|(yi, k)| yi + h * k / 2.0).collect();
        let k2 = eval(t + h / 2.0, &y_k2);

        let y_k3: Vec<f64> = y.iter().zip(&k2).map(|(yi, k)| yi + h * k / 2.0).collect();
        let k3 = eval(t + h / 2.0, &y_k3);

        let y_k4: Vec<f64> = y.iter().zip(&k3).map(|(yi, k)| yi + h * k).collect();
        let k4 = eval(t + h, &y_k4);

        // RK4 update: y_next = y + h/6 * (k1 + 2*k2 + 2*k3 + k4)
        for i in 0..n {
            y[i] += h / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }

        t += h;
        steps += 1;
        t_out.push(t);
        states_out.push(y.clone());
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

    #[test]
    fn exponential_growth() {
        // dy/dt = y, y(0) = 1 → y = e^t
        let system = OdeSystem {
            equations: vec!["y0".to_string()],
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.001, // Small step for accuracy
            max_steps: 10000,
            ..Default::default()
        };
        let result = solve_rk4(&system, &[1.0], &config);

        let y_final = result.states.last().unwrap()[0];
        let expected = std::f64::consts::E; // e^1 ≈ 2.71828
        let rel_error = (y_final - expected).abs() / expected;
        assert!(
            rel_error < 1e-8,
            "y(1) = {}, expected {}, relative error = {}",
            y_final,
            expected,
            rel_error
        );
    }

    #[test]
    fn harmonic_oscillator() {
        // x'' = -x → system: dy0/dt = y1, dy1/dt = -y0
        // x(0) = 1, x'(0) = 0 → x(t) = cos(t)
        let system = OdeSystem {
            equations: vec!["y1".to_string(), "-y0".to_string()],
            state_names: vec!["x".to_string(), "v".to_string()],
            params: HashMap::new(),
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: std::f64::consts::PI, // Half period
            dt: 0.001,
            max_steps: 10000,
            ..Default::default()
        };
        let result = solve_rk4(&system, &[1.0, 0.0], &config);

        let x_final = result.states.last().unwrap()[0];
        let expected = -1.0; // cos(π) = -1
        let error = (x_final - expected).abs();
        assert!(
            error < 1e-6,
            "x(π) = {}, expected {}, error = {}",
            x_final,
            expected,
            error
        );

        // Energy conservation: E = x² + v² should be constant ≈ 1
        let v_final = result.states.last().unwrap()[1];
        let energy = x_final * x_final + v_final * v_final;
        assert!(
            (energy - 1.0).abs() < 1e-6,
            "Energy = {}, expected 1.0",
            energy
        );
    }

    #[test]
    fn with_parameters() {
        // dy/dt = k * y, y(0) = 1, k = 2 → y = e^(2t)
        let mut params = HashMap::new();
        params.insert("k".to_string(), 2.0);
        let system = OdeSystem {
            equations: vec!["k * y0".to_string()],
            state_names: vec!["y".to_string()],
            params,
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 0.5,
            dt: 0.001,
            max_steps: 1000,
            ..Default::default()
        };
        let result = solve_rk4(&system, &[1.0], &config);

        let y_final = result.states.last().unwrap()[0];
        let expected = (2.0_f64 * 0.5).exp(); // e^1 ≈ 2.71828
        let rel_error = (y_final - expected).abs() / expected;
        assert!(
            rel_error < 1e-8,
            "y(0.5) = {}, expected {}, rel_error = {}",
            y_final,
            expected,
            rel_error
        );
    }

    #[test]
    fn result_structure() {
        let system = OdeSystem {
            equations: vec!["1.0".to_string()], // constant growth: dy/dt = 1
            state_names: vec!["y".to_string()],
            params: HashMap::new(),
        };
        let config = OdeSolverConfig {
            t_start: 0.0,
            t_end: 1.0,
            dt: 0.1,
            max_steps: 100,
            ..Default::default()
        };
        let result = solve_rk4(&system, &[0.0], &config);

        assert_eq!(result.column_names, vec!["t", "y"]);
        assert!(result.steps > 0);
        assert_eq!(result.t.len(), result.states.len());
        // y(1) = 0 + 1*1 = 1
        let y_final = result.states.last().unwrap()[0];
        assert!((y_final - 1.0).abs() < 1e-10);
    }
}
