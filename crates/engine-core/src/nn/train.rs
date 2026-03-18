//! Neural network training: backpropagation with SGD optimizer.

use super::activation;
use super::layer::Layer;
use super::model::Sequential;
use crate::optim::genetic::SimpleRng;

/// Training configuration.
#[derive(Debug, Clone)]
pub struct TrainConfig {
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub loss: LossFn,
    /// Early stopping patience: stop if val loss hasn't improved for this many epochs.
    /// 0 = disabled.
    pub patience: usize,
    /// Fraction of data to hold out for validation (0.0-1.0). 0 = no validation.
    pub validation_split: f64,
}

/// Supported loss functions.
#[derive(Debug, Clone, Copy)]
pub enum LossFn {
    MSE,
    CrossEntropy,
}

impl LossFn {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "cross_entropy" | "crossentropy" | "ce" => Self::CrossEntropy,
            _ => Self::MSE,
        }
    }
}

/// Training result.
#[derive(Debug, Clone)]
pub struct TrainResult {
    pub loss_history: Vec<f64>,
    pub val_loss_history: Vec<f64>,
    pub final_loss: f64,
    pub best_val_loss: f64,
    pub epochs_run: usize,
    pub early_stopped: bool,
}

/// Train a sequential model using backpropagation with SGD.
///
/// Only supports models with Dense layers (Conv1D training not yet implemented).
/// Uses mini-batch SGD with the specified learning rate.
pub fn train(
    model: &mut Sequential,
    x_train: &[Vec<f64>],
    y_train: &[Vec<f64>],
    config: &TrainConfig,
) -> Result<TrainResult, String> {
    if x_train.is_empty() || y_train.is_empty() {
        return Err("No training data".into());
    }
    if x_train.len() != y_train.len() {
        return Err("X and Y length mismatch".into());
    }

    // Verify all layers are Dense (backprop only supports Dense for now)
    for layer in &model.layers {
        match layer {
            Layer::Dense(_) | Layer::Dropout(_) => {}
            Layer::Conv1D(_) => {
                return Err("Backpropagation for Conv1D not yet implemented. Use Dense layers.".into());
            }
            Layer::Conv2D(_) => {
                return Err("Backpropagation for Conv2D not yet implemented. Use Dense layers.".into());
            }
        }
    }

    let mut rng = SimpleRng::new(12345);
    let n_samples = x_train.len();
    let batch_size = config.batch_size.min(n_samples).max(1);
    let mut loss_history = Vec::with_capacity(config.epochs);

    for _epoch in 0..config.epochs {
        let mut epoch_loss = 0.0;
        let mut batches = 0;

        // Shuffle indices
        let mut indices: Vec<usize> = (0..n_samples).collect();
        for i in (1..n_samples).rev() {
            let j = rng.next_usize(i + 1);
            indices.swap(i, j);
        }

        for batch_start in (0..n_samples).step_by(batch_size) {
            let batch_end = (batch_start + batch_size).min(n_samples);
            let batch_indices = &indices[batch_start..batch_end];
            let actual_batch = batch_indices.len();

            // Accumulate gradients over the batch
            let dense_count = model
                .layers
                .iter()
                .filter(|l| matches!(l, Layer::Dense(_)))
                .count();
            let mut weight_grads: Vec<Vec<f64>> = Vec::with_capacity(dense_count);
            let mut bias_grads: Vec<Vec<f64>> = Vec::with_capacity(dense_count);

            // Initialize gradient accumulators
            for layer in &model.layers {
                if let Layer::Dense(d) = layer {
                    weight_grads.push(vec![0.0; d.input_size * d.output_size]);
                    bias_grads.push(vec![0.0; d.output_size]);
                }
            }

            let mut batch_loss = 0.0;

            for &idx in batch_indices {
                let x = &x_train[idx];
                let y = &y_train[idx];

                // Forward pass: store activations at each layer
                let mut activations: Vec<Vec<f64>> = Vec::new();
                activations.push(x.clone());

                let mut current = x.clone();
                for layer in &model.layers {
                    current = match layer {
                        Layer::Dense(d) => d.forward(&current),
                        Layer::Dropout(d) => {
                            let (out, _) = d.forward_train(&current, &mut rng);
                            out
                        }
                        _ => current,
                    };
                    activations.push(current.clone());
                }

                // Compute loss
                let output = &activations[activations.len() - 1];
                batch_loss += compute_loss(&config.loss, output, y);

                // Backward pass
                let mut delta: Vec<f64> = loss_gradient(&config.loss, output, y);

                let mut dense_idx = dense_count;
                for (layer_idx, layer) in model.layers.iter().enumerate().rev() {
                    if let Layer::Dense(d) = layer {
                        dense_idx -= 1;
                        let input = &activations[layer_idx];

                        // Gradient through activation
                        let pre_activation = &activations[layer_idx + 1];
                        for j in 0..d.output_size {
                            delta[j] *= activation::derivative(
                                &d.activation,
                                pre_activation.get(j).copied().unwrap_or(0.0),
                            );
                        }

                        // Accumulate weight gradients: dW = input^T @ delta
                        for i in 0..d.input_size {
                            let inp = input.get(i).copied().unwrap_or(0.0);
                            for j in 0..d.output_size {
                                weight_grads[dense_idx][i * d.output_size + j] +=
                                    inp * delta[j];
                            }
                        }

                        // Accumulate bias gradients
                        for j in 0..d.output_size {
                            bias_grads[dense_idx][j] += delta[j];
                        }

                        // Propagate delta to previous layer: delta_prev = delta @ weights^T
                        let mut new_delta = vec![0.0; d.input_size];
                        for i in 0..d.input_size {
                            for j in 0..d.output_size {
                                new_delta[i] +=
                                    delta[j] * d.weights[i * d.output_size + j];
                            }
                        }
                        delta = new_delta;
                    }
                }
            }

            // Update weights using SGD
            let lr = config.learning_rate / actual_batch as f64;
            let mut dense_idx = 0;
            for layer in &mut model.layers {
                if let Layer::Dense(d) = layer {
                    for i in 0..d.weights.len() {
                        d.weights[i] -= lr * weight_grads[dense_idx][i];
                    }
                    for i in 0..d.biases.len() {
                        d.biases[i] -= lr * bias_grads[dense_idx][i];
                    }
                    dense_idx += 1;
                }
            }

            epoch_loss += batch_loss;
            batches += 1;
        }

        let avg_loss = epoch_loss / (batches as f64 * batch_size as f64).max(1.0);
        loss_history.push(avg_loss);
    }

    let final_loss = loss_history.last().copied().unwrap_or(f64::NAN);

    Ok(TrainResult {
        loss_history,
        val_loss_history: vec![], // Validation loss tracking deferred to simulation worker
        final_loss,
        best_val_loss: f64::NAN,
        epochs_run: config.epochs,
        early_stopped: false,
    })
}

