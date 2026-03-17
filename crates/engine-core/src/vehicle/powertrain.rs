//! Vehicle powertrain calculations.
//!
//! Torque map interpolation, gear ratios, drivetrain efficiency.

/// Interpolate torque from an RPM-torque lookup table.
/// `curve` is a slice of (rpm, torque) pairs sorted by rpm.
pub fn torque_from_map(rpm: f64, curve: &[(f64, f64)]) -> f64 {
    if curve.is_empty() { return 0.0; }
    if curve.len() == 1 { return curve[0].1; }
    if rpm <= curve[0].0 { return curve[0].1; }
    if rpm >= curve[curve.len() - 1].0 { return curve[curve.len() - 1].1; }

    // Linear interpolation
    for i in 0..curve.len() - 1 {
        let (r0, t0) = curve[i];
        let (r1, t1) = curve[i + 1];
        if rpm >= r0 && rpm <= r1 {
            let frac = (rpm - r0) / (r1 - r0);
            return t0 + frac * (t1 - t0);
        }
    }
    curve[curve.len() - 1].1
}

/// Apply gear ratio: torque_out = torque_in * ratio, rpm_out = rpm_in / ratio.
pub fn gear_ratio(torque_in: f64, rpm_in: f64, ratio: f64) -> (f64, f64) {
    (torque_in * ratio, rpm_in / ratio)
}

/// Apply drivetrain efficiency loss: power_out = power_in * efficiency.
pub fn drivetrain_loss(power_in: f64, efficiency: f64) -> f64 {
    power_in * efficiency
}

/// Wheel speed from RPM, tire radius, and overall gear ratio.
/// v = (rpm * 2π * r) / (60 * ratio)
pub fn wheel_speed(rpm: f64, tire_radius: f64, overall_ratio: f64) -> f64 {
    if overall_ratio.abs() < 1e-15 { return 0.0; }
    (rpm * 2.0 * std::f64::consts::PI * tire_radius) / (60.0 * overall_ratio)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn torque_interpolation() {
        let curve = vec![(1000.0, 100.0), (3000.0, 200.0), (6000.0, 180.0)];
        assert_eq!(torque_from_map(1000.0, &curve), 100.0);
        assert_eq!(torque_from_map(3000.0, &curve), 200.0);
        let t = torque_from_map(2000.0, &curve);
        assert!((t - 150.0).abs() < 1e-10); // Linear interp between 100 and 200
    }

    #[test]
    fn torque_clamp() {
        let curve = vec![(1000.0, 100.0), (6000.0, 180.0)];
        assert_eq!(torque_from_map(500.0, &curve), 100.0); // Below min
        assert_eq!(torque_from_map(7000.0, &curve), 180.0); // Above max
    }

    #[test]
    fn gear_ratio_basic() {
        let (t_out, rpm_out) = gear_ratio(200.0, 6000.0, 3.5);
        assert_eq!(t_out, 700.0);
        assert!((rpm_out - 6000.0 / 3.5).abs() < 1e-10);
    }

    #[test]
    fn wheel_speed_basic() {
        // 3000 RPM, 0.3m radius, overall ratio 10
        let v = wheel_speed(3000.0, 0.3, 10.0);
        let expected = (3000.0 * 2.0 * std::f64::consts::PI * 0.3) / (60.0 * 10.0);
        assert!((v - expected).abs() < 1e-10);
    }
}
