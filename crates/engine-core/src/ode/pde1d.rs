//! PDE 1D solver via Method of Lines (MOL).
//!
//! Converts a 1D PDE to a system of ODEs by discretising the spatial domain
//! using finite differences. Supports:
//!   - Heat/diffusion:        u_t = D * u_xx + source
//!   - Advection:             u_t = -c * u_x + source
//!   - Advection-diffusion:   u_t = -c * u_x + D * u_xx + source
//!   - Wave equation:         u_tt = c² * u_xx  (reformulated as first-order system)
//!
//! Spatial discretisation: second-order central differences (uniform grid).
//! Time integration: RK4 (fixed step) on the resulting ODE system.
//! Boundary conditions: Dirichlet (fixed value) or Neumann (zero flux).

use crate::ode::OdeSolverConfig;

/// PDE type supported by the 1D MOL solver.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PdeType {
    /// u_t = D * u_xx
    Heat,
    /// u_t = -c * u_x
    Advection,
    /// u_t = -c * u_x + D * u_xx
    AdvectionDiffusion,
    /// u_tt = c^2 * u_xx  (stored as [u, u_t])
    Wave,
}

/// Boundary condition type.
#[derive(Debug, Clone, Copy)]
pub enum BcType {
    /// Fixed value u = value.
    Dirichlet(f64),
    /// Zero-flux: du/dx = 0 (ghost-cell extrapolation).
    Neumann,
}

/// Configuration for the 1D PDE solver.
#[derive(Debug, Clone)]
pub struct Pde1dConfig {
    /// PDE type.
    pub pde_type: PdeType,
    /// Diffusion coefficient D.
    pub diffusivity: f64,
    /// Advection velocity c.
    pub velocity: f64,
    /// Source term magnitude (uniform, added to every interior point).
    pub source: f64,
    /// Left boundary x coordinate.
    pub x0: f64,
    /// Right boundary x coordinate.
    pub x_end: f64,
    /// Number of spatial grid points (including boundaries).
    pub n_points: usize,
    /// Left boundary condition.
    pub bc_left: BcType,
    /// Right boundary condition.
    pub bc_right: BcType,
    /// Initial condition: u(x, 0) — length must equal n_points.
    pub u0: Vec<f64>,
    /// For wave equation: initial velocity u_t(x, 0) — length n_points.
    pub ut0: Vec<f64>,
    /// Time solver configuration (t_start, t_end, dt).
    pub solver: OdeSolverConfig,
    /// How many time snapshots to store (evenly spaced).
    pub n_snapshots: usize,
}

/// Result of a 1D PDE solve.
#[derive(Debug, Clone)]
pub struct Pde1dResult {
    /// Time points of stored snapshots.
    pub t: Vec<f64>,
    /// Spatial grid (x values, length n_points).
    pub x: Vec<f64>,
    /// State snapshots: `snapshots[i]` is the u vector at time `t[i]`.
    pub snapshots: Vec<Vec<f64>>,
    /// Total number of time steps taken.
    pub steps: usize,
}

