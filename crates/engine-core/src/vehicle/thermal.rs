//! Vehicle brake thermal model.
//!
//! dT/dt = (P_brake - h*A*(T - T_amb)) / (m*c)
//!
//! Models brake disc temperature rise from braking power input
//! and convective cooling.

/// Brake disc temperature derivative.
/// P_brake = braking power (W), h = convective coefficient (W/m²K),
/// area = disc surface area (m²), t_disc = current temp (K),
/// t_amb = ambient temp (K), mass = disc mass (kg), specific_heat = J/(kg·K).
pub fn brake_temp_derivative(
    p_brake: f64,
    h: f64,
    area: f64,
    t_disc: f64,
    t_amb: f64,
    mass: f64,
    specific_heat: f64,
) -> f64 {
    let q_cool = h * area * (t_disc - t_amb);
    (p_brake - q_cool) / (mass * specific_heat)
}

/// Braking energy for a speed change: E = 0.5 * m * (v1² - v2²).
pub fn brake_energy(mass: f64, v1: f64, v2: f64) -> f64 {
    0.5 * mass * (v1 * v1 - v2 * v2)
}

/// Braking power over a time interval: P = E / dt.
pub fn brake_power(energy: f64, dt: f64) -> f64 {
    if dt.abs() < 1e-15 { 0.0 } else { energy / dt }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn energy_basic() {
        // 1500 kg car from 30 m/s to 0
        let e = brake_energy(1500.0, 30.0, 0.0);
        assert!((e - 675000.0).abs() < 1.0); // 0.5 * 1500 * 900 = 675 kJ
    }

    #[test]
    fn power_basic() {
        let p = brake_power(675000.0, 5.0); // 675 kJ over 5 seconds
        assert!((p - 135000.0).abs() < 1.0); // 135 kW
    }

    #[test]
    fn temp_rises_under_braking() {
        // Braking power heats disc, no cooling yet (h=0)
        let dt_dt = brake_temp_derivative(
            10000.0,  // 10 kW braking
            0.0,      // no cooling
            0.1,      // area
            300.0,    // current temp (K)
            300.0,    // ambient
            5.0,      // 5 kg disc
            500.0,    // cast iron specific heat
        );
        assert!(dt_dt > 0.0, "Temperature should rise: {}", dt_dt);
        assert!((dt_dt - 4.0).abs() < 0.01); // 10000 / (5 * 500) = 4 K/s
    }

    #[test]
    fn temp_cools_without_braking() {
        // No braking, disc hotter than ambient → cooling
        let dt_dt = brake_temp_derivative(
            0.0,      // no braking
            50.0,     // convective coefficient
            0.1,      // area
            500.0,    // hot disc
            300.0,    // ambient
            5.0,
            500.0,
        );
        assert!(dt_dt < 0.0, "Temperature should drop: {}", dt_dt);
    }
}
