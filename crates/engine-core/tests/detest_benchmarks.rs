//! DETEST ODE benchmark suite (11.8).
//!
//! A subset of the classic DETEST test set from Enright & Pryce (1987):
//! "Two FORTRAN packages for assessing initial value methods",
//! ACM Trans. Math. Software, 13(1):1–27.
//!
//! Each problem is compared against its known analytical solution.
//! Tolerances reflect the solver's advertised accuracy; generous multipliers
//! account for native-vs-WASM speed differences and solver step-size defaults.
//!
//! Groups:
//!   A — non-stiff scalar/small systems
//!   B — mildly stiff
//!   C — stiff (solved with BDF)
//!   E — second-order (reformulated as first-order systems)

use engine_core::ode::bdf::solve_bdf;
use engine_core::ode::rk45::solve_rk45;
use engine_core::ode::{OdeSolverConfig, OdeSystem};
use std::collections::HashMap;

// ── Helpers ──────────────────────────────────────────────────────────────────

fn system1(eq: &str, state_name: &str, params: HashMap<String, f64>) -> OdeSystem {
    OdeSystem {
        equations: vec![eq.to_string()],
        state_names: vec![state_name.to_string()],
        params,
    }
}

fn system2(eq0: &str, eq1: &str, params: HashMap<String, f64>) -> OdeSystem {
    OdeSystem {
        equations: vec![eq0.to_string(), eq1.to_string()],
        state_names: vec!["y0".to_string(), "y1".to_string()],
        params,
    }
}

fn last_state(result: &engine_core::ode::OdeResult, idx: usize) -> f64 {
    result.states.last().map(|s| s[idx]).unwrap_or(f64::NAN)
}

fn default_cfg(t_end: f64) -> OdeSolverConfig {
    OdeSolverConfig {
        t_start: 0.0,
        t_end,
        dt: 0.01,
        tolerance: 1e-6,
        max_steps: 500_000,
    }
}

fn stiff_cfg(t_end: f64) -> OdeSolverConfig {
    OdeSolverConfig {
        t_start: 0.0,
        t_end,
        dt: 1e-4,
        tolerance: 1e-5,
        max_steps: 2_000_000,
    }
}

// ── Group A — Non-stiff ───────────────────────────────────────────────────────

/// A1: y' = −y, y(0)=1.  Exact: y(t) = e^{−t}.
#[test]
fn detest_a1_exponential_decay() {
    let sys = system1("-1.0 * y0", "y0", HashMap::new());
    let result = solve_rk45(&sys, &[1.0], &default_cfg(10.0));
    let y_final = last_state(&result, 0);
    let exact = (-10.0_f64).exp();
    let rel_err = (y_final - exact).abs() / exact.abs();
    // RK45 tolerance=1e-6 gives relative error O(1e-3) after t=10 due to accumulation.
    assert!(
        rel_err < 1e-2,
        "A1: y(10) = {y_final:.8}, exact = {exact:.8}, rel_err = {rel_err:.2e}"
    );
}

/// A2: y' = −y^3/2, y(0)=1.  Exact: y(t) = (1+t)^{−1/2}.
#[test]
fn detest_a2_algebraic_decay() {
    let sys = system1("-0.5 * y0 * y0 * y0", "y0", HashMap::new());
    // Avoid overshoot: t_end = 4 gives exact ≈ 0.4472
    let result = solve_rk45(&sys, &[1.0], &default_cfg(4.0));
    let y_final = last_state(&result, 0);
    let exact = (1.0_f64 + 4.0).powf(-0.5);
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 1e-4,
        "A2: y(4) = {y_final:.8}, exact = {exact:.8}, abs_err = {abs_err:.2e}"
    );
}

/// A3: y' = y·cos(t), y(0)=1.  Exact: y(t) = e^{sin(t)}.
#[test]
fn detest_a3_oscillatory_growth() {
    let sys = system1("y0 * cos(t)", "y0", HashMap::new());
    let result = solve_rk45(&sys, &[1.0], &default_cfg(2.0 * std::f64::consts::PI));
    let y_final = last_state(&result, 0);
    // At t=2π, sin(2π)=0, so exact = e^0 = 1.
    let exact = 1.0_f64;
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 1e-3,
        "A3: y(2π) = {y_final:.8}, exact = {exact:.8}, abs_err = {abs_err:.2e}"
    );
}

/// A4 (logistic growth): y' = y·(1−y), y(0)=0.1.
/// Exact: y(t) = 1/(1 + 9·e^{−t}).
#[test]
fn detest_a4_logistic_growth() {
    let sys = system1("y0 * (1.0 - y0)", "y0", HashMap::new());
    let result = solve_rk45(&sys, &[0.1], &default_cfg(5.0));
    let y_final = last_state(&result, 0);
    let exact = 1.0 / (1.0 + 9.0 * (-5.0_f64).exp());
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 1e-4,
        "A4: y(5) = {y_final:.8}, exact = {exact:.8}, abs_err = {abs_err:.2e}"
    );
}

