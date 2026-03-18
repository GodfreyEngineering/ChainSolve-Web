//! Neural Network module — layers, activations, sequential model,
//! training (backpropagation + SGD), and ONNX export.
//!
//! Enforces a 1M parameter limit for the web environment.

pub mod layer;
pub mod activation;
pub mod attention;
pub mod model;
pub mod recurrent;
pub mod train;
pub mod export;
pub mod onnx_export;
pub mod lr_schedule;
