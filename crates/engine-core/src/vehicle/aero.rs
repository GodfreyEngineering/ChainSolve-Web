//! Vehicle aerodynamics calculations.
//!
//! Provides drag, downforce, and side force calculations using
//! standard aerodynamic equations: F = 0.5 * ρ * Cd * A * v².

/// Aerodynamic drag force: F_drag = 0.5 * ρ * Cd * A * v²
pub fn drag_force(rho: f64, cd: f64, area: f64, velocity: f64) -> f64 {
    0.5 * rho * cd * area * velocity * velocity
}

/// Aerodynamic downforce: F_down = 0.5 * ρ * Cl * A * v²
pub fn downforce(rho: f64, cl: f64, area: f64, velocity: f64) -> f64 {
    0.5 * rho * cl * area * velocity * velocity
}

/// Aerodynamic side force: F_side = 0.5 * ρ * Cs * A * v²
pub fn side_force(rho: f64, cs: f64, area: f64, velocity: f64) -> f64 {
    0.5 * rho * cs * area * velocity * velocity
}

/// Aero balance: front downforce percentage = F_front / F_total * 100
pub fn aero_balance(f_front: f64, f_total: f64) -> f64 {
    if f_total.abs() < 1e-15 { 50.0 } else { (f_front / f_total) * 100.0 }
}

/// Drag area: CdA = Cd * A
pub fn cd_a(cd: f64, area: f64) -> f64 {
    cd * area
}

/// Vehicle aerodynamic presets.
#[derive(Debug, Clone, Copy)]
pub struct AeroPreset {
    pub cd: f64,
    pub cl: f64,
    pub frontal_area: f64,
}

pub const SEDAN: AeroPreset = AeroPreset { cd: 0.30, cl: 0.05, frontal_area: 2.2 };
pub const SPORTS_CAR: AeroPreset = AeroPreset { cd: 0.32, cl: 0.30, frontal_area: 1.9 };
pub const F1_CAR: AeroPreset = AeroPreset { cd: 0.70, cl: 3.50, frontal_area: 1.5 };
pub const TRUCK: AeroPreset = AeroPreset { cd: 0.60, cl: 0.0, frontal_area: 8.0 };

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drag_at_zero_velocity() {
        assert_eq!(drag_force(1.225, 0.30, 2.2, 0.0), 0.0);
    }

    #[test]
    fn drag_increases_with_v_squared() {
        let d1 = drag_force(1.225, 0.30, 2.2, 30.0);
        let d2 = drag_force(1.225, 0.30, 2.2, 60.0);
        // At double speed, drag should be 4x
        assert!((d2 / d1 - 4.0).abs() < 1e-10);
    }

    #[test]
    fn balance_equal_split() {
        assert_eq!(aero_balance(500.0, 1000.0), 50.0);
    }

    #[test]
    fn balance_zero_total() {
        assert_eq!(aero_balance(0.0, 0.0), 50.0);
    }

    #[test]
    fn f1_high_downforce() {
        let df = downforce(1.225, F1_CAR.cl, F1_CAR.frontal_area, 80.0); // ~290 km/h
        // F1 car at 80 m/s should produce significant downforce
        assert!(df > 10000.0, "F1 downforce at 80m/s: {}", df);
    }
}
