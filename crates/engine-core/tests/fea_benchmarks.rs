//! FEA (Finite Element Analysis) benchmark suite (11.10).
//!
//! Implements NAFEMS-inspired benchmark problems for the ChainSolve 2D FEM solver.
//! The solver uses P1 triangular elements on structured meshes with Gauss elimination.
//!
//! Problems verified:
//!   LE1  — Poisson MMS (manufactured solution) — verifies accuracy vs exact solution
//!   LE10 — Mesh convergence — verifies h-convergence rate ≥ O(h) as mesh refines
//!   LE11 — Boundary conditions — exact Dirichlet imposition, constant and non-constant BCs
//!
//! Note: tests use moderate mesh sizes (n ≤ 8) compatible with the dense Gauss solver.
//!
//! Reference: NAFEMS "A Finite Element Primer" (1992).

use engine_core::ode::fem2d::{generate_mesh, solve_fem2d};

// ── NAFEMS LE1 — Poisson MMS on [0,1]² ──────────────────────────────────────
//
// Manufactured solution: u = x*(1-x)*y*(1-y)
// ∇²u = -2y(1-y) - 2x(1-x)
// So −∇²u = 2y(1-y) + 2x(1-x)
// BC: u = 0 on all boundaries (since u=0 when x=0,1 or y=0,1)

/// LE1 Poisson MMS: verify max error < 5e-3 on 8×8 mesh.
#[test]
fn nafems_le1_poisson_mms() {
    let n = 8;
    let result = solve_fem2d(
        0.0, 1.0, 0.0, 1.0, n, n, 1.0,
        "2.0*y*(1.0-y) + 2.0*x*(1.0-x)",
        "0",
    ).unwrap();

    let mut max_err: f64 = 0.0;
    for i in 0..result.nodes.len() {
        let (x, y) = result.nodes[i];
        let u_exact = x * (1.0 - x) * y * (1.0 - y);
        max_err = max_err.max((result.u[i] - u_exact).abs());
    }

    assert!(
        max_err < 5e-3,
        "LE1 MMS (n={n}): max error = {max_err:.4e}, expected < 5e-3"
    );
}

/// LE1 linear manufactured solution: u = x + y.
/// ∇²u = 0, BC: u = x + y on boundary.
/// P1 elements should represent this exactly (linear polynomial).
#[test]
fn nafems_le1_linear_mms_exact() {
    // For linear exact solution with u = x + y (harmonic, no source term),
    // BCs impose u = x + y on boundary, interior should converge to x + y.
    // Use rhs = 0 (Laplace), Dirichlet = "x + y".
    // Note: This tests the non-zero Dirichlet BC — use small mesh n=4.
    let n = 4;
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, n, n, 1.0, "0", "x + y").unwrap();

    // P1 elements interpolate linear functions exactly.
    let mut max_err: f64 = 0.0;
    for i in 0..result.nodes.len() {
        let (x, y) = result.nodes[i];
        let u_exact = x + y;
        max_err = max_err.max((result.u[i] - u_exact).abs());
    }

    assert!(
        max_err < 1e-10,
        "LE1 linear MMS: max error = {max_err:.2e} (expected machine zero for P1 with linear solution)"
    );
}

/// LE1 sine MMS: −∇²u = 2π²sin(πx)sin(πy), u=0 on boundary.
/// Exact: u = sin(πx)sin(πy).
/// Verify max error < 0.05 on 6×6 mesh.
#[test]
fn nafems_le1_sine_mms() {
    // Use built-in 'pi' constant in expression (evaluator supports it as std::f64::consts::PI)
    let rhs = "2.0 * pi * pi * sin(pi * x) * sin(pi * y)";
    let n = 6;
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, n, n, 1.0, rhs, "0").unwrap();

    let pi = std::f64::consts::PI;
    // Exact solution: u = sin(πx)sin(πy)
    let mut max_err: f64 = 0.0;
    for i in 0..result.nodes.len() {
        let (x, y) = result.nodes[i];
        let u_exact = (pi * x).sin() * (pi * y).sin();
        max_err = max_err.max((result.u[i] - u_exact).abs());
    }

    // P1 on 6×6 mesh: O(h²) with h=1/6; allow 0.05
    assert!(
        max_err < 0.05,
        "LE1 sine MMS (n={n}): max error = {max_err:.4e}, expected < 0.05"
    );
}

// ── NAFEMS LE10 — Mesh convergence study ─────────────────────────────────────
//
// Verify that the FEM solver achieves convergence as mesh size decreases.
// For P1 elements: error should decrease as mesh refines.

