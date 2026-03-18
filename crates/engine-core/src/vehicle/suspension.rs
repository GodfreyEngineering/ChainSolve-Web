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

// ── Half-Car (4-DOF) ─────────────────────────────────────────────────────────

/// Parameters for a half-car (bicycle model in heave/pitch) suspension model.
///
/// State: [z_s, dz_s, θ, dθ, z_uf, dz_uf, z_ur, dz_ur]
/// z_s = sprung mass heave (m), θ = pitch (rad)
/// z_uf/z_ur = front/rear unsprung heave (m)
#[derive(Debug, Clone)]
pub struct HalfCarParams {
    pub m_s: f64,   // sprung mass (kg)
    pub i_y: f64,   // pitch moment of inertia (kg·m²)
    pub m_uf: f64,  // front unsprung mass (kg)
    pub m_ur: f64,  // rear unsprung mass (kg)
    pub k_sf: f64,  // front spring stiffness (N/m)
    pub c_sf: f64,  // front damping (N·s/m)
    pub k_sr: f64,  // rear spring stiffness (N/m)
    pub c_sr: f64,  // rear damping (N·s/m)
    pub k_tf: f64,  // front tire stiffness (N/m)
    pub k_tr: f64,  // rear tire stiffness (N/m)
    pub a: f64,     // distance CG to front axle (m)
    pub b: f64,     // distance CG to rear axle (m)
}

/// Simple fixed-step RK4 for half-car ODE (8 states).
pub fn half_car_step_response(
    p: &HalfCarParams,
    road_front: f64,
    road_rear: f64,
    t_end: f64,
    dt: f64,
) -> OdeResult {
    let n = ((t_end / dt).ceil() as usize).max(1);
    let dt = t_end / n as f64;
    let mut t = 0.0_f64;
    // state: [z_s, dz_s, theta, dtheta, z_uf, dz_uf, z_ur, dz_ur]
    let mut y = [0.0_f64; 8];
    let mut times = Vec::with_capacity(n + 1);
    let mut states: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
    times.push(t);
    states.push(y.to_vec());

    let ode = |y: &[f64; 8]| -> [f64; 8] {
        let (z_s, dz_s, theta, dtheta, z_uf, dz_uf, z_ur, dz_ur) =
            (y[0], y[1], y[2], y[3], y[4], y[5], y[6], y[7]);
        // Front and rear suspension deflections
        let def_f  = z_s - p.a * theta - z_uf;
        let ddef_f = dz_s - p.a * dtheta - dz_uf;
        let def_r  = z_s + p.b * theta - z_ur;
        let ddef_r = dz_s + p.b * dtheta - dz_ur;
        let f_sf = p.k_sf * def_f + p.c_sf * ddef_f;
        let f_sr = p.k_sr * def_r + p.c_sr * ddef_r;
        let ddz_s = (-f_sf - f_sr) / p.m_s;
        let ddtheta = (p.a * f_sf - p.b * f_sr) / p.i_y;
        let ddz_uf = (f_sf - p.k_tf * (z_uf - road_front)) / p.m_uf;
        let ddz_ur = (f_sr - p.k_tr * (z_ur - road_rear)) / p.m_ur;
        [dz_s, ddz_s, dtheta, ddtheta, dz_uf, ddz_uf, dz_ur, ddz_ur]
    };

    for _ in 0..n {
        let k1 = ode(&y);
        let y2 = std::array::from_fn(|i| y[i] + 0.5 * dt * k1[i]);
        let k2 = ode(&y2);
        let y3 = std::array::from_fn(|i| y[i] + 0.5 * dt * k2[i]);
        let k3 = ode(&y3);
        let y4 = std::array::from_fn(|i| y[i] + dt * k3[i]);
        let k4 = ode(&y4);
        y = std::array::from_fn(|i| y[i] + (dt / 6.0) * (k1[i] + 2.0*k2[i] + 2.0*k3[i] + k4[i]));
        t += dt;
        times.push(t);
        states.push(y.to_vec());
    }

    OdeResult {
        t: times,
        states,
        steps: n,
        column_names: vec![
            "t".into(), "z_body".into(), "dz_body".into(),
            "theta".into(), "dtheta".into(),
            "z_front".into(), "dz_front".into(),
            "z_rear".into(), "dz_rear".into(),
        ],
    }
}

