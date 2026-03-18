//! ONNX export/import for neural network models.
//!
//! Produces a simplified ONNX-compatible JSON representation.
//! Full protobuf ONNX export would require additional dependencies;
//! this module provides a JSON-based interchange format that can be
//! converted to ONNX by the TypeScript layer if needed.

use super::activation::ActivationFn;
use super::layer::Layer;
use super::model::Sequential;
use crate::types::Value;
use serde::{Deserialize, Serialize};

/// Serializable model representation for export/import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelExport {
    pub format: String,
    pub version: u32,
    pub layers: Vec<LayerExport>,
    pub total_params: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerExport {
    pub layer_type: String,
    pub input_size: usize,
    pub output_size: usize,
    pub activation: String,
    pub weights: Vec<f64>,
    pub biases: Vec<f64>,
    #[serde(default)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

/// Export a Sequential model to a JSON-serializable format.
pub fn export_model(model: &Sequential) -> ModelExport {
    let layers: Vec<LayerExport> = model
        .layers
        .iter()
        .map(|layer| match layer {
            Layer::Dense(d) => LayerExport {
                layer_type: "dense".into(),
                input_size: d.input_size,
                output_size: d.output_size,
                activation: format!("{:?}", d.activation).to_lowercase(),
                weights: d.weights.clone(),
                biases: d.biases.clone(),
                extra: std::collections::HashMap::new(),
            },
            Layer::Conv1D(c) => {
                let weights: Vec<f64> = c.filters.iter().flat_map(|f| f.iter().copied()).collect();
                let mut extra = std::collections::HashMap::new();
                extra.insert(
                    "kernel_size".into(),
                    serde_json::json!(c.kernel_size),
                );
                extra.insert(
                    "input_channels".into(),
                    serde_json::json!(c.input_channels),
                );
                LayerExport {
                    layer_type: "conv1d".into(),
                    input_size: c.input_channels,
                    output_size: c.n_filters,
                    activation: format!("{:?}", c.activation).to_lowercase(),
                    weights,
                    biases: c.biases.clone(),
                    extra,
                }
            }
            Layer::Conv2D(c) => {
                let weights: Vec<f64> = c.filters.iter().flat_map(|f| f.iter().copied()).collect();
                let mut extra = std::collections::HashMap::new();
                extra.insert("kernel_h".into(), serde_json::json!(c.kernel_h));
                extra.insert("kernel_w".into(), serde_json::json!(c.kernel_w));
                extra.insert("input_channels".into(), serde_json::json!(c.input_channels));
                extra.insert("stride_h".into(), serde_json::json!(c.stride_h));
                extra.insert("stride_w".into(), serde_json::json!(c.stride_w));
                extra.insert("padding".into(), serde_json::json!(if c.padding { "same" } else { "valid" }));
                LayerExport {
                    layer_type: "conv2d".into(),
                    input_size: c.input_channels,
                    output_size: c.n_filters,
                    activation: format!("{:?}", c.activation).to_lowercase(),
                    weights,
                    biases: c.biases.clone(),
                    extra,
                }
            }
            Layer::Dropout(d) => LayerExport {
                layer_type: "dropout".into(),
                input_size: 0,
                output_size: 0,
                activation: "none".into(),
                weights: vec![],
                biases: vec![],
                extra: {
                    let mut m = std::collections::HashMap::new();
                    m.insert("rate".into(), serde_json::json!(d.rate));
                    m
                },
            },
        })
        .collect();

    ModelExport {
        format: "chainsolve-nn-v1".into(),
        version: 1,
        layers,
        total_params: model.total_params(),
    }
}

/// Import a model from the JSON export format.
pub fn import_model(data: &ModelExport) -> Result<Sequential, String> {
    let mut model = Sequential::new();

    for layer_def in &data.layers {
        match layer_def.layer_type.as_str() {
            "dense" => {
                let act = ActivationFn::from_str(&layer_def.activation);
                // Create layer with dummy seed then overwrite weights
                model.add_dense(
                    layer_def.input_size,
                    layer_def.output_size,
                    act,
                    0,
                )?;
                // Overwrite with imported weights
                if let Some(Layer::Dense(d)) = model.layers.last_mut() {
                    if layer_def.weights.len() == d.weights.len() {
                        d.weights = layer_def.weights.clone();
                    }
                    if layer_def.biases.len() == d.biases.len() {
                        d.biases = layer_def.biases.clone();
                    }
                }
            }
            "dropout" => {
                let rate = layer_def
                    .extra
                    .get("rate")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.5);
                model.add_dropout(rate);
            }
            other => {
                return Err(format!("Unsupported layer type: {}", other));
            }
        }
    }

    Ok(model)
}

/// Export model to a Value::Text containing JSON.
pub fn export_to_value(model: &Sequential) -> Value {
    let export = export_model(model);
    match serde_json::to_string(&export) {
        Ok(json) => Value::Text { value: json },
        Err(e) => Value::error(format!("Failed to export model: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_export_import() {
        let mut model = Sequential::new();
        model
            .add_dense(2, 4, ActivationFn::ReLU, 42)
            .unwrap();
        model
            .add_dense(4, 1, ActivationFn::Sigmoid, 43)
            .unwrap();

        let export = export_model(&model);
        let imported = import_model(&export).unwrap();

        assert_eq!(imported.layers.len(), 2);
        assert_eq!(imported.total_params(), model.total_params());

        // Verify predictions match
        let input = vec![1.0, 0.5];
        let orig_out = model.forward(&input);
        let import_out = imported.forward(&input);
        assert!((orig_out[0] - import_out[0]).abs() < 1e-10);
    }

    #[test]
    fn export_to_json() {
        let mut model = Sequential::new();
        model.add_dense(2, 3, ActivationFn::Tanh, 42).unwrap();
        let value = export_to_value(&model);
        assert!(matches!(value, Value::Text { .. }));
    }
}