/// LE10: Poisson MMS convergence — error must decrease as mesh refines.
#[test]
fn nafems_le10_mesh_convergence_mms() {
    let rhs = "2.0*y*(1.0-y) + 2.0*x*(1.0-x)"; // MMS problem from LE1
    let dirichlet = "0";

    let meshes = [2usize, 4, 8];
    let errors: Vec<f64> = meshes.iter().map(|&n| {
        let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, n, n, 1.0, rhs, dirichlet).unwrap();
        let mut max_err = 0.0_f64;
        for i in 0..result.nodes.len() {
            let (x, y) = result.nodes[i];
            let u_exact = x * (1.0 - x) * y * (1.0 - y);
            max_err = max_err.max((result.u[i] - u_exact).abs());
        }
        max_err
    }).collect();

    // Errors must decrease monotonically as mesh refines
    assert!(
        errors[0] > errors[1],
        "LE10: error did not decrease n=2→4: {:.4e} → {:.4e}",
        errors[0], errors[1]
    );
    assert!(
        errors[1] > errors[2],
        "LE10: error did not decrease n=4→8: {:.4e} → {:.4e}",
        errors[1], errors[2]
    );

    // At n=8 error should be < 2e-3 for this smooth MMS problem
    assert!(
        errors[2] < 2e-3,
        "LE10: error at n=8 = {:.4e}, expected < 2e-3",
        errors[2]
    );
}

/// LE10 convergence rate: verify ratio > 2 when mesh doubles (O(h²) for L∞ norm of P1).
#[test]
fn nafems_le10_convergence_rate() {
    let rhs = "2.0*y*(1.0-y) + 2.0*x*(1.0-x)";
    let dirichlet = "0";

    let err_n4 = {
        let r = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 1.0, rhs, dirichlet).unwrap();
        r.nodes.iter().zip(r.u.iter())
            .map(|((x, y), &u)| (u - x * (1.0 - x) * y * (1.0 - y)).abs())
            .fold(0.0_f64, f64::max)
    };
    let err_n8 = {
        let r = solve_fem2d(0.0, 1.0, 0.0, 1.0, 8, 8, 1.0, rhs, dirichlet).unwrap();
        r.nodes.iter().zip(r.u.iter())
            .map(|((x, y), &u)| (u - x * (1.0 - x) * y * (1.0 - y)).abs())
            .fold(0.0_f64, f64::max)
        };

    let rate = err_n4 / err_n8;
    assert!(
        rate > 2.0,
        "LE10: convergence rate n=4→8: {rate:.2} (expected > 2.0 for O(h) or better)"
    );
}

// ── NAFEMS LE11 — Boundary condition imposition ───────────────────────────────

/// LE11: Zero Dirichlet BC — boundary nodes must have u=0 exactly.
#[test]
fn nafems_le11_zero_dirichlet_exact() {
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 6, 6, 1.0, "1", "0").unwrap();

    let n_nodes_x = 7; // n+1
    let n_nodes_y = 7;
    let nx = 6;

    let mut max_bc_err = 0.0_f64;
    for i in 0..result.nodes.len() {
        let ix = i % n_nodes_x;
        let iy = i / n_nodes_x;
        let is_boundary = ix == 0 || ix == nx || iy == 0 || iy == n_nodes_y - 1;
        if is_boundary {
            max_bc_err = max_bc_err.max(result.u[i].abs());
        }
    }

    assert!(
        max_bc_err < 1e-10,
        "LE11: zero Dirichlet BC error = {max_bc_err:.2e} (expected machine zero)"
    );
}

/// LE11: Constant Dirichlet u=3 on 4×4 mesh — verify solution equals 3 everywhere.
#[test]
fn nafems_le11_constant_dirichlet_n4() {
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 1.0, "0", "3").unwrap();

    let mut max_err = 0.0_f64;
    for &u in &result.u {
        max_err = max_err.max((u - 3.0).abs());
    }
    assert!(
        max_err < 1e-10,
        "LE11 constant Dirichlet u=3 (n=4): max err = {max_err:.2e}"
    );
}

/// LE11: Non-constant Dirichlet BC u=x+y (linear) with zero source.
/// P1 elements represent linear functions exactly.
#[test]
fn nafems_le11_linear_dirichlet_exact() {
    let n = 4;
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, n, n, 1.0, "0", "x + y").unwrap();

    let mut max_err = 0.0_f64;
    for i in 0..result.nodes.len() {
        let (x, y) = result.nodes[i];
        max_err = max_err.max((result.u[i] - (x + y)).abs());
    }

    assert!(
        max_err < 1e-10,
        "LE11 linear Dirichlet (n={n}): max err = {max_err:.2e}"
    );
}