// ── Full Vehicle (7-DOF) ──────────────────────────────────────────────────────

/// 7-DOF full-vehicle suspension model.
///
/// Body DOFs: heave (z_s), pitch (θ_p), roll (θ_r) → 3 DOF
/// Wheel DOFs: front-left (z_fl), front-right (z_fr), rear-left (z_rl), rear-right (z_rr) → 4 DOF
/// State: [z_s, dz_s, θ_p, dθ_p, θ_r, dθ_r, z_fl, dz_fl, z_fr, dz_fr, z_rl, dz_rl, z_rr, dz_rr]
#[derive(Debug, Clone)]
pub struct FullVehicleParams {
    pub m_s: f64,   // sprung mass (kg)
    pub i_pitch: f64, // pitch inertia (kg·m²)
    pub i_roll: f64,  // roll inertia (kg·m²)
    pub m_wfl: f64, pub m_wfr: f64, // front corner unsprung masses (kg)
    pub m_wrl: f64, pub m_wrr: f64, // rear corner unsprung masses (kg)
    pub k_fl: f64, pub c_fl: f64,   // front-left spring/damper
    pub k_fr: f64, pub c_fr: f64,   // front-right spring/damper
    pub k_rl: f64, pub c_rl: f64,   // rear-left spring/damper
    pub k_rr: f64, pub c_rr: f64,   // rear-right spring/damper
    pub k_tf: f64, pub k_tr: f64,   // front/rear tire stiffness
    pub k_arb_f: f64,               // front anti-roll bar stiffness (N/m effective at wheel)
    pub k_arb_r: f64,               // rear anti-roll bar stiffness
    pub a: f64, pub b: f64,         // CG to front/rear axle (m)
    pub tw_f: f64, pub tw_r: f64,   // front/rear half-track (m)
}

impl Default for FullVehicleParams {
    fn default() -> Self {
        FullVehicleParams {
            m_s: 1200.0, i_pitch: 1800.0, i_roll: 500.0,
            m_wfl: 35.0, m_wfr: 35.0, m_wrl: 40.0, m_wrr: 40.0,
            k_fl: 18000.0, c_fl: 1200.0, k_fr: 18000.0, c_fr: 1200.0,
            k_rl: 20000.0, c_rl: 1400.0, k_rr: 20000.0, c_rr: 1400.0,
            k_tf: 160000.0, k_tr: 160000.0,
            k_arb_f: 5000.0, k_arb_r: 3000.0,
            a: 1.35, b: 1.45, tw_f: 0.75, tw_r: 0.75,
        }
    }
}