/// Solve a 1D PDE using the Method of Lines + RK4.
pub fn solve_pde1d(cfg: &Pde1dConfig) -> Pde1dResult {
    let n = cfg.n_points.max(3);
    let dx = (cfg.x_end - cfg.x0) / (n - 1) as f64;
    let x: Vec<f64> = (0..n).map(|i| cfg.x0 + i as f64 * dx).collect();

    // Build initial state vector for the ODE system.
    // For wave: state = [u0..., ut0...]  length 2n
    // For others: state = [u0...]        length n
    let wave = cfg.pde_type == PdeType::Wave;
    let state_len = if wave { 2 * n } else { n };

    let mut u_padded = cfg.u0.clone();
    u_padded.resize(n, 0.0);
    let mut state: Vec<f64> = u_padded.clone();
    if wave {
        let mut ut_padded = cfg.ut0.clone();
        ut_padded.resize(n, 0.0);
        state.extend_from_slice(&ut_padded);
    }

    // CFL stability check: reduce dt if necessary for explicit scheme
    let dt_diff = if cfg.diffusivity > 0.0 { 0.45 * dx * dx / cfg.diffusivity } else { f64::INFINITY };
    let dt_adv = if cfg.velocity.abs() > 0.0 { 0.45 * dx / cfg.velocity.abs() } else { f64::INFINITY };
    let dt_wave = if wave && cfg.velocity.abs() > 0.0 { 0.45 * dx / cfg.velocity.abs() } else { f64::INFINITY };
    let dt = cfg.solver.dt.min(dt_diff).min(dt_adv).min(dt_wave);

    let t_start = cfg.solver.t_start;
    let t_end = cfg.solver.t_end;
    let n_steps_total = ((t_end - t_start) / dt).ceil() as usize;
    let n_steps_total = n_steps_total.min(cfg.solver.max_steps);
    let n_snapshots = cfg.n_snapshots.max(2).min(n_steps_total + 1);
    let snapshot_interval = (n_steps_total / (n_snapshots - 1)).max(1);

    let mut snapshots: Vec<Vec<f64>> = Vec::with_capacity(n_snapshots);
    let mut t_snaps: Vec<f64> = Vec::with_capacity(n_snapshots);

    // Store initial snapshot
    snapshots.push(u_padded.clone());
    t_snaps.push(t_start);

    let mut t = t_start;
    let mut current = state;

    for step in 0..n_steps_total {
        let actual_dt = dt.min(t_end - t);
        if actual_dt <= 0.0 { break; }

        // RK4
        let k1 = rhs(cfg, &current, n, dx, wave);
        let y2: Vec<f64> = current.iter().zip(&k1).map(|(&y, &k)| y + 0.5 * actual_dt * k).collect();
        let k2 = rhs(cfg, &y2, n, dx, wave);
        let y3: Vec<f64> = current.iter().zip(&k2).map(|(&y, &k)| y + 0.5 * actual_dt * k).collect();
        let k3 = rhs(cfg, &y3, n, dx, wave);
        let y4: Vec<f64> = current.iter().zip(&k3).map(|(&y, &k)| y + actual_dt * k).collect();
        let k4 = rhs(cfg, &y4, n, dx, wave);

        current = (0..state_len)
            .map(|i| current[i] + (actual_dt / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]))
            .collect();

        // Apply boundary conditions to current
        apply_bc(&mut current, cfg, n, wave);

        t += actual_dt;

        if (step + 1) % snapshot_interval == 0 || step + 1 == n_steps_total {
            let u_snap: Vec<f64> = current[..n].to_vec();
            snapshots.push(u_snap);
            t_snaps.push(t);
            if snapshots.len() >= n_snapshots { break; }
        }
    }

    Pde1dResult {
        t: t_snaps,
        x,
        snapshots,
        steps: n_steps_total,
    }
}

/// Compute the right-hand side (time derivative) of the MOL ODE system.
fn rhs(cfg: &Pde1dConfig, state: &[f64], n: usize, dx: f64, wave: bool) -> Vec<f64> {
    let mut dudt = vec![0.0f64; state.len()];

    if wave {
        // Wave equation: u_tt = c^2 * u_xx
        // State = [u, v] where v = u_t
        // du/dt = v
        // dv/dt = c^2 * u_xx
        let u = &state[..n];
        let v = &state[n..];
        for i in 0..n {
            dudt[i] = v[i]; // du/dt = v
        }
        let c2 = cfg.velocity * cfg.velocity;
        for i in 1..n - 1 {
            let uxx = (u[i + 1] - 2.0 * u[i] + u[i - 1]) / (dx * dx);
            dudt[n + i] = c2 * uxx + cfg.source;
        }
        // Boundary points (Dirichlet: dv/dt = 0; Neumann: ghost cell)
        match cfg.bc_left {
            BcType::Dirichlet(_) => { dudt[n] = 0.0; }
            BcType::Neumann => {
                let uxx = 2.0 * (u[1] - u[0]) / (dx * dx);
                dudt[n] = c2 * uxx + cfg.source;
            }
        }
        match cfg.bc_right {
            BcType::Dirichlet(_) => { dudt[n + n - 1] = 0.0; }
            BcType::Neumann => {
                let uxx = 2.0 * (u[n - 2] - u[n - 1]) / (dx * dx);
                dudt[n + n - 1] = c2 * uxx + cfg.source;
            }
        }
    } else {
        let u = &state[..n];
        let d = cfg.diffusivity;
        let c = cfg.velocity;
        let src = cfg.source;

        for i in 1..n - 1 {
            let ux = match cfg.pde_type {
                PdeType::Advection | PdeType::AdvectionDiffusion => {
                    // Upwind scheme for advection
                    if c >= 0.0 {
                        (u[i] - u[i - 1]) / dx
                    } else {
                        (u[i + 1] - u[i]) / dx
                    }
                }
                _ => 0.0,
            };
            let uxx = match cfg.pde_type {
                PdeType::Heat | PdeType::AdvectionDiffusion => {
                    (u[i + 1] - 2.0 * u[i] + u[i - 1]) / (dx * dx)
                }
                _ => 0.0,
            };
            dudt[i] = -c * ux + d * uxx + src;
        }

        // Boundary points
        let left_rhs = match cfg.bc_left {
            BcType::Dirichlet(_) => 0.0,
            BcType::Neumann => {
                // Ghost cell: u[-1] = u[0]
                let uxx = 2.0 * (u[1] - u[0]) / (dx * dx);
                d * uxx + src
            }
        };
        let right_rhs = match cfg.bc_right {
            BcType::Dirichlet(_) => 0.0,
            BcType::Neumann => {
                let uxx = 2.0 * (u[n - 2] - u[n - 1]) / (dx * dx);
                d * uxx + src
            }
        };
        dudt[0] = left_rhs;
        dudt[n - 1] = right_rhs;
    }

    dudt
}

