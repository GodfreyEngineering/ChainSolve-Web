//! Point-mass quasi-steady-state lap simulation.
//!
//! Discretises a track into segments and computes maximum speed at each point
//! based on grip limit, then forward-integrates acceleration and backward-
//! integrates braking to find the actual speed profile.
//!
//! Reference: Milliken & Milliken "Race Car Vehicle Dynamics" (1995).

/// Vehicle parameters for lap simulation.
#[derive(Debug, Clone)]
pub struct LapVehicle {
    pub mass: f64,         // kg
    pub power: f64,        // W (peak engine power)
    pub cd: f64,           // drag coefficient
    pub cl: f64,           // lift/downforce coefficient
    pub frontal_area: f64, // m²
    pub mu: f64,           // tire friction coefficient
    pub rho: f64,          // air density (kg/m³), default 1.225
}

impl Default for LapVehicle {
    fn default() -> Self {
        Self {
            mass: 1500.0,
            power: 200_000.0, // 200 kW
            cd: 0.35,
            cl: 0.1,
            frontal_area: 2.0,
            mu: 1.2,
            rho: 1.225,
        }
    }
}

/// Result of a lap simulation.
#[derive(Debug, Clone)]
pub struct LapResult {
    /// Distance along track at each point (m).
    pub distance: Vec<f64>,
    /// Speed at each point (m/s).
    pub speed: Vec<f64>,
    /// Total lap time (s).
    pub lap_time: f64,
    /// Number of track segments.
    pub segments: usize,
}

/// Simulate a lap using the point-mass method.
///
/// `track` is a list of (distance_m, curvature_1/m) pairs defining the track.
/// Curvature = 1/radius for corners, 0 for straights.
pub fn simulate_lap(track: &[(f64, f64)], vehicle: &LapVehicle) -> LapResult {
    let n = track.len();
    if n < 2 {
        return LapResult {
            distance: vec![],
            speed: vec![],
            lap_time: 0.0,
            segments: 0,
        };
    }

    let g = 9.80665;

    // Step 1: Compute corner speed limit at each point
    let v_corner: Vec<f64> = track
        .iter()
        .map(|&(_dist, curv)| {
            if curv.abs() < 1e-10 {
                f64::INFINITY // Straight — no corner speed limit
            } else {
                let radius = 1.0 / curv.abs();
                // v_max = sqrt(mu * g * R) — simplified, ignoring aero downforce
                (vehicle.mu * g * radius).sqrt()
            }
        })
        .collect();

    // Step 2: Forward pass — acceleration limited
    let mut v_forward = vec![0.0_f64; n];
    v_forward[0] = v_corner[0].min(50.0); // Start at min of corner limit or 50 m/s

    for i in 1..n {
        let ds = track[i].0 - track[i - 1].0;
        if ds <= 0.0 {
            v_forward[i] = v_forward[i - 1];
            continue;
        }

        let v = v_forward[i - 1];
        // Traction-limited acceleration: F_drive = min(P/v, mu*m*g)
        let f_drive = if v > 1.0 {
            (vehicle.power / v).min(vehicle.mu * vehicle.mass * g)
        } else {
            vehicle.mu * vehicle.mass * g
        };
        // Drag force
        let f_drag = 0.5 * vehicle.rho * vehicle.cd * vehicle.frontal_area * v * v;
        let f_net = f_drive - f_drag;
        let a = f_net / vehicle.mass;

        // v² = v₀² + 2*a*ds
        let v_sq = v * v + 2.0 * a.max(0.0) * ds;
        v_forward[i] = v_sq.max(0.0).sqrt().min(v_corner[i]);
    }

    // Step 3: Backward pass — braking limited
    let mut v_backward = vec![0.0_f64; n];
    v_backward[n - 1] = v_forward[n - 1];

    for i in (0..n - 1).rev() {
        let ds = track[i + 1].0 - track[i].0;
        if ds <= 0.0 {
            v_backward[i] = v_backward[i + 1];
            continue;
        }

        let v = v_backward[i + 1];
        // Braking deceleration: a_brake = mu * g (simplified)
        let a_brake = vehicle.mu * g;
        let v_sq = v * v + 2.0 * a_brake * ds;
        v_backward[i] = v_sq.max(0.0).sqrt().min(v_corner[i]);
    }

    // Step 4: Combine — minimum of forward and backward speeds
    let speed: Vec<f64> = (0..n)
        .map(|i| v_forward[i].min(v_backward[i]))
        .collect();

    // Step 5: Compute lap time by integrating dt = ds / v
    let mut lap_time = 0.0;
    for i in 1..n {
        let ds = track[i].0 - track[i - 1].0;
        let v_avg = (speed[i] + speed[i - 1]) / 2.0;
        if v_avg > 0.1 {
            lap_time += ds / v_avg;
        }
    }

    let distance: Vec<f64> = track.iter().map(|&(d, _)| d).collect();

    LapResult {
        distance,
        speed,
        lap_time,
        segments: n,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_oval_track() {
        // Oval: 200m straight, 50m corner (R=50m), 200m straight, 50m corner
        let mut track = Vec::new();
        let total = 500.0;
        let steps = 100;
        let ds = total / steps as f64;

        for i in 0..=steps {
            let d = i as f64 * ds;
            let curv = if d < 200.0 {
                0.0 // straight
            } else if d < 250.0 {
                1.0 / 50.0 // R=50m corner
            } else if d < 450.0 {
                0.0 // straight
            } else {
                1.0 / 50.0 // R=50m corner
            };
            track.push((d, curv));
        }

        let vehicle = LapVehicle::default();
        let result = simulate_lap(&track, &vehicle);

        assert!(result.lap_time > 0.0, "Lap time should be positive");
        assert!(result.lap_time < 60.0, "Lap time should be < 60s for 500m track, got {}", result.lap_time);
        assert_eq!(result.segments, 101);

        // Speed should be lower in corners than on straights
        let straight_speed = result.speed[10]; // mid-straight
        let corner_speed = result.speed[45]; // mid-corner
        assert!(
            straight_speed > corner_speed,
            "Straight speed {} should be > corner speed {}",
            straight_speed, corner_speed
        );
    }

    #[test]
    fn empty_track() {
        let result = simulate_lap(&[], &LapVehicle::default());
        assert_eq!(result.lap_time, 0.0);
        assert_eq!(result.segments, 0);
    }
}
