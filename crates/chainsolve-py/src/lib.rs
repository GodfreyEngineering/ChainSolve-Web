//! Python bindings for the ChainSolve engine (10.6).
//!
//! Exposes the core graph execution API to Python via PyO3.
//!
//! ## Installation (editable dev install)
//!
//! ```bash
//! pip install maturin
//! cd crates/chainsolve-py
//! maturin develop --features extension-module
//! ```
//!
//! ## Usage
//!
//! ```python
//! import chainsolve
//!
//! # Load and execute a .chainsolve graph
//! result = chainsolve.Graph.load("model.chainsolve").execute()
//! print(result.values["output_node"])
//!
//! # Execute with parameter overrides
//! result = chainsolve.Graph.load("model.chainsolve").execute(
//!     params={"n1": 10.0, "n2": 20.0}
//! )
//!
//! # Execute from a JSON string directly
//! result = chainsolve.execute_json('{"version":1,"nodes":[...],"edges":[...]}')
//!
//! # Extract typed values
//! scalar = result.scalar("node_id")
//! vector = result.vector("node_id")   # → list[float]
//! matrix = result.matrix("node_id")   # → {"rows": N, "cols": M, "data": [...]}
//! ```
//!
//! ## Value types
//!
//! | Rust `Value` variant   | Python return type                                      |
//! |------------------------|---------------------------------------------------------|
//! | Scalar                 | `float`                                                 |
//! | Vector                 | `list[float]`                                           |
//! | Matrix                 | `dict` with keys `rows`, `cols`, `data: list[float]`    |
//! | Text                   | `str`                                                   |
//! | Error                  | raises `chainsolve.EvalError`                           |
//! | Interval               | `dict` with keys `lo`, `hi`                             |
//! | Complex                | `complex`                                               |
//! | HighPrecision          | `str` (full decimal expansion)                          |
//! | Table                  | `dict` with keys `columns: list[str]`, `rows: list[list[float]]` |

use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::{PyDict, PyList};
use std::collections::HashMap;

use engine_core::types::{EvalResult, Value};

// ── Python error type ─────────────────────────────────────────────────────────

pyo3::create_exception!(chainsolve, EvalError, pyo3::exceptions::PyException);
pyo3::create_exception!(chainsolve, SnapshotError, pyo3::exceptions::PyException);

// ── Value → Python conversion ─────────────────────────────────────────────────

fn value_to_py(py: Python<'_>, v: &Value) -> PyResult<PyObject> {
    match v {
        Value::Scalar { value } => Ok((*value).into_py(py)),
        Value::Vector { value } => {
            let list = PyList::new_bound(py, value.iter().copied());
            Ok(list.into())
        }
        Value::Matrix { rows, cols, data } => {
            let d = PyDict::new_bound(py);
            d.set_item("rows", *rows)?;
            d.set_item("cols", *cols)?;
            d.set_item("data", PyList::new_bound(py, data.iter().copied()))?;
            Ok(d.into())
        }
        Value::Text { value } => Ok(value.clone().into_py(py)),
        Value::Error { message } => Err(EvalError::new_err(message.clone())),
        Value::Interval { lo, hi } => {
            let d = PyDict::new_bound(py);
            d.set_item("lo", *lo)?;
            d.set_item("hi", *hi)?;
            Ok(d.into())
        }
        Value::Complex { re, im } => {
            let c = pyo3::types::PyComplex::from_doubles_bound(py, *re, *im);
            Ok(c.into())
        }
        Value::HighPrecision { display, .. } => Ok(display.clone().into_py(py)),
        Value::Table { columns, rows } => {
            let d = PyDict::new_bound(py);
            d.set_item("columns", PyList::new_bound(py, columns.iter()))?;
            let rows_list = PyList::empty_bound(py);
            for row in rows {
                rows_list.append(PyList::new_bound(py, row.iter().copied()))?;
            }
            d.set_item("rows", rows_list)?;
            Ok(d.into())
        }
    }
}

// ── PyEvalResult ──────────────────────────────────────────────────────────────

/// Result of a graph evaluation.
///
/// Attributes
/// ----------
/// elapsed_us : int
///     Evaluation time in microseconds.
/// diagnostics : list[str]
///     Warning/diagnostic messages (non-fatal).
#[pyclass(name = "EvalResult")]
struct PyEvalResult {
    result: EvalResult,
}

#[pymethods]
impl PyEvalResult {
    /// Return a dict mapping node IDs to their Python-typed values.
    fn values<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyDict>> {
        let d = PyDict::new_bound(py);
        for (k, v) in &self.result.values {
            match value_to_py(py, v) {
                Ok(pv) => d.set_item(k, pv)?,
                Err(e) => d.set_item(k, format!("ERROR: {}", e))?,
            }
        }
        Ok(d)
    }

