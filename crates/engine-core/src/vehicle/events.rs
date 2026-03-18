//! Vehicle event / manoeuvre generators (item 2.81).
//!
//! Each function produces a time-series table of steering, throttle, and brake
//! inputs for full-vehicle simulation:
//! - Columns: `t`, `steer_angle` (rad), `throttle` (0-1), `brake` (0-1)
//!
//! References:
//! - ISO 3888-2:2011 — Double Lane Change
//! - ISO 7401:2011 — Step Steer Response

use crate::types::Value;

/// Build a `Value::Table` with columns \[t, steer_angle, throttle, brake\].
fn build_event_table(t: Vec<f64>, steer: Vec<f64>, throttle: Vec<f64>, brake: Vec<f64>) -> Value {
    let n = t.len();
    let rows: Vec<Vec<f64>> = (0..n)
        .map(|i| vec![t[i], steer[i], throttle[i], brake[i]])
        .collect();
    Value::Table {
        columns: vec!["t".into(), "steer_angle".into(), "throttle".into(), "brake".into()],
        rows,
    }
}

/// **Step Steer**: ramp steer from 0 to `target_angle` (rad) over `ramp_time` seconds.
///
/// - `t_start`: time of steer initiation (s)
/// - `ramp_time`: ramp duration (s), 0 = instant step
/// - `target_angle`: final steer angle (rad), positive = left
/// - `t_end`: total event duration (s)
/// - `dt`: timestep (s)
/// - `throttle`: constant throttle during event (0-1)
pub fn step_steer(
    t_start: f64,
    ramp_time: f64,
    target_angle: f64,
    t_end: f64,
    dt: f64,
    throttle: f64,
) -> Value {
    let n = ((t_end / dt).ceil() as usize).max(2);
    let dt_h = t_end / n as f64;
    let (mut t_vec, mut steer_vec, mut thr_vec, mut brake_vec) =
        (Vec::with_capacity(n + 1), Vec::with_capacity(n + 1), Vec::with_capacity(n + 1), Vec::with_capacity(n + 1));

    for i in 0..=n {
        let t = i as f64 * dt_h;
        let steer = if t < t_start {
            0.0
        } else if ramp_time <= 0.0 {
            target_angle
        } else {
            (target_angle * ((t - t_start) / ramp_time)).min(target_angle.abs()) * target_angle.signum()
        };
        t_vec.push(t);
        steer_vec.push(steer);
        thr_vec.push(throttle);
        brake_vec.push(0.0);
    }
    build_event_table(t_vec, steer_vec, thr_vec, brake_vec)
}

/// **Sinusoidal Steer** (frequency sweep): steer = A·sin(2π·f·t), with linear frequency ramp.
///
/// - `amplitude`: peak steer angle (rad)
/// - `f_start`, `f_end`: start/end frequency (Hz)
/// - `t_end`, `dt`: total duration and timestep (s)
/// - `throttle`: constant throttle (0-1)
pub fn sine_steer_sweep(
    amplitude: f64,
    f_start: f64,
    f_end: f64,
    t_end: f64,
    dt: f64,
    throttle: f64,
) -> Value {
    let n = ((t_end / dt).ceil() as usize).max(2);
    let dt_h = t_end / n as f64;
    let (mut t_vec, mut steer_vec, mut thr_vec, mut brake_vec) =
        (Vec::with_capacity(n + 1), Vec::with_capacity(n + 1), Vec::with_capacity(n + 1), Vec::with_capacity(n + 1));

    for i in 0..=n {
        let t = i as f64 * dt_h;
        // Linear chirp: instantaneous frequency f(t) = f_start + (f_end - f_start)*t/t_end
        // Phase: integral of 2π·f(t) dt = 2π·[f_start·t + (f_end-f_start)·t²/(2·t_end)]
        let phase = 2.0 * std::f64::consts::PI * (f_start * t + (f_end - f_start) * t * t / (2.0 * t_end.max(1e-9)));
        let steer = amplitude * phase.sin();
        t_vec.push(t);
        steer_vec.push(steer);
        thr_vec.push(throttle);
        brake_vec.push(0.0);
    }
    build_event_table(t_vec, steer_vec, thr_vec, brake_vec)
}

