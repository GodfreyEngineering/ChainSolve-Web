//! Activation functions: ReLU, Sigmoid, Tanh, Softmax, Linear.

/// Activation function enum.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActivationFn {
    ReLU,
    Sigmoid,
    Tanh,
    Softmax,
    Linear,
}

impl ActivationFn {
    /// Parse from string (case-insensitive).
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "relu" => Self::ReLU,
            "sigmoid" => Self::Sigmoid,
            "tanh" => Self::Tanh,
            "softmax" => Self::Softmax,
            _ => Self::Linear,
        }
    }
}

/// Apply activation function in-place.
pub fn apply(func: &ActivationFn, data: &mut [f64]) {
    match func {
        ActivationFn::ReLU => {
            for x in data.iter_mut() {
                *x = x.max(0.0);
            }
        }
        ActivationFn::Sigmoid => {
            for x in data.iter_mut() {
                *x = 1.0 / (1.0 + (-*x).exp());
            }
        }
        ActivationFn::Tanh => {
            for x in data.iter_mut() {
                *x = x.tanh();
            }
        }
        ActivationFn::Softmax => {
            let max = data.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let mut sum = 0.0;
            for x in data.iter_mut() {
                *x = (*x - max).exp();
                sum += *x;
            }
            if sum > 0.0 {
                for x in data.iter_mut() {
                    *x /= sum;
                }
            }
        }
        ActivationFn::Linear => {} // no-op
    }
}

/// Compute derivative of activation function given the activation output.
pub fn derivative(func: &ActivationFn, output: f64) -> f64 {
    match func {
        ActivationFn::ReLU => {
            if output > 0.0 { 1.0 } else { 0.0 }
        }
        ActivationFn::Sigmoid => output * (1.0 - output),
        ActivationFn::Tanh => 1.0 - output * output,
        ActivationFn::Softmax => output * (1.0 - output), // simplified for cross-entropy loss
        ActivationFn::Linear => 1.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relu() {
        let mut data = vec![-1.0, 0.0, 1.0, 2.0];
        apply(&ActivationFn::ReLU, &mut data);
        assert_eq!(data, vec![0.0, 0.0, 1.0, 2.0]);
    }

    #[test]
    fn sigmoid_bounds() {
        let mut data = vec![-100.0, 0.0, 100.0];
        apply(&ActivationFn::Sigmoid, &mut data);
        assert!(data[0] < 0.01);
        assert!((data[1] - 0.5).abs() < 1e-10);
        assert!(data[2] > 0.99);
    }

    #[test]
    fn softmax_sums_to_one() {
        let mut data = vec![1.0, 2.0, 3.0];
        apply(&ActivationFn::Softmax, &mut data);
        let sum: f64 = data.iter().sum();
        assert!((sum - 1.0).abs() < 1e-10);
        assert!(data[2] > data[1]);
        assert!(data[1] > data[0]);
    }

    #[test]
    fn tanh_bounds() {
        let mut data = vec![-100.0, 0.0, 100.0];
        apply(&ActivationFn::Tanh, &mut data);
        assert!((data[0] - -1.0).abs() < 0.01);
        assert!((data[1] - 0.0).abs() < 1e-10);
        assert!((data[2] - 1.0).abs() < 0.01);
    }

    #[test]
    fn parse_activation() {
        assert_eq!(ActivationFn::from_str("relu"), ActivationFn::ReLU);
        assert_eq!(ActivationFn::from_str("SIGMOID"), ActivationFn::Sigmoid);
        assert_eq!(ActivationFn::from_str("unknown"), ActivationFn::Linear);
    }
}