    /// Return the scalar value for a node ID, or raise KeyError / EvalError.
    fn scalar(&self, py: Python<'_>, node_id: &str) -> PyResult<f64> {
        let _ = py;
        match self.result.values.get(node_id) {
            Some(Value::Scalar { value }) => Ok(*value),
            Some(Value::Error { message }) => Err(EvalError::new_err(message.clone())),
            Some(other) => Err(PyValueError::new_err(format!(
                "Node '{}' is not a scalar (got {:?})",
                node_id,
                std::mem::discriminant(other)
            ))),
            None => Err(pyo3::exceptions::PyKeyError::new_err(format!(
                "No node with id '{}'",
                node_id
            ))),
        }
    }

    /// Return the vector value for a node ID as a list[float].
    fn vector(&self, py: Python<'_>, node_id: &str) -> PyResult<PyObject> {
        match self.result.values.get(node_id) {
            Some(Value::Vector { value }) => {
                Ok(PyList::new_bound(py, value.iter().copied()).into())
            }
            Some(Value::Error { message }) => Err(EvalError::new_err(message.clone())),
            Some(_) => Err(PyValueError::new_err(format!(
                "Node '{}' is not a vector",
                node_id
            ))),
            None => Err(pyo3::exceptions::PyKeyError::new_err(format!(
                "No node with id '{}'",
                node_id
            ))),
        }
    }

    /// Return the matrix value as a dict: {"rows": int, "cols": int, "data": list[float]}.
    fn matrix<'py>(&self, py: Python<'py>, node_id: &str) -> PyResult<Bound<'py, PyDict>> {
        match self.result.values.get(node_id) {
            Some(Value::Matrix { rows, cols, data }) => {
                let d = PyDict::new_bound(py);
                d.set_item("rows", *rows)?;
                d.set_item("cols", *cols)?;
                d.set_item("data", PyList::new_bound(py, data.iter().copied()))?;
                Ok(d)
            }
            Some(Value::Error { message }) => Err(EvalError::new_err(message.clone())),
            Some(_) => Err(PyValueError::new_err(format!(
                "Node '{}' is not a matrix",
                node_id
            ))),
            None => Err(pyo3::exceptions::PyKeyError::new_err(format!(
                "No node with id '{}'",
                node_id
            ))),
        }
    }

    /// Evaluation time in microseconds.
    #[getter]
    fn elapsed_us(&self) -> u64 {
        self.result.elapsed_us
    }

    /// List of diagnostic messages (non-fatal warnings).
    fn diagnostics<'py>(&self, py: Python<'py>) -> PyResult<Bound<'py, PyList>> {
        let msgs: Vec<String> = self
            .result
            .diagnostics
            .iter()
            .map(|d| format!("{:?}", d))
            .collect();
        Ok(PyList::new_bound(py, msgs))
    }

    fn __repr__(&self) -> String {
        format!(
            "EvalResult(nodes={}, elapsed_us={})",
            self.result.values.len(),
            self.result.elapsed_us
        )
    }
}

// ── PyGraph ───────────────────────────────────────────────────────────────────

/// A loaded ChainSolve computation graph ready for execution.
///
/// Obtain via:
///   - ``Graph.load(path)``        — read from a .chainsolve file
///   - ``Graph.from_json(s)``      — parse from a JSON string
#[pyclass(name = "Graph")]
struct PyGraph {
    snapshot_json: String,
}

#[pymethods]
impl PyGraph {
    /// Load a graph from a .chainsolve or .json snapshot file.
    #[staticmethod]
    fn load(path: &str) -> PyResult<PyGraph> {
        let json = std::fs::read_to_string(path)
            .map_err(|e| PyRuntimeError::new_err(format!("Cannot read '{}': {}", path, e)))?;
        Ok(PyGraph { snapshot_json: json })
    }

    /// Parse a graph from a JSON string.
    #[staticmethod]
    fn from_json(json: &str) -> PyResult<PyGraph> {
        // Validate that it's at least parseable JSON before storing.
        serde_json::from_str::<serde_json::Value>(json)
            .map_err(|e| SnapshotError::new_err(format!("Invalid snapshot JSON: {}", e)))?;
        Ok(PyGraph { snapshot_json: json.to_string() })
    }

    /// Execute the graph and return an EvalResult.
    ///
    /// Parameters
    /// ----------
    /// params : dict[str, float], optional
    ///     Override Number node values before evaluation.
    ///     Keys are node IDs, values are the new numeric values.
    #[pyo3(signature = (params=None))]
    fn execute(&self, params: Option<HashMap<String, f64>>) -> PyResult<PyEvalResult> {
        // Apply parameter overrides if provided
        let json = if let Some(ref overrides) = params {
            apply_overrides(&self.snapshot_json, overrides)
        } else {
            self.snapshot_json.clone()
        };

        engine_core::run(&json)
            .map(|result| PyEvalResult { result })
            .map_err(|e| PyRuntimeError::new_err(format!("Evaluation failed: {}", e)))
    }

    /// Return the raw JSON string for this snapshot.
    fn to_json(&self) -> &str {
        &self.snapshot_json
    }

    fn __repr__(&self) -> String {
        "Graph(<snapshot>)".to_string()
    }
}

// ── Module-level convenience functions ───────────────────────────────────────

