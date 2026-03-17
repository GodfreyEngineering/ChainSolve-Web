//! Persistent `EngineGraph` with dirty tracking and incremental evaluation.
//!
//! # Design
//!
//! [`EngineGraph`] is the long-lived state held by the WASM wrapper
//! (`engine-wasm`). Rather than re-evaluating the full graph on every change,
//! it tracks a *dirty set*: the nodes whose inputs changed since the last eval.
//! Only dirty nodes (and their downstream dependents) are re-evaluated.
//!
//! # PatchOp protocol
//!
//! The TypeScript diff engine (`src/engine/diffGraph.ts`) computes a
//! `PatchOp[]` from the React Flow state delta and sends it to the worker.
//! Each [`PatchOp`] variant mutates the graph structure and marks affected
//! nodes dirty:
//!
//! - `AddNode`        — inserts node, marks it dirty
//! - `RemoveNode`     — removes node + its edges, marks downstream dirty
//! - `UpdateNodeData` — updates node data (e.g. slider value), marks node dirty
//! - `AddEdge`        — inserts edge, marks target node dirty
//! - `RemoveEdge`     — removes edge, marks former target dirty
//!
//! After patching, `evaluate_dirty()` re-evaluates only the dirty set in
//! topological order and returns an [`IncrementalEvalResult`] with only the
//! changed values.

use crate::ops::evaluate_node_with_datasets;
use crate::types::{
    Diagnostic, DiagLevel, EdgeDef, EngineSnapshotV1, EvalOptions, IncrementalEvalResult, NodeDef,
    TraceEntry, Value,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

// ── Progress callback signal ────────────────────────────────────────

/// Signal returned by the progress callback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EvalSignal {
    Continue,
    Abort,
}

// ── Patch types ──────────────────────────────────────────────────────

/// Incremental graph mutation sent from the TypeScript diff engine.
///
/// The full set of ops for one React Flow state delta is sent as a
/// `Vec<PatchOp>` (JSON array) via the worker's `applyPatch` message.
/// See `src/engine/diffGraph.ts` for how the diff is computed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum PatchOp {
    AddNode {
        node: NodeDef,
    },
    RemoveNode {
        #[serde(rename = "nodeId")]
        node_id: String,
    },
    UpdateNodeData {
        #[serde(rename = "nodeId")]
        node_id: String,
        data: HashMap<String, serde_json::Value>,
    },
    AddEdge {
        edge: EdgeDef,
    },
    RemoveEdge {
        #[serde(rename = "edgeId")]
        edge_id: String,
    },
}

// ── Persistent graph with dirty tracking ─────────────────────────────

/// Persistent graph with lazy topological sort and dirty-set tracking.
///
/// # Invariants
///
/// - `dirty` contains every node whose output may have changed since the last
///   `evaluate_dirty()` call. It is always a superset of the truly stale nodes.
/// - `topo_order` is valid iff `topo_dirty == false`. It is rebuilt lazily on
///   the next `evaluate_dirty*` call.
/// - `values` holds the last-known output of every evaluated node.
///   Dirty nodes may have stale entries — do not read `values` directly; use
///   `evaluate_dirty()` to get a fresh [`IncrementalEvalResult`].
pub struct EngineGraph {
    nodes: HashMap<String, NodeDef>,
    edges: HashMap<String, EdgeDef>,
    /// source_id → [(edge_id, target_id, target_handle)]
    out_adj: HashMap<String, Vec<(String, String, String)>>,
    /// target_id → [(edge_id, source_id, source_handle, target_handle)]
    in_adj: HashMap<String, Vec<(String, String, String, String)>>,
    /// Cached topological order.
    topo_order: Vec<String>,
    /// Cached computed values per node.
    values: HashMap<String, Value>,
    /// Cheap hash of last-known output per node, used for ENG-05 value equality pruning.
    /// Errors are never cached (always treated as changed).
    value_hashes: HashMap<String, u64>,
    /// Nodes that need re-evaluation.
    dirty: HashSet<String>,
    /// Whether topo_order needs rebuilding.
    topo_dirty: bool,
    /// Dataset registry: id → raw f64 data.
    pub datasets: HashMap<String, Vec<f64>>,
}