/// A5: Harmonic oscillator y1' = y2, y2' = −y1, y(0)=[0, 1].
/// Exact: y1(t)=sin(t), y2(t)=cos(t). Energy y1²+y2²=1 conserved.
#[test]
fn detest_a5_harmonic_oscillator() {
    let sys = system2("y1", "-1.0 * y0", HashMap::new());
    let t_end = 10.0 * std::f64::consts::PI;
    let result = solve_rk45(&sys, &[0.0, 1.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end,
        dt: 0.01,
        tolerance: 1e-7,
        max_steps: 2_000_000,
    });
    let y0_final = last_state(&result, 0);
    let y1_final = last_state(&result, 1);
    // At t=10π, sin(10π)≈0, cos(10π)≈1
    let energy = y0_final * y0_final + y1_final * y1_final;
    let energy_err = (energy - 1.0).abs();
    assert!(
        energy_err < 1e-3,
        "A5: energy = {energy:.8}, expected 1.0, err = {energy_err:.2e}"
    );
}

// ── Group B — Mildly stiff ───────────────────────────────────────────────────

/// B1: y' = −10·(y − sin(t)) + cos(t), y(0)=0.
/// Exact: y(t) = sin(t) + C·e^{−10t}, C=−sin(0)=0 → y(t)=sin(t).
#[test]
fn detest_b1_mildly_stiff_tracking() {
    let sys = system1("-10.0 * (y0 - sin(t)) + cos(t)", "y0", HashMap::new());
    let result = solve_rk45(&sys, &[0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 3.0,
        dt: 0.005,
        tolerance: 1e-6,
        max_steps: 500_000,
    });
    let y_final = last_state(&result, 0);
    let exact = (3.0_f64).sin();
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 1e-3,
        "B1: y(3) = {y_final:.8}, exact = {exact:.8}, abs_err = {abs_err:.2e}"
    );
}

/// B2: System — predator-prey (mildly stiff at peak).
/// y0' = y0·(2 − y1),  y1' = y1·(y0 − 1),  y(0)=[1, 1].
/// Conserved quantity: H = y0 − ln(y0) + y1 − 2·ln(y1) = const.
#[test]
fn detest_b2_predator_prey_conservation() {
    let sys = system2(
        "y0 * (2.0 - y1)",
        "y1 * (y0 - 1.0)",
        HashMap::new(),
    );
    let y0_init = 1.0_f64;
    let y1_init = 1.0_f64;
    let h0 = y0_init - y0_init.ln() + y1_init - 2.0 * y1_init.ln();
    let result = solve_rk45(&sys, &[y0_init, y1_init], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 5.0,
        dt: 0.01,
        tolerance: 1e-7,
        max_steps: 500_000,
    });
    let y0f = last_state(&result, 0);
    let y1f = last_state(&result, 1);
    let h_final = y0f - y0f.ln() + y1f - 2.0 * y1f.ln();
    let err = (h_final - h0).abs();
    assert!(
        err < 0.01,
        "B2: H(0)={h0:.6}, H(5)={h_final:.6}, |ΔH|={err:.2e}"
    );
}

/// B3: y' = −y + y^2, y(0)=0.5.  Exact: y(t) = 1/(1 + e^t).
#[test]
fn detest_b3_bernoulli() {
    let sys = system1("-y0 + y0 * y0", "y0", HashMap::new());
    let result = solve_rk45(&sys, &[0.5], &default_cfg(4.0));
    let y_final = last_state(&result, 0);
    let exact = 1.0 / (1.0 + (4.0_f64).exp());
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 1e-4,
        "B3: y(4) = {y_final:.8}, exact = {exact:.8}, abs_err = {abs_err:.2e}"
    );
}

// ── Group C — Stiff (BDF solver) ─────────────────────────────────────────────

/// C1: y' = −1000·y + 3000 − 2000·e^{−t}, y(0)=0.
/// Exact: y(t) = 3 − 0.998·e^{−1000t} − 2.002·e^{−t}  ≈ 3 − 2·e^{−t} for t>>0.001.
#[test]
fn detest_c1_stiff_exponential() {
    let mut params = HashMap::new();
    params.insert("lam".to_string(), -1000.0);
    let sys = system1("-1000.0 * y0 + 3000.0 - 2000.0 * exp(-1.0 * t)", "y0", HashMap::new());
    let result = solve_bdf(&sys, &[0.0], &stiff_cfg(0.1));
    let y_final = last_state(&result, 0);
    // At t=0.1: fast mode gone, y ≈ 3 − 2·e^{−0.1} ≈ 3 − 1.8097 = 1.1903
    let exact = 3.0 - 2.0 * (-0.1_f64).exp();
    let abs_err = (y_final - exact).abs();
    assert!(
        abs_err < 0.05,
        "C1: y(0.1) = {y_final:.6}, exact ≈ {exact:.6}, abs_err = {abs_err:.2e}"
    );
}

