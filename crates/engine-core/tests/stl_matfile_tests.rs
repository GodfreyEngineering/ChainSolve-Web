//! Integration tests for STL mesh import (4.12) and MATLAB .mat import (4.9).

use engine_core::stl::{
    parse_stl_ascii, parse_stl_binary, parse_stl_text, stl_to_matrix, write_stl_binary,
    StlTriangle,
};
use engine_core::matfile::{parse_mat_v5, write_mat_v5_double};
use engine_core::types::Value;

// ── STL tests ─────────────────────────────────────────────────────────────────

const CUBE_ASCII: &str = r#"solid cube
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 1 1
      vertex 0 1 1
    endloop
  endfacet
endsolid cube"#;

#[test]
fn stl_ascii_triangle_count() {
    let tris = parse_stl_ascii(CUBE_ASCII).unwrap();
    assert_eq!(tris.len(), 2);
}

#[test]
fn stl_ascii_normal_values() {
    let tris = parse_stl_ascii(CUBE_ASCII).unwrap();
    for tri in &tris {
        assert_eq!(tri.normal, [0.0, 0.0, 1.0]);
    }
}

#[test]
fn stl_ascii_first_vertex() {
    let tris = parse_stl_ascii(CUBE_ASCII).unwrap();
    assert_eq!(tris[0].vertices[0], [0.0, 0.0, 1.0]);
    assert_eq!(tris[0].vertices[1], [1.0, 0.0, 1.0]);
    assert_eq!(tris[0].vertices[2], [1.0, 1.0, 1.0]);
}

#[test]
fn stl_ascii_no_triangles_returns_error() {
    let result = parse_stl_ascii("solid empty\nendsolid empty\n");
    assert!(result.is_err(), "expected error for solid with 0 facets");
}

#[test]
fn stl_binary_round_trip() {
    let original = vec![
        StlTriangle {
            normal: [1.0, 0.0, 0.0],
            vertices: [[0.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
        },
        StlTriangle {
            normal: [0.0, 1.0, 0.0],
            vertices: [[1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [1.0, 1.0, 0.0]],
        },
    ];

    let bytes = write_stl_binary(&original);
    assert_eq!(bytes.len(), 84 + 2 * 50); // header + 2 triangles

    let parsed = parse_stl_binary(&bytes).unwrap();
    assert_eq!(parsed.len(), 2);

    for (a, b) in original.iter().zip(parsed.iter()) {
        for i in 0..3 {
            assert!((a.normal[i] - b.normal[i]).abs() < 1e-5, "normal mismatch");
            for j in 0..3 {
                assert!(
                    (a.vertices[j][i] - b.vertices[j][i]).abs() < 1e-5,
                    "vertex mismatch"
                );
            }
        }
    }
}

#[test]
fn stl_binary_too_short_error() {
    assert!(parse_stl_binary(&[0u8; 50]).is_err());
}

#[test]
fn stl_to_matrix_shape_and_content() {
    let tris = parse_stl_ascii(CUBE_ASCII).unwrap();
    let val = stl_to_matrix(&tris);

    match val {
        Value::Matrix { rows, cols, ref data } => {
            assert_eq!(rows, 2);
            assert_eq!(cols, 12);
            assert_eq!(data.len(), 24);
            // First row: normal then 3 vertices
            assert_eq!(data[0], 0.0); // nx
            assert_eq!(data[1], 0.0); // ny
            assert_eq!(data[2], 1.0); // nz
        }
        _ => panic!("expected Matrix value"),
    }
}

#[test]
fn stl_auto_detect_ascii() {
    let result = parse_stl_text(CUBE_ASCII);
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 2);
}

#[test]
fn stl_auto_detect_non_solid_returns_error() {
    let result = parse_stl_text("not an stl file");
    assert!(result.is_err());
}

// ── MATLAB .mat tests ─────────────────────────────────────────────────────────

#[test]
fn mat_round_trip_2x3_double() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
    let bytes = write_mat_v5_double("A", 2, 3, &data);
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars.len(), 1);
    assert_eq!(vars[0].name, "A");
    assert_eq!(vars[0].rows, 2);
    assert_eq!(vars[0].cols, 3);
    for (i, (&got, &exp)) in vars[0].data.iter().zip(data.iter()).enumerate() {
        assert!((got - exp).abs() < 1e-12, "index {i}: {got} != {exp}");
    }
}

#[test]
fn mat_round_trip_column_vector() {
    let data: Vec<f64> = (1..=5).map(|x| x as f64).collect();
    let bytes = write_mat_v5_double("v", 5, 1, &data);
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars[0].rows, 5);
    assert_eq!(vars[0].cols, 1);
    assert_eq!(vars[0].data, data);
}

#[test]
fn mat_round_trip_scalar() {
    let bytes = write_mat_v5_double("x", 1, 1, &[99.5]);
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars.len(), 1);
    assert!((vars[0].data[0] - 99.5).abs() < 1e-12);
}

#[test]
fn mat_class_name() {
    let bytes = write_mat_v5_double("m", 1, 1, &[0.0]);
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars[0].class, "double");
}

#[test]
fn mat_empty_file_no_vars() {
    let mut bytes = vec![0u8; 128];
    bytes[124] = 0x00;
    bytes[125] = 0x01; // version 0x0100 LE
    bytes[126] = b'M';
    bytes[127] = b'I';
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars.len(), 0);
}

#[test]
fn mat_too_short_returns_error() {
    assert!(parse_mat_v5(&[0u8; 64]).is_err());
}

#[test]
fn mat_bad_endian_returns_error() {
    let mut bytes = vec![0u8; 128];
    bytes[124] = 0x00;
    bytes[125] = 0x01;
    bytes[126] = 0xAA;
    bytes[127] = 0xBB;
    assert!(parse_mat_v5(&bytes).is_err());
}

#[test]
fn mat_identity_2x2() {
    // MATLAB column-major: [1,0,0,1] = eye(2)
    let data = vec![1.0, 0.0, 0.0, 1.0];
    let bytes = write_mat_v5_double("E", 2, 2, &data);
    let vars = parse_mat_v5(&bytes).unwrap();
    assert_eq!(vars[0].data, data);
    assert_eq!(vars[0].rows, 2);
    assert_eq!(vars[0].cols, 2);
}
