//! Pacejka Magic Formula tire model.
//!
//! The Magic Formula relates tire force to slip (angle or ratio):
//!   Y(x) = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
//!
//! Where:
//!   Y = force (lateral Fy or longitudinal Fx)
//!   x = slip angle (rad) or slip ratio (dimensionless)
//!   B = stiffness factor
//!   C = shape factor
//!   D = peak value (≈ μ * Fz)
//!   E = curvature factor
//!
//! Reference: Pacejka, "Tire and Vehicle Dynamics" 3rd ed (2012), Chapter 4.

/// Compute tire force using the Pacejka Magic Formula.
///
/// # Arguments
/// * `slip` — slip angle (rad) or slip ratio (dimensionless)
/// * `fz` — normal load (N)
/// * `b` — stiffness factor B
/// * `c` — shape factor C
/// * `d_coeff` — peak factor D (force = d_coeff * fz at peak)
/// * `e` — curvature factor E
///
/// # Returns
/// Force in Newtons.
pub fn pacejka_force(slip: f64, fz: f64, b: f64, c: f64, d_coeff: f64, e: f64) -> f64 {
    let d = d_coeff * fz;
    let bx = b * slip;
    d * (c * (bx - e * (bx - bx.atan())).atan()).sin()
}

/// Compute lateral force Fy from slip angle.
pub fn lateral_force(slip_angle_rad: f64, fz: f64, b: f64, c: f64, d: f64, e: f64) -> f64 {
    pacejka_force(slip_angle_rad, fz, b, c, d, e)
}

/// Compute longitudinal force Fx from slip ratio.
pub fn longitudinal_force(slip_ratio: f64, fz: f64, b: f64, c: f64, d: f64, e: f64) -> f64 {
    pacejka_force(slip_ratio, fz, b, c, d, e)
}

/// Generate a force vs slip sweep table for plotting.
///
/// Returns (slip_values, force_values) for the given range.
pub fn force_sweep(
    fz: f64,
    b: f64,
    c: f64,
    d: f64,
    e: f64,
    slip_min: f64,
    slip_max: f64,
    n_points: usize,
) -> (Vec<f64>, Vec<f64>) {
    let mut slips = Vec::with_capacity(n_points);
    let mut forces = Vec::with_capacity(n_points);
    let step = (slip_max - slip_min) / (n_points as f64 - 1.0);
    for i in 0..n_points {
        let s = slip_min + step * i as f64;
        slips.push(s);
        forces.push(pacejka_force(s, fz, b, c, d, e));
    }
    (slips, forces)
}

/// Preset tire parameters for common tire types.
#[derive(Debug, Clone, Copy)]
pub struct TirePreset {
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
}

/// Sport radial tire preset (typical high-performance road tire).
pub const SPORT_RADIAL: TirePreset = TirePreset {
    b: 10.0,
    c: 1.9,
    d: 1.0,  // μ ≈ 1.0
    e: 0.97,
};

/// Economy radial tire preset.
pub const ECONOMY_RADIAL: TirePreset = TirePreset {
    b: 8.0,
    c: 1.65,
    d: 0.8,
    e: 0.5,
};

/// Slick racing tire preset.
pub const SLICK: TirePreset = TirePreset {
    b: 12.0,
    c: 2.2,
    d: 1.5,  // μ ≈ 1.5
    e: 0.98,
};

/// Wet weather tire preset.
pub const WET_WEATHER: TirePreset = TirePreset {
    b: 7.0,
    c: 1.5,
    d: 0.7,
    e: 0.3,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_slip_zero_force() {
        // At zero slip, force should be zero
        let f = pacejka_force(0.0, 5000.0, 10.0, 1.9, 1.0, 0.97);
        assert!(f.abs() < 1e-10, "Force at zero slip should be ~0, got {}", f);
    }

    #[test]
    fn force_increases_with_slip() {
        let fz = 5000.0;
        let (b, c, d, e) = (10.0, 1.9, 1.0, 0.97);
        let f1 = pacejka_force(0.01, fz, b, c, d, e).abs();
        let f2 = pacejka_force(0.05, fz, b, c, d, e).abs();
        assert!(f2 > f1, "Force should increase with slip: {} > {}", f2, f1);
    }

    #[test]
    fn force_proportional_to_normal_load() {
        let (b, c, d, e) = (10.0, 1.9, 1.0, 0.97);
        let slip = 0.05;
        let f1 = pacejka_force(slip, 3000.0, b, c, d, e);
        let f2 = pacejka_force(slip, 6000.0, b, c, d, e);
        // Should be approximately proportional (D = d * Fz)
        let ratio = f2 / f1;
        assert!(
            (ratio - 2.0).abs() < 0.01,
            "Force ratio should be ~2.0 for double Fz, got {}",
            ratio
        );
    }

    #[test]
    fn antisymmetric() {
        let fz = 5000.0;
        let (b, c, d, e) = (10.0, 1.9, 1.0, 0.97);
        let f_pos = pacejka_force(0.05, fz, b, c, d, e);
        let f_neg = pacejka_force(-0.05, fz, b, c, d, e);
        assert!(
            (f_pos + f_neg).abs() < 1e-10,
            "Pacejka should be antisymmetric: f(α) = -f(-α), got {} + {} = {}",
            f_pos, f_neg, f_pos + f_neg
        );
    }

    #[test]
    fn sweep_generates_correct_points() {
        let (slips, forces) = force_sweep(5000.0, 10.0, 1.9, 1.0, 0.97, -0.2, 0.2, 41);
        assert_eq!(slips.len(), 41);
        assert_eq!(forces.len(), 41);
        // Centre should be zero
        assert!(forces[20].abs() < 1e-10);
    }

    #[test]
    fn presets_give_reasonable_forces() {
        let fz = 4000.0;
        let slip = 0.08; // ~4.6 degrees

        let f_sport = lateral_force(slip, fz, SPORT_RADIAL.b, SPORT_RADIAL.c, SPORT_RADIAL.d, SPORT_RADIAL.e);
        let f_slick = lateral_force(slip, fz, SLICK.b, SLICK.c, SLICK.d, SLICK.e);
        let f_wet = lateral_force(slip, fz, WET_WEATHER.b, WET_WEATHER.c, WET_WEATHER.d, WET_WEATHER.e);

        // Slick > Sport > Wet
        assert!(f_slick.abs() > f_sport.abs(), "Slick > Sport");
        assert!(f_sport.abs() > f_wet.abs(), "Sport > Wet");

        // All should be in a reasonable range (fraction of Fz)
        assert!(f_sport.abs() < fz * 2.0, "Sport force too high");
        assert!(f_sport.abs() > fz * 0.1, "Sport force too low");
    }
}
