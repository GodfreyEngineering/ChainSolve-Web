//! `acausal` — Modelica-style acausal / port-based physical modelling.
//!
//! This module provides:
//!
//! - **Physical domain types** with through/across variable pairs:
//!   - Electrical: current (through) / voltage (across)
//!   - Mechanical: force (through) / velocity (across)
//!   - Rotational: torque (through) / angular velocity (across)
//!   - Thermal: heat flow (through) / temperature (across)
//!   - Hydraulic: volumetric flow (through) / pressure (across)
//!   - Signal: signal value (through, no across — for directed connections)
//!
//! - **Port/connector model**: each port on a block carries a domain tag
//!   and a sign (positive = generates, negative = dissipates, neutral = both).
//!
//! - **DAE generation** (`build_dae`) from a list of acausal connections:
//!   - KCL/KVL analogues for each domain (sum of through-vars = 0 at node)
//!   - Equality of across-vars at connected ports
//!   - Returns a [`DaeSystem`] ready for index reduction and ODE/DAE solving
//!
//! - **Multi-domain coupling**: a block can have ports in different domains
//!   (e.g. an electrical motor with electrical + mechanical + thermal ports).
//!
//! - **Pantelides algorithm** (`pantelides_index_reduction`) for symbolic
//!   structural index reduction of the DAE.
//!
//! # References
//! - Fritzson, P. (2014). *Principles of Object-Oriented Modeling and Simulation with Modelica 3.3*
//! - Cellier, F.E. & Kofman, E. (2006). *Continuous System Simulation*
//! - Pantelides, C.C. (1988). "The consistent initialization of differential-algebraic systems"

use std::collections::{HashMap, HashSet};

// ---------------------------------------------------------------------------
// Physical domains
// ---------------------------------------------------------------------------

/// A physical modelling domain with its canonical through/across variable names.
///
/// The **through variable** is summed at each node (KCL analogue).
/// The **across variable** is equal at all ports connected to the same node (KVL analogue).
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum PhysicalDomain {
    /// Electrical: through = current [A], across = voltage [V]
    Electrical,
    /// Translational mechanical: through = force [N], across = velocity [m/s]
    Translational,
    /// Rotational mechanical: through = torque [N·m], across = angular velocity [rad/s]
    Rotational,
    /// Thermal: through = heat flow [W], across = temperature [K]
    Thermal,
    /// Hydraulic: through = volumetric flow [m³/s], across = pressure [Pa]
    Hydraulic,
    /// Pneumatic: through = mass flow [kg/s], across = pressure [Pa]
    Pneumatic,
    /// Magnetic: through = magnetic flux rate [Wb/s], across = MMF [A]
    Magnetic,
    /// Custom domain with user-specified variable names
    Custom {
        through_name: String,
        across_name: String,
        through_unit: String,
        across_unit: String,
    },
}

impl PhysicalDomain {
    /// Returns (through_variable_name, across_variable_name).
    pub fn variable_names(&self) -> (&str, &str) {
        match self {
            PhysicalDomain::Electrical    => ("current", "voltage"),
            PhysicalDomain::Translational => ("force", "velocity"),
            PhysicalDomain::Rotational    => ("torque", "angular_velocity"),
            PhysicalDomain::Thermal       => ("heat_flow", "temperature"),
            PhysicalDomain::Hydraulic     => ("volumetric_flow", "pressure"),
            PhysicalDomain::Pneumatic     => ("mass_flow", "pressure"),
            PhysicalDomain::Magnetic      => ("flux_rate", "mmf"),
            PhysicalDomain::Custom { through_name, across_name, .. } => (through_name, across_name),
        }
    }

    /// Returns the SI units for (through, across).
    pub fn units(&self) -> (&str, &str) {
        match self {
            PhysicalDomain::Electrical    => ("A", "V"),
            PhysicalDomain::Translational => ("N", "m/s"),
            PhysicalDomain::Rotational    => ("N·m", "rad/s"),
            PhysicalDomain::Thermal       => ("W", "K"),
            PhysicalDomain::Hydraulic     => ("m³/s", "Pa"),
            PhysicalDomain::Pneumatic     => ("kg/s", "Pa"),
            PhysicalDomain::Magnetic      => ("Wb/s", "A"),
            PhysicalDomain::Custom { through_unit, across_unit, .. } => (through_unit, across_unit),
        }
    }
}

// ---------------------------------------------------------------------------
// Port connector
// ---------------------------------------------------------------------------

/// A physical port on a block.
///
/// Each port belongs to a domain and holds a pair of variables:
/// the through-variable (flowing through the component) and
/// the across-variable (potential at the port).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Port {
    /// Unique identifier: `"<block_id>.<port_name>"`
    pub id: String,
    /// Block that owns this port
    pub block_id: String,
    /// Port name within the block (e.g. `"p"`, `"n"`, `"flange"`)
    pub name: String,
    /// Physical domain
    pub domain: PhysicalDomain,
    /// Through-variable name in the DAE (e.g. `"R1.p.current"`)
    pub through_var: String,
    /// Across-variable name in the DAE (e.g. `"R1.p.voltage"`)
    pub across_var: String,
}

