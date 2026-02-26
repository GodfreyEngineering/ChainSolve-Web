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
        "number" | "slider" => {
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

        // ── Math (2 inputs: a, b or 1 input: in) ─────────────────
        "add" => binary_broadcast(inputs, |a, b| a + b),
        "subtract" => binary_broadcast(inputs, |a, b| a - b),
        "multiply" => binary_broadcast(inputs, |a, b| a * b),
        "divide" => binary_broadcast(inputs, |a, b| a / b),
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

        // ── Trig ──────────────────────────────────────────────────
        "sin" => unary_broadcast(inputs, |x| x.sin()),
        "cos" => unary_broadcast(inputs, |x| x.cos()),
        "tan" => unary_broadcast(inputs, |x| x.tan()),
        "asin" => unary_broadcast(inputs, |x| x.asin()),
        "acos" => unary_broadcast(inputs, |x| x.acos()),
        "atan" => unary_broadcast(inputs, |x| x.atan()),
        "atan2" => binary_broadcast_ports(inputs, "y", "x", |y, x| y.atan2(x)),
        "degToRad" => unary_broadcast_port(inputs, "deg", |d| d.to_radians()),
        "radToDeg" => unary_broadcast_port(inputs, "rad", |r| r.to_degrees()),

        // ── Logic ─────────────────────────────────────────────────
        "greater" => binary_broadcast(inputs, |a, b| if a > b { 1.0 } else { 0.0 }),
        "less" => binary_broadcast(inputs, |a, b| if a < b { 1.0 } else { 0.0 }),
        "equal" => binary_broadcast(inputs, |a, b| if (a - b).abs() < f64::EPSILON { 1.0 } else { 0.0 }),
        "max" => binary_broadcast(inputs, |a, b| a.max(b)),
        "min" => binary_broadcast(inputs, |a, b| a.min(b)),
        "ifthenelse" => {
            let cond = scalar_or_nan(inputs, "cond");
            let then = scalar_or_nan(inputs, "then");
            let els = scalar_or_nan(inputs, "else");
            Value::scalar(if cond != 0.0 { then } else { els })
        }

        // ── Output (pass-through) ────────────────────────────────
        "display" => {
            inputs
                .get("value")
                .cloned()
                .unwrap_or(Value::scalar(f64::NAN))
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
        "tableInput" => read_table_from_data(data, false),
        "csvImport" => read_table_from_data(data, true),

        // ── Vector ops ──────────────────────────────────────────
        "vectorLength" => match require_vector(inputs, "vec", "Length") {
            Ok(v) => Value::scalar(v.len() as f64),
            Err(e) => e,
        },
        "vectorSum" => match require_vector(inputs, "vec", "Sum") {
            Ok(v) => Value::scalar(v.iter().sum()),
            Err(e) => e,
        },
        "vectorMean" => match require_vector(inputs, "vec", "Mean") {
            Ok(v) if v.is_empty() => Value::error("Mean: empty vector"),
            Ok(v) => Value::scalar(v.iter().sum::<f64>() / v.len() as f64),
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

        // ── Table ops ───────────────────────────────────────────
        "tableFilter" => match require_table(inputs, "table", "Filter") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                let threshold = scalar_or_nan(inputs, "threshold");
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Filter: column index out of range")
                } else if threshold.is_nan() {
                    Value::error("Filter: expected threshold")
                } else {
                    let ci = ci as usize;
                    let filtered: Vec<Vec<f64>> = rows.iter()
                        .filter(|row| row.get(ci).copied().unwrap_or(f64::NAN) > threshold)
                        .cloned()
                        .collect();
                    Value::Table { columns: cols.clone(), rows: filtered }
                }
            }
            Err(e) => e,
        },
        "tableSort" => match require_table(inputs, "table", "Sort") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Sort: column index out of range")
                } else {
                    let ci = ci as usize;
                    let mut sorted = rows.clone();
                    sorted.sort_by(|a, b| {
                        let va = a.get(ci).copied().unwrap_or(0.0);
                        let vb = b.get(ci).copied().unwrap_or(0.0);
                        va.partial_cmp(&vb).unwrap_or(std::cmp::Ordering::Equal)
                    });
                    Value::Table { columns: cols.clone(), rows: sorted }
                }
            }
            Err(e) => e,
        },
        "tableColumn" => match require_table(inputs, "table", "Column") {
            Ok((cols, rows)) => {
                let ci = scalar_or_nan(inputs, "col").floor() as i64;
                if ci < 0 || ci as usize >= cols.len() {
                    Value::error("Column: column index out of range")
                } else {
                    let ci = ci as usize;
                    let values: Vec<f64> = rows.iter()
                        .map(|row| row.get(ci).copied().unwrap_or(f64::NAN))
                        .collect();
                    Value::Vector { value: values }
                }
            }
            Err(e) => e,
        },
        "tableAddColumn" => match require_table(inputs, "table", "AddColumn") {
            Ok((cols, rows)) => match require_vector(inputs, "vec", "AddColumn") {
                Ok(vec) => {
                    let col_name = format!("Col{}", cols.len() + 1);
                    let mut new_cols = cols.clone();
                    new_cols.push(col_name);
                    let max_len = rows.len().max(vec.len());
                    let mut new_rows: Vec<Vec<f64>> = Vec::with_capacity(max_len);
                    for i in 0..max_len {
                        let mut row = if i < rows.len() {
                            rows[i].clone()
                        } else {
                            vec![f64::NAN; cols.len()]
                        };
                        row.push(if i < vec.len() { vec[i] } else { f64::NAN });
                        new_rows.push(row);
                    }
                    Value::Table { columns: new_cols, rows: new_rows }
                }
                Err(e) => e,
            },
            Err(e) => e,
        },
        "tableJoin" => {
            let a = require_table(inputs, "a", "Join");
            let b = require_table(inputs, "b", "Join");
            match (a, b) {
                (Ok((ca, ra)), Ok((cb, rb))) => {
                    let mut new_cols = ca.clone();
                    new_cols.extend(cb.iter().cloned());
                    let max_len = ra.len().max(rb.len());
                    let mut new_rows: Vec<Vec<f64>> = Vec::with_capacity(max_len);
                    for i in 0..max_len {
                        let row_a = if i < ra.len() { ra[i].clone() } else { vec![f64::NAN; ca.len()] };
                        let row_b = if i < rb.len() { rb[i].clone() } else { vec![f64::NAN; cb.len()] };
                        let mut row = row_a;
                        row.extend(row_b);
                        new_rows.push(row);
                    }
                    Value::Table { columns: new_cols, rows: new_rows }
                }
                (Err(e), _) | (_, Err(e)) => e,
            }
        }

        // ── Plot blocks (terminal, return point count) ──────────
        "xyPlot" | "histogram" | "barChart" | "heatmap" => {
            data_point_count(inputs.get("data"))
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

        // ── Engineering → Conversions ────────────────────────────────
        "eng.conv.deg_to_rad" => unary_broadcast_port(inputs, "deg", |d| d.to_radians()),
        "eng.conv.rad_to_deg" => unary_broadcast_port(inputs, "rad", |r| r.to_degrees()),
        "eng.conv.mm_to_m" => unary_broadcast_port(inputs, "mm", |v| v / 1000.0),
        "eng.conv.m_to_mm" => unary_broadcast_port(inputs, "m", |v| v * 1000.0),
        "eng.conv.bar_to_pa" => unary_broadcast_port(inputs, "bar", |v| v * 100_000.0),
        "eng.conv.pa_to_bar" => unary_broadcast_port(inputs, "Pa", |v| v / 100_000.0),
        "eng.conv.lpm_to_m3s" => unary_broadcast_port(inputs, "lpm", |v| v / 60_000.0),
        "eng.conv.m3s_to_lpm" => unary_broadcast_port(inputs, "m3s", |v| v * 60_000.0),

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
            let w_sum: f64 = ys.iter().sum();
            if w_sum == 0.0 {
                Value::error("Weighted avg: weights sum to 0")
            } else {
                let wval: f64 = xs.iter().zip(ys.iter()).map(|(x, w)| x * w).sum();
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
            Value::scalar(
                w1 * w1 * s1 * s1
                + w2 * w2 * s2 * s2
                + 2.0 * w1 * w2 * rho * s1 * s2,
            )
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
            let sum: f64 = xs.iter().sum();
            Value::scalar(sum / count as f64)
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
            let mean = xs.iter().sum::<f64>() / n;
            let var = xs.iter().map(|x| (x - mean) * (x - mean)).sum::<f64>() / n;
            Value::scalar(var)
        }
        "stats.desc.stddev" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let n = count as f64;
            let mean = xs.iter().sum::<f64>() / n;
            let var = xs.iter().map(|x| (x - mean) * (x - mean)).sum::<f64>() / n;
            Value::scalar(var.sqrt())
        }
        "stats.desc.sum" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            Value::scalar(xs.iter().sum())
        }
        "stats.desc.geo_mean" => {
            let count = validated_count(inputs, 1);
            let xs = collect_values(inputs, &X_PORTS, count);
            if xs.iter().any(|&x| x <= 0.0) {
                Value::error("Geo mean: all values must be > 0")
            } else {
                let log_sum: f64 = xs.iter().map(|x| x.ln()).sum();
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
            let mx = xs.iter().sum::<f64>() / n;
            let my = ys.iter().sum::<f64>() / n;
            let cov = xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)).sum::<f64>() / n;
            Value::scalar(cov)
        }
        "stats.rel.correlation" => {
            let count = validated_count(inputs, 2);
            let xs = collect_values(inputs, &X_PORTS, count);
            let ys = collect_values(inputs, &Y_PORTS, count);
            let n = count as f64;
            let mx = xs.iter().sum::<f64>() / n;
            let my = ys.iter().sum::<f64>() / n;
            let cov: f64 = xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)).sum::<f64>() / n;
            let sx = (xs.iter().map(|x| (x - mx).powi(2)).sum::<f64>() / n).sqrt();
            let sy = (ys.iter().map(|y| (y - my).powi(2)).sum::<f64>() / n).sqrt();
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
            let mx = xs.iter().sum::<f64>() / n;
            let my = ys.iter().sum::<f64>() / n;
            let num: f64 = xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)).sum();
            let den: f64 = xs.iter().map(|x| (x - mx).powi(2)).sum();
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
            let mx = xs.iter().sum::<f64>() / n;
            let my = ys.iter().sum::<f64>() / n;
            let num: f64 = xs.iter().zip(ys.iter()).map(|(x, y)| (x - mx) * (y - my)).sum();
            let den: f64 = xs.iter().map(|x| (x - mx).powi(2)).sum();
            if den == 0.0 {
                Value::error("LinReg intercept: zero variance in X")
            } else {
                let slope = num / den;
                Value::scalar(my - slope * mx)
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

        _ => Value::error(format!("Unknown block type: {}", block_type)),
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
        // Vector ⊕ Vector → same length
        (Some(Value::Vector { value: va }), Some(Value::Vector { value: vb })) => {
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

        // Incompatible: Vector ⊕ Table, Table ⊕ Vector, or Error ⊕ None
        (Some(va), Some(vb)) => Value::error(format!(
            "Cannot broadcast {} with {}",
            va.kind_str(),
            vb.kind_str()
        )),
        (Some(Value::Error { message }), None) | (None, Some(Value::Error { message })) => {
            Value::error(message.clone())
        }
    }
}

