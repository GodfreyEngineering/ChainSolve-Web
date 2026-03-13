//! Neural network layer definitions: Dense, Conv1D, Dropout.

use super::activation::ActivationFn;
use crate::optim::genetic::SimpleRng;

/// A neural network layer.
#[derive(Debug, Clone)]
pub enum Layer {
    Dense(DenseLayer),
    Conv1D(Conv1DLayer),
    Dropout(DropoutLayer),
}

/// Fully connected layer.
#[derive(Debug, Clone)]
pub struct DenseLayer {
    pub weights: Vec<f64>,   // shape: [input_size * output_size] row-major
    pub biases: Vec<f64>,    // shape: [output_size]
    pub input_size: usize,
    pub output_size: usize,
    pub activation: ActivationFn,
}

/// 1D convolutional layer.
#[derive(Debug, Clone)]
pub struct Conv1DLayer {
    pub filters: Vec<Vec<f64>>,   // [n_filters][kernel_size * input_channels]
    pub biases: Vec<f64>,         // [n_filters]
    pub n_filters: usize,
    pub kernel_size: usize,
    pub input_channels: usize,
    pub activation: ActivationFn,
}

/// Dropout layer (identity at inference, random zeroing during training).
#[derive(Debug, Clone)]
pub struct DropoutLayer {
    pub rate: f64,
}

impl DenseLayer {
    /// Create a new dense layer with Xavier initialization.
    pub fn new(input_size: usize, output_size: usize, activation: ActivationFn, seed: u64) -> Self {
        let mut rng = SimpleRng::new(seed);
        let scale = (2.0 / (input_size + output_size) as f64).sqrt();
        let weights: Vec<f64> = (0..input_size * output_size)
            .map(|_| rng.next_gaussian() * scale)
            .collect();
        let biases = vec![0.0; output_size];
        Self { weights, biases, input_size, output_size, activation }
    }

    /// Forward pass: output = activation(input @ weights + biases).
    pub fn forward(&self, input: &[f64]) -> Vec<f64> {
        let mut output = self.biases.clone();
        for j in 0..self.output_size {
            for i in 0..self.input_size {
                let idx = i.min(input.len().saturating_sub(1));
                output[j] += input.get(idx).copied().unwrap_or(0.0)
                    * self.weights[i * self.output_size + j];
            }
        }
        super::activation::apply(&self.activation, &mut output);
        output
    }

    /// Total parameters (weights + biases).
    pub fn param_count(&self) -> usize {
        self.input_size * self.output_size + self.output_size
    }
}

impl Conv1DLayer {
    /// Create a new Conv1D layer.
    pub fn new(
        input_channels: usize,
        n_filters: usize,
        kernel_size: usize,
        activation: ActivationFn,
        seed: u64,
    ) -> Self {
        let mut rng = SimpleRng::new(seed);
        let scale = (2.0 / (input_channels * kernel_size) as f64).sqrt();
        let filters: Vec<Vec<f64>> = (0..n_filters)
            .map(|_| {
                (0..kernel_size * input_channels)
                    .map(|_| rng.next_gaussian() * scale)
                    .collect()
            })
            .collect();
        let biases = vec![0.0; n_filters];
        Self { filters, biases, n_filters, kernel_size, input_channels, activation }
    }

    /// Forward pass for 1D convolution (valid padding).
    /// Input shape: [length * input_channels] flattened.
    /// Output shape: [(length - kernel_size + 1) * n_filters] flattened.
    pub fn forward(&self, input: &[f64], input_length: usize) -> Vec<f64> {
        if input_length < self.kernel_size {
            return vec![0.0; self.n_filters]; // too short
        }
        let out_length = input_length - self.kernel_size + 1;
        let mut output = Vec::with_capacity(out_length * self.n_filters);

        for pos in 0..out_length {
            for (f_idx, filter) in self.filters.iter().enumerate() {
                let mut val = self.biases[f_idx];
                for k in 0..self.kernel_size {
                    for c in 0..self.input_channels {
                        let input_idx = (pos + k) * self.input_channels + c;
                        let filter_idx = k * self.input_channels + c;
                        val += input.get(input_idx).copied().unwrap_or(0.0)
                            * filter.get(filter_idx).copied().unwrap_or(0.0);
                    }
                }
                output.push(val);
            }
        }

        super::activation::apply(&self.activation, &mut output);
        output
    }

    pub fn param_count(&self) -> usize {
        self.n_filters * self.kernel_size * self.input_channels + self.n_filters
    }
}

impl DropoutLayer {
    pub fn new(rate: f64) -> Self {
        Self { rate: rate.clamp(0.0, 1.0) }
    }

    /// Forward pass (inference mode: scale by (1 - rate)).
    pub fn forward_inference(&self, input: &[f64]) -> Vec<f64> {
        let scale = 1.0 - self.rate;
        input.iter().map(|&x| x * scale).collect()
    }

    /// Forward pass (training mode: randomly zero elements).
    pub fn forward_train(&self, input: &[f64], rng: &mut SimpleRng) -> (Vec<f64>, Vec<bool>) {
        let mut output = Vec::with_capacity(input.len());
        let mut mask = Vec::with_capacity(input.len());
        for &x in input {
            let keep = rng.next_f64() >= self.rate;
            mask.push(keep);
            output.push(if keep { x / (1.0 - self.rate) } else { 0.0 });
        }
        (output, mask)
    }
}

impl Layer {
    pub fn param_count(&self) -> usize {
        match self {
            Layer::Dense(l) => l.param_count(),
            Layer::Conv1D(l) => l.param_count(),
            Layer::Dropout(_) => 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dense_forward_shape() {
        let layer = DenseLayer::new(3, 2, ActivationFn::ReLU, 42);
        let output = layer.forward(&[1.0, 2.0, 3.0]);
        assert_eq!(output.len(), 2);
    }

    #[test]
    fn dense_param_count() {
        let layer = DenseLayer::new(10, 5, ActivationFn::ReLU, 42);
        assert_eq!(layer.param_count(), 55); // 10*5 + 5
    }

    #[test]
    fn conv1d_forward_shape() {
        let layer = Conv1DLayer::new(1, 4, 3, ActivationFn::ReLU, 42);
        let input = vec![1.0, 2.0, 3.0, 4.0, 5.0]; // length 5, 1 channel
        let output = layer.forward(&input, 5);
        assert_eq!(output.len(), 3 * 4); // (5-3+1) * 4 filters
    }

    #[test]
    fn dropout_inference_scales() {
        let layer = DropoutLayer::new(0.5);
        let output = layer.forward_inference(&[2.0, 4.0, 6.0]);
        assert!((output[0] - 1.0).abs() < 1e-10);
        assert!((output[1] - 2.0).abs() < 1e-10);
    }
}