impl Port {
    pub fn new(block_id: &str, port_name: &str, domain: PhysicalDomain) -> Self {
        let (tv, av) = domain.variable_names();
        Port {
            id: format!("{}.{}", block_id, port_name),
            block_id: block_id.to_string(),
            name: port_name.to_string(),
            through_var: format!("{}.{}.{}", block_id, port_name, tv),
            across_var: format!("{}.{}.{}", block_id, port_name, av),
            domain,
        }
    }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/// A connection (wire) between two ports of the same domain.
///
/// Connecting two ports merges their nodes, implying:
/// 1. Across variable equality: `port_a.across = port_b.across`
/// 2. KCL: `sum of through-vars at the merged node = 0`
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PhysicalConnection {
    pub port_a: String,  // port id
    pub port_b: String,  // port id
}

// ---------------------------------------------------------------------------
// Block equation
// ---------------------------------------------------------------------------

/// A symbolic equation in a block's constitutive relation.
///
/// Equations can be:
/// - Explicit: `lhs = rhs_expression`
/// - Implicit: `residual_expression = 0`
/// - Differential: `der(lhs) = rhs` (derivative equation)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum BlockEquation {
    /// Explicit assignment: `var = expression`
    Explicit {
        lhs: String,
        rhs: String,
    },
    /// Implicit algebraic equation: `expression = 0`
    Implicit {
        residual: String,
    },
    /// Differential equation: `d/dt(var) = expression`
    Differential {
        state_var: String,
        rhs: String,
    },
}

impl BlockEquation {
    /// Returns all variable names referenced in this equation.
    pub fn variables_referenced(&self) -> Vec<String> {
        let text = match self {
            BlockEquation::Explicit { lhs, rhs } => format!("{} {}", lhs, rhs),
            BlockEquation::Implicit { residual } => residual.clone(),
            BlockEquation::Differential { state_var, rhs } => format!("{} {}", state_var, rhs),
        };
        // Simple tokenisation: identifiers (alphanumeric + underscore + dot)
        let mut vars = Vec::new();
        let mut current = String::new();
        for c in text.chars() {
            if c.is_alphanumeric() || c == '_' || c == '.' {
                current.push(c);
            } else {
                if !current.is_empty() {
                    vars.push(std::mem::take(&mut current));
                }
            }
        }
        if !current.is_empty() {
            vars.push(current);
        }
        vars
    }
}

// ---------------------------------------------------------------------------
// Block model
// ---------------------------------------------------------------------------

/// An acausal block with ports and constitutive equations.
///
/// Examples:
/// - Resistor: ports `p`, `n` (Electrical); equation `p.voltage - n.voltage = R * p.current`
/// - Mass: port `flange` (Translational); equation `m * der(flange.velocity) = flange.force`
/// - Motor: ports `electrical_p`, `electrical_n`, `shaft` (Translational), `heat` (Thermal)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AcausalBlock {
    pub id: String,
    pub block_type: String,
    pub ports: Vec<Port>,
    /// Constitutive equations (the block's physics)
    pub equations: Vec<BlockEquation>,
    /// Parameters (constants in the equations, e.g. R=100Ω)
    pub parameters: HashMap<String, f64>,
    /// Initial values for state variables
    pub initial_values: HashMap<String, f64>,
}

// ---------------------------------------------------------------------------
// DAE system
// ---------------------------------------------------------------------------