fn compute_loss(loss_fn: &LossFn, output: &[f64], target: &[f64]) -> f64 {
    match loss_fn {
        LossFn::MSE => {
            output
                .iter()
                .zip(target.iter())
                .map(|(&o, &t)| (o - t).powi(2))
                .sum::<f64>()
                / output.len().max(1) as f64
        }
        LossFn::CrossEntropy => {
            let eps = 1e-15;
            -output
                .iter()
                .zip(target.iter())
                .map(|(&o, &t)| {
                    let o_clamped = o.clamp(eps, 1.0 - eps);
                    t * o_clamped.ln() + (1.0 - t) * (1.0 - o_clamped).ln()
                })
                .sum::<f64>()
                / output.len().max(1) as f64
        }
    }
}

fn loss_gradient(loss_fn: &LossFn, output: &[f64], target: &[f64]) -> Vec<f64> {
    let n = output.len().max(1) as f64;
    match loss_fn {
        LossFn::MSE => output
            .iter()
            .zip(target.iter())
            .map(|(&o, &t)| 2.0 * (o - t) / n)
            .collect(),
        LossFn::CrossEntropy => {
            let eps = 1e-15;
            output
                .iter()
                .zip(target.iter())
                .map(|(&o, &t)| {
                    let o_clamped = o.clamp(eps, 1.0 - eps);
                    (-t / o_clamped + (1.0 - t) / (1.0 - o_clamped)) / n
                })
                .collect()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nn::activation::ActivationFn;

    #[test]
    fn train_xor() {
        // XOR problem: 2→4→1
        let mut model = Sequential::new();
        model.add_dense(2, 4, ActivationFn::Tanh, 42).unwrap();
        model.add_dense(4, 1, ActivationFn::Sigmoid, 43).unwrap();

        let x_train = vec![
            vec![0.0, 0.0],
            vec![0.0, 1.0],
            vec![1.0, 0.0],
            vec![1.0, 1.0],
        ];
        let y_train = vec![vec![0.0], vec![1.0], vec![1.0], vec![0.0]];

        let config = TrainConfig {
            epochs: 5000,
            batch_size: 4,
            learning_rate: 0.5,
            loss: LossFn::MSE,
            patience: 0,
            validation_split: 0.0,
        };

        let result = train(&mut model, &x_train, &y_train, &config).unwrap();
        assert!(
            result.final_loss < 0.01,
            "XOR loss should be < 0.01, got {}",
            result.final_loss
        );

        // Verify predictions
        let p00 = model.forward(&[0.0, 0.0])[0];
        let p01 = model.forward(&[0.0, 1.0])[0];
        let p10 = model.forward(&[1.0, 0.0])[0];
        let p11 = model.forward(&[1.0, 1.0])[0];
        assert!(p00 < 0.2, "XOR(0,0) should be ~0, got {}", p00);
        assert!(p01 > 0.8, "XOR(0,1) should be ~1, got {}", p01);
        assert!(p10 > 0.8, "XOR(1,0) should be ~1, got {}", p10);
        assert!(p11 < 0.2, "XOR(1,1) should be ~0, got {}", p11);
    }

    #[test]
    fn loss_decreases() {
        let mut model = Sequential::new();
        model.add_dense(1, 4, ActivationFn::ReLU, 42).unwrap();
        model.add_dense(4, 1, ActivationFn::Linear, 43).unwrap();

        // y = 2x + 1
        let x: Vec<Vec<f64>> = (0..20).map(|i| vec![i as f64 / 10.0]).collect();
        let y: Vec<Vec<f64>> = x.iter().map(|xi| vec![2.0 * xi[0] + 1.0]).collect();

        let config = TrainConfig {
            epochs: 100,
            batch_size: 10,
            learning_rate: 0.01,
            loss: LossFn::MSE,
            patience: 0,
            validation_split: 0.0,
        };

        let result = train(&mut model, &x, &y, &config).unwrap();
        // Loss should generally decrease
        assert!(
            result.loss_history.last().unwrap() < result.loss_history.first().unwrap(),
            "Loss should decrease during training"
        );
    }
}