/// Simulate full vehicle 7-DOF response to four independent road inputs.
pub fn full_vehicle_response(
    p: &FullVehicleParams,
    roads: [f64; 4], // [fl, fr, rl, rr] road heights (m)
    t_end: f64,
    dt: f64,
) -> OdeResult {
    let n = ((t_end / dt).ceil() as usize).max(1);
    let dt_h = t_end / n as f64;
    let mut t = 0.0_f64;
    // 14 states
    let mut y = [0.0_f64; 14];
    let mut times = Vec::with_capacity(n + 1);
    let mut states: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
    times.push(t);
    states.push(y.to_vec());

    let ode = |y: &[f64; 14]| -> [f64; 14] {
        let (z_s, dz_s, tp, dtp, tr, dtr) = (y[0], y[1], y[2], y[3], y[4], y[5]);
        let (z_fl, dz_fl, z_fr, dz_fr) = (y[6], y[7], y[8], y[9]);
        let (z_rl, dz_rl, z_rr, dz_rr) = (y[10], y[11], y[12], y[13]);
        // Body corner positions
        let zc_fl = z_s - p.a*tp + p.tw_f*tr;
        let zc_fr = z_s - p.a*tp - p.tw_f*tr;
        let zc_rl = z_s + p.b*tp + p.tw_r*tr;
        let zc_rr = z_s + p.b*tp - p.tw_r*tr;
        let dzc_fl = dz_s - p.a*dtp + p.tw_f*dtr;
        let dzc_fr = dz_s - p.a*dtp - p.tw_f*dtr;
        let dzc_rl = dz_s + p.b*dtp + p.tw_r*dtr;
        let dzc_rr = dz_s + p.b*dtp - p.tw_r*dtr;
        // ARB forces (act equal and opposite on paired wheels)
        let arb_f = p.k_arb_f * (z_fl - z_fr);
        let arb_r = p.k_arb_r * (z_rl - z_rr);
        // Spring-damper forces
        let f_fl = p.k_fl*(zc_fl - z_fl) + p.c_fl*(dzc_fl - dz_fl) - arb_f;
        let f_fr = p.k_fr*(zc_fr - z_fr) + p.c_fr*(dzc_fr - dz_fr) + arb_f;
        let f_rl = p.k_rl*(zc_rl - z_rl) + p.c_rl*(dzc_rl - dz_rl) - arb_r;
        let f_rr = p.k_rr*(zc_rr - z_rr) + p.c_rr*(dzc_rr - dz_rr) + arb_r;
        // Sprung mass EOM
        let ddz_s  = (-f_fl - f_fr - f_rl - f_rr) / p.m_s;
        let ddtp   = (p.a*(f_fl + f_fr) - p.b*(f_rl + f_rr)) / p.i_pitch;
        let ddtr   = ((-f_fl + f_fr)*p.tw_f + (-f_rl + f_rr)*p.tw_r) / p.i_roll;
        // Unsprung EOM (tire contact forces)
        let ddz_fl = (f_fl - p.k_tf*(z_fl - roads[0])) / p.m_wfl;
        let ddz_fr = (f_fr - p.k_tf*(z_fr - roads[1])) / p.m_wfr;
        let ddz_rl = (f_rl - p.k_tr*(z_rl - roads[2])) / p.m_wrl;
        let ddz_rr = (f_rr - p.k_tr*(z_rr - roads[3])) / p.m_wrr;
        [dz_s, ddz_s, dtp, ddtp, dtr, ddtr,
         dz_fl, ddz_fl, dz_fr, ddz_fr, dz_rl, ddz_rl, dz_rr, ddz_rr]
    };

    for _ in 0..n {
        let k1 = ode(&y);
        let y2 = std::array::from_fn(|i| y[i] + 0.5*dt_h*k1[i]);
        let k2 = ode(&y2);
        let y3 = std::array::from_fn(|i| y[i] + 0.5*dt_h*k2[i]);
        let k3 = ode(&y3);
        let y4 = std::array::from_fn(|i| y[i] + dt_h*k3[i]);
        let k4 = ode(&y4);
        y = std::array::from_fn(|i| y[i] + (dt_h/6.0)*(k1[i]+2.0*k2[i]+2.0*k3[i]+k4[i]));
        t += dt_h;
        times.push(t);
        states.push(y.to_vec());
    }

    OdeResult {
        t: times, states, steps: n,
        column_names: vec![
            "t".into(),
            "z_body".into(), "dz_body".into(),
            "pitch".into(), "dpitch".into(),
            "roll".into(), "droll".into(),
            "z_fl".into(), "dz_fl".into(),
            "z_fr".into(), "dz_fr".into(),
            "z_rl".into(), "dz_rl".into(),
            "z_rr".into(), "dz_rr".into(),
        ],
    }
}

// ── K&C Analysis (item 2.79) ──────────────────────────────────────────────────