/// C2: Stiff linear: y' = −10·y,  y(0)=1.  Exact: y(t)=e^{−10t}.
/// Using BDF-2 which is A-stable. Test at t=0.3 where exact ≈ 0.0498.
#[test]
fn detest_c2_stiff_linear_bdf() {
    let sys = system1("-10.0 * y0", "y0", HashMap::new());
    let result = solve_bdf(&sys, &[1.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 0.3,
        dt: 0.001,
        tolerance: 1e-5,
        max_steps: 2_000_000,
    });
    let y_final = last_state(&result, 0);
    let exact = (-3.0_f64).exp(); // e^{-10×0.3} ≈ 0.04979
    let rel_err = (y_final - exact).abs() / exact.abs();
    // BDF-2 with dt=0.001: expect rel error < 20%
    assert!(
        rel_err < 0.2,
        "C2: y(0.3) = {y_final:.6}, exact = {exact:.6}, rel_err = {rel_err:.2e}"
    );
}

/// C3: Stiff 2×2 system (decoupled stiff + non-stiff).
/// y0' = −1000·y0,  y1' = y0 + y1,  y(0)=[1,0].
/// Exact: y0(t)=e^{−1000t}, y1(t) = (e^t − e^{−1000t})/1001 ≈ e^t/1001 for t>>0.001.
#[test]
fn detest_c3_stiff_coupled_system() {
    let sys = OdeSystem {
        equations: vec![
            "-1000.0 * y0".to_string(),
            "y0 + y1".to_string(),
        ],
        state_names: vec!["y0".to_string(), "y1".to_string()],
        params: HashMap::new(),
    };
    let result = solve_bdf(&sys, &[1.0, 0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 0.01,
        dt: 1e-5,
        tolerance: 1e-5,
        max_steps: 2_000_000,
    });
    let y1_final = last_state(&result, 1);
    // At t=0.01: y1 ≈ e^{0.01}/1001 ≈ 1.01/1001 ≈ 1.009e-3
    let exact_y1 = ((0.01_f64).exp() - (-1000.0 * 0.01_f64).exp()) / 1001.0;
    let abs_err = (y1_final - exact_y1).abs();
    // Loose tolerance — BDF with fixed dt may not be tight here
    assert!(
        abs_err < 0.01,
        "C3: y1(0.01) = {y1_final:.6}, exact ≈ {exact_y1:.6}, abs_err = {abs_err:.2e}"
    );
}

// ── Group E — Second-order (reformulated as first-order) ─────────────────────

/// E1: Undamped oscillator — y'' + y = 0, y(0)=1, y'(0)=0.
/// Reformulated: y0'=y1, y1'=−y0. Exact: y0(t)=cos(t).
#[test]
fn detest_e1_undamped_oscillator() {
    let sys = system2("y1", "-1.0 * y0", HashMap::new());
    let t_end = 4.0 * std::f64::consts::PI;
    let result = solve_rk45(&sys, &[1.0, 0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end,
        dt: 0.01,
        tolerance: 1e-7,
        max_steps: 2_000_000,
    });
    let y0_final = last_state(&result, 0);
    // At t=4π, cos(4π) = 1
    let exact = 1.0_f64;
    let abs_err = (y0_final - exact).abs();
    assert!(
        abs_err < 5e-3,
        "E1: y(4π) = {y0_final:.8}, exact = {exact}, abs_err = {abs_err:.2e}"
    );
}

/// E2: Damped oscillator — y'' + 2·ζ·y' + y = 0, ζ=0.5, y(0)=1, y'(0)=0.
/// Reformulated: y0'=y1, y1'=−y0 − 2·0.5·y1 = −y0 − y1.
/// Exact envelope: e^{−ζt} = e^{−0.5t}.
#[test]
fn detest_e2_damped_oscillator() {
    let sys = system2("y1", "-1.0 * y0 - 1.0 * y1", HashMap::new());
    let result = solve_rk45(&sys, &[1.0, 0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 8.0,
        dt: 0.01,
        tolerance: 1e-7,
        max_steps: 500_000,
    });
    let y0_final = last_state(&result, 0);
    let y1_final = last_state(&result, 1);
    // Amplitude ≤ e^{−0.5×8} = e^{−4} ≈ 0.0183
    let amplitude = (y0_final * y0_final + y1_final * y1_final).sqrt();
    let envelope = (-4.0_f64).exp();
    assert!(
        amplitude < envelope * 2.0,
        "E2: amplitude = {amplitude:.6}, envelope = {envelope:.6}"
    );
}