impl EngineGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            out_adj: HashMap::new(),
            in_adj: HashMap::new(),
            topo_order: Vec::new(),
            values: HashMap::new(),
            value_hashes: HashMap::new(),
            dirty: HashSet::new(),
            topo_dirty: true,
            datasets: HashMap::new(),
        }
    }

    /// Full reset from a snapshot. Marks all nodes dirty.
    pub fn load_snapshot(&mut self, snapshot: EngineSnapshotV1) {
        self.nodes.clear();
        self.edges.clear();
        self.out_adj.clear();
        self.in_adj.clear();
        self.values.clear();
        self.value_hashes.clear();
        self.dirty.clear();

        for node in snapshot.nodes {
            self.dirty.insert(node.id.clone());
            self.out_adj.entry(node.id.clone()).or_default();
            self.in_adj.entry(node.id.clone()).or_default();
            self.nodes.insert(node.id.clone(), node);
        }

        for edge in snapshot.edges {
            self.add_edge_internal(&edge);
            self.edges.insert(edge.id.clone(), edge);
        }

        self.topo_dirty = true;
    }

    /// Apply a batch of patch operations.
    pub fn apply_patch(&mut self, ops: Vec<PatchOp>) {
        for op in ops {
            match op {
                PatchOp::AddNode { node } => {
                    let id = node.id.clone();
                    self.out_adj.entry(id.clone()).or_default();
                    self.in_adj.entry(id.clone()).or_default();
                    self.nodes.insert(id.clone(), node);
                    self.mark_dirty(&id);
                    // ENG-08: A newly added node has no edges yet (edges come in separate
                    // AddEdge ops), so it is isolated and can be safely appended to the end
                    // of topo_order without a full rebuild. It has no incoming or outgoing
                    // edges to violate topological ordering.
                    self.topo_order.push(id);
                }
                PatchOp::RemoveNode { node_id } => {
                    // Cascade-remove all edges touching this node.
                    let edge_ids: Vec<String> = self
                        .edges
                        .iter()
                        .filter(|(_, e)| e.source == node_id || e.target == node_id)
                        .map(|(id, _)| id.clone())
                        .collect();
                    for eid in edge_ids {
                        self.remove_edge_internal(&eid);
                        self.edges.remove(&eid);
                    }
                    self.nodes.remove(&node_id);
                    self.out_adj.remove(&node_id);
                    self.in_adj.remove(&node_id);
                    self.values.remove(&node_id);
                    self.value_hashes.remove(&node_id);
                    self.dirty.remove(&node_id);
                    self.topo_dirty = true;
                }
                PatchOp::UpdateNodeData { node_id, data } => {
                    if let Some(node) = self.nodes.get_mut(&node_id) {
                        node.data = data;
                        self.mark_dirty(&node_id);
                    }
                }
                PatchOp::AddEdge { edge } => {
                    // Remove old adjacency entries if this edge ID already exists (prevents duplicate entries).
                    if self.edges.contains_key(&edge.id) {
                        self.remove_edge_internal(&edge.id);
                    }
                    let target_id = edge.target.clone();
                    self.add_edge_internal(&edge);
                    self.edges.insert(edge.id.clone(), edge);
                    self.mark_dirty(&target_id);
                    self.topo_dirty = true;
                }
                PatchOp::RemoveEdge { edge_id } => {
                    if let Some(edge) = self.edges.get(&edge_id) {
                        let target_id = edge.target.clone();
                        self.remove_edge_internal(&edge_id);
                        self.edges.remove(&edge_id);
                        self.mark_dirty(&target_id);
                        self.topo_dirty = true;
                    }
                }
            }
        }
    }

    /// Set a manual input value on a node's data (manualValues map).
    /// Marks the node and its downstream dirty.
    pub fn set_input(&mut self, node_id: &str, port_id: &str, value: f64) {
        if let Some(node) = self.nodes.get_mut(node_id) {
            let manuals = node
                .data
                .entry("manualValues".to_string())
                .or_insert_with(|| serde_json::json!({}));
            if let Some(obj) = manuals.as_object_mut() {
                obj.insert(port_id.to_string(), serde_json::json!(value));
            }
            self.mark_dirty(node_id);
        }
    }

    /// Register a dataset by id.
    pub fn register_dataset(&mut self, id: String, data: Vec<f64>) {
        self.datasets.insert(id, data);
    }

    /// Release (remove) a dataset.
    pub fn release_dataset(&mut self, id: &str) {
        self.datasets.remove(id);
    }

    /// Number of datasets currently registered.
    pub fn dataset_count(&self) -> usize {
        self.datasets.len()
    }

    /// Total bytes used by all registered datasets (each f64 = 8 bytes).
    pub fn dataset_total_bytes(&self) -> usize {
        self.datasets.values().map(|v| v.len() * 8).sum()
    }

    /// Evaluate only dirty nodes. Returns changed values.
    pub fn evaluate_dirty(&mut self) -> IncrementalEvalResult {
        self.evaluate_dirty_with_options(&EvalOptions::default())
    }

    /// Evaluate dirty nodes with options (trace, time budget).
    pub fn evaluate_dirty_with_options(&mut self, opts: &EvalOptions) -> IncrementalEvalResult {
        self.evaluate_dirty_with_callback(opts, |_, _| EvalSignal::Continue)
    }

    /// Evaluate dirty nodes with a progress callback.
    ///
    /// The callback receives `(evaluated_count, dirty_count)` after each node
    /// and returns `Continue` or `Abort`. On `Abort`, remaining dirty nodes
    /// stay dirty for resumption on the next call.
    pub fn evaluate_dirty_with_callback<F>(
        &mut self,
        opts: &EvalOptions,
        mut on_progress: F,
    ) -> IncrementalEvalResult
    where
        F: FnMut(usize, usize) -> EvalSignal,
    {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        let mut trace: Vec<TraceEntry> = Vec::new();

        // Rebuild topo order if structure changed.
        if self.topo_dirty {
            self.rebuild_topo(&mut diagnostics);
            self.topo_dirty = false;
        }

        let total_count = self.nodes.len();
        let dirty_count = self.dirty.len();
        let mut changed_values: HashMap<String, Value> = HashMap::new();
        let mut evaluated_count: usize = 0;
        let mut partial = false;

        // Walk topo order, evaluate dirty nodes.
        for node_id in &self.topo_order.clone() {
            if !self.dirty.contains(node_id) {
                continue;
            }
            self.dirty.remove(node_id);

            let node = match self.nodes.get(node_id) {
                Some(n) => n,
                None => continue,
            };

            // Gather input values from edges.
            let mut node_inputs: HashMap<String, Value> = HashMap::new();
            if let Some(in_edges) = self.in_adj.get(node_id) {
                for (_eid, src_id, src_handle, tgt_handle) in in_edges {
                    if let Some(val) = self.values.get(src_id) {
                        // Table column handles: col_0, col_1, ...
                        if src_handle.starts_with("col_") {
                            if let Value::Table { columns: _, rows } = val {
                                if let Ok(idx) = src_handle[4..].parse::<usize>() {
                                    let col: Vec<f64> = rows
                                        .iter()
                                        .map(|row| row.get(idx).copied().unwrap_or(0.0))
                                        .collect();
                                    node_inputs
                                        .insert(tgt_handle.clone(), Value::Vector { value: col });
                                    continue;
                                }
                            }
                        }
                        // Material property handles: prop_rho, prop_E, ...
                        if src_handle.starts_with("prop_") {
                            if let Value::Table { columns, rows } = val {
                                let prop_name = &src_handle[5..];
                                if let Some(idx) = columns.iter().position(|c| c == prop_name) {
                                    let v = rows.first().and_then(|r| r.get(idx).copied()).unwrap_or(0.0);
                                    node_inputs.insert(tgt_handle.clone(), Value::scalar(v));
                                    continue;
                                }
                            }
                        }
                        node_inputs.insert(tgt_handle.clone(), val.clone());
                    }
                }
            }

            // Apply portOverrides / manualValues.
            let overrides = node.data.get("portOverrides").and_then(|v| v.as_object());
            let manuals = node.data.get("manualValues").and_then(|v| v.as_object());
            if let Some(manuals) = manuals {
                for (port_id, val) in manuals {
                    if let Some(n) = val.as_f64() {
                        let is_overridden = overrides
                            .and_then(|o| o.get(port_id))
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        if !node_inputs.contains_key(port_id) || is_overridden {
                            node_inputs.insert(port_id.clone(), Value::scalar(n));
                        }
                    }
                }
            }

            let result = evaluate_node_with_datasets(
                &node.block_type,
                &node_inputs,
                &node.data,
                Some(&self.datasets),
            );
            evaluated_count += 1;

            // Collect trace if enabled.
            if opts.trace {
                let within_limit = opts
                    .max_trace_nodes
                    .map(|max| trace.len() < max)
                    .unwrap_or(true);
                if within_limit {
                    let input_summaries = node_inputs
                        .iter()
                        .map(|(k, v)| (k.clone(), v.summarize()))
                        .collect();
                    trace.push(TraceEntry {
                        node_id: node_id.clone(),
                        op_id: node.block_type.clone(),
                        inputs: input_summaries,
                        output: result.summarize(),
                        diagnostics: vec![],
                    });
                }
            }

            // Report unknown blocks.
            if let Value::Error { ref message } = result {
                if message.starts_with("Unknown block type") {
                    diagnostics.push(Diagnostic {
                        node_id: Some(node_id.to_string()),
                        level: DiagLevel::Warning,
                        code: "UNKNOWN_BLOCK".to_string(),
                        message: message.clone(),
                    });
                }
            }

            // ENG-05: Compute a cheap hash of the new output to detect value changes.
            // Errors are never considered stable — always treat as changed (hash = 0, never cached).
            let new_hash = compute_value_hash(&result);
            let is_error = matches!(result, Value::Error { .. });

            // Compare new hash against the previously stored hash.
            let hash_changed = if is_error {
                // Errors always propagate downstream; do not cache their hash.
                true
            } else {
                match self.value_hashes.get(node_id) {
                    Some(&prev_hash) => new_hash != prev_hash,
                    None => true, // No prior hash — treat as changed.
                }
            };

            self.values.insert(node_id.to_string(), result.clone());

            if hash_changed {
                // Update stored hash (only for non-error values) and emit to changed_values.
                if !is_error {
                    self.value_hashes.insert(node_id.to_string(), new_hash);
                }
                changed_values.insert(node_id.to_string(), result);
            } else {
                // Hash matches — value hasn't changed. Prune downstream cascade.
                self.prune_downstream(node_id);
            }

            // Call progress callback (also used for time budget checking).
            if on_progress(evaluated_count, dirty_count) == EvalSignal::Abort {
                partial = true;
                break;
            }
        }

        IncrementalEvalResult {
            changed_values,
            diagnostics,
            elapsed_us: 0,
            evaluated_count,
            total_count,
            trace: if opts.trace { Some(trace) } else { None },
            partial,
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────

    /// Mark a node and all its downstream descendants as dirty.
    fn mark_dirty(&mut self, node_id: &str) {
        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(node_id.to_string());
        while let Some(id) = queue.pop_front() {
            if self.dirty.insert(id.clone()) {
                // Only propagate if this is newly dirty.
                if let Some(neighbors) = self.out_adj.get(&id) {
                    for (_, target_id, _) in neighbors {
                        queue.push_back(target_id.clone());
                    }
                }
            }
        }
    }

    /// Remove downstream nodes from dirty set (value-unchanged pruning).
    fn prune_downstream(&mut self, node_id: &str) {
        if let Some(neighbors) = self.out_adj.get(node_id).cloned() {
            for (_, target_id, _) in &neighbors {
                // Only prune if all inputs of target are clean (no other dirty parent).
                let all_parents_clean = self
                    .in_adj
                    .get(target_id)
                    .map(|edges| {
                        edges
                            .iter()
                            .all(|(_, src, _, _)| !self.dirty.contains(src))
                    })
                    .unwrap_or(true);
                if all_parents_clean {
                    self.dirty.remove(target_id);
                    self.prune_downstream(target_id);
                }
            }
        }
    }

    /// Add edge to adjacency maps (does not insert into self.edges).
    fn add_edge_internal(&mut self, edge: &EdgeDef) {
        self.out_adj
            .entry(edge.source.clone())
            .or_default()
            .push((
                edge.id.clone(),
                edge.target.clone(),
                edge.target_handle.clone(),
            ));
        self.in_adj
            .entry(edge.target.clone())
            .or_default()
            .push((
                edge.id.clone(),
                edge.source.clone(),
                edge.source_handle.clone(),
                edge.target_handle.clone(),
            ));
    }

    /// Remove edge from adjacency maps (does not remove from self.edges).
    fn remove_edge_internal(&mut self, edge_id: &str) {
        if let Some(edge) = self.edges.get(edge_id) {
            if let Some(out) = self.out_adj.get_mut(&edge.source) {
                out.retain(|(eid, _, _)| eid != edge_id);
            }
            if let Some(inp) = self.in_adj.get_mut(&edge.target) {
                inp.retain(|(eid, _, _, _)| eid != edge_id);
            }
        }
    }

    /// Rebuild topological order using Kahn's algorithm.
    fn rebuild_topo(&mut self, diagnostics: &mut Vec<Diagnostic>) {
        let mut in_degree: HashMap<&str, usize> = HashMap::new();
        for id in self.nodes.keys() {
            in_degree.insert(id.as_str(), 0);
        }
        for edge in self.edges.values() {
            *in_degree.entry(edge.target.as_str()).or_insert(0) += 1;
        }

        let mut queue: VecDeque<&str> = VecDeque::new();
        for (&id, &deg) in &in_degree {
            if deg == 0 {
                queue.push_back(id);
            }
        }

        let mut order: Vec<String> = Vec::with_capacity(self.nodes.len());
        let mut remaining = in_degree.clone();

        while let Some(id) = queue.pop_front() {
            order.push(id.to_string());
            if let Some(neighbors) = self.out_adj.get(id) {
                for (_, target_id, _) in neighbors {
                    if let Some(deg) = remaining.get_mut(target_id.as_str()) {
                        *deg = deg.saturating_sub(1);
                        if *deg == 0 {
                            queue.push_back(target_id.as_str());
                        }
                    }
                }
            }
        }

        // Nodes not in order are in cycles.
        if order.len() < self.nodes.len() {
            let in_topo: HashSet<&str> = order.iter().map(|s| s.as_str()).collect();
            for id in self.nodes.keys() {
                if !in_topo.contains(id.as_str()) {
                    diagnostics.push(Diagnostic {
                        node_id: Some(id.clone()),
                        level: DiagLevel::Error,
                        code: "CYCLE_DETECTED".to_string(),
                        message: format!("Node '{}' is part of a cycle", id),
                    });
                }
            }
        }

        self.topo_order = order;
    }

    /// Get a reference to cached values.
    pub fn values(&self) -> &HashMap<String, Value> {
        &self.values
    }

    /// Pre-run validation: detect structural issues without running evaluation.
    ///
    /// Checks:
    /// - Cycle detection (Kahn's algorithm)
    /// - Missing required inputs (catalog ports with no incoming edge and no manual value)
    /// - Dangling edges (source/target node missing)
    ///
    /// Returns diagnostics only — does not modify the graph or run any computation.
    pub fn validate_pre_eval(&self, catalog_inputs: &HashMap<String, Vec<String>>) -> Vec<Diagnostic> {
        let mut diags = Vec::new();

        // 1. Cycle detection via Kahn's algorithm
        let mut in_degree: HashMap<&str, usize> = HashMap::new();
        for id in self.nodes.keys() {
            in_degree.insert(id.as_str(), 0);
        }
        for edge in self.edges.values() {
            *in_degree.entry(edge.target.as_str()).or_insert(0) += 1;
        }

        let mut queue: VecDeque<&str> = VecDeque::new();
        for (&id, &deg) in &in_degree {
            if deg == 0 {
                queue.push_back(id);
            }
        }

        let mut visited = 0usize;
        let mut remaining = in_degree.clone();
        while let Some(id) = queue.pop_front() {
            visited += 1;
            if let Some(neighbors) = self.out_adj.get(id) {
                for (_, target_id, _) in neighbors {
                    if let Some(deg) = remaining.get_mut(target_id.as_str()) {
                        *deg = deg.saturating_sub(1);
                        if *deg == 0 {
                            queue.push_back(target_id.as_str());
                        }
                    }
                }
            }
        }

        if visited < self.nodes.len() {
            let in_topo: HashSet<&str> = {
                // Re-run Kahn's to get the set of non-cycle nodes
                let mut topo_set = HashSet::new();
                let mut in_deg2: HashMap<&str, usize> = HashMap::new();
                for id in self.nodes.keys() {
                    in_deg2.insert(id.as_str(), 0);
                }
                for edge in self.edges.values() {
                    *in_deg2.entry(edge.target.as_str()).or_insert(0) += 1;
                }
                let mut q2: VecDeque<&str> = VecDeque::new();
                for (&id, &deg) in &in_deg2 {
                    if deg == 0 {
                        q2.push_back(id);
                    }
                }
                while let Some(id) = q2.pop_front() {
                    topo_set.insert(id);
                    if let Some(neighbors) = self.out_adj.get(id) {
                        for (_, target_id, _) in neighbors {
                            if let Some(deg) = in_deg2.get_mut(target_id.as_str()) {
                                *deg = deg.saturating_sub(1);
                                if *deg == 0 {
                                    q2.push_back(target_id.as_str());
                                }
                            }
                        }
                    }
                }
                topo_set
            };
            for id in self.nodes.keys() {
                if !in_topo.contains(id.as_str()) {
                    diags.push(Diagnostic {
                        node_id: Some(id.clone()),
                        level: DiagLevel::Error,
                        code: "CYCLE_DETECTED".to_string(),
                        message: format!("Node '{}' is part of a cycle", id),
                    });
                }
            }
        }

        // 2. Missing required inputs — check each node against catalog
        for (node_id, node) in &self.nodes {
            let block_type = &node.block_type;
            // Look up required inputs from catalog
            if let Some(required_ports) = catalog_inputs.get(block_type.as_str()) {
                // Build set of ports connected by incoming edges
                let connected_ports: HashSet<&str> = self
                    .in_adj
                    .get(node_id)
                    .map(|edges| edges.iter().map(|(_, _, _, handle)| handle.as_str()).collect())
                    .unwrap_or_default();

                // Check for manual values
                let manual_values = node.data.get("manualValues")
                    .and_then(|v| v.as_object());
                let port_overrides = node.data.get("portOverrides")
                    .and_then(|v| v.as_object());

                for port_id in required_ports {
                    let has_edge = connected_ports.contains(port_id.as_str());
                    let has_manual = manual_values
                        .map(|m| m.contains_key(port_id))
                        .unwrap_or(false);
                    let is_overridden = port_overrides
                        .and_then(|po| po.get(port_id))
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);

                    if !has_edge && !has_manual && !is_overridden {
                        diags.push(Diagnostic {
                            node_id: Some(node_id.clone()),
                            level: DiagLevel::Warning,
                            code: "MISSING_INPUT".to_string(),
                            message: format!(
                                "Node '{}' ({}): input '{}' has no connection or manual value",
                                node_id, block_type, port_id
                            ),
                        });
                    }
                }
            }
        }

        // 3. Dangling edges
        for edge in self.edges.values() {
            if !self.nodes.contains_key(&edge.source) {
                diags.push(Diagnostic {
                    node_id: None,
                    level: DiagLevel::Error,
                    code: "DANGLING_EDGE".to_string(),
                    message: format!(
                        "Edge '{}' references missing source node '{}'",
                        edge.id, edge.source
                    ),
                });
            }
            if !self.nodes.contains_key(&edge.target) {
                diags.push(Diagnostic {
                    node_id: None,
                    level: DiagLevel::Error,
                    code: "DANGLING_EDGE".to_string(),
                    message: format!(
                        "Edge '{}' references missing target node '{}'",
                        edge.id, edge.target
                    ),
                });
            }
        }

        diags
    }
}

