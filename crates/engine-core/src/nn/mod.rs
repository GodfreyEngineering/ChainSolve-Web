//! Neural Network module — layers, activations, sequential model,
//! training (backpropagation + SGD), and ONNX export.
//!
//! Enforces a 1M parameter limit for the web environment.

pub mod layer;
pub mod activation;
pub mod model;
pub mod train;
pub mod export;
