//! ONNX binary export for Sequential neural network models.
//!
//! Generates a valid ONNX ModelProto (protobuf) for Dense/ReLU/Tanh/Sigmoid
//! networks. The result is a byte vector that can be saved as a `.onnx` file
//! and loaded by ONNX Runtime, PyTorch, TensorFlow, etc.
//!
//! Protobuf wire encoding is done manually — no protobuf crate needed.
//! Only supports: Dense layers with None/ReLU/Tanh/Sigmoid activations.
//! The ONNX opset used is 17 (current standard).

use super::activation::ActivationFn;
use super::layer::Layer;
use super::model::Sequential;

// ── Protobuf helpers ─────────────────────────────────────────────────────────

fn write_varint(buf: &mut Vec<u8>, mut v: u64) {
    loop {
        let byte = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            buf.push(byte);
            break;
        } else {
            buf.push(byte | 0x80);
        }
    }
}

/// Write a protobuf field tag (field_number, wire_type).
fn tag(buf: &mut Vec<u8>, field: u32, wire: u32) {
    write_varint(buf, ((field as u64) << 3) | wire as u64);
}

/// Write a length-delimited bytes field.
fn bytes_field(buf: &mut Vec<u8>, field: u32, data: &[u8]) {
    tag(buf, field, 2);
    write_varint(buf, data.len() as u64);
    buf.extend_from_slice(data);
}

/// Write a string field (UTF-8, length-delimited).
fn str_field(buf: &mut Vec<u8>, field: u32, s: &str) {
    bytes_field(buf, field, s.as_bytes());
}

/// Write an int64 (varint) field.
fn int64_field(buf: &mut Vec<u8>, field: u32, v: i64) {
    tag(buf, field, 0);
    write_varint(buf, v as u64);
}

/// Write an embedded message as a length-delimited field.
fn submsg(buf: &mut Vec<u8>, field: u32, data: &[u8]) {
    bytes_field(buf, field, data);
}

// ── ONNX protobuf structures ──────────────────────────────────────────────────

/// Encode a TensorProto for an initializer (float32 row-major).
fn encode_tensor_proto(name: &str, dims: &[i64], data_f32: &[f32]) -> Vec<u8> {
    let mut buf = vec![];
    str_field(&mut buf, 1, name); // name
    int64_field(&mut buf, 2, 1); // data_type = FLOAT (1)
    for &d in dims {
        int64_field(&mut buf, 7, d); // dims (repeated)
    }
    // raw_data: float32 LE bytes
    let raw: Vec<u8> = data_f32.iter().flat_map(|&v| v.to_le_bytes()).collect();
    bytes_field(&mut buf, 9, &raw);
    buf
}

/// Encode a TensorShapeProto dimension (scalar value).
fn encode_dim(value: i64) -> Vec<u8> {
    let mut buf = vec![];
    int64_field(&mut buf, 1, value); // dim_value field 1
    buf
}

/// Encode a TypeProto::Tensor (FLOAT with given dims).
fn encode_type_proto(elem_type: i32, dims: &[Option<i64>]) -> Vec<u8> {
    let mut shape_buf = vec![];
    for dim in dims {
        let dim_buf = if let Some(v) = dim {
            encode_dim(*v)
        } else {
            // symbolic dim — leave empty (dim_param = "" effectively)
            vec![]
        };
        submsg(&mut shape_buf, 1, &dim_buf); // TensorShapeProto.dim
    }

    let mut tensor_buf = vec![];
    tag(&mut tensor_buf, 1, 0);
    write_varint(&mut tensor_buf, elem_type as u64); // elem_type
    submsg(&mut tensor_buf, 2, &shape_buf); // shape

    let mut buf = vec![];
    submsg(&mut buf, 1, &tensor_buf); // tensor_type (oneof field 1 in TypeProto)
    buf
}

/// Encode a ValueInfoProto.
fn encode_value_info(name: &str, dims: &[Option<i64>]) -> Vec<u8> {
    let mut buf = vec![];
    str_field(&mut buf, 1, name);
    let type_proto = encode_type_proto(1, dims); // FLOAT = 1
    submsg(&mut buf, 2, &type_proto);
    buf
}

/// Encode an AttributeProto with an int64 value.
fn encode_attr_int(name: &str, value: i64) -> Vec<u8> {
    let mut buf = vec![];
    str_field(&mut buf, 1, name);
    int64_field(&mut buf, 4, value); // i field
    // type = INT = 1
    tag(&mut buf, 20, 0);
    write_varint(&mut buf, 1);
    buf
}

/// Encode a NodeProto.
fn encode_node(
    inputs: &[&str],
    outputs: &[&str],
    name: &str,
    op_type: &str,
    attrs: &[Vec<u8>],
) -> Vec<u8> {
    let mut buf = vec![];
    for inp in inputs {
        str_field(&mut buf, 1, inp);
    }
    for out in outputs {
        str_field(&mut buf, 2, out);
    }
    str_field(&mut buf, 3, name);
    str_field(&mut buf, 4, op_type);
    for attr in attrs {
        submsg(&mut buf, 5, attr);
    }
    buf
}

// ── Main export function ──────────────────────────────────────────────────────