/// **ISO 3888-2 Double Lane Change**: approximate steer profile.
///
/// The ISO 3888-2 (avoidance manoeuvre) steer profile is approximated by two
/// consecutive half-sine pulses of opposite sign, representing the initial swerve and
/// recovery. Timings are scaled by vehicle speed to match the standard corridor geometry.
///
/// - `v_kmh`: entry speed (km/h) — used to scale manoeuvre duration
/// - `amplitude`: peak steer angle (rad), typically ±0.1–0.3 rad
/// - `dt`: timestep (s)
pub fn iso_lane_change(v_kmh: f64, amplitude: f64, dt: f64) -> Value {
    let v_ms = v_kmh / 3.6;
    // ISO 3888-2 gate positions: ~12m + ~13.5m + ~12m at 80 km/h ≈ 37.5m
    // Duration estimate: 37.5 m / v_ms
    let t_total = (37.5 / v_ms.max(1.0)).max(2.0);
    let n = ((t_total / dt).ceil() as usize).max(4);
    let dt_h = t_total / n as f64;

    let (mut t_vec, mut steer_vec, mut thr_vec, mut brake_vec) = (
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
    );

    // Phase 1: initial swerve — first half of total duration, positive steer
    // Phase 2: recovery — second half, negative steer
    let t1 = t_total * 0.45; // swerve
    let t2 = t_total * 0.55; // transition
    let t3 = t_total;        // recovery end

    for i in 0..=n {
        let t = i as f64 * dt_h;
        let steer = if t <= t1 {
            amplitude * (std::f64::consts::PI * t / t1).sin()
        } else if t <= t2 {
            0.0
        } else {
            -amplitude * (std::f64::consts::PI * (t - t2) / (t3 - t2)).sin()
        };
        t_vec.push(t);
        steer_vec.push(steer);
        thr_vec.push(0.5); // steady partial throttle
        brake_vec.push(0.0);
    }
    build_event_table(t_vec, steer_vec, thr_vec, brake_vec)
}

/// **Brake in Turn**: Combined braking with constant steer angle.
///
/// - `steer_angle`: constant steer angle during manoeuvre (rad)
/// - `brake_ramp_time`: time over which brake builds to full (s)
/// - `t_brake_start`: when braking begins (s)
/// - `t_end`, `dt`: total duration / timestep (s)
/// - `throttle_before`: throttle applied before brake event
pub fn brake_in_turn(
    steer_angle: f64,
    brake_ramp_time: f64,
    t_brake_start: f64,
    t_end: f64,
    dt: f64,
    throttle_before: f64,
) -> Value {
    let n = ((t_end / dt).ceil() as usize).max(2);
    let dt_h = t_end / n as f64;
    let (mut t_vec, mut steer_vec, mut thr_vec, mut brake_vec) = (
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
        Vec::with_capacity(n + 1),
    );

    for i in 0..=n {
        let t = i as f64 * dt_h;
        let brake = if t < t_brake_start {
            0.0
        } else if brake_ramp_time <= 0.0 {
            1.0
        } else {
            ((t - t_brake_start) / brake_ramp_time).min(1.0)
        };
        let throttle = if t < t_brake_start { throttle_before } else { 0.0 };
        t_vec.push(t);
        steer_vec.push(steer_angle);
        thr_vec.push(throttle);
        brake_vec.push(brake);
    }
    build_event_table(t_vec, steer_vec, thr_vec, brake_vec)
}

/// **Constant Radius**: constant steer angle (steady-state circular) with constant throttle.
///
/// - `steer_angle`: steer angle (rad)
/// - `throttle`: throttle (0-1)
/// - `t_end`, `dt`: duration / timestep (s)
pub fn constant_radius(steer_angle: f64, throttle: f64, t_end: f64, dt: f64) -> Value {
    let n = ((t_end / dt).ceil() as usize).max(2);
    let dt_h = t_end / n as f64;
    let t_vec: Vec<f64> = (0..=n).map(|i| i as f64 * dt_h).collect();
    let steer_vec = vec![steer_angle; n + 1];
    let thr_vec = vec![throttle; n + 1];
    let brake_vec = vec![0.0; n + 1];
    build_event_table(t_vec, steer_vec, thr_vec, brake_vec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_steer_reaches_target() {
        let v = step_steer(0.5, 0.1, 0.2, 3.0, 0.01, 0.5);
        if let Value::Table { rows, .. } = v {
            let last = rows.last().unwrap();
            assert!((last[1] - 0.2).abs() < 0.01, "Final steer should be ~0.2 rad");
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn iso_lane_change_output_shape() {
        let v = iso_lane_change(80.0, 0.15, 0.01);
        if let Value::Table { columns, rows } = v {
            assert_eq!(columns.len(), 4);
            assert!(rows.len() > 10);
        } else {
            panic!("Expected Table");
        }
    }

    #[test]
    fn brake_in_turn_ramps() {
        let v = brake_in_turn(0.1, 0.5, 1.0, 3.0, 0.01, 0.7);
        if let Value::Table { rows, .. } = v {
            // At t=1.0, brake should be 0; at t=1.5 should be 1.0
            let row_at_1s = rows.iter().find(|r| r[0] >= 0.99 && r[0] <= 1.01).unwrap();
            assert!(row_at_1s[3] < 0.05, "Brake should be ~0 at brake start");
        } else {
            panic!("Expected Table");
        }
    }
}
