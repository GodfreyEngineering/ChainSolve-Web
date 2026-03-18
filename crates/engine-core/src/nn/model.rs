//! Sequential neural network model — chain of layers with forward pass.

use super::layer::{Layer, DenseLayer, Conv1DLayer, DropoutLayer};
use super::activation::ActivationFn;

/// Maximum parameters allowed in web environment.
pub const MAX_PARAMETERS: usize = 1_000_000;

/// A sequential neural network model.
#[derive(Debug, Clone)]
pub struct Sequential {
    pub layers: Vec<Layer>,
}

/// Model summary information.
#[derive(Debug, Clone)]
pub struct ModelSummary {
    pub total_params: usize,
    pub trainable_params: usize,
    pub layer_shapes: Vec<(String, usize)>,
}

impl Sequential {
    pub fn new() -> Self {
        Self { layers: Vec::new() }
    }

    /// Add a dense layer.
    pub fn add_dense(
        &mut self,
        input_size: usize,
        output_size: usize,
        activation: ActivationFn,
        seed: u64,
    ) -> Result<(), String> {
        let layer = DenseLayer::new(input_size, output_size, activation, seed);
        let new_params = self.total_params() + layer.param_count();
        if new_params > MAX_PARAMETERS {
            return Err(format!(
                "Adding this layer would exceed the {} parameter limit ({} total)",
                MAX_PARAMETERS, new_params
            ));
        }
        self.layers.push(Layer::Dense(layer));
        Ok(())
    }

    /// Add a Conv1D layer.
    pub fn add_conv1d(
        &mut self,
        input_channels: usize,
        n_filters: usize,
        kernel_size: usize,
        activation: ActivationFn,
        seed: u64,
    ) -> Result<(), String> {
        let layer = Conv1DLayer::new(input_channels, n_filters, kernel_size, activation, seed);
        let new_params = self.total_params() + layer.param_count();
        if new_params > MAX_PARAMETERS {
            return Err(format!(
                "Adding this layer would exceed the {} parameter limit",
                MAX_PARAMETERS
            ));
        }
        self.layers.push(Layer::Conv1D(layer));
        Ok(())
    }

    /// Add a dropout layer.
    pub fn add_dropout(&mut self, rate: f64) {
        self.layers.push(Layer::Dropout(DropoutLayer::new(rate)));
    }

    /// Forward pass through all layers (inference mode).
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        let mut data = input.to_vec();
        for layer in &self.layers {
            data = match layer {
                Layer::Dense(l) => l.forward(&data),
                Layer::Conv1D(l) => {
                    let length = data.len() / l.input_channels.max(1);
                    l.forward(&data, length)
                }
                Layer::Conv2D(l) => {
                    let spatial = data.len() / l.input_channels.max(1);
                    let side = (spatial as f64).sqrt() as usize;
                    let (out, _, _) = l.forward(&data, side, side);
                    out
                }
                Layer::Dropout(l) => l.forward_inference(&data),
            };
        }
        data
    }

    /// Total parameter count across all layers.
    pub fn total_params(&self) -> usize {
        self.layers.iter().map(|l| l.param_count()).sum()
    }

    /// Get model summary.
    pub fn summary(&self) -> ModelSummary {
        let total_params = self.total_params();
        let layer_shapes: Vec<(String, usize)> = self
            .layers
            .iter()
            .map(|l| match l {
                Layer::Dense(d) => (
                    format!("Dense({}→{}, {:?})", d.input_size, d.output_size, d.activation),
                    d.param_count(),
                ),
                Layer::Conv1D(c) => (
                    format!("Conv1D({}→{}, k={})", c.input_channels, c.n_filters, c.kernel_size),
                    c.param_count(),
                ),
                Layer::Conv2D(c) => (
                    format!("Conv2D({}→{}, k={}x{})", c.input_channels, c.n_filters, c.kernel_h, c.kernel_w),
                    c.param_count(),
                ),
                Layer::Dropout(d) => (format!("Dropout({})", d.rate), 0),
            })
            .collect();

        ModelSummary {
            total_params,
            trainable_params: total_params, // all params trainable for now
            layer_shapes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sequential_forward() {
        let mut model = Sequential::new();
        model.add_dense(2, 4, ActivationFn::ReLU, 42).unwrap();
        model.add_dense(4, 1, ActivationFn::Sigmoid, 43).unwrap();

        let output = model.forward(&[1.0, 0.5]);
        assert_eq!(output.len(), 1);
        assert!(output[0] >= 0.0 && output[0] <= 1.0); // sigmoid output
    }

    #[test]
    fn param_limit_enforced() {
        let mut model = Sequential::new();
        // 1000 * 1001 + 1001 = 1_002_001 > 1M
        let result = model.add_dense(1000, 1001, ActivationFn::Linear, 42);
        assert!(result.is_err());
    }

    #[test]
    fn model_summary() {
        let mut model = Sequential::new();
        model.add_dense(2, 4, ActivationFn::ReLU, 42).unwrap();
        model.add_dropout(0.5);
        model.add_dense(4, 1, ActivationFn::Sigmoid, 43).unwrap();

        let summary = model.summary();
        assert_eq!(summary.total_params, 2 * 4 + 4 + 4 * 1 + 1); // 17
        assert_eq!(summary.layer_shapes.len(), 3);
    }
}
