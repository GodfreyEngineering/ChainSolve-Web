//! ODE (Ordinary Differential Equation) solvers.
//!
//! Provides fixed-step (RK4), adaptive-step (RK45/Dormand-Prince), and
//! implicit (BDF) solvers for systems of ODEs defined by expression strings.
//!
//! All solvers take an `OdeSystem` (equation definitions + parameter values)
//! and return an `OdeResult` (time series of state variables as vectors).

pub mod adjoint;
pub mod bdf;
pub mod dae;
pub mod event;
pub mod pde1d;
pub mod radau;
pub mod rk4;
pub mod rk45;
pub mod steady_state;
pub mod symplectic;
pub mod types;

pub use types::{OdeResult, OdeSolverConfig, OdeSystem};
