//! Vehicle simulation modules.
//!
//! Provides tire models (Pacejka Magic Formula), suspension dynamics,
//! aerodynamics, powertrain, and lap simulation blocks.
//!
//! Reference texts:
//! - Pacejka, "Tire and Vehicle Dynamics" 3rd ed (2012)
//! - Milliken & Milliken, "Race Car Vehicle Dynamics" (1995)
//! - Dixon, "Suspension Geometry and Computation" (2009)

pub mod aero;
pub mod powertrain;
pub mod tire;