/// ENG-05: Compute a cheap u64 hash of a Value using std's DefaultHasher.
/// - Scalar: hashes the raw f64 bits (handles NaN deterministically).
/// - Vector: hashes each element's bits in sequence.
/// - Table: hashes all column names then all row element bits.
/// - Error: returns 0 (errors are never cached; callers must treat them as always changed).
fn compute_value_hash(value: &Value) -> u64 {
    let mut hasher = DefaultHasher::new();
    match value {
        Value::Scalar { value: v } => {
            v.to_bits().hash(&mut hasher);
        }
        Value::Vector { value: v } => {
            for elem in v {
                elem.to_bits().hash(&mut hasher);
            }
        }
        Value::Table { columns, rows } => {
            for col in columns {
                col.hash(&mut hasher);
            }
            for row in rows {
                for elem in row {
                    elem.to_bits().hash(&mut hasher);
                }
            }
        }
        Value::Error { .. } => {
            return 0;
        }
        Value::Text { value } => {
            value.hash(&mut hasher);
        }
        Value::Interval { lo, hi } => {
            lo.to_bits().hash(&mut hasher);
            hi.to_bits().hash(&mut hasher);
        }
        Value::Complex { re, im } => {
            re.to_bits().hash(&mut hasher);
            im.to_bits().hash(&mut hasher);
        }
        Value::Matrix { rows, cols, data } => {
            rows.hash(&mut hasher);
            cols.hash(&mut hasher);
            for elem in data {
                elem.to_bits().hash(&mut hasher);
            }
        }
    }
    hasher.finish()
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn num_node(id: &str, val: f64) -> NodeDef {
        let mut data = HashMap::new();
        data.insert("value".to_string(), serde_json::json!(val));
        NodeDef {
            id: id.to_string(),
            block_type: "number".to_string(),
            data,
        }
    }

    fn op_node(id: &str, block_type: &str) -> NodeDef {
        NodeDef {
            id: id.to_string(),
            block_type: block_type.to_string(),
            data: HashMap::new(),
        }
    }

    fn edge(id: &str, src: &str, src_h: &str, tgt: &str, tgt_h: &str) -> EdgeDef {
        EdgeDef {
            id: id.into(),
            source: src.into(),
            source_handle: src_h.into(),
            target: tgt.into(),
            target_handle: tgt_h.into(),
        }
    }

    fn snapshot_3_plus_4() -> EngineSnapshotV1 {
        EngineSnapshotV1 {
            version: 1,
            nodes: vec![num_node("n1", 3.0), num_node("n2", 4.0), op_node("add", "add")],
            edges: vec![
                edge("e1", "n1", "out", "add", "a"),
                edge("e2", "n2", "out", "add", "b"),
            ],
        }
    }

    #[test]
    fn load_snapshot_evaluates_all() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        let result = g.evaluate_dirty();
        assert_eq!(result.evaluated_count, 3);
        assert_eq!(result.total_count, 3);
        assert_eq!(
            result.changed_values.get("add").unwrap().as_scalar(),
            Some(7.0)
        );
    }

    #[test]
    fn second_eval_no_dirty_evaluates_nothing() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        g.evaluate_dirty();

        // Second eval with nothing dirty.
        let result = g.evaluate_dirty();
        assert_eq!(result.evaluated_count, 0);
        assert!(result.changed_values.is_empty());
    }

    #[test]
    fn update_node_data_re_evaluates_downstream() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        g.evaluate_dirty();

        // Change n1 from 3 to 10.
        let mut new_data = HashMap::new();
        new_data.insert("value".to_string(), serde_json::json!(10.0));
        g.apply_patch(vec![PatchOp::UpdateNodeData {
            node_id: "n1".to_string(),
            data: new_data,
        }]);

        let result = g.evaluate_dirty();
        // n1 and add should be re-evaluated (n2 stays clean).
        assert_eq!(result.evaluated_count, 2);
        assert_eq!(
            result.changed_values.get("n1").unwrap().as_scalar(),
            Some(10.0)
        );
        assert_eq!(
            result.changed_values.get("add").unwrap().as_scalar(),
            Some(14.0)
        );
        assert!(!result.changed_values.contains_key("n2"));
    }

    #[test]
    fn add_node_via_patch() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        g.evaluate_dirty();

        // Add a display node connected to add.
        g.apply_patch(vec![
            PatchOp::AddNode {
                node: op_node("disp", "display"),
            },
            PatchOp::AddEdge {
                edge: edge("e3", "add", "out", "disp", "value"),
            },
        ]);

        let result = g.evaluate_dirty();
        assert_eq!(
            result.changed_values.get("disp").unwrap().as_scalar(),
            Some(7.0)
        );
    }

    #[test]
    fn remove_node_via_patch() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        g.evaluate_dirty();

        // Remove add node (cascades edges).
        g.apply_patch(vec![PatchOp::RemoveNode {
            node_id: "add".to_string(),
        }]);

        // Verify add is gone.
        assert!(!g.values.contains_key("add"));
        assert!(g.edges.is_empty());
    }

    #[test]
    fn dirty_propagation_chain() {
        // n1 → neg1 → neg2 → neg3 → neg4 (chain of 5 nodes, values change at each step)
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 1.0),
                op_node("neg1", "negate"),
                op_node("neg2", "negate"),
                op_node("neg3", "negate"),
                op_node("neg4", "negate"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "neg1", "a"),
                edge("e2", "neg1", "out", "neg2", "a"),
                edge("e3", "neg2", "out", "neg3", "a"),
                edge("e4", "neg3", "out", "neg4", "a"),
            ],
        };

        let mut g = EngineGraph::new();
        g.load_snapshot(snap);
        g.evaluate_dirty();

        // Change root → all 5 must be re-evaluated.
        let mut new_data = HashMap::new();
        new_data.insert("value".to_string(), serde_json::json!(2.0));
        g.apply_patch(vec![PatchOp::UpdateNodeData {
            node_id: "n1".to_string(),
            data: new_data,
        }]);

        let result = g.evaluate_dirty();
        assert_eq!(result.evaluated_count, 5);
    }

    #[test]
    fn value_unchanged_prunes_downstream() {
        // n1(3) → add ← n2(4)   then add → display
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 3.0),
                num_node("n2", 4.0),
                op_node("add", "add"),
                op_node("disp", "display"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "add", "a"),
                edge("e2", "n2", "out", "add", "b"),
                edge("e3", "add", "out", "disp", "value"),
            ],
        };

        let mut g = EngineGraph::new();
        g.load_snapshot(snap);
        g.evaluate_dirty();

        // "Update" n1 to the same value (3.0) → add still produces 7 → display should be pruned.
        let mut same_data = HashMap::new();
        same_data.insert("value".to_string(), serde_json::json!(3.0));
        g.apply_patch(vec![PatchOp::UpdateNodeData {
            node_id: "n1".to_string(),
            data: same_data,
        }]);

        let result = g.evaluate_dirty();
        // n1 re-evaluated (value unchanged: 3→3), add re-evaluated (value unchanged: 7→7),
        // display should be pruned.
        assert!(!result.changed_values.contains_key("disp"));
    }

    #[test]
    fn cycle_detection_in_incremental_mode() {
        let mut g = EngineGraph::new();
        g.load_snapshot(EngineSnapshotV1 {
            version: 1,
            nodes: vec![op_node("a", "add"), op_node("b", "add")],
            edges: vec![
                edge("e1", "a", "out", "b", "a"),
                edge("e2", "b", "out", "a", "a"),
            ],
        });

        let result = g.evaluate_dirty();
        assert!(result.diagnostics.iter().any(|d| d.code == "CYCLE_DETECTED"));
    }

    #[test]
    fn set_input_marks_dirty() {
        let mut g = EngineGraph::new();
        g.load_snapshot(EngineSnapshotV1 {
            version: 1,
            nodes: vec![op_node("add", "add")],
            edges: vec![],
        });
        g.evaluate_dirty();

        g.set_input("add", "a", 5.0);
        g.set_input("add", "b", 3.0);
        let result = g.evaluate_dirty();
        assert_eq!(result.evaluated_count, 1);
        assert_eq!(
            result.changed_values.get("add").unwrap().as_scalar(),
            Some(8.0)
        );
    }

    #[test]
    fn register_and_release_dataset() {
        let mut g = EngineGraph::new();
        g.register_dataset("ds1".to_string(), vec![1.0, 2.0, 3.0]);
        assert_eq!(g.datasets.get("ds1").unwrap().len(), 3);
        g.release_dataset("ds1");
        assert!(g.datasets.get("ds1").is_none());
    }

    #[test]
    fn dataset_ref_in_vector_input() {
        let mut g = EngineGraph::new();
        g.register_dataset("ds_v1".to_string(), vec![10.0, 20.0, 30.0]);

        // vectorInput node with datasetRef pointing to registered dataset.
        let mut vi_data = HashMap::new();
        vi_data.insert(
            "blockType".to_string(),
            serde_json::json!("vectorInput"),
        );
        vi_data.insert("datasetRef".to_string(), serde_json::json!("ds_v1"));

        g.load_snapshot(EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                NodeDef {
                    id: "vi".into(),
                    block_type: "vectorInput".into(),
                    data: vi_data,
                },
                op_node("sum", "vectorSum"),
            ],
            edges: vec![edge("e1", "vi", "out", "sum", "vec")],
        });

        let result = g.evaluate_dirty();
        // vectorSum of [10, 20, 30] = 60
        assert_eq!(
            result.changed_values.get("sum").unwrap().as_scalar(),
            Some(60.0)
        );
    }

    #[test]
    fn add_edge_re_evaluates_target() {
        let mut g = EngineGraph::new();
        g.load_snapshot(EngineSnapshotV1 {
            version: 1,
            nodes: vec![num_node("n1", 5.0), op_node("disp", "display")],
            edges: vec![],
        });
        g.evaluate_dirty();

        // disp has no input → NaN. Now connect n1 → disp.
        g.apply_patch(vec![PatchOp::AddEdge {
            edge: edge("e1", "n1", "out", "disp", "value"),
        }]);

        let result = g.evaluate_dirty();
        assert_eq!(
            result.changed_values.get("disp").unwrap().as_scalar(),
            Some(5.0)
        );
    }

    #[test]
    fn remove_edge_re_evaluates_target() {
        let mut g = EngineGraph::new();
        g.load_snapshot(EngineSnapshotV1 {
            version: 1,
            nodes: vec![num_node("n1", 5.0), op_node("disp", "display")],
            edges: vec![edge("e1", "n1", "out", "disp", "value")],
        });
        g.evaluate_dirty();
        assert_eq!(g.values.get("disp").unwrap().as_scalar(), Some(5.0));

        // Remove the edge → disp goes to NaN.
        g.apply_patch(vec![PatchOp::RemoveEdge {
            edge_id: "e1".to_string(),
        }]);

        let result = g.evaluate_dirty();
        assert!(result.changed_values.contains_key("disp"));
    }

    // ── W9.3: Trace tests ──────────────────────────────────────────

    #[test]
    fn trace_mode_collects_entries() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        let opts = EvalOptions {
            trace: true,
            ..Default::default()
        };
        let result = g.evaluate_dirty_with_options(&opts);
        assert!(result.trace.is_some());
        let trace = result.trace.unwrap();
        assert_eq!(trace.len(), 3); // n1, n2, add
    }

    #[test]
    fn trace_off_by_default() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        let result = g.evaluate_dirty();
        assert!(result.trace.is_none());
    }

    #[test]
    fn max_trace_nodes_caps() {
        let mut g = EngineGraph::new();
        g.load_snapshot(snapshot_3_plus_4());
        let opts = EvalOptions {
            trace: true,
            max_trace_nodes: Some(2),
            ..Default::default()
        };
        let result = g.evaluate_dirty_with_options(&opts);
        assert_eq!(result.trace.unwrap().len(), 2);
    }

    // ── W9.3: Partial / callback tests ─────────────────────────────

    #[test]
    fn callback_abort_produces_partial_result() {
        // 5 nodes in chain: n1 → neg1 → neg2 → neg3 → neg4
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 1.0),
                op_node("neg1", "negate"),
                op_node("neg2", "negate"),
                op_node("neg3", "negate"),
                op_node("neg4", "negate"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "neg1", "a"),
                edge("e2", "neg1", "out", "neg2", "a"),
                edge("e3", "neg2", "out", "neg3", "a"),
                edge("e4", "neg3", "out", "neg4", "a"),
            ],
        };

        let mut g = EngineGraph::new();
        g.load_snapshot(snap);

        // Abort after evaluating 2 nodes.
        let mut count = 0;
        let result =
            g.evaluate_dirty_with_callback(&EvalOptions::default(), |_eval, _total| {
                count += 1;
                if count >= 2 {
                    EvalSignal::Abort
                } else {
                    EvalSignal::Continue
                }
            });

        assert!(result.partial);
        assert_eq!(result.evaluated_count, 2);
    }

    #[test]
    fn partial_resumable() {
        // Same chain as above, abort after 2, then resume.
        let snap = EngineSnapshotV1 {
            version: 1,
            nodes: vec![
                num_node("n1", 1.0),
                op_node("neg1", "negate"),
                op_node("neg2", "negate"),
                op_node("neg3", "negate"),
                op_node("neg4", "negate"),
            ],
            edges: vec![
                edge("e1", "n1", "out", "neg1", "a"),
                edge("e2", "neg1", "out", "neg2", "a"),
                edge("e3", "neg2", "out", "neg3", "a"),
                edge("e4", "neg3", "out", "neg4", "a"),
            ],
        };

        let mut g = EngineGraph::new();
        g.load_snapshot(snap);

        // Abort after 2 nodes.
        let mut count = 0;
        g.evaluate_dirty_with_callback(&EvalOptions::default(), |_eval, _total| {
            count += 1;
            if count >= 2 {
                EvalSignal::Abort
            } else {
                EvalSignal::Continue
            }
        });

        // Resume — remaining dirty nodes should be evaluated.
        let result = g.evaluate_dirty();
        assert_eq!(result.evaluated_count, 3); // remaining 3 nodes
        assert!(!result.partial);
    }

    #[test]
    fn dataset_introspection_counts() {
        let mut g = EngineGraph::new();
        assert_eq!(g.dataset_count(), 0);
        assert_eq!(g.dataset_total_bytes(), 0);

        g.register_dataset("a".into(), vec![1.0; 1000]);
        assert_eq!(g.dataset_count(), 1);
        assert_eq!(g.dataset_total_bytes(), 8000);

        g.register_dataset("b".into(), vec![2.0; 500]);
        assert_eq!(g.dataset_count(), 2);
        assert_eq!(g.dataset_total_bytes(), 12000);

        g.release_dataset("a");
        assert_eq!(g.dataset_count(), 1);
        assert_eq!(g.dataset_total_bytes(), 4000);

        g.release_dataset("b");
        assert_eq!(g.dataset_count(), 0);
        assert_eq!(g.dataset_total_bytes(), 0);
    }

    #[test]
    fn release_nonexistent_dataset_is_noop() {
        let mut g = EngineGraph::new();
        g.release_dataset("nope"); // should not panic
        assert_eq!(g.dataset_count(), 0);
    }
}