/// Export a Sequential model to ONNX protobuf bytes.
///
/// Returns `Err` if the model is empty or contains unsupported layers.
/// Input shape: [batch, input_size]. Batch dimension is dynamic (None).
pub fn export_onnx(model: &Sequential, model_name: &str) -> Result<Vec<u8>, String> {
    if model.layers.is_empty() {
        return Err("Cannot export empty model".to_string());
    }

    let mut initializers: Vec<Vec<u8>> = vec![];
    let mut nodes: Vec<Vec<u8>> = vec![];
    let mut current_input = "input".to_string();
    let mut layer_idx = 0usize;
    let mut input_size = 0usize;

    for layer in &model.layers {
        match layer {
            Layer::Dense(d) => {
                if layer_idx == 0 {
                    input_size = d.input_size;
                }

                let w_name = format!("W{layer_idx}");
                let b_name = format!("B{layer_idx}");
                let gemm_out = format!("gemm_out{layer_idx}");

                // Weights: shape [output_size, input_size] (ONNX Gemm transB=1)
                let w_f32: Vec<f32> = d.weights.iter().map(|&v| v as f32).collect();
                initializers.push(encode_tensor_proto(
                    &w_name,
                    &[d.output_size as i64, d.input_size as i64],
                    &w_f32,
                ));

                // Biases: shape [output_size]
                let b_f32: Vec<f32> = d.biases.iter().map(|&v| v as f32).collect();
                initializers.push(encode_tensor_proto(
                    &b_name,
                    &[d.output_size as i64],
                    &b_f32,
                ));

                // Gemm node: Y = alpha * A * B^T + beta * C, transB=1
                let trans_b_attr = encode_attr_int("transB", 1);
                nodes.push(encode_node(
                    &[&current_input, &w_name, &b_name],
                    &[&gemm_out],
                    &format!("Gemm{layer_idx}"),
                    "Gemm",
                    &[trans_b_attr],
                ));

                // Activation node
                let act_out = match d.activation {
                    ActivationFn::ReLU => {
                        let out = format!("relu_out{layer_idx}");
                        nodes.push(encode_node(
                            &[&gemm_out],
                            &[&out],
                            &format!("Relu{layer_idx}"),
                            "Relu",
                            &[],
                        ));
                        out
                    }
                    ActivationFn::Tanh => {
                        let out = format!("tanh_out{layer_idx}");
                        nodes.push(encode_node(
                            &[&gemm_out],
                            &[&out],
                            &format!("Tanh{layer_idx}"),
                            "Tanh",
                            &[],
                        ));
                        out
                    }
                    ActivationFn::Sigmoid => {
                        let out = format!("sigmoid_out{layer_idx}");
                        nodes.push(encode_node(
                            &[&gemm_out],
                            &[&out],
                            &format!("Sigmoid{layer_idx}"),
                            "Sigmoid",
                            &[],
                        ));
                        out
                    }
                    _ => gemm_out.clone(), // Linear/None/Softmax — pass through
                };

                current_input = act_out;
                layer_idx += 1;
            }
            Layer::Dropout(_) => {
                // Skip dropout in inference export
            }
            _ => {
                return Err(format!(
                    "ONNX export: unsupported layer type (only Dense supported)"
                ));
            }
        }
    }

    if layer_idx == 0 {
        return Err("No Dense layers found in model".to_string());
    }

    let output_name = &current_input;

    // ── Graph ────────────────────────────────────────────────────────────────
    let mut graph_buf = vec![];

    // Nodes
    for node in &nodes {
        submsg(&mut graph_buf, 1, node);
    }

    // Graph name
    str_field(&mut graph_buf, 2, model_name);

    // Initializers
    for init in &initializers {
        submsg(&mut graph_buf, 5, init);
    }

    // Graph input: [batch, input_size]
    let input_vi = encode_value_info("input", &[None, Some(input_size as i64)]);
    submsg(&mut graph_buf, 11, &input_vi);

    // Graph output: dynamic shape
    let output_vi = encode_value_info(output_name, &[None, None]);
    submsg(&mut graph_buf, 12, &output_vi);

    // ── ModelProto ───────────────────────────────────────────────────────────
    let mut model_buf = vec![];

    // ir_version = 8 (ONNX IR v8, matches opset 17)
    int64_field(&mut model_buf, 1, 8);

    // opset_import: {domain: "", version: 17}
    let mut opset_buf = vec![];
    str_field(&mut opset_buf, 1, ""); // default domain
    int64_field(&mut opset_buf, 2, 17);
    submsg(&mut model_buf, 8, &opset_buf);

    // graph
    submsg(&mut model_buf, 7, &graph_buf);

    // producer metadata
    str_field(&mut model_buf, 12, "ChainSolve");
    str_field(&mut model_buf, 13, "1.0");

    Ok(model_buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::nn::activation::ActivationFn;

    #[test]
    fn export_produces_valid_bytes() {
        let mut model = Sequential::new();
        model.add_dense(2, 4, ActivationFn::ReLU, 42).unwrap();
        model.add_dense(4, 1, ActivationFn::Sigmoid, 43).unwrap();
        let bytes = export_onnx(&model, "test_model").unwrap();
        // Check ONNX file begins with valid protobuf structure (field 1 = ir_version)
        assert!(!bytes.is_empty());
        // First byte should be field tag: (1 << 3) | 0 = 0x08
        assert_eq!(bytes[0], 0x08);
    }
}