/// Convenience: binary broadcast on ports "a" and "b".
fn binary_broadcast(
    inputs: &HashMap<String, Value>,
    f: impl Fn(f64, f64) -> f64,
) -> Value {
    binary_broadcast_ports(inputs, "a", "b", f)
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

fn require_table<'a>(
    inputs: &'a HashMap<String, Value>,
    port: &str,
    name: &str,
) -> Result<(&'a Vec<String>, &'a Vec<Vec<f64>>), Value> {
    match inputs.get(port) {
        Some(Value::Table { columns, rows }) => Ok((columns, rows)),
        Some(_) => Err(Value::error(format!("{}: expected table", name))),
        None => Err(Value::error(format!("{}: no input", name))),
    }
}

fn read_table_from_data(data: &HashMap<String, serde_json::Value>, require: bool) -> Value {
    let td = data.get("tableData");
    match td {
        Some(td) => {
            let columns: Vec<String> = td
                .get("columns")
                .and_then(|c| c.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_else(|| vec!["A".to_string()]);
            let rows: Vec<Vec<f64>> = td
                .get("rows")
                .and_then(|r| r.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|row| {
                            row.as_array().map(|r| {
                                r.iter().map(|v| v.as_f64().unwrap_or(f64::NAN)).collect()
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Value::Table { columns, rows }
        }
        None => {
            if require {
                Value::error("No CSV loaded")
            } else {
                Value::Table {
                    columns: vec!["A".to_string()],
                    rows: vec![],
                }
            }
        }
    }
}

// ── W11b helpers ─────────────────────────────────────────────────

/// Port names for fixed-slot stats blocks (X1..X6).
const X_PORTS: [&str; 6] = ["x1", "x2", "x3", "x4", "x5", "x6"];
/// Port names for Y slots in relationship blocks (Y1..Y6).
const Y_PORTS: [&str; 6] = ["y1", "y2", "y3", "y4", "y5", "y6"];
/// Port names for cash-flow slots (CF0..CF5).
const CF_PORTS: [&str; 6] = ["cf0", "cf1", "cf2", "cf3", "cf4", "cf5"];

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
    fn csv_import_no_data() {
        let v = evaluate_node("csvImport", &HashMap::new(), &HashMap::new());
        match v {
            Value::Error { message } => assert_eq!(message, "No CSV loaded"),
            _ => panic!("Expected Error"),
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
    fn table_filter_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), Value::Table {
            columns: vec!["A".into()],
            rows: vec![vec![1.0], vec![5.0], vec![3.0], vec![7.0]],
        });
        inputs.insert("col".into(), Value::scalar(0.0));
        inputs.insert("threshold".into(), Value::scalar(3.0));
        let v = evaluate_node("tableFilter", &inputs, &HashMap::new());
        match v {
            Value::Table { rows, .. } => {
                assert_eq!(rows.len(), 2); // 5 and 7
                assert_eq!(rows[0], vec![5.0]);
                assert_eq!(rows[1], vec![7.0]);
            }
            _ => panic!("Expected Table"),
        }
    }

    #[test]
    fn table_column_block() {
        let mut inputs: HashMap<String, Value> = HashMap::new();
        inputs.insert("table".into(), Value::Table {
            columns: vec!["A".into(), "B".into()],
            rows: vec![vec![1.0, 10.0], vec![2.0, 20.0]],
        });
        inputs.insert("col".into(), Value::scalar(1.0));
        let v = evaluate_node("tableColumn", &inputs, &HashMap::new());
        match v {
            Value::Vector { value } => assert_eq!(value, vec![10.0, 20.0]),
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
    fn add_vector_length_mismatch() {
        let mut inputs = HashMap::new();
        inputs.insert("a".into(), Value::Vector { value: vec![1.0, 2.0] });
        inputs.insert("b".into(), Value::Vector { value: vec![1.0, 2.0, 3.0] });
        let v = evaluate_node("add", &inputs, &HashMap::new());
        assert!(matches!(v, Value::Error { .. }));
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
}