/// LE11: Interior solution is positive for positive source with zero BC.
#[test]
fn nafems_le11_positivity_preserving() {
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 8, 8, 1.0, "1", "0").unwrap();
    let n_nodes_x = 9;
    let n_nodes_y = 9;
    let nx = 8;

    let mut all_positive = true;
    for i in 0..result.nodes.len() {
        let ix = i % n_nodes_x;
        let iy = i / n_nodes_x;
        let is_interior = ix > 0 && ix < nx && iy > 0 && iy < n_nodes_y - 1;
        if is_interior && result.u[i] <= 0.0 {
            all_positive = false;
        }
    }

    assert!(
        all_positive,
        "LE11: positivity violated (f=1≥0 with u=0 BC should give u≥0 interior)"
    );
}

// ── Mesh quality verification ─────────────────────────────────────────────────

/// Verify mesh generator produces correct node and element counts.
#[test]
fn fea_mesh_node_and_element_count() {
    for (nx, ny) in [(4, 4), (8, 6), (10, 3)] {
        let mesh = generate_mesh(0.0, 1.0, 0.0, 1.0, nx, ny);
        assert_eq!(
            mesh.nodes.len(),
            (nx + 1) * (ny + 1),
            "Node count: expected {}, got {} (nx={nx},ny={ny})",
            (nx + 1) * (ny + 1),
            mesh.nodes.len()
        );
        assert_eq!(
            mesh.tris.len(),
            2 * nx * ny,
            "Triangle count: expected {}, got {} (nx={nx},ny={ny})",
            2 * nx * ny,
            mesh.tris.len()
        );
    }
}

/// Verify mesh node coordinates are correct at corners.
#[test]
fn fea_mesh_coordinates() {
    let mesh = generate_mesh(0.0, 2.0, 0.0, 1.0, 4, 2);
    // First node: (0, 0)
    let (x00, y00) = mesh.nodes[0];
    assert!((x00 - 0.0).abs() < 1e-14 && (y00 - 0.0).abs() < 1e-14);
    // Last node: (2, 1)
    let last = mesh.nodes.last().unwrap();
    assert!((last.0 - 2.0).abs() < 1e-12 && (last.1 - 1.0).abs() < 1e-12);
}

/// Verify all triangles have valid indices and positive area.
#[test]
fn fea_mesh_triangle_validity() {
    let mesh = generate_mesh(0.0, 1.0, 0.0, 1.0, 6, 6);
    let n = mesh.nodes.len();

    for tri in &mesh.tris {
        assert!(tri[0] < n && tri[1] < n && tri[2] < n,
            "Triangle index out of range: {:?}", tri);

        let (x0, y0) = mesh.nodes[tri[0]];
        let (x1, y1) = mesh.nodes[tri[1]];
        let (x2, y2) = mesh.nodes[tri[2]];
        let area = 0.5 * ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0));
        assert!(area.abs() > 1e-14, "Degenerate triangle: area = {area:.2e}");
    }
}

// ── Physics verification ──────────────────────────────────────────────────────

/// Max principle: for zero BC and positive source, interior solution is positive.
#[test]
fn fea_max_principle_positive_source() {
    let result = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 1.0, "1", "0").unwrap();
    let min_interior = result.u.iter()
        .enumerate()
        .filter(|&(i, _)| {
            let ix = i % 5;
            let iy = i / 5;
            ix > 0 && ix < 4 && iy > 0 && iy < 4
        })
        .map(|(_, &u)| u)
        .fold(f64::INFINITY, f64::min);
    assert!(min_interior > 0.0, "FEM min principle: min interior u = {min_interior:.4}");
}

/// Diffusion coefficient k scales solution: u_2k = u_k / 2 (for linear problem).
#[test]
fn fea_diffusion_coefficient_scaling() {
    let r1 = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 1.0, "1", "0").unwrap();
    let r2 = solve_fem2d(0.0, 1.0, 0.0, 1.0, 4, 4, 2.0, "1", "0").unwrap();

    // For −k∇²u = f, doubling k halves u at all interior nodes
    let n = r1.u.len();
    let mut max_ratio_err = 0.0_f64;
    for i in 0..n {
        let ix = i % 5;
        let iy = i / 5;
        let is_interior = ix > 0 && ix < 4 && iy > 0 && iy < 4;
        if is_interior {
            let ratio = r1.u[i] / r2.u[i];
            max_ratio_err = max_ratio_err.max((ratio - 2.0).abs());
        }
    }
    assert!(
        max_ratio_err < 1e-10,
        "FEM k-scaling: max ratio error = {max_ratio_err:.2e}, expected 2.0 at all interior nodes"
    );
}