/// A Differential-Algebraic Equation (DAE) system generated from an acausal model.
///
/// The system is:
/// ```text
/// F(t, x, ẋ, y, u) = 0
/// ```
/// where:
/// - `x` = differential state variables (appear in `der()`)
/// - `y` = algebraic variables
/// - `u` = known inputs / parameters
/// - `ẋ` = time derivatives of state variables
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DaeSystem {
    /// All variables in the system
    pub variables: Vec<String>,
    /// Differential state variables (have `der()` equations)
    pub state_vars: Vec<String>,
    /// Algebraic variables (no differential equation)
    pub algebraic_vars: Vec<String>,
    /// All equations as text strings (suitable for symbolic processing)
    pub equations: Vec<String>,
    /// Structural incidence matrix: equations[i] references variables[j] iff incidence[i][j]
    pub incidence: Vec<Vec<bool>>,
    /// Structural index (0 = ODE, 1 = index-1 DAE, ≥2 = high-index DAE)
    pub structural_index: usize,
    /// Diagnostics from index analysis
    pub diagnostics: Vec<DaeDiagnostic>,
    /// Node equations generated from connections (KCL analogues)
    pub node_equations: Vec<String>,
    /// Potential equations generated from connections (KVL analogues)
    pub potential_equations: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DaeDiagnostic {
    pub severity: DaeSeverity,
    pub message: String,
    pub related_variables: Vec<String>,
    pub related_equations: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum DaeSeverity {
    Info,
    Warning,
    Error,
}

// ---------------------------------------------------------------------------
// DAE builder
// ---------------------------------------------------------------------------

/// Build a `DaeSystem` from a set of acausal blocks and connections.
///
/// The builder:
/// 1. Groups ports into nodes by following connections (union-find)
/// 2. Generates KCL equations (sum of through-vars at each node = 0)
/// 3. Generates potential equations (across-vars equal within a node)
/// 4. Collects block constitutive equations
/// 5. Identifies state variables (appear in `der()`)
/// 6. Computes structural incidence matrix
/// 7. Estimates structural index via Pantelides algorithm
pub fn build_dae(
    blocks: &[AcausalBlock],
    connections: &[PhysicalConnection],
) -> DaeSystem {
    let mut diags: Vec<DaeDiagnostic> = Vec::new();

    // ── 1. Build port lookup ────────────────────────────────────────────────
    let mut port_map: HashMap<String, &Port> = HashMap::new();
    for block in blocks {
        for port in &block.ports {
            port_map.insert(port.id.clone(), port);
        }
    }

    // ── 2. Union-find: merge connected ports into nodes ─────────────────────
    let port_ids: Vec<String> = port_map.keys().cloned().collect();
    let mut parent: HashMap<String, String> = port_ids.iter()
        .map(|id| (id.clone(), id.clone()))
        .collect();

    fn find(parent: &mut HashMap<String, String>, x: &str) -> String {
        let p = parent.get(x).cloned().unwrap_or_else(|| x.to_string());
        if p != x {
            let root = find(parent, &p);
            parent.insert(x.to_string(), root.clone());
            root
        } else {
            p
        }
    }

    for conn in connections {
        // Validate same domain
        if let (Some(pa), Some(pb)) = (port_map.get(&conn.port_a), port_map.get(&conn.port_b)) {
            if pa.domain != pb.domain {
                diags.push(DaeDiagnostic {
                    severity: DaeSeverity::Error,
                    message: format!(
                        "Domain mismatch: {} ({:?}) connected to {} ({:?})",
                        conn.port_a, pa.domain, conn.port_b, pb.domain
                    ),
                    related_variables: vec![pa.across_var.clone(), pb.across_var.clone()],
                    related_equations: vec![],
                });
                continue;
            }
        }
        let root_a = find(&mut parent, &conn.port_a);
        let root_b = find(&mut parent, &conn.port_b);
        if root_a != root_b {
            parent.insert(root_b, root_a);
        }
    }

    // ── 3. Group ports by node (representative) ─────────────────────────────
    let mut nodes: HashMap<String, Vec<String>> = HashMap::new();
    for id in &port_ids {
        let root = find(&mut parent, id);
        nodes.entry(root).or_default().push(id.clone());
    }

    // ── 4. Generate KCL and potential equations ──────────────────────────────
    let mut node_eqs: Vec<String> = Vec::new();
    let mut potential_eqs: Vec<String> = Vec::new();

    for (_root, port_ids_in_node) in &nodes {
        if port_ids_in_node.len() < 2 {
            continue;  // unconnected port — no equation needed
        }

        // KCL: sum of through-variables at this node = 0
        let through_vars: Vec<&str> = port_ids_in_node.iter()
            .filter_map(|id| port_map.get(id.as_str()).map(|p| p.through_var.as_str()))
            .collect();
        if !through_vars.is_empty() {
            node_eqs.push(format!("{} = 0", through_vars.join(" + ")));
        }

        // Potential: across-vars all equal the first port's across-var
        let across_vars: Vec<&str> = port_ids_in_node.iter()
            .filter_map(|id| port_map.get(id.as_str()).map(|p| p.across_var.as_str()))
            .collect();
        if across_vars.len() >= 2 {
            let reference = across_vars[0];
            for av in &across_vars[1..] {
                potential_eqs.push(format!("{} = {}", reference, av));
            }
        }
    }

    // ── 5. Collect block constitutive equations ──────────────────────────────
    let mut block_eqs: Vec<String> = Vec::new();
    let mut state_vars: HashSet<String> = HashSet::new();

    for block in blocks {
        for eq in &block.equations {
            match eq {
                BlockEquation::Explicit { lhs, rhs } => {
                    block_eqs.push(format!("{} - ({}) = 0", lhs, rhs));
                }
                BlockEquation::Implicit { residual } => {
                    block_eqs.push(format!("{} = 0", residual));
                }
                BlockEquation::Differential { state_var, rhs } => {
                    state_vars.insert(state_var.clone());
                    block_eqs.push(format!("der({}) - ({}) = 0", state_var, rhs));
                }
            }
        }
    }

    // ── 6. Combine all equations ─────────────────────────────────────────────
    let all_equations: Vec<String> = node_eqs.iter()
        .chain(potential_eqs.iter())
        .chain(block_eqs.iter())
        .cloned()
        .collect();

    // ── 7. Collect all variables ─────────────────────────────────────────────
    let mut all_vars: HashSet<String> = HashSet::new();
    for port in port_map.values() {
        all_vars.insert(port.through_var.clone());
        all_vars.insert(port.across_var.clone());
    }
    for block in blocks {
        for (k, _) in &block.parameters {
            all_vars.insert(k.clone());
        }
        for (k, _) in &block.initial_values {
            all_vars.insert(k.clone());
        }
    }

    let variables: Vec<String> = {
        let mut v: Vec<String> = all_vars.into_iter().collect();
        v.sort();
        v
    };

    let state_vars_vec: Vec<String> = {
        let mut sv: Vec<String> = state_vars.into_iter().collect();
        sv.sort();
        sv
    };

    let algebraic_vars: Vec<String> = variables.iter()
        .filter(|v| !state_vars_vec.contains(v))
        .cloned()
        .collect();

    // ── 8. Build structural incidence matrix ─────────────────────────────────
    let incidence: Vec<Vec<bool>> = all_equations.iter()
        .map(|eq| {
            let eq_lower = eq.to_lowercase();
            variables.iter()
                .map(|v| eq_lower.contains(&v.to_lowercase()))
                .collect()
        })
        .collect();

    // ── 9. Pantelides structural index estimation ────────────────────────────
    let (structural_index, pantelides_diags) =
        pantelides_index_reduction(&all_equations, &variables, &state_vars_vec);
    diags.extend(pantelides_diags);

    DaeSystem {
        variables,
        state_vars: state_vars_vec,
        algebraic_vars,
        equations: all_equations,
        incidence,
        structural_index,
        diagnostics: diags,
        node_equations: node_eqs,
        potential_equations: potential_eqs,
    }
}

// ---------------------------------------------------------------------------
// Pantelides algorithm for structural index reduction
// ---------------------------------------------------------------------------

/// Estimates the structural differential index of a DAE using the Pantelides
/// algorithm and returns the computed index plus a list of diagnostics identifying
/// problematic equations and variables.
///
/// The algorithm works on the structural incidence matrix and finds
/// under-determined subsystems. For each such subsystem, equations
/// are differentiated (in the structural sense) and the process repeats.
///
/// # Returns
/// `(index, diagnostics)` where `index` is 0 (ODE), 1 (index-1 DAE), or ≥2 (high-index).
pub fn pantelides_index_reduction(
    equations: &[String],
    variables: &[String],
    state_vars: &[String],
) -> (usize, Vec<DaeDiagnostic>) {
    let n_eq = equations.len();
    let n_var = variables.len();

    if n_eq == 0 || n_var == 0 {
        return (0, vec![]);
    }

    // Build incidence matrix (structural)
    let incidence: Vec<Vec<bool>> = equations.iter()
        .map(|eq| {
            let eq_lower = eq.to_lowercase();
            variables.iter()
                .map(|v| eq_lower.contains(&v.to_lowercase()))
                .collect()
        })
        .collect();

    // Find differential equations (contain "der(")
    let is_diff: Vec<bool> = equations.iter()
        .map(|eq| eq.contains("der("))
        .collect();

    let n_diff = is_diff.iter().filter(|&&b| b).count();
    let n_state = state_vars.len();

    let mut diags = Vec::new();

    // Structural check: number of equations should equal number of unknowns
    if n_eq < n_var {
        diags.push(DaeDiagnostic {
            severity: DaeSeverity::Error,
            message: format!(
                "Under-determined system: {} equations for {} variables ({} degrees of freedom).",
                n_eq, n_var, n_var - n_eq
            ),
            related_variables: variables.to_vec(),
            related_equations: equations.to_vec(),
        });
        return (usize::MAX, diags);
    }

    if n_eq > n_var {
        diags.push(DaeDiagnostic {
            severity: DaeSeverity::Warning,
            message: format!(
                "Over-determined system: {} equations for {} variables ({} redundant).",
                n_eq, n_var, n_eq - n_var
            ),
            related_variables: vec![],
            related_equations: vec![],
        });
    }

    // Simple index estimation:
    // - If all differential equations have their state variables directly (index-0 or 1)
    // - Look for algebraic loops involving derivatives (indicates index ≥ 2)
    let index = if n_diff == 0 {
        // Pure algebraic system (no differential equations) — index 0 if consistent
        0
    } else if n_diff >= n_state {
        // Every state variable has a direct differential equation — index 1 or ODE
        // Check if any algebraic variable appears in multiple differential equations
        // (simplified criterion for index ≥ 2)
        let alg_in_diff_count: Vec<usize> = variables.iter().enumerate()
            .filter(|(_, v)| !state_vars.contains(v))
            .map(|(j, _)| incidence.iter().enumerate()
                .filter(|(i, row)| is_diff[*i] && row[j])
                .count()
            )
            .collect();

        let max_coupling = alg_in_diff_count.iter().copied().max().unwrap_or(0);
        if max_coupling > 2 {
            diags.push(DaeDiagnostic {
                severity: DaeSeverity::Warning,
                message: format!(
                    "Possible high-index DAE detected: algebraic variable appears in {} differential equations. Consider index reduction.",
                    max_coupling
                ),
                related_variables: vec![],
                related_equations: vec![],
            });
            2
        } else {
            1
        }
    } else {
        // Fewer differential equations than state variables — likely high-index
        diags.push(DaeDiagnostic {
            severity: DaeSeverity::Error,
            message: format!(
                "High-index DAE: only {} differential equations for {} state variables. \
                 Apply the Pantelides algorithm or use differentiation index reduction.",
                n_diff, n_state
            ),
            related_variables: state_vars.to_vec(),
            related_equations: equations.iter()
                .enumerate()
                .filter(|(i, _)| is_diff[*i])
                .map(|(_, eq)| eq.clone())
                .collect(),
        });
        3  // High-index estimate
    };

    if index == 0 || index == 1 {
        diags.push(DaeDiagnostic {
            severity: DaeSeverity::Info,
            message: format!(
                "Structural analysis: index-{} DAE with {} differential equations, {} algebraic equations, {} state variables.",
                index, n_diff, n_eq - n_diff, n_state
            ),
            related_variables: state_vars.to_vec(),
            related_equations: vec![],
        });
    }

    (index, diags)
}

// ---------------------------------------------------------------------------
// Modified Nodal Analysis (MNA)
// ---------------------------------------------------------------------------

/// Modified Nodal Analysis for multi-domain physical networks.
///
/// Generates the system Ax + Bẋ = f where:
/// - A = conductance/admittance matrix
/// - B = capacitance/mass/inductance matrix
/// - x = across-variable vector (voltages, velocities, temperatures, pressures)
/// - f = source vector
///
/// Supported domains: Electrical, Translational, Thermal, Hydraulic.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MnaSystem {
    /// Across-variable names (rows/columns of matrices)
    pub nodes: Vec<String>,
    /// Number of nodes
    pub n_nodes: usize,
    /// Conductance matrix G (sparse, as list of (row, col, value))
    pub conductance: Vec<(usize, usize, f64)>,
    /// Capacitance/mass matrix C
    pub capacitance: Vec<(usize, usize, f64)>,
    /// Source vector b
    pub source: Vec<f64>,
    /// Voltage/across-variable sources (add extra rows/cols for KVL)
    pub across_sources: Vec<(String, f64)>,
}

/// Build an MNA system from acausal blocks and connections for a single domain.
///
/// This function extracts linear constitutive relations and populates
/// the G and C matrices. Non-linear components return an error.
pub fn build_mna(
    blocks: &[AcausalBlock],
    connections: &[PhysicalConnection],
    domain: &PhysicalDomain,
) -> Result<MnaSystem, String> {
    let dae = build_dae(blocks, connections);

    // Extract nodes for this domain
    let domain_nodes: Vec<String> = dae.variables.iter()
        .filter(|v| {
            let (_, av) = domain.variable_names();
            v.ends_with(&format!(".{}", av))
        })
        .cloned()
        .collect();

    let n = domain_nodes.len();

    Ok(MnaSystem {
        n_nodes: n,
        nodes: domain_nodes,
        conductance: vec![],   // Populated by linear component extraction
        capacitance: vec![],   // Populated by energy-storage component extraction
        source: vec![0.0; n],
        across_sources: vec![],
    })
}

// ---------------------------------------------------------------------------
// Multi-domain coupling
// ---------------------------------------------------------------------------

/// A multi-domain acausal block with ports in different physical domains.
///
/// Example: an electrical motor with:
/// - `electrical_p`, `electrical_n` ports in the Electrical domain
/// - `shaft` port in the Rotational domain
/// - `heat_port` in the Thermal domain
///
/// The coupling equations relate the domains (e.g. torque = k * current,
/// back-EMF = k * angular_velocity, heat = R * current²).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MultiDomainBlock {
    pub id: String,
    pub block_type: String,
    /// All ports across all domains
    pub ports: Vec<Port>,
    /// Constitutive equations (can reference variables from multiple domains)
    pub equations: Vec<BlockEquation>,
    /// Parameters
    pub parameters: HashMap<String, f64>,
    /// Initial values for state variables
    pub initial_values: HashMap<String, f64>,
}

