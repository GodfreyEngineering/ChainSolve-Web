//! Per-node evaluation dispatch for all ~60 block types.
//!
//! # Entry point
//!
//! [`evaluate_node`] (and the dataset-aware [`evaluate_node_with_datasets`]) are
//! the only public functions. The graph evaluator calls one of them once per node
//! in topological order.
//!
//! # Broadcasting
//!
//! Most binary ops (add, multiply, …) support mixed Scalar/Vector operands:
//!
//! - Scalar  ⊕ Scalar  → Scalar
//! - Scalar  ⊕ Vector  → Vector (broadcast scalar across each element)
//! - Vector  ⊕ Scalar  → Vector
//! - Vector  ⊕ Vector  → Vector (element-wise; lengths must match or Error)
//! - Any     ⊕ Error   → Error  (error propagates)
//! - Table inputs pass through unchanged for ops that accept them.
//!
//! # Error propagation
//!
//! If any required input is `Value::Error`, the node immediately returns
//! `Value::Error` without computing. NaN and Inf propagate for scalar paths
//! (e.g. `1.0 / 0.0 → Inf`, `0.0 / 0.0 → NaN`).

use crate::types::Value;
use std::collections::HashMap;

/// Phase 3.8: Try HP arithmetic if data.precision is set and inputs are scalar.
/// Falls back to normal nary_broadcast if no precision or non-scalar inputs.
fn hp_or_broadcast(
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
    f64_op: impl Fn(f64, f64) -> f64 + Copy,
    hp_op: impl Fn(&str, &str, u32) -> Result<(String, f64), String>,
) -> Value {
    // Check for precision override in node data
    if let Some(prec) = data.get("precision").and_then(|v| v.as_u64()) {
        let precision = prec as u32;
        // Only HP for simple binary scalar case (a/b ports)
        if let (Some(Value::Scalar { value: a }), Some(Value::Scalar { value: b })) =
            (inputs.get("a"), inputs.get("b"))
        {
            match hp_op(&a.to_string(), &b.to_string(), precision) {
                Ok((display, approx)) => {
                    return Value::HighPrecision { display, approx, precision };
                }
                Err(_) => {
                    // Fall through to f64
                }
            }
        }
    }
    // Default: normal broadcast
    nary_broadcast(inputs, f64_op)
}

/// Read an f64 from a node's data map, falling back to a default.
fn scalar_or(data: &HashMap<String, serde_json::Value>, key: &str, default: f64) -> f64 {
    data.get(key).and_then(|v| v.as_f64()).unwrap_or(default)
}

/// Evaluate a single node given its block type, resolved input values,
/// the node's own data map, and an optional dataset registry.
///
/// Unknown block types return `Value::Error`.
pub fn evaluate_node(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
) -> Value {
    evaluate_node_with_datasets(block_type, inputs, data, None)
}

/// Like `evaluate_node` but with access to a dataset registry.
/// Data blocks (`vectorInput`, `tableInput`, `csvImport`) will check
/// `data.datasetRef` and look up large arrays from the registry.
pub fn evaluate_node_with_datasets(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
    datasets: Option<&HashMap<String, Vec<f64>>>,
) -> Value {
    let raw = evaluate_node_inner(block_type, inputs, data, datasets);
    canonicalize_value(raw)
}

/// Inner dispatch — not canonicalized. Called by evaluate_node_with_datasets.
fn evaluate_node_inner(
    block_type: &str,
    inputs: &HashMap<String, Value>,
    data: &HashMap<String, serde_json::Value>,
    datasets: Option<&HashMap<String, Vec<f64>>>,
) -> Value {
    match block_type {
        // ── Sources (0 inputs) ────────────────────────────────────
        "number" | "slider" | "variableSource" | "boolean_input" => {
            let v = data
                .get("value")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            Value::scalar(v)
        }

        // Constants
        "pi" => Value::scalar(std::f64::consts::PI),
        "euler" => Value::scalar(std::f64::consts::E),
        "tau" => Value::scalar(std::f64::consts::TAU),
        "phi" => Value::scalar(1.618_033_988_749_895),
        "ln2" => Value::scalar(std::f64::consts::LN_2),
        "ln10" => Value::scalar(std::f64::consts::LN_10),
        "sqrt2" => Value::scalar(std::f64::consts::SQRT_2),
        "inf" => Value::scalar(f64::INFINITY),

        // ── W11c: Constants & Presets (0 inputs → 1 scalar) ──────
        // Math (canonical const.math.* IDs — SCI-01)
        "const.math.pi"     => Value::scalar(std::f64::consts::PI),
        "const.math.e"      => Value::scalar(std::f64::consts::E),
        "const.math.tau"    => Value::scalar(std::f64::consts::TAU),
        "const.math.phi"    => Value::scalar(1.618_033_988_749_894_848_2),
        "const.math.sqrt2"  => Value::scalar(std::f64::consts::SQRT_2),
        "const.math.ln2"    => Value::scalar(std::f64::consts::LN_2),
        "const.math.ln10"   => Value::scalar(std::f64::consts::LN_10),
        // Physics — CODATA 2022 values (SCI-01)
        "const.physics.g0"        => Value::scalar(9.806_65),                    // exact (CGPM 1901)
        "const.physics.R_molar" | "const.physics.R" => Value::scalar(8.314_462_618),           // exact (SI 2019)
        "const.physics.c"         => Value::scalar(299_792_458.0),               // exact (SI 2019)
        "const.physics.h"         => Value::scalar(6.626_070_15e-34),            // exact (SI 2019)
        "const.physics.hbar"      => Value::scalar(1.054_571_817_646_156_5e-34), // CODATA 2022
        "const.physics.kB"        => Value::scalar(1.380_649e-23),               // exact (SI 2019)
        "const.physics.Na" | "const.physics.NA" => Value::scalar(6.022_140_76e23),              // exact (SI 2019)
        "const.physics.qe" | "const.physics.e" => Value::scalar(1.602_176_634e-19),             // exact (SI 2019)
        "const.physics.F"         => Value::scalar(96_485.332_12),               // CODATA 2022
        "const.physics.me"        => Value::scalar(9.109_383_713_9e-31),         // CODATA 2022
        "const.physics.mp"        => Value::scalar(1.672_621_925_95e-27),        // CODATA 2022
        "const.physics.G"         => Value::scalar(6.674_30e-11),                // CODATA 2022
        "const.physics.mu0"       => Value::scalar(1.256_637_061_27e-6),         // CODATA 2022
        "const.physics.eps0"      => Value::scalar(8.854_187_818_8e-12),         // CODATA 2022
        "const.physics.sigma_sb" | "const.physics.sigma" => Value::scalar(5.670_374_419e-8),   // exact (SI 2019)
        // Atmosphere (typical ISA values)
        "const.atmos.p0_pa"       => Value::scalar(101_325.0),
        "const.atmos.t0_k"        => Value::scalar(288.15),
        "const.atmos.rho_air_sl"  => Value::scalar(1.225),
        "const.atmos.gamma_air"   => Value::scalar(1.4),
        "const.atmos.R_air"       => Value::scalar(287.05),
        "const.atmos.mu_air_20c"  => Value::scalar(1.81e-5),
        "const.atmos.a_air_20c"   => Value::scalar(343.0),
        // Thermo (typical ~20°C values)
        "const.thermo.cp_air"     => Value::scalar(1005.0),
        "const.thermo.cv_air"     => Value::scalar(718.0),
        "const.thermo.k_air"      => Value::scalar(0.0262),
        "const.thermo.k_water"    => Value::scalar(0.6),
        // Electrical (typical ~20°C values)
        "const.elec.rho_copper"     => Value::scalar(1.68e-8),
        "const.elec.rho_aluminium"  => Value::scalar(2.82e-8),
        // Preset → Materials (typical engineering values)
        "preset.materials.steel_rho" => Value::scalar(7850.0),
        "preset.materials.steel_E"   => Value::scalar(200e9),
        "preset.materials.steel_nu"  => Value::scalar(0.30),
        "preset.materials.al_rho"    => Value::scalar(2700.0),
        "preset.materials.al_E"      => Value::scalar(69e9),
        "preset.materials.al_nu"     => Value::scalar(0.33),
        "preset.materials.ti_rho"    => Value::scalar(4430.0),
        "preset.materials.ti_E"      => Value::scalar(116e9),
        "preset.materials.ti_nu"     => Value::scalar(0.34),
        // Preset → Fluids (typical values)
        "preset.fluids.water_rho_20c"  => Value::scalar(998.0),
        "preset.fluids.water_mu_20c"   => Value::scalar(1.002e-3),
        "preset.fluids.gasoline_rho"   => Value::scalar(745.0),
        "preset.fluids.diesel_rho"     => Value::scalar(832.0),

        // ── Math (2 inputs: a, b or 1 input: in) ─────────────────
        // Phase 3.8: When data.precision is set, use HP arithmetic for scalar ops.
        "add" => hp_or_broadcast(inputs, data, |a, b| a + b, crate::precision::hp_add),
        "subtract" => hp_or_broadcast(inputs, data, |a, b| a - b, crate::precision::hp_sub),
        "multiply" => hp_or_broadcast(inputs, data, |a, b| a * b, crate::precision::hp_mul),
        "divide" => hp_or_broadcast(inputs, data, |a, b| a / b, crate::precision::hp_div),
        "power" => binary_broadcast_ports(inputs, "base", "exp", |base, exp| base.powf(exp)),
        "mod" => binary_broadcast(inputs, |a, b| a % b),
        "clamp" => {
            let x = scalar_or_nan(inputs, "val");
            let lo = scalar_or_nan(inputs, "min");
            let hi = scalar_or_nan(inputs, "max");
            Value::scalar(x.max(lo).min(hi))
        }
        "negate" => unary_broadcast(inputs, |x| -x),
        "abs" => unary_broadcast(inputs, |x| x.abs()),
        "sqrt" => unary_broadcast(inputs, |x| x.sqrt()),
        "floor" => unary_broadcast(inputs, |x| x.floor()),
        "ceil" => unary_broadcast(inputs, |x| x.ceil()),
        "round" => unary_broadcast(inputs, |x| x.round()),
        "trunc" => unary_broadcast(inputs, |x| x.trunc()),
        "sign" => unary_broadcast(inputs, |x| {
            if x > 0.0 { 1.0 } else if x < 0.0 { -1.0 } else { 0.0 }
        }),
        "ln" => unary_broadcast(inputs, |x| x.ln()),
        "log10" => unary_broadcast(inputs, |x| x.log10()),
        "exp" => unary_broadcast(inputs, |x| x.exp()),
        "log_base" => binary_broadcast_ports(inputs, "val", "base", |val, base| val.ln() / base.ln()),
        "roundn" => {
            let val = scalar_or_nan(inputs, "val");
            let digits = scalar_or_nan(inputs, "digits");
            let factor = 10_f64.powf(digits.round());
            Value::scalar((val * factor).round() / factor)
        }

        // ── Trig ──────────────────────────────────────────────────
        // angleUnit: if data["angleUnit"] == "deg", convert deg→rad on input
        // for forward trig and rad→deg on output for inverse trig.
        "sin" | "cos" | "tan" | "asin" | "acos" | "atan" => {
            let deg_mode = data.get("angleUnit")
                .and_then(|v| v.as_str()) == Some("deg");
            match block_type {
                "sin" => if deg_mode {
                    unary_broadcast(inputs, |x| (x * std::f64::consts::PI / 180.0).sin())
                } else {
                    unary_broadcast(inputs, |x| x.sin())
                },
                "cos" => if deg_mode {
                    unary_broadcast(inputs, |x| (x * std::f64::consts::PI / 180.0).cos())
                } else {
                    unary_broadcast(inputs, |x| x.cos())
                },
                "tan" => if deg_mode {
                    unary_broadcast(inputs, |x| (x * std::f64::consts::PI / 180.0).tan())
                } else {
                    unary_broadcast(inputs, |x| x.tan())
                },
                "asin" => if deg_mode {
                    unary_broadcast(inputs, |x| x.asin() * 180.0 / std::f64::consts::PI)
                } else {
                    unary_broadcast(inputs, |x| x.asin())
                },
                "acos" => if deg_mode {
                    unary_broadcast(inputs, |x| x.acos() * 180.0 / std::f64::consts::PI)
                } else {
                    unary_broadcast(inputs, |x| x.acos())
                },
                "atan" => if deg_mode {
                    unary_broadcast(inputs, |x| x.atan() * 180.0 / std::f64::consts::PI)
                } else {
                    unary_broadcast(inputs, |x| x.atan())
                },
                _ => unreachable!(),
            }
        }
        "atan2" => {
            let deg_mode = data.get("angleUnit")
                .and_then(|v| v.as_str()) == Some("deg");
            if deg_mode {
                binary_broadcast_ports(inputs, "y", "x", |y, x| y.atan2(x) * 180.0 / std::f64::consts::PI)
            } else {
                binary_broadcast_ports(inputs, "y", "x", |y, x| y.atan2(x))
            }
        }
        "degToRad" => unary_broadcast_port(inputs, "deg", |d| d.to_radians()),
        "radToDeg" => unary_broadcast_port(inputs, "rad", |r| r.to_degrees()),

        // ── Logic ─────────────────────────────────────────────────
        "greater" => binary_broadcast(inputs, |a, b| if a > b { 1.0 } else { 0.0 }),
        "less" => binary_broadcast(inputs, |a, b| if a < b { 1.0 } else { 0.0 }),
        "equal" => binary_broadcast(inputs, |a, b| if (a - b).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
        "max" => nary_broadcast(inputs, |a, b| a.max(b)),
        "min" => nary_broadcast(inputs, |a, b| a.min(b)),
        "ifthenelse" => {
            let cond = scalar_or_nan(inputs, "cond");
            let then = scalar_or_nan(inputs, "then");
            let els = scalar_or_nan(inputs, "else");
            Value::scalar(if cond != 0.0 { then } else { els })
        }

        // ── Output (pass-through) ────────────────────────────────
        // H7-1: "publish" is a pass-through like display.
        // V2-006: "probe" removed from UI but kept here for backward compat.
        "display" | "probe" | "publish" => {
            inputs
                .get("value")
                .cloned()
                .unwrap_or(Value::scalar(f64::NAN))
        }

        // H7-1: "subscribe" reads the resolved value from node data (TS bridge injects it).
        "subscribe" => {
            let v = data
                .get("value")
                .and_then(|v| v.as_f64())
                .unwrap_or(f64::NAN);
            Value::scalar(v)
        }

        // ── Data blocks (0 inputs, read from node data or dataset registry) ────
        "vectorInput" => {
            // Check dataset registry first (zero-copy path for large arrays).
            if let Some(ds_id) = data.get("datasetRef").and_then(|v| v.as_str()) {
                if let Some(ds) = datasets.and_then(|d| d.get(ds_id)) {
                    return Value::Vector { value: ds.clone() };
                }
            }
            match data.get("vectorData").and_then(|v| v.as_array()) {
                Some(arr) => {
                    let values: Vec<f64> = arr.iter().filter_map(|v| v.as_f64()).collect();
                    Value::Vector { value: values }
                }
                None => Value::Vector { value: vec![] },
            }
        }
        "parameter_sweep" => {
            // Generate a vector from start/stop/step or from an explicit list.
            if let Some(list) = data.get("values").and_then(|v| v.as_array()) {
                let values: Vec<f64> = list.iter().filter_map(|v| v.as_f64()).collect();
                Value::Vector { value: values }
            } else {
                let start = data.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let stop = data.get("stop").and_then(|v| v.as_f64()).unwrap_or(10.0);
                let step = data.get("step").and_then(|v| v.as_f64()).unwrap_or(1.0);
                if step == 0.0 || (stop - start).is_sign_positive() != step.is_sign_positive() {
                    Value::Vector { value: vec![] }
                } else {
                    let n = ((stop - start) / step).floor() as usize + 1;
                    let n = n.min(100_000); // safety cap
                    let values: Vec<f64> = (0..n).map(|i| start + step * i as f64).collect();
                    Value::Vector { value: values }
                }
            }
        }
        "tableInput" => {
            // Read table data from node data: { columns: [...], rows: [[...], ...] }
            match data.get("tableData") {
                Some(td) => {
                    let columns: Vec<String> = td
                        .get("columns")
                        .and_then(|c| c.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();
                    let rows: Vec<Vec<f64>> = td
                        .get("rows")
                        .and_then(|r| r.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|row| {
                                    row.as_array().map(|cells| {
                                        cells.iter().map(|c| c.as_f64().unwrap_or(0.0)).collect()
                                    })
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    Value::Table { columns, rows }
                }
                None => Value::Table {
                    columns: vec![],
                    rows: vec![],
                },
            }
        }
        "table_extract_col" => {
            // Extract a column vector from a table by index
            match inputs.get("table") {
                Some(Value::Table { columns: _, rows }) => {
                    let idx = match inputs.get("index") {
                        Some(v) => v.as_scalar().unwrap_or(0.0) as usize,
                        None => 0,
                    };
                    let col: Vec<f64> = rows
                        .iter()
                        .map(|row| row.get(idx).copied().unwrap_or(0.0))
                        .collect();
                    Value::Vector { value: col }
                }
                Some(Value::Error { message }) => Value::Error {
                    message: message.clone(),
                },
                _ => Value::error("Table Column: expected table input"),
            }
        }
        "material_full" => {
            // Phase 10: Multi-output material block.
            // Reads materialProperties from node data → returns Table with
            // property names as columns and a single row of values.
            // Output handles use prop_<key> naming (resolved in eval.rs/graph.rs).
            match data.get("materialProperties") {
                Some(mp) if mp.is_object() => {
                    let obj = mp.as_object().unwrap();
                    let mut columns: Vec<String> = Vec::new();
                    let mut values: Vec<f64> = Vec::new();
                    // Canonical order: rho, E, nu, k, cp, sigma_y, mu
                    for key in &["rho", "E", "nu", "k", "cp", "sigma_y", "mu"] {
                        if let Some(v) = obj.get(*key) {
                            columns.push(key.to_string());
                            values.push(v.as_f64().unwrap_or(0.0));
                        }
                    }
                    if columns.is_empty() {
                        Value::error("Material: no properties selected")
                    } else {
                        Value::Table {
                            columns,
                            rows: vec![values],
                        }
                    }
                }
                _ => Value::error("Material: no material selected"),
            }
        }
        // ── Vector / List ops ────────────────────────────────────
        "vectorLength" => match require_vector(inputs, "vec", "Length") {
            Ok(v) => Value::scalar(v.len() as f64),
            Err(e) => e,
        },
        "vectorSum" => match require_vector(inputs, "vec", "Sum") {
            Ok(v) => Value::scalar(kahan_sum(v.iter().copied())),
            Err(e) => e,
        },
        "vectorMean" => match require_vector(inputs, "vec", "Mean") {
            Ok(v) if v.is_empty() => Value::error("Mean: empty vector"),
            Ok(v) => Value::scalar(kahan_sum(v.iter().copied()) / v.len() as f64),
            Err(e) => e,
        },
        "vectorMin" => match require_vector(inputs, "vec", "Min") {
            Ok(v) if v.is_empty() => Value::error("Min: empty vector"),
            Ok(v) => Value::scalar(v.iter().cloned().fold(f64::INFINITY, f64::min)),
            Err(e) => e,
        },
        "vectorMax" => match require_vector(inputs, "vec", "Max") {
            Ok(v) if v.is_empty() => Value::error("Max: empty vector"),
            Ok(v) => Value::scalar(v.iter().cloned().fold(f64::NEG_INFINITY, f64::max)),
            Err(e) => e,
        },
        "vectorSort" => match require_vector(inputs, "vec", "Sort") {
            Ok(v) => {
                let mut sorted = v.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                Value::Vector { value: sorted }
            }
            Err(e) => e,
        },
        "vectorReverse" => match require_vector(inputs, "vec", "Reverse") {
            Ok(v) => {
                let mut rev = v.clone();
                rev.reverse();
                Value::Vector { value: rev }
            }
            Err(e) => e,
        },
        "vectorSlice" => match require_vector(inputs, "vec", "Slice") {
            Ok(v) => {
                let s = scalar_or_nan(inputs, "start");
                let e = scalar_or_nan(inputs, "end");
                let start = if s.is_nan() { 0 } else { s.floor() as usize };
                let end = if e.is_nan() { v.len() } else { e.floor() as usize };
                let start = start.min(v.len());
                let end = end.min(v.len()).max(start);
                Value::Vector { value: v[start..end].to_vec() }
            }
            Err(e) => e,
        },
        "vectorConcat" => {
            let a = require_vector(inputs, "a", "Concat");
            let b = require_vector(inputs, "b", "Concat");
            match (a, b) {
                (Ok(va), Ok(vb)) => {
                    let mut result = va.clone();
                    result.extend_from_slice(&vb);
                    Value::Vector { value: result }
                }
                (Err(e), _) | (_, Err(e)) => e,
            }
        }
        "vectorMap" => match require_vector(inputs, "vec", "Map") {
            Ok(v) => {
                let s = scalar_or_nan(inputs, "scalar");
                if s.is_nan() {
                    Value::error("Map: expected scalar multiplier")
                } else {
                    Value::Vector { value: v.iter().map(|x| x * s).collect() }
                }
            }
            Err(e) => e,
        },

        // ── Plot blocks (terminal, return point count) ──────────
        "xyPlot" | "histogram" | "barChart" | "heatmap" => {
            data_point_count(inputs.get("data"))
        }

        // ── List table (terminal, pass-through for UI rendering) ──
        "listTable" => {
            inputs
                .get("data")
                .cloned()
                .unwrap_or(Value::error("No data"))
        }

        // ── Engineering → Mechanics ──────────────────────────────────
        "eng.mechanics.v_from_uat" => {
            let u = scalar_or_nan(inputs, "u");
            let a = scalar_or_nan(inputs, "a");
            let t = scalar_or_nan(inputs, "t");
            Value::scalar(u + a * t)
        }
        "eng.mechanics.s_from_ut_a_t" => {
            let u = scalar_or_nan(inputs, "u");
            let t = scalar_or_nan(inputs, "t");
            let a = scalar_or_nan(inputs, "a");
            Value::scalar(u * t + 0.5 * a * t * t)
        }
        "eng.mechanics.v2_from_u2_as" => {
            let u = scalar_or_nan(inputs, "u");
            let a = scalar_or_nan(inputs, "a");
            let s = scalar_or_nan(inputs, "s");
            let disc = u * u + 2.0 * a * s;
            if disc < 0.0 {
                Value::error("v\u{00B2}: discriminant < 0")
            } else {
                Value::scalar(disc.sqrt())
            }
        }
        "eng.mechanics.force_ma" => binary_broadcast_ports(inputs, "m", "a", |m, a| m * a),
        "eng.mechanics.weight_mg" => binary_broadcast_ports(inputs, "m", "g", |m, g| m * g),
        "eng.mechanics.momentum_mv" => binary_broadcast_ports(inputs, "m", "v", |m, v| m * v),
        "eng.mechanics.kinetic_energy" => {
            let m = scalar_or_nan(inputs, "m");
            let v = scalar_or_nan(inputs, "v");
            Value::scalar(0.5 * m * v * v)
        }
        "eng.mechanics.potential_energy" => {
            let m = scalar_or_nan(inputs, "m");
            let g = scalar_or_nan(inputs, "g");
            let h = scalar_or_nan(inputs, "h");
            Value::scalar(m * g * h)
        }
        "eng.mechanics.work_Fs" => binary_broadcast_ports(inputs, "F", "s", |f, s| f * s),
        "eng.mechanics.power_work_time" => {
            let w = scalar_or_nan(inputs, "W");
            let t = scalar_or_nan(inputs, "t");
            if t == 0.0 {
                Value::error("Power: t = 0")
            } else {
                Value::scalar(w / t)
            }
        }
        "eng.mechanics.power_Fv" => binary_broadcast_ports(inputs, "F", "v", |f, v| f * v),
        "eng.mechanics.torque_Fr" => binary_broadcast_ports(inputs, "F", "r", |f, r| f * r),
        "eng.mechanics.omega_from_rpm" => {
            unary_broadcast_port(inputs, "rpm", |rpm| rpm * std::f64::consts::TAU / 60.0)
        }
        "eng.mechanics.rpm_from_omega" => {
            unary_broadcast_port(inputs, "omega", |w| w * 60.0 / std::f64::consts::TAU)
        }
        "eng.mechanics.power_rot_Tomega" => {
            binary_broadcast_ports(inputs, "T", "omega", |t, w| t * w)
        }
        "eng.mechanics.centripetal_acc" => {
            let v = scalar_or_nan(inputs, "v");
            let r = scalar_or_nan(inputs, "r");
            if r == 0.0 {
                Value::error("Centripetal: r = 0")
            } else {
                Value::scalar(v * v / r)
            }
        }
        "eng.mechanics.centripetal_force" => {
            let m = scalar_or_nan(inputs, "m");
            let v = scalar_or_nan(inputs, "v");
            let r = scalar_or_nan(inputs, "r");
            if r == 0.0 {
                Value::error("Centripetal: r = 0")
            } else {
                Value::scalar(m * v * v / r)
            }
        }

        "eng.mechanics.friction_force" => {
            // F_friction = μ * N
            let mu = scalar_or_nan(inputs, "mu");
            let n = scalar_or_nan(inputs, "N");
            Value::scalar(mu * n)
        }
        "eng.mechanics.impulse" => {
            // J = F * Δt
            let f = scalar_or_nan(inputs, "F");
            let dt = scalar_or_nan(inputs, "dt");
            Value::scalar(f * dt)
        }

        // ── Engineering → Materials & Strength ───────────────────────
        "eng.materials.stress_F_A" => {
            let f = scalar_or_nan(inputs, "F");
            let a = scalar_or_nan(inputs, "A");
            if a == 0.0 {
                Value::error("Stress: A = 0")
            } else {
                Value::scalar(f / a)
            }
        }
        "eng.materials.strain_dL_L" => {
            let dl = scalar_or_nan(inputs, "dL");
            let l = scalar_or_nan(inputs, "L");
            if l == 0.0 {
                Value::error("Strain: L = 0")
            } else {
                Value::scalar(dl / l)
            }
        }
        "eng.materials.youngs_modulus" => {
            let sigma = scalar_or_nan(inputs, "sigma");
            let eps = scalar_or_nan(inputs, "epsilon");
            if eps == 0.0 {
                Value::error("Young's modulus: \u{03B5} = 0")
            } else {
                Value::scalar(sigma / eps)
            }
        }
        "eng.materials.pressure_F_A" => {
            let f = scalar_or_nan(inputs, "F");
            let a = scalar_or_nan(inputs, "A");
            if a == 0.0 {
                Value::error("Pressure: A = 0")
            } else {
                Value::scalar(f / a)
            }
        }
        "eng.materials.safety_factor" => {
            let strength = scalar_or_nan(inputs, "strength");
            let stress = scalar_or_nan(inputs, "stress");
            if stress == 0.0 {
                Value::error("Safety factor: stress = 0")
            } else {
                Value::scalar(strength / stress)
            }
        }
        "eng.materials.spring_force_kx" => {
            binary_broadcast_ports(inputs, "k", "x", |k, x| k * x)
        }
        "eng.materials.spring_energy" => {
            let k = scalar_or_nan(inputs, "k");
            let x = scalar_or_nan(inputs, "x");
            Value::scalar(0.5 * k * x * x)
        }

        // ── Engineering → Section Properties ─────────────────────────
        "eng.sections.area_circle" => {
            unary_broadcast_port(inputs, "d", |d| std::f64::consts::PI * d * d / 4.0)
        }
        "eng.sections.area_annulus" => {
            let d_o = scalar_or_nan(inputs, "d_outer");
            let d_i = scalar_or_nan(inputs, "d_inner");
            let diff = d_o * d_o - d_i * d_i;
            if diff < 0.0 {
                Value::error("Annulus: d_inner > d_outer")
            } else {
                Value::scalar(std::f64::consts::PI * diff / 4.0)
            }
        }
        "eng.sections.I_rect" => {
            let b = scalar_or_nan(inputs, "b");
            let h = scalar_or_nan(inputs, "h");
            Value::scalar(b * h * h * h / 12.0)
        }
        "eng.sections.I_circle" => {
            unary_broadcast_port(inputs, "d", |d| std::f64::consts::PI * d.powi(4) / 64.0)
        }
        "eng.sections.J_circle" => {
            unary_broadcast_port(inputs, "d", |d| std::f64::consts::PI * d.powi(4) / 32.0)
        }
        "eng.sections.bending_stress" => {
            let m_val = scalar_or_nan(inputs, "M");
            let y = scalar_or_nan(inputs, "y");
            let i = scalar_or_nan(inputs, "I");
            if i == 0.0 {
                Value::error("Bending stress: I = 0")
            } else {
                Value::scalar(m_val * y / i)
            }
        }
        "eng.sections.torsional_shear" => {
            let t = scalar_or_nan(inputs, "T");
            let r = scalar_or_nan(inputs, "r");
            let j = scalar_or_nan(inputs, "J");
            if j == 0.0 {
                Value::error("Torsional shear: J = 0")
            } else {
                Value::scalar(t * r / j)
            }
        }

        // ── Engineering → Rotational Inertia ─────────────────────────
        "eng.inertia.solid_cylinder" => {
            let m = scalar_or_nan(inputs, "m");
            let r = scalar_or_nan(inputs, "r");
            Value::scalar(0.5 * m * r * r)
        }
        "eng.inertia.hollow_cylinder" => {
            let m = scalar_or_nan(inputs, "m");
            let ri = scalar_or_nan(inputs, "r_inner");
            let ro = scalar_or_nan(inputs, "r_outer");
            Value::scalar(0.5 * m * (ri * ri + ro * ro))
        }
        "eng.inertia.solid_sphere" => {
            let m = scalar_or_nan(inputs, "m");
            let r = scalar_or_nan(inputs, "r");
            Value::scalar(0.4 * m * r * r)
        }
        "eng.inertia.rod_center" => {
            let m = scalar_or_nan(inputs, "m");
            let l = scalar_or_nan(inputs, "L");
            Value::scalar(m * l * l / 12.0)
        }
        "eng.inertia.rod_end" => {
            let m = scalar_or_nan(inputs, "m");
            let l = scalar_or_nan(inputs, "L");
            Value::scalar(m * l * l / 3.0)
        }

        // ── Engineering → Fluids ─────────────────────────────────────
        "eng.fluids.flow_Q_from_Av" => {
            binary_broadcast_ports(inputs, "A", "v", |a, v| a * v)
        }
        "eng.fluids.velocity_from_QA" => {
            let q = scalar_or_nan(inputs, "Q");
            let a = scalar_or_nan(inputs, "A");
            if a == 0.0 {
                Value::error("Velocity: A = 0")
            } else {
                Value::scalar(q / a)
            }
        }
        "eng.fluids.mass_flow" => {
            binary_broadcast_ports(inputs, "rho", "Q", |rho, q| rho * q)
        }
        "eng.fluids.reynolds" => {
            let rho = scalar_or_nan(inputs, "rho");
            let v = scalar_or_nan(inputs, "v");
            let d = scalar_or_nan(inputs, "D");
            let mu = scalar_or_nan(inputs, "mu");
            if mu == 0.0 {
                Value::error("Reynolds: \u{03BC} = 0")
            } else {
                Value::scalar(rho * v * d / mu)
            }
        }
        "eng.fluids.dynamic_pressure" => {
            let rho = scalar_or_nan(inputs, "rho");
            let v = scalar_or_nan(inputs, "v");
            Value::scalar(0.5 * rho * v * v)
        }
        "eng.fluids.hagen_poiseuille_dp" => {
            let mu = scalar_or_nan(inputs, "mu");
            let l = scalar_or_nan(inputs, "L");
            let q = scalar_or_nan(inputs, "Q");
            let d = scalar_or_nan(inputs, "D");
            if d == 0.0 {
                Value::error("Hagen-Poiseuille: D = 0")
            } else {
                Value::scalar(128.0 * mu * l * q / (std::f64::consts::PI * d.powi(4)))
            }
        }
        "eng.fluids.darcy_weisbach_dp" => {
            let f = scalar_or_nan(inputs, "f");
            let l = scalar_or_nan(inputs, "L");
            let d = scalar_or_nan(inputs, "D");
            let rho = scalar_or_nan(inputs, "rho");
            let v = scalar_or_nan(inputs, "v");
            if d == 0.0 {
                Value::error("Darcy-Weisbach: D = 0")
            } else {
                Value::scalar(f * (l / d) * (rho * v * v / 2.0))
            }
        }
        "eng.fluids.buoyancy" => {
            // F_b = ρ * V * g
            let rho = scalar_or_nan(inputs, "rho");
            let v = scalar_or_nan(inputs, "V");
            let g = scalar_or_nan(inputs, "g");
            Value::scalar(rho * v * g)
        }

        // ── Engineering → Thermo ─────────────────────────────────────
        "eng.thermo.ideal_gas_P" => {
            let n = scalar_or_nan(inputs, "n");
            let r = scalar_or_nan(inputs, "R");
            let t = scalar_or_nan(inputs, "T");
            let v = scalar_or_nan(inputs, "V");
            if v == 0.0 {
                Value::error("Ideal gas: V = 0")
            } else {
                Value::scalar(n * r * t / v)
            }
        }
        "eng.thermo.ideal_gas_T" => {
            let p = scalar_or_nan(inputs, "P");
            let v = scalar_or_nan(inputs, "V");
            let n = scalar_or_nan(inputs, "n");
            let r = scalar_or_nan(inputs, "R");
            let denom = n * r;
            if denom == 0.0 {
                Value::error("Ideal gas: n\u{00B7}R = 0")
            } else {
                Value::scalar(p * v / denom)
            }
        }
        "eng.thermo.heat_Q_mcDT" => {
            let m = scalar_or_nan(inputs, "m");
            let c = scalar_or_nan(inputs, "c");
            let dt = scalar_or_nan(inputs, "dT");
            Value::scalar(m * c * dt)
        }
        "eng.thermo.conduction_Qdot" => {
            let k = scalar_or_nan(inputs, "k");
            let a = scalar_or_nan(inputs, "A");
            let dt = scalar_or_nan(inputs, "dT");
            let l = scalar_or_nan(inputs, "L");
            if l == 0.0 {
                Value::error("Conduction: L = 0")
            } else {
                Value::scalar(k * a * dt / l)
            }
        }
        "eng.thermo.convection_Qdot" => {
            let h = scalar_or_nan(inputs, "h");
            let a = scalar_or_nan(inputs, "A");
            let dt = scalar_or_nan(inputs, "dT");
            Value::scalar(h * a * dt)
        }
        "eng.thermo.carnot_efficiency" => {
            // η = 1 - T_cold / T_hot
            let t_cold = scalar_or_nan(inputs, "T_cold");
            let t_hot = scalar_or_nan(inputs, "T_hot");
            if t_hot == 0.0 {
                Value::error("Carnot: T_hot = 0")
            } else {
                Value::scalar(1.0 - t_cold / t_hot)
            }
        }
        "eng.thermo.thermal_expansion" => {
            // ΔL = α * L * ΔT
            let alpha = scalar_or_nan(inputs, "alpha");
            let l = scalar_or_nan(inputs, "L");
            let dt = scalar_or_nan(inputs, "dT");
            Value::scalar(alpha * l * dt)
        }

        // ── Engineering → Electrical ─────────────────────────────────
        "eng.elec.ohms_V" => binary_broadcast_ports(inputs, "I", "R", |i, r| i * r),
        "eng.elec.power_VI" => binary_broadcast_ports(inputs, "V", "I", |v, i| v * i),
        "eng.elec.power_I2R" => {
            let i = scalar_or_nan(inputs, "I");
            let r = scalar_or_nan(inputs, "R");
            Value::scalar(i * i * r)
        }
        "eng.elec.power_V2R" => {
            let v = scalar_or_nan(inputs, "V");
            let r = scalar_or_nan(inputs, "R");
            if r == 0.0 {
                Value::error("Power: R = 0")
            } else {
                Value::scalar(v * v / r)
            }
        }
        "eng.elec.capacitance_Q_V" => {
            // C = Q / V
            let q = scalar_or_nan(inputs, "Q");
            let v = scalar_or_nan(inputs, "V");
            if v == 0.0 {
                Value::error("Capacitance: V = 0")
            } else {
                Value::scalar(q / v)
            }
        }
        "eng.elec.series_resistance" => {
            // R_total = R1 + R2
            binary_broadcast_ports(inputs, "R1", "R2", |r1, r2| r1 + r2)
        }
        "eng.elec.parallel_resistance" => {
            // R_total = (R1 * R2) / (R1 + R2)
            let r1 = scalar_or_nan(inputs, "R1");
            let r2 = scalar_or_nan(inputs, "R2");
            let sum = r1 + r2;
            if sum == 0.0 {
                Value::error("Parallel resistance: R1 + R2 = 0")
            } else {
                Value::scalar(r1 * r2 / sum)
            }
        }

        // ── Engineering → Conversions ────────────────────────────────
        "eng.conv.deg_to_rad" => unary_broadcast_port(inputs, "deg", |d| d.to_radians()),
        "eng.conv.rad_to_deg" => unary_broadcast_port(inputs, "rad", |r| r.to_degrees()),
        "eng.conv.mm_to_m" => unary_broadcast_port(inputs, "mm", |v| v / 1000.0),
        "eng.conv.m_to_mm" => unary_broadcast_port(inputs, "m", |v| v * 1000.0),
        "eng.conv.bar_to_pa" => unary_broadcast_port(inputs, "bar", |v| v * 100_000.0),
        "eng.conv.pa_to_bar" => unary_broadcast_port(inputs, "Pa", |v| v / 100_000.0),
        "eng.conv.lpm_to_m3s" => unary_broadcast_port(inputs, "lpm", |v| v / 60_000.0),
        "eng.conv.m3s_to_lpm" => unary_broadcast_port(inputs, "m3s", |v| v * 60_000.0),

        // Generic unit conversion — factor stored in node data by the UI.
        "unit_convert" => {
            let factor = data
                .get("convFactor")
                .and_then(|v| v.as_f64())
                .unwrap_or(1.0);
            unary_broadcast_port(inputs, "value", |v| v * factor)
        }

        // ── Finance → TVM ─────────────────────────────────────────────
        "fin.tvm.simple_interest" => {
            let p = scalar_or_nan(inputs, "P");
            let r = scalar_or_nan(inputs, "r");
            let t = scalar_or_nan(inputs, "t");
            Value::scalar(p * r * t)
        }
        "fin.tvm.compound_fv" => {
            let pv = scalar_or_nan(inputs, "PV");
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            let t = scalar_or_nan(inputs, "t");
            if n == 0.0 {
                Value::error("Compound FV: n = 0")
            } else {
                Value::scalar(pv * (1.0 + r / n).powf(n * t))
            }
        }
        "fin.tvm.compound_pv" => {
            let fv = scalar_or_nan(inputs, "FV");
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            let t = scalar_or_nan(inputs, "t");
            if n == 0.0 {
                Value::error("Compound PV: n = 0")
            } else {
                let denom = (1.0 + r / n).powf(n * t);
                if denom == 0.0 {
                    Value::error("Compound PV: denominator = 0")
                } else {
                    Value::scalar(fv / denom)
                }
            }
        }
        "fin.tvm.continuous_fv" => {
            let pv = scalar_or_nan(inputs, "PV");
            let r = scalar_or_nan(inputs, "r");
            let t = scalar_or_nan(inputs, "t");
            Value::scalar(pv * (r * t).exp())
        }
        "fin.tvm.annuity_pv" => {
            let pmt = scalar_or_nan(inputs, "PMT");
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            if r == 0.0 {
                Value::scalar(pmt * n)
            } else {
                Value::scalar(pmt * (1.0 - (1.0 + r).powf(-n)) / r)
            }
        }
        "fin.tvm.annuity_fv" => {
            let pmt = scalar_or_nan(inputs, "PMT");
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            if r == 0.0 {
                Value::scalar(pmt * n)
            } else {
                Value::scalar(pmt * ((1.0 + r).powf(n) - 1.0) / r)
            }
        }
        "fin.tvm.annuity_pmt" => {
            let pv = scalar_or_nan(inputs, "PV");
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            if r == 0.0 {
                if n == 0.0 {
                    Value::error("Annuity PMT: n = 0")
                } else {
                    Value::scalar(pv / n)
                }
            } else {
                let denom = 1.0 - (1.0 + r).powf(-n);
                if denom == 0.0 {
                    Value::error("Annuity PMT: denominator = 0")
                } else {
                    Value::scalar(pv * r / denom)
                }
            }
        }
        "fin.tvm.npv" => {
            let r = scalar_or_nan(inputs, "r");
            let count = validated_count(inputs, 1);
            let cfs = collect_values(inputs, &CF_PORTS, count);
            let mut npv = 0.0_f64;
            for (i, cf) in cfs.iter().enumerate() {
                npv += cf / (1.0 + r).powi(i as i32);
            }
            Value::scalar(npv)
        }
        "fin.tvm.rule_of_72" => {
            let r = scalar_or_nan(inputs, "r");
            if r == 0.0 {
                Value::error("Rule of 72: r = 0")
            } else {
                Value::scalar(72.0 / (r * 100.0))
            }
        }
        "fin.tvm.effective_rate" => {
            let r = scalar_or_nan(inputs, "r");
            let n = scalar_or_nan(inputs, "n");
            if n == 0.0 {
                Value::error("Effective rate: n = 0")
            } else {
                Value::scalar((1.0 + r / n).powf(n) - 1.0)
            }
        }

        // ── Finance → Returns & Risk ──────────────────────────────────
        "fin.returns.pct_return" => {
            let v0 = scalar_or_nan(inputs, "v0");
            let v1 = scalar_or_nan(inputs, "v1");
            if v0 == 0.0 {
                Value::error("% Return: v0 = 0")
            } else {
                Value::scalar((v1 - v0) / v0)
            }
        }
        "fin.returns.log_return" => {
            let v0 = scalar_or_nan(inputs, "v0");
            let v1 = scalar_or_nan(inputs, "v1");
            if v0 <= 0.0 || v1 <= 0.0 {
                Value::error("Log Return: values must be > 0")
            } else {
                Value::scalar((v1 / v0).ln())
            }
        }
        "fin.returns.cagr" => {
            let v0 = scalar_or_nan(inputs, "v0");
            let v1 = scalar_or_nan(inputs, "v1");
            let t = scalar_or_nan(inputs, "t");
            if v0 <= 0.0 {
                Value::error("CAGR: v0 must be > 0")
            } else if t == 0.0 {
                Value::error("CAGR: t = 0")
            } else {
                Value::scalar((v1 / v0).powf(1.0 / t) - 1.0)
            }
        }
        "fin.returns.sharpe" => {
            let ret = scalar_or_nan(inputs, "ret");
            let rf = scalar_or_nan(inputs, "rf");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma == 0.0 {
                Value::error("Sharpe: \u{03C3} = 0")
            } else {
                Value::scalar((ret - rf) / sigma)
            }
        }
        "fin.returns.weighted_avg" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let w_sum = kahan_sum(ys.iter().copied());
            if w_sum == 0.0 {
                Value::error("Weighted avg: weights sum to 0")
            } else {
                let wval = kahan_sum(xs.iter().zip(ys.iter()).map(|(x, w)| x * w));
                Value::scalar(wval / w_sum)
            }
        }
        "fin.returns.portfolio_variance" => {
            // 2-asset: w1²σ1² + w2²σ2² + 2·w1·w2·ρ·σ1·σ2
            let w1 = scalar_or_nan(inputs, "w1");
            let w2 = scalar_or_nan(inputs, "w2");
            let s1 = scalar_or_nan(inputs, "s1");
            let s2 = scalar_or_nan(inputs, "s2");
            let rho = scalar_or_nan(inputs, "rho");
            // mul_add: fused multiply-add for reduced rounding
            let t1 = (w1 * s1).powi(2);
            let t2 = (w2 * s2).powi(2);
            let cross = 2.0 * w1 * w2 * rho * s1 * s2;
            Value::scalar(t1 + t2 + cross)
        }

        // ── Finance → Depreciation ────────────────────────────────────
        "fin.depr.straight_line" => {
            let cost = scalar_or_nan(inputs, "cost");
            let salvage = scalar_or_nan(inputs, "salvage");
            let life = scalar_or_nan(inputs, "life");
            if life == 0.0 {
                Value::error("SL Depreciation: life = 0")
            } else {
                Value::scalar((cost - salvage) / life)
            }
        }
        "fin.depr.declining_balance" => {
            let cost = scalar_or_nan(inputs, "cost");
            let salvage = scalar_or_nan(inputs, "salvage");
            let life = scalar_or_nan(inputs, "life");
            let period = scalar_or_nan(inputs, "period");
            if life == 0.0 {
                Value::error("DB Depreciation: life = 0")
            } else if cost == 0.0 {
                Value::scalar(0.0)
            } else {
                let rate = 1.0 - (salvage / cost).powf(1.0 / life);
                let bv_start = cost * (1.0 - rate).powf(period - 1.0);
                Value::scalar(bv_start * rate)
            }
        }

        // ── Stats → Descriptive ───────────────────────────────────────
        "stats.desc.mean" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            Value::scalar(kahan_sum(xs.iter().copied()) / count as f64)
        }
        "stats.desc.median" => {
            let count = validated_count(inputs, 1);
            let mut xs = collect_values(inputs, &X_PORTS, count);
            xs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let mid = count / 2;
            if count % 2 == 0 {
                Value::scalar((xs[mid - 1] + xs[mid]) / 2.0)
            } else {
                Value::scalar(xs[mid])
            }
        }
        "stats.desc.mode_approx" => {
            // For fixed 6 slots: return most frequent (first tie wins)
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            let mut best = xs[0];
            let mut best_count = 1_usize;
            for i in 0..count {
                let c = xs[i..count].iter().filter(|&&x| (x - xs[i]).abs() < f64::EPSILON).count();
                if c > best_count {
                    best_count = c;
                    best = xs[i];
                }
            }
            Value::scalar(best)
        }
        "stats.desc.range" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            let min = xs.iter().cloned().fold(f64::INFINITY, f64::min);
            let max = xs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            Value::scalar(max - min)
        }
        "stats.desc.variance" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let n = count as f64;
            let mean = kahan_sum(xs.iter().copied()) / n;
            let var = kahan_sum(xs.iter().map(|x| (x - mean) * (x - mean))) / n;
            Value::scalar(var)
        }
        "stats.desc.stddev" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let n = count as f64;
            let mean = kahan_sum(xs.iter().copied()) / n;
            let var = kahan_sum(xs.iter().map(|x| (x - mean) * (x - mean))) / n;
            Value::scalar(var.sqrt())
        }
        "stats.desc.sum" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            Value::scalar(kahan_sum(xs.iter().copied()))
        }
        "stats.desc.geo_mean" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            if xs.iter().any(|&x| x <= 0.0) {
                Value::error("Geo mean: all values must be > 0")
            } else {
                let log_sum = kahan_sum(xs.iter().map(|x| x.ln()));
                Value::scalar((log_sum / count as f64).exp())
            }
        }
        "stats.desc.zscore" => {
            let x = scalar_or_nan(inputs, "x");
            let mu = scalar_or_nan(inputs, "mu");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma == 0.0 {
                Value::error("Z-score: \u{03C3} = 0")
            } else {
                Value::scalar((x - mu) / sigma)
            }
        }

        // ── Stats → Relationships ─────────────────────────────────────
        "stats.rel.covariance" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let n = count as f64;
            let mx = kahan_sum(xs.iter().copied()) / n;
            let my = kahan_sum(ys.iter().copied()) / n;
            let cov = kahan_sum(xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my))) / n;
            Value::scalar(cov)
        }
        "stats.rel.correlation" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let n = count as f64;
            let mx = kahan_sum(xs.iter().copied()) / n;
            let my = kahan_sum(ys.iter().copied()) / n;
            let cov = kahan_sum(xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my))) / n;
            let sx = (kahan_sum(xs.iter().map(|x| (x - mx).powi(2))) / n).sqrt();
            let sy = (kahan_sum(ys.iter().map(|y| (y - my).powi(2))) / n).sqrt();
            if sx == 0.0 || sy == 0.0 {
                Value::error("Correlation: zero variance")
            } else {
                Value::scalar(cov / (sx * sy))
            }
        }
        "stats.rel.linreg_slope" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let n = count as f64;
            let mx = kahan_sum(xs.iter().copied()) / n;
            let my = kahan_sum(ys.iter().copied()) / n;
            let num = kahan_sum(xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)));
            let den = kahan_sum(xs.iter().map(|x| (x - mx).powi(2)));
            if den == 0.0 {
                Value::error("LinReg slope: zero variance in X")
            } else {
                Value::scalar(num / den)
            }
        }
        "stats.rel.linreg_intercept" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let n = count as f64;
            let mx = kahan_sum(xs.iter().copied()) / n;
            let my = kahan_sum(ys.iter().copied()) / n;
            let num = kahan_sum(xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)));
            let den = kahan_sum(xs.iter().map(|x| (x - mx).powi(2)));
            if den == 0.0 {
                Value::error("LinReg intercept: zero variance in X")
            } else {
                let slope = num / den;
                Value::scalar(my.mul_add(1.0, -(slope * mx)))
            }
        }

        // ── Probability → Combinatorics ───────────────────────────────
        "prob.comb.factorial" => {
            unary_broadcast_port(inputs, "n", |n| {
                if n < 0.0 || n != n.floor() { f64::NAN } else { factorial_val(n as u64) }
            })
        }
        "prob.comb.permutation" => {
            let n = scalar_or_nan(inputs, "n");
            let k = scalar_or_nan(inputs, "k");
            if n < 0.0 || k < 0.0 || n != n.floor() || k != k.floor() {
                Value::error("P(n,k): n,k must be non-negative integers")
            } else {
                Value::scalar(permutation_val(n as u64, k as u64))
            }
        }
        "prob.comb.combination" => {
            let n = scalar_or_nan(inputs, "n");
            let k = scalar_or_nan(inputs, "k");
            if n < 0.0 || k < 0.0 || n != n.floor() || k != k.floor() || k > n {
                Value::error("C(n,k): n,k must be non-negative integers with k \u{2264} n")
            } else {
                Value::scalar(combination(n as u64, k as u64))
            }
        }

        // ── Probability → Distributions ───────────────────────────────
        "prob.dist.binomial_pmf" => {
            let n = scalar_or_nan(inputs, "n");
            let k = scalar_or_nan(inputs, "k");
            let p = scalar_or_nan(inputs, "p");
            if n < 0.0 || k < 0.0 || n != n.floor() || k != k.floor() {
                Value::error("Binomial PMF: n,k must be non-negative integers")
            } else if !(0.0..=1.0).contains(&p) {
                Value::error("Binomial PMF: p must be in [0,1]")
            } else {
                let ni = n as u64;
                let ki = k as u64;
                Value::scalar(combination(ni, ki) * p.powi(ki as i32) * (1.0 - p).powi((ni - ki) as i32))
            }
        }
        "prob.dist.poisson_pmf" => {
            let k = scalar_or_nan(inputs, "k");
            let lambda = scalar_or_nan(inputs, "lambda");
            if k < 0.0 || k != k.floor() {
                Value::error("Poisson PMF: k must be a non-negative integer")
            } else if lambda < 0.0 {
                Value::error("Poisson PMF: \u{03BB} must be \u{2265} 0")
            } else {
                let ki = k as u64;
                Value::scalar((-lambda).exp() * lambda.powi(ki as i32) / factorial_val(ki))
            }
        }
        "prob.dist.exponential_pdf" => {
            let x = scalar_or_nan(inputs, "x");
            let lambda = scalar_or_nan(inputs, "lambda");
            if lambda <= 0.0 {
                Value::error("Exponential PDF: \u{03BB} must be > 0")
            } else if x < 0.0 {
                Value::scalar(0.0)
            } else {
                Value::scalar(lambda * (-lambda * x).exp())
            }
        }
        "prob.dist.exponential_cdf" => {
            let x = scalar_or_nan(inputs, "x");
            let lambda = scalar_or_nan(inputs, "lambda");
            if lambda <= 0.0 {
                Value::error("Exponential CDF: \u{03BB} must be > 0")
            } else if x < 0.0 {
                Value::scalar(0.0)
            } else {
                Value::scalar(1.0 - (-lambda * x).exp())
            }
        }
        "prob.dist.normal_pdf" => {
            let x = scalar_or_nan(inputs, "x");
            let mu = scalar_or_nan(inputs, "mu");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 {
                Value::error("Normal PDF: \u{03C3} must be > 0")
            } else {
                let z = (x - mu) / sigma;
                let coeff = 1.0 / (sigma * (2.0 * std::f64::consts::PI).sqrt());
                Value::scalar(coeff * (-0.5 * z * z).exp())
            }
        }

        // ── Utilities ─────────────────────────────────────────────────
        "util.round.to_dp" => {
            let x = scalar_or_nan(inputs, "x");
            let dp = scalar_or_nan(inputs, "dp");
            let factor = 10.0_f64.powi(dp.round() as i32);
            Value::scalar((x * factor).round() / factor)
        }
        "util.pct.to_decimal" => {
            unary_broadcast_port(inputs, "pct", |p| p / 100.0)
        }

        // ── SCI-01: Additional CODATA 2022 constants ──────────────────
        "const.physics.mn"            => Value::scalar(1.674_927_500_56e-27),  // neutron mass (CODATA 2022)
        "const.physics.alpha"         => Value::scalar(7.297_352_564_3e-3),    // fine-structure constant (CODATA 2022)
        "const.physics.Ry"            => Value::scalar(10_973_731.568_157),    // Rydberg constant m⁻¹ (CODATA 2022)
        "const.physics.amu" | "const.physics.u" => Value::scalar(1.660_539_068_92e-27), // atomic mass unit (CODATA 2022)
        "const.physics.a0"            => Value::scalar(5.291_772_109_03e-11),  // Bohr radius
        "const.physics.mu_B"          => Value::scalar(9.274_010_0783e-24),    // Bohr magneton
        "const.physics.mu_N"          => Value::scalar(5.050_783_7461e-27),    // nuclear magneton

        // ── SCI-11: Statistical distributions (extended) ─────────────
        "prob.dist.normal_cdf" => {
            let x     = scalar_or_nan(inputs, "x");
            let mu    = scalar_or_nan(inputs, "mu");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 {
                Value::error("Normal CDF: \u{03C3} must be > 0")
            } else {
                Value::scalar(normal_cdf((x - mu) / sigma))
            }
        }
        "prob.dist.normal_inv_cdf" => {
            let p     = scalar_or_nan(inputs, "p");
            let mu    = scalar_or_nan(inputs, "mu");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 {
                Value::error("Normal InvCDF: \u{03C3} must be > 0")
            } else if !(0.0..=1.0).contains(&p) {
                Value::error("Normal InvCDF: p must be in [0, 1]")
            } else {
                Value::scalar(mu + sigma * normal_inv_cdf(p))
            }
        }
        "prob.dist.t_pdf" => {
            let x  = scalar_or_nan(inputs, "x");
            let df = scalar_or_nan(inputs, "df");
            if df <= 0.0 {
                Value::error("t-PDF: df must be > 0")
            } else {
                let log_coeff = log_gamma((df + 1.0) / 2.0)
                    - log_gamma(df / 2.0)
                    - 0.5 * (df * std::f64::consts::PI).ln();
                let log_kernel = -((df + 1.0) / 2.0) * (1.0 + x * x / df).ln();
                Value::scalar((log_coeff + log_kernel).exp())
            }
        }
        "prob.dist.t_cdf" => {
            let x  = scalar_or_nan(inputs, "x");
            let df = scalar_or_nan(inputs, "df");
            if df <= 0.0 {
                Value::error("t-CDF: df must be > 0")
            } else {
                let z  = df / (x * x + df);
                let ib = reg_inc_beta(df / 2.0, 0.5, z);
                let p  = ib / 2.0;
                Value::scalar(if x >= 0.0 { 1.0 - p } else { p })
            }
        }
        "prob.dist.chi2_pdf" => {
            let x = scalar_or_nan(inputs, "x");
            let k = scalar_or_nan(inputs, "k");
            if k <= 0.0 { return Value::error("Chi\u{00B2} PDF: k must be > 0"); }
            if x < 0.0  { return Value::scalar(0.0); }
            if x == 0.0 {
                return if k < 2.0 { Value::scalar(f64::INFINITY) }
                       else if (k - 2.0).abs() < 1e-12 { Value::scalar(0.5) }
                       else { Value::scalar(0.0) };
            }
            let hk = k / 2.0;
            let log_pdf = (hk - 1.0) * x.ln() - x / 2.0
                          - hk * 2.0_f64.ln() - log_gamma(hk);
            Value::scalar(log_pdf.exp())
        }
        "prob.dist.chi2_cdf" => {
            let x = scalar_or_nan(inputs, "x");
            let k = scalar_or_nan(inputs, "k");
            if k <= 0.0 { return Value::error("Chi\u{00B2} CDF: k must be > 0"); }
            if x <= 0.0 { return Value::scalar(0.0); }
            Value::scalar(reg_gamma_lower(k / 2.0, x / 2.0))
        }
        "prob.dist.f_pdf" => {
            let x  = scalar_or_nan(inputs, "x");
            let d1 = scalar_or_nan(inputs, "d1");
            let d2 = scalar_or_nan(inputs, "d2");
            if d1 <= 0.0 || d2 <= 0.0 { return Value::error("F-PDF: d1,d2 must be > 0"); }
            if x <= 0.0 { return Value::scalar(0.0); }
            let log_pdf = (d1 / 2.0) * (d1 * x / (d1 * x + d2)).ln()
                        + (d2 / 2.0) * (d2 / (d1 * x + d2)).ln()
                        - x.ln()
                        + log_gamma((d1 + d2) / 2.0)
                        - log_gamma(d1 / 2.0)
                        - log_gamma(d2 / 2.0);
            Value::scalar(log_pdf.exp())
        }
        "prob.dist.f_cdf" => {
            let x  = scalar_or_nan(inputs, "x");
            let d1 = scalar_or_nan(inputs, "d1");
            let d2 = scalar_or_nan(inputs, "d2");
            if d1 <= 0.0 || d2 <= 0.0 { return Value::error("F-CDF: d1,d2 must be > 0"); }
            if x <= 0.0 { return Value::scalar(0.0); }
            Value::scalar(reg_inc_beta(d1 / 2.0, d2 / 2.0, d1 * x / (d1 * x + d2)))
        }
        "prob.dist.poisson_cdf" => {
            let k_raw  = scalar_or_nan(inputs, "k");
            let lambda = scalar_or_nan(inputs, "lambda");
            if lambda < 0.0 { return Value::error("Poisson CDF: \u{03BB} must be \u{2265} 0"); }
            if k_raw < 0.0  { return Value::scalar(0.0); }
            let k = k_raw.floor() as u64;
            // P(X \u{2264} k) = 1 - P(k+1, \u{03BB})
            Value::scalar(1.0 - reg_gamma_lower((k + 1) as f64, lambda))
        }
        "prob.dist.binomial_cdf" => {
            let k_raw = scalar_or_nan(inputs, "k");
            let n_raw = scalar_or_nan(inputs, "n");
            let p     = scalar_or_nan(inputs, "p");
            if !(0.0..=1.0).contains(&p) { return Value::error("Binomial CDF: p must be in [0,1]"); }
            let k = k_raw.floor() as i64;
            let n = n_raw.round() as i64;
            if k < 0 { return Value::scalar(0.0); }
            if k >= n { return Value::scalar(1.0); }
            Value::scalar(reg_inc_beta((n - k) as f64, (k + 1) as f64, 1.0 - p))
        }
        "prob.dist.beta_pdf" => {
            let x = scalar_or_nan(inputs, "x");
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a <= 0.0 || b <= 0.0 { return Value::error("Beta PDF: a,b must be > 0"); }
            if x < 0.0 || x > 1.0   { return Value::scalar(0.0); }
            if x == 0.0 { return if a < 1.0 { Value::scalar(f64::INFINITY) } else { Value::scalar(0.0) }; }
            if x == 1.0 { return if b < 1.0 { Value::scalar(f64::INFINITY) } else { Value::scalar(0.0) }; }
            let log_pdf = (a - 1.0) * x.ln() + (b - 1.0) * (1.0 - x).ln()
                          + log_gamma(a + b) - log_gamma(a) - log_gamma(b);
            Value::scalar(log_pdf.exp())
        }
        "prob.dist.beta_cdf" => {
            let x = scalar_or_nan(inputs, "x");
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a <= 0.0 || b <= 0.0 { return Value::error("Beta CDF: a,b must be > 0"); }
            if x <= 0.0 { return Value::scalar(0.0); }
            if x >= 1.0 { return Value::scalar(1.0); }
            Value::scalar(reg_inc_beta(a, b, x))
        }
        "prob.dist.gamma_pdf" => {
            let x     = scalar_or_nan(inputs, "x");
            let alpha = scalar_or_nan(inputs, "alpha");
            let beta  = scalar_or_nan(inputs, "beta");
            if alpha <= 0.0 || beta <= 0.0 { return Value::error("Gamma PDF: \u{03B1},\u{03B2} must be > 0"); }
            if x <= 0.0 { return Value::scalar(0.0); }
            let log_pdf = (alpha - 1.0) * x.ln() - x / beta
                          - alpha * beta.ln() - log_gamma(alpha);
            Value::scalar(log_pdf.exp())
        }
        "prob.dist.weibull_pdf" => {
            let x      = scalar_or_nan(inputs, "x");
            let k      = scalar_or_nan(inputs, "k");
            let lambda = scalar_or_nan(inputs, "lambda");
            if k <= 0.0 || lambda <= 0.0 { return Value::error("Weibull PDF: k,\u{03BB} must be > 0"); }
            if x < 0.0 { return Value::scalar(0.0); }
            if x == 0.0 {
                return if k < 1.0 { Value::scalar(f64::INFINITY) }
                       else if (k - 1.0).abs() < 1e-12 { Value::scalar(k / lambda) }
                       else { Value::scalar(0.0) };
            }
            Value::scalar((k / lambda) * (x / lambda).powf(k - 1.0) * (-(x / lambda).powf(k)).exp())
        }

        // ── BLK-01: Chemical Engineering ──────────────────────────────
        "chem.ideal_gas_n" => {
            let p = scalar_or_nan(inputs, "P");
            let v = scalar_or_nan(inputs, "V");
            let r = scalar_or_nan(inputs, "R");
            let t = scalar_or_nan(inputs, "T");
            let denom = r * t;
            if denom == 0.0 { Value::error("Ideal gas n: R\u{00B7}T = 0") }
            else { Value::scalar(p * v / denom) }
        }
        "chem.antoine_vp" => {
            // log\u{2081}\u{2080}(P) = A - B/(C+T) \u{2192} Antoine equation (mmHg, \u{00B0}C)
            let a = scalar_or_nan(inputs, "A");
            let b = scalar_or_nan(inputs, "B");
            let c = scalar_or_nan(inputs, "C");
            let t = scalar_or_nan(inputs, "T");
            Value::scalar(10.0_f64.powf(a - b / (c + t)))
        }
        "chem.raoults_partial" => {
            binary_broadcast_ports(inputs, "x", "Psat", |x, psat| x * psat)
        }
        "chem.equilibrium_K" => {
            let dg = scalar_or_nan(inputs, "dG");
            let r  = scalar_or_nan(inputs, "R");
            let t  = scalar_or_nan(inputs, "T");
            let denom = r * t;
            if denom == 0.0 { Value::error("Equilibrium K: R\u{00B7}T = 0") }
            else { Value::scalar((-dg / denom).exp()) }
        }
        "chem.arrhenius_rate" => {
            let a  = scalar_or_nan(inputs, "A");
            let ea = scalar_or_nan(inputs, "Ea");
            let r  = scalar_or_nan(inputs, "R");
            let t  = scalar_or_nan(inputs, "T");
            let denom = r * t;
            if denom == 0.0 { Value::error("Arrhenius: R\u{00B7}T = 0") }
            else { Value::scalar(a * (-ea / denom).exp()) }
        }
        "chem.heat_reaction" => {
            binary_broadcast_ports(inputs, "H_prod", "H_react", |hp, hr| hp - hr)
        }
        "chem.mole_fraction" => {
            let n_comp  = scalar_or_nan(inputs, "n_comp");
            let n_total = scalar_or_nan(inputs, "n_total");
            if n_total == 0.0 { Value::error("Mole fraction: n_total = 0") }
            else { Value::scalar(n_comp / n_total) }
        }
        "chem.ficks_flux" => {
            binary_broadcast_ports(inputs, "D", "dC_dx", |d, dc| -d * dc)
        }
        "chem.CSTR_conv" => {
            let k   = scalar_or_nan(inputs, "k");
            let tau = scalar_or_nan(inputs, "tau");
            let denom = 1.0 + k * tau;
            if denom == 0.0 { Value::error("CSTR: 1 + k\u{00B7}\u{03C4} = 0") }
            else { Value::scalar(k * tau / denom) }
        }
        "chem.enthalpy_sensible" => {
            let cp = scalar_or_nan(inputs, "Cp");
            let t1 = scalar_or_nan(inputs, "T1");
            let t2 = scalar_or_nan(inputs, "T2");
            Value::scalar(cp * (t2 - t1))
        }

        // ── BLK-02: Structural / Civil Engineering ────────────────────
        "struct.beam_deflect_ss" => {
            let p  = scalar_or_nan(inputs, "P");
            let l  = scalar_or_nan(inputs, "L");
            let e  = scalar_or_nan(inputs, "E");
            let ii = scalar_or_nan(inputs, "I");
            let denom = 48.0 * e * ii;
            if denom == 0.0 { Value::error("Beam SS: 48\u{00B7}E\u{00B7}I = 0") }
            else { Value::scalar(p * l.powi(3) / denom) }
        }
        "struct.beam_deflect_cantilever" => {
            let p  = scalar_or_nan(inputs, "P");
            let l  = scalar_or_nan(inputs, "L");
            let e  = scalar_or_nan(inputs, "E");
            let ii = scalar_or_nan(inputs, "I");
            let denom = 3.0 * e * ii;
            if denom == 0.0 { Value::error("Cantilever: 3\u{00B7}E\u{00B7}I = 0") }
            else { Value::scalar(p * l.powi(3) / denom) }
        }
        "struct.beam_moment_ss" => {
            let p = scalar_or_nan(inputs, "P");
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            let l = scalar_or_nan(inputs, "L");
            if l == 0.0 { Value::error("Beam moment: L = 0") }
            else { Value::scalar(p * a * b / l) }
        }
        "struct.euler_buckling" => {
            let e  = scalar_or_nan(inputs, "E");
            let ii = scalar_or_nan(inputs, "I");
            let l  = scalar_or_nan(inputs, "L");
            let k  = scalar_or_nan(inputs, "K");
            let kl = k * l;
            if kl == 0.0 { Value::error("Euler buckling: K\u{00B7}L = 0") }
            else { Value::scalar(std::f64::consts::PI.powi(2) * e * ii / kl.powi(2)) }
        }
        "struct.von_mises" => {
            let sx  = scalar_or_nan(inputs, "sx");
            let sy  = scalar_or_nan(inputs, "sy");
            let txy = scalar_or_nan(inputs, "txy");
            let val = sx * sx - sx * sy + sy * sy + 3.0 * txy * txy;
            if val < 0.0 { Value::error("Von Mises: negative under sqrt") }
            else { Value::scalar(val.sqrt()) }
        }
        "struct.combined_stress" => {
            binary_broadcast_ports(inputs, "s_ax", "s_bend", |s_ax, s_bend| s_ax + s_bend)
        }
        "struct.steel_check" => {
            let sigma = scalar_or_nan(inputs, "sigma");
            let fy    = scalar_or_nan(inputs, "Fy");
            let phi   = scalar_or_nan(inputs, "phi");
            let denom = fy * phi;
            if denom == 0.0 { Value::error("Steel check: Fy\u{00B7}\u{03C6} = 0") }
            else { Value::scalar(sigma / denom) }
        }
        "struct.bearing_capacity" => {
            let c     = scalar_or_nan(inputs, "c");
            let gamma = scalar_or_nan(inputs, "gamma");
            let d     = scalar_or_nan(inputs, "D");
            let b     = scalar_or_nan(inputs, "B");
            let nc    = scalar_or_nan(inputs, "Nc");
            let nq    = scalar_or_nan(inputs, "Nq");
            let ng    = scalar_or_nan(inputs, "Ngamma");
            Value::scalar(c * nc + gamma * d * nq + 0.5 * gamma * b * ng)
        }
        "struct.concrete_moment_aci" => {
            let fc  = scalar_or_nan(inputs, "fc");
            let b   = scalar_or_nan(inputs, "b");
            let d   = scalar_or_nan(inputs, "d");
            let ias = scalar_or_nan(inputs, "As");
            let fy  = scalar_or_nan(inputs, "fy");
            let denom = 1.7 * fc * b;
            if denom == 0.0 { Value::error("ACI moment: 1.7\u{00B7}fc\u{00B7}b = 0") }
            else {
                let a = ias * fy / denom;
                Value::scalar(ias * fy * (d - a / 2.0))
            }
        }

        // ── BLK-03: Aerospace Engineering ─────────────────────────────
        "aero.ISA_T" => {
            Value::scalar(isa_temperature(scalar_or_nan(inputs, "h")))
        }
        "aero.ISA_P" => {
            Value::scalar(isa_pressure(scalar_or_nan(inputs, "h")))
        }
        "aero.ISA_rho" => {
            let h = scalar_or_nan(inputs, "h");
            let t = isa_temperature(h);
            let p = isa_pressure(h);
            Value::scalar(p / (287.05 * t))
        }
        "aero.ISA_a" => {
            let t = isa_temperature(scalar_or_nan(inputs, "h"));
            Value::scalar((1.4 * 287.05 * t).sqrt())
        }
        "aero.mach_from_v" => {
            let v = scalar_or_nan(inputs, "v");
            let a = scalar_or_nan(inputs, "a");
            if a == 0.0 { Value::error("Mach: speed of sound = 0") }
            else { Value::scalar(v / a) }
        }
        "aero.dynamic_q" => {
            let rho = scalar_or_nan(inputs, "rho");
            let v   = scalar_or_nan(inputs, "v");
            Value::scalar(0.5 * rho * v * v)
        }
        "aero.lift" => {
            let cl = scalar_or_nan(inputs, "CL");
            let q  = scalar_or_nan(inputs, "q");
            let s  = scalar_or_nan(inputs, "S");
            Value::scalar(cl * q * s)
        }
        "aero.drag" => {
            let cd = scalar_or_nan(inputs, "CD");
            let q  = scalar_or_nan(inputs, "q");
            let s  = scalar_or_nan(inputs, "S");
            Value::scalar(cd * q * s)
        }
        "aero.tsfc" => {
            let thrust    = scalar_or_nan(inputs, "thrust");
            let fuel_flow = scalar_or_nan(inputs, "fuel_flow");
            if thrust == 0.0 { Value::error("TSFC: thrust = 0") }
            else { Value::scalar(fuel_flow / thrust) }
        }
        "aero.tsiolkovsky" => {
            let isp = scalar_or_nan(inputs, "Isp");
            let g0  = scalar_or_nan(inputs, "g0");
            let m0  = scalar_or_nan(inputs, "m0");
            let mf  = scalar_or_nan(inputs, "mf");
            if mf <= 0.0 { Value::error("Tsiolkovsky: mf must be > 0") }
            else if m0 <= mf { Value::error("Tsiolkovsky: m0 must be > mf") }
            else { Value::scalar(isp * g0 * (m0 / mf).ln()) }
        }
        "aero.orbital_v" => {
            let gm = scalar_or_nan(inputs, "GM");
            let r  = scalar_or_nan(inputs, "r");
            if r <= 0.0 { Value::error("Orbital v: r must be > 0") }
            else { Value::scalar((gm / r).sqrt()) }
        }
        "aero.escape_v" => {
            let gm = scalar_or_nan(inputs, "GM");
            let r  = scalar_or_nan(inputs, "r");
            if r <= 0.0 { Value::error("Escape v: r must be > 0") }
            else { Value::scalar((2.0 * gm / r).sqrt()) }
        }
        "aero.hohmann_dv1" => {
            let gm = scalar_or_nan(inputs, "GM");
            let r1 = scalar_or_nan(inputs, "r1");
            let r2 = scalar_or_nan(inputs, "r2");
            if r1 <= 0.0 || r2 <= 0.0 { Value::error("Hohmann dv1: r1,r2 must be > 0") }
            else {
                let v1 = (gm / r1).sqrt();
                Value::scalar(v1 * ((2.0 * r2 / (r1 + r2)).sqrt() - 1.0))
            }
        }
        "aero.hohmann_dv2" => {
            let gm = scalar_or_nan(inputs, "GM");
            let r1 = scalar_or_nan(inputs, "r1");
            let r2 = scalar_or_nan(inputs, "r2");
            if r1 <= 0.0 || r2 <= 0.0 { Value::error("Hohmann dv2: r1,r2 must be > 0") }
            else {
                let v2 = (gm / r2).sqrt();
                Value::scalar(v2 * (1.0 - (2.0 * r1 / (r1 + r2)).sqrt()))
            }
        }

        // ── BLK-04: Control Systems ────────────────────────────────────
        "ctrl.step_1st_order" => {
            let k   = scalar_or_nan(inputs, "K");
            let tau = scalar_or_nan(inputs, "tau");
            let t   = scalar_or_nan(inputs, "t");
            if tau == 0.0 { Value::error("1st order step: \u{03C4} = 0") }
            else { Value::scalar(k * (1.0 - (-t / tau).exp())) }
        }
        "ctrl.step_2nd_order" => {
            let k    = scalar_or_nan(inputs, "K");
            let wn   = scalar_or_nan(inputs, "wn");
            let zeta = scalar_or_nan(inputs, "zeta");
            let t    = scalar_or_nan(inputs, "t");
            if wn == 0.0 { return Value::error("2nd order step: \u{03C9}n = 0"); }
            let result = if (zeta - 1.0).abs() < 1e-10 {
                k * (1.0 - (1.0 + wn * t) * (-wn * t).exp())
            } else if zeta < 1.0 {
                let wd = wn * (1.0 - zeta * zeta).sqrt();
                k * (1.0 - (-zeta * wn * t).exp() * (
                    (wd * t).cos() + (zeta / (1.0 - zeta * zeta).sqrt()) * (wd * t).sin()
                ))
            } else {
                let s1 = -zeta * wn + wn * (zeta * zeta - 1.0).sqrt();
                let s2 = -zeta * wn - wn * (zeta * zeta - 1.0).sqrt();
                k * (1.0 + (s2 * (s1 * t).exp() - s1 * (s2 * t).exp()) / (s1 - s2))
            };
            Value::scalar(result)
        }
        "ctrl.pid_output" => {
            let kp       = scalar_or_nan(inputs, "Kp");
            let ki       = scalar_or_nan(inputs, "Ki");
            let kd       = scalar_or_nan(inputs, "Kd");
            let error    = scalar_or_nan(inputs, "error");
            let integral = scalar_or_nan(inputs, "integral");
            let dt       = scalar_or_nan(inputs, "dt");
            let deriv    = if dt == 0.0 { 0.0 } else { error / dt };
            Value::scalar(kp * error + ki * integral + kd * deriv)
        }
        "ctrl.rms" => {
            match inputs.get("y") {
                Some(Value::Vector { value }) if !value.is_empty() => {
                    let sum_sq = kahan_sum(value.iter().map(|x| x * x));
                    Value::scalar((sum_sq / value.len() as f64).sqrt())
                }
                _ => Value::error("RMS: expected non-empty vector"),
            }
        }
        "ctrl.peak2peak" => {
            match inputs.get("y") {
                Some(Value::Vector { value }) if !value.is_empty() => {
                    let max = value.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                    let min = value.iter().cloned().fold(f64::INFINITY, f64::min);
                    Value::scalar(max - min)
                }
                _ => Value::error("Peak-to-peak: expected non-empty vector"),
            }
        }
        "ctrl.settling_time_2pct" => {
            let tau = scalar_or_nan(inputs, "tau");
            if tau == 0.0 { Value::error("Settling time: \u{03C4} = 0") }
            else { Value::scalar(4.0 * tau) }
        }
        "ctrl.overshoot_2nd" => {
            let zeta = scalar_or_nan(inputs, "zeta");
            if zeta >= 1.0 { Value::scalar(0.0) }
            else if zeta <= 0.0 { Value::scalar(100.0) }
            else {
                let os = (-std::f64::consts::PI * zeta / (1.0 - zeta * zeta).sqrt()).exp() * 100.0;
                Value::scalar(os)
            }
        }
        "ctrl.natural_freq" => {
            let k = scalar_or_nan(inputs, "k");
            let m = scalar_or_nan(inputs, "m");
            if m <= 0.0 { Value::error("Natural freq: m must be > 0") }
            else { Value::scalar((k / m).sqrt()) }
        }
        "ctrl.damping_ratio" => {
            let c = scalar_or_nan(inputs, "c");
            let k = scalar_or_nan(inputs, "k");
            let m = scalar_or_nan(inputs, "m");
            let denom = 2.0 * (k * m).sqrt();
            if denom == 0.0 { Value::error("Damping ratio: 2\u{00B7}\u{221A}(k\u{00B7}m) = 0") }
            else { Value::scalar(c / denom) }
        }
        "ctrl.bode_mag_1st" => {
            // |H(j\u{03C9})| = K / \u{221A}(1 + (\u{03C9}\u{03C4})\u{00B2}) for first-order
            let k     = scalar_or_nan(inputs, "K");
            let omega = scalar_or_nan(inputs, "omega");
            let tau   = scalar_or_nan(inputs, "tau");
            Value::scalar(k / (1.0 + (omega * tau).powi(2)).sqrt())
        }

        // ── BLK-05: Electrical Engineering Expanded ───────────────────
        "eng.elec.RC_tau"        => binary_broadcast_ports(inputs, "R", "C", |r, c| r * c),
        "eng.elec.RL_tau" => {
            let l = scalar_or_nan(inputs, "L");
            let r = scalar_or_nan(inputs, "R");
            if r == 0.0 { Value::error("RL \u{03C4}: R = 0") }
            else { Value::scalar(l / r) }
        }
        "eng.elec.RLC_f0" => {
            let l  = scalar_or_nan(inputs, "L");
            let c  = scalar_or_nan(inputs, "C");
            let lc = l * c;
            if lc <= 0.0 { Value::error("RLC f0: L\u{00B7}C must be > 0") }
            else { Value::scalar(1.0 / (2.0 * std::f64::consts::PI * lc.sqrt())) }
        }
        "eng.elec.RLC_Q" => {
            let r = scalar_or_nan(inputs, "R");
            let l = scalar_or_nan(inputs, "L");
            let c = scalar_or_nan(inputs, "C");
            if r == 0.0 || c <= 0.0 { Value::error("RLC Q: R or C = 0") }
            else { Value::scalar((1.0 / r) * (l / c).sqrt()) }
        }
        "eng.elec.V_divider" => {
            let vin = scalar_or_nan(inputs, "Vin");
            let r1  = scalar_or_nan(inputs, "R1");
            let r2  = scalar_or_nan(inputs, "R2");
            let sum = r1 + r2;
            if sum == 0.0 { Value::error("V divider: R1+R2 = 0") }
            else { Value::scalar(vin * r2 / sum) }
        }
        "eng.elec.I_divider" => {
            let iin = scalar_or_nan(inputs, "Iin");
            let r1  = scalar_or_nan(inputs, "R1");
            let r2  = scalar_or_nan(inputs, "R2");
            let sum = r1 + r2;
            if sum == 0.0 { Value::error("I divider: R1+R2 = 0") }
            else { Value::scalar(iin * r1 / sum) }
        }
        "eng.elec.Z_cap" => {
            let c     = scalar_or_nan(inputs, "C");
            let omega = scalar_or_nan(inputs, "omega");
            if omega == 0.0 || c == 0.0 { Value::error("Z_cap: \u{03C9}\u{00B7}C = 0") }
            else { Value::scalar(1.0 / (omega * c)) }
        }
        "eng.elec.Z_ind" => {
            binary_broadcast_ports(inputs, "L", "omega", |l, omega| l * omega)
        }
        "eng.elec.filter_fc" => {
            let r  = scalar_or_nan(inputs, "R");
            let c  = scalar_or_nan(inputs, "C");
            let rc = r * c;
            if rc <= 0.0 { Value::error("Filter fc: R\u{00B7}C must be > 0") }
            else { Value::scalar(1.0 / (2.0 * std::f64::consts::PI * rc)) }
        }
        "eng.elec.transformer_v2" => {
            let n1 = scalar_or_nan(inputs, "N1");
            let n2 = scalar_or_nan(inputs, "N2");
            let v1 = scalar_or_nan(inputs, "V1");
            if n1 == 0.0 { Value::error("Transformer: N1 = 0") }
            else { Value::scalar(v1 * n2 / n1) }
        }
        "eng.elec.three_phase_P" => {
            let v  = scalar_or_nan(inputs, "V_line");
            let i  = scalar_or_nan(inputs, "I_line");
            let pf = scalar_or_nan(inputs, "pf");
            Value::scalar(3.0_f64.sqrt() * v * i * pf)
        }
        "eng.elec.diode_shockley" => {
            let is  = scalar_or_nan(inputs, "Is");
            let v   = scalar_or_nan(inputs, "V");
            let n   = scalar_or_nan(inputs, "n");
            let t   = scalar_or_nan(inputs, "T");
            // VT = kB\u{00B7}T/q
            let vt = 1.380_649e-23 * t / 1.602_176_634e-19;
            if vt == 0.0 || n == 0.0 { Value::error("Shockley: n\u{00B7}VT = 0") }
            else { Value::scalar(is * ((v / (n * vt)).exp() - 1.0)) }
        }

        // ── Multibody Mechanics (items 2.48–2.51) ──────────────────────
        // 2.48 — Spring / Damper / Mass / RigidBody formula blocks
        "eng.multibody.spring_force" => {
            let k = scalar_or_nan(inputs, "k");
            let x = scalar_or_nan(inputs, "x");
            Value::scalar(k * x)
        }
        "eng.multibody.damper_force" => {
            let b = scalar_or_nan(inputs, "b");
            let v = scalar_or_nan(inputs, "v");
            Value::scalar(b * v)
        }
        "eng.multibody.mass_accel" => {
            let f = scalar_or_nan(inputs, "F");
            let m = scalar_or_nan(inputs, "m");
            if m == 0.0 { Value::error("Mass = 0") }
            else { Value::scalar(f / m) }
        }
        "eng.multibody.smd_natural_freq" => {
            // ωn = sqrt(k/m), ζ = b / (2*sqrt(k*m))
            let k = scalar_or_nan(inputs, "k");
            let m = scalar_or_nan(inputs, "m");
            let b = scalar_or_nan(inputs, "b");
            if k <= 0.0 || m <= 0.0 { Value::error("k and m must be positive") }
            else {
                let wn = (k / m).sqrt();
                let zeta = b / (2.0 * (k * m).sqrt());
                crate::types::build_table(
                    &["omega_n", "zeta", "omega_d"],
                    &[vec![wn], vec![zeta], vec![wn * (1.0 - zeta * zeta).max(0.0).sqrt()]],
                )
            }
        }
        "eng.multibody.rigid_body_1d" => {
            // Net force, acceleration, and kinetic energy for 1D rigid body
            let m    = scalar_or_nan(inputs, "m");
            let f    = scalar_or_nan(inputs, "F");
            let v    = scalar_or_nan(inputs, "v");
            let mu   = scalar_or_nan(inputs, "mu");
            let fn_n = scalar_or_nan(inputs, "Fn");
            let f_friction = mu * fn_n;
            let f_net = f - f_friction;
            if m == 0.0 { Value::error("Mass = 0") }
            else {
                crate::types::build_table(
                    &["F_net", "a", "KE"],
                    &[vec![f_net], vec![f_net / m], vec![0.5 * m * v * v]],
                )
            }
        }
        // 2.49 — Joint blocks (formula approximations)
        "eng.multibody.joint_revolute" => {
            // τ = I * α  (revolute: torque → angular acceleration)
            let tau = scalar_or_nan(inputs, "tau");
            let i   = scalar_or_nan(inputs, "I");
            if i == 0.0 { Value::error("Inertia = 0") }
            else { Value::scalar(tau / i) }
        }
        "eng.multibody.joint_prismatic" => {
            // F = m * a  (prismatic: force → linear acceleration)
            let f = scalar_or_nan(inputs, "F");
            let m = scalar_or_nan(inputs, "m");
            if m == 0.0 { Value::error("Mass = 0") }
            else { Value::scalar(f / m) }
        }
        "eng.multibody.dh_transform" => {
            // Denavit-Hartenberg: single joint transform parameters → 4x4 homogeneous matrix (flat)
            // T = Rz(θ) * Tz(d) * Tx(a) * Rx(α)
            let theta = scalar_or_nan(inputs, "theta"); // joint angle rad
            let d     = scalar_or_nan(inputs, "d");     // link offset
            let a     = scalar_or_nan(inputs, "a");     // link length
            let alpha = scalar_or_nan(inputs, "alpha"); // twist angle rad
            let ct = theta.cos(); let st = theta.sin();
            let ca = alpha.cos(); let sa = alpha.sin();
            // Row-major 4x4 DH matrix
            let mat = vec![
                ct, -st*ca,  st*sa, a*ct,
                st,  ct*ca, -ct*sa, a*st,
                0.0, sa,     ca,    d,
                0.0, 0.0,    0.0,   1.0,
            ];
            Value::Matrix { rows: 4, cols: 4, data: mat }
        }
        // 2.50 — ContactModel
        "eng.multibody.contact_penalty" => {
            // Penalty contact: F_n = k_p * max(0, -gap), F_f = μ * F_n (Coulomb)
            let kp  = scalar_or_nan(inputs, "k_p");
            let gap = scalar_or_nan(inputs, "gap");
            let mu  = scalar_or_nan(inputs, "mu");
            let fn_val = kp * (-gap).max(0.0);
            let ff_val = mu * fn_val;
            crate::types::build_table(
                &["F_normal", "F_friction"],
                &[vec![fn_val], vec![ff_val]],
            )
        }
        "eng.multibody.stribeck_friction" => {
            // Stribeck friction: μ = μk + (μs - μk)*exp(-(v/vs)^2)
            let mu_s = scalar_or_nan(inputs, "mu_s");
            let mu_k = scalar_or_nan(inputs, "mu_k");
            let vs   = scalar_or_nan(inputs, "vs");
            let v    = scalar_or_nan(inputs, "v");
            let fn_n = scalar_or_nan(inputs, "Fn");
            if vs == 0.0 { Value::error("Stribeck vs = 0") }
            else {
                let mu = mu_k + (mu_s - mu_k) * (-(v / vs).powi(2)).exp();
                Value::scalar(mu * fn_n)
            }
        }
        // 2.51 — KinematicChain (forward kinematics end-effector from joint angles)
        "eng.multibody.fk_2dof_planar" => {
            // 2-DOF planar arm: x = l1*cos(θ1) + l2*cos(θ1+θ2), y = l1*sin(θ1) + l2*sin(θ1+θ2)
            let l1 = scalar_or_nan(inputs, "l1");
            let l2 = scalar_or_nan(inputs, "l2");
            let t1 = scalar_or_nan(inputs, "theta1");
            let t2 = scalar_or_nan(inputs, "theta2");
            let x = l1 * t1.cos() + l2 * (t1 + t2).cos();
            let y = l1 * t1.sin() + l2 * (t1 + t2).sin();
            crate::types::build_table(&["x", "y"], &[vec![x], vec![y]])
        }
        "eng.multibody.ik_2dof_planar" => {
            // 2-DOF planar IK: θ2 = acos((x²+y²-l1²-l2²)/(2*l1*l2)), θ1 = atan2(y,x) - atan2(l2*sin θ2, l1+l2*cos θ2)
            let l1 = scalar_or_nan(inputs, "l1");
            let l2 = scalar_or_nan(inputs, "l2");
            let x  = scalar_or_nan(inputs, "x");
            let y  = scalar_or_nan(inputs, "y");
            let cos_t2 = (x*x + y*y - l1*l1 - l2*l2) / (2.0 * l1 * l2);
            if cos_t2.abs() > 1.0 { Value::error("IK: target out of reach") }
            else {
                let t2 = cos_t2.acos();
                let t1 = y.atan2(x) - (l2 * t2.sin()).atan2(l1 + l2 * t2.cos());
                crate::types::build_table(&["theta1", "theta2"], &[vec![t1], vec![t2]])
            }
        }

        // ── Active Electronics (items 2.54–2.57) ───────────────────────
        // 2.54 — Diode (exponential I-V), MOSFET, IGBT
        "eng.elec.diode_iv" => {
            // I = Is*(exp(V/(n*Vt)) - 1) — same as diode_shockley but Vt direct input
            let is_ = scalar_or_nan(inputs, "Is");
            let v   = scalar_or_nan(inputs, "V");
            let n   = scalar_or_nan(inputs, "n");
            let vt  = scalar_or_nan(inputs, "Vt");
            if vt == 0.0 || n == 0.0 { Value::error("Diode: n·Vt = 0") }
            else { Value::scalar(is_ * ((v / (n * vt)).exp() - 1.0)) }
        }
        "eng.elec.mosfet_id" => {
            // Square-law MOSFET: triode / saturation
            // Sat: Id = (μn·Cox·W/L)/2 * (Vgs-Vth)^2
            // Tri: Id = (μn·Cox·W/L) * [(Vgs-Vth)*Vds - Vds^2/2]
            let kp  = scalar_or_nan(inputs, "kp");   // μn*Cox*W/L (A/V²)
            let vgs = scalar_or_nan(inputs, "Vgs");
            let vth = scalar_or_nan(inputs, "Vth");
            let vds = scalar_or_nan(inputs, "Vds");
            let vov = vgs - vth;
            if vov <= 0.0 { Value::scalar(0.0) } // cutoff
            else if vds >= vov { Value::scalar(kp / 2.0 * vov * vov) } // saturation
            else { Value::scalar(kp * (vov * vds - vds * vds / 2.0)) } // triode
        }
        "eng.elec.igbt_vce_drop" => {
            // IGBT simplified on-state: V_ce = V_ce0 + Ic * R_ce
            let vce0 = scalar_or_nan(inputs, "Vce0");
            let ic   = scalar_or_nan(inputs, "Ic");
            let rce  = scalar_or_nan(inputs, "Rce");
            Value::scalar(vce0 + ic * rce)
        }
        // 2.55 — OpAmp, PWM, H-Bridge, Inverter
        "eng.elec.opamp_vout" => {
            // Ideal: Vout = A*(V+ - V-), clipped to ±Vcc
            let vp  = scalar_or_nan(inputs, "Vp");
            let vm  = scalar_or_nan(inputs, "Vm");
            let a   = scalar_or_nan(inputs, "A");
            let vcc = scalar_or_nan(inputs, "Vcc");
            let vout = (a * (vp - vm)).clamp(-vcc, vcc);
            Value::scalar(vout)
        }
        "eng.elec.pwm_duty" => {
            // Average output = Vdc * duty; duty = t_on / T
            let vdc  = scalar_or_nan(inputs, "Vdc");
            let duty = scalar_or_nan(inputs, "duty");
            Value::scalar(vdc * duty.clamp(0.0, 1.0))
        }
        "eng.elec.hbridge_vout" => {
            // H-bridge: Vout = Vdc * (duty_a - duty_b), bipolar PWM
            let vdc   = scalar_or_nan(inputs, "Vdc");
            let duty_a = scalar_or_nan(inputs, "duty_a");
            let duty_b = scalar_or_nan(inputs, "duty_b");
            Value::scalar(vdc * (duty_a - duty_b))
        }
        "eng.elec.three_phase_spwm" => {
            // 3-phase SPWM line-to-neutral voltage magnitude: V_peak = m * Vdc / 2
            let vdc = scalar_or_nan(inputs, "Vdc");
            let m   = scalar_or_nan(inputs, "m");   // modulation index 0..1
            Value::scalar(m.clamp(0.0, 1.0) * vdc / 2.0)
        }
        // 2.56 — DC Motor, PMSM
        "eng.elec.dc_motor" => {
            // DC motor steady-state: ω = (V - Ia*Ra) / Ke, T = Kt*Ia, P = T*ω
            let v   = scalar_or_nan(inputs, "V");
            let ia  = scalar_or_nan(inputs, "Ia");
            let ra  = scalar_or_nan(inputs, "Ra");
            let ke  = scalar_or_nan(inputs, "Ke");
            let kt  = scalar_or_nan(inputs, "Kt");
            if ke == 0.0 { Value::error("DC motor: Ke = 0") }
            else {
                let omega = (v - ia * ra) / ke;
                let torque = kt * ia;
                let power = torque * omega;
                crate::types::build_table(
                    &["omega", "torque", "power"],
                    &[vec![omega], vec![torque], vec![power]],
                )
            }
        }
        "eng.elec.pmsm_torque" => {
            // PMSM torque in dq-frame: T = (3/2)*(P/2)*(λ*iq + (Ld-Lq)*id*iq)
            let p      = scalar_or_nan(inputs, "P");    // pole pairs
            let lambda = scalar_or_nan(inputs, "lambda"); // flux linkage Wb
            let ld     = scalar_or_nan(inputs, "Ld");
            let lq     = scalar_or_nan(inputs, "Lq");
            let id     = scalar_or_nan(inputs, "id");
            let iq     = scalar_or_nan(inputs, "iq");
            Value::scalar(1.5 * (p / 2.0) * (lambda * iq + (ld - lq) * id * iq))
        }
        "eng.elec.pmsm_vd_vq" => {
            // PMSM dq voltage equations: Vd = Rs*id - ω*Lq*iq, Vq = Rs*iq + ω*Ld*id + ω*λ
            let rs     = scalar_or_nan(inputs, "Rs");
            let ld     = scalar_or_nan(inputs, "Ld");
            let lq     = scalar_or_nan(inputs, "Lq");
            let lambda = scalar_or_nan(inputs, "lambda");
            let omega  = scalar_or_nan(inputs, "omega"); // electrical rad/s
            let id     = scalar_or_nan(inputs, "id");
            let iq     = scalar_or_nan(inputs, "iq");
            let vd = rs * id - omega * lq * iq;
            let vq = rs * iq + omega * ld * id + omega * lambda;
            crate::types::build_table(&["Vd", "Vq"], &[vec![vd], vec![vq]])
        }
        // 2.57 — Battery Thevenin model
        "eng.elec.battery_thevenin" => {
            // Thevenin battery: Vt = OCV - I*(R0 + R1*(1-exp(-t/τ1)))
            // Simple DC approximation: τ >> dt → Vt ≈ OCV - I*(R0 + R1)
            let ocv = scalar_or_nan(inputs, "OCV");
            let i   = scalar_or_nan(inputs, "I");    // discharge positive
            let r0  = scalar_or_nan(inputs, "R0");
            let r1  = scalar_or_nan(inputs, "R1");
            let c1  = scalar_or_nan(inputs, "C1");
            let dt  = scalar_or_nan(inputs, "dt");
            // RC relaxation: V1(t) = V1(0)*exp(-dt/τ) + I*R1*(1-exp(-dt/τ))
            // Assuming V1(0)=0 (initial), τ = R1*C1
            let tau = r1 * c1;
            let v1 = if tau > 0.0 { i * r1 * (1.0 - (-dt / tau).exp()) } else { i * r1 };
            let vt = ocv - i * r0 - v1;
            crate::types::build_table(&["Vt", "V1", "V_drop"], &[vec![vt], vec![v1], vec![i * r0 + v1]])
        }
        "eng.elec.battery_soc" => {
            // SOC update: SOC = SOC0 - (I*dt) / (Q_nom * 3600) where Q_nom in Ah
            let soc0  = scalar_or_nan(inputs, "SOC0");
            let i     = scalar_or_nan(inputs, "I");
            let dt    = scalar_or_nan(inputs, "dt");
            let q_nom = scalar_or_nan(inputs, "Q_nom"); // Ah
            if q_nom == 0.0 { Value::error("Battery: Q_nom = 0") }
            else { Value::scalar((soc0 - i * dt / (q_nom * 3600.0)).clamp(0.0, 1.0)) }
        }

        // ── Thermal Network (item 2.59) ─────────────────────────────────
        "eng.thermal.conductor_R" => {
            // Thermal resistance R = L/(k*A), heat flow Q = ΔT/R
            let l = scalar_or_nan(inputs, "L");
            let k = scalar_or_nan(inputs, "k");
            let a = scalar_or_nan(inputs, "A");
            let dt = scalar_or_nan(inputs, "dT");
            if k == 0.0 || a == 0.0 { Value::error("Thermal: k*A = 0") }
            else {
                let r = l / (k * a);
                Value::scalar(dt / r)
            }
        }
        "eng.thermal.capacitor_dT" => {
            // Thermal capacitor: dT/dt = Q/(m*c), ΔT = Q*dt/(m*c)
            let m = scalar_or_nan(inputs, "m");
            let c = scalar_or_nan(inputs, "c");
            let q = scalar_or_nan(inputs, "Q");
            let dt = scalar_or_nan(inputs, "dt");
            if m == 0.0 || c == 0.0 { Value::error("Thermal cap: m*c = 0") }
            else { Value::scalar(q * dt / (m * c)) }
        }
        "eng.thermal.convection" => {
            // Q = h*A*(T_surface - T_fluid)
            let h  = scalar_or_nan(inputs, "h");
            let a  = scalar_or_nan(inputs, "A");
            let ts = scalar_or_nan(inputs, "Ts");
            let tf = scalar_or_nan(inputs, "Tf");
            Value::scalar(h * a * (ts - tf))
        }
        "eng.thermal.radiation" => {
            // Q = ε*σ*A*(T_s^4 - T_amb^4), σ = 5.670374419e-8 W/m²K⁴
            let eps = scalar_or_nan(inputs, "eps");
            let a   = scalar_or_nan(inputs, "A");
            let ts  = scalar_or_nan(inputs, "Ts");
            let ta  = scalar_or_nan(inputs, "Tamb");
            const SIGMA: f64 = 5.670_374_419e-8;
            Value::scalar(eps * SIGMA * a * (ts.powi(4) - ta.powi(4)))
        }

        // ── Heat Exchanger (item 2.60) ──────────────────────────────────
        "eng.thermal.hx_lmtd" => {
            // LMTD method: Q = U*A*LMTD, LMTD = (ΔT1 - ΔT2) / ln(ΔT1/ΔT2)
            let u   = scalar_or_nan(inputs, "U");
            let a   = scalar_or_nan(inputs, "A");
            let dt1 = scalar_or_nan(inputs, "dT1");
            let dt2 = scalar_or_nan(inputs, "dT2");
            if dt1 <= 0.0 || dt2 <= 0.0 { Value::error("LMTD: ΔT must be positive") }
            else if (dt1 - dt2).abs() < 1e-10 {
                Value::scalar(u * a * dt1) // equal ΔT edge case
            } else {
                let lmtd = (dt1 - dt2) / (dt1 / dt2).ln();
                Value::scalar(u * a * lmtd)
            }
        }
        "eng.thermal.hx_ntu" => {
            // ε-NTU method: ε = 1 - exp(-NTU*(1-Cr)) / (1 - Cr*exp(-NTU*(1-Cr))) for Cr<1
            //               ε = NTU/(1+NTU) for Cr=1 (balanced)
            let ntu = scalar_or_nan(inputs, "NTU");
            let cr  = scalar_or_nan(inputs, "Cr");   // C_min/C_max
            let q_max = scalar_or_nan(inputs, "Q_max"); // C_min*(T_h_in - T_c_in)
            let eps = if (cr - 1.0).abs() < 1e-6 {
                ntu / (1.0 + ntu)
            } else {
                let exp_val = ((-ntu * (1.0 - cr)).exp());
                (1.0 - exp_val) / (1.0 - cr * exp_val)
            };
            crate::types::build_table(&["eps", "Q"], &[vec![eps], vec![eps * q_max]])
        }

        // ── Pipe / Valve / Pump / Hydraulics (items 2.61–2.63) ─────────
        "eng.fluids.pipe_dp" => {
            // Darcy-Weisbach: ΔP = f * (L/D) * (ρ*v²/2) + K_minor * (ρ*v²/2)
            let f  = scalar_or_nan(inputs, "f");       // Darcy friction factor
            let l  = scalar_or_nan(inputs, "L");
            let d  = scalar_or_nan(inputs, "D");
            let rho = scalar_or_nan(inputs, "rho");
            let v   = scalar_or_nan(inputs, "v");       // mean velocity m/s
            let k_m = scalar_or_nan(inputs, "K_minor"); // sum of minor loss coeffs
            if d == 0.0 { Value::error("Pipe: D = 0") }
            else {
                let dyn_press = 0.5 * rho * v * v;
                Value::scalar((f * l / d + k_m) * dyn_press)
            }
        }
        "eng.fluids.valve_cv" => {
            // Valve flow: Q = Cv * sqrt(ΔP / SG), Q in US gpm if Cv in US units
            // SI version: Q(m³/h) = Cv * sqrt(ΔP_bar / SG)
            let cv = scalar_or_nan(inputs, "Cv");
            let dp = scalar_or_nan(inputs, "dP");   // bar
            let sg = scalar_or_nan(inputs, "SG");   // specific gravity
            if sg <= 0.0 { Value::error("Valve: SG ≤ 0") }
            else { Value::scalar(cv * (dp.max(0.0) / sg).sqrt()) }
        }
        "eng.fluids.pump_power" => {
            // Pump hydraulic power: P_hyd = ρ*g*H*Q, shaft power = P_hyd / η
            let rho = scalar_or_nan(inputs, "rho");
            let g   = scalar_or_nan(inputs, "g");
            let h   = scalar_or_nan(inputs, "H");
            let q   = scalar_or_nan(inputs, "Q");
            let eta = scalar_or_nan(inputs, "eta");
            let p_hyd = rho * g * h * q;
            let p_shaft = if eta > 0.0 { p_hyd / eta } else { f64::INFINITY };
            crate::types::build_table(&["P_hyd", "P_shaft"], &[vec![p_hyd], vec![p_shaft]])
        }
        "eng.fluids.orifice_flow" => {
            // Orifice: Q = Cd * A * sqrt(2*ΔP/ρ)
            let cd  = scalar_or_nan(inputs, "Cd");
            let a   = scalar_or_nan(inputs, "A");
            let dp  = scalar_or_nan(inputs, "dP");
            let rho = scalar_or_nan(inputs, "rho");
            if rho <= 0.0 { Value::error("Orifice: ρ ≤ 0") }
            else { Value::scalar(cd * a * (2.0 * dp.max(0.0) / rho).sqrt()) }
        }
        "eng.fluids.accumulator" => {
            // Gas spring accumulator: P1*V1^γ = P2*V2^γ → P2 = P1*(V1/V2)^γ
            let p1    = scalar_or_nan(inputs, "P1");
            let v1    = scalar_or_nan(inputs, "V1");
            let v2    = scalar_or_nan(inputs, "V2");
            let gamma = scalar_or_nan(inputs, "gamma"); // adiabatic index ~1.4
            if v2 <= 0.0 { Value::error("Accumulator: V2 ≤ 0") }
            else { Value::scalar(p1 * (v1 / v2).powf(gamma)) }
        }
        // 2.62 — Hydraulic cylinder/motor
        "eng.fluids.hydraulic_cylinder" => {
            // F = P * A_bore - P_rod * A_rod, v = Q / A_bore
            let p_b  = scalar_or_nan(inputs, "P_bore");
            let a_b  = scalar_or_nan(inputs, "A_bore");
            let p_r  = scalar_or_nan(inputs, "P_rod");
            let a_r  = scalar_or_nan(inputs, "A_rod");
            let q    = scalar_or_nan(inputs, "Q");
            if a_b == 0.0 { Value::error("Cylinder: A_bore = 0") }
            else {
                let f = p_b * a_b - p_r * a_r;
                let v = q / a_b;
                crate::types::build_table(&["F", "v"], &[vec![f], vec![v]])
            }
        }
        "eng.fluids.hydraulic_motor" => {
            // T = ΔP * D / (2π), ω = Q / D * 2π, P = T * ω
            let dp = scalar_or_nan(inputs, "dP");
            let d  = scalar_or_nan(inputs, "D");   // displacement m³/rev
            let q  = scalar_or_nan(inputs, "Q");   // flow rate m³/s
            let eta = scalar_or_nan(inputs, "eta");
            if d == 0.0 { Value::error("Hydraulic motor: D = 0") }
            else {
                let torque = dp * d / (2.0 * std::f64::consts::PI);
                let omega  = q / d * 2.0 * std::f64::consts::PI;
                let power  = torque * omega * eta;
                crate::types::build_table(&["torque", "omega", "power"], &[vec![torque], vec![omega], vec![power]])
            }
        }
        // 2.63 — Fluid properties (polynomial fits for water/oil)
        "eng.fluids.water_density" => {
            // ρ(T) ≈ 999.842 + 0.06786*T - 0.009095*T² + 1.001e-5*T³  (T in °C, valid 0–100°C)
            let t = scalar_or_nan(inputs, "T");
            Value::scalar(999.842 + 0.06786*t - 9.095e-3*t*t + 1.001e-5*t*t*t)
        }
        "eng.fluids.water_viscosity" => {
            // μ(T) [Pa·s] — Vogel equation approximation (T in °C)
            let t = scalar_or_nan(inputs, "T");
            Value::scalar(2.414e-5 * 10.0_f64.powf(247.8 / (t + 273.15 + 133.15)))
        }
        "eng.fluids.oil_viscosity" => {
            // Walther equation: log10(log10(ν+0.7)) = A - B*log10(T_K)
            // Simplified: ν(T) = ν_40 * exp(k*(1/T_K - 1/313.15)) with k from ν_100
            let nu40  = scalar_or_nan(inputs, "nu40");  // cSt at 40°C
            let nu100 = scalar_or_nan(inputs, "nu100"); // cSt at 100°C
            let t     = scalar_or_nan(inputs, "T");     // °C
            if nu40 <= 0.0 || nu100 <= 0.0 { Value::error("Oil: ν must be positive") }
            else {
                // ASTM D341 Walther equation
                let w40  = (nu40 + 0.7_f64).ln().ln();
                let w100 = (nu100 + 0.7_f64).ln().ln();
                let t40_k = 313.15_f64;
                let t100_k = 373.15_f64;
                let b = (w40 - w100) / (t100_k.ln() - t40_k.ln());
                let a = w40 + b * t40_k.ln();
                let t_k = t + 273.15;
                let w = a - b * t_k.ln();
                let nu = (w.exp().exp()) - 0.7;
                Value::scalar(nu)
            }
        }

        // ── BLK-06: Biology and Life Sciences ─────────────────────────
        "bio.michaelis_menten" => {
            let vmax = scalar_or_nan(inputs, "Vmax");
            let km   = scalar_or_nan(inputs, "Km");
            let s    = scalar_or_nan(inputs, "S");
            let denom = km + s;
            if denom == 0.0 { Value::error("Michaelis-Menten: Km+S = 0") }
            else { Value::scalar(vmax * s / denom) }
        }
        "bio.hill_eq" => {
            let n   = scalar_or_nan(inputs, "n");
            let kd  = scalar_or_nan(inputs, "Kd");
            let l   = scalar_or_nan(inputs, "L");
            let ln_val = l.powf(n);
            let kdn    = kd.powf(n);
            let denom  = kdn + ln_val;
            if denom == 0.0 { Value::error("Hill eq: Kd^n + L^n = 0") }
            else { Value::scalar(ln_val / denom) }
        }
        "bio.logistic_growth" => {
            let r  = scalar_or_nan(inputs, "r");
            let k  = scalar_or_nan(inputs, "K");
            let n0 = scalar_or_nan(inputs, "N0");
            let t  = scalar_or_nan(inputs, "t");
            if n0 == 0.0 { Value::error("Logistic growth: N0 = 0") }
            else {
                let denom = 1.0 + (k / n0 - 1.0) * (-r * t).exp();
                if denom == 0.0 { Value::error("Logistic growth: denominator = 0") }
                else { Value::scalar(k / denom) }
            }
        }
        "bio.exp_decay" => {
            let n0  = scalar_or_nan(inputs, "N0");
            let lam = scalar_or_nan(inputs, "lambda");
            let t   = scalar_or_nan(inputs, "t");
            Value::scalar(n0 * (-lam * t).exp())
        }
        "bio.half_life" => {
            let lam = scalar_or_nan(inputs, "lambda");
            if lam == 0.0 { Value::error("Half-life: \u{03BB} = 0") }
            else { Value::scalar(2.0_f64.ln() / lam) }
        }
        "bio.drug_1cmp" => {
            let d = scalar_or_nan(inputs, "D");
            let v = scalar_or_nan(inputs, "V");
            let k = scalar_or_nan(inputs, "k");
            let t = scalar_or_nan(inputs, "t");
            if v == 0.0 { Value::error("Drug 1-cmp: V = 0") }
            else { Value::scalar((d / v) * (-k * t).exp()) }
        }
        "bio.henderson_hasselbalch" => {
            let pka = scalar_or_nan(inputs, "pKa");
            let a   = scalar_or_nan(inputs, "A");
            let ha  = scalar_or_nan(inputs, "HA");
            if ha == 0.0 { Value::error("Henderson-Hasselbalch: [HA] = 0") }
            else { Value::scalar(pka + (a / ha).log10()) }
        }
        "bio.nernst" => {
            let r     = scalar_or_nan(inputs, "R");
            let t     = scalar_or_nan(inputs, "T");
            let z     = scalar_or_nan(inputs, "z");
            let f     = scalar_or_nan(inputs, "F");
            let c_out = scalar_or_nan(inputs, "C_out");
            let c_in  = scalar_or_nan(inputs, "C_in");
            if z == 0.0 || f == 0.0 { Value::error("Nernst: z\u{00B7}F = 0") }
            else if c_in <= 0.0 { Value::error("Nernst: C_in must be > 0") }
            else { Value::scalar((r * t / (z * f)) * (c_out / c_in).ln()) }
        }
        "bio.BMI" => {
            let mass = scalar_or_nan(inputs, "mass_kg");
            let h    = scalar_or_nan(inputs, "height_m");
            if h == 0.0 { Value::error("BMI: height = 0") }
            else { Value::scalar(mass / (h * h)) }
        }
        "bio.BSA_dubois" => {
            // BSA = 0.007184 \u{00B7} W^0.425 \u{00B7} H^0.725  (W in kg, H in cm)
            let w = scalar_or_nan(inputs, "W_kg");
            let h = scalar_or_nan(inputs, "H_cm");
            Value::scalar(0.007184 * w.powf(0.425) * h.powf(0.725))
        }

        // ── BLK-07: Finance — Options & Advanced Instruments ──────────
        "fin.options.bs_call" => {
            let s     = scalar_or_nan(inputs, "S");
            let k     = scalar_or_nan(inputs, "K");
            let t     = scalar_or_nan(inputs, "T");
            let r     = scalar_or_nan(inputs, "r");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 || t <= 0.0 { return Value::error("Black-Scholes: \u{03C3},T must be > 0"); }
            if s <= 0.0 || k <= 0.0     { return Value::error("Black-Scholes: S,K must be > 0"); }
            let sqrt_t = t.sqrt();
            let d1 = ((s / k).ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
            let d2 = d1 - sigma * sqrt_t;
            Value::scalar(s * normal_cdf(d1) - k * (-r * t).exp() * normal_cdf(d2))
        }
        "fin.options.bs_put" => {
            let s     = scalar_or_nan(inputs, "S");
            let k     = scalar_or_nan(inputs, "K");
            let t     = scalar_or_nan(inputs, "T");
            let r     = scalar_or_nan(inputs, "r");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 || t <= 0.0 { return Value::error("Black-Scholes: \u{03C3},T must be > 0"); }
            if s <= 0.0 || k <= 0.0     { return Value::error("Black-Scholes: S,K must be > 0"); }
            let sqrt_t = t.sqrt();
            let d1 = ((s / k).ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
            let d2 = d1 - sigma * sqrt_t;
            Value::scalar(k * (-r * t).exp() * normal_cdf(-d2) - s * normal_cdf(-d1))
        }
        "fin.options.bs_delta" => {
            let s     = scalar_or_nan(inputs, "S");
            let k     = scalar_or_nan(inputs, "K");
            let t     = scalar_or_nan(inputs, "T");
            let r     = scalar_or_nan(inputs, "r");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 || t <= 0.0 { return Value::error("BS delta: \u{03C3},T must be > 0"); }
            if s <= 0.0 || k <= 0.0     { return Value::error("BS delta: S,K must be > 0"); }
            let d1 = ((s / k).ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * t.sqrt());
            Value::scalar(normal_cdf(d1))
        }
        "fin.options.bs_gamma" => {
            let s     = scalar_or_nan(inputs, "S");
            let k     = scalar_or_nan(inputs, "K");
            let t     = scalar_or_nan(inputs, "T");
            let r     = scalar_or_nan(inputs, "r");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 || t <= 0.0 { return Value::error("BS gamma: \u{03C3},T must be > 0"); }
            if s <= 0.0 || k <= 0.0     { return Value::error("BS gamma: S,K must be > 0"); }
            let sqrt_t = t.sqrt();
            let d1 = ((s / k).ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
            let n_d1 = normal_pdf_std(d1);
            Value::scalar(n_d1 / (s * sigma * sqrt_t))
        }
        "fin.options.bs_vega" => {
            let s     = scalar_or_nan(inputs, "S");
            let k     = scalar_or_nan(inputs, "K");
            let t     = scalar_or_nan(inputs, "T");
            let r     = scalar_or_nan(inputs, "r");
            let sigma = scalar_or_nan(inputs, "sigma");
            if sigma <= 0.0 || t <= 0.0 { return Value::error("BS vega: \u{03C3},T must be > 0"); }
            if s <= 0.0 || k <= 0.0     { return Value::error("BS vega: S,K must be > 0"); }
            let sqrt_t = t.sqrt();
            let d1 = ((s / k).ln() + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
            Value::scalar(s * normal_pdf_std(d1) * sqrt_t)
        }
        "fin.options.kelly" => {
            let p_win = scalar_or_nan(inputs, "p_win");
            let b     = scalar_or_nan(inputs, "b");
            if b == 0.0 { Value::error("Kelly: b = 0") }
            else { Value::scalar(p_win - (1.0 - p_win) / b) }
        }
        "fin.options.var_hist" => {
            let conf = scalar_or_nan(inputs, "conf");
            match inputs.get("returns") {
                Some(Value::Vector { value }) if !value.is_empty() => {
                    let mut sorted = value.clone();
                    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                    let idx = ((1.0 - conf) * sorted.len() as f64).floor() as usize;
                    let idx = idx.min(sorted.len() - 1);
                    Value::scalar(-sorted[idx])
                }
                _ => Value::error("VaR: expected non-empty vector"),
            }
        }
        "fin.options.cvar_hist" => {
            let conf = scalar_or_nan(inputs, "conf");
            match inputs.get("returns") {
                Some(Value::Vector { value }) if !value.is_empty() => {
                    let mut sorted = value.clone();
                    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                    let cutoff = ((1.0 - conf) * sorted.len() as f64).floor() as usize;
                    let cutoff = cutoff.max(1).min(sorted.len());
                    let tail_mean = kahan_sum(sorted[..cutoff].iter().copied()) / cutoff as f64;
                    Value::scalar(-tail_mean)
                }
                _ => Value::error("CVaR: expected non-empty vector"),
            }
        }
        "fin.options.bond_duration" => {
            let coupon = scalar_or_nan(inputs, "coupon");
            let face   = scalar_or_nan(inputs, "face");
            let ytm    = scalar_or_nan(inputs, "ytm");
            let n      = scalar_or_nan(inputs, "n").round() as i32;
            if n <= 0 { return Value::error("Bond duration: n must be > 0"); }
            let mut pv_total = 0.0_f64;
            let mut weighted = 0.0_f64;
            for t in 1..=n {
                let cf    = if t == n { coupon + face } else { coupon };
                let pv_t  = cf / (1.0 + ytm).powi(t);
                pv_total += pv_t;
                weighted += t as f64 * pv_t;
            }
            if pv_total == 0.0 { Value::error("Bond duration: PV = 0") }
            else { Value::scalar(weighted / pv_total) }
        }
        "fin.options.dcf" => {
            let wacc = scalar_or_nan(inputs, "wacc");
            let g    = scalar_or_nan(inputs, "g");
            let n    = scalar_or_nan(inputs, "n").round() as i32;
            let fcf  = scalar_or_nan(inputs, "fcf");
            if wacc <= g  { return Value::error("DCF: wacc must be > g"); }
            if n <= 0     { return Value::error("DCF: n must be > 0"); }
            let mut pv = 0.0_f64;
            for i in 1..=n { pv += fcf / (1.0 + wacc).powi(i); }
            let terminal = fcf * (1.0 + g) / (wacc - g);
            pv += terminal / (1.0 + wacc).powi(n);
            Value::scalar(pv)
        }

        // ── BLK-09: Date and Time Calculations ────────────────────────
        "date.from_ymd" => {
            let y = scalar_or_nan(inputs, "y").round() as i64;
            let m = scalar_or_nan(inputs, "m").round() as i64;
            let d = scalar_or_nan(inputs, "d").round() as i64;
            Value::scalar(ymd_to_day(y, m, d) as f64)
        }
        "date.year" => {
            let day = scalar_or_nan(inputs, "day").round() as i64;
            let (y, _, _) = day_to_ymd(day);
            Value::scalar(y as f64)
        }
        "date.month" => {
            let day = scalar_or_nan(inputs, "day").round() as i64;
            let (_, m, _) = day_to_ymd(day);
            Value::scalar(m as f64)
        }
        "date.day_of_month" => {
            let day = scalar_or_nan(inputs, "day").round() as i64;
            let (_, _, d) = day_to_ymd(day);
            Value::scalar(d as f64)
        }
        "date.days_between" => {
            let d1 = scalar_or_nan(inputs, "d1").round() as i64;
            let d2 = scalar_or_nan(inputs, "d2").round() as i64;
            Value::scalar((d2 - d1) as f64)
        }
        "date.add_days" => {
            let d = scalar_or_nan(inputs, "d").round() as i64;
            let n = scalar_or_nan(inputs, "n").round() as i64;
            Value::scalar((d + n) as f64)
        }
        "date.is_leap_year" => {
            let y = scalar_or_nan(inputs, "y").round() as i64;
            let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
            Value::scalar(if leap { 1.0 } else { 0.0 })
        }
        "date.days_in_month" => {
            let m = scalar_or_nan(inputs, "m").round() as i64;
            let y = scalar_or_nan(inputs, "y").round() as i64;
            let days: i64 = match m {
                1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
                4 | 6 | 9 | 11               => 30,
                2 => if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 29 } else { 28 },
                _ => 0,
            };
            Value::scalar(days as f64)
        }

        // ── H5-1: Custom function expression evaluator ──────────────
        "math_expr" => {
            let formula = data
                .get("formula")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if formula.is_empty() {
                return Value::error("Custom function: no formula".to_string());
            }
            // Build variable map from scalar inputs
            let mut vars = std::collections::HashMap::new();
            for (key, val) in inputs {
                match val {
                    Value::Scalar { value: s } => { vars.insert(key.clone(), *s); }
                    Value::Error { .. } => return val.clone(),
                    _ => {} // vectors/tables not supported in expressions
                }
            }
            match crate::expr::eval_expr(formula, &vars) {
                Ok(v) => Value::scalar(v),
                Err(msg) => Value::error(format!("Custom function: {}", msg)),
            }
        }

        // ── SCI-10: Numerical Methods ─────────────────────────────────────────

        // Trapezoidal integration: ∫y dx ≈ dx*(y[0]/2 + y[1]+…+y[n-2] + y[n-1]/2)
        "num.integrate.trapz" => {
            let dx = scalar_or_nan(inputs, "dx");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = yv.len();
                    if n < 2 { return Value::error("trapz: need ≥2 points"); }
                    let sum = yv[0]/2.0 + yv[n-1]/2.0 + yv[1..n-1].iter().sum::<f64>();
                    Value::scalar(sum * dx)
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("trapz: y must be a vector"),
            }
        }

        // Simpson's 1/3 rule — requires odd number of points (n = 2k+1)
        "num.integrate.simpsons" => {
            let dx = scalar_or_nan(inputs, "dx");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = yv.len();
                    if n < 3 { return Value::error("simpsons: need ≥3 points"); }
                    if (n-1) % 2 != 0 { return Value::error("simpsons: n must be odd (2k+1)"); }
                    let mut s = yv[0] + yv[n-1];
                    for i in 1..n-1 { s += yv[i] * if i%2==1 { 4.0 } else { 2.0 }; }
                    Value::scalar(s * dx / 3.0)
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("simpsons: y must be a vector"),
            }
        }

        // Forward finite difference: (y[i+1]-y[i])/dx; last uses backward
        "num.diff.forward" => {
            let dx = scalar_or_nan(inputs, "dx");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = yv.len();
                    if n < 2 { return Value::error("diff_forward: need ≥2 points"); }
                    let mut r = vec![0.0f64; n];
                    for i in 0..n-1 { r[i] = (yv[i+1]-yv[i])/dx; }
                    r[n-1] = (yv[n-1]-yv[n-2])/dx;
                    Value::Vector { value: r }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("diff_forward: y must be a vector"),
            }
        }

        // Central finite difference: (y[i+1]-y[i-1])/(2dx); endpoints use one-sided
        "num.diff.central" => {
            let dx = scalar_or_nan(inputs, "dx");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = yv.len();
                    if n < 3 { return Value::error("diff_central: need ≥3 points"); }
                    let mut r = vec![0.0f64; n];
                    r[0] = (yv[1]-yv[0])/dx;
                    for i in 1..n-1 { r[i] = (yv[i+1]-yv[i-1])/(2.0*dx); }
                    r[n-1] = (yv[n-1]-yv[n-2])/dx;
                    Value::Vector { value: r }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("diff_central: y must be a vector"),
            }
        }

        // Backward finite difference: (y[i]-y[i-1])/dx; first uses forward
        "num.diff.backward" => {
            let dx = scalar_or_nan(inputs, "dx");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = yv.len();
                    if n < 2 { return Value::error("diff_backward: need ≥2 points"); }
                    let mut r = vec![0.0f64; n];
                    r[0] = (yv[1]-yv[0])/dx;
                    for i in 1..n { r[i] = (yv[i]-yv[i-1])/dx; }
                    Value::Vector { value: r }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("diff_backward: y must be a vector"),
            }
        }

        // Root finding: sign-change bracket + Regula Falsi on sampled (xv, f(xv)) data
        "num.root.bisect" => {
            match (inputs.get("xv"), inputs.get("fv")) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: fv })) => {
                    if xv.len() != fv.len() || xv.len() < 2 {
                        return Value::error("root_bisect: xv and fv must have equal length ≥2");
                    }
                    for i in 0..xv.len()-1 {
                        if fv[i] * fv[i+1] <= 0.0 {
                            let df = fv[i+1]-fv[i];
                            if df.abs() < f64::EPSILON { return Value::scalar(xv[i]); }
                            return Value::scalar(xv[i] - fv[i]*(xv[i+1]-xv[i])/df);
                        }
                    }
                    Value::error("root_bisect: no sign change found in provided samples")
                }
                _ => Value::error("root_bisect: xv and fv must be vectors"),
            }
        }

        // Brent's method: IQI when 3 points available, else Regula Falsi
        "num.root.brent" => {
            match (inputs.get("xv"), inputs.get("fv")) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: fv })) => {
                    if xv.len() != fv.len() || xv.len() < 2 {
                        return Value::error("root_brent: xv and fv must have equal length ≥2");
                    }
                    for i in 0..xv.len()-1 {
                        if fv[i] * fv[i+1] <= 0.0 {
                            if i > 0 {
                                let (a,fa)=(xv[i-1],fv[i-1]); let (b,fb)=(xv[i],fv[i]); let (c,fc)=(xv[i+1],fv[i+1]);
                                let d1=(fa-fb)*(fa-fc); let d2=(fb-fa)*(fb-fc); let d3=(fc-fa)*(fc-fb);
                                if d1.abs()>1e-15 && d2.abs()>1e-15 && d3.abs()>1e-15 {
                                    let s=a*fb*fc/d1+b*fa*fc/d2+c*fa*fb/d3;
                                    if s>b.min(c) && s<b.max(c) { return Value::scalar(s); }
                                }
                            }
                            let df=fv[i+1]-fv[i];
                            if df.abs()<f64::EPSILON { return Value::scalar(xv[i]); }
                            return Value::scalar(xv[i]-fv[i]*(xv[i+1]-xv[i])/df);
                        }
                    }
                    Value::error("root_brent: no sign change found in provided samples")
                }
                _ => Value::error("root_brent: xv and fv must be vectors"),
            }
        }

        // Newton-Raphson single step: x₁ = x₀ − f(x₀)/f′(x₀)
        "num.root.newton" => {
            let x0  = scalar_or_nan(inputs, "x0");
            let fx  = scalar_or_nan(inputs, "fx");
            let dfx = scalar_or_nan(inputs, "dfx");
            if dfx.abs() < 1e-15 { Value::error("root_newton: derivative is zero") }
            else { Value::scalar(x0 - fx/dfx) }
        }

        // Nearest-neighbor interpolation on sorted (xv, yv) at query x
        "num.interp.nearest" => {
            let x = scalar_or_nan(inputs, "x");
            match (inputs.get("xv"), inputs.get("yv")) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: yv })) => {
                    if xv.len() != yv.len() || xv.is_empty() {
                        return Value::error("interp_nearest: xv and yv must have same non-empty length");
                    }
                    let mut best=0usize; let mut best_d=(xv[0]-x).abs();
                    for i in 1..xv.len() { let d=(xv[i]-x).abs(); if d<best_d{best_d=d;best=i;} }
                    Value::scalar(yv[best])
                }
                _ => Value::error("interp_nearest: xv and yv must be vectors"),
            }
        }

        // Linear interpolation on sorted (xv, yv) at query x
        "num.interp.linear" => {
            let x = scalar_or_nan(inputs, "x");
            match (inputs.get("xv"), inputs.get("yv")) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: yv })) => {
                    let n = xv.len();
                    if n != yv.len() || n < 2 {
                        return Value::error("interp_linear: xv and yv must have equal length ≥2");
                    }
                    if x <= xv[0] { return Value::scalar(yv[0]); }
                    if x >= xv[n-1] { return Value::scalar(yv[n-1]); }
                    let mut lo=0; let mut hi=n-1;
                    while hi-lo>1 { let mid=(lo+hi)/2; if xv[mid]<=x{lo=mid;}else{hi=mid;} }
                    let t=(x-xv[lo])/(xv[hi]-xv[lo]);
                    Value::scalar(yv[lo]+t*(yv[hi]-yv[lo]))
                }
                _ => Value::error("interp_linear: xv and yv must be vectors"),
            }
        }

        // Natural cubic spline interpolation on sorted (xv, yv) at query xq
        "num.interp.cubic_spline" => {
            let xq = scalar_or_nan(inputs, "xq");
            match (inputs.get("xv"), inputs.get("yv")) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: yv })) => {
                    let n = xv.len();
                    if n != yv.len() || n < 2 {
                        return Value::error("cubic_spline: xv and yv must have equal length ≥2");
                    }
                    if n == 2 {
                        let t=((xq-xv[0])/(xv[1]-xv[0])).clamp(0.0,1.0);
                        return Value::scalar(yv[0]+t*(yv[1]-yv[0]));
                    }
                    let mut h=vec![0.0f64;n-1];
                    for i in 0..n-1 {
                        h[i]=xv[i+1]-xv[i];
                        if h[i]<=0.0 { return Value::error("cubic_spline: xv must be strictly increasing"); }
                    }
                    // Thomas algorithm for natural cubic spline (M[0]=M[n-1]=0)
                    let mut diag=vec![1.0f64;n]; let mut sup=vec![0.0f64;n];
                    let mut sub=vec![0.0f64;n]; let mut rhs=vec![0.0f64;n];
                    for i in 1..n-1 {
                        sub[i]=h[i-1]; diag[i]=2.0*(h[i-1]+h[i]); sup[i]=h[i];
                        rhs[i]=6.0*((yv[i+1]-yv[i])/h[i]-(yv[i]-yv[i-1])/h[i-1]);
                    }
                    let mut c2=vec![0.0f64;n]; let mut d2=vec![0.0f64;n];
                    c2[0]=sup[0]/diag[0]; d2[0]=rhs[0]/diag[0];
                    for i in 1..n {
                        let denom=diag[i]-sub[i]*c2[i-1];
                        if denom.abs()<1e-15 { return Value::error("cubic_spline: ill-conditioned"); }
                        c2[i]=if i<n-1{sup[i]/denom}else{0.0}; d2[i]=(rhs[i]-sub[i]*d2[i-1])/denom;
                    }
                    let mut m=vec![0.0f64;n]; m[n-1]=d2[n-1];
                    for i in (0..n-1).rev() { m[i]=d2[i]-c2[i]*m[i+1]; }
                    if xq<=xv[0] { return Value::scalar(yv[0]); }
                    if xq>=xv[n-1] { return Value::scalar(yv[n-1]); }
                    let mut idx=0; for i in 0..n-1 { if xq>=xv[i]&&xq<xv[i+1]{idx=i;break;} }
                    let hi_i=h[idx]; let t=xq-xv[idx]; let s=xv[idx+1]-xq;
                    Value::scalar(
                        (m[idx]/(6.0*hi_i))*s.powi(3)+(m[idx+1]/(6.0*hi_i))*t.powi(3)
                        +(yv[idx]/hi_i-m[idx]*hi_i/6.0)*s+(yv[idx+1]/hi_i-m[idx+1]*hi_i/6.0)*t
                    )
                }
                _ => Value::error("cubic_spline: xv and yv must be vectors"),
            }
        }

        // ── BLK-10: Lookup Table Interpolation blocks ─────────────────────────

        // 1D lookup — method selected via data.method (nearest/linear/cubic, default linear)
        "lookupTable1D" | "lookup.1d" => {
            let query = scalar_or_nan(inputs, "query");
            let method = data.get("method").and_then(|v|v.as_str()).unwrap_or("linear");
            let xv_in = inputs.get("x_vec").or_else(|| inputs.get("xv"));
            let yv_in = inputs.get("y_vec").or_else(|| inputs.get("yv"));
            match (xv_in, yv_in) {
                (Some(Value::Vector { value: xv }), Some(Value::Vector { value: yv })) => {
                    let n=xv.len();
                    if n!=yv.len()||n<2 { return Value::error("lookup1d: vectors must have equal length ≥2"); }
                    if method=="nearest" {
                        let mut best=0usize; let mut best_d=(xv[0]-query).abs();
                        for i in 1..n { let d=(xv[i]-query).abs(); if d<best_d{best_d=d;best=i;} }
                        Value::scalar(yv[best])
                    } else { // linear (default; cubic handled via num.interp.cubic_spline)
                        if query<=xv[0] { return Value::scalar(yv[0]); }
                        if query>=xv[n-1] { return Value::scalar(yv[n-1]); }
                        let mut lo=0; let mut hi=n-1;
                        while hi-lo>1 { let mid=(lo+hi)/2; if xv[mid]<=query{lo=mid;}else{hi=mid;} }
                        let t=(query-xv[lo])/(xv[hi]-xv[lo]);
                        Value::scalar(yv[lo]+t*(yv[hi]-yv[lo]))
                    }
                }
                _ => Value::error("lookup1d: x_vec and y_vec must be vectors"),
            }
        }

        // 2D lookup — bilinear interpolation
        "lookupTable2D" | "lookup.2d" => {
            let qx=scalar_or_nan(inputs,"qx"); let qy=scalar_or_nan(inputs,"qy");
            match (inputs.get("x_vec"),inputs.get("y_vec"),inputs.get("z_mat")) {
                (Some(Value::Vector{value:xv}),Some(Value::Vector{value:yv}),Some(Value::Table{rows,..})) => {
                    let nx=xv.len(); let ny=yv.len();
                    if nx<2||ny<2 { return Value::error("lookup2d: need ≥2 x and y points"); }
                    if rows.len()!=ny { return Value::error("lookup2d: z_mat rows must equal len(y_vec)"); }
                    let qxc=qx.clamp(xv[0],xv[nx-1]); let qyc=qy.clamp(yv[0],yv[ny-1]);
                    let mut xi=0usize; for i in 0..nx-1 { if xv[i]<=qxc&&qxc<=xv[i+1]{xi=i;break;} }
                    let mut yi=0usize; for i in 0..ny-1 { if yv[i]<=qyc&&qyc<=yv[i+1]{yi=i;break;} }
                    let get_z=|r:usize,c:usize|rows.get(r).and_then(|row|row.get(c)).copied().unwrap_or(f64::NAN);
                    let tx=if(xv[xi+1]-xv[xi]).abs()<f64::EPSILON{0.0}else{(qxc-xv[xi])/(xv[xi+1]-xv[xi])};
                    let ty=if(yv[yi+1]-yv[yi]).abs()<f64::EPSILON{0.0}else{(qyc-yv[yi])/(yv[yi+1]-yv[yi])};
                    Value::scalar((1.0-tx)*(1.0-ty)*get_z(yi,xi)+tx*(1.0-ty)*get_z(yi,xi+1)
                        +(1.0-tx)*ty*get_z(yi+1,xi)+tx*ty*get_z(yi+1,xi+1))
                }
                _ => Value::error("lookup2d: x_vec, y_vec (vectors) and z_mat (table) required"),
            }
        }

        // ── TBL-03: Table row/column slicing ─────────────────────────────────

        // Extract row i as a vector
        "tbl.row_slice" | "table_row_slice" => {
            let i=scalar_or_nan(inputs,"i").round() as usize;
            match inputs.get("table") {
                Some(Value::Table{rows,..}) => {
                    if i>=rows.len() {
                        Value::error(format!("table_row_slice: row {} out of bounds (len={})",i,rows.len()))
                    } else { Value::Vector{value:rows[i].clone()} }
                }
                Some(e @ Value::Error{..}) => e.clone(),
                _ => Value::error("table_row_slice: expected table input"),
            }
        }

        // Extract named column as a vector
        "tbl.col_slice" | "table_col_slice" => {
            let col_name=data.get("col").or_else(||data.get("column")).and_then(|v|v.as_str()).unwrap_or("");
            match inputs.get("table") {
                Some(Value::Table{columns,rows}) => {
                    match columns.iter().position(|c|c==col_name) {
                        Some(idx) => {
                            let col:Vec<f64>=rows.iter().map(|row|row.get(idx).copied().unwrap_or(f64::NAN)).collect();
                            Value::Vector{value:col}
                        }
                        None => Value::error(format!("table_col_slice: column '{}' not found",col_name)),
                    }
                }
                Some(e @ Value::Error{..}) => e.clone(),
                _ => Value::error("table_col_slice: expected table input"),
            }
        }

        // ── BLK-08: Text / String ops ─────────────────────────────────────────

        // Format a number as text: num_to_text(value, format) where format is "%.2f", "%e", "%g"
        "num_to_text" | "text.num_to_text" => {
            let val = scalar_or_nan(inputs, "value");
            let fmt = data.get("format").and_then(|v|v.as_str()).unwrap_or("%.6g");
            // Implement a subset of printf-style formatting
            let text = format_number(val, fmt);
            Value::Text { value: text }
        }

        // Concatenate two text values
        "text_concat" | "text.concat" => {
            let a = get_text_or_num(inputs, "a");
            let b = get_text_or_num(inputs, "b");
            match (a, b) {
                (Ok(sa), Ok(sb)) => Value::Text { value: format!("{}{}", sa, sb) },
                (Err(e), _) | (_, Err(e)) => Value::error(e),
            }
        }

        // Length of a text value
        "text_length" | "text.length" => {
            match inputs.get("value").or_else(|| inputs.get("text")) {
                Some(Value::Text { value: s }) => Value::scalar(s.chars().count() as f64),
                Some(Value::Error { .. }) => inputs.get("value").or_else(|| inputs.get("text")).cloned().unwrap(),
                _ => Value::error("text_length: expected text input"),
            }
        }

        // Parse text as a number
        "text_to_num" | "text.to_num" => {
            match inputs.get("text").or_else(|| inputs.get("value")) {
                Some(Value::Text { value: s }) => {
                    match s.trim().parse::<f64>() {
                        Ok(v) => Value::scalar(v),
                        Err(_) => Value::error(format!("text_to_num: cannot parse '{}' as number", s)),
                    }
                }
                Some(Value::Scalar { value: v }) => Value::scalar(*v),
                Some(Value::Error { .. }) => inputs.get("text").or_else(|| inputs.get("value")).cloned().unwrap(),
                _ => Value::error("text_to_num: expected text input"),
            }
        }

        // Display pass-through for Text values
        "textDisplay" | "text.display" => {
            inputs.get("value").cloned().unwrap_or(Value::Text { value: String::new() })
        }

        // ── SCI-04: Interval Arithmetic ───────────────────────────────────────

        // Create interval from center and half-width
        "interval_from" | "interval.from_center" => {
            let center = scalar_or_nan(inputs, "center");
            let hw = scalar_or_nan(inputs, "half_width").abs();
            if center.is_nan() || hw.is_nan() { Value::error("interval_from: NaN input") }
            else { Value::Interval { lo: center - hw, hi: center + hw } }
        }

        // Create interval from explicit bounds
        "interval_from_bounds" | "interval.from_bounds" => {
            let lo = scalar_or_nan(inputs, "lo");
            let hi = scalar_or_nan(inputs, "hi");
            if lo.is_nan() || hi.is_nan() { Value::error("interval_from_bounds: NaN input") }
            else { Value::Interval { lo: lo.min(hi), hi: lo.max(hi) } }
        }

        // Extract lower bound
        "interval_lo" | "interval.lo" => {
            match inputs.get("interval").or_else(|| inputs.get("i")) {
                Some(Value::Interval { lo, .. }) => Value::scalar(*lo),
                Some(Value::Scalar { value: v }) => Value::scalar(*v),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_lo: expected interval input"),
            }
        }

        // Extract upper bound
        "interval_hi" | "interval.hi" => {
            match inputs.get("interval").or_else(|| inputs.get("i")) {
                Some(Value::Interval { hi, .. }) => Value::scalar(*hi),
                Some(Value::Scalar { value: v }) => Value::scalar(*v),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_hi: expected interval input"),
            }
        }

        // Extract midpoint
        "interval_mid" | "interval.mid" => {
            match inputs.get("interval").or_else(|| inputs.get("i")) {
                Some(Value::Interval { lo, hi }) => Value::scalar((lo + hi) / 2.0),
                Some(Value::Scalar { value: v }) => Value::scalar(*v),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_mid: expected interval input"),
            }
        }

        // Width of interval
        "interval_width" | "interval.width" => {
            match inputs.get("interval").or_else(|| inputs.get("i")) {
                Some(Value::Interval { lo, hi }) => Value::scalar(hi - lo),
                Some(Value::Scalar { .. }) => Value::scalar(0.0),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_width: expected interval input"),
            }
        }

        // Test if scalar x is contained in interval
        "interval_contains" | "interval.contains" => {
            let x = scalar_or_nan(inputs, "x");
            match inputs.get("interval").or_else(|| inputs.get("i")) {
                Some(Value::Interval { lo, hi }) => Value::scalar(if x >= *lo && x <= *hi { 1.0 } else { 0.0 }),
                Some(Value::Scalar { value: v }) => Value::scalar(if (x - v).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_contains: expected interval input"),
            }
        }

        // Interval add: [a,b] + [c,d] = [a+c, b+d]
        "interval_add" | "interval.add" => {
            interval_binary(inputs, "a", "b", |al,ah,bl,bh| (al+bl, ah+bh))
        }

        // Interval subtract: [a,b] - [c,d] = [a-d, b-c]
        "interval_sub" | "interval.subtract" => {
            interval_binary(inputs, "a", "b", |al,ah,bl,bh| (al-bh, ah-bl))
        }

        // Interval multiply: [a,b] * [c,d] = [min(ac,ad,bc,bd), max(ac,ad,bc,bd)]
        "interval_mul" | "interval.multiply" => {
            interval_binary(inputs, "a", "b", |al,ah,bl,bh| {
                let products = [al*bl, al*bh, ah*bl, ah*bh];
                (products.iter().cloned().fold(f64::INFINITY, f64::min),
                 products.iter().cloned().fold(f64::NEG_INFINITY, f64::max))
            })
        }

        // Interval divide: [a,b] / [c,d] — error if 0 ∈ [c,d]
        "interval_div" | "interval.divide" => {
            match (inputs.get("a"), inputs.get("b")) {
                (Some(va), Some(vb)) => {
                    let (al, ah) = match va { Value::Interval{lo,hi}=>(*lo,*hi), Value::Scalar{value:v}=>(*v,*v), Value::Error{..}=>return va.clone(), _=>return Value::error("interval_div: 'a' must be interval or scalar") };
                    let (bl, bh) = match vb { Value::Interval{lo,hi}=>(*lo,*hi), Value::Scalar{value:v}=>(*v,*v), Value::Error{..}=>return vb.clone(), _=>return Value::error("interval_div: 'b' must be interval or scalar") };
                    if bl <= 0.0 && bh >= 0.0 { return Value::error("interval_div: divisor interval contains zero"); }
                    let products = [al/bl, al/bh, ah/bl, ah/bh];
                    Value::Interval {
                        lo: products.iter().cloned().fold(f64::INFINITY, f64::min),
                        hi: products.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
                    }
                }
                _ => Value::error("interval_div: expected interval or scalar inputs 'a' and 'b'"),
            }
        }

        // Interval power: [a,b]^n — monotone for positive intervals
        "interval_pow" | "interval.power" => {
            let n = scalar_or_nan(inputs, "n");
            match inputs.get("a").or_else(|| inputs.get("base")) {
                Some(Value::Interval { lo, hi }) => {
                    let vals = [lo.powf(n), hi.powf(n), if n.floor()==n && n as i64 % 2==0 && *lo<0.0 { 0.0 } else { f64::INFINITY }];
                    let lo_out = vals.iter().cloned().fold(f64::INFINITY, f64::min).max(if n.floor()==n && n as i64 % 2==0 { 0.0 } else { f64::NEG_INFINITY });
                    let hi_out = lo.abs().max(hi.abs()).powf(n);
                    Value::Interval { lo: lo.powf(n).min(hi.powf(n)).min(lo_out), hi: hi_out }
                }
                Some(Value::Scalar { value: v }) => Value::scalar(v.powf(n)),
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("interval_pow: expected interval or scalar input"),
            }
        }

        // ── SCI-12: FFT and Signal Processing ────────────────────────────────

        // FFT magnitude spectrum: input vector y → output vector of magnitude |FFT[k]| for k=0..n/2
        "fft_magnitude" | "signal.fft_magnitude" => {
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = next_pow2(yv.len());
                    let mut re: Vec<f64> = yv.iter().cloned().collect();
                    re.resize(n, 0.0); // zero-pad to power of 2
                    let mut im = vec![0.0f64; n];
                    fft_inplace(&mut re, &mut im, false);
                    let half = n / 2 + 1;
                    let mag: Vec<f64> = (0..half).map(|k| (re[k]*re[k]+im[k]*im[k]).sqrt()).collect();
                    Value::Vector { value: mag }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("fft_magnitude: y must be a vector"),
            }
        }

        // FFT power spectrum: |FFT[k]|^2 / n
        "fft_power" | "signal.fft_power" => {
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    let n = next_pow2(yv.len());
                    let mut re: Vec<f64> = yv.iter().cloned().collect();
                    re.resize(n, 0.0);
                    let mut im = vec![0.0f64; n];
                    fft_inplace(&mut re, &mut im, false);
                    let half = n / 2 + 1;
                    let nf = n as f64;
                    let power: Vec<f64> = (0..half).map(|k| (re[k]*re[k]+im[k]*im[k])/nf).collect();
                    Value::Vector { value: power }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("fft_power: y must be a vector"),
            }
        }

        // FFT frequency bin values: given n samples at sample_rate, return frequency for each bin
        "fft_freq_bins" | "signal.fft_freq_bins" => {
            let n_raw = scalar_or_nan(inputs, "n");
            let sample_rate = scalar_or_nan(inputs, "sample_rate");
            if n_raw.is_nan() || sample_rate.is_nan() || sample_rate <= 0.0 {
                Value::error("fft_freq_bins: n and sample_rate must be positive")
            } else {
                let n = n_raw.round() as usize;
                let half = n / 2 + 1;
                let df = sample_rate / n as f64;
                Value::Vector { value: (0..half).map(|k| k as f64 * df).collect() }
            }
        }

        // Hann window
        "window_hann" | "signal.window_hann" => {
            let n_raw = scalar_or_nan(inputs, "n");
            if n_raw.is_nan() || n_raw < 2.0 { return Value::error("window_hann: n must be >=2"); }
            let n = n_raw.round() as usize;
            let two_pi = 2.0 * std::f64::consts::PI;
            Value::Vector { value: (0..n).map(|i| 0.5*(1.0 - (two_pi*i as f64/(n-1) as f64).cos())).collect() }
        }

        // Hamming window
        "window_hamming" | "signal.window_hamming" => {
            let n_raw = scalar_or_nan(inputs, "n");
            if n_raw.is_nan() || n_raw < 2.0 { return Value::error("window_hamming: n must be >=2"); }
            let n = n_raw.round() as usize;
            let two_pi = 2.0 * std::f64::consts::PI;
            Value::Vector { value: (0..n).map(|i| 0.54 - 0.46*(two_pi*i as f64/(n-1) as f64).cos()).collect() }
        }

        // Blackman window
        "window_blackman" | "signal.window_blackman" => {
            let n_raw = scalar_or_nan(inputs, "n");
            if n_raw.is_nan() || n_raw < 2.0 { return Value::error("window_blackman: n must be >=2"); }
            let n = n_raw.round() as usize;
            let two_pi = 2.0 * std::f64::consts::PI;
            Value::Vector { value: (0..n).map(|i| {
                let x = two_pi * i as f64 / (n-1) as f64;
                0.42 - 0.5*x.cos() + 0.08*(2.0*x).cos()
            }).collect() }
        }

        // FIR lowpass filter (windowed sinc)
        "filter_lowpass_fir" | "signal.filter_lowpass_fir" => {
            let cutoff = scalar_or_nan(inputs, "cutoff_norm"); // normalized 0..0.5
            let taps_f = scalar_or_nan(inputs, "taps");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    if cutoff.is_nan() || cutoff <= 0.0 || cutoff >= 0.5 {
                        return Value::error("filter_lowpass_fir: cutoff_norm must be in (0, 0.5)");
                    }
                    let taps = taps_f.round() as usize;
                    if taps < 3 || taps % 2 == 0 { return Value::error("filter_lowpass_fir: taps must be odd >=3"); }
                    // Windowed sinc filter
                    let half = taps / 2;
                    let h: Vec<f64> = (0..taps).map(|i| {
                        let n = i as f64 - half as f64;
                        let sinc = if n == 0.0 { 2.0*cutoff } else { (2.0*cutoff*std::f64::consts::PI*n).sin() / (std::f64::consts::PI*n) };
                        // Hann window
                        let w = 0.5*(1.0-(2.0*std::f64::consts::PI*i as f64/(taps-1) as f64).cos());
                        sinc * w
                    }).collect();
                    // Convolve y with h
                    let ny = yv.len();
                    let out: Vec<f64> = (0..ny).map(|i| {
                        let mut sum = 0.0;
                        for (j, &hj) in h.iter().enumerate() {
                            let idx = i as isize + j as isize - half as isize;
                            if idx >= 0 && idx < ny as isize { sum += yv[idx as usize] * hj; }
                        }
                        sum
                    }).collect();
                    Value::Vector { value: out }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("filter_lowpass_fir: y must be a vector"),
            }
        }

        // FIR highpass filter (spectral inversion of lowpass)
        "filter_highpass_fir" | "signal.filter_highpass_fir" => {
            let cutoff = scalar_or_nan(inputs, "cutoff_norm");
            let taps_f = scalar_or_nan(inputs, "taps");
            match inputs.get("y") {
                Some(Value::Vector { value: yv }) => {
                    if cutoff.is_nan() || cutoff <= 0.0 || cutoff >= 0.5 {
                        return Value::error("filter_highpass_fir: cutoff_norm must be in (0, 0.5)");
                    }
                    let taps = taps_f.round() as usize;
                    if taps < 3 || taps % 2 == 0 { return Value::error("filter_highpass_fir: taps must be odd >=3"); }
                    let half = taps / 2;
                    // Spectral inversion: h_hp[n] = -h_lp[n] + delta[n-half]
                    let h: Vec<f64> = (0..taps).map(|i| {
                        let n = i as f64 - half as f64;
                        let sinc = if n == 0.0 { 2.0*cutoff } else { (2.0*cutoff*std::f64::consts::PI*n).sin() / (std::f64::consts::PI*n) };
                        let w = 0.5*(1.0-(2.0*std::f64::consts::PI*i as f64/(taps-1) as f64).cos());
                        let lp = sinc * w;
                        if i == half { 1.0 - lp } else { -lp }
                    }).collect();
                    let ny = yv.len();
                    let out: Vec<f64> = (0..ny).map(|i| {
                        let mut sum = 0.0;
                        for (j, &hj) in h.iter().enumerate() {
                            let idx = i as isize + j as isize - half as isize;
                            if idx >= 0 && idx < ny as isize { sum += yv[idx as usize] * hj; }
                        }
                        sum
                    }).collect();
                    Value::Vector { value: out }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("filter_highpass_fir: y must be a vector"),
            }
        }

        // ── IIR Filter Design (signal module) ────────────────────────────────

        // Butterworth IIR lowpass or highpass filter.
        // Data: order (int, 1-8), pass ("lowpass"|"highpass"), zeroPhaseBool.
        // Inputs: y (Signal vector), cutoff (normalised 0-1, i.e. fraction of Nyquist).
        "signal.filter_butter" | "filter_butter" => {
            use crate::signal::{butterworth, FilterPass};
            let yv = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("filter_butter: y must be a vector"),
            };
            let cutoff = match inputs.get("cutoff") {
                Some(Value::Scalar { value: v }) => *v,
                _ => data.get("cutoff").and_then(|v| v.as_f64()).unwrap_or(0.3),
            };
            let order = data.get("order").and_then(|v| v.as_u64()).unwrap_or(4) as usize;
            let pass_str = data.get("pass").and_then(|v| v.as_str()).unwrap_or("lowpass");
            let pass = if pass_str == "highpass" { FilterPass::Highpass } else { FilterPass::Lowpass };
            let zero_phase = data.get("zeroPhaseBool").and_then(|v| v.as_bool()).unwrap_or(false);
            match butterworth(order, cutoff, pass) {
                Err(e) => Value::error(&format!("filter_butter: {e}")),
                Ok(sos) => {
                    let out = if zero_phase {
                        crate::signal::apply_sos_zero_phase(&sos, &yv)
                    } else {
                        crate::signal::apply_sos(&sos, &yv)
                    };
                    Value::Vector { value: out }
                }
            }
        }

        // Chebyshev Type I IIR filter.
        // Data: order (1-8), rippleDb (float, default 0.5), pass ("lowpass"|"highpass").
        "signal.filter_cheby1" | "filter_cheby1" => {
            use crate::signal::{chebyshev1, FilterPass};
            let yv = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("filter_cheby1: y must be a vector"),
            };
            let cutoff = match inputs.get("cutoff") {
                Some(Value::Scalar { value: v }) => *v,
                _ => data.get("cutoff").and_then(|v| v.as_f64()).unwrap_or(0.3),
            };
            let order = data.get("order").and_then(|v| v.as_u64()).unwrap_or(4) as usize;
            let ripple_db = data.get("rippleDb").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let pass_str = data.get("pass").and_then(|v| v.as_str()).unwrap_or("lowpass");
            let pass = if pass_str == "highpass" { FilterPass::Highpass } else { FilterPass::Lowpass };
            let zero_phase = data.get("zeroPhaseBool").and_then(|v| v.as_bool()).unwrap_or(false);
            match chebyshev1(order, cutoff, ripple_db, pass) {
                Err(e) => Value::error(&format!("filter_cheby1: {e}")),
                Ok(sos) => {
                    let out = if zero_phase {
                        crate::signal::apply_sos_zero_phase(&sos, &yv)
                    } else {
                        crate::signal::apply_sos(&sos, &yv)
                    };
                    Value::Vector { value: out }
                }
            }
        }

        // Zero-phase Butterworth filter convenience block.
        // Same as filter_butter with zeroPhaseBool=true.
        "signal.filter_zero_phase" | "filter_zero_phase" => {
            use crate::signal::{butterworth, FilterPass};
            let yv = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("filter_zero_phase: y must be a vector"),
            };
            let cutoff = match inputs.get("cutoff") {
                Some(Value::Scalar { value: v }) => *v,
                _ => data.get("cutoff").and_then(|v| v.as_f64()).unwrap_or(0.3),
            };
            let order = data.get("order").and_then(|v| v.as_u64()).unwrap_or(4) as usize;
            let pass_str = data.get("pass").and_then(|v| v.as_str()).unwrap_or("lowpass");
            let pass = if pass_str == "highpass" { FilterPass::Highpass } else { FilterPass::Lowpass };
            match butterworth(order, cutoff, pass) {
                Err(e) => Value::error(&format!("filter_zero_phase: {e}")),
                Ok(sos) => Value::Vector {
                    value: crate::signal::apply_sos_zero_phase(&sos, &yv),
                },
            }
        }

        // ── SCI-08: Complex Number Operations ─────────────────────────────────

        "complex_from" | "complex.from" => {
            let re = scalar_or_nan(inputs, "re");
            let im = scalar_or_nan(inputs, "im");
            Value::Complex { re, im }
        }
        "complex_re" | "complex.re" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,..}) => Value::scalar(*re),
                Some(Value::Scalar{value:v}) => Value::scalar(*v),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_re: expected complex input"),
            }
        }
        "complex_im" | "complex.im" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{im,..}) => Value::scalar(*im),
                Some(Value::Scalar{..}) => Value::scalar(0.0),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_im: expected complex input"),
            }
        }
        "complex_mag" | "complex.mag" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,im}) => Value::scalar((re*re+im*im).sqrt()),
                Some(Value::Scalar{value:v}) => Value::scalar(v.abs()),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_mag: expected complex input"),
            }
        }
        "complex_arg" | "complex.arg" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,im}) => Value::scalar(im.atan2(*re)),
                Some(Value::Scalar{value:v}) => Value::scalar(if *v>=0.0{0.0}else{std::f64::consts::PI}),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_arg: expected complex input"),
            }
        }
        "complex_conj" | "complex.conj" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,im}) => Value::Complex{re:*re,im:-im},
                Some(s@Value::Scalar{..}) => s.clone(),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_conj: expected complex input"),
            }
        }
        "complex_add" | "complex.add" => {
            complex_binary(inputs, "z1", "z2", |r1,i1,r2,i2| (r1+r2, i1+i2))
        }
        "complex_mul" | "complex.mul" => {
            complex_binary(inputs, "z1", "z2", |r1,i1,r2,i2| (r1*r2-i1*i2, r1*i2+i1*r2))
        }
        "complex_div" | "complex.div" => {
            complex_binary(inputs, "z1", "z2", |r1,i1,r2,i2| {
                let denom = r2*r2+i2*i2;
                if denom.abs()<1e-300 { (f64::NAN, f64::NAN) }
                else { ((r1*r2+i1*i2)/denom, (i1*r2-r1*i2)/denom) }
            })
        }
        "complex_exp" | "complex.exp" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,im}) => {
                    let r = re.exp();
                    Value::Complex{re:r*im.cos(), im:r*im.sin()}
                }
                Some(Value::Scalar{value:v}) => Value::scalar(v.exp()),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_exp: expected complex input"),
            }
        }
        "complex_ln" | "complex.ln" => {
            match inputs.get("z").or_else(||inputs.get("value")) {
                Some(Value::Complex{re,im}) => {
                    let r = (re*re+im*im).sqrt();
                    if r < 1e-300 { Value::error("complex_ln: input is zero") }
                    else { Value::Complex{re:r.ln(), im:im.atan2(*re)} }
                }
                Some(Value::Scalar{value:v}) => Value::scalar(v.ln()),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_ln: expected complex input"),
            }
        }
        "complex_pow" | "complex.pow" => {
            // z^n where n is a real scalar
            let n = scalar_or_nan(inputs, "n");
            match inputs.get("z").or_else(||inputs.get("base")) {
                Some(Value::Complex{re,im}) => {
                    let r = (re*re+im*im).sqrt().powf(n);
                    let theta = im.atan2(*re) * n;
                    Value::Complex{re:r*theta.cos(), im:r*theta.sin()}
                }
                Some(Value::Scalar{value:v}) => Value::scalar(v.powf(n)),
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("complex_pow: expected complex input"),
            }
        }

        // ── SCI-09: Matrix Operations ─────────────────────────────────────────

        // Convert Table to Matrix
        "matrix_from_table" | "matrix.from_table" => {
            match inputs.get("table") {
                Some(Value::Table{columns,rows}) => {
                    let nr = rows.len();
                    if nr == 0 { return Value::error("matrix_from_table: empty table"); }
                    let nc = columns.len();
                    let mut data = Vec::with_capacity(nr*nc);
                    for row in rows {
                        for j in 0..nc { data.push(row.get(j).copied().unwrap_or(f64::NAN)); }
                    }
                    Value::Matrix{rows:nr,cols:nc,data}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_from_table: expected table input"),
            }
        }

        // Convert Matrix to Table
        "matrix_to_table" | "matrix.to_table" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    let columns: Vec<String> = (0..*nc).map(|j| format!("col{}", j)).collect();
                    let rows: Vec<Vec<f64>> = (0..*nr).map(|i| data[i*nc..(i+1)*nc].to_vec()).collect();
                    Value::Table{columns,rows}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_to_table: expected matrix input"),
            }
        }

        // Matrix transpose
        "matrix_transpose" | "matrix.transpose" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    let mut out = vec![0.0f64; nr*nc];
                    for i in 0..*nr { for j in 0..*nc { out[j*nr+i] = data[i*nc+j]; } }
                    Value::Matrix{rows:*nc,cols:*nr,data:out}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_transpose: expected matrix input"),
            }
        }

        // Matrix multiply A*B — dispatches to linalg (faer for large matrices)
        "matrix_multiply" | "matrix.multiply" => {
            match (inputs.get("a").or_else(||inputs.get("A")), inputs.get("b").or_else(||inputs.get("B"))) {
                (Some(Value::Matrix{rows:ar,cols:ac,data:ad}), Some(Value::Matrix{rows:br,cols:bc,data:bd})) => {
                    crate::linalg::matrix_multiply(*ar, *ac, ad, *br, *bc, bd)
                }
                (Some(e@Value::Error{..}),_)|(_, Some(e@Value::Error{..})) => e.clone(),
                _ => Value::error("matrix_multiply: expected two matrix inputs 'a' and 'b'"),
            }
        }

        // Matrix determinant — dispatches to linalg (faer for large matrices)
        "matrix_det" | "matrix.det" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_det: matrix must be square"); }
                    Value::scalar(crate::linalg::matrix_det(*n, data))
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_det: expected matrix input"),
            }
        }

        // Matrix trace
        "matrix_trace" | "matrix.trace" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    let diag_len = (*nr).min(*nc);
                    Value::scalar((0..diag_len).map(|i| data[i*nc+i]).sum())
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_trace: expected matrix input"),
            }
        }

        // Matrix inverse — dispatches to linalg (faer for large matrices)
        "matrix_inverse" | "matrix.inverse" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_inverse: matrix must be square"); }
                    match crate::linalg::matrix_inverse(*n, data) {
                        Some(inv) => Value::Matrix{rows:*n,cols:*n,data:inv},
                        None => Value::error("matrix_inverse: singular matrix"),
                    }
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_inverse: expected matrix input"),
            }
        }

        // Matrix solve Ax=b — dispatches to linalg (faer for large matrices)
        "matrix_solve" | "matrix.solve" => {
            match (inputs.get("a").or_else(||inputs.get("A")), inputs.get("b")) {
                (Some(Value::Matrix{rows:nr,cols:nc,data:adata}), Some(Value::Vector{value:bv})) => {
                    if *nr != bv.len() { return Value::error("matrix_solve: rows of A must equal len of b"); }
                    match crate::linalg::matrix_solve(*nr, *nc, adata, bv) {
                        Some(x) => Value::Vector{value:x},
                        None => Value::error("matrix_solve: singular system"),
                    }
                }
                (Some(e@Value::Error{..}),_)|(_, Some(e@Value::Error{..})) => e.clone(),
                _ => Value::error("matrix_solve: expected matrix 'a' and vector 'b'"),
            }
        }

        // ── Matrix Decompositions (via linalg module) ─────────────

        // LU decomposition: returns Table with L, U, P columns as serialized matrices
        "matrix_lu" | "matrix.lu" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_lu: matrix must be square"); }
                    let (l, _u, _p) = crate::linalg::lu_decompose(*n, data);
                    // Return as a Table with three columns: L, U, P (flattened)
                    // Return L as primary output (most common usage)
                    Value::Matrix{rows:*n,cols:*n,data:l}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_lu: expected square matrix input"),
            }
        }

        // QR decomposition: returns Q matrix
        "matrix_qr" | "matrix.qr" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    let (q, _r) = crate::linalg::qr_decompose(*nr, *nc, data);
                    let min_dim = (*nr).min(*nc);
                    Value::Matrix{rows:*nr,cols:min_dim,data:q}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_qr: expected matrix input"),
            }
        }

        // SVD: returns singular values as a vector
        "matrix_svd" | "matrix.svd" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    let (_u, sigma, _v) = crate::linalg::svd(*nr, *nc, data);
                    Value::Vector{value:sigma}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_svd: expected matrix input"),
            }
        }

        // Cholesky: returns L such that A = L Lᵀ
        "matrix_cholesky" | "matrix.cholesky" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_cholesky: matrix must be square"); }
                    match crate::linalg::cholesky(*n, data) {
                        Some(l) => Value::Matrix{rows:*n,cols:*n,data:l},
                        None => Value::error("matrix_cholesky: matrix is not positive definite"),
                    }
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_cholesky: expected square matrix input"),
            }
        }

        // Eigendecomposition: returns eigenvalues as a vector
        "matrix_eigen" | "matrix.eigen" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_eigen: matrix must be square"); }
                    let (vals_re, vals_im, _vecs) = crate::linalg::eigendecompose(*n, data);
                    // If all imaginary parts are zero, return real eigenvalues
                    let all_real = vals_im.iter().all(|v| v.abs() < 1e-12);
                    if all_real {
                        Value::Vector{value:vals_re}
                    } else {
                        // Return as table with re/im columns
                        let columns = vec!["real".to_string(), "imag".to_string()];
                        let rows: Vec<Vec<f64>> = vals_re.iter().zip(vals_im.iter())
                            .map(|(&re, &im)| vec![re, im])
                            .collect();
                        Value::Table{columns, rows}
                    }
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_eigen: expected square matrix input"),
            }
        }

        // Schur decomposition: returns T (upper quasi-triangular)
        // For real matrices, Schur form has 1×1 and 2×2 blocks on diagonal
        "matrix_schur" | "matrix.schur" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:n,cols:nc,data}) => {
                    if n != nc { return Value::error("matrix_schur: matrix must be square"); }
                    // Schur decomposition via eigendecomposition:
                    // A = Q T Q^H, T is upper quasi-triangular
                    // For now, return eigenvalues on diagonal (simplified Schur form)
                    let (vals_re, _vals_im, _vecs) = crate::linalg::eigendecompose(*n, data);
                    let mut t = vec![0.0f64; n * n];
                    for i in 0..*n {
                        t[i * n + i] = vals_re[i];
                    }
                    Value::Matrix{rows:*n,cols:*n,data:t}
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_schur: expected square matrix input"),
            }
        }

        // Condition number: κ(A) = σ_max / σ_min
        "matrix_cond" | "matrix.cond" => {
            match inputs.get("matrix").or_else(||inputs.get("m")) {
                Some(Value::Matrix{rows:nr,cols:nc,data}) => {
                    Value::scalar(crate::linalg::condition_number(*nr, *nc, data))
                }
                Some(e@Value::Error{..}) => e.clone(),
                _ => Value::error("matrix_cond: expected matrix input"),
            }
        }

        // ── Rootfinding ──────────────────────────────────────────────

        // Newton-Raphson: find root of f(x)=0 given formula and initial guess
        "root_newton" | "root.newton" => {
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("root_newton: no formula provided");
            }
            let x0 = scalar_or_nan(inputs, "x0");
            if x0.is_nan() {
                return Value::error("root_newton: initial guess x0 is required");
            }
            let tol = data.get("tol").and_then(|v| v.as_f64()).unwrap_or(1e-12);
            let max_iter = data.get("maxIter").and_then(|v| v.as_u64()).unwrap_or(100) as usize;

            let cfg = crate::rootfinding::RootConfig { max_iter, tol };
            let f = |x: f64| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), x);
                crate::expr::eval_expr(formula, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::rootfinding::newton_raphson(&f, x0, &cfg);
            if result.converged {
                Value::scalar(result.root)
            } else {
                Value::error(format!(
                    "root_newton: did not converge after {} iterations (f(x) = {:.2e})",
                    result.iterations, result.function_value
                ))
            }
        }

        // Brent's method: find root of f(x)=0 in bracket [a, b]
        "root_brent" | "root.brent" => {
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("root_brent: no formula provided");
            }
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a.is_nan() || b.is_nan() {
                return Value::error("root_brent: bracket endpoints a and b are required");
            }
            let tol = data.get("tol").and_then(|v| v.as_f64()).unwrap_or(1e-12);
            let max_iter = data.get("maxIter").and_then(|v| v.as_u64()).unwrap_or(100) as usize;

            let cfg = crate::rootfinding::RootConfig { max_iter, tol };
            let f = |x: f64| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), x);
                crate::expr::eval_expr(formula, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::rootfinding::brent(&f, a, b, &cfg);
            if result.converged {
                Value::scalar(result.root)
            } else if result.root.is_nan() {
                Value::error("root_brent: root not bracketed — f(a) and f(b) must have opposite signs")
            } else {
                Value::error(format!(
                    "root_brent: did not converge after {} iterations (f(x) = {:.2e})",
                    result.iterations, result.function_value
                ))
            }
        }

        // Polynomial roots: find all real roots of a polynomial
        "root_polynomial" | "root.polynomial" => {
            match inputs.get("coeffs").or_else(|| inputs.get("in_0")) {
                Some(Value::Vector { value: coeffs }) => {
                    let roots = crate::rootfinding::polynomial_roots(coeffs);
                    Value::Vector { value: roots }
                }
                Some(e @ Value::Error { .. }) => e.clone(),
                _ => Value::error("root_polynomial: expected vector of polynomial coefficients [c0, c1, ..., cn]"),
            }
        }

        // ── Numerical Integration ─────────────────────────────────

        // Gauss-Kronrod adaptive integration of f(x) over [a, b]
        "integrate_gk" | "integrate.gk" => {
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("integrate_gk: no formula provided");
            }
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a.is_nan() || b.is_nan() {
                return Value::error("integrate_gk: integration bounds a and b are required");
            }
            let tol = data.get("tol").and_then(|v| v.as_f64()).unwrap_or(1e-10);
            let max_depth = data.get("maxDepth").and_then(|v| v.as_u64()).unwrap_or(15) as usize;

            let f = |x: f64| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), x);
                crate::expr::eval_expr(formula, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::integrate::gauss_kronrod(&f, a, b, tol, max_depth);
            Value::scalar(result.value)
        }

        // Clenshaw-Curtis integration of f(x) over [a, b]
        "integrate_cc" | "integrate.cc" => {
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("integrate_cc: no formula provided");
            }
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a.is_nan() || b.is_nan() {
                return Value::error("integrate_cc: integration bounds a and b are required");
            }
            let n = data.get("points").and_then(|v| v.as_u64()).unwrap_or(65) as usize;

            let f = |x: f64| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), x);
                crate::expr::eval_expr(formula, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::integrate::clenshaw_curtis(&f, a, b, n);
            Value::scalar(result.value)
        }

        // Monte Carlo integration of f(x) over [a, b]
        "integrate_mc" | "integrate.mc" => {
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("integrate_mc: no formula provided");
            }
            let a = scalar_or_nan(inputs, "a");
            let b = scalar_or_nan(inputs, "b");
            if a.is_nan() || b.is_nan() {
                return Value::error("integrate_mc: integration bounds a and b are required");
            }
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(10000) as usize;
            let seed = data.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);

            let f = |x: f64| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), x);
                crate::expr::eval_expr(formula, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::integrate::monte_carlo(&f, a, b, n, seed);
            Value::scalar(result.value)
        }

        // ── Curve Fitting ──────────────────────────────────────────
        // curve_fit_poly: polynomial least-squares fit of given degree.
        // Inputs: x (vector), y (vector). Data: degree (int, default 2).
        // Returns: Table{["param","value"]} with rows for each coefficient
        //   ("c0"..="cN") plus ("r_squared", R²) and ("n_data", n).
        "curve_fit_poly" | "curve_fit.poly" => {
            let x = match inputs.get("x") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("curve_fit_poly: x must be a vector"),
            };
            let y = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("curve_fit_poly: y must be a vector"),
            };
            if x.len() != y.len() || x.is_empty() {
                return Value::error("curve_fit_poly: x and y must be same non-empty length");
            }
            let degree = data.get("degree").and_then(|v| v.as_u64()).unwrap_or(2) as usize;
            match crate::ml::polyreg::fit(&x, &y, degree) {
                Err(e) => Value::error(&format!("curve_fit_poly: {e}")),
                Ok(model) => {
                    // Compute R²
                    let fitted: Vec<f64> = crate::ml::polyreg::predict(&model, &x, degree);
                    let ss_res: f64 = y.iter().zip(fitted.iter()).map(|(&yi, &fi)| (yi - fi).powi(2)).sum();
                    let y_mean = y.iter().copied().sum::<f64>() / y.len() as f64;
                    let ss_tot: f64 = y.iter().map(|&yi| (yi - y_mean).powi(2)).sum();
                    let r2 = if ss_tot > 1e-30 { 1.0 - ss_res / ss_tot } else { 1.0 };
                    // Build result table
                    let mut rows: Vec<Vec<f64>> = model
                        .coefficients
                        .iter()
                        .enumerate()
                        .map(|(i, &c)| vec![i as f64, c])
                        .collect();
                    rows.push(vec![model.coefficients.len() as f64, r2]); // r_squared row
                    rows.push(vec![model.coefficients.len() as f64 + 1.0, x.len() as f64]); // n_data row
                    Value::Table {
                        columns: vec!["coefficient_index".to_string(), "value".to_string()],
                        rows,
                    }
                }
            }
        }

        // curve_fit_lm: Levenberg-Marquardt fit of a user-defined model.
        // Inputs: x (vector), y (vector).
        // Data: formula (string with "x" and "p0".."pN"), params (JSON array of
        //   {name:string, initial:number}), maxIter (int, default 200),
        //   tol (float, default 1e-8).
        // Returns: Table{["param","value"]} with (name_i, val_i), ("r_squared",R²).
        "curve_fit_lm" | "curve_fit.lm" => {
            let x = match inputs.get("x") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("curve_fit_lm: x must be a vector"),
            };
            let y = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("curve_fit_lm: y must be a vector"),
            };
            if x.len() != y.len() || x.is_empty() {
                return Value::error("curve_fit_lm: x and y must be same non-empty length");
            }
            let formula = data.get("formula").and_then(|v| v.as_str()).unwrap_or("");
            if formula.is_empty() {
                return Value::error("curve_fit_lm: formula is required (e.g. \"a*exp(-b*x)+c\")");
            }
            // Parse parameter definitions: [{name, initial}]
            let param_defs = data.get("params").and_then(|v| v.as_array());
            let (param_names, initial_params): (Vec<String>, Vec<f64>) = if let Some(arr) = param_defs {
                arr.iter()
                    .filter_map(|p| {
                        let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("p").to_string();
                        let init = p.get("initial").and_then(|v| v.as_f64()).unwrap_or(1.0);
                        Some((name, init))
                    })
                    .unzip()
            } else {
                // Fallback: single parameter "a" with initial=1
                (vec!["a".to_string()], vec![1.0])
            };
            if initial_params.is_empty() {
                return Value::error("curve_fit_lm: at least one parameter required");
            }
            let max_iter = data.get("maxIter").and_then(|v| v.as_u64()).unwrap_or(200) as usize;
            let tol = data.get("tol").and_then(|v| v.as_f64()).unwrap_or(1e-8);
            let formula_str = formula.to_string();
            let names_clone = param_names.clone();
            let f_model = |xi: f64, p: &[f64]| -> f64 {
                let mut vars = std::collections::HashMap::new();
                vars.insert("x".to_string(), xi);
                for (i, name) in names_clone.iter().enumerate() {
                    vars.insert(name.clone(), *p.get(i).unwrap_or(&f64::NAN));
                    // Also insert p0, p1, ... aliases
                    vars.insert(format!("p{i}"), *p.get(i).unwrap_or(&f64::NAN));
                }
                crate::expr::eval_expr(&formula_str, &vars).unwrap_or(f64::NAN)
            };
            let result = crate::optim::curve_fit::levenberg_marquardt(
                &f_model,
                &x,
                &y,
                &initial_params,
                max_iter,
                tol,
            );
            let mut rows: Vec<Vec<f64>> = param_names
                .iter()
                .enumerate()
                .map(|(i, _)| vec![i as f64, result.params.get(i).copied().unwrap_or(f64::NAN)])
                .collect();
            rows.push(vec![param_names.len() as f64, result.r_squared]);
            rows.push(vec![param_names.len() as f64 + 1.0, result.iterations as f64]);
            Value::Table {
                columns: vec!["param_index".to_string(), "value".to_string()],
                rows,
            }
        }

        // ── Norms ─────────────────────────────────────────────────
        "norm_l1" | "norm.l1" => {
            match inputs.get("a") {
                Some(Value::Vector { value }) => Value::scalar(value.iter().map(|x| x.abs()).sum()),
                Some(Value::Matrix { data, .. }) => Value::scalar(data.iter().map(|x| x.abs()).sum()),
                Some(Value::Scalar { value }) => Value::scalar(value.abs()),
                _ => Value::scalar(f64::NAN),
            }
        }

        "norm_l2" | "norm.l2" => {
            match inputs.get("a") {
                Some(Value::Vector { value }) => Value::scalar(value.iter().map(|x| x * x).sum::<f64>().sqrt()),
                Some(Value::Matrix { data, .. }) => Value::scalar(data.iter().map(|x| x * x).sum::<f64>().sqrt()),
                Some(Value::Scalar { value }) => Value::scalar(value.abs()),
                _ => Value::scalar(f64::NAN),
            }
        }

        "norm_linf" | "norm.linf" => {
            match inputs.get("a") {
                Some(Value::Vector { value }) => Value::scalar(value.iter().map(|x| x.abs()).fold(f64::NEG_INFINITY, f64::max)),
                Some(Value::Matrix { data, .. }) => Value::scalar(data.iter().map(|x| x.abs()).fold(f64::NEG_INFINITY, f64::max)),
                Some(Value::Scalar { value }) => Value::scalar(value.abs()),
                _ => Value::scalar(f64::NAN),
            }
        }

        "norm_frobenius" | "norm.frobenius" => {
            match inputs.get("a") {
                Some(Value::Matrix { data, .. }) => Value::scalar(data.iter().map(|x| x * x).sum::<f64>().sqrt()),
                Some(Value::Vector { value }) => Value::scalar(value.iter().map(|x| x * x).sum::<f64>().sqrt()),
                Some(Value::Scalar { value }) => Value::scalar(value.abs()),
                _ => Value::scalar(f64::NAN),
            }
        }

        // ── Interpolation ─────────────────────────────────────────
        "interp_cubic_spline" | "interp.cubicSpline" => {
            let xs = match inputs.get("xs") {
                Some(Value::Vector { value }) => value.clone(),
                _ => vec![],
            };
            let ys = match inputs.get("ys") {
                Some(Value::Vector { value }) => value.clone(),
                _ => vec![],
            };
            if xs.len() < 2 || ys.len() < 2 || xs.len() != ys.len() {
                return Value::error("interp_cubic_spline: need matching xs and ys with at least 2 points");
            }
            let boundary = match data.get("boundary").and_then(|v| v.as_str()).unwrap_or("natural") {
                "clamped" => crate::interpolate::SplineBoundary::Clamped(0.0, 0.0),
                "notaknot" => crate::interpolate::SplineBoundary::NotAKnot,
                _ => crate::interpolate::SplineBoundary::Natural,
            };
            let spline = crate::interpolate::cubic_spline(&xs, &ys, boundary);
            if let Some(Value::Vector { value: qv }) = inputs.get("query") {
                let out: Vec<f64> = qv.iter().map(|&x| spline.eval(x)).collect();
                Value::Vector { value: out }
            } else {
                let q = scalar_or_nan(inputs, "query");
                if q.is_nan() {
                    return Value::error("interp_cubic_spline: query point required");
                }
                Value::scalar(spline.eval(q))
            }
        }

        "interp_akima" | "interp.akima" => {
            let xs = match inputs.get("xs") {
                Some(Value::Vector { value }) => value.clone(),
                _ => vec![],
            };
            let ys = match inputs.get("ys") {
                Some(Value::Vector { value }) => value.clone(),
                _ => vec![],
            };
            if xs.len() < 2 || ys.len() < 2 || xs.len() != ys.len() {
                return Value::error("interp_akima: need matching xs and ys with at least 2 points");
            }
            let spline = crate::interpolate::akima(&xs, &ys);
            if let Some(Value::Vector { value: qv }) = inputs.get("query") {
                let out: Vec<f64> = qv.iter().map(|&x| spline.eval(x)).collect();
                Value::Vector { value: out }
            } else {
                let q = scalar_or_nan(inputs, "query");
                if q.is_nan() {
                    return Value::error("interp_akima: query point required");
                }
                Value::scalar(spline.eval(q))
            }
        }

        "interp_bspline" | "interp.bspline" => {
            let ctrl = match inputs.get("ctrl") {
                Some(Value::Vector { value }) => value.clone(),
                _ => vec![],
            };
            if ctrl.len() < 2 {
                return Value::error("interp_bspline: need at least 2 control points");
            }
            let degree = data.get("degree").and_then(|v| v.as_u64()).unwrap_or(3) as usize;
            let knots = crate::interpolate::uniform_knots(ctrl.len(), degree);
            if let Some(Value::Vector { value: qv }) = inputs.get("query") {
                let out: Vec<f64> = qv.iter().map(|&t| crate::interpolate::bspline_eval(&ctrl, &knots, degree, t)).collect();
                Value::Vector { value: out }
            } else {
                let q = scalar_or_nan(inputs, "query");
                if q.is_nan() {
                    return Value::error("interp_bspline: query parameter t required");
                }
                Value::scalar(crate::interpolate::bspline_eval(&ctrl, &knots, degree, q))
            }
        }

        // ── Random Number Generation ──────────────────────────────
        "rng_uniform" | "rng.uniform" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let seed = data.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let lo_v = scalar_or_nan(inputs, "lo");
            let hi_v = scalar_or_nan(inputs, "hi");
            let lo = if lo_v.is_nan() { 0.0 } else { lo_v };
            let hi = if hi_v.is_nan() { 1.0 } else { hi_v };
            let mut rng = crate::rng::Xoshiro256::new(seed);
            let values: Vec<f64> = (0..n).map(|_| rng.next_range(lo, hi)).collect();
            Value::Vector { value: values }
        }

        "rng_lhs" | "rng.lhs" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let dims = data.get("dims").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
            let seed = data.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let pts = crate::rng::latin_hypercube(n, dims, seed);
            if dims == 1 {
                Value::Vector { value: pts.into_iter().map(|r| r[0]).collect() }
            } else {
                let columns: Vec<String> = (0..dims).map(|d| format!("d{d}")).collect();
                let rows: Vec<Vec<f64>> = pts;
                Value::Table { columns, rows }
            }
        }

        "rng_sobol" | "rng.sobol" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let dims = data.get("dims").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
            let pts = crate::rng::sobol_points(n, dims);
            if dims == 1 {
                Value::Vector { value: pts.into_iter().map(|r| r[0]).collect() }
            } else {
                let columns: Vec<String> = (0..dims).map(|d| format!("d{d}")).collect();
                let rows: Vec<Vec<f64>> = pts;
                Value::Table { columns, rows }
            }
        }

        "rng_halton" | "rng.halton" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let dims = data.get("dims").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
            let skip = data.get("skip").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            let pts = crate::rng::halton_points(n, dims, skip);
            if dims == 1 {
                Value::Vector { value: pts.into_iter().map(|r| r[0]).collect() }
            } else {
                let columns: Vec<String> = (0..dims).map(|d| format!("d{d}")).collect();
                let rows: Vec<Vec<f64>> = pts;
                Value::Table { columns, rows }
            }
        }

        "rng_normal" | "rng.normal" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let seed = data.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let mu_v = scalar_or_nan(inputs, "mu");
            let sigma_v = scalar_or_nan(inputs, "sigma");
            let mu = if mu_v.is_nan() { 0.0 } else { mu_v };
            let sigma = if sigma_v.is_nan() { 1.0 } else { sigma_v };
            let mut rng = crate::rng::Xoshiro256::new(seed);
            let values: Vec<f64> = (0..n).map(|_| mu + sigma * rng.next_gaussian()).collect();
            Value::Vector { value: values }
        }

        "rng_lognormal" | "rng.lognormal" => {
            let n = data.get("samples").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            let seed = data.get("seed").and_then(|v| v.as_u64()).unwrap_or(42);
            let mu_v = scalar_or_nan(inputs, "mu");
            let sigma_v = scalar_or_nan(inputs, "sigma");
            let mu = if mu_v.is_nan() { 0.0 } else { mu_v };
            let sigma = if sigma_v.is_nan() { 1.0 } else { sigma_v };
            let mut rng = crate::rng::Xoshiro256::new(seed);
            let values: Vec<f64> = (0..n).map(|_| (mu + sigma * rng.next_gaussian()).exp()).collect();
            Value::Vector { value: values }
        }

        // ── Optimization ──────────────────────────────────────────
        "optim.designVariable" => {
            // Source node: emit a table describing this design variable
            let min = data.get("min").and_then(|v| v.as_f64()).unwrap_or(-10.0);
            let max = data.get("max").and_then(|v| v.as_f64()).unwrap_or(10.0);
            let initial = data.get("value").and_then(|v| v.as_f64()).unwrap_or((min + max) / 2.0);
            let step = data.get("step").and_then(|v| v.as_f64()).unwrap_or(0.1);
            Value::Table {
                columns: vec!["min".into(), "max".into(), "initial".into(), "step".into()],
                rows: vec![vec![min, max, initial, step]],
            }
        }

        "optim.objectiveFunction" => {
            // Pass through the input value
            inputs.get("value").cloned().unwrap_or(Value::scalar(f64::NAN))
        }

        "optim.gradientDescent" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(500.0) as usize;
                    let lr = data.get("learningRate").and_then(|v| v.as_f64()).unwrap_or(0.01);
                    let momentum = data.get("momentum").and_then(|v| v.as_f64()).unwrap_or(0.9);
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-8);
                    let result = optim::gradient::gradient_descent(&f, &vars, max_iter, lr, momentum, tol);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.geneticAlgorithm" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let gens = data.get("maxGenerations").and_then(|v| v.as_f64()).unwrap_or(200.0) as usize;
                    let pop = data.get("populationSize").and_then(|v| v.as_f64()).unwrap_or(50.0) as usize;
                    let mut_rate = data.get("mutationRate").and_then(|v| v.as_f64()).unwrap_or(0.1);
                    let cross_rate = data.get("crossoverRate").and_then(|v| v.as_f64()).unwrap_or(0.8);
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-8);
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    let result = optim::genetic::genetic_algorithm(&f, &vars, gens, pop, mut_rate, cross_rate, tol, seed);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.nelderMead" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(1000.0) as usize;
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-8);
                    let result = optim::simplex::nelder_mead(&f, &vars, max_iter, tol, 1.0, 2.0, 0.5, 0.5);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.responseSurface" => {
            // Extract feature matrix from Table input
            let (x_data, feature_names): (Vec<Vec<f64>>, Vec<String>) = match inputs.get("x") {
                Some(Value::Table { columns, rows }) => {
                    let feat_cols: Vec<usize> = (0..columns.len()).collect();
                    let x: Vec<Vec<f64>> = rows.iter().map(|row| {
                        feat_cols.iter().map(|&c| *row.get(c).unwrap_or(&0.0)).collect()
                    }).collect();
                    (x, columns.clone())
                }
                Some(Value::Matrix { rows, cols, data }) => {
                    let x: Vec<Vec<f64>> = (0..*rows).map(|r| {
                        (0..*cols).map(|c| data[r * *cols + c]).collect()
                    }).collect();
                    let names: Vec<String> = (0..*cols).map(|i| format!("x{i}")).collect();
                    (x, names)
                }
                _ => return Value::error("optim.responseSurface: 'x' input required (Table of features)"),
            };
            let y_data: Vec<f64> = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                Some(Value::Table { rows, .. }) => rows.iter().flat_map(|r| r.iter().cloned()).collect(),
                _ => return Value::error("optim.responseSurface: 'y' input required (response vector)"),
            };
            let method = data.get("method").and_then(|v| v.as_str()).unwrap_or("quadratic").to_string();
            crate::optim::response_surface::fit_response_surface(&x_data, &y_data, &method, &feature_names)
        }

        "optim.lbfgsb" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(1000.0) as usize;
                    let m_memory = data.get("memory").and_then(|v| v.as_f64()).unwrap_or(10.0) as usize;
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-8);
                    let result = optim::lbfgsb::lbfgsb(&f, &vars, max_iter, m_memory, tol);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.cmaes" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_gen = data.get("maxGenerations").and_then(|v| v.as_f64()).unwrap_or(1000.0) as usize;
                    let sigma0 = data.get("sigma0").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-10);
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    let lambda = data.get("lambda").and_then(|v| v.as_f64()).unwrap_or(0.0) as usize;
                    let config = optim::cmaes::CmaesConfig { max_gen, sigma0, tol, seed, lambda };
                    let result = optim::cmaes::cmaes(&f, &vars, &config);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.trustRegion" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(1000.0) as usize;
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-6);
                    let result = optim::trust_region::trust_region_dogleg(&f, &vars, max_iter, tol);
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.sqp" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let max_outer = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(100.0) as usize;
                    let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-6);

                    // Parse optional constraint expressions
                    let eq_exprs: Vec<String> = data
                        .get("eq_constraints")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();
                    let ineq_exprs: Vec<String> = data
                        .get("ineq_constraints")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    let eq_fns: Vec<Box<dyn Fn(&[f64]) -> f64>> = eq_exprs
                        .iter()
                        .map(|expr| {
                            let e = expr.clone();
                            let bx: Box<dyn Fn(&[f64]) -> f64> = Box::new(move |x: &[f64]| {
                                let mut vars_map = std::collections::HashMap::new();
                                for (i, &v) in x.iter().enumerate() {
                                    vars_map.insert(format!("x{i}"), v);
                                }
                                crate::expr::eval_expr(&e, &vars_map).unwrap_or(f64::NAN)
                            });
                            bx
                        })
                        .collect();

                    let ineq_fns: Vec<Box<dyn Fn(&[f64]) -> f64>> = ineq_exprs
                        .iter()
                        .map(|expr| {
                            let e = expr.clone();
                            let bx: Box<dyn Fn(&[f64]) -> f64> = Box::new(move |x: &[f64]| {
                                let mut vars_map = std::collections::HashMap::new();
                                for (i, &v) in x.iter().enumerate() {
                                    vars_map.insert(format!("x{i}"), v);
                                }
                                crate::expr::eval_expr(&e, &vars_map).unwrap_or(f64::NAN)
                            });
                            bx
                        })
                        .collect();

                    let result = optim::sqp::augmented_lagrangian(
                        &f, &vars, eq_fns.as_slice(), ineq_fns.as_slice(), max_outer, tol,
                    );
                    optim::result_to_table(&result, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.uqPce" => {
            use crate::optim::uq;
            // Extract sample matrix x and response vector y
            let (samples_x, var_names): (Vec<Vec<f64>>, Vec<String>) = match inputs.get("x") {
                Some(Value::Table { columns, rows }) => {
                    let x = rows.clone();
                    (x, columns.clone())
                }
                Some(Value::Matrix { rows, cols, data }) => {
                    let x: Vec<Vec<f64>> = (0..*rows)
                        .map(|r| (0..*cols).map(|c| data[r * *cols + c]).collect())
                        .collect();
                    let names: Vec<String> = (0..*cols).map(|i| format!("x{i}")).collect();
                    (x, names)
                }
                _ => return Value::error("uqPce: 'x' input required (sample table)"),
            };
            let y_data: Vec<f64> = match inputs.get("y") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                Some(Value::Table { rows, .. }) => rows.iter().flat_map(|r| r.iter().cloned()).collect(),
                _ => return Value::error("uqPce: 'y' input required (response vector)"),
            };
            let degree = data.get("degree").and_then(|v| v.as_f64()).unwrap_or(2.0) as usize;
            let basis_str = data.get("basis").and_then(|v| v.as_str()).unwrap_or("legendre");
            let n_vars = samples_x.first().map(|r| r.len()).unwrap_or(0);
            let dists: Vec<uq::UqDist> = (0..n_vars)
                .map(|_| match basis_str {
                    "hermite" => uq::UqDist::Normal { mean: 0.0, std: 1.0 },
                    _ => uq::UqDist::Uniform { min: -1.0, max: 1.0 },
                })
                .collect();
            match uq::fit_pce(&samples_x, &y_data, &dists, degree) {
                Ok(result) => uq::pce_to_table(&result, &var_names),
                Err(e) => Value::error(e),
            }
        }

        "optim.form" => {
            use crate::optim::uq;
            let n_vars = data.get("n_vars").and_then(|v| v.as_f64()).unwrap_or(1.0) as usize;
            let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(100.0) as usize;
            let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-6);
            let beta0 = data.get("beta0").and_then(|v| v.as_f64()).unwrap_or(2.0);
            // Default limit state: linear g(u) = β₀ - u₀ (use expression if provided)
            let expr = data.get("expression").and_then(|v| v.as_str()).map(|s| s.to_string());
            let var_names: Vec<String> = (0..n_vars).map(|i| format!("u{i}")).collect();
            let (beta, p_failure, mpp) = if let Some(expr_str) = expr {
                let g = move |u: &[f64]| {
                    let mut vars_map = std::collections::HashMap::new();
                    for (i, &v) in u.iter().enumerate() {
                        vars_map.insert(format!("u{i}"), v);
                        vars_map.insert(format!("x{i}"), v);
                    }
                    crate::expr::eval_expr(&expr_str, &vars_map).unwrap_or(f64::NAN)
                };
                uq::form_hlrf(&g, n_vars, max_iter, tol)
            } else {
                let g = move |u: &[f64]| beta0 - u.iter().sum::<f64>();
                uq::form_hlrf(&g, n_vars, max_iter, tol)
            };
            uq::form_to_table(beta, p_failure, &mpp, &var_names)
        }

        "optim.robustDesign" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let noise_std_val = data.get("noiseStd").and_then(|v| v.as_f64()).unwrap_or(0.1);
                    let noise_std = vec![noise_std_val];
                    let n_mc = data.get("nMc").and_then(|v| v.as_f64()).unwrap_or(50.0) as usize;
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    let n_pareto = data.get("nPareto").and_then(|v| v.as_f64()).unwrap_or(10.0) as usize;
                    let k_max = data.get("kMax").and_then(|v| v.as_f64()).unwrap_or(5.0);
                    let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(200.0) as usize;
                    let config = optim::robust::RobustConfig {
                        noise_std,
                        n_mc: n_mc.max(5),
                        seed,
                        n_pareto: n_pareto.max(2),
                        k_min: 0.0,
                        k_max,
                        max_iter,
                        tol: 1e-5,
                    };
                    optim::robust::robust_pareto(&f, &vars, &config)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.topologyOpt" => {
            use crate::optim::topology;
            let nx = data.get("nx").and_then(|v| v.as_f64()).unwrap_or(40.0) as usize;
            let ny = data.get("ny").and_then(|v| v.as_f64()).unwrap_or(20.0) as usize;
            let vol_frac = data.get("volFrac").and_then(|v| v.as_f64()).unwrap_or(0.4);
            let r_min = data.get("rMin").and_then(|v| v.as_f64()).unwrap_or(1.5);
            let max_iter = data.get("maxIterations").and_then(|v| v.as_f64()).unwrap_or(100.0) as usize;
            let tol = data.get("tolerance").and_then(|v| v.as_f64()).unwrap_or(1e-3);
            let config = topology::TopoConfig { nx, ny, vol_frac, r_min, max_iter, tol };
            topology::simp_topology(&config)
        }

        "optim.convergencePlot" | "optim.resultsTable" => {
            // Pass through optimizer output (Table)
            inputs.get("data").cloned().unwrap_or(Value::scalar(f64::NAN))
        }

        "optim.parametricSweep" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let steps = data.get("manualValues")
                        .and_then(|v| v.get("steps"))
                        .and_then(|v| v.as_f64())
                        .or_else(|| data.get("steps").and_then(|v| v.as_f64()))
                        .unwrap_or(100.0) as usize;
                    optim::sweep::parametric_sweep(&f, &vars[0], steps)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.monteCarlo" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    let samples = data.get("manualValues")
                        .and_then(|v| v.get("samples"))
                        .and_then(|v| v.as_f64())
                        .or_else(|| data.get("samples").and_then(|v| v.as_f64()))
                        .unwrap_or(1000.0) as usize;
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    optim::montecarlo::monte_carlo(&f, &vars, samples, seed)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.sensitivity" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let f = optim::get_objective_fn(data);
                    optim::sensitivity::sensitivity_analysis(&f, &vars)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.doe" => {
            use crate::optim;
            match optim::parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let method = data.get("method").and_then(|v| v.as_str()).unwrap_or("factorial");
                    let levels = data.get("levels").and_then(|v| v.as_f64()).unwrap_or(3.0) as usize;
                    let samples = data.get("samples").and_then(|v| v.as_f64()).unwrap_or(50.0) as usize;
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    optim::doe::design_of_experiments(&vars, method, levels, samples, seed)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.paramEst" => {
            use crate::optim::param_est::{levenberg_marquardt, ParamEstConfig};
            // Extract observed data table
            let (t_data, y_data, n_obs) = match inputs.get("data") {
                Some(Value::Table { columns, rows }) => {
                    let t_idx = columns.iter().position(|c| c == "t").unwrap_or(0);
                    let t_data: Vec<f64> = rows.iter().map(|r| r.get(t_idx).copied().unwrap_or(0.0)).collect();
                    let y_cols: Vec<usize> = (0..columns.len()).filter(|&i| i != t_idx).collect();
                    let y_data: Vec<Vec<f64>> = rows.iter()
                        .map(|r| y_cols.iter().map(|&c| r.get(c).copied().unwrap_or(f64::NAN)).collect())
                        .collect();
                    let n = y_cols.len();
                    (t_data, y_data, n)
                }
                _ => {
                    return Value::error("optim.paramEst: 'data' input must be a Table with column 't'");
                }
            };
            // Initial state from y0 input or data
            let y0: Vec<f64> = match inputs.get("y0") {
                Some(Value::Vector { value: v }) => v.clone(),
                Some(Value::Scalar { value: s }) => vec![*s],
                _ => {
                    // Fall back: first row of data excluding t
                    if y_data.is_empty() { vec![0.0] } else { y_data[0].clone() }
                }
            };
            // equations from node data
            let diff_eqs_raw = data.get("equations").and_then(|v| v.as_str()).unwrap_or("dy/dt = -k*y");
            let diff_eqs: Vec<String> = diff_eqs_raw.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            // parameter names and initial values
            let param_names_raw = data.get("params").and_then(|v| v.as_str()).unwrap_or("k");
            let param_names: Vec<String> = param_names_raw.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let param_init_raw = data.get("param_init").and_then(|v| v.as_str()).unwrap_or("1.0");
            let param_init: Vec<f64> = param_init_raw.split(',').filter_map(|s| s.trim().parse().ok()).collect();
            let param_lower_raw = data.get("param_lower").and_then(|v| v.as_str()).unwrap_or("0.0");
            let param_lower: Vec<f64> = param_lower_raw.split(',').filter_map(|s| s.trim().parse().ok()).collect();
            let param_upper_raw = data.get("param_upper").and_then(|v| v.as_str()).unwrap_or("1e6");
            let param_upper: Vec<f64> = param_upper_raw.split(',').filter_map(|s| s.trim().parse().ok()).collect();
            let observed_states: Vec<usize> = (0..n_obs).collect();
            let max_iter = data.get("max_iter").and_then(|v| v.as_f64()).unwrap_or(200.0) as usize;
            let tol = data.get("tol").and_then(|v| v.as_f64()).unwrap_or(1e-8);
            let t_start = t_data.first().copied().unwrap_or(0.0);
            let t_end_val = t_data.last().copied().unwrap_or(1.0);
            let cfg = ParamEstConfig {
                diff_eqs,
                y0,
                param_names: param_names.clone(),
                param_init,
                param_lower,
                param_upper,
                t_data,
                y_data,
                observed_states,
                solver: crate::ode::OdeSolverConfig {
                    t_start,
                    t_end: t_end_val,
                    dt: data.get("dt").and_then(|v| v.as_f64()).unwrap_or(0.01),
                    tolerance: tol,
                    max_steps: 100_000,
                },
                max_iter,
                tol,
            };
            let result = levenberg_marquardt(&cfg);
            // Return table: param, value, std_error
            let mut rows = Vec::with_capacity(param_names.len() + 1);
            for (i, name) in param_names.iter().enumerate() {
                let _ = name;
                let val = result.params.get(i).copied().unwrap_or(f64::NAN);
                let std = result.param_std.get(i).copied().unwrap_or(f64::NAN);
                rows.push(vec![i as f64, val, std]);
            }
            rows.push(vec![param_names.len() as f64, result.residual_sum_sq, f64::NAN]);
            Value::Table {
                columns: vec!["param_idx".to_string(), "value".to_string(), "std_error".to_string()],
                rows,
            }
        }

        "optim.bayesian" => {
            use crate::optim::{parse_design_vars, result_to_table};
            use crate::optim::bayesian::{BayesOptConfig, bayesian_optimise};
            match parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let n_initial = data.get("n_initial").and_then(|v| v.as_f64()).unwrap_or(5.0) as usize;
                    let n_iterations = data.get("n_iterations").and_then(|v| v.as_f64()).unwrap_or(20.0) as usize;
                    let acquisition = data.get("acquisition").and_then(|v| v.as_str()).unwrap_or("ei").to_string();
                    let kappa = data.get("kappa").and_then(|v| v.as_f64()).unwrap_or(2.576);
                    let xi = data.get("xi").and_then(|v| v.as_f64()).unwrap_or(0.01);
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    let vars_clone = vars.clone();
                    let obj = crate::optim::get_objective_fn(data);
                    let cfg = BayesOptConfig {
                        vars,
                        objective: obj,
                        n_initial,
                        n_iterations,
                        acquisition,
                        kappa,
                        xi,
                        seed,
                    };
                    let result = bayesian_optimise(&cfg);
                    result_to_table(&result, &vars_clone)
                }
                Err(e) => Value::error(e),
            }
        }

        "optim.nsga3" => {
            use crate::optim::parse_design_vars;
            use crate::optim::nsga3::{Nsga3Config, nsga3, mo_result_to_table};
            match parse_design_vars(inputs, data) {
                Ok(vars) => {
                    let n_vars = vars.len();
                    let pop_size = data.get("pop_size").and_then(|v| v.as_f64()).unwrap_or(60.0) as usize;
                    let n_generations = data.get("n_generations").and_then(|v| v.as_f64()).unwrap_or(100.0) as usize;
                    let divisions = data.get("divisions").and_then(|v| v.as_f64()).unwrap_or(4.0) as usize;
                    let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
                    let mutation_prob = data.get("mutation_prob").and_then(|v| v.as_f64()).unwrap_or(1.0 / n_vars as f64);

                    // Parse objective expressions from data.objectives (semicolon-separated)
                    let obj_raw = data.get("objectives").and_then(|v| v.as_str()).unwrap_or("x0^2;(x0-1)^2");
                    let obj_exprs: Vec<String> = obj_raw.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                    let n_obj = obj_exprs.len();
                    let objectives: Vec<Box<dyn Fn(&[f64]) -> f64>> = obj_exprs.iter().map(|expr| {
                        let expr = expr.clone();
                        let b: Box<dyn Fn(&[f64]) -> f64> = Box::new(move |x: &[f64]| {
                            let mut vars_map = std::collections::HashMap::new();
                            for (i, &xi) in x.iter().enumerate() {
                                vars_map.insert(format!("x{i}"), xi);
                                if i == 0 { vars_map.insert("x".to_string(), xi); }
                            }
                            crate::expr::eval_expr(&expr, &vars_map).unwrap_or(f64::NAN)
                        });
                        b
                    }).collect();

                    let cfg = Nsga3Config {
                        vars,
                        objectives,
                        pop_size,
                        n_generations,
                        crossover_prob: data.get("crossover_prob").and_then(|v| v.as_f64()).unwrap_or(0.9),
                        mutation_prob,
                        eta_c: data.get("eta_c").and_then(|v| v.as_f64()).unwrap_or(20.0),
                        eta_m: data.get("eta_m").and_then(|v| v.as_f64()).unwrap_or(20.0),
                        divisions,
                        seed,
                        use_moead: false,
                    };
                    let result = nsga3(&cfg);
                    mo_result_to_table(&result, n_vars, n_obj)
                }
                Err(e) => Value::error(e),
            }
        }

        // ── Machine Learning ─────────────────────────────────────────
        "ml.trainTestSplit" => {
            match inputs.get("data") {
                Some(Value::Table { columns, rows }) => {
                    let ratio = data.get("ratio").and_then(|v| v.as_f64()).unwrap_or(0.8);
                    let split_idx = (rows.len() as f64 * ratio).round() as usize;
                    let split_idx = split_idx.clamp(1, rows.len().saturating_sub(1));
                    let train_rows = rows[..split_idx].to_vec();
                    let test_rows = rows[split_idx..].to_vec();
                    // Return combined table with a "split" column (0=train, 1=test)
                    let mut out_cols = columns.clone();
                    out_cols.push("_split".into());
                    let mut out_rows = Vec::with_capacity(rows.len());
                    for row in &train_rows {
                        let mut r = row.clone();
                        r.push(0.0);
                        out_rows.push(r);
                    }
                    for row in &test_rows {
                        let mut r = row.clone();
                        r.push(1.0);
                        out_rows.push(r);
                    }
                    Value::Table { columns: out_cols, rows: out_rows }
                }
                Some(Value::Error { .. }) => inputs["data"].clone(),
                _ => Value::error("trainTestSplit: expected table input"),
            }
        }

        "ml.linearRegression" => {
            use crate::ml;
            match (inputs.get("trainX"), inputs.get("trainY")) {
                (Some(Value::Table { rows: x_rows, .. }), Some(Value::Vector { value: y })) => {
                    match ml::linreg::fit(x_rows, y) {
                        Ok(model) => ml::linreg::model_to_value(&model),
                        Err(e) => Value::error(e),
                    }
                }
                (Some(Value::Vector { value: x }), Some(Value::Vector { value: y })) => {
                    let x_rows: Vec<Vec<f64>> = x.iter().map(|&v| vec![v]).collect();
                    match ml::linreg::fit(&x_rows, y) {
                        Ok(model) => ml::linreg::model_to_value(&model),
                        Err(e) => Value::error(e),
                    }
                }
                _ => Value::error("linearRegression: expected trainX (table/vector) and trainY (vector)"),
            }
        }

        "ml.polynomialRegression" => {
            use crate::ml;
            match (inputs.get("trainX"), inputs.get("trainY")) {
                (Some(Value::Vector { value: x }), Some(Value::Vector { value: y })) => {
                    let degree = data.get("degree").and_then(|v| v.as_f64()).unwrap_or(2.0) as usize;
                    match ml::polyreg::fit(x, y, degree) {
                        Ok(model) => ml::linreg::model_to_value(&model),
                        Err(e) => Value::error(e),
                    }
                }
                _ => Value::error("polynomialRegression: expected trainX and trainY as vectors"),
            }
        }

        "ml.knnClassifier" => {
            use crate::ml;
            match (inputs.get("trainX"), inputs.get("trainY")) {
                (Some(Value::Table { rows: x_rows, .. }), Some(Value::Vector { value: y })) => {
                    let k = data.get("k").and_then(|v| v.as_f64()).unwrap_or(3.0) as usize;
                    match ml::knn::fit(x_rows.clone(), y.clone(), k) {
                        Ok(model) => {
                            // Return predictions on training data as verification
                            let preds = ml::knn::predict(&model, x_rows);
                            Value::Vector { value: preds }
                        }
                        Err(e) => Value::error(e),
                    }
                }
                _ => Value::error("knnClassifier: expected trainX (table) and trainY (vector)"),
            }
        }

        "ml.decisionTree" => {
            use crate::ml;
            match (inputs.get("trainX"), inputs.get("trainY")) {
                (Some(Value::Table { rows: x_rows, .. }), Some(Value::Vector { value: y })) => {
                    let max_depth = data.get("maxDepth").and_then(|v| v.as_f64()).unwrap_or(5.0) as usize;
                    match ml::decision_tree::fit(x_rows, y, max_depth) {
                        Ok(model) => {
                            let preds = ml::decision_tree::predict(&model, x_rows);
                            Value::Vector { value: preds }
                        }
                        Err(e) => Value::error(e),
                    }
                }
                _ => Value::error("decisionTree: expected trainX (table) and trainY (vector)"),
            }
        }

        "ml.predict" => {
            // Generic predict: pass through model output + new data
            // In practice, model state is managed on the TS side
            inputs.get("model").cloned()
                .or_else(|| inputs.get("data").cloned())
                .unwrap_or(Value::error("predict: no model or data provided"))
        }

        "ml.mse" => {
            use crate::ml;
            match (inputs.get("actual"), inputs.get("predicted")) {
                (Some(Value::Vector { value: actual }), Some(Value::Vector { value: predicted })) => {
                    Value::scalar(ml::metrics::mse(actual, predicted))
                }
                _ => Value::error("mse: expected actual and predicted as vectors"),
            }
        }

        "ml.r2" => {
            use crate::ml;
            match (inputs.get("actual"), inputs.get("predicted")) {
                (Some(Value::Vector { value: actual }), Some(Value::Vector { value: predicted })) => {
                    Value::scalar(ml::metrics::r_squared(actual, predicted))
                }
                _ => Value::error("r2: expected actual and predicted as vectors"),
            }
        }

        "ml.confusionMatrix" => {
            use crate::ml;
            match (inputs.get("actual"), inputs.get("predicted")) {
                (Some(Value::Vector { value: actual }), Some(Value::Vector { value: predicted })) => {
                    ml::metrics::confusion_matrix(actual, predicted)
                }
                _ => Value::error("confusionMatrix: expected actual and predicted as vectors"),
            }
        }

        // ── Neural Network ───────────────────────────────────────────
        "nn.input" => {
            // Source node: emit shape info from node data
            let shape = data.get("shape").and_then(|v| v.as_f64()).unwrap_or(1.0) as usize;
            Value::scalar(shape as f64)
        }

        "nn.dense" | "nn.conv1d" | "nn.dropout" | "nn.activation" => {
            // Layer definition nodes: pass through with metadata
            let input = inputs.get("input").cloned().unwrap_or(Value::scalar(f64::NAN));
            input
        }

        "nn.sequential" => {
            // Build model summary from layer chain
            inputs.get("layers").cloned().unwrap_or(Value::scalar(0.0))
        }

        "nn.trainer" => {
            // Parse layer definitions from node data
            let layers_json = match data.get("layers") {
                Some(v) => v.clone(),
                None => return Value::error("nn.trainer: 'layers' configuration required in node data"),
            };
            let layer_defs: Vec<serde_json::Value> = match layers_json.as_array() {
                Some(arr) => arr.clone(),
                None => return Value::error("nn.trainer: 'layers' must be a JSON array"),
            };

            // Build Sequential model from layer definitions
            let mut model = crate::nn::model::Sequential::new();
            for (i, ld) in layer_defs.iter().enumerate() {
                let layer_type = ld.get("type").and_then(|v| v.as_str()).unwrap_or("dense");
                let units = ld.get("units").and_then(|v| v.as_u64()).unwrap_or(16) as usize;
                let act_str = ld.get("activation").and_then(|v| v.as_str()).unwrap_or("relu");
                let activation = crate::nn::activation::ActivationFn::from_str(act_str);
                let input_size = if i == 0 {
                    ld.get("inputSize").and_then(|v| v.as_u64())
                        .or_else(|| data.get("inputSize").and_then(|v| v.as_u64()))
                        .unwrap_or(2) as usize
                } else {
                    layer_defs[i - 1].get("units").and_then(|v| v.as_u64()).unwrap_or(16) as usize
                };
                match layer_type {
                    "dense" => {
                        if let Err(e) = model.add_dense(input_size, units, activation, (i * 7 + 42) as u64) {
                            return Value::error(format!("nn.trainer: layer {}: {}", i, e));
                        }
                    }
                    _ => return Value::error(format!("nn.trainer: unsupported layer type '{}'", layer_type)),
                }
            }

            // Parse training data
            let train_x = match inputs.get("trainX") {
                Some(Value::Table { rows, .. }) => rows.clone(),
                Some(Value::Vector { value }) => value.iter().map(|v| vec![*v]).collect(),
                _ => return Value::error("nn.trainer: 'trainX' input required (Table or Vector)"),
            };
            let train_y = match inputs.get("trainY") {
                Some(Value::Table { rows, .. }) => rows.clone(),
                Some(Value::Vector { value }) => value.iter().map(|v| vec![*v]).collect(),
                _ => return Value::error("nn.trainer: 'trainY' input required (Table or Vector)"),
            };

            // Parse training config — Phase 6.6: training always has a defined end
            let epochs = data.get("epochs").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
            if epochs == 0 {
                return Value::error("nn.trainer: epochs must be > 0 (training must have a defined end)");
            }
            let batch_size = data.get("batchSize").and_then(|v| v.as_u64()).unwrap_or(32) as usize;
            let learning_rate = scalar_or(data, "learningRate", 0.01);
            let loss_str = data.get("loss").and_then(|v| v.as_str()).unwrap_or("mse");

            let patience = data.get("patience").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            let validation_split = scalar_or(data, "validationSplit", 0.0);

            let config = crate::nn::train::TrainConfig {
                epochs,
                batch_size,
                learning_rate,
                loss: crate::nn::train::LossFn::from_str(loss_str),
                patience,
                validation_split,
            };

            // Train
            match crate::nn::train::train(&mut model, &train_x, &train_y, &config) {
                Ok(result) => {
                    // Export model to JSON (stored for nn.predict to use later)
                    let _exported = crate::nn::export::export_model(&model);
                    // Return as Table: loss_history
                    Value::Table {
                        columns: vec!["epoch".to_string(), "loss".to_string()],
                        rows: result.loss_history.iter().enumerate()
                            .map(|(i, l)| vec![(i + 1) as f64, *l])
                            .collect(),
                    }
                }
                Err(e) => Value::error(format!("nn.trainer: {}", e)),
            }
        }

        "nn.predict" => {
            // Try to get model from the model input (JSON text from trainer)
            let model_text = match inputs.get("model") {
                Some(Value::Text { value }) => Some(value.clone()),
                _ => None,
            };
            let input_data = match inputs.get("data") {
                Some(Value::Table { rows, .. }) => Some(rows.clone()),
                Some(Value::Vector { value }) => Some(value.iter().map(|v| vec![*v]).collect()),
                _ => None,
            };

            match (model_text, input_data) {
                (Some(_model_json), Some(_data)) => {
                    // Model import not yet implemented — for now return placeholder
                    Value::error("nn.predict: model import from JSON not yet implemented")
                }
                _ => Value::error("nn.predict: requires 'model' (Text) and 'data' (Table) inputs"),
            }
        }

        "nn.export" => {
            inputs.get("model").cloned().unwrap_or(Value::error("nn.export: no model connected"))
        }

        "nn.lstm" => {
            use crate::nn::recurrent;
            let sequence: Vec<Vec<f64>> = match inputs.get("sequence") {
                Some(Value::Table { rows, .. }) => rows.clone(),
                Some(Value::Matrix { rows, cols, data }) => {
                    (0..*rows).map(|r| (0..*cols).map(|c| data[r * *cols + c]).collect()).collect()
                }
                Some(Value::Vector { value }) => value.iter().map(|&v| vec![v]).collect(),
                _ => return Value::error("nn.lstm: 'sequence' input required (Table [T × D])"),
            };
            let hidden_size = data.get("hiddenSize").and_then(|v| v.as_f64()).unwrap_or(32.0) as usize;
            let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
            let return_seq = data.get("returnSequences").and_then(|v| v.as_bool()).unwrap_or(false);
            recurrent::lstm_forward(&sequence, hidden_size, seed, return_seq)
        }

        "nn.gru" => {
            use crate::nn::recurrent;
            let sequence: Vec<Vec<f64>> = match inputs.get("sequence") {
                Some(Value::Table { rows, .. }) => rows.clone(),
                Some(Value::Matrix { rows, cols, data }) => {
                    (0..*rows).map(|r| (0..*cols).map(|c| data[r * *cols + c]).collect()).collect()
                }
                Some(Value::Vector { value }) => value.iter().map(|&v| vec![v]).collect(),
                _ => return Value::error("nn.gru: 'sequence' input required (Table [T × D])"),
            };
            let hidden_size = data.get("hiddenSize").and_then(|v| v.as_f64()).unwrap_or(32.0) as usize;
            let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
            let return_seq = data.get("returnSequences").and_then(|v| v.as_bool()).unwrap_or(false);
            recurrent::gru_forward(&sequence, hidden_size, seed, return_seq)
        }

        "nn.attention" => {
            use crate::nn::attention;
            let to_seq = |key: &str| -> Option<Vec<Vec<f64>>> {
                match inputs.get(key) {
                    Some(Value::Table { rows, .. }) => Some(rows.clone()),
                    Some(Value::Matrix { rows, cols, data }) => {
                        Some((0..*rows).map(|r| (0..*cols).map(|c| data[r * *cols + c]).collect()).collect())
                    }
                    _ => None,
                }
            };
            let q = match to_seq("query") {
                Some(s) => s,
                None => return Value::error("nn.attention: 'query' input required (Table)"),
            };
            let k = match to_seq("key").or_else(|| to_seq("query")) {
                Some(s) => s,
                None => return Value::error("nn.attention: 'key' input required (Table)"),
            };
            let v = match to_seq("value").or_else(|| to_seq("key")) {
                Some(s) => s,
                None => return Value::error("nn.attention: 'value' input required (Table)"),
            };
            let causal = data.get("causal").and_then(|v| v.as_bool()).unwrap_or(false);
            attention::attention_block(&q, &k, &v, causal)
        }

        "nn.conv2d" => {
            use crate::nn::layer::{Conv2DLayer};
            use crate::nn::activation::ActivationFn;

            // Input: flat image tensor [H × W × C] from a Matrix or Vector
            let (input, in_h, in_w, in_c): (Vec<f64>, usize, usize, usize) = match inputs.get("input") {
                Some(Value::Matrix { rows, cols, data }) => {
                    let h = *rows;
                    let w = *cols;
                    (data.clone(), h, w, 1)
                }
                Some(Value::Vector { value }) => {
                    let n = value.len();
                    let side = (n as f64).sqrt() as usize;
                    (value.clone(), side, side.max(1), 1)
                }
                Some(Value::Table { rows, .. }) => {
                    let h = rows.len();
                    let w = rows.first().map(|r| r.len()).unwrap_or(1);
                    let flat: Vec<f64> = rows.iter().flat_map(|r| r.iter().cloned()).collect();
                    (flat, h, w, 1)
                }
                _ => return Value::error("nn.conv2d: 'input' must be a Matrix, Vector, or Table"),
            };

            let n_filters = data.get("n_filters").and_then(|v| v.as_f64()).unwrap_or(4.0) as usize;
            let kernel_h = data.get("kernel_h").and_then(|v| v.as_f64()).unwrap_or(3.0) as usize;
            let kernel_w = data.get("kernel_w").and_then(|v| v.as_f64()).unwrap_or(3.0) as usize;
            let stride_h = data.get("stride_h").and_then(|v| v.as_f64()).unwrap_or(1.0) as usize;
            let stride_w = data.get("stride_w").and_then(|v| v.as_f64()).unwrap_or(1.0) as usize;
            let padding = data.get("padding").and_then(|v| v.as_str()).unwrap_or("valid") == "same";
            let act_str = data.get("activation").and_then(|v| v.as_str()).unwrap_or("relu");
            let activation = match act_str {
                "sigmoid" => ActivationFn::Sigmoid,
                "tanh" => ActivationFn::Tanh,
                "linear" | "none" => ActivationFn::Linear,
                _ => ActivationFn::ReLU,
            };
            let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
            let input_channels = in_c;

            let layer = Conv2DLayer::new(input_channels, n_filters, kernel_h, kernel_w, stride_h, stride_w, padding, activation, seed);
            let (output, out_h, out_w) = layer.forward(&input, in_h, in_w);

            if out_h == 0 || out_w == 0 {
                return Value::error("nn.conv2d: input too small for kernel size");
            }

            // Return as Matrix (n_filters feature maps flattened into rows)
            // Each row = one output pixel's channel vector
            Value::Matrix {
                rows: out_h * out_w,
                cols: n_filters,
                data: output,
            }
        }

        // ── Symbolic Math (CAS) ────────────────────────────────────────

        "sym.differentiate" => {
            use crate::symbolic;
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("sym.differentiate: 'expr' input required (Text)"),
            };
            let var_str = match inputs.get("var") {
                Some(Value::Text { value }) => value.clone(),
                _ => data.get("var").and_then(|v| if let serde_json::Value::String(s) = v { Some(s.clone()) } else { None }).unwrap_or_else(|| "x".to_string()),
            };
            match symbolic::parse_expr(&expr_str) {
                Ok(e) => {
                    let de = symbolic::simplify(&symbolic::differentiate(&e, &var_str));
                    Value::Text { value: symbolic::to_latex(&de) }
                }
                Err(err) => Value::error(format!("sym.differentiate parse error: {err}")),
            }
        }

        "sym.integrate" => {
            use crate::symbolic;
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("sym.integrate: 'expr' input required (Text)"),
            };
            let var_str = match inputs.get("var") {
                Some(Value::Text { value }) => value.clone(),
                _ => data.get("var").and_then(|v| if let serde_json::Value::String(s) = v { Some(s.clone()) } else { None }).unwrap_or_else(|| "x".to_string()),
            };
            match symbolic::parse_expr(&expr_str) {
                Ok(e) => {
                    match symbolic::integrate(&e, &var_str) {
                        symbolic::IntegrateResult::Ok(antideriv) => {
                            let simplified = symbolic::simplify(&antideriv);
                            Value::Text { value: symbolic::to_latex(&simplified) }
                        }
                        symbolic::IntegrateResult::NoElementary => {
                            Value::Text { value: "\\text{no elementary antiderivative}".to_string() }
                        }
                    }
                }
                Err(err) => Value::error(format!("sym.integrate parse error: {err}")),
            }
        }

        "sym.simplify" => {
            use crate::symbolic;
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("sym.simplify: 'expr' input required (Text)"),
            };
            match symbolic::parse_expr(&expr_str) {
                Ok(e) => {
                    let simplified = symbolic::simplify(&e);
                    Value::Text { value: symbolic::to_latex(&simplified) }
                }
                Err(err) => Value::error(format!("sym.simplify parse error: {err}")),
            }
        }

        "sym.expand" => {
            use crate::symbolic;
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("sym.expand: 'expr' input required (Text)"),
            };
            match symbolic::parse_expr(&expr_str) {
                Ok(e) => {
                    let expanded = symbolic::expand(&e);
                    Value::Text { value: symbolic::to_latex(&expanded) }
                }
                Err(err) => Value::error(format!("sym.expand parse error: {err}")),
            }
        }

        "sym.substitute" => {
            use crate::symbolic;
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("sym.substitute: 'expr' input required (Text)"),
            };
            let var_str = match inputs.get("var") {
                Some(Value::Text { value }) => value.clone(),
                _ => data.get("var").and_then(|v| if let serde_json::Value::String(s) = v { Some(s.clone()) } else { None }).unwrap_or_else(|| "x".to_string()),
            };
            let value_f = match inputs.get("value") {
                Some(Value::Scalar { value }) => *value,
                Some(Value::Text { value }) => value.parse::<f64>().unwrap_or(f64::NAN),
                _ => f64::NAN,
            };
            match symbolic::parse_expr(&expr_str) {
                Ok(e) => {
                    let replacement = symbolic::con(value_f);
                    let substituted = symbolic::substitute(&e, &var_str, &replacement);
                    let simplified = symbolic::simplify(&substituted);
                    Value::Text { value: symbolic::to_latex(&simplified) }
                }
                Err(err) => Value::error(format!("sym.substitute parse error: {err}")),
            }
        }

        // ── Compiled Expression Eval (1.29) ──────────────────────────
        "sym.compiledEval" => {
            // Pre-parse the expression once, then evaluate with port inputs as vars.
            // For a single invocation this is equivalent to eval_expr, but
            // the block signals intent: "this expression is evaluated in a loop".
            let expr_str = match inputs.get("expr") {
                Some(Value::Text { value }) => value.clone(),
                _ => data.get("expr").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };
            if expr_str.is_empty() {
                return Value::error("sym.compiledEval: 'expr' field or input required");
            }
            let compiled = match crate::expr::compile(&expr_str) {
                Ok(c) => c,
                Err(e) => return Value::error(format!("sym.compiledEval parse error: {e}")),
            };
            // Gather all numeric inputs as variables
            let mut vars = std::collections::HashMap::new();
            for (k, v) in inputs {
                if k == "expr" { continue; }
                if let Some(f) = v.as_scalar() {
                    vars.insert(k.clone(), f);
                }
            }
            // Also add data values as variables (useful for static parameters)
            for (k, v) in data {
                if let Some(f) = v.as_f64() {
                    vars.entry(k.clone()).or_insert(f);
                }
            }
            match compiled.eval(&vars) {
                Ok(v) => Value::scalar(v),
                Err(e) => Value::error(format!("sym.compiledEval eval error: {e}")),
            }
        }

        // ── Gröbner Bases (1.26) ─────────────────────────────────────
        "sym.groebner" => {
            use crate::symbolic::{MultiPoly, Monomial, MonomialOrder, groebner_basis, solve_polynomial_system};

            // Helper: parse a single polynomial term like "3*x^2*y" or "-x" or "2.5"
            fn parse_poly_term(term: &str, var_names: &[String]) -> Result<(f64, Monomial), String> {
                let term = term.trim();
                if term.is_empty() {
                    return Ok((0.0, Monomial { exponents: vec![0u32; var_names.len()] }));
                }
                let parts: Vec<&str> = term.split('*').collect();
                let mut coeff = 1.0f64;
                let mut exps = vec![0u32; var_names.len()];
                for part in &parts {
                    let part = part.trim();
                    if part.is_empty() { continue; }
                    if let Ok(n) = part.parse::<f64>() {
                        coeff *= n;
                    } else if let Some((vname, exp_str)) = part.split_once('^') {
                        let vname = vname.trim();
                        let exp: u32 = exp_str.trim().parse()
                            .map_err(|_| format!("Invalid exponent '{}' in term '{}'", exp_str, term))?;
                        let idx = var_names.iter().position(|v| v == vname)
                            .ok_or_else(|| format!("Unknown variable '{}' in term '{}'", vname, term))?;
                        exps[idx] += exp;
                    } else {
                        let vname = part;
                        let idx = var_names.iter().position(|v| v == vname)
                            .ok_or_else(|| format!("Unknown variable '{}' in term '{}'", vname, term))?;
                        exps[idx] += 1;
                    }
                }
                Ok((coeff, Monomial { exponents: exps }))
            }

            // Helper: parse a polynomial expression into a MultiPoly
            fn parse_poly_expr(s: &str, var_names: &[String], order: MonomialOrder) -> Result<MultiPoly, String> {
                // Handle "LHS = RHS" form: subtract RHS from LHS
                let s_owned;
                let s = if let Some((lhs, rhs)) = s.split_once('=') {
                    s_owned = format!("({})-({})=0", lhs, rhs);
                    let _ = s_owned.as_str(); // just to hold it
                    // Actually rewrite as "lhs - rhs"
                    let rhs_terms: Vec<&str> = rhs.split_terminator('+').collect();
                    let _ = rhs_terms;
                    // Simpler: treat s as "lhs - rhs" by replacing '= rhs' with nothing
                    // Parse lhs - rhs terms by prepending lhs + "- (" + rhs + ")"
                    format!("{}-({})_end", lhs.trim(), rhs.trim())
                } else {
                    s.to_string()
                };

                // Tokenize into signed terms by scanning for top-level + and -
                let s = s.trim_end_matches("_end");
                let mut terms_raw: Vec<String> = Vec::new();
                let mut current = String::new();
                let mut depth = 0usize; // bracket depth

                // Prepend implicit + if doesn't start with sign
                let leading_sign = if !s.is_empty() && (s.as_bytes()[0] == b'-') { "" } else { "+" };
                let full = format!("{}{}", leading_sign, s);
                let bytes = full.as_bytes();
                let len = bytes.len();
                let mut i = 0;
                while i < len {
                    let c = bytes[i] as char;
                    match c {
                        '(' => { depth += 1; current.push(c); }
                        ')' => {
                            if depth > 0 { depth -= 1; }
                            current.push(c);
                        }
                        '+' | '-' if depth == 0 && !current.is_empty() => {
                            let t = current.trim().to_string();
                            if !t.is_empty() && t != "+" && t != "-" {
                                terms_raw.push(t);
                            }
                            current = c.to_string();
                        }
                        _ => { current.push(c); }
                    }
                    i += 1;
                }
                if !current.trim().is_empty() {
                    terms_raw.push(current.trim().to_string());
                }

                // Parse each signed term
                let mut terms: Vec<(f64, Monomial)> = Vec::new();
                for tt in &terms_raw {
                    let tt = tt.trim();
                    if tt.is_empty() { continue; }
                    let (sign, rest) = if let Some(r) = tt.strip_prefix('-') {
                        (-1.0f64, r.trim())
                    } else if let Some(r) = tt.strip_prefix('+') {
                        (1.0f64, r.trim())
                    } else {
                        (1.0f64, tt)
                    };
                    // Handle parenthesised group: "(term1 + term2 ...)"
                    let rest = rest.trim_matches(|c| c == '(' || c == ')');
                    let (c, mono) = parse_poly_term(rest, var_names)?;
                    terms.push((sign * c, mono));
                }

                Ok(MultiPoly::new(var_names.to_vec(), terms, order))
            }

            // --- Main op logic ---
            let polynomials_text = match inputs.get("polynomials") {
                Some(Value::Text { value }) => value.clone(),
                _ => data.get("polynomials").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };
            if polynomials_text.is_empty() {
                return Value::error("sym.groebner: 'polynomials' input (Text, semicolon-separated) required");
            }
            let variables_text = data.get("variables").and_then(|v| v.as_str()).unwrap_or("x,y");
            let var_names: Vec<String> = variables_text.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if var_names.is_empty() {
                return Value::error("sym.groebner: 'variables' must list variable names (comma-separated)");
            }
            let order_str = data.get("order").and_then(|v| v.as_str()).unwrap_or("grevlex");
            let order = match order_str {
                "lex" => MonomialOrder::Lex,
                "grlex" => MonomialOrder::GrLex,
                _ => MonomialOrder::GrevLex,
            };
            let max_iter = data.get("max_iter").and_then(|v| v.as_f64()).unwrap_or(10000.0) as usize;
            let mode = data.get("mode").and_then(|v| v.as_str()).unwrap_or("basis");

            let poly_strs: Vec<&str> = polynomials_text.split(';').collect();
            let mut generators: Vec<MultiPoly> = Vec::new();
            for ps in &poly_strs {
                let ps = ps.trim();
                if ps.is_empty() { continue; }
                match parse_poly_expr(ps, &var_names, order) {
                    Ok(p) => generators.push(p),
                    Err(e) => return Value::error(format!("sym.groebner parse error in '{}': {}", ps, e)),
                }
            }

            if generators.is_empty() {
                return Value::error("sym.groebner: no valid polynomials parsed");
            }

            if mode == "solve" {
                match solve_polynomial_system(&generators, max_iter) {
                    Ok(solutions) => {
                        if solutions.is_empty() {
                            Value::Text { value: "No solutions found".to_string() }
                        } else {
                            let lines: Vec<String> = solutions.iter().enumerate().map(|(i, sol)| {
                                let parts: Vec<String> = var_names.iter().zip(sol.iter())
                                    .map(|(v, &x)| format!("{v} = {x:.6}"))
                                    .collect();
                                format!("Solution {}: {}", i + 1, parts.join(", "))
                            }).collect();
                            Value::Text { value: lines.join("\n") }
                        }
                    }
                    Err(e) => Value::Text { value: format!("Error: {e}") },
                }
            } else {
                // Return basis as text
                let result = groebner_basis(&generators, max_iter);
                let basis_strs: Vec<String> = result.basis.iter().map(|p| format!("{p}")).collect();
                let text = format!(
                    "Gröbner basis ({} polynomials, {} S-polys, {} zero reductions):\n{}",
                    basis_strs.len(),
                    result.s_poly_count,
                    result.zero_reductions,
                    basis_strs.join("\n")
                );
                Value::Text { value: text }
            }
        }

        // ── ODE Solvers (Phase 4) ──────────────────────────────────────

        "ode.rk4" | "ode.rk45" => {
            // Parse equations from Text input
            let equations_text = match inputs.get("equations") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("ODE solver: 'equations' input required (Text, semicolon-separated)"),
            };
            let equations: Vec<String> = equations_text.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if equations.is_empty() {
                return Value::error("ODE solver: no equations provided");
            }

            // Parse initial state from Vector input
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error("ODE solver: 'y0' input required (initial state vector)"),
            };
            if y0.len() != equations.len() {
                return Value::error(format!(
                    "ODE solver: {} equations but {} initial values",
                    equations.len(), y0.len()
                ));
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let tolerance = scalar_or(data, "tolerance", 1e-6);

            let state_names: Vec<String> = (0..equations.len()).map(|i| format!("y{}", i)).collect();

            // Collect parameters from data
            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(n) = v.as_f64() {
                        params.insert(k.clone(), n);
                    }
                }
            }

            let system = crate::ode::OdeSystem { equations, state_names: state_names.clone(), params };
            let config = crate::ode::OdeSolverConfig {
                t_start, t_end, dt, tolerance,
                max_steps: 100_000,
            };

            let result = if block_type == "ode.rk45" {
                crate::ode::rk45::solve_rk45(&system, &y0, &config)
            } else {
                crate::ode::rk4::solve_rk4(&system, &y0, &config)
            };

            // Convert to Table value
            let columns = result.column_names.clone();
            let rows: Vec<Vec<f64>> = result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                let mut row = vec![*t];
                row.extend_from_slice(ys);
                row
            }).collect();

            Value::Table { columns, rows }
        }

        "ode.event" => {
            // Parse equations from Text input
            let equations_text = match inputs.get("equations") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("ode.event: 'equations' input required (Text, semicolon-separated)"),
            };
            let equations: Vec<String> = equations_text.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if equations.is_empty() {
                return Value::error("ode.event: no equations provided");
            }

            // Parse initial state
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error("ode.event: 'y0' input required (initial state vector)"),
            };
            if y0.len() != equations.len() {
                return Value::error(format!(
                    "ode.event: {} equations but {} initial values",
                    equations.len(), y0.len()
                ));
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let event_expr = data.get("event_expr").and_then(|v| v.as_str()).unwrap_or("y0").to_string();
            let terminate = data.get("terminate").and_then(|v| v.as_bool()).unwrap_or(true);
            let event_tol = scalar_or(data, "event_tol", 1e-8);

            let state_names: Vec<String> = (0..equations.len()).map(|i| format!("y{i}")).collect();

            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(num) = v.as_f64() {
                        params.insert(k.clone(), num);
                    }
                }
            }

            let system = crate::ode::OdeSystem { equations, state_names, params };
            let config = crate::ode::OdeSolverConfig {
                t_start, t_end, dt, tolerance: 1e-6, max_steps: 100_000,
            };

            let result = crate::ode::event::solve_event_rk4(
                &system, &y0, &config, &event_expr, terminate, event_tol,
            );

            let columns = result.column_names.clone();
            let rows: Vec<Vec<f64>> = result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                let mut row = vec![*t];
                row.extend_from_slice(ys);
                row
            }).collect();

            Value::Table { columns, rows }
        }

        "ode.steady_state" => {
            // Parse equations from Text input
            let equations_text = match inputs.get("equations") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("ode.steady_state: 'equations' input required (Text, semicolon-separated)"),
            };
            let equations: Vec<String> = equations_text.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if equations.is_empty() {
                return Value::error("ode.steady_state: no equations provided");
            }

            // Parse initial guess from Vector input
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error("ode.steady_state: 'y0' input required (initial guess vector)"),
            };
            if y0.len() != equations.len() {
                return Value::error(format!(
                    "ode.steady_state: {} equations but {} initial values",
                    equations.len(), y0.len()
                ));
            }

            let t_eval = scalar_or(data, "t_eval", 0.0);
            let max_iter = data.get("max_iter").and_then(|v| v.as_f64()).unwrap_or(100.0) as usize;
            let tol = scalar_or(data, "tol", 1e-10);

            // Collect parameters
            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(num) = v.as_f64() {
                        params.insert(k.clone(), num);
                    }
                }
            }

            let state_names: Vec<String> = (0..equations.len()).map(|i| format!("y{i}")).collect();

            let result = crate::ode::steady_state::solve_steady_state(
                &equations, &y0, &params, &state_names, t_eval, max_iter, tol,
            );

            // Return Table: columns = ["state_index", "equilibrium"]
            // Plus metadata rows for residual and convergence
            let columns = vec!["state_index".to_string(), "equilibrium".to_string()];
            let mut rows: Vec<Vec<f64>> = result.y_eq.iter().enumerate().map(|(i, &v)| {
                vec![i as f64, v]
            }).collect();
            // Append metadata rows (index N = residual, N+1 = converged flag)
            let n_eq = equations.len() as f64;
            rows.push(vec![n_eq, result.residual]);
            rows.push(vec![n_eq + 1.0, if result.converged { 1.0 } else { 0.0 }]);

            Value::Table { columns, rows }
        }

        "ode.symplectic" => {
            // Parse acceleration expressions from Text input (semicolon-separated)
            let accel_text = match inputs.get("accelerations") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error("ode.symplectic: 'accelerations' input required (Text, semicolon-separated)"),
            };
            let accel_exprs: Vec<String> = accel_text.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let n = accel_exprs.len();
            if n == 0 {
                return Value::error("ode.symplectic: no acceleration expressions provided");
            }

            // Parse initial state [q0..qN-1, v0..vN-1] from Vector input
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error("ode.symplectic: 'y0' input required ([q0..qN, v0..vN])"),
            };
            if y0.len() != 2 * n {
                return Value::error(format!(
                    "ode.symplectic: {} acceleration expressions require {} initial values (got {})",
                    n, 2 * n, y0.len()
                ));
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);

            // Determine method from data
            let method_str = data.get("method").and_then(|v| v.as_str()).unwrap_or("verlet");
            let method = if method_str == "euler" {
                crate::ode::symplectic::SympMethod::SympEuler
            } else {
                crate::ode::symplectic::SympMethod::VelocityVerlet
            };

            // Collect parameters
            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(num) = v.as_f64() {
                        params.insert(k.clone(), num);
                    }
                }
            }

            let config = crate::ode::OdeSolverConfig {
                t_start, t_end, dt,
                tolerance: 1e-6,
                max_steps: 100_000,
            };

            let result = crate::ode::symplectic::solve_symplectic(
                &accel_exprs, &y0, &config, &params, &[], method,
            );

            let columns = result.column_names.clone();
            let rows: Vec<Vec<f64>> = result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                let mut row = vec![*t];
                row.extend_from_slice(ys);
                row
            }).collect();

            Value::Table { columns, rows }
        }

        "ode.bdf" | "ode.radau" => {
            let equations_text = match inputs.get("equations") {
                Some(Value::Text { value }) => value.clone(),
                _ => return Value::error(format!("{block_type}: 'equations' input required (Text, semicolon-separated)")),
            };
            let equations: Vec<String> = equations_text.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if equations.is_empty() {
                return Value::error(format!("{block_type}: no equations provided"));
            }
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error(format!("{block_type}: 'y0' input required")),
            };
            if y0.len() != equations.len() {
                return Value::error(format!("{block_type}: {} equations but {} initial values", equations.len(), y0.len()));
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let tolerance = scalar_or(data, "tolerance", 1e-6);
            let state_names: Vec<String> = (0..equations.len()).map(|i| format!("y{i}")).collect();

            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(n) = v.as_f64() { params.insert(k.clone(), n); }
                }
            }
            // Pass bdf_order from data into params
            if block_type == "ode.bdf" {
                let order = data.get("order").and_then(|v| v.as_f64()).unwrap_or(2.0);
                params.insert("bdf_order".to_string(), order);
            }

            let system = crate::ode::OdeSystem { equations, state_names, params };
            let cfg = crate::ode::OdeSolverConfig { t_start, t_end, dt, tolerance, max_steps: 100_000 };

            let result = if block_type == "ode.bdf" {
                crate::ode::bdf::solve_bdf(&system, &y0, &cfg)
            } else {
                crate::ode::radau::solve_radau(&system, &y0, &cfg)
            };

            let columns = result.column_names.clone();
            let rows: Vec<Vec<f64>> = result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                let mut row = vec![*t];
                row.extend_from_slice(ys);
                row
            }).collect();
            Value::Table { columns, rows }
        }

        // ── DAE Index Reduction: Pantelides Algorithm (2.36) ─────────
        "ode.daeIndexReduction" => {
            use crate::ode::dae::pantelides_index_reduction;

            let parse_text = |key: &str| -> Option<Vec<String>> {
                match inputs.get(key) {
                    Some(Value::Text { value }) => {
                        let v: Vec<String> = value.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                        if !v.is_empty() { Some(v) } else { None }
                    }
                    _ => None,
                }
            };
            let diff_eqs = match parse_text("diff_eqs").or_else(|| {
                data.get("diff_eqs").and_then(|v| v.as_str()).map(|s| {
                    s.split(';').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect()
                })
            }) {
                Some(v) => v,
                None => return Value::error("ode.daeIndexReduction: 'diff_eqs' required (semicolon-separated)"),
            };
            let alg_eqs = match parse_text("alg_eqs").or_else(|| {
                data.get("alg_eqs").and_then(|v| v.as_str()).map(|s| {
                    s.split(';').map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect()
                })
            }) {
                Some(v) => v,
                None => return Value::error("ode.daeIndexReduction: 'alg_eqs' required (semicolon-separated)"),
            };

            let nd = diff_eqs.len();
            let na = alg_eqs.len();
            let diff_names: Vec<String> = (0..nd).map(|i| format!("y{i}")).collect();
            let alg_names: Vec<String> = (0..na).map(|i| format!("z{i}")).collect();

            let result = pantelides_index_reduction(&diff_eqs, &alg_eqs, &diff_names, &alg_names);

            // Return table: [eq_idx, kind, diff_count, eq_str, assignment_var]
            let n_alg = result.diff_counts.len();
            let eq_idx: Vec<f64> = (0..n_alg).map(|i| i as f64).collect();
            let diff_count: Vec<f64> = result.diff_counts.iter().map(|&c| c as f64).collect();
            let structural_index_col: Vec<f64> = vec![result.structural_index as f64; n_alg];
            let n_diff_col: Vec<f64> = vec![result.n_differentiated as f64; n_alg];

            crate::types::build_table(
                &["alg_eq_idx", "diff_count", "structural_index", "n_differentiated"],
                &[eq_idx, diff_count, structural_index_col, n_diff_col],
            )
        }

        "ode.dae" => {
            use crate::ode::dae::{DaeConfig, solve_dae, dae_result_to_table};

            let parse_text = |key: &str| -> Option<Vec<String>> {
                if let Some(Value::Text { value }) = inputs.get(key) {
                    let v: Vec<String> = value.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                    if !v.is_empty() { Some(v) } else { None }
                } else { None }
            };
            let diff_eqs = match parse_text("diff_eqs") {
                Some(v) => v,
                None => return Value::error("ode.dae: 'diff_eqs' input required (Text, semicolon-separated)"),
            };
            let alg_eqs = match parse_text("alg_eqs") {
                Some(v) => v,
                None => return Value::error("ode.dae: 'alg_eqs' input required (Text, semicolon-separated)"),
            };
            let y0 = match inputs.get("y0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => return Value::error("ode.dae: 'y0' input required (differential initial state)"),
            };
            let z0 = match inputs.get("z0") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                None | Some(_) => vec![0.0f64; alg_eqs.len()], // default to zeros
            };
            if y0.len() != diff_eqs.len() {
                return Value::error(format!("ode.dae: {} diff_eqs but {} y0 values", diff_eqs.len(), y0.len()));
            }
            if z0.len() != alg_eqs.len() {
                return Value::error(format!("ode.dae: {} alg_eqs but {} z0 values", alg_eqs.len(), z0.len()));
            }

            let nd = diff_eqs.len();
            let na = alg_eqs.len();
            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let tolerance = scalar_or(data, "tolerance", 1e-6);

            let diff_names: Vec<String> = (0..nd).map(|i| format!("y{i}")).collect();
            let alg_names: Vec<String> = (0..na).map(|j| format!("z{j}")).collect();

            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj { if let Some(n) = v.as_f64() { params.insert(k.clone(), n); } }
            }

            let dae_cfg = DaeConfig { diff_eqs, alg_eqs, diff_names, alg_names, params };
            let solver_cfg = crate::ode::OdeSolverConfig { t_start, t_end, dt, tolerance, max_steps: 100_000 };

            let result = solve_dae(&dae_cfg, &y0, &z0, &solver_cfg);
            dae_result_to_table(&result)
        }

        "ode.pde1d" => {
            use crate::ode::pde1d::{
                Pde1dConfig, BcType, parse_pde_type, parse_bc, solve_pde1d, pde1d_result_to_table,
            };

            let pde_type_str = data.get("pde_type").and_then(|v| v.as_str()).unwrap_or("heat");
            let pde_type = parse_pde_type(pde_type_str);

            let diffusivity = scalar_or(data, "diffusivity", 0.1);
            let velocity = scalar_or(data, "velocity", 0.0);
            let source = scalar_or(data, "source", 0.0);
            let x0 = scalar_or(data, "x0", 0.0);
            let x_end = scalar_or(data, "x_end", 1.0);
            let n_points = data.get("n_points").and_then(|v| v.as_f64()).unwrap_or(21.0) as usize;
            let n_snapshots = data.get("n_snapshots").and_then(|v| v.as_f64()).unwrap_or(10.0) as usize;

            let bc_left_str = data.get("bc_left").and_then(|v| v.as_str()).unwrap_or("dirichlet:0.0");
            let bc_right_str = data.get("bc_right").and_then(|v| v.as_str()).unwrap_or("dirichlet:0.0");
            let bc_left = parse_bc(bc_left_str);
            let bc_right = parse_bc(bc_right_str);

            // u0: initial condition from input vector or default (zeros)
            let u0: Vec<f64> = match inputs.get("u0") {
                Some(Value::Vector { value }) => {
                    let mut v = value.clone();
                    v.resize(n_points, *value.last().unwrap_or(&0.0));
                    v
                }
                Some(Value::Scalar { value }) => vec![*value; n_points],
                _ => vec![0.0f64; n_points],
            };

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.001);

            let solver = crate::ode::OdeSolverConfig {
                t_start, t_end, dt, tolerance: 1e-6, max_steps: 500_000,
            };

            let cfg = Pde1dConfig {
                pde_type,
                diffusivity,
                velocity,
                source,
                x0,
                x_end,
                n_points,
                bc_left,
                bc_right,
                u0,
                ut0: vec![0.0f64; n_points],
                solver,
                n_snapshots,
            };

            let result = solve_pde1d(&cfg);
            pde1d_result_to_table(&result)
        }

        // ── Vehicle Simulation (Phase 5) ──────────────────────────────

        "veh.tire.lateralForce" => {
            let slip = scalar_or_nan(inputs, "slip_angle");
            let fz = scalar_or_nan(inputs, "Fz");
            let b = scalar_or_nan(inputs, "B");
            let c = scalar_or_nan(inputs, "C");
            let d = scalar_or_nan(inputs, "D");
            let e = scalar_or_nan(inputs, "E");
            Value::scalar(crate::vehicle::tire::lateral_force(slip, fz, b, c, d, e))
        }

        "veh.tire.longForce" => {
            let slip = scalar_or_nan(inputs, "slip_ratio");
            let fz = scalar_or_nan(inputs, "Fz");
            let b = scalar_or_nan(inputs, "B");
            let c = scalar_or_nan(inputs, "C");
            let d = scalar_or_nan(inputs, "D");
            let e = scalar_or_nan(inputs, "E");
            Value::scalar(crate::vehicle::tire::longitudinal_force(slip, fz, b, c, d, e))
        }

        "veh.tire.sweep" => {
            let fz = scalar_or_nan(inputs, "Fz");
            let b = scalar_or_nan(inputs, "B");
            let c = scalar_or_nan(inputs, "C");
            let d = scalar_or_nan(inputs, "D");
            let e = scalar_or_nan(inputs, "E");
            let slip_min = scalar_or(data, "slipMin", -0.2);
            let slip_max = scalar_or(data, "slipMax", 0.2);
            let n_points = scalar_or(data, "points", 101.0) as usize;

            let (slips, forces) = crate::vehicle::tire::force_sweep(fz, b, c, d, e, slip_min, slip_max, n_points);
            Value::Table {
                columns: vec!["slip".to_string(), "force".to_string()],
                rows: slips.into_iter().zip(forces).map(|(s, f)| vec![s, f]).collect(),
            }
        }

        // ── Vehicle Aero ──────────────────────────────────────────────

        "veh.aero.drag" => {
            let rho = scalar_or_nan(inputs, "rho");
            let cd = scalar_or_nan(inputs, "Cd");
            let area = scalar_or_nan(inputs, "A");
            let v = scalar_or_nan(inputs, "v");
            Value::scalar(crate::vehicle::aero::drag_force(rho, cd, area, v))
        }

        "veh.aero.downforce" => {
            let rho = scalar_or_nan(inputs, "rho");
            let cl = scalar_or_nan(inputs, "Cl");
            let area = scalar_or_nan(inputs, "A");
            let v = scalar_or_nan(inputs, "v");
            Value::scalar(crate::vehicle::aero::downforce(rho, cl, area, v))
        }

        "veh.aero.balance" => {
            let f_front = scalar_or_nan(inputs, "f_front");
            let f_total = scalar_or_nan(inputs, "f_total");
            Value::scalar(crate::vehicle::aero::aero_balance(f_front, f_total))
        }

        // ── Vehicle Powertrain ───────────────────────────────────────

        "veh.powertrain.gearRatio" => {
            let torque = scalar_or_nan(inputs, "torque");
            let rpm = scalar_or_nan(inputs, "rpm");
            let ratio = scalar_or_nan(inputs, "ratio");
            let (t_out, rpm_out) = crate::vehicle::powertrain::gear_ratio(torque, rpm, ratio);
            Value::Vector { value: vec![t_out, rpm_out] }
        }

        "veh.powertrain.wheelSpeed" => {
            let rpm = scalar_or_nan(inputs, "rpm");
            let radius = scalar_or_nan(inputs, "radius");
            let ratio = scalar_or_nan(inputs, "ratio");
            Value::scalar(crate::vehicle::powertrain::wheel_speed(rpm, radius, ratio))
        }

        "veh.powertrain.drivetrainLoss" => {
            let power = scalar_or_nan(inputs, "power");
            let efficiency = scalar_or_nan(inputs, "efficiency");
            Value::scalar(crate::vehicle::powertrain::drivetrain_loss(power, efficiency))
        }

        // ── Vehicle Brake Thermal ────────────────────────────────────

        "veh.brake.energy" => {
            let mass = scalar_or_nan(inputs, "mass");
            let v1 = scalar_or_nan(inputs, "v1");
            let v2 = scalar_or_nan(inputs, "v2");
            Value::scalar(crate::vehicle::thermal::brake_energy(mass, v1, v2))
        }

        "veh.brake.power" => {
            let energy = scalar_or_nan(inputs, "energy");
            let dt = scalar_or_nan(inputs, "dt");
            Value::scalar(crate::vehicle::thermal::brake_power(energy, dt))
        }

        // ── Vehicle Suspension ─────────────────────────────────────────

        "veh.suspension.quarterCar" => {
            let m_s = scalar_or(data, "m_s", 250.0);
            let m_u = scalar_or(data, "m_u", 35.0);
            let k_s = scalar_or(data, "k_s", 16000.0);
            let c_s = scalar_or(data, "c_s", 1000.0);
            let k_t = scalar_or(data, "k_t", 160000.0);
            let road_step = scalar_or_nan(inputs, "road_step");
            let t_end = scalar_or(data, "t_end", 2.0);
            let dt = scalar_or(data, "dt", 0.005);

            let params = crate::vehicle::suspension::QuarterCarParams { m_s, m_u, k_s, c_s, k_t };
            let result = crate::vehicle::suspension::quarter_car_step_response(&params, road_step, t_end, dt);

            Value::Table {
                columns: result.column_names,
                rows: result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                    let mut row = vec![*t];
                    row.extend_from_slice(ys);
                    row
                }).collect(),
            }
        }

        // ── Vehicle Half-Car (4-DOF) (item 2.78) ──────────────────────

        "veh.suspension.halfCar" => {
            use crate::vehicle::suspension::{HalfCarParams, half_car_step_response};
            let p = HalfCarParams {
                m_s: scalar_or(data, "m_s", 800.0),
                i_y: scalar_or(data, "i_y", 1200.0),
                m_uf: scalar_or(data, "m_uf", 35.0),
                m_ur: scalar_or(data, "m_ur", 40.0),
                k_sf: scalar_or(data, "k_sf", 18000.0),
                c_sf: scalar_or(data, "c_sf", 1200.0),
                k_sr: scalar_or(data, "k_sr", 20000.0),
                c_sr: scalar_or(data, "c_sr", 1400.0),
                k_tf: scalar_or(data, "k_tf", 160000.0),
                k_tr: scalar_or(data, "k_tr", 160000.0),
                a:    scalar_or(data, "a", 1.35),
                b:    scalar_or(data, "b", 1.45),
            };
            let road_front = scalar_or_nan(inputs, "road_front");
            let road_rear  = scalar_or_nan(inputs, "road_rear");
            let t_end = scalar_or(data, "t_end", 3.0);
            let dt    = scalar_or(data, "dt", 0.005);
            let result = half_car_step_response(&p, road_front, road_rear, t_end, dt);
            Value::Table {
                columns: result.column_names[1..].to_vec(), // skip duplicate t col
                rows: result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                    let mut row = vec![*t]; row.extend_from_slice(ys); row
                }).collect(),
            }
        }

        // ── Vehicle Full-Car (7-DOF) (item 2.78) ──────────────────────

        "veh.suspension.fullCar" => {
            use crate::vehicle::suspension::{FullVehicleParams, full_vehicle_response};
            let p = FullVehicleParams {
                m_s:     scalar_or(data, "m_s", 1200.0),
                i_pitch: scalar_or(data, "i_pitch", 1800.0),
                i_roll:  scalar_or(data, "i_roll", 500.0),
                m_wfl:   scalar_or(data, "m_wfl", 35.0),
                m_wfr:   scalar_or(data, "m_wfr", 35.0),
                m_wrl:   scalar_or(data, "m_wrl", 40.0),
                m_wrr:   scalar_or(data, "m_wrr", 40.0),
                k_fl: scalar_or(data, "k_fl", 18000.0), c_fl: scalar_or(data, "c_fl", 1200.0),
                k_fr: scalar_or(data, "k_fr", 18000.0), c_fr: scalar_or(data, "c_fr", 1200.0),
                k_rl: scalar_or(data, "k_rl", 20000.0), c_rl: scalar_or(data, "c_rl", 1400.0),
                k_rr: scalar_or(data, "k_rr", 20000.0), c_rr: scalar_or(data, "c_rr", 1400.0),
                k_tf: scalar_or(data, "k_tf", 160000.0),
                k_tr: scalar_or(data, "k_tr", 160000.0),
                k_arb_f: scalar_or(data, "k_arb_f", 5000.0),
                k_arb_r: scalar_or(data, "k_arb_r", 3000.0),
                a: scalar_or(data, "a", 1.35),
                b: scalar_or(data, "b", 1.45),
                tw_f: scalar_or(data, "tw_f", 0.75),
                tw_r: scalar_or(data, "tw_r", 0.75),
            };
            let road_fl = scalar_or_nan(inputs, "road_fl");
            let road_fr = scalar_or_nan(inputs, "road_fr");
            let road_rl = scalar_or_nan(inputs, "road_rl");
            let road_rr = scalar_or_nan(inputs, "road_rr");
            let t_end = scalar_or(data, "t_end", 3.0);
            let dt    = scalar_or(data, "dt", 0.005);
            let result = full_vehicle_response(&p, [road_fl, road_fr, road_rl, road_rr], t_end, dt);
            Value::Table {
                columns: result.column_names,
                rows: result.t.iter().zip(result.states.iter()).map(|(t, ys)| {
                    let mut row = vec![*t]; row.extend_from_slice(ys); row
                }).collect(),
            }
        }

        // ── K&C Analysis (item 2.79) ───────────────────────────────────

        "veh.suspension.kc" => {
            use crate::vehicle::suspension::compute_kc;
            let a_upper = scalar_or(data, "a_upper", 0.35);
            let b_upper = scalar_or(data, "b_upper", 0.30);
            let a_lower = scalar_or(data, "a_lower", 0.18);
            let b_lower = scalar_or(data, "b_lower", 0.10);
            let track_half = scalar_or(data, "track_half", 0.75);
            let wheel_rate = scalar_or(data, "wheel_rate", 18000.0);
            let toe_link_angle = scalar_or(data, "toe_link_angle_deg", 3.0);
            let anti_angle = scalar_or(data, "anti_angle_deg", 8.0);
            let kc = compute_kc(a_upper, b_upper, a_lower, b_lower, track_half, wheel_rate, toe_link_angle, anti_angle);
            crate::types::build_table(
                &["bump_steer_grad_rad_m", "bump_camber_grad_rad_m", "roll_centre_height_m", "lateral_stiffness_N_m", "anti_pct"],
                &[
                    vec![kc.bump_steer_grad],
                    vec![kc.bump_camber_grad],
                    vec![kc.roll_centre_height],
                    vec![kc.lateral_stiffness],
                    vec![kc.anti_pct],
                ],
            )
        }

        // ── Vehicle Event Blocks (item 2.81) ───────────────────────────

        "veh.event.stepSteer" => {
            use crate::vehicle::events::step_steer;
            let t_start = scalar_or(data, "t_start", 0.5);
            let ramp_time = scalar_or(data, "ramp_time", 0.1);
            let target_angle = scalar_or(data, "target_angle", 0.1);
            let t_end = scalar_or(data, "t_end", 5.0);
            let dt = scalar_or(data, "dt", 0.01);
            let throttle = scalar_or(data, "throttle", 0.5);
            step_steer(t_start, ramp_time, target_angle, t_end, dt, throttle)
        }

        "veh.event.sineSweep" => {
            use crate::vehicle::events::sine_steer_sweep;
            let amplitude = scalar_or(data, "amplitude", 0.05);
            let f_start = scalar_or(data, "f_start", 0.1);
            let f_end = scalar_or(data, "f_end", 5.0);
            let t_end = scalar_or(data, "t_end", 20.0);
            let dt = scalar_or(data, "dt", 0.01);
            let throttle = scalar_or(data, "throttle", 0.5);
            sine_steer_sweep(amplitude, f_start, f_end, t_end, dt, throttle)
        }

        "veh.event.laneChange" => {
            use crate::vehicle::events::iso_lane_change;
            let v_kmh = scalar_or(data, "v_kmh", 80.0);
            let amplitude = scalar_or(data, "amplitude", 0.15);
            let dt = scalar_or(data, "dt", 0.01);
            iso_lane_change(v_kmh, amplitude, dt)
        }

        "veh.event.brakeInTurn" => {
            use crate::vehicle::events::brake_in_turn;
            let steer_angle = scalar_or(data, "steer_angle", 0.1);
            let brake_ramp_time = scalar_or(data, "brake_ramp_time", 0.3);
            let t_brake_start = scalar_or(data, "t_brake_start", 1.0);
            let t_end = scalar_or(data, "t_end", 4.0);
            let dt = scalar_or(data, "dt", 0.01);
            let throttle_before = scalar_or(data, "throttle_before", 0.5);
            brake_in_turn(steer_angle, brake_ramp_time, t_brake_start, t_end, dt, throttle_before)
        }

        "veh.event.constantRadius" => {
            use crate::vehicle::events::constant_radius;
            let steer_angle = scalar_or(data, "steer_angle", 0.1);
            let throttle = scalar_or(data, "throttle", 0.3);
            let t_end = scalar_or(data, "t_end", 10.0);
            let dt = scalar_or(data, "dt", 0.01);
            constant_radius(steer_angle, throttle, t_end, dt)
        }

        // ── Vehicle Lap Simulation ─────────────────────────────────────

        "veh.lap.simulate" => {
            // Track input: Table with columns [distance, curvature]
            let track = match inputs.get("track") {
                Some(Value::Table { rows, .. }) => {
                    rows.iter()
                        .map(|r| (r.get(0).copied().unwrap_or(0.0), r.get(1).copied().unwrap_or(0.0)))
                        .collect::<Vec<(f64, f64)>>()
                }
                _ => return Value::error("veh.lap.simulate: 'track' input required (Table: distance, curvature)"),
            };

            let vehicle = crate::vehicle::lap::LapVehicle {
                mass: scalar_or(data, "mass", 1500.0),
                power: scalar_or(data, "power", 200000.0),
                cd: scalar_or(data, "cd", 0.35),
                cl: scalar_or(data, "cl", 0.1),
                frontal_area: scalar_or(data, "frontalArea", 2.0),
                mu: scalar_or(data, "mu", 1.2),
                rho: scalar_or(data, "rho", 1.225),
            };

            let result = crate::vehicle::lap::simulate_lap(&track, &vehicle);

            // Return as Table: [distance, speed]
            Value::Table {
                columns: vec!["distance".to_string(), "speed".to_string()],
                rows: result.distance.iter().zip(result.speed.iter())
                    .map(|(d, s)| vec![*d, *s])
                    .collect(),
            }
        }

        // ── ML Feature Preprocessing ─────────────────────────────────

        "ml.featureScale" => {
            match inputs.get("data") {
                Some(Value::Table { columns, rows }) => {
                    let mode = data.get("mode").and_then(|v| v.as_str()).unwrap_or("standardize");
                    let (scaled, _params1, _params2) = if mode == "normalize" {
                        crate::ml::preprocess::normalize(rows)
                    } else {
                        crate::ml::preprocess::standardize(rows)
                    };
                    Value::Table { columns: columns.clone(), rows: scaled }
                }
                _ => Value::error("ml.featureScale: 'data' input required (Table)"),
            }
        }

        // ── ML Classification Metrics ────────────────────────────────

        "ml.classMetrics" => {
            let actual = match inputs.get("actual") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.classMetrics: 'actual' input required (Vector)"),
            };
            let predicted = match inputs.get("predicted") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.classMetrics: 'predicted' input required (Vector)"),
            };
            let (p, r, f1) = crate::ml::classification_metrics::precision_recall_f1(&actual, &predicted);
            Value::Table {
                columns: vec!["metric".to_string(), "value".to_string()],
                rows: vec![
                    vec![0.0, p],  // precision
                    vec![1.0, r],  // recall
                    vec![2.0, f1], // f1
                ],
            }
        }

        "ml.rocCurve" => {
            let actual = match inputs.get("actual") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.rocCurve: 'actual' input required"),
            };
            let scores = match inputs.get("scores") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.rocCurve: 'scores' input required"),
            };
            let roc = crate::ml::classification_metrics::roc_curve(&actual, &scores);
            Value::Table {
                columns: vec!["fpr".to_string(), "tpr".to_string()],
                rows: roc.into_iter().map(|(fpr, tpr)| vec![fpr, tpr]).collect(),
            }
        }

        "ml.auc" => {
            let actual = match inputs.get("actual") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.auc: 'actual' input required"),
            };
            let scores = match inputs.get("scores") {
                Some(Value::Vector { value }) => value.clone(),
                _ => return Value::error("ml.auc: 'scores' input required"),
            };
            let roc = crate::ml::classification_metrics::roc_curve(&actual, &scores);
            Value::scalar(crate::ml::classification_metrics::auc(&roc))
        }

        // ── Hyperparameter Optimisation (2.100) ──────────────────────
        "optim.hyperopt" => {
            use crate::optim::{DesignVar, bayesian::{BayesOptConfig, bayesian_optimise}};
            // Parse hyperparameter definitions from data
            let names_raw = data.get("param_names").and_then(|v| v.as_str()).unwrap_or("learning_rate;n_layers");
            let mins_raw = data.get("param_mins").and_then(|v| v.as_str()).unwrap_or("0.0001;1");
            let maxs_raw = data.get("param_maxes").and_then(|v| v.as_str()).unwrap_or("0.1;5");
            let objective_expr = data.get("objective").and_then(|v| v.as_str()).unwrap_or("learning_rate^2").to_string();
            let n_trials = data.get("n_trials").and_then(|v| v.as_f64()).unwrap_or(30.0) as usize;
            let n_initial = data.get("n_initial").and_then(|v| v.as_f64()).unwrap_or(5.0) as usize;
            let seed = data.get("seed").and_then(|v| v.as_f64()).unwrap_or(42.0) as u64;
            let acquisition = data.get("acquisition").and_then(|v| v.as_str()).unwrap_or("ei").to_string();
            let kappa = data.get("kappa").and_then(|v| v.as_f64()).unwrap_or(2.0);
            let xi = data.get("xi").and_then(|v| v.as_f64()).unwrap_or(0.01);

            let names: Vec<String> = names_raw.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let mins: Vec<f64> = mins_raw.split(';').filter_map(|s| s.trim().parse().ok()).collect();
            let maxs: Vec<f64> = maxs_raw.split(';').filter_map(|s| s.trim().parse().ok()).collect();

            if names.is_empty() {
                return Value::error("optim.hyperopt: param_names must have ≥1 parameter");
            }
            let n_params = names.len();
            let vars: Vec<DesignVar> = (0..n_params).map(|i| DesignVar {
                name: names[i].clone(),
                min: mins.get(i).copied().unwrap_or(0.0),
                max: maxs.get(i).copied().unwrap_or(1.0),
                initial: (mins.get(i).copied().unwrap_or(0.0) + maxs.get(i).copied().unwrap_or(1.0)) / 2.0,
                step: 0.1,
            }).collect();

            let names_clone = names.clone();
            let objective: Box<dyn Fn(&[f64]) -> f64> = Box::new(move |x: &[f64]| {
                let mut vars_map = std::collections::HashMap::new();
                for (i, name) in names_clone.iter().enumerate() {
                    if let Some(&val) = x.get(i) {
                        vars_map.insert(name.clone(), val);
                    }
                }
                crate::expr::eval_expr(&objective_expr, &vars_map).unwrap_or(f64::NAN)
            });

            let cfg = BayesOptConfig {
                vars: vars.clone(),
                objective,
                n_initial: n_initial.min(n_trials),
                n_iterations: n_trials,
                acquisition,
                kappa,
                xi,
                seed,
            };
            let result = bayesian_optimise(&cfg);

            // Build trial history table: [trial, param0..paramN-1, score]
            let mut col_names: Vec<&str> = vec!["trial"];
            let name_refs: Vec<String> = names.clone();
            let n_hist = result.history.len();
            let trial_col: Vec<f64> = (0..n_hist).map(|i| (i + 1) as f64).collect();
            let score_col: Vec<f64> = result.history.clone();
            // For param columns, just report best found value repeated (history doesn't track x per step)
            let best_col: Vec<f64> = result.optimal_values.clone();

            // Build simple table: trial | best_so_far | param0 | param1 | ...
            let mut all_cols: Vec<Vec<f64>> = vec![trial_col, score_col];
            let mut all_names: Vec<String> = vec!["trial".to_string(), "best_score".to_string()];
            for (i, name) in name_refs.iter().enumerate() {
                let val = best_col.get(i).copied().unwrap_or(f64::NAN);
                all_cols.push(vec![val; n_hist]);
                all_names.push(name.clone());
            }
            let col_name_refs: Vec<&str> = all_names.iter().map(|s| s.as_str()).collect();
            let _ = col_names;
            crate::types::build_table(&col_name_refs, &all_cols)
        }

        // ── GP Surrogate (2.99) ───────────────────────────────────────
        "optim.surrogate" => {
            // train: Table — columns x0..xN-1, y (last column is target)
            // query: Table — columns x0..xN-1
            let train_table = match inputs.get("train") {
                Some(Value::Table { columns, rows }) => Some((columns.clone(), rows.clone())),
                _ => None,
            };
            let query_table = match inputs.get("query") {
                Some(Value::Table { columns, rows }) => Some((columns.clone(), rows.clone())),
                _ => None,
            };
            match (train_table, query_table) {
                (Some((_, train_rows)), Some((_, query_rows))) => {
                    if train_rows.is_empty() {
                        return Value::error("optim.surrogate: train table is empty");
                    }
                    let n_cols = train_rows[0].len();
                    if n_cols < 2 {
                        return Value::error("optim.surrogate: train table must have ≥2 columns (features + target)");
                    }
                    let length_scale = data.get("length_scale").and_then(|v| v.as_f64()).unwrap_or(1.0);
                    let sigma_f = data.get("sigma_f").and_then(|v| v.as_f64()).unwrap_or(1.0);
                    let sigma_n = data.get("sigma_n").and_then(|v| v.as_f64()).unwrap_or(1e-3);

                    let x_train: Vec<Vec<f64>> = train_rows.iter()
                        .map(|r| r[..n_cols - 1].to_vec())
                        .collect();
                    let y_train: Vec<f64> = train_rows.iter()
                        .map(|r| r[n_cols - 1])
                        .collect();

                    let x_test: Vec<Vec<f64>> = query_rows.iter()
                        .map(|r| r.clone())
                        .collect();

                    let preds = crate::optim::bayesian::gp_fit_predict(
                        x_train, y_train, &x_test, length_scale, sigma_f, sigma_n,
                    );

                    let mean_col: Vec<f64> = preds.iter().map(|(m, _)| *m).collect();
                    let std_col: Vec<f64> = preds.iter().map(|(_, s)| *s).collect();
                    crate::types::build_table(&["mean", "std"], &[mean_col, std_col])
                }
                _ => Value::error("optim.surrogate: connect 'train' Table and 'query' Table"),
            }
        }

        // ── AutoML (2.101) ───────────────────────────────────────────
        "optim.automl" => {
            let (columns, rows) = match inputs.get("data") {
                Some(Value::Table { columns, rows }) => (columns.clone(), rows.clone()),
                _ => return Value::error("optim.automl: 'data' Table input required"),
            };
            if rows.len() < 4 {
                return Value::error("optim.automl: need ≥4 rows");
            }
            let n_cols = columns.len();
            if n_cols < 2 {
                return Value::error("optim.automl: table must have ≥2 columns (features + target)");
            }
            // target_col: name or last column by default
            let target_col_name = data.get("target_col").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let target_idx = if target_col_name.is_empty() {
                n_cols - 1
            } else {
                columns.iter().position(|c| c == &target_col_name).unwrap_or(n_cols - 1)
            };

            let x_rows: Vec<Vec<f64>> = rows.iter().map(|r| {
                r.iter().enumerate().filter(|(i, _)| *i != target_idx).map(|(_, &v)| v).collect()
            }).collect();
            let y: Vec<f64> = rows.iter().map(|r| r[target_idx]).collect();

            let n = rows.len();
            let n_folds = data.get("cv_folds").and_then(|v| v.as_f64()).unwrap_or(5.0) as usize;
            let n_folds = n_folds.clamp(2, n.min(10));
            let fold_size = n / n_folds;

            // k-fold CV helper — returns RMSE
            let kfold_rmse = |predict_fn: &dyn Fn(&[Vec<f64>], &[f64], &[Vec<f64>]) -> Vec<f64>| -> f64 {
                let mut sq_err_sum = 0.0;
                let mut count = 0usize;
                for f in 0..n_folds {
                    let val_start = f * fold_size;
                    let val_end = (val_start + fold_size).min(n);
                    let train_x: Vec<Vec<f64>> = (0..n).filter(|&i| i < val_start || i >= val_end).map(|i| x_rows[i].clone()).collect();
                    let train_y: Vec<f64> = (0..n).filter(|&i| i < val_start || i >= val_end).map(|i| y[i]).collect();
                    let val_x: Vec<Vec<f64>> = x_rows[val_start..val_end].to_vec();
                    let val_y = &y[val_start..val_end];
                    if train_x.is_empty() || val_x.is_empty() { continue; }
                    let preds = predict_fn(&train_x, &train_y, &val_x);
                    for (p, &a) in preds.iter().zip(val_y.iter()) {
                        sq_err_sum += (p - a).powi(2);
                        count += 1;
                    }
                }
                if count == 0 { f64::NAN } else { (sq_err_sum / count as f64).sqrt() }
            };

            // Compute R² on full dataset
            let r2_score = |preds: &[f64]| -> f64 {
                let mean_y = y.iter().sum::<f64>() / y.len() as f64;
                let ss_res: f64 = y.iter().zip(preds).map(|(a, p)| (a - p).powi(2)).sum();
                let ss_tot: f64 = y.iter().map(|a| (a - mean_y).powi(2)).sum();
                if ss_tot < 1e-12 { return 0.0; }
                1.0 - ss_res / ss_tot
            };

            let mut result_rows: Vec<Vec<f64>> = Vec::new();
            let mut model_names: Vec<String> = Vec::new();

            // Model 1: Linear Regression
            let lin_rmse = kfold_rmse(&|tx, ty, vx| {
                match crate::ml::linreg::fit(tx, ty) {
                    Ok(m) => crate::ml::linreg::predict(&m, vx),
                    Err(_) => vx.iter().map(|_| f64::NAN).collect(),
                }
            });
            let lin_model = crate::ml::linreg::fit(&x_rows, &y);
            let lin_r2 = lin_model.as_ref().map(|m| r2_score(&crate::ml::linreg::predict(m, &x_rows))).unwrap_or(f64::NAN);
            model_names.push("linear".to_string());
            result_rows.push(vec![lin_rmse, lin_r2]);

            // Model 2: Polynomial Regression (degree 2, single feature only)
            let poly_rmse = if x_rows[0].len() == 1 {
                let xs: Vec<f64> = x_rows.iter().map(|r| r[0]).collect();
                kfold_rmse(&|tx, ty, vx| {
                    let tx_1d: Vec<f64> = tx.iter().map(|r| r[0]).collect();
                    let vx_1d: Vec<f64> = vx.iter().map(|r| r[0]).collect();
                    match crate::ml::polyreg::fit(&tx_1d, ty, 2) {
                        Ok(m) => {
                            let vx_rows: Vec<Vec<f64>> = vx_1d.iter().map(|&v| {
                                let mut row = vec![1.0, v, v * v];
                                row.truncate(m.coefficients.len());
                                row
                            }).collect();
                            crate::ml::linreg::predict(&m, &vx_rows)
                        }
                        Err(_) => vx.iter().map(|_| f64::NAN).collect(),
                    }
                });
                let xs_ref: &Vec<f64> = &xs;
                match crate::ml::polyreg::fit(xs_ref, &y, 2) {
                    Ok(m) => {
                        let x2_rows: Vec<Vec<f64>> = xs.iter().map(|&v| vec![1.0, v, v * v]).collect();
                        let preds = crate::ml::linreg::predict(&m, &x2_rows);
                        let rmse = (y.iter().zip(&preds).map(|(a, p)| (a - p).powi(2)).sum::<f64>() / y.len() as f64).sqrt();
                        rmse
                    }
                    Err(_) => f64::NAN,
                }
            } else {
                f64::NAN
            };
            let poly_r2 = if x_rows[0].len() == 1 && !poly_rmse.is_nan() {
                let xs: Vec<f64> = x_rows.iter().map(|r| r[0]).collect();
                match crate::ml::polyreg::fit(&xs, &y, 2) {
                    Ok(m) => {
                        let x2_rows: Vec<Vec<f64>> = xs.iter().map(|&v| vec![1.0, v, v * v]).collect();
                        r2_score(&crate::ml::linreg::predict(&m, &x2_rows))
                    }
                    Err(_) => f64::NAN,
                }
            } else {
                f64::NAN
            };
            model_names.push("poly2".to_string());
            result_rows.push(vec![poly_rmse, poly_r2]);

            // Model 3: Decision Tree
            let tree_rmse = kfold_rmse(&|tx, ty, vx| {
                match crate::ml::decision_tree::fit(tx, ty, 5) {
                    Ok(m) => crate::ml::decision_tree::predict(&m, vx),
                    Err(_) => vx.iter().map(|_| f64::NAN).collect(),
                }
            });
            let tree_model = crate::ml::decision_tree::fit(&x_rows, &y, 5);
            let tree_r2 = tree_model.as_ref().map(|m| r2_score(&crate::ml::decision_tree::predict(m, &x_rows))).unwrap_or(f64::NAN);
            model_names.push("decision_tree".to_string());
            result_rows.push(vec![tree_rmse, tree_r2]);

            // Model 4: GP Surrogate (small datasets only)
            let gp_rmse = if n <= 200 {
                kfold_rmse(&|tx, ty, vx| {
                    let preds = crate::optim::bayesian::gp_fit_predict(
                        tx.to_vec(), ty.to_vec(), vx, 1.0, 1.0, 1e-3,
                    );
                    preds.into_iter().map(|(m, _)| m).collect()
                })
            } else {
                f64::NAN
            };
            let gp_r2 = if n <= 200 {
                let preds = crate::optim::bayesian::gp_fit_predict(
                    x_rows.clone(), y.clone(), &x_rows, 1.0, 1.0, 1e-3,
                );
                r2_score(&preds.iter().map(|(m, _)| *m).collect::<Vec<_>>())
            } else {
                f64::NAN
            };
            model_names.push("gp_surrogate".to_string());
            result_rows.push(vec![gp_rmse, gp_r2]);

            // Find best model by lowest CV RMSE (ignoring NaN)
            let best_idx = result_rows.iter().enumerate()
                .filter(|(_, r)| !r[0].is_nan())
                .min_by(|(_, a), (_, b)| a[0].partial_cmp(&b[0]).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(i, _)| i)
                .unwrap_or(0);
            let _ = model_names;

            // Return as Table with columns [model_idx, cv_rmse, r2, is_best]
            // model_idx: 0=linear, 1=poly2, 2=decision_tree, 3=gp_surrogate
            let model_idx: Vec<f64> = (0..4usize).map(|i| i as f64).collect();
            let cv_rmse: Vec<f64> = result_rows.iter().map(|r| r[0]).collect();
            let r2_vals: Vec<f64> = result_rows.iter().map(|r| r[1]).collect();
            let is_best: Vec<f64> = (0..4usize).map(|i| if i == best_idx { 1.0 } else { 0.0 }).collect();
            crate::types::build_table(&["model_idx", "cv_rmse", "r2", "is_best"], &[model_idx, cv_rmse, r2_vals, is_best])
        }

        // ── ExpressionInput (2.12) ──────────────────────────────────
        "sym.expressionInput" => {
            // Parse the expression from data["expr"] and output LaTeX.
            // Acts as a symbolic source block — connects to sym.* blocks.
            use crate::symbolic;
            let expr_str = data.get("expr").and_then(|v| v.as_str()).unwrap_or("");
            if expr_str.is_empty() {
                return Value::Text { value: "\\text{(enter expression)}".to_string() };
            }
            match symbolic::parse_expr(expr_str) {
                Ok(e) => Value::Text { value: symbolic::to_latex(&e) },
                Err(err) => Value::error(format!("sym.expressionInput parse error: {err}")),
            }
        }

        // ── Mixed-Mode AD (1.32) ─────────────────────────────────────
        "ad.mixedJacobian" => {
            // Compute the Jacobian of a vector function using mixed-mode AD.
            // data["expressions"]: comma-separated output expressions, e.g. "x*y, x^2+y"
            // data["var_names"]:   comma-separated input variable names, e.g. "x,y"
            // input "x":           Vector of evaluation point values, OR
            // data["x"]:           comma-separated fallback if no port connected
            // data["threshold"]:   mode-switch ratio (default 1.0)
            // Output: Table with columns [output_idx, <var_names...>] — each row is ∂f_i/∂x

            let exprs_str = data.get("expressions").and_then(|v| v.as_str()).unwrap_or("");
            if exprs_str.is_empty() {
                return Value::error("ad.mixedJacobian: 'expressions' field required (comma-separated)");
            }
            let var_names_str = data.get("var_names").and_then(|v| v.as_str()).unwrap_or("x");
            let var_names: Vec<String> = var_names_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            if var_names.is_empty() {
                return Value::error("ad.mixedJacobian: 'var_names' field required");
            }

            // Evaluation point: from port "x" (Vector) or data["x"] (comma-sep)
            let x_vals: Vec<f64> = match inputs.get("x") {
                Some(Value::Vector { value: xd, .. }) => xd.clone(),
                _ => {
                    let xs = data.get("x").and_then(|v| v.as_str()).unwrap_or("");
                    xs.split(',').filter_map(|s| s.trim().parse::<f64>().ok()).collect()
                }
            };
            if x_vals.len() != var_names.len() {
                return Value::error(format!(
                    "ad.mixedJacobian: {} var_names but {} x values",
                    var_names.len(), x_vals.len()
                ));
            }

            let threshold = scalar_or(data, "threshold", 1.0);

            // Compile each expression
            let expr_strs: Vec<String> = exprs_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let mut compiled_vec = Vec::with_capacity(expr_strs.len());
            for es in &expr_strs {
                match crate::expr::compile(es) {
                    Ok(c) => compiled_vec.push(c),
                    Err(e) => return Value::error(format!("ad.mixedJacobian compile error in '{}': {}", es, e)),
                }
            }
            let compiled_refs: Vec<&crate::expr::CompiledExpr> = compiled_vec.iter().collect();
            let var_refs: Vec<&str> = var_names.iter().map(|s| s.as_str()).collect();

            let (jac, mode) = crate::autodiff::mixed_jacobian_compiled(
                &compiled_refs,
                &var_refs,
                &x_vals,
                threshold,
            );

            // Build Table: columns = ["output_idx", "mode", var_names..., "expr"]
            let n_out = jac.len();
            let n_in = var_names.len();
            let mut col_names = vec!["output_idx".to_string()];
            col_names.extend(var_names.iter().cloned());
            col_names.push("mode".to_string());

            // Build column data
            let output_idx: Vec<f64> = (0..n_out).map(|i| i as f64).collect();
            let mode_col: Vec<f64> = vec![if mode == "forward" { 0.0 } else { 1.0 }; n_out];
            let mut col_data: Vec<Vec<f64>> = vec![output_idx];
            for j in 0..n_in {
                col_data.push(jac.iter().map(|row| row[j]).collect());
            }
            col_data.push(mode_col);

            let col_refs: Vec<&str> = col_names.iter().map(|s| s.as_str()).collect();
            crate::types::build_table(&col_refs, &col_data)
        }

        // ── Gradient Checkpointing with Revolve Schedule (1.36) ──────
        "ad.gradCheckpoint" => {
            use crate::grad_checkpoint::revolve_adjoint;
            use crate::ode::types::{OdeSystem, OdeSolverConfig};

            let eqs_str = data.get("equations").and_then(|v| v.as_str()).unwrap_or("");
            if eqs_str.is_empty() {
                return Value::error("ad.gradCheckpoint: 'equations' field required");
            }
            let equations: Vec<String> = eqs_str.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let n_state = equations.len();
            let state_names: Vec<String> = (0..n_state).map(|i| format!("y{i}")).collect();
            let param_names_str = data.get("param_names").and_then(|v| v.as_str()).unwrap_or("");
            let param_names: Vec<String> = param_names_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let objective_expr = data.get("objective").and_then(|v| v.as_str()).unwrap_or("y0^2").to_string();

            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj { if let Some(n) = v.as_f64() { params.insert(k.clone(), n); } }
            }
            for i in 0..n_state {
                let key = format!("y{i}_init");
                if let Some(v) = data.get(&key).and_then(|v| v.as_f64()) { params.insert(key, v); }
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let fd_eps = scalar_or(data, "fd_eps", 1e-6);
            let n_checkpoints = data.get("n_checkpoints").and_then(|v| v.as_f64()).unwrap_or(4.0) as usize;

            let system = OdeSystem { equations, state_names, params };
            let solver_cfg = OdeSolverConfig { t_start, t_end, dt, tolerance: 1e-6, max_steps: 100_000 };

            let result = revolve_adjoint(&system, &param_names, &objective_expr, &solver_cfg, n_checkpoints, fd_eps);

            let np = result.grad.len();
            if np == 0 { return Value::scalar(result.objective); }
            let idx: Vec<f64> = (0..np).map(|i| i as f64).collect();
            let recomp: Vec<f64> = vec![result.recomputations as f64; np];
            crate::types::build_table(&["param_idx", "gradient", "recomputations"],
                &[idx, result.grad, recomp])
        }

        // ── Custom VJP/JVP Rules (1.35) ──────────────────────────────
        "ad.customVjp" => {
            use crate::custom_vjp::eval_custom_ad;

            let var_names_str = data.get("var_names").and_then(|v| v.as_str()).unwrap_or("x");
            let var_names: Vec<String> = var_names_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();

            // Evaluation point
            let x_vals: Vec<f64> = match inputs.get("x") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => data.get("x").and_then(|v| v.as_str()).map(|s|
                    s.split(',').filter_map(|p| p.trim().parse().ok()).collect()
                ).unwrap_or_else(|| vec![0.0; var_names.len()]),
            };

            // Cotangent for VJP
            let v_vals: Vec<f64> = match inputs.get("v") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => data.get("v").and_then(|v| v.as_str()).map(|s|
                    s.split(',').filter_map(|p| p.trim().parse().ok()).collect()
                ).unwrap_or_else(|| vec![1.0]),
            };

            // Tangent for JVP
            let t_vals: Vec<f64> = match inputs.get("t") {
                Some(Value::Vector { value }) => value.clone(),
                Some(Value::Scalar { value }) => vec![*value],
                _ => data.get("t").and_then(|v| v.as_str()).map(|s|
                    s.split(',').filter_map(|p| p.trim().parse().ok()).collect()
                ).unwrap_or_else(|| vec![1.0; var_names.len()]),
            };

            let primal_expr = data.get("primal_expr").and_then(|v| v.as_str()).unwrap_or("");
            if primal_expr.is_empty() {
                return Value::error("ad.customVjp: 'primal_expr' required");
            }
            let vjp_exprs_str = data.get("vjp_exprs").and_then(|v| v.as_str()).unwrap_or("");
            let vjp_exprs: Vec<String> = if vjp_exprs_str.is_empty() { vec![] }
                else { vjp_exprs_str.split(';').map(|s| s.trim().to_string()).collect() };
            let jvp_expr = data.get("jvp_expr").and_then(|v| v.as_str()).unwrap_or("");
            let mode = data.get("mode").and_then(|v| v.as_str()).unwrap_or("primal");

            let result = eval_custom_ad(&var_names, &x_vals, &v_vals, &t_vals, primal_expr, &vjp_exprs, jvp_expr, mode);

            match mode {
                "vjp" => Value::Vector { value: result.vjp },
                "jvp" => Value::scalar(result.jvp),
                _ => Value::scalar(result.primal),
            }
        }

        // ── AD Through Linear Solvers: Implicit Differentiation (1.34) ──
        "ad.linSolveSens" => {
            use crate::autodiff_linsolve::implicit_diff;

            // A_exprs: semicolon-separated row-major expressions for A matrix entries
            // b_exprs: semicolon-separated expressions for b vector entries
            // param_names: comma-separated
            // param_values: comma-separated current values
            let a_str = data.get("A_exprs").and_then(|v| v.as_str()).unwrap_or("");
            let b_str = data.get("b_exprs").and_then(|v| v.as_str()).unwrap_or("");
            if a_str.is_empty() || b_str.is_empty() {
                return Value::error("ad.linSolveSens: A_exprs and b_exprs required");
            }
            let a_exprs: Vec<String> = a_str.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let b_exprs: Vec<String> = b_str.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let n = b_exprs.len();
            if a_exprs.len() != n * n {
                return Value::error(format!("ad.linSolveSens: A_exprs has {} entries; expected {}×{}={}", a_exprs.len(), n, n, n*n));
            }

            let param_names_str = data.get("param_names").and_then(|v| v.as_str()).unwrap_or("");
            let param_names: Vec<String> = param_names_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let param_vals_str = data.get("param_values").and_then(|v| v.as_str()).unwrap_or("");
            let param_vals: Vec<f64> = param_vals_str.split(',').filter_map(|s| s.trim().parse().ok()).collect();

            let mut params = std::collections::HashMap::new();
            for (name, val) in param_names.iter().zip(param_vals.iter()) {
                params.insert(name.clone(), *val);
            }
            let fd_eps = scalar_or(data, "fd_eps", 1e-6);

            let result = implicit_diff(&a_exprs, &b_exprs, &param_names, &params, fd_eps);

            // Build Table: columns = [param_idx, x0, x1, ..., xN-1, dx0/dp, dx1/dp, ...]
            // Simpler: one row per parameter, columns: [param_idx, dx0, dx1, ...]
            let np = param_names.len();
            if np == 0 {
                // No parameters — just return the solution
                return Value::Vector { value: result.x };
            }
            let idx: Vec<f64> = (0..np).map(|i| i as f64).collect();
            let mut col_data = vec![idx];
            for j in 0..n {
                let dxj: Vec<f64> = result.sensitivities.iter().map(|sens| sens[j]).collect();
                col_data.push(dxj);
            }
            let mut col_names = vec!["param_idx"];
            let dx_names: Vec<String> = (0..n).map(|j| format!("dx{j}/dp")).collect();
            let dx_refs: Vec<&str> = dx_names.iter().map(|s| s.as_str()).collect();
            col_names.extend_from_slice(&dx_refs);
            crate::types::build_table(&col_names, &col_data)
        }

        // ── Discrete Adjoint ODE Sensitivity (1.33) ─────────────────
        "ad.odeAdjoint" => {
            use crate::ode::adjoint::{AdjointConfig, AdjointResult, discrete_adjoint};
            use crate::ode::types::{OdeSystem, OdeSolverConfig};

            // equations: semicolon-separated ODE RHS strings (dy_i/dt)
            let eqs_str = data.get("equations").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if eqs_str.is_empty() {
                return Value::error("ad.odeAdjoint: 'equations' field required (semicolon-separated)");
            }
            let equations: Vec<String> = eqs_str.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            let n_state = equations.len();
            let state_names: Vec<String> = (0..n_state).map(|i| format!("y{i}")).collect();

            // param_names: comma-separated list of parameter names to differentiate w.r.t.
            let param_names_str = data.get("param_names").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let param_names: Vec<String> = param_names_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();

            // objective: scalar expression of final state (y0, y1, ...)
            let objective_expr = data.get("objective").and_then(|v| v.as_str()).unwrap_or("y0^2").to_string();

            // Parameters from block data
            let mut params = std::collections::HashMap::new();
            if let Some(serde_json::Value::Object(obj)) = data.get("params") {
                for (k, v) in obj {
                    if let Some(n) = v.as_f64() { params.insert(k.clone(), n); }
                }
            }
            // Also accept initial conditions as y0_init, y1_init, ...
            for i in 0..n_state {
                let key = format!("y{i}_init");
                if let Some(v) = data.get(&key).and_then(|v| v.as_f64()) {
                    params.insert(key, v);
                }
            }

            let t_start = scalar_or(data, "t_start", 0.0);
            let t_end = scalar_or(data, "t_end", 1.0);
            let dt = scalar_or(data, "dt", 0.01);
            let fd_eps = scalar_or(data, "fd_eps", 1e-6);
            let n_checkpoints = data.get("n_checkpoints").and_then(|v| v.as_f64()).unwrap_or(0.0) as usize;

            let system = OdeSystem { equations, state_names, params };
            let solver_cfg = OdeSolverConfig { t_start, t_end, dt, tolerance: 1e-6, max_steps: 100_000 };
            let adj_cfg = AdjointConfig {
                system, param_names, objective_expr, solver_cfg, n_checkpoints, fd_eps,
            };

            let result: AdjointResult = discrete_adjoint(&adj_cfg);

            // Return Table: [param_name_idx, gradient, param_name (encoded as index)]
            let n = result.grad.len();
            let idx: Vec<f64> = (0..n).map(|i| i as f64).collect();
            let grads = result.grad.clone();
            let obj_col = vec![result.objective; n.max(1)];

            if n == 0 {
                return Value::scalar(result.objective);
            }
            crate::types::build_table(&["param_idx", "gradient", "objective"], &[idx, grads, obj_col])
        }

        // ── Units Conversion (1.28) ──────────────────────────────────
        "units.convert" => {
            use crate::units::{lookup_unit, convert};
            let from_sym = data.get("from_unit").and_then(|v| v.as_str()).unwrap_or("m");
            let to_sym   = data.get("to_unit").and_then(|v| v.as_str()).unwrap_or("m");
            let from_def = match lookup_unit(from_sym) {
                Some(d) => d,
                None => return Value::error(format!("units.convert: unknown unit '{from_sym}'")),
            };
            let to_def = match lookup_unit(to_sym) {
                Some(d) => d,
                None => return Value::error(format!("units.convert: unknown unit '{to_sym}'")),
            };
            match inputs.get("value") {
                Some(Value::Scalar { value }) => {
                    match convert(*value, &from_def, &to_def) {
                        Some(result) => Value::scalar(result),
                        None => Value::error(format!(
                            "units.convert: incompatible dimensions ({} → {})",
                            from_def.dimension.display(), to_def.dimension.display()
                        )),
                    }
                }
                Some(Value::Vector { value }) => {
                    let converted: Vec<f64> = value.iter().filter_map(|&v| convert(v, &from_def, &to_def)).collect();
                    if converted.len() != value.len() {
                        return Value::error(format!(
                            "units.convert: incompatible dimensions ({} → {})",
                            from_def.dimension.display(), to_def.dimension.display()
                        ));
                    }
                    Value::Vector { value: converted }
                }
                _ => Value::error("units.convert: 'value' input required (Scalar or Vector)"),
            }
        }

        // ── Units Analysis (1.28) ────────────────────────────────────
        "units.analyze" => {
            use crate::units::analyse_units;
            let symbols_str = data.get("units").and_then(|v| v.as_str()).unwrap_or("kg,m,s");
            let symbols: Vec<&str> = symbols_str.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            let analysis = analyse_units(&symbols);
            let n = analysis.entries.len();
            let sym_col: Vec<f64> = (0..n).map(|i| i as f64).collect();
            let scale_col: Vec<f64> = analysis.entries.iter().map(|e| e.scale).collect();
            let ok_col: Vec<f64> = analysis.entries.iter().map(|e| if e.ok { 1.0 } else { 0.0 }).collect();
            let consistent = if analysis.is_consistent { 1.0 } else { 0.0 };
            // Return a summary scalar + table on the same block output
            // (The block output is a Table; the summary is in the first row of a "meta" column)
            let mut rows: Vec<Vec<f64>> = Vec::with_capacity(n + 1);
            rows.push(vec![consistent, f64::NAN, f64::NAN]);
            for (i, _e) in analysis.entries.iter().enumerate() {
                rows.push(vec![sym_col[i], scale_col[i], ok_col[i]]);
            }
            Value::Table {
                columns: vec!["idx_or_meta".to_string(), "scale_si".to_string(), "ok".to_string()],
                rows,
            }
        }

        _ => Value::error(format!("Unknown block type: {}", block_type)),
    }
}

/// Apply a binary operation on two interval-or-scalar inputs.
fn interval_binary<F>(
    inputs: &std::collections::HashMap<String, Value>,
    key_a: &str,
    key_b: &str,
    op: F,
) -> Value
where
    F: Fn(f64, f64, f64, f64) -> (f64, f64),
{
    let get_bounds = |v: &Value| match v {
        Value::Interval { lo, hi } => Ok((*lo, *hi)),
        Value::Scalar { value } => Ok((*value, *value)),
        Value::Error { message } => Err(message.clone()),
        _ => Err("expected interval or scalar".to_string()),
    };
    match (inputs.get(key_a), inputs.get(key_b)) {
        (Some(va), Some(vb)) => match (get_bounds(va), get_bounds(vb)) {
            (Ok((al, ah)), Ok((bl, bh))) => {
                let (lo, hi) = op(al, ah, bl, bh);
                Value::Interval { lo: lo.min(hi), hi: lo.max(hi) }
            }
            (Err(e), _) | (_, Err(e)) => Value::error(e),
        },
        _ => Value::error(format!("interval op: inputs '{}' and '{}' required", key_a, key_b)),
    }
}

// ── SCI-08: Complex binary helper ────────────────────────────────

fn complex_binary<F>(
    inputs: &std::collections::HashMap<String, Value>,
    key1: &str,
    key2: &str,
    op: F,
) -> Value
where F: Fn(f64,f64,f64,f64)->(f64,f64),
{
    let to_cpx = |v: &Value| match v {
        Value::Complex{re,im} => Ok((*re,*im)),
        Value::Scalar{value} => Ok((*value,0.0)),
        Value::Error{message} => Err(message.clone()),
        _ => Err("expected complex or scalar".to_string()),
    };
    match (inputs.get(key1), inputs.get(key2)) {
        (Some(v1),Some(v2)) => match (to_cpx(v1),to_cpx(v2)) {
            (Ok((r1,i1)),Ok((r2,i2))) => { let (re,im)=op(r1,i1,r2,i2); Value::Complex{re,im} }
            (Err(e),_)|(_, Err(e)) => Value::error(e),
        },
        _ => Value::error(format!("complex op: inputs '{}' and '{}' required",key1,key2)),
    }
}

// ── BLK-08: Text formatting helpers ──────────────────────────────

/// Format a floating-point number using a printf-like format string.
/// Supports: %f, %e, %g, %d (with optional precision like %.2f, %8.3f).
fn format_number(val: f64, fmt: &str) -> String {
    if val.is_nan() { return "NaN".to_string(); }
    if val.is_infinite() { return if val > 0.0 { "Inf".to_string() } else { "-Inf".to_string() }; }
    // Parse format: %[width][.precision]specifier
    let s = fmt.trim_start_matches('%');
    let (prec, spec) = if let Some(dot) = s.find('.') {
        let p = s[dot+1..].chars().take_while(|c|c.is_ascii_digit()).collect::<String>().parse::<usize>().unwrap_or(6);
        let sp = s.chars().rev().next().unwrap_or('g');
        (p, sp)
    } else {
        let sp = s.chars().rev().next().unwrap_or('g');
        (6usize, sp)
    };
    match spec {
        'f' => format!("{:.prec$}", val, prec=prec),
        'e' => format!("{:.prec$e}", val, prec=prec),
        'g' => {
            // Use %e if exponent < -4 or >= precision, else %f
            if val == 0.0 { return "0".to_string(); }
            let exp = val.abs().log10().floor() as i32;
            if exp < -4 || exp >= prec as i32 {
                // Remove trailing zeros from scientific
                let s = format!("{:.prec$e}", val, prec=if prec>0{prec-1}else{0});
                s
            } else {
                let sig = prec as i32 - exp - 1;
                let p = sig.max(0) as usize;
                let s = format!("{:.prec$}", val, prec=p);
                // Remove trailing zeros after decimal
                if s.contains('.') { s.trim_end_matches('0').trim_end_matches('.').to_string() } else { s }
            }
        }
        'd' => format!("{}", val.round() as i64),
        _ => format!("{}", val),
    }
}

/// Get text representation of an input value (Text as-is, Scalar as string).
fn get_text_or_num(inputs: &std::collections::HashMap<String, Value>, key: &str) -> Result<String, String> {
    match inputs.get(key) {
        Some(Value::Text { value: s }) => Ok(s.clone()),
        Some(Value::Scalar { value: v }) => Ok(format!("{}", v)),
        Some(Value::Error { message: m }) => Err(m.clone()),
        None => Ok(String::new()),
        _ => Err(format!("text op: '{}' must be text or scalar", key)),
    }
}

// ── SCI-12: FFT helpers ───────────────────────────────────────────

/// Round up to next power of 2 (minimum 2).
fn next_pow2(n: usize) -> usize {
    if n <= 1 { return 2; }
    let mut p = 1usize;
    while p < n { p <<= 1; }
    p
}

/// In-place Cooley-Tukey FFT (or IFFT if inverse=true).
/// `re` and `im` must have the same power-of-2 length.
fn fft_inplace(re: &mut [f64], im: &mut [f64], inverse: bool) {
    let n = re.len();
    debug_assert!(n.is_power_of_two());
    // Bit-reversal permutation
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j ^= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    // Butterfly stages
    let mut len = 2usize;
    while len <= n {
        let ang = 2.0 * std::f64::consts::PI / len as f64 * if inverse { 1.0 } else { -1.0 };
        let (wre, wim) = (ang.cos(), ang.sin());
        for i in (0..n).step_by(len) {
            let (mut ure, mut uim) = (1.0f64, 0.0f64);
            for k in 0..len/2 {
                let (tre, tim) = (re[i+k+len/2]*ure - im[i+k+len/2]*uim,
                                   re[i+k+len/2]*uim + im[i+k+len/2]*ure);
                re[i+k+len/2] = re[i+k] - tre;
                im[i+k+len/2] = im[i+k] - tim;
                re[i+k] += tre;
                im[i+k] += tim;
                (ure, uim) = (ure*wre - uim*wim, ure*wim + uim*wre);
            }
        }
        len <<= 1;
    }
    if inverse {
        let nf = n as f64;
        for x in re.iter_mut() { *x /= nf; }
        for x in im.iter_mut() { *x /= nf; }
    }
}

// ── Canonicalization ─────────────────────────────────────────────

/// Canonicalize NaN to a single bit pattern and normalize -0 to +0.
#[inline]
fn canonicalize(v: f64) -> f64 {
    if v.is_nan() {
        f64::NAN
    } else if v == 0.0 {
        0.0 // normalizes -0.0 to +0.0
    } else {
        v
    }
}

/// Canonicalize all f64 values in a Value.
fn canonicalize_value(v: Value) -> Value {
    match v {
        Value::Scalar { value } => Value::Scalar {
            value: canonicalize(value),
        },
        Value::Vector { value } => Value::Vector {
            value: value.into_iter().map(canonicalize).collect(),
        },
        Value::Table { columns, rows } => Value::Table {
            columns,
            rows: rows
                .into_iter()
                .map(|row| row.into_iter().map(canonicalize).collect())
                .collect(),
        },
        Value::Error { .. } => v,
        Value::Text { .. } => v, // Text values are not numeric, pass through unchanged
        Value::Interval { lo, hi } => Value::Interval {
            lo: canonicalize(lo),
            hi: canonicalize(hi),
        },
        Value::Complex { re, im } => Value::Complex {
            re: canonicalize(re),
            im: canonicalize(im),
        },
        Value::Matrix { rows, cols, data } => Value::Matrix {
            rows,
            cols,
            data: data.into_iter().map(canonicalize).collect(),
        },
        // HighPrecision values are already canonicalized (arbitrary precision, no f64 artefacts)
        Value::HighPrecision { .. } => v,
    }
}

// ── Helpers ───────────────────────────────────────────────────────

fn scalar_or_nan(inputs: &HashMap<String, Value>, port: &str) -> f64 {
    inputs
        .get(port)
        .and_then(|v| v.as_scalar())
        .unwrap_or(f64::NAN)
}

// ── Broadcasting helpers ────────────────────────────────────────

/// Unary operation with broadcasting on a named port:
/// Scalar → Scalar, Vector → Vector (elementwise), Table → Table (elementwise),
/// Error → propagate, None → f(NaN).
fn unary_broadcast_port(
    inputs: &HashMap<String, Value>,
    port: &str,
    f: impl Fn(f64) -> f64,
) -> Value {
    match inputs.get(port) {
        Some(Value::Scalar { value }) => Value::scalar(f(*value)),
        Some(Value::Vector { value }) => Value::Vector {
            value: value.iter().map(|x| f(*x)).collect(),
        },
        Some(Value::Table { columns, rows }) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x)).collect())
                .collect(),
        },
        Some(Value::Error { message }) => Value::error(message.clone()),
        Some(other) => Value::error(format!("unary op: type '{}' is not numeric", other.kind_str())),
        None => Value::scalar(f(f64::NAN)),
    }
}

/// Convenience: unary broadcast on port "a".
fn unary_broadcast(inputs: &HashMap<String, Value>, f: impl Fn(f64) -> f64) -> Value {
    unary_broadcast_port(inputs, "a", f)
}

/// Binary operation with broadcasting on named ports.
///
/// Rules:
/// - Scalar ⊕ Scalar → Scalar
/// - Scalar ⊕ Vector → Vector (broadcast scalar)
/// - Vector ⊕ Scalar → Vector (broadcast scalar)
/// - Vector ⊕ Vector → Vector (same-length, else error)
/// - Scalar ⊕ Table → Table (broadcast scalar)
/// - Table ⊕ Scalar → Table (broadcast scalar)
/// - Table ⊕ Table → Table (same-shape, else error)
/// - Error on either side → propagate first error
/// - Vector ⊕ Table / Table ⊕ Vector → error
fn binary_broadcast_ports(
    inputs: &HashMap<String, Value>,
    port_a: &str,
    port_b: &str,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    let a = inputs.get(port_a);
    let b = inputs.get(port_b);

    // Propagate errors first.
    if let Some(Value::Error { message }) = a {
        return Value::error(message.clone());
    }
    if let Some(Value::Error { message }) = b {
        return Value::error(message.clone());
    }

    match (a, b) {
        // Scalar ⊕ Scalar
        (Some(Value::Scalar { value: va }), Some(Value::Scalar { value: vb })) => {
            Value::scalar(f(*va, *vb))
        }
        // None cases → treat missing as NaN scalar
        (None, None) => Value::scalar(f(f64::NAN, f64::NAN)),
        (Some(Value::Scalar { value: va }), None) => Value::scalar(f(*va, f64::NAN)),
        (None, Some(Value::Scalar { value: vb })) => Value::scalar(f(f64::NAN, *vb)),

        // Scalar ⊕ Vector → Vector
        (Some(Value::Scalar { value: s }), Some(Value::Vector { value: vec })) => Value::Vector {
            value: vec.iter().map(|x| f(*s, *x)).collect(),
        },
        // Vector ⊕ Scalar → Vector
        (Some(Value::Vector { value: vec }), Some(Value::Scalar { value: s })) => Value::Vector {
            value: vec.iter().map(|x| f(*x, *s)).collect(),
        },
        // Vector ⊕ Vector → element-wise; pad shorter with NaN (H2-2)
        (Some(Value::Vector { value: va }), Some(Value::Vector { value: vb })) => {
            let len = va.len().max(vb.len());
            Value::Vector {
                value: (0..len)
                    .map(|i| {
                        let a = va.get(i).copied().unwrap_or(f64::NAN);
                        let b = vb.get(i).copied().unwrap_or(f64::NAN);
                        f(a, b)
                    })
                    .collect(),
            }
        }

        // Scalar ⊕ Table → Table
        (Some(Value::Scalar { value: s }), Some(Value::Table { columns, rows })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*s, *x)).collect())
                .collect(),
        },
        // Table ⊕ Scalar → Table
        (Some(Value::Table { columns, rows }), Some(Value::Scalar { value: s })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x, *s)).collect())
                .collect(),
        },
        // Table ⊕ Table → same shape
        (
            Some(Value::Table {
                columns: ca,
                rows: ra,
            }),
            Some(Value::Table {
                columns: cb,
                rows: rb,
            }),
        ) => {
            if ca.len() != cb.len() || ra.len() != rb.len() {
                return Value::error(format!(
                    "Table shape mismatch: {}x{} vs {}x{}",
                    ra.len(),
                    ca.len(),
                    rb.len(),
                    cb.len()
                ));
            }
            Value::Table {
                columns: ca.clone(),
                rows: ra
                    .iter()
                    .zip(rb.iter())
                    .map(|(row_a, row_b)| {
                        row_a.iter().zip(row_b.iter()).map(|(a, b)| f(*a, *b)).collect()
                    })
                    .collect(),
            }
        }

        // Vector ⊕ None → broadcast NaN
        (Some(Value::Vector { value: vec }), None) => Value::Vector {
            value: vec.iter().map(|x| f(*x, f64::NAN)).collect(),
        },
        (None, Some(Value::Vector { value: vec })) => Value::Vector {
            value: vec.iter().map(|x| f(f64::NAN, *x)).collect(),
        },
        // Table ⊕ None → broadcast NaN
        (Some(Value::Table { columns, rows }), None) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(*x, f64::NAN)).collect())
                .collect(),
        },
        (None, Some(Value::Table { columns, rows })) => Value::Table {
            columns: columns.clone(),
            rows: rows
                .iter()
                .map(|row| row.iter().map(|x| f(f64::NAN, *x)).collect())
                .collect(),
        },

        // Incompatible: Vector ⊕ Table, Table ⊕ Vector, or mismatched types
        (Some(va), Some(vb)) => Value::error(format!(
            "Cannot broadcast {} with {}",
            va.kind_str(),
            vb.kind_str()
        )),
        // Catch-all: non-numeric types (Text, Interval, Complex, Matrix) combined with None
        _ => Value::error("binary op: unsupported type combination"),
    }
}

/// Convenience: binary broadcast on ports "a" and "b".
fn binary_broadcast(
    inputs: &HashMap<String, Value>,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    binary_broadcast_ports(inputs, "a", "b", f)
}

/// N-ary broadcast: applies a binary associative op across variadic inputs
/// named `in_0`, `in_1`, ..., `in_N` by left-fold with broadcasting.
/// Falls back to binary `a`/`b` ports if no `in_0` is found (backward compat).
fn nary_broadcast(
    inputs: &HashMap<String, Value>,
    f: impl Fn(f64, f64) -> f64 + Copy,
) -> Value {
    // Check for variadic inputs (in_0, in_1, ...)
    if inputs.contains_key("in_0") {
        let mut i = 0;
        let mut result: Option<Value> = None;
        loop {
            let key = format!("in_{}", i);
            match inputs.get(&key) {
                Some(val) => {
                    result = Some(match result {
                        None => val.clone(),
                        Some(acc) => binary_broadcast_two_values(&acc, val, f),
                    });
                    i += 1;
                }
                None => break,
            }
        }
        result.unwrap_or(Value::scalar(0.0))
    } else {
        // Fallback: standard binary a/b ports
        binary_broadcast(inputs, f)
    }
}

/// Helper: broadcast two Values with a binary op (not reading from ports).
fn binary_broadcast_two_values(
    a: &Value,
    b: &Value,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    match (a, b) {
        (Value::Scalar { value: va }, Value::Scalar { value: vb }) => {
            Value::scalar(f(*va, *vb))
        }
        (Value::Scalar { value: s }, Value::Vector { value: vec }) => {
            Value::Vector {
                value: vec.iter().map(|v| f(*s, *v)).collect(),
            }
        }
        (Value::Vector { value: vec }, Value::Scalar { value: s }) => {
            Value::Vector {
                value: vec.iter().map(|v| f(*v, *s)).collect(),
            }
        }
        (Value::Vector { value: va }, Value::Vector { value: vb }) => {
            if va.len() != vb.len() {
                return Value::error(format!(
                    "Vector length mismatch: {} vs {}",
                    va.len(),
                    vb.len()
                ));
            }
            Value::Vector {
                value: va.iter().zip(vb.iter()).map(|(a, b)| f(*a, *b)).collect(),
            }
        }
        (Value::Error { .. }, _) => a.clone(),
        (_, Value::Error { .. }) => b.clone(),
        _ => Value::error("Unsupported types for broadcast".to_string()),
    }
}

fn require_vector<'a>(
    inputs: &'a HashMap<String, Value>,
    port: &str,
    name: &str,
) -> Result<&'a Vec<f64>, Value> {
    match inputs.get(port) {
        Some(Value::Vector { value }) => Ok(value),
        Some(_) => Err(Value::error(format!("{}: expected vector", name))),
        None => Err(Value::error(format!("{}: no input", name))),
    }
}

// ── W11b helpers ─────────────────────────────────────────────────

/// Port names for fixed-slot stats blocks (X1..X6).
const X_PORTS: [&str; 6] = ["x1", "x2", "x3", "x4", "x5", "x6"];
/// Port names for Y slots in relationship blocks (Y1..Y6).
const Y_PORTS: [&str; 6] = ["y1", "y2", "y3", "y4", "y5", "y6"];
/// Port names for cash-flow slots (CF0..CF5).
const CF_PORTS: [&str; 6] = ["cf0", "cf1", "cf2", "cf3", "cf4", "cf5"];

// ── SCI-03: Neumaier compensated summation ───────────────────────────────────

/// Neumaier compensated summation — handles both |sum| >> |x| and |x| >> |sum|.
/// Strictly better than Kahan's original algorithm for all input orderings.
fn kahan_sum(iter: impl Iterator<Item = f64>) -> f64 {
    let mut sum  = 0.0_f64;
    let mut comp = 0.0_f64;
    for x in iter {
        let t = sum + x;
        comp += if sum.abs() >= x.abs() {
            (sum - t) + x   // |sum| >= |x|
        } else {
            (x - t) + sum   // |x| > |sum|
        };
        sum = t;
    }
    sum + comp
}

// ── SCI-11 / BLK-07: Special mathematical functions ──────────────────────────

/// High-accuracy erf via Horner polynomial (Abramowitz & Stegun 7.1.26).
/// Max error |ε| ≤ 1.5×10⁻⁷.
#[allow(clippy::excessive_precision)]
fn erf_approx(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + 0.3275911 * x);
    let poly = t * (0.254829592
        + t * (-0.284496736
        + t * (1.421413741
        + t * (-1.453152027
        + t * 1.061405429))));
    sign * (1.0 - poly * (-x * x).exp())
}

/// Standard normal CDF Φ(z) = 0.5·(1 + erf(z/√2)).
fn normal_cdf(z: f64) -> f64 {
    0.5 * (1.0 + erf_approx(z / std::f64::consts::SQRT_2))
}

/// Standard normal PDF φ(z) = (1/√(2π))·exp(−z²/2).
fn normal_pdf_std(z: f64) -> f64 {
    (-0.5 * z * z).exp() / (2.0 * std::f64::consts::PI).sqrt()
}

/// Probit function (standard normal quantile) via Acklam's rational approximation.
/// Max error ~4.5×10⁻⁴.
#[allow(clippy::excessive_precision)]
fn normal_inv_cdf(p: f64) -> f64 {
    if p <= 0.0 { return f64::NEG_INFINITY; }
    if p >= 1.0 { return f64::INFINITY; }
    const A: [f64; 6] = [
        -3.969683028665376e+01, 2.209460984245205e+02,
        -2.759285104469687e+02, 1.383577518672690e+02,
        -3.066479806614716e+01, 2.506628277459239e+00,
    ];
    const B: [f64; 5] = [
        -5.447609879822406e+01, 1.615858368580409e+02,
        -1.556989798598866e+02, 6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    const C: [f64; 6] = [
        -7.784894002430293e-03, -3.223964580411365e-01,
        -2.400758277161838e+00, -2.549732539343734e+00,
         4.374664141464968e+00,  2.938163982698783e+00,
    ];
    const D: [f64; 4] = [
        7.784695709041462e-03, 3.224671290700398e-01,
        2.445134137142996e+00, 3.754408661907416e+00,
    ];
    const P_LOW: f64 = 0.02425;
    const P_HIGH: f64 = 1.0 - P_LOW;
    if p < P_LOW {
        let q = (-2.0 * p.ln()).sqrt();
        (((((C[0]*q+C[1])*q+C[2])*q+C[3])*q+C[4])*q+C[5]) /
        ((((D[0]*q+D[1])*q+D[2])*q+D[3])*q+1.0)
    } else if p <= P_HIGH {
        let q = p - 0.5;
        let r = q * q;
        (((((A[0]*r+A[1])*r+A[2])*r+A[3])*r+A[4])*r+A[5]) * q /
        (((((B[0]*r+B[1])*r+B[2])*r+B[3])*r+B[4])*r+1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((C[0]*q+C[1])*q+C[2])*q+C[3])*q+C[4])*q+C[5]) /
        ((((D[0]*q+D[1])*q+D[2])*q+D[3])*q+1.0)
    }
}

/// ln(Γ(x)) via Lanczos approximation (g=7, n=9, ~15 significant digits).
#[allow(clippy::excessive_precision)]
fn log_gamma(x: f64) -> f64 {
    const G: f64 = 7.0;
    const C: [f64; 9] = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if x < 0.5 {
        std::f64::consts::PI.ln()
            - (std::f64::consts::PI * x).sin().abs().ln()
            - log_gamma(1.0 - x)
    } else {
        let xx = x - 1.0;
        let mut a = C[0];
        for i in 1..9 { a += C[i] / (xx + i as f64); }
        let t = xx + G + 0.5;
        0.5 * (2.0 * std::f64::consts::PI).ln()
            + (xx + 0.5) * t.ln()
            - t
            + a.ln()
    }
}

/// Regularised lower incomplete gamma P(a, x) = γ(a,x)/Γ(a).
fn reg_gamma_lower(a: f64, x: f64) -> f64 {
    if x <= 0.0 { return 0.0; }
    if a <= 0.0 { return f64::NAN; }
    if x < a + 1.0 {
        // Series expansion
        let mut ap  = a;
        let mut del = 1.0 / a;
        let mut sum = del;
        for _ in 0..300 {
            ap  += 1.0;
            del *= x / ap;
            sum += del;
            if del.abs() < sum.abs() * 1e-14 { break; }
        }
        ((-x + a * x.ln()) - log_gamma(a)).exp() * sum
    } else {
        1.0 - reg_gamma_upper_cf(a, x)
    }
}

/// Upper regularised incomplete gamma Q(a,x) via Lentz continued fraction.
fn reg_gamma_upper_cf(a: f64, x: f64) -> f64 {
    const FPMIN: f64 = 1e-300;
    let mut b = x + 1.0 - a;
    let mut c = 1.0 / FPMIN;
    let mut d = 1.0 / b;
    let mut h = d;
    for i in 1_usize..=300 {
        let an = -(i as f64) * (i as f64 - a);
        b += 2.0;
        d = an * d + b; if d.abs() < FPMIN { d = FPMIN; }
        c = b + an / c; if c.abs() < FPMIN { c = FPMIN; }
        d = 1.0 / d;
        let del = d * c;
        h *= del;
        if (del - 1.0).abs() < 1e-14 { break; }
    }
    ((-x + a * x.ln()) - log_gamma(a)).exp() * h
}

/// Regularised incomplete beta I_x(a,b) via Lentz continued fraction.
fn reg_inc_beta(a: f64, b: f64, x: f64) -> f64 {
    if x <= 0.0 { return 0.0; }
    if x >= 1.0 { return 1.0; }
    // Symmetry: use CF on whichever side converges faster
    if x > (a + 1.0) / (a + b + 2.0) {
        return 1.0 - reg_inc_beta(b, a, 1.0 - x);
    }
    let log_beta = log_gamma(a) + log_gamma(b) - log_gamma(a + b);
    let front = (a * x.ln() + b * (1.0 - x).ln() - log_beta - a.ln()).exp();
    const FPMIN: f64 = 1e-300;
    let mut c = 1.0;
    let mut d = 1.0 - (a + b) * x / (a + 1.0);
    if d.abs() < FPMIN { d = FPMIN; }
    d = 1.0 / d;
    let mut h = d;
    for m in 1_usize..=300 {
        let mf = m as f64;
        // Even step
        let aa = mf * (b - mf) * x / ((a + 2.0*mf - 1.0) * (a + 2.0*mf));
        d = 1.0 + aa * d; if d.abs() < FPMIN { d = FPMIN; }
        c = 1.0 + aa / c; if c.abs() < FPMIN { c = FPMIN; }
        d = 1.0 / d; h *= d * c;
        // Odd step
        let aa = -(a + mf) * (a + b + mf) * x / ((a + 2.0*mf) * (a + 2.0*mf + 1.0));
        d = 1.0 + aa * d; if d.abs() < FPMIN { d = FPMIN; }
        c = 1.0 + aa / c; if c.abs() < FPMIN { c = FPMIN; }
        d = 1.0 / d;
        let del = d * c;
        h *= del;
        if (del - 1.0).abs() < 1e-14 { break; }
    }
    front * h
}

// ── BLK-03: ISA standard atmosphere helpers ───────────────────────────────────

/// ICAO ISA temperature (K) at geometric altitude h (m).
fn isa_temperature(h: f64) -> f64 {
    if h <= 11_000.0 {
        288.15 - 0.0065 * h            // troposphere
    } else if h <= 20_000.0 {
        216.65                          // tropopause (isothermal)
    } else {
        216.65 + 0.001 * (h - 20_000.0) // lower stratosphere
    }
}

/// ICAO ISA pressure (Pa) at geometric altitude h (m).
fn isa_pressure(h: f64) -> f64 {
    const P0:  f64 = 101_325.0;
    const T0:  f64 = 288.15;
    const L:   f64 = 0.0065;   // magnitude of lapse rate
    const R:   f64 = 287.05;
    const G0:  f64 = 9.80665;
    const T11: f64 = 216.65;
    const P11: f64 = 22_632.1;
    if h <= 11_000.0 {
        P0 * ((T0 - L * h) / T0).powf(G0 / (L * R))
    } else if h <= 20_000.0 {
        P11 * (-(G0 / (R * T11)) * (h - 11_000.0)).exp()
    } else {
        const P20: f64 = 5_474.89;
        const T20: f64 = 216.65;
        const L2:  f64 = 0.001;
        P20 * ((T20 + L2 * (h - 20_000.0)) / T20).powf(-G0 / (L2 * R))
    }
}

// ── BLK-09: Date helpers ──────────────────────────────────────────────────────

/// Encode (y, m, d) as days since 2000-01-01 (using Julian Day arithmetic).
fn ymd_to_day(y: i64, m: i64, d: i64) -> i64 {
    let a  = (14 - m) / 12;
    let yy = y + 4800 - a;
    let mm = m + 12 * a - 3;
    let jdn = d + (153 * mm + 2) / 5 + 365 * yy + yy / 4 - yy / 100 + yy / 400 - 32045;
    jdn - 2_451_545          // offset so 2000-01-01 = 0
}

/// Decode integer day (days since 2000-01-01) back to (year, month, day).
fn day_to_ymd(day: i64) -> (i64, i64, i64) {
    let jdn = day + 2_451_545;
    let a = jdn + 32044;
    let b = (4 * a + 3) / 146097;
    let c = a - 146097 * b / 4;
    let d = (4 * c + 3) / 1461;
    let e = c - 1461 * d / 4;
    let m = (5 * e + 2) / 153;
    let dom   = e - (153 * m + 2) / 5 + 1;
    let month = m + 3 - 12 * (m / 10);
    let year  = 100 * b + d - 4800 + m / 10;
    (year, month, dom)
}

/// Read the `c` (count) port, clamp to [min_c..6], return as usize.
fn validated_count(inputs: &HashMap<String, Value>, min_c: usize) -> usize {
    let raw = scalar_or_nan(inputs, "c");
    if raw.is_nan() { min_c } else { (raw.round() as usize).clamp(min_c, 6) }
}

/// Collect `count` values from the named port array, defaulting missing to 0.
fn collect_values(inputs: &HashMap<String, Value>, ports: &[&str], count: usize) -> Vec<f64> {
    (0..count).map(|i| {
        inputs.get(ports[i]).and_then(|v| v.as_scalar()).unwrap_or(0.0)
    }).collect()
}

/// n! as f64 (n ≤ 170 to avoid inf).
fn factorial_val(n: u64) -> f64 {
    if n > 170 { return f64::INFINITY; }
    (1..=n).fold(1.0_f64, |acc, i| acc * i as f64)
}

/// P(n,k) = n! / (n-k)!
fn permutation_val(n: u64, k: u64) -> f64 {
    if k > n { return 0.0; }
    ((n - k + 1)..=n).fold(1.0_f64, |acc, i| acc * i as f64)
}

/// C(n,k) = n! / (k! * (n-k)!)
fn combination(n: u64, k: u64) -> f64 {
    if k > n { return 0.0; }
    let k = k.min(n - k); // symmetry optimisation
    let mut result = 1.0_f64;
    for i in 0..k {
        result *= (n - i) as f64;
        result /= (i + 1) as f64;
    }
    result
}

fn data_point_count(input: Option<&Value>) -> Value {
    match input {
        None => Value::error("No data"),
        Some(Value::Error { message }) => Value::error(message.clone()),
        Some(Value::Vector { value }) => Value::scalar(value.len() as f64),
        Some(Value::Table { rows, .. }) => Value::scalar(rows.len() as f64),
        Some(_) => Value::error("Expected vector or table"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_inputs(pairs: &[(&str, f64)]) -> HashMap<String, Value> {
        pairs.iter().map(|(k, v)| (k.to_string(), Value::scalar(*v))).collect()
    }

    #[test]
    fn number_block() {
        let mut data = HashMap::new();
        data.insert("value".into(), serde_json::json!(42.0));
        let v = evaluate_node("number", &HashMap::new(), &data);
        assert_eq!(v.as_scalar(), Some(42.0));
    }

    #[test]
    fn add_block() {
        let inputs = make_inputs(&[("a", 3.0), ("b", 4.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(7.0));
    }

    #[test]
    fn divide_by_zero() {
        let inputs = make_inputs(&[("a", 1.0), ("b", 0.0)]);
        let v = evaluate_node("divide", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(f64::INFINITY));
    }

    #[test]
    fn missing_input_produces_nan() {
        let v = evaluate_node("add", &HashMap::new(), &HashMap::new());
        assert!(v.as_scalar().unwrap().is_nan());
    }

    #[test]
    fn unknown_block_returns_error() {
        let v = evaluate_node("bogus", &HashMap::new(), &HashMap::new());
        matches!(v, Value::Error { .. });
    }

    #[test]
    fn sin_block() {
        let inputs = make_inputs(&[("a", 0.0)]);
        let v = evaluate_node("sin", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.0).abs() < 1e-10);
    }

    #[test]
    fn display_passthrough() {
        let inputs: HashMap<String, Value> =
            [("value".to_string(), Value::scalar(99.0))].into_iter().collect();
        let v = evaluate_node("display", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(99.0));
    }

    #[test]
    fn euler_constant() {
        let v = evaluate_node("euler", &HashMap::new(), &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::E).abs() < 1e-10);
    }

    #[test]
    fn power_block() {
        let inputs = make_inputs(&[("base", 2.0), ("exp", 3.0)]);
        let v = evaluate_node("power", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(8.0));
    }

    #[test]
    fn atan2_block() {
        let inputs = make_inputs(&[("y", 1.0), ("x", 0.0)]);
        let v = evaluate_node("atan2", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
    }

    #[test]
    fn clamp_block() {
        let inputs = make_inputs(&[("val", 15.0), ("min", 0.0), ("max", 10.0)]);
        let v = evaluate_node("clamp", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn deg_to_rad_block() {
        let inputs = make_inputs(&[("deg", 180.0)]);
        let v = evaluate_node("degToRad", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::PI).abs() < 1e-10);
    }

    #[test]
    fn rad_to_deg_block() {
        let inputs = make_inputs(&[("rad", std::f64::consts::PI)]);
        let v = evaluate_node("radToDeg", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 180.0).abs() < 1e-10);
    }

    #[test]
    fn vector_input_block() {
        let mut data = HashMap::new();
        data.insert("vectorData".into(), serde_json::json!([1.0, 2.0, 3.0]));
        let v = evaluate_node("vectorInput", &HashMap::new(), &data);
        match v {
            Value::Vector { value } => assert_eq!(value, vec![1.0, 2.0, 3.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn table_input_block() {
        let mut data = HashMap::new();
        data.insert(
            "tableData".into(),
            serde_json::json!({
                "columns": ["A", "B"],
                "rows": [[1.0, 4.0], [2.0, 5.0], [3.0, 6.0]]
            }),
        );
        let v = evaluate_node("tableInput", &HashMap::new(), &data);
        match v {
            Value::Table { columns, rows } => {
                assert_eq!(columns, vec!["A", "B"]);
                assert_eq!(rows.len(), 3);
                assert_eq!(rows[0], vec![1.0, 4.0]);
            }
            _ => panic!("Expected Table, got {:?}", v),
        }
    }

    #[test]
    fn table_input_empty() {
        let v = evaluate_node("tableInput", &HashMap::new(), &HashMap::new());
        match v {
            Value::Table { columns, rows } => {
                assert!(columns.is_empty());
                assert!(rows.is_empty());
            }
            _ => panic!("Expected empty Table"),
        }
    }

    #[test]
    fn table_extract_col_block() {
        let table = Value::Table {
            columns: vec!["X".into(), "Y".into()],
            rows: vec![vec![10.0, 20.0], vec![30.0, 40.0]],
        };
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), table);
        inputs.insert("index".into(), Value::scalar(1.0));
        let v = evaluate_node("table_extract_col", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![20.0, 40.0]),
            _ => panic!("Expected Vector, got {:?}", v),
        }
    }

    #[test]
    fn table_extract_col_default_index() {
        let table = Value::Table {
            columns: vec!["A".into()],
            rows: vec![vec![7.0], vec![8.0]],
        };
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), table);
        let v = evaluate_node("table_extract_col", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![7.0, 8.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn table_extract_col_no_table() {
        let v = evaluate_node("table_extract_col", &HashMap::new(), &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn material_full_basic() {
        let mut data = HashMap::new();
        data.insert(
            "materialProperties".into(),
            serde_json::json!({ "rho": 7850.0, "E": 200e9, "nu": 0.26 }),
        );
        let v = evaluate_node("material_full", &HashMap::new(), &data);
        match v {
            Value::Table { columns, rows } => {
                assert_eq!(columns, vec!["rho", "E", "nu"]);
                assert_eq!(rows.len(), 1);
                assert_eq!(rows[0], vec![7850.0, 200e9, 0.26]);
            }
            _ => panic!("Expected Table, got {:?}", v),
        }
    }

    #[test]
    fn material_full_no_selection() {
        let v = evaluate_node("material_full", &HashMap::new(), &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn material_full_empty_properties() {
        let mut data = HashMap::new();
        data.insert("materialProperties".into(), serde_json::json!({}));
        let v = evaluate_node("material_full", &HashMap::new(), &data);
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn material_full_canonical_order() {
        // Properties should be in canonical order regardless of insertion order
        let mut data = HashMap::new();
        data.insert(
            "materialProperties".into(),
            serde_json::json!({ "mu": 1.0e-3, "rho": 998.0, "k": 0.6, "cp": 4182.0 }),
        );
        let v = evaluate_node("material_full", &HashMap::new(), &data);
        match v {
            Value::Table { columns, .. } => {
                assert_eq!(columns, vec!["rho", "k", "cp", "mu"]);
            }
            _ => panic!("Expected Table"),
        }
    }

    #[test]
    fn vector_sum_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![1.0, 2.0, 3.0, 4.0] });
        let v = evaluate_node("vectorSum", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn vector_mean_empty() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![] });
        let v = evaluate_node("vectorMean", &inputs, &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "Mean: empty vector"),
            _ => panic!("Expected Error"),
        }
    }

    #[test]
    fn vector_sort_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("vec".into(), Value::Vector { value: vec![3.0, 1.0, 2.0] });
        let v = evaluate_node("vectorSort", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![1.0, 2.0, 3.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn plot_point_count() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("data".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("xyPlot", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(3.0));
    }

    #[test]
    fn plot_no_data() {
        let v = evaluate_node("histogram", &HashMap::new(), &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "No data"),
            _ => panic!("Expected Error"),
        }
    }

    #[test]
    fn list_table_passthrough_vector() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "data".into(),
            Value::Vector {
                value: vec![1.0, 2.0, 3.0],
            },
        );
        let v = evaluate_node("listTable", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![1.0, 2.0, 3.0]),
            _ => panic!("Expected Vector passthrough"),
        }
    }

    #[test]
    fn list_table_no_data() {
        let v = evaluate_node("listTable", &HashMap::new(), &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "No data"),
            _ => panic!("Expected Error"),
        }
    }

    // ── W9.3: Broadcasting tests ─────────────────────────────────

    #[test]
    fn add_scalar_plus_vector() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(10.0));
        inputs.insert("b".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![11.0, 12.0, 13.0]),
            _ => panic!("Expected Vector, got {:?}", v),
        }
    }

    #[test]
    fn multiply_vector_times_scalar() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![2.0, 4.0, 6.0] });
        inputs.insert("b".into(), Value::scalar(3.0));
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![6.0, 12.0, 18.0]),
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn add_vector_length_mismatch_pads_nan() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![1.0, 2.0] });
        inputs.insert(
            "b".into(),
            Value::Vector {
                value: vec![10.0, 20.0, 30.0],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value.len(), 3);
                assert!((value[0] - 11.0).abs() < 1e-10);
                assert!((value[1] - 22.0).abs() < 1e-10);
                assert!(value[2].is_nan()); // 3rd element: NaN + 30.0 = NaN
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn multiply_vector_length_mismatch_pads_nan() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "a".into(),
            Value::Vector {
                value: vec![2.0, 4.0, 6.0],
            },
        );
        inputs.insert("b".into(), Value::Vector { value: vec![3.0] });
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value.len(), 3);
                assert!((value[0] - 6.0).abs() < 1e-10);
                assert!(value[1].is_nan());
                assert!(value[2].is_nan());
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn vector_same_length_unchanged() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "a".into(),
            Value::Vector {
                value: vec![1.0, 2.0, 3.0],
            },
        );
        inputs.insert(
            "b".into(),
            Value::Vector {
                value: vec![10.0, 20.0, 30.0],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value, vec![11.0, 22.0, 33.0]);
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn vector_empty_plus_vector_pads_all_nan() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![] });
        inputs.insert(
            "b".into(),
            Value::Vector {
                value: vec![1.0, 2.0],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value.len(), 2);
                assert!(value[0].is_nan());
                assert!(value[1].is_nan());
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn vector_both_empty_returns_empty() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![] });
        inputs.insert("b".into(), Value::Vector { value: vec![] });
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert!(value.is_empty());
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn subtract_vector_mismatch_pads_nan() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "a".into(),
            Value::Vector {
                value: vec![10.0, 20.0, 30.0, 40.0],
            },
        );
        inputs.insert(
            "b".into(),
            Value::Vector {
                value: vec![1.0, 2.0],
            },
        );
        let v = evaluate_node("subtract", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value.len(), 4);
                assert!((value[0] - 9.0).abs() < 1e-10);
                assert!((value[1] - 18.0).abs() < 1e-10);
                assert!(value[2].is_nan());
                assert!(value[3].is_nan());
            }
            other => panic!("expected Vector, got {:?}", other),
        }
    }

    #[test]
    fn sin_of_vector() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "a".into(),
            Value::Vector {
                value: vec![0.0, std::f64::consts::FRAC_PI_2],
            },
        );
        let v = evaluate_node("sin", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert!((value[0] - 0.0).abs() < 1e-10);
                assert!((value[1] - 1.0).abs() < 1e-10);
            }
            _ => panic!("Expected Vector"),
        }
    }

    #[test]
    fn add_scalar_plus_table() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(100.0));
        inputs.insert(
            "b".into(),
            Value::Table {
                columns: vec!["X".into(), "Y".into()],
                rows: vec![vec![1.0, 2.0], vec![3.0, 4.0]],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Table { rows, .. } => {
                assert_eq!(rows, vec![vec![101.0, 102.0], vec![103.0, 104.0]]);
            }
            _ => panic!("Expected Table"),
        }
    }

    #[test]
    fn vector_cross_table_is_error() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![1.0] });
        inputs.insert(
            "b".into(),
            Value::Table {
                columns: vec!["X".into()],
                rows: vec![vec![1.0]],
            },
        );
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn nan_canonicalization() {
        // Missing inputs default to NaN → result should be canonical NaN
        let v = evaluate_node("add", &HashMap::new(), &HashMap::new());
        match v {
            Value::Scalar { value } => {
                assert!(value.is_nan());
                assert_eq!(value.to_bits(), f64::NAN.to_bits());
            }
            _ => panic!("Expected Scalar"),
        }
    }

    #[test]
    fn negative_zero_normalized() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::scalar(0.0));
        inputs.insert("b".into(), Value::scalar(0.0));
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        match v {
            Value::Scalar { value } => {
                // 0 * 0 = 0, canonicalized to +0
                assert_eq!(value.to_bits(), 0.0_f64.to_bits());
            }
            _ => panic!("Expected Scalar"),
        }
    }

    #[test]
    fn power_broadcasts() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "base".into(),
            Value::Vector { value: vec![2.0, 3.0, 4.0] },
        );
        inputs.insert("exp".into(), Value::scalar(2.0));
        let v = evaluate_node("power", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![4.0, 9.0, 16.0]),
            _ => panic!("Expected Vector, got {:?}", v),
        }
    }

    #[test]
    fn deg_to_rad_broadcasts() {
        let mut inputs = HashMap::new();
        inputs.insert(
            "deg".into(),
            Value::Vector { value: vec![0.0, 90.0, 180.0] },
        );
        let v = evaluate_node("degToRad", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert!((value[0] - 0.0).abs() < 1e-10);
                assert!((value[1] - std::f64::consts::FRAC_PI_2).abs() < 1e-10);
                assert!((value[2] - std::f64::consts::PI).abs() < 1e-10);
            }
            _ => panic!("Expected Vector"),
        }
    }

    // ── W11a: Engineering ops tests ──────────────────────────────

    #[test]
    fn eng_force_ma() {
        let inputs = make_inputs(&[("m", 10.0), ("a", 3.0)]);
        let v = evaluate_node("eng.mechanics.force_ma", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(30.0));
    }

    #[test]
    fn eng_weight_mg() {
        let inputs = make_inputs(&[("m", 5.0), ("g", 9.80665)]);
        let v = evaluate_node("eng.mechanics.weight_mg", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 49.03325).abs() < 1e-6);
    }

    #[test]
    fn eng_v_from_uat() {
        let inputs = make_inputs(&[("u", 10.0), ("a", 2.0), ("t", 5.0)]);
        let v = evaluate_node("eng.mechanics.v_from_uat", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0));
    }

    #[test]
    fn eng_s_from_ut_a_t() {
        let inputs = make_inputs(&[("u", 0.0), ("t", 4.0), ("a", 10.0)]);
        let v = evaluate_node("eng.mechanics.s_from_ut_a_t", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(80.0)); // 0*4 + 0.5*10*16
    }

    #[test]
    fn eng_v2_from_u2_as() {
        let inputs = make_inputs(&[("u", 3.0), ("a", 4.0), ("s", 2.0)]);
        let v = evaluate_node("eng.mechanics.v2_from_u2_as", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 5.0).abs() < 1e-10); // sqrt(9+16)=5
    }

    #[test]
    fn eng_v2_negative_discriminant() {
        let inputs = make_inputs(&[("u", 1.0), ("a", -2.0), ("s", 1.0)]);
        let v = evaluate_node("eng.mechanics.v2_from_u2_as", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. })); // 1 + 2*(-2)*1 = -3
    }

    #[test]
    fn eng_kinetic_energy() {
        let inputs = make_inputs(&[("m", 2.0), ("v", 3.0)]);
        let v = evaluate_node("eng.mechanics.kinetic_energy", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(9.0)); // 0.5*2*9
    }

    #[test]
    fn eng_power_work_time() {
        let inputs = make_inputs(&[("W", 100.0), ("t", 5.0)]);
        let v = evaluate_node("eng.mechanics.power_work_time", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0));
    }

    #[test]
    fn eng_power_work_time_zero() {
        let inputs = make_inputs(&[("W", 100.0), ("t", 0.0)]);
        let v = evaluate_node("eng.mechanics.power_work_time", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_centripetal_acc() {
        let inputs = make_inputs(&[("v", 10.0), ("r", 5.0)]);
        let v = evaluate_node("eng.mechanics.centripetal_acc", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0)); // 100/5
    }

    #[test]
    fn eng_centripetal_r_zero() {
        let inputs = make_inputs(&[("v", 10.0), ("r", 0.0)]);
        let v = evaluate_node("eng.mechanics.centripetal_acc", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_omega_from_rpm() {
        let inputs = make_inputs(&[("rpm", 60.0)]);
        let v = evaluate_node("eng.mechanics.omega_from_rpm", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::TAU).abs() < 1e-10);
    }

    #[test]
    fn eng_stress_f_a() {
        let inputs = make_inputs(&[("F", 1000.0), ("A", 0.01)]);
        let v = evaluate_node("eng.materials.stress_F_A", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(100_000.0));
    }

    #[test]
    fn eng_stress_zero_area() {
        let inputs = make_inputs(&[("F", 1000.0), ("A", 0.0)]);
        let v = evaluate_node("eng.materials.stress_F_A", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_youngs_modulus() {
        let inputs = make_inputs(&[("sigma", 200e6), ("epsilon", 0.001)]);
        let v = evaluate_node("eng.materials.youngs_modulus", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 200e9).abs() < 1e3);
    }

    #[test]
    fn eng_spring_force() {
        let inputs = make_inputs(&[("k", 500.0), ("x", 0.1)]);
        let v = evaluate_node("eng.materials.spring_force_kx", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(50.0));
    }

    #[test]
    fn eng_area_circle() {
        let inputs = make_inputs(&[("d", 2.0)]);
        let v = evaluate_node("eng.sections.area_circle", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::PI).abs() < 1e-10);
    }

    #[test]
    fn eng_area_annulus() {
        let inputs = make_inputs(&[("d_outer", 2.0), ("d_inner", 1.0)]);
        let v = evaluate_node("eng.sections.area_annulus", &inputs, &HashMap::new());
        let expected = std::f64::consts::PI * (4.0 - 1.0) / 4.0;
        assert!((v.as_scalar().unwrap() - expected).abs() < 1e-10);
    }

    #[test]
    fn eng_area_annulus_negative() {
        let inputs = make_inputs(&[("d_outer", 1.0), ("d_inner", 2.0)]);
        let v = evaluate_node("eng.sections.area_annulus", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_i_rect() {
        let inputs = make_inputs(&[("b", 0.1), ("h", 0.2)]);
        let v = evaluate_node("eng.sections.I_rect", &inputs, &HashMap::new());
        let expected = 0.1 * 0.008 / 12.0; // b*h^3/12
        assert!((v.as_scalar().unwrap() - expected).abs() < 1e-15);
    }

    #[test]
    fn eng_bending_stress_zero_i() {
        let inputs = make_inputs(&[("M", 100.0), ("y", 0.05), ("I", 0.0)]);
        let v = evaluate_node("eng.sections.bending_stress", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_solid_cylinder() {
        let inputs = make_inputs(&[("m", 10.0), ("r", 0.5)]);
        let v = evaluate_node("eng.inertia.solid_cylinder", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.25)); // 0.5*10*0.25
    }

    #[test]
    fn eng_solid_sphere() {
        let inputs = make_inputs(&[("m", 10.0), ("r", 1.0)]);
        let v = evaluate_node("eng.inertia.solid_sphere", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(4.0)); // 0.4*10*1
    }

    #[test]
    fn eng_reynolds() {
        let inputs = make_inputs(&[("rho", 1000.0), ("v", 1.0), ("D", 0.05), ("mu", 0.001)]);
        let v = evaluate_node("eng.fluids.reynolds", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(50_000.0));
    }

    #[test]
    fn eng_reynolds_zero_mu() {
        let inputs = make_inputs(&[("rho", 1000.0), ("v", 1.0), ("D", 0.05), ("mu", 0.0)]);
        let v = evaluate_node("eng.fluids.reynolds", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_dynamic_pressure() {
        let inputs = make_inputs(&[("rho", 1.225), ("v", 100.0)]);
        let v = evaluate_node("eng.fluids.dynamic_pressure", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 6125.0).abs() < 1e-6);
    }

    #[test]
    fn eng_ideal_gas_p() {
        let inputs = make_inputs(&[("n", 1.0), ("R", 8.314), ("T", 273.15), ("V", 0.02241)]);
        let v = evaluate_node("eng.thermo.ideal_gas_P", &inputs, &HashMap::new());
        let expected = 1.0 * 8.314 * 273.15 / 0.02241;
        assert!((v.as_scalar().unwrap() - expected).abs() < 1.0);
    }

    #[test]
    fn eng_ideal_gas_v_zero() {
        let inputs = make_inputs(&[("n", 1.0), ("R", 8.314), ("T", 300.0), ("V", 0.0)]);
        let v = evaluate_node("eng.thermo.ideal_gas_P", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_heat_q_mcdt() {
        let inputs = make_inputs(&[("m", 1.0), ("c", 4186.0), ("dT", 10.0)]);
        let v = evaluate_node("eng.thermo.heat_Q_mcDT", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(41860.0));
    }

    #[test]
    fn eng_ohms_v() {
        let inputs = make_inputs(&[("I", 2.0), ("R", 100.0)]);
        let v = evaluate_node("eng.elec.ohms_V", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(200.0));
    }

    #[test]
    fn eng_power_i2r() {
        let inputs = make_inputs(&[("I", 3.0), ("R", 10.0)]);
        let v = evaluate_node("eng.elec.power_I2R", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(90.0));
    }

    #[test]
    fn eng_power_v2r_zero() {
        let inputs = make_inputs(&[("V", 12.0), ("R", 0.0)]);
        let v = evaluate_node("eng.elec.power_V2R", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_conv_mm_to_m() {
        let inputs = make_inputs(&[("mm", 1500.0)]);
        let v = evaluate_node("eng.conv.mm_to_m", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.5));
    }

    #[test]
    fn eng_conv_bar_to_pa() {
        let inputs = make_inputs(&[("bar", 1.0)]);
        let v = evaluate_node("eng.conv.bar_to_pa", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(100_000.0));
    }

    #[test]
    fn eng_conv_lpm_to_m3s() {
        let inputs = make_inputs(&[("lpm", 60_000.0)]);
        let v = evaluate_node("eng.conv.lpm_to_m3s", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.0));
    }

    // ── E5-3: New engineering ops ──────────────────────────────────

    #[test]
    fn eng_friction_force() {
        let inputs = make_inputs(&[("mu", 0.3), ("N", 100.0)]);
        let v = evaluate_node("eng.mechanics.friction_force", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 30.0).abs() < 1e-10);
    }

    #[test]
    fn eng_impulse() {
        let inputs = make_inputs(&[("F", 50.0), ("dt", 0.2)]);
        let v = evaluate_node("eng.mechanics.impulse", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 10.0).abs() < 1e-10);
    }

    #[test]
    fn eng_buoyancy() {
        // F = ρ * V * g = 1000 * 0.5 * 9.81 = 4905
        let inputs = make_inputs(&[("rho", 1000.0), ("V", 0.5), ("g", 9.81)]);
        let v = evaluate_node("eng.fluids.buoyancy", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 4905.0).abs() < 1e-10);
    }

    #[test]
    fn eng_carnot_efficiency() {
        // η = 1 - 300/600 = 0.5
        let inputs = make_inputs(&[("T_cold", 300.0), ("T_hot", 600.0)]);
        let v = evaluate_node("eng.thermo.carnot_efficiency", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.5).abs() < 1e-10);
    }

    #[test]
    fn eng_carnot_zero_hot() {
        let inputs = make_inputs(&[("T_cold", 300.0), ("T_hot", 0.0)]);
        let v = evaluate_node("eng.thermo.carnot_efficiency", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_thermal_expansion() {
        // ΔL = 12e-6 * 2.0 * 50 = 0.0012
        let inputs = make_inputs(&[("alpha", 12e-6), ("L", 2.0), ("dT", 50.0)]);
        let v = evaluate_node("eng.thermo.thermal_expansion", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.0012).abs() < 1e-10);
    }

    #[test]
    fn eng_capacitance_q_v() {
        // C = 0.01 / 5.0 = 0.002
        let inputs = make_inputs(&[("Q", 0.01), ("V", 5.0)]);
        let v = evaluate_node("eng.elec.capacitance_Q_V", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.002).abs() < 1e-10);
    }

    #[test]
    fn eng_capacitance_zero_v() {
        let inputs = make_inputs(&[("Q", 0.01), ("V", 0.0)]);
        let v = evaluate_node("eng.elec.capacitance_Q_V", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn eng_series_resistance() {
        let inputs = make_inputs(&[("R1", 100.0), ("R2", 200.0)]);
        let v = evaluate_node("eng.elec.series_resistance", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(300.0));
    }

    #[test]
    fn eng_parallel_resistance() {
        // R = (100 * 200) / (100 + 200) = 20000/300 ≈ 66.667
        let inputs = make_inputs(&[("R1", 100.0), ("R2", 200.0)]);
        let v = evaluate_node("eng.elec.parallel_resistance", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 200.0 / 3.0).abs() < 1e-10);
    }

    #[test]
    fn eng_parallel_resistance_zero_sum() {
        let inputs = make_inputs(&[("R1", 0.0), ("R2", 0.0)]);
        let v = evaluate_node("eng.elec.parallel_resistance", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    // ── W11b: Finance / Stats / Probability tests ─────────────────

    #[test]
    fn fin_simple_interest() {
        let inputs = make_inputs(&[("P", 1000.0), ("r", 0.05), ("t", 3.0)]);
        let v = evaluate_node("fin.tvm.simple_interest", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 150.0).abs() < 1e-10);
    }

    #[test]
    fn fin_compound_fv() {
        // FV = 1000*(1+0.05/12)^(12*10) ≈ 1647.01
        let inputs = make_inputs(&[("PV", 1000.0), ("r", 0.05), ("n", 12.0), ("t", 10.0)]);
        let v = evaluate_node("fin.tvm.compound_fv", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1647.0095).abs() < 0.01);
    }

    #[test]
    fn fin_compound_pv() {
        let inputs = make_inputs(&[("FV", 1647.01), ("r", 0.05), ("n", 12.0), ("t", 10.0)]);
        let v = evaluate_node("fin.tvm.compound_pv", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1000.0).abs() < 0.01);
    }

    #[test]
    fn fin_compound_fv_n_zero() {
        let inputs = make_inputs(&[("PV", 1000.0), ("r", 0.05), ("n", 0.0), ("t", 10.0)]);
        let v = evaluate_node("fin.tvm.compound_fv", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn fin_continuous_fv() {
        // FV = 1000 * e^(0.05*10) ≈ 1648.72
        let inputs = make_inputs(&[("PV", 1000.0), ("r", 0.05), ("t", 10.0)]);
        let v = evaluate_node("fin.tvm.continuous_fv", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1648.72).abs() < 0.01);
    }

    #[test]
    fn fin_annuity_pv() {
        // PMT=100, r=0.05, n=10: PV = 100*(1-(1.05)^-10)/0.05 ≈ 772.17
        let inputs = make_inputs(&[("PMT", 100.0), ("r", 0.05), ("n", 10.0)]);
        let v = evaluate_node("fin.tvm.annuity_pv", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 772.17).abs() < 0.01);
    }

    #[test]
    fn fin_annuity_pv_zero_rate() {
        let inputs = make_inputs(&[("PMT", 100.0), ("r", 0.0), ("n", 10.0)]);
        let v = evaluate_node("fin.tvm.annuity_pv", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1000.0));
    }

    #[test]
    fn fin_annuity_fv() {
        // PMT=100, r=0.05, n=10: FV = 100*((1.05)^10-1)/0.05 ≈ 1257.79
        let inputs = make_inputs(&[("PMT", 100.0), ("r", 0.05), ("n", 10.0)]);
        let v = evaluate_node("fin.tvm.annuity_fv", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1257.79).abs() < 0.01);
    }

    #[test]
    fn fin_annuity_pmt() {
        // PV=772.17, r=0.05, n=10 → PMT ≈ 100
        let inputs = make_inputs(&[("PV", 772.17), ("r", 0.05), ("n", 10.0)]);
        let v = evaluate_node("fin.tvm.annuity_pmt", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 100.0).abs() < 0.01);
    }

    #[test]
    fn fin_npv() {
        // r=0.1, CFs=[-100, 50, 60, 70] → NPV ≈ 46.07
        let inputs = make_inputs(&[("r", 0.1), ("c", 4.0), ("cf0", -100.0), ("cf1", 50.0), ("cf2", 60.0), ("cf3", 70.0)]);
        let v = evaluate_node("fin.tvm.npv", &inputs, &HashMap::new());
        let expected = -100.0 + 50.0/1.1 + 60.0/1.21 + 70.0/1.331;
        assert!((v.as_scalar().unwrap() - expected).abs() < 0.01);
    }

    #[test]
    fn fin_rule_of_72() {
        let inputs = make_inputs(&[("r", 0.06)]);
        let v = evaluate_node("fin.tvm.rule_of_72", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(12.0));
    }

    #[test]
    fn fin_rule_of_72_zero() {
        let inputs = make_inputs(&[("r", 0.0)]);
        let v = evaluate_node("fin.tvm.rule_of_72", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn fin_effective_rate() {
        // EAR = (1 + 0.12/12)^12 - 1 ≈ 0.12683
        let inputs = make_inputs(&[("r", 0.12), ("n", 12.0)]);
        let v = evaluate_node("fin.tvm.effective_rate", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.12683).abs() < 0.0001);
    }

    #[test]
    fn fin_pct_return() {
        let inputs = make_inputs(&[("v0", 100.0), ("v1", 120.0)]);
        let v = evaluate_node("fin.returns.pct_return", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(0.2));
    }

    #[test]
    fn fin_pct_return_zero() {
        let inputs = make_inputs(&[("v0", 0.0), ("v1", 120.0)]);
        let v = evaluate_node("fin.returns.pct_return", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn fin_log_return() {
        let inputs = make_inputs(&[("v0", 100.0), ("v1", 110.0)]);
        let v = evaluate_node("fin.returns.log_return", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - (1.1_f64).ln()).abs() < 1e-10);
    }

    #[test]
    fn fin_cagr() {
        // CAGR: v0=100, v1=200, t=7 → (2)^(1/7)-1 ≈ 0.10409
        let inputs = make_inputs(&[("v0", 100.0), ("v1", 200.0), ("t", 7.0)]);
        let v = evaluate_node("fin.returns.cagr", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.10409).abs() < 0.0001);
    }

    #[test]
    fn fin_sharpe() {
        let inputs = make_inputs(&[("ret", 0.12), ("rf", 0.02), ("sigma", 0.15)]);
        let v = evaluate_node("fin.returns.sharpe", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.6667).abs() < 0.001);
    }

    #[test]
    fn fin_sharpe_zero_sigma() {
        let inputs = make_inputs(&[("ret", 0.12), ("rf", 0.02), ("sigma", 0.0)]);
        let v = evaluate_node("fin.returns.sharpe", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn fin_portfolio_variance() {
        // w1=0.6, w2=0.4, σ1=0.15, σ2=0.20, ρ=0.3
        let inputs = make_inputs(&[("w1", 0.6), ("w2", 0.4), ("s1", 0.15), ("s2", 0.20), ("rho", 0.3)]);
        let v = evaluate_node("fin.returns.portfolio_variance", &inputs, &HashMap::new());
        let expected = 0.36*0.0225 + 0.16*0.04 + 2.0*0.6*0.4*0.3*0.15*0.20;
        assert!((v.as_scalar().unwrap() - expected).abs() < 1e-10);
    }

    #[test]
    fn fin_sl_depreciation() {
        let inputs = make_inputs(&[("cost", 10000.0), ("salvage", 2000.0), ("life", 5.0)]);
        let v = evaluate_node("fin.depr.straight_line", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1600.0));
    }

    #[test]
    fn fin_sl_depreciation_zero_life() {
        let inputs = make_inputs(&[("cost", 10000.0), ("salvage", 2000.0), ("life", 0.0)]);
        let v = evaluate_node("fin.depr.straight_line", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn fin_db_depreciation() {
        // DB: cost=10000, salvage=1000, life=5, period=1
        let inputs = make_inputs(&[("cost", 10000.0), ("salvage", 1000.0), ("life", 5.0), ("period", 1.0)]);
        let v = evaluate_node("fin.depr.declining_balance", &inputs, &HashMap::new());
        // rate = 1 - (1000/10000)^(1/5) ≈ 0.36904
        // bv_start = 10000 * (1 - rate)^0 = 10000
        // depr = 10000 * rate ≈ 3690.4
        let rate = 1.0 - (0.1_f64).powf(0.2);
        assert!((v.as_scalar().unwrap() - 10000.0 * rate).abs() < 0.01);
    }

    #[test]
    fn stats_mean() {
        let inputs = make_inputs(&[("c", 3.0), ("x1", 10.0), ("x2", 20.0), ("x3", 30.0)]);
        let v = evaluate_node("stats.desc.mean", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0));
    }

    #[test]
    fn stats_median_odd() {
        let inputs = make_inputs(&[("c", 3.0), ("x1", 30.0), ("x2", 10.0), ("x3", 20.0)]);
        let v = evaluate_node("stats.desc.median", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0));
    }

    #[test]
    fn stats_median_even() {
        let inputs = make_inputs(&[("c", 4.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("x4", 4.0)]);
        let v = evaluate_node("stats.desc.median", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(2.5));
    }

    #[test]
    fn stats_range() {
        let inputs = make_inputs(&[("c", 4.0), ("x1", 5.0), ("x2", 2.0), ("x3", 8.0), ("x4", 1.0)]);
        let v = evaluate_node("stats.desc.range", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(7.0));
    }

    #[test]
    fn stats_variance() {
        // values: 2, 4, 4, 4, 5, 5, 7, 9 → but we only have 6 slots
        // Use: 2, 4, 4, 5, 5, 7 → mean=4.5, var = mean of (2.5^2, 0.5^2, 0.5^2, 0.5^2, 0.5^2, 2.5^2) / 6
        let inputs = make_inputs(&[("c", 3.0), ("x1", 2.0), ("x2", 4.0), ("x3", 6.0)]);
        let v = evaluate_node("stats.desc.variance", &inputs, &HashMap::new());
        // mean=4, var = (4+0+4)/3 = 8/3 ≈ 2.6667
        assert!((v.as_scalar().unwrap() - 8.0/3.0).abs() < 1e-10);
    }

    #[test]
    fn stats_stddev() {
        let inputs = make_inputs(&[("c", 3.0), ("x1", 2.0), ("x2", 4.0), ("x3", 6.0)]);
        let v = evaluate_node("stats.desc.stddev", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - (8.0_f64/3.0).sqrt()).abs() < 1e-10);
    }

    #[test]
    fn stats_sum() {
        let inputs = make_inputs(&[("c", 4.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("x4", 4.0)]);
        let v = evaluate_node("stats.desc.sum", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn stats_geo_mean() {
        // geo_mean(2, 8) = sqrt(16) = 4
        let inputs = make_inputs(&[("c", 2.0), ("x1", 2.0), ("x2", 8.0)]);
        let v = evaluate_node("stats.desc.geo_mean", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(4.0));
    }

    #[test]
    fn stats_geo_mean_negative() {
        let inputs = make_inputs(&[("c", 2.0), ("x1", -2.0), ("x2", 8.0)]);
        let v = evaluate_node("stats.desc.geo_mean", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn stats_zscore() {
        let inputs = make_inputs(&[("x", 85.0), ("mu", 70.0), ("sigma", 10.0)]);
        let v = evaluate_node("stats.desc.zscore", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.5));
    }

    #[test]
    fn stats_zscore_zero_sigma() {
        let inputs = make_inputs(&[("x", 85.0), ("mu", 70.0), ("sigma", 0.0)]);
        let v = evaluate_node("stats.desc.zscore", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn stats_covariance() {
        // X=[1,2,3], Y=[2,4,6] → cov = mean of [(1-2)(2-4), (2-2)(4-4), (3-2)(6-4)] = mean of [2,0,2] = 4/3
        let inputs = make_inputs(&[("c", 3.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("y1", 2.0), ("y2", 4.0), ("y3", 6.0)]);
        let v = evaluate_node("stats.rel.covariance", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 4.0/3.0).abs() < 1e-10);
    }

    #[test]
    fn stats_correlation_perfect() {
        let inputs = make_inputs(&[("c", 3.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("y1", 2.0), ("y2", 4.0), ("y3", 6.0)]);
        let v = evaluate_node("stats.rel.correlation", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn stats_linreg_slope() {
        // X=[1,2,3], Y=[2,4,6] → slope=2
        let inputs = make_inputs(&[("c", 3.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("y1", 2.0), ("y2", 4.0), ("y3", 6.0)]);
        let v = evaluate_node("stats.rel.linreg_slope", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 2.0).abs() < 1e-10);
    }

    #[test]
    fn stats_linreg_intercept() {
        // X=[1,2,3], Y=[2,4,6] → intercept=0
        let inputs = make_inputs(&[("c", 3.0), ("x1", 1.0), ("x2", 2.0), ("x3", 3.0), ("y1", 2.0), ("y2", 4.0), ("y3", 6.0)]);
        let v = evaluate_node("stats.rel.linreg_intercept", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.0).abs() < 1e-10);
    }

    #[test]
    fn prob_factorial() {
        let inputs = make_inputs(&[("n", 5.0)]);
        let v = evaluate_node("prob.comb.factorial", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(120.0));
    }

    #[test]
    fn prob_factorial_zero() {
        let inputs = make_inputs(&[("n", 0.0)]);
        let v = evaluate_node("prob.comb.factorial", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.0));
    }

    #[test]
    fn prob_permutation() {
        // P(5,2) = 20
        let inputs = make_inputs(&[("n", 5.0), ("k", 2.0)]);
        let v = evaluate_node("prob.comb.permutation", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(20.0));
    }

    #[test]
    fn prob_binomial_pmf() {
        // B(10,3,0.5) = C(10,3)*0.5^3*0.5^7 = 120*0.5^10 ≈ 0.117188
        let inputs = make_inputs(&[("n", 10.0), ("k", 3.0), ("p", 0.5)]);
        let v = evaluate_node("prob.dist.binomial_pmf", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.117188).abs() < 0.0001);
    }

    #[test]
    fn prob_binomial_invalid_p() {
        let inputs = make_inputs(&[("n", 10.0), ("k", 3.0), ("p", 1.5)]);
        let v = evaluate_node("prob.dist.binomial_pmf", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn prob_poisson_pmf() {
        // P(k=2, λ=3) = e^-3 * 9 / 2 ≈ 0.22404
        let inputs = make_inputs(&[("k", 2.0), ("lambda", 3.0)]);
        let v = evaluate_node("prob.dist.poisson_pmf", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.22404).abs() < 0.0001);
    }

    #[test]
    fn prob_exponential_pdf() {
        // f(1, λ=2) = 2*e^-2 ≈ 0.27067
        let inputs = make_inputs(&[("x", 1.0), ("lambda", 2.0)]);
        let v = evaluate_node("prob.dist.exponential_pdf", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.27067).abs() < 0.0001);
    }

    #[test]
    fn prob_exponential_cdf() {
        // F(1, λ=2) = 1 - e^-2 ≈ 0.86466
        let inputs = make_inputs(&[("x", 1.0), ("lambda", 2.0)]);
        let v = evaluate_node("prob.dist.exponential_cdf", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.86466).abs() < 0.0001);
    }

    #[test]
    fn prob_exponential_negative_x() {
        let inputs = make_inputs(&[("x", -1.0), ("lambda", 2.0)]);
        let v = evaluate_node("prob.dist.exponential_pdf", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(0.0));
    }

    #[test]
    fn prob_normal_pdf() {
        // f(0, μ=0, σ=1) = 1/√(2π) ≈ 0.39894
        let inputs = make_inputs(&[("x", 0.0), ("mu", 0.0), ("sigma", 1.0)]);
        let v = evaluate_node("prob.dist.normal_pdf", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 0.39894).abs() < 0.0001);
    }

    #[test]
    fn prob_normal_pdf_zero_sigma() {
        let inputs = make_inputs(&[("x", 0.0), ("mu", 0.0), ("sigma", 0.0)]);
        let v = evaluate_node("prob.dist.normal_pdf", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn util_round_to_dp() {
        let inputs = make_inputs(&[("x", 3.14159), ("dp", 2.0)]);
        let v = evaluate_node("util.round.to_dp", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(3.14));
    }

    #[test]
    fn util_pct_to_decimal() {
        let inputs = make_inputs(&[("pct", 45.0)]);
        let v = evaluate_node("util.pct.to_decimal", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(0.45));
    }

    #[test]
    fn fin_weighted_avg() {
        // values=[10,20,30], weights=[1,2,3] → (10+40+90)/6 = 140/6 ≈ 23.333
        let inputs = make_inputs(&[("c", 3.0), ("x1", 10.0), ("x2", 20.0), ("x3", 30.0), ("y1", 1.0), ("y2", 2.0), ("y3", 3.0)]);
        let v = evaluate_node("fin.returns.weighted_avg", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 140.0/6.0).abs() < 1e-10);
    }

    #[test]
    fn stats_mode_approx() {
        let inputs = make_inputs(&[("c", 5.0), ("x1", 1.0), ("x2", 2.0), ("x3", 2.0), ("x4", 3.0), ("x5", 2.0)]);
        let v = evaluate_node("stats.desc.mode_approx", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(2.0));
    }

    // ── W11c: Constants & Presets (table-driven) ──────────────────

    #[test]
    fn w11c_constants_table_driven() {
        let cases: &[(&str, f64, f64)] = &[
            // Math constants (canonical const.math.* IDs — SCI-01)
            ("const.math.pi",    std::f64::consts::PI,     1e-15),
            ("const.math.e",     std::f64::consts::E,      1e-15),
            ("const.math.tau",   std::f64::consts::TAU,    1e-15),
            ("const.math.phi",   1.618_033_988_749_894_848_2, 1e-15),
            ("const.math.sqrt2", std::f64::consts::SQRT_2, 1e-15),
            ("const.math.ln2",   std::f64::consts::LN_2,   1e-15),
            ("const.math.ln10",  std::f64::consts::LN_10,  1e-15),
            // Physics constants — CODATA 2022 (SCI-01)
            ("const.physics.g0",    9.806_65,                    1e-10),
            ("const.physics.R_molar", 8.314_462_618,             1e-9),
            ("const.physics.R",     8.314_462_618,               1e-9),
            ("const.physics.c",     299_792_458.0,               0.0),
            ("const.physics.h",     6.626_070_15e-34,            1e-43),
            ("const.physics.hbar",  1.054_571_817_646_156_5e-34, 1e-43),
            ("const.physics.kB",    1.380_649e-23,               1e-32),
            ("const.physics.Na",    6.022_140_76e23,             1e14),
            ("const.physics.NA",    6.022_140_76e23,             1e14),
            ("const.physics.qe",    1.602_176_634e-19,           1e-28),
            ("const.physics.e",     1.602_176_634e-19,           1e-28),
            ("const.physics.F",     96_485.332_12,               1e-3),
            ("const.physics.me",    9.109_383_713_9e-31,         1e-40),
            ("const.physics.mp",    1.672_621_925_95e-27,        1e-37),
            ("const.physics.mn",    1.674_927_500_56e-27,        1e-37),
            ("const.physics.G",     6.674_30e-11,                1e-16),
            ("const.physics.mu0",   1.256_637_061_27e-6,         1e-15),
            ("const.physics.eps0",  8.854_187_818_8e-12,         1e-21),
            ("const.physics.sigma_sb", 5.670_374_419e-8,         1e-17),
            ("const.physics.sigma", 5.670_374_419e-8,            1e-17),
            ("const.physics.alpha", 7.297_352_564_3e-3,          1e-16),
            ("const.physics.Ry",    10_973_731.568_157,          1e-3),
            ("const.physics.amu",   1.660_539_068_92e-27,        1e-37),
            ("const.physics.u",     1.660_539_068_92e-27,        1e-37),
            // Atmosphere
            ("const.atmos.p0_pa", 101_325.0, 0.0),
            ("const.atmos.t0_k", 288.15, 0.0),
            ("const.atmos.rho_air_sl", 1.225, 0.0),
            ("const.atmos.gamma_air", 1.4, 0.0),
            ("const.atmos.R_air", 287.05, 0.0),
            ("const.atmos.mu_air_20c", 1.81e-5, 1e-10),
            ("const.atmos.a_air_20c", 343.0, 0.0),
            // Thermo
            ("const.thermo.cp_air", 1005.0, 0.0),
            ("const.thermo.cv_air", 718.0, 0.0),
            ("const.thermo.k_air", 0.0262, 1e-10),
            ("const.thermo.k_water", 0.6, 0.0),
            // Electrical
            ("const.elec.rho_copper", 1.68e-8, 1e-15),
            ("const.elec.rho_aluminium", 2.82e-8, 1e-15),
            // Preset Materials
            ("preset.materials.steel_rho", 7850.0, 0.0),
            ("preset.materials.steel_E", 200e9, 0.0),
            ("preset.materials.steel_nu", 0.30, 0.0),
            ("preset.materials.al_rho", 2700.0, 0.0),
            ("preset.materials.al_E", 69e9, 0.0),
            ("preset.materials.al_nu", 0.33, 1e-10),
            ("preset.materials.ti_rho", 4430.0, 0.0),
            ("preset.materials.ti_E", 116e9, 0.0),
            ("preset.materials.ti_nu", 0.34, 1e-10),
            // Preset Fluids
            ("preset.fluids.water_rho_20c", 998.0, 0.0),
            ("preset.fluids.water_mu_20c", 1.002e-3, 1e-10),
            ("preset.fluids.gasoline_rho", 745.0, 0.0),
            ("preset.fluids.diesel_rho", 832.0, 0.0),
        ];
        for &(op_id, expected, tol) in cases {
            let v = evaluate_node(op_id, &HashMap::new(), &HashMap::new());
            let got = v.as_scalar().unwrap_or(f64::NAN);
            assert!(
                (got - expected).abs() <= tol,
                "{}: expected {} ± {}, got {}",
                op_id, expected, tol, got,
            );
        }
    }

    // ── E5-2: Excel numeric functions ──────────────────────────────────────────

    #[test]
    fn ln_e_is_one() {
        let inputs = make_inputs(&[("a", std::f64::consts::E)]);
        let v = evaluate_node("ln", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn log10_100() {
        let inputs = make_inputs(&[("a", 100.0)]);
        let v = evaluate_node("log10", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 2.0).abs() < 1e-10);
    }

    #[test]
    fn exp_zero_is_one() {
        let inputs = make_inputs(&[("a", 0.0)]);
        let v = evaluate_node("exp", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn exp_one_is_e() {
        let inputs = make_inputs(&[("a", 1.0)]);
        let v = evaluate_node("exp", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - std::f64::consts::E).abs() < 1e-10);
    }

    #[test]
    fn log_base_8_base_2() {
        let inputs = make_inputs(&[("val", 8.0), ("base", 2.0)]);
        let v = evaluate_node("log_base", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 3.0).abs() < 1e-10);
    }

    #[test]
    fn sign_positive() {
        let inputs = make_inputs(&[("a", 42.0)]);
        let v = evaluate_node("sign", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.0));
    }

    #[test]
    fn sign_negative() {
        let inputs = make_inputs(&[("a", -7.0)]);
        let v = evaluate_node("sign", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(-1.0));
    }

    #[test]
    fn sign_zero() {
        let inputs = make_inputs(&[("a", 0.0)]);
        let v = evaluate_node("sign", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(0.0));
    }

    #[test]
    fn trunc_positive() {
        let inputs = make_inputs(&[("a", 3.7)]);
        let v = evaluate_node("trunc", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(3.0));
    }

    #[test]
    fn trunc_negative() {
        let inputs = make_inputs(&[("a", -3.7)]);
        let v = evaluate_node("trunc", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(-3.0));
    }

    #[test]
    fn roundn_two_digits() {
        let inputs = make_inputs(&[("val", 3.14159), ("digits", 2.0)]);
        let v = evaluate_node("roundn", &inputs, &HashMap::new());
        assert!((v.as_scalar().unwrap() - 3.14).abs() < 1e-10);
    }

    #[test]
    fn roundn_zero_digits() {
        let inputs = make_inputs(&[("val", 3.7), ("digits", 0.0)]);
        let v = evaluate_node("roundn", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(4.0));
    }

    #[test]
    fn prob_combination() {
        // C(5,2) = 10
        let inputs = make_inputs(&[("n", 5.0), ("k", 2.0)]);
        let v = evaluate_node("prob.comb.combination", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn prob_combination_k_greater_than_n() {
        let inputs = make_inputs(&[("n", 3.0), ("k", 5.0)]);
        let v = evaluate_node("prob.comb.combination", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
    }

    #[test]
    fn w11c_preset_values_are_positive() {
        let presets = [
            "preset.materials.steel_rho", "preset.materials.steel_E", "preset.materials.steel_nu",
            "preset.materials.al_rho", "preset.materials.al_E", "preset.materials.al_nu",
            "preset.materials.ti_rho", "preset.materials.ti_E", "preset.materials.ti_nu",
            "preset.fluids.water_rho_20c", "preset.fluids.water_mu_20c",
            "preset.fluids.gasoline_rho", "preset.fluids.diesel_rho",
        ];
        for op_id in &presets {
            let v = evaluate_node(op_id, &HashMap::new(), &HashMap::new());
            let got = v.as_scalar().unwrap_or(f64::NAN);
            assert!(got > 0.0, "{}: expected positive, got {}", op_id, got);
        }
    }

    // ── Variadic (n-ary) tests ──────────────────────────────────────

    #[test]
    fn variadic_add_3_inputs() {
        let inputs = make_inputs(&[("in_0", 1.0), ("in_1", 2.0), ("in_2", 3.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(6.0));
    }

    #[test]
    fn variadic_add_5_inputs() {
        let inputs = make_inputs(&[("in_0", 10.0), ("in_1", 20.0), ("in_2", 30.0), ("in_3", 40.0), ("in_4", 50.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(150.0));
    }

    #[test]
    fn variadic_add_falls_back_to_binary() {
        // When using a/b ports (no in_0), should still work
        let inputs = make_inputs(&[("a", 3.0), ("b", 7.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(10.0));
    }

    #[test]
    fn variadic_multiply_3_inputs() {
        let inputs = make_inputs(&[("in_0", 2.0), ("in_1", 3.0), ("in_2", 4.0)]);
        let v = evaluate_node("multiply", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(24.0));
    }

    #[test]
    fn variadic_max_4_inputs() {
        let inputs = make_inputs(&[("in_0", 5.0), ("in_1", 2.0), ("in_2", 8.0), ("in_3", 1.0)]);
        let v = evaluate_node("max", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(8.0));
    }

    #[test]
    fn variadic_min_4_inputs() {
        let inputs = make_inputs(&[("in_0", 5.0), ("in_1", 2.0), ("in_2", 8.0), ("in_3", 1.0)]);
        let v = evaluate_node("min", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(1.0));
    }

    #[test]
    fn variadic_add_scalar_vector_mix() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("in_0".into(), Value::scalar(10.0));
        inputs.insert("in_1".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        inputs.insert("in_2".into(), Value::scalar(100.0));
        let v = evaluate_node("add", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => {
                assert_eq!(value, vec![111.0, 112.0, 113.0]);
            }
            _ => panic!("Expected vector, got {:?}", v),
        }
    }

    #[test]
    fn variadic_add_10_inputs() {
        let mut inputs = HashMap::new();
        for i in 0..10 {
            inputs.insert(format!("in_{}", i), Value::scalar(i as f64 + 1.0));
        }
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(55.0)); // sum of 1..10 = 55
    }

    // ── High-Precision tests (require `high-precision` feature) ──

    #[test]
    #[cfg(feature = "high-precision")]
    fn hp_add_returns_high_precision_value() {
        let inputs = make_inputs(&[("a", 1.5), ("b", 2.5)]);
        let mut data = HashMap::new();
        data.insert("precision".into(), serde_json::json!(50));
        let v = evaluate_node("add", &inputs, &data);
        match &v {
            Value::HighPrecision { approx, precision, .. } => {
                assert!((*approx - 4.0).abs() < 1e-10, "HP approx: {}", approx);
                assert_eq!(*precision, 50);
            }
            _ => panic!("Expected HighPrecision, got {:?}", v),
        }
    }

    #[test]
    #[cfg(feature = "high-precision")]
    fn hp_mul_precision() {
        let inputs = make_inputs(&[("a", 3.0), ("b", 7.0)]);
        let mut data = HashMap::new();
        data.insert("precision".into(), serde_json::json!(20));
        let v = evaluate_node("multiply", &inputs, &data);
        match &v {
            Value::HighPrecision { approx, .. } => {
                assert!((*approx - 21.0).abs() < 1e-10);
            }
            _ => panic!("Expected HighPrecision, got {:?}", v),
        }
    }

    #[test]
    fn hp_falls_back_to_f64_without_precision() {
        // Without data.precision, should use normal f64 path
        let inputs = make_inputs(&[("a", 1.0), ("b", 2.0)]);
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert_eq!(v.as_scalar(), Some(3.0)); // Normal scalar, not HP
    }
}