/// Apply boundary conditions to the state vector after each step.
fn apply_bc(state: &mut Vec<f64>, cfg: &Pde1dConfig, n: usize, wave: bool) {
    match cfg.bc_left {
        BcType::Dirichlet(v) => {
            state[0] = v;
            if wave { state[n] = 0.0; }
        }
        BcType::Neumann => {}
    }
    match cfg.bc_right {
        BcType::Dirichlet(v) => {
            state[n - 1] = v;
            if wave { state[2 * n - 1] = 0.0; }
        }
        BcType::Neumann => {}
    }
}

/// Convert Pde1dResult to a Value::Table.
/// Columns: t, x0, x1, ..., x_{N-1}
pub fn pde1d_result_to_table(result: &Pde1dResult) -> crate::types::Value {
    let n = result.x.len();
    let mut columns = vec!["t".to_string()];
    for i in 0..n {
        columns.push(format!("x{}", i));
    }

    let mut rows = Vec::with_capacity(result.t.len());
    for (i, &t) in result.t.iter().enumerate() {
        let mut row = Vec::with_capacity(1 + n);
        row.push(t);
        if let Some(snap) = result.snapshots.get(i) {
            for &u in snap {
                row.push(u);
            }
            // Pad if needed
            for _ in snap.len()..n {
                row.push(f64::NAN);
            }
        } else {
            for _ in 0..n { row.push(f64::NAN); }
        }
        rows.push(row);
    }

    crate::types::Value::Table { columns, rows }
}

/// Parse PDE type from string.
pub fn parse_pde_type(s: &str) -> PdeType {
    match s.to_lowercase().as_str() {
        "heat" | "diffusion" => PdeType::Heat,
        "advection" => PdeType::Advection,
        "advection_diffusion" | "advection-diffusion" | "conv_diff" => PdeType::AdvectionDiffusion,
        "wave" => PdeType::Wave,
        _ => PdeType::Heat,
    }
}