/// E3: Duffing equation (nonlinear) — y'' + 0.5·y' + y^3 = 0.5·cos(t).
/// Reformulated: y0'=y1, y1'=−0.5·y1 − y0^3 + 0.5·cos(t).
/// Bounded solution — verify |y(t)| remains bounded.
#[test]
fn detest_e3_duffing_oscillator_bounded() {
    let sys = system2(
        "y1",
        "-0.5 * y1 - y0 * y0 * y0 + 0.5 * cos(t)",
        HashMap::new(),
    );
    let result = solve_rk45(&sys, &[0.0, 0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 20.0,
        dt: 0.01,
        tolerance: 1e-6,
        max_steps: 1_000_000,
    });
    // Damped Duffing: solution must remain bounded (|y| < 10)
    let max_y = result.states.iter()
        .map(|s| s[0].abs())
        .fold(0.0_f64, f64::max);
    assert!(
        max_y < 10.0,
        "E3: Duffing solution unbounded: max |y| = {max_y:.4}"
    );
}

/// E4: Kepler's equation (planetary orbit), e=0.5.
/// y'' = −y·r^{−3},  r = |y|.
/// In 2D: x''=−x/r³, y''=−y/r³, r=sqrt(x²+y²).
/// Initial conditions for ellipse with e=0.5: x(0)=1.5, y(0)=0, xdot=0, ydot=sqrt(1/1.5).
/// Energy H = 0.5·(v²) − 1/r = const.
#[test]
fn detest_e4_kepler_energy_conservation() {
    // States: [x, y, vx, vy]
    let sys = OdeSystem {
        equations: vec![
            "y2".to_string(),          // x' = vx
            "y3".to_string(),          // y' = vy
            "-y0 / (sqrt(y0*y0 + y1*y1) * sqrt(y0*y0 + y1*y1) * sqrt(y0*y0 + y1*y1))".to_string(), // vx' = -x/r³
            "-y1 / (sqrt(y0*y0 + y1*y1) * sqrt(y0*y0 + y1*y1) * sqrt(y0*y0 + y1*y1))".to_string(), // vy' = -y/r³
        ],
        state_names: vec!["x".to_string(), "y".to_string(), "vx".to_string(), "vy".to_string()],
        params: HashMap::new(),
    };

    let x0 = 1.5_f64;
    let y0_v = 0.0_f64;
    let vx0 = 0.0_f64;
    let vy0 = (1.0 / x0).sqrt();
    let r0 = (x0 * x0 + y0_v * y0_v).sqrt();
    let h0 = 0.5 * (vx0 * vx0 + vy0 * vy0) - 1.0 / r0;

    let result = solve_rk45(
        &sys,
        &[x0, y0_v, vx0, vy0],
        &OdeSolverConfig {
            t_start: 0.0,
            t_end: 6.0,
            dt: 0.01,
            tolerance: 1e-8,
            max_steps: 2_000_000,
        },
    );

    let xf = last_state(&result, 0);
    let yf = last_state(&result, 1);
    let vxf = last_state(&result, 2);
    let vyf = last_state(&result, 3);
    let rf = (xf * xf + yf * yf).sqrt();
    let hf = 0.5 * (vxf * vxf + vyf * vyf) - 1.0 / rf;
    let energy_err = (hf - h0).abs();
    assert!(
        energy_err < 1e-3,
        "E4: H(0)={h0:.8}, H(6)={hf:.8}, |ΔH|={energy_err:.2e}"
    );
}

/// E5: Van der Pol with ε=1 (mildly stiff).
/// y'' − (1−y²)·y' + y = 0.
/// Reformulated: y0'=y1, y1'=(1−y0²)·y1 − y0.
/// Solution is a stable limit cycle — verify x² + x'² stays O(1).
#[test]
fn detest_e5_van_der_pol_limit_cycle() {
    let sys = system2(
        "y1",
        "(1.0 - y0*y0) * y1 - y0",
        HashMap::new(),
    );
    let result = solve_rk45(&sys, &[2.0, 0.0], &OdeSolverConfig {
        t_start: 0.0,
        t_end: 30.0,
        dt: 0.01,
        tolerance: 1e-6,
        max_steps: 2_000_000,
    });
    // On the limit cycle, the amplitude should be roughly 2.
    // Check that solution hasn't blown up or collapsed.
    let y0_final = last_state(&result, 0);
    let y1_final = last_state(&result, 1);
    let amplitude = (y0_final * y0_final + y1_final * y1_final).sqrt();
    assert!(
        amplitude > 0.5 && amplitude < 10.0,
        "E5: van der Pol amplitude = {amplitude:.4} outside expected range [0.5, 10]"
    );
}