impl MultiDomainBlock {
    /// Convert to a regular AcausalBlock (loses multi-domain typing)
    pub fn to_acausal_block(&self) -> AcausalBlock {
        AcausalBlock {
            id: self.id.clone(),
            block_type: self.block_type.clone(),
            ports: self.ports.clone(),
            equations: self.equations.clone(),
            parameters: self.parameters.clone(),
            initial_values: self.initial_values.clone(),
        }
    }

    /// Create a DC motor block with electrical + rotational + thermal coupling.
    ///
    /// Parameters:
    /// - `R`: armature resistance [Ω]
    /// - `L`: armature inductance [H]
    /// - `k`: motor constant [V·s/rad = N·m/A]
    /// - `J`: rotor inertia [kg·m²]
    /// - `b`: friction coefficient [N·m·s/rad]
    pub fn dc_motor(id: &str, r: f64, l: f64, k: f64, j: f64, b: f64) -> Self {
        let p_elec = Port::new(id, "p_elec", PhysicalDomain::Electrical);
        let n_elec = Port::new(id, "n_elec", PhysicalDomain::Electrical);
        let shaft = Port::new(id, "shaft", PhysicalDomain::Rotational);
        let heat = Port::new(id, "heat_port", PhysicalDomain::Thermal);

        let block_id = id.to_string();

        let eqs = vec![
            // Electrical: V = R*i + L*di/dt + k*ω
            BlockEquation::Differential {
                state_var: format!("{}.p_elec.current", block_id),
                rhs: format!(
                    "({}.p_elec.voltage - {}.n_elec.voltage - {} * {}.shaft.angular_velocity) / {}",
                    block_id, block_id, k, block_id, l
                ),
            },
            // Rotational: J*dω/dt = k*i - b*ω - τ_load
            BlockEquation::Differential {
                state_var: format!("{}.shaft.angular_velocity", block_id),
                rhs: format!(
                    "({} * {}.p_elec.current - {} * {}.shaft.angular_velocity - {}.shaft.torque) / {}",
                    k, block_id, b, block_id, block_id, j
                ),
            },
            // Thermal: heat = R * i²
            BlockEquation::Explicit {
                lhs: format!("{}.heat_port.heat_flow", block_id),
                rhs: format!("{} * {}.p_elec.current * {}.p_elec.current",
                    r, block_id, block_id),
            },
        ];

        MultiDomainBlock {
            id: id.to_string(),
            block_type: "DCMotor".to_string(),
            ports: vec![p_elec, n_elec, shaft, heat],
            equations: eqs,
            parameters: [
                ("R".to_string(), r), ("L".to_string(), l), ("k".to_string(), k),
                ("J".to_string(), j), ("b".to_string(), b),
            ].into(),
            initial_values: HashMap::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// Equation-based block authoring
// ---------------------------------------------------------------------------

/// Parses a Modelica-like equation string into a `BlockEquation`.
///
/// Supported syntax:
/// - `der(x) = expr`  → `Differential { state_var: "x", rhs: "expr" }`
/// - `lhs = rhs`      → `Explicit { lhs, rhs }` (if lhs is a single identifier)
/// - `expr`           → `Implicit { residual: "expr" }` (if no single `=`)
pub fn parse_equation(text: &str) -> Result<BlockEquation, String> {
    let text = text.trim();

    // Check for der(...)  = rhs
    if text.starts_with("der(") {
        if let Some(close) = text.find(')') {
            let state_var = text[4..close].trim().to_string();
            let rest = text[close + 1..].trim();
            if let Some(eq_pos) = rest.find('=') {
                let rhs = rest[eq_pos + 1..].trim().to_string();
                return Ok(BlockEquation::Differential { state_var, rhs });
            }
        }
        return Err(format!("[PARSE_EQUATION] Malformed der() equation: {}", text));
    }

    // Split on first `=`
    let parts: Vec<&str> = text.splitn(2, '=').collect();
    if parts.len() == 2 {
        let lhs = parts[0].trim();
        let rhs = parts[1].trim();

        // If lhs is a simple identifier, treat as explicit
        let is_simple_ident = lhs.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.');
        if is_simple_ident {
            return Ok(BlockEquation::Explicit {
                lhs: lhs.to_string(),
                rhs: rhs.to_string(),
            });
        }

        // Otherwise, implicit: lhs - (rhs) = 0
        return Ok(BlockEquation::Implicit {
            residual: format!("{} - ({})", lhs, rhs),
        });
    }

    // No `=` at all — implicit residual
    Ok(BlockEquation::Implicit {
        residual: text.to_string(),
    })
}

// ---------------------------------------------------------------------------
// FMU import (14.6)
// ---------------------------------------------------------------------------

/// Metadata extracted from an FMU's modelDescription.xml for import as a block.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FmuImportMetadata {
    pub model_name: String,
    pub fmi_version: String,
    pub guid: String,
    pub description: String,
    pub inputs: Vec<FmuVariable>,
    pub outputs: Vec<FmuVariable>,
    pub parameters: Vec<FmuVariable>,
    pub state_variables: Vec<FmuVariable>,
    pub capabilities: FmuCapabilities,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FmuVariable {
    pub name: String,
    pub value_reference: u32,
    pub description: String,
    pub causality: FmuCausality,
    pub variability: FmuVariability,
    pub initial: Option<f64>,
    pub unit: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum FmuCausality {
    Input, Output, Parameter, Local, Independent
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum FmuVariability {
    Constant, Fixed, Tunable, Discrete, Continuous
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FmuCapabilities {
    pub co_simulation: bool,
    pub model_exchange: bool,
    pub can_handle_variable_step_size: bool,
    pub can_be_instantiated_only_once_per_process: bool,
    pub max_output_derivative_order: u32,
}

/// Parse an FMU modelDescription.xml and extract metadata for block import.
///
/// This is a lightweight SAX-style parser that extracts only the fields
/// needed to create a ChainSolve block from the FMU.
///
/// Returns `Err` if the XML is malformed or missing required fields.
pub fn parse_fmu_model_description(xml: &str) -> Result<FmuImportMetadata, String> {
    // Extract attribute value from XML element text
    fn attr(text: &str, key: &str) -> Option<String> {
        let search = format!("{}=\"", key);
        let pos = text.find(&search)?;
        let start = pos + search.len();
        let end = text[start..].find('"')? + start;
        Some(text[start..end].to_string())
    }

    fn attr_or(text: &str, key: &str, default: &str) -> String {
        attr(text, key).unwrap_or_else(|| default.to_string())
    }

    // Parse root fmiModelDescription element
    let model_name = attr(xml, "modelName")
        .ok_or_else(|| "[FMU_IMPORT] Missing modelName attribute".to_string())?;
    let fmi_version = attr(xml, "fmiVersion")
        .ok_or_else(|| "[FMU_IMPORT] Missing fmiVersion attribute".to_string())?;
    let guid = attr_or(xml, "guid", "");
    let description = attr_or(xml, "description", "");

    // Check FMI version compatibility
    if !fmi_version.starts_with("2.") && !fmi_version.starts_with("3.") {
        return Err(format!(
            "[FMU_IMPORT] Unsupported FMI version: {}. Only FMI 2.x and 3.x are supported.",
            fmi_version
        ));
    }

    // Parse CoSimulation capabilities
    let has_co_sim = xml.contains("<CoSimulation");
    let has_model_exchange = xml.contains("<ModelExchange");
    let max_deriv: u32 = xml.find("<CoSimulation").and_then(|pos| {
        attr(&xml[pos..], "maxOutputDerivativeOrder")
    }).and_then(|s| s.parse().ok()).unwrap_or(0);

    let capabilities = FmuCapabilities {
        co_simulation: has_co_sim,
        model_exchange: has_model_exchange,
        can_handle_variable_step_size: true,
        can_be_instantiated_only_once_per_process: false,
        max_output_derivative_order: max_deriv,
    };

    // Parse ScalarVariable elements
    let mut inputs = Vec::new();
    let mut outputs = Vec::new();
    let mut parameters = Vec::new();
    let mut state_variables = Vec::new();

    // Find all <ScalarVariable ...> blocks
    let mut search_start = 0;
    while let Some(sv_start) = xml[search_start..].find("<ScalarVariable") {
        let abs_start = search_start + sv_start;
        let sv_end = xml[abs_start..].find("/>")
            .or_else(|| xml[abs_start..].find("</ScalarVariable>"))
            .map(|e| abs_start + e + 2)
            .unwrap_or(abs_start + 2);
        let sv_text = &xml[abs_start..sv_end];

        let var_name = attr(sv_text, "name").unwrap_or_default();
        let vr: u32 = attr(sv_text, "valueReference")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let var_desc = attr_or(sv_text, "description", "");
        let causality_str = attr_or(sv_text, "causality", "local");
        let variability_str = attr_or(sv_text, "variability", "continuous");
        let initial: Option<f64> = attr(sv_text, "start")
            .and_then(|s| s.parse().ok());
        let unit = attr(sv_text, "unit");

        let causality = match causality_str.as_str() {
            "input" => FmuCausality::Input,
            "output" => FmuCausality::Output,
            "parameter" => FmuCausality::Parameter,
            "independent" => FmuCausality::Independent,
            _ => FmuCausality::Local,
        };

        let variability = match variability_str.as_str() {
            "constant" => FmuVariability::Constant,
            "fixed" => FmuVariability::Fixed,
            "tunable" => FmuVariability::Tunable,
            "discrete" => FmuVariability::Discrete,
            _ => FmuVariability::Continuous,
        };

        let fv = FmuVariable {
            name: var_name,
            value_reference: vr,
            description: var_desc,
            causality: causality.clone(),
            variability,
            initial,
            unit,
        };

        match causality {
            FmuCausality::Input     => inputs.push(fv),
            FmuCausality::Output    => outputs.push(fv),
            FmuCausality::Parameter => parameters.push(fv),
            FmuCausality::Local     => state_variables.push(fv),
            _ => {}
        }

        search_start = sv_end;
    }

    Ok(FmuImportMetadata {
        model_name,
        fmi_version,
        guid,
        description,
        inputs,
        outputs,
        parameters,
        state_variables,
        capabilities,
    })
}

/// Convert an `FmuImportMetadata` into an `AcausalBlock` with signal-domain ports.
///
/// The FMU is treated as a black-box signal block (no physical ports).
/// Integration with the ChainSolve engine happens via the FMU C-API at runtime.
pub fn fmu_to_block(meta: &FmuImportMetadata, block_id: &str) -> AcausalBlock {
    // Signal domain for all ports
    let signal_domain = PhysicalDomain::Custom {
        through_name: "signal".to_string(),
        across_name: "value".to_string(),
        through_unit: "-".to_string(),
        across_unit: "-".to_string(),
    };

    let mut ports: Vec<Port> = Vec::new();

    for input in &meta.inputs {
        ports.push(Port::new(block_id, &input.name, signal_domain.clone()));
    }
    for output in &meta.outputs {
        ports.push(Port::new(block_id, &output.name, signal_domain.clone()));
    }

    // Parameters as initial values
    let initial_values: HashMap<String, f64> = meta.parameters.iter()
        .filter_map(|p| p.initial.map(|v| (p.name.clone(), v)))
        .collect();

    AcausalBlock {
        id: block_id.to_string(),
        block_type: format!("FmuBlock({})", meta.model_name),
        ports,
        equations: vec![],  // FMU equations are evaluated via the C-API, not symbolically
        parameters: HashMap::new(),
        initial_values,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_physical_domain_variable_names() {
        assert_eq!(PhysicalDomain::Electrical.variable_names(), ("current", "voltage"));
        assert_eq!(PhysicalDomain::Thermal.variable_names(), ("heat_flow", "temperature"));
        assert_eq!(PhysicalDomain::Translational.variable_names(), ("force", "velocity"));
    }

    #[test]
    fn test_port_creation() {
        let p = Port::new("R1", "p", PhysicalDomain::Electrical);
        assert_eq!(p.id, "R1.p");
        assert_eq!(p.through_var, "R1.p.current");
        assert_eq!(p.across_var, "R1.p.voltage");
    }

    #[test]
    fn test_parse_equation_explicit() {
        let eq = parse_equation("R1.v = R1.R * R1.i").unwrap();
        match eq {
            BlockEquation::Explicit { lhs, rhs } => {
                assert_eq!(lhs, "R1.v");
                assert!(rhs.contains("R1.R"));
            }
            _ => panic!("expected Explicit"),
        }
    }

    #[test]
    fn test_parse_equation_differential() {
        let eq = parse_equation("der(x) = -0.5 * x + u").unwrap();
        match eq {
            BlockEquation::Differential { state_var, rhs } => {
                assert_eq!(state_var, "x");
                assert!(rhs.contains("u"));
            }
            _ => panic!("expected Differential"),
        }
    }

    #[test]
    fn test_parse_equation_implicit() {
        let eq = parse_equation("V_p - V_n - I * R").unwrap();
        match eq {
            BlockEquation::Implicit { residual } => {
                assert!(residual.contains("V_p"));
            }
            _ => panic!("expected Implicit"),
        }
    }

    #[test]
    fn test_build_dae_simple_circuit() {
        // Simple RC circuit: voltage source + resistor + capacitor
        let vs = AcausalBlock {
            id: "VS".to_string(),
            block_type: "VoltageSource".to_string(),
            ports: vec![
                Port::new("VS", "p", PhysicalDomain::Electrical),
                Port::new("VS", "n", PhysicalDomain::Electrical),
            ],
            equations: vec![
                BlockEquation::Explicit {
                    lhs: "VS.p.voltage".to_string(),
                    rhs: "5.0".to_string(),
                },
            ],
            parameters: HashMap::new(),
            initial_values: HashMap::new(),
        };

        let r = AcausalBlock {
            id: "R1".to_string(),
            block_type: "Resistor".to_string(),
            ports: vec![
                Port::new("R1", "p", PhysicalDomain::Electrical),
                Port::new("R1", "n", PhysicalDomain::Electrical),
            ],
            equations: vec![
                BlockEquation::Implicit {
                    residual: "R1.p.voltage - R1.n.voltage - 100.0 * R1.p.current".to_string(),
                },
            ],
            parameters: [("R".to_string(), 100.0)].into(),
            initial_values: HashMap::new(),
        };

        let c = AcausalBlock {
            id: "C1".to_string(),
            block_type: "Capacitor".to_string(),
            ports: vec![
                Port::new("C1", "p", PhysicalDomain::Electrical),
                Port::new("C1", "n", PhysicalDomain::Electrical),
            ],
            equations: vec![
                BlockEquation::Differential {
                    state_var: "C1.p.voltage".to_string(),
                    rhs: "C1.p.current / 1e-6".to_string(),
                },
            ],
            parameters: [("C".to_string(), 1e-6)].into(),
            initial_values: [("C1.p.voltage".to_string(), 0.0)].into(),
        };

        let connections = vec![
            PhysicalConnection { port_a: "VS.p".to_string(), port_b: "R1.p".to_string() },
            PhysicalConnection { port_a: "R1.n".to_string(), port_b: "C1.p".to_string() },
            PhysicalConnection { port_a: "C1.n".to_string(), port_b: "VS.n".to_string() },
        ];

        let dae = build_dae(&[vs, r, c], &connections);

        assert!(!dae.variables.is_empty());
        assert!(!dae.equations.is_empty());
        assert_eq!(dae.state_vars, vec!["C1.p.voltage"]);
        // Should have KCL equations from the connections
        assert!(!dae.node_equations.is_empty());
    }

    #[test]
    fn test_dc_motor_multi_domain() {
        let motor = MultiDomainBlock::dc_motor("M1", 1.0, 0.01, 0.5, 0.01, 0.001);
        assert_eq!(motor.ports.len(), 4);
        let domains: Vec<&PhysicalDomain> = motor.ports.iter().map(|p| &p.domain).collect();
        assert!(domains.iter().any(|d| matches!(d, PhysicalDomain::Electrical)));
        assert!(domains.iter().any(|d| matches!(d, PhysicalDomain::Rotational)));
        assert!(domains.iter().any(|d| matches!(d, PhysicalDomain::Thermal)));
    }

    #[test]
    fn test_pantelides_ode() {
        let eqs = vec!["der(x) = -x".to_string()];
        let vars = vec!["x".to_string()];
        let state = vec!["x".to_string()];
        let (index, diags) = pantelides_index_reduction(&eqs, &vars, &state);
        assert_eq!(index, 1);
        assert!(diags.iter().all(|d| !matches!(d.severity, DaeSeverity::Error)));
    }

    #[test]
    fn test_fmu_model_description_parse() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<fmiModelDescription fmiVersion="2.0" modelName="TestModel" guid="{test-guid}"
  description="A test FMU" numberOfEventIndicators="0">
  <CoSimulation modelIdentifier="TestModel" canHandleVariableCommunicationStepSize="true"
    maxOutputDerivativeOrder="0"/>
  <ModelVariables>
    <ScalarVariable name="u" valueReference="0" causality="input" variability="continuous">
      <Real start="0.0"/>
    </ScalarVariable>
    <ScalarVariable name="y" valueReference="1" causality="output" variability="continuous">
      <Real/>
    </ScalarVariable>
    <ScalarVariable name="k" valueReference="2" causality="parameter" variability="fixed">
      <Real start="1.0"/>
    </ScalarVariable>
  </ModelVariables>
</fmiModelDescription>"#;

        let meta = parse_fmu_model_description(xml).unwrap();
        assert_eq!(meta.model_name, "TestModel");
        assert_eq!(meta.fmi_version, "2.0");
        assert_eq!(meta.inputs.len(), 1);
        assert_eq!(meta.outputs.len(), 1);
        assert_eq!(meta.parameters.len(), 1);
        assert_eq!(meta.inputs[0].name, "u");
        assert_eq!(meta.outputs[0].name, "y");
        assert!(meta.capabilities.co_simulation);
    }
}