/// Parse boundary condition from string (e.g., "dirichlet:0.0" or "neumann").
pub fn parse_bc(s: &str) -> BcType {
    let s = s.trim().to_lowercase();
    if s.starts_with("dirichlet") {
        let val: f64 = s.split(':').nth(1).and_then(|v| v.trim().parse().ok()).unwrap_or(0.0);
        BcType::Dirichlet(val)
    } else {
        BcType::Neumann
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ode::OdeSolverConfig;

    fn default_solver() -> OdeSolverConfig {
        OdeSolverConfig {
            t_start: 0.0,
            t_end: 0.1,
            dt: 0.001,
            tolerance: 1e-6,
            max_steps: 200_000,
        }
    }

    #[test]
    fn heat_equation_flat_initial() {
        // u(x,0) = 1.0, BCs: u(0)=0, u(1)=0 — should decay toward 0
        let n = 11;
        let u0 = vec![1.0f64; n];
        let cfg = Pde1dConfig {
            pde_type: PdeType::Heat,
            diffusivity: 0.1,
            velocity: 0.0,
            source: 0.0,
            x0: 0.0,
            x_end: 1.0,
            n_points: n,
            bc_left: BcType::Dirichlet(0.0),
            bc_right: BcType::Dirichlet(0.0),
            u0,
            ut0: vec![],
            solver: default_solver(),
            n_snapshots: 5,
        };
        let result = solve_pde1d(&cfg);
        assert!(result.snapshots.len() >= 2);
        // After time, interior values should decrease from 1
        let last = result.snapshots.last().unwrap();
        assert!(last[5] < 1.0, "Interior should decay: {}", last[5]);
    }

    #[test]
    fn advection_transport() {
        // u(x,0) = gaussian at centre, advected left-to-right
        let n = 21;
        let u0: Vec<f64> = (0..n)
            .map(|i| {
                let x = i as f64 / (n - 1) as f64;
                (-(x - 0.3).powi(2) / 0.01).exp()
            })
            .collect();
        let cfg = Pde1dConfig {
            pde_type: PdeType::Advection,
            diffusivity: 0.0,
            velocity: 1.0,
            source: 0.0,
            x0: 0.0,
            x_end: 1.0,
            n_points: n,
            bc_left: BcType::Dirichlet(0.0),
            bc_right: BcType::Dirichlet(0.0),
            u0,
            ut0: vec![],
            solver: OdeSolverConfig { t_end: 0.1, dt: 0.005, ..default_solver() },
            n_snapshots: 5,
        };
        let result = solve_pde1d(&cfg);
        assert!(result.snapshots.len() >= 2);
        // Peak should have moved right
        let last = result.snapshots.last().unwrap();
        let peak_idx = last.iter().enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap_or(0);
        assert!(peak_idx >= 5, "Peak should have moved right, got idx {}", peak_idx);
    }

    #[test]
    fn wave_equation_standing_wave() {
        let n = 21;
        // u(x,0) = sin(π*x), u_t(x,0) = 0 — standing wave
        let u0: Vec<f64> = (0..n)
            .map(|i| {
                let x = i as f64 / (n - 1) as f64;
                (std::f64::consts::PI * x).sin()
            })
            .collect();
        let cfg = Pde1dConfig {
            pde_type: PdeType::Wave,
            diffusivity: 0.0,
            velocity: 1.0,
            source: 0.0,
            x0: 0.0,
            x_end: 1.0,
            n_points: n,
            bc_left: BcType::Dirichlet(0.0),
            bc_right: BcType::Dirichlet(0.0),
            u0,
            ut0: vec![0.0f64; n],
            solver: OdeSolverConfig { t_end: 0.5, dt: 0.01, ..default_solver() },
            n_snapshots: 5,
        };
        let result = solve_pde1d(&cfg);
        // BCs should hold
        let last = result.snapshots.last().unwrap();
        assert!(last[0].abs() < 1e-10, "Left BC violated: {}", last[0]);
        assert!(last[n - 1].abs() < 1e-10, "Right BC violated: {}", last[n - 1]);
    }

    #[test]
    fn table_output_shape() {
        let n = 5;
        let cfg = Pde1dConfig {
            pde_type: PdeType::Heat,
            diffusivity: 0.1,
            velocity: 0.0,
            source: 0.0,
            x0: 0.0,
            x_end: 1.0,
            n_points: n,
            bc_left: BcType::Dirichlet(0.0),
            bc_right: BcType::Dirichlet(0.0),
            u0: vec![0.5f64; n],
            ut0: vec![],
            solver: OdeSolverConfig { t_end: 0.05, dt: 0.005, ..default_solver() },
            n_snapshots: 3,
        };
        let result = solve_pde1d(&cfg);
        let table = pde1d_result_to_table(&result);
        if let crate::types::Value::Table { columns, rows } = table {
            assert_eq!(columns.len(), 1 + n); // t + x0..x4
            assert!(!rows.is_empty());
        } else {
            panic!("Expected Table");
        }
    }
}