/// Execute a graph from a JSON snapshot string.
///
/// Parameters
/// ----------
/// snapshot_json : str
///     EngineSnapshotV1 JSON string.
/// params : dict[str, float], optional
///     Parameter overrides (node_id → value).
#[pyfunction]
#[pyo3(signature = (snapshot_json, params=None))]
fn execute_json(
    snapshot_json: &str,
    params: Option<HashMap<String, f64>>,
) -> PyResult<PyEvalResult> {
    let json = if let Some(ref overrides) = params {
        apply_overrides(snapshot_json, overrides)
    } else {
        snapshot_json.to_string()
    };

    engine_core::run(&json)
        .map(|result| PyEvalResult { result })
        .map_err(|e| PyRuntimeError::new_err(format!("Evaluation failed: {}", e)))
}

/// Return the engine-core version string.
#[pyfunction]
fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

// ── Parameter override helper ─────────────────────────────────────────────────

fn apply_overrides(snapshot_json: &str, overrides: &HashMap<String, f64>) -> String {
    if overrides.is_empty() {
        return snapshot_json.to_string();
    }
    let mut v: serde_json::Value = match serde_json::from_str(snapshot_json) {
        Ok(v) => v,
        Err(_) => return snapshot_json.to_string(),
    };
    if let Some(nodes) = v.get_mut("nodes").and_then(|n| n.as_array_mut()) {
        for node in nodes.iter_mut() {
            let id = node.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
            if let Some(&val) = overrides.get(&id) {
                if let Some(data) = node.get_mut("data") {
                    data["value"] = serde_json::json!(val);
                }
            }
        }
    }
    serde_json::to_string(&v).unwrap_or_else(|_| snapshot_json.to_string())
}

// ── PyO3 module registration ──────────────────────────────────────────────────

/// ChainSolve Python bindings.
///
/// Exposes the Rust computation engine to Python for headless graph execution,
/// Jupyter notebook integration, and scripted batch workflows.
#[pymodule]
fn chainsolve(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<PyGraph>()?;
    m.add_class::<PyEvalResult>()?;
    m.add_function(wrap_pyfunction!(execute_json, m)?)?;
    m.add_function(wrap_pyfunction!(version, m)?)?;
    m.add("EvalError", m.py().get_type_bound::<EvalError>())?;
    m.add("SnapshotError", m.py().get_type_bound::<SnapshotError>())?;
    Ok(())
}

// ── Tests (no Python runtime needed) ─────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_overrides_empty() {
        let json = r#"{"version":1,"nodes":[],"edges":[]}"#;
        let result = apply_overrides(json, &HashMap::new());
        assert_eq!(result, json);
    }

    #[test]
    fn apply_overrides_updates_value() {
        let json = r#"{"version":1,"nodes":[{"id":"n1","blockType":"number","data":{"value":1.0}}],"edges":[]}"#;
        let mut overrides = HashMap::new();
        overrides.insert("n1".to_string(), 42.0);
        let result = apply_overrides(json, &overrides);
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let new_val = v["nodes"][0]["data"]["value"].as_f64().unwrap();
        assert!((new_val - 42.0).abs() < 1e-10);
    }

    #[test]
    fn apply_overrides_invalid_json_passthrough() {
        let bad_json = "not json";
        let result = apply_overrides(bad_json, &{
            let mut m = HashMap::new();
            m.insert("x".to_string(), 1.0);
            m
        });
        assert_eq!(result, bad_json);
    }

    #[test]
    fn engine_executes_add_graph() {
        let snapshot = r#"{"version":1,"nodes":[
            {"id":"a","blockType":"number","data":{"value":3}},
            {"id":"b","blockType":"number","data":{"value":4}},
            {"id":"c","blockType":"add","data":{}}
        ],"edges":[
            {"id":"e1","source":"a","sourceHandle":"out","target":"c","targetHandle":"in_0"},
            {"id":"e2","source":"b","sourceHandle":"out","target":"c","targetHandle":"in_1"}
        ]}"#;
        let result = engine_core::run(snapshot).unwrap();
        match result.values.get("c") {
            Some(Value::Scalar { value }) => assert!((value - 7.0).abs() < 1e-10),
            other => panic!("Expected scalar 7.0, got {:?}", other),
        }
    }

    #[test]
    fn apply_overrides_then_evaluate() {
        let snapshot = r#"{"version":1,"nodes":[
            {"id":"x","blockType":"number","data":{"value":0}},
            {"id":"y","blockType":"number","data":{"value":0}}
        ],"edges":[]}"#;
        let mut overrides = HashMap::new();
        overrides.insert("x".to_string(), 5.0);
        overrides.insert("y".to_string(), 10.0);
        let patched = apply_overrides(snapshot, &overrides);
        let result = engine_core::run(&patched).unwrap();
        match result.values.get("x") {
            Some(Value::Scalar { value }) => assert!((value - 5.0).abs() < 1e-10),
            other => panic!("Expected 5.0, got {:?}", other),
        }
        match result.values.get("y") {
            Some(Value::Scalar { value }) => assert!((value - 10.0).abs() < 1e-10),
            other => panic!("Expected 10.0, got {:?}", other),
        }
    }
}