/// Simplified kinematic & compliance characteristics from suspension geometry.
///
/// Uses linearised geometry for a double-wishbone (or McPherson) corner.
/// All angles in radians, distances in metres.
pub struct KcResult {
    /// Bump steer gradient (rad/m wheel travel, positive = toe-out for jounce).
    pub bump_steer_grad: f64,
    /// Bump camber gradient (rad/m, positive = more negative camber in jounce).
    pub bump_camber_grad: f64,
    /// Roll centre height (m).
    pub roll_centre_height: f64,
    /// Lateral stiffness (N/m lateral per N lateral applied at contact patch).
    pub lateral_stiffness: f64,
    /// Anti-dive percentage (front axle under braking) or anti-squat (rear under drive).
    pub anti_pct: f64,
}

/// Compute simplified K&C for one suspension corner.
///
/// Inputs:
/// - `a_upper`, `b_upper`: inner and outer hardpoint heights for upper arm (m)
/// - `a_lower`, `b_lower`: inner and outer hardpoint heights for lower arm (m)
/// - `track_half`: half-track at wheel centre (m)
/// - `wheel_rate`: effective wheel rate (N/m)
/// - `toe_link_angle_deg`: toe-link angle from horizontal (deg), positive = angled up toward chassis
/// - `anti_angle_deg`: suspension arm angle from horizontal for anti-dive/squat calculation (deg)
pub fn compute_kc(
    a_upper: f64, b_upper: f64,
    a_lower: f64, b_lower: f64,
    track_half: f64,
    wheel_rate: f64,
    toe_link_angle_deg: f64,
    anti_angle_deg: f64,
) -> KcResult {
    // Instant centre from intersection of upper and lower arm lines
    // Upper arm slope: m_u = (b_upper - a_upper) / track_half
    // Lower arm slope: m_l = (b_lower - a_lower) / track_half
    // IC x (outboard) = 0 (at wheel), IC height from upper arm extrapolation
    // We use the simple formula: IC height = (a_lower*b_upper - b_lower*a_upper) / (track_half*(m_u - m_l) + (b_upper - b_lower - a_upper + a_lower))
    // Simplified: roll centre at height proportional to IC intersection
    let m_u = (b_upper - a_upper) / track_half;
    let m_l = (b_lower - a_lower) / track_half;
    let ic_height = if (m_u - m_l).abs() < 1e-9 {
        (a_upper + a_lower) / 2.0 // parallel arms → IC at infinity, use midpoint approx
    } else {
        (a_lower - a_upper + m_u * track_half) / (m_u - m_l) + a_upper
        // more precisely: solve line intersection
    };
    // Roll centre = line from IC through contact patch, at centreline
    // RC height ≈ ic_height * (track_half - ic_x) / track_half where ic_x is IC lateral position
    // For simplicity: RC ≈ ic_height * (1 - abs(ic_height)/track_half)  (approximate)
    let rc_height = ic_height.max(0.0);

    // Bump steer: toe change per mm of wheel travel
    // Approximate: bump_steer_grad = tan(toe_link_angle_deg in rad) / 1 (unit per m)
    let toe_link_angle_rad = toe_link_angle_deg.to_radians();
    let bump_steer_grad = toe_link_angle_rad.tan();

    // Bump camber: camber change per m of wheel travel ≈ (m_u - m_l) / 2
    let bump_camber_grad = (m_u - m_l).abs();

    // Lateral stiffness: approximately wheel_rate (vertical) × geometry factor
    let lateral_stiffness = wheel_rate * (track_half / (track_half + ic_height.abs().max(0.1)));

    // Anti-dive/squat percentage from suspension arm angle
    let anti_angle_rad = anti_angle_deg.to_radians();
    let anti_pct = anti_angle_rad.tan() * 100.0; // %

    KcResult {
        bump_steer_grad,
        bump_camber_grad,
        roll_centre_height: rc_height,
        lateral_stiffness,
        anti_pct,
    }
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
