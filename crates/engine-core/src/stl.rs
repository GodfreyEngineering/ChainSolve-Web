//! STL mesh import (4.12) — parse ASCII and binary STL files.
//!
//! Produces a matrix with one row per triangle, 12 columns:
//! `[nx, ny, nz, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z]`
//!
//! Both ASCII and binary STL variants are supported.
//! Binary STL is detected by the absence of a leading "solid" keyword followed
//! by printable text, or by an explicit `parse_stl_binary()` call.
//!
//! Reference: ISO/ASTM 52900:2021, "Standard Specification for Additive
//! Manufacturing — General Principles — Terminology".

/// A single STL triangle (facet): surface normal + 3 vertices.
#[derive(Debug, Clone, PartialEq)]
pub struct StlTriangle {
    pub normal: [f64; 3],
    pub vertices: [[f64; 3]; 3],
}

// ── ASCII parser ──────────────────────────────────────────────────────────────

/// Parse an ASCII STL string.
///
/// Grammar (case-insensitive):
/// ```text
/// solid [name]
///   facet normal <nx> <ny> <nz>
///     outer loop
///       vertex <x> <y> <z>  (×3)
///     endloop
///   endfacet
///   ...
/// endsolid [name]
/// ```
pub fn parse_stl_ascii(text: &str) -> Result<Vec<StlTriangle>, String> {
    let mut triangles: Vec<StlTriangle> = Vec::new();
    let mut normal = [0.0f64; 3];
    let mut verts: Vec<[f64; 3]> = Vec::with_capacity(3);
    let mut in_facet = false;
    let mut in_loop = false;

    for (lineno, raw) in text.lines().enumerate() {
        let line = raw.trim();
        let lower = line.to_ascii_lowercase();
        let tok: Vec<&str> = line.split_ascii_whitespace().collect();

        if lower.starts_with("facet normal") {
            if tok.len() < 5 {
                return Err(format!("stl_parse: line {}: malformed 'facet normal'", lineno + 1));
            }
            normal = [
                tok[2].parse::<f64>().map_err(|_| format!("stl_parse: bad normal x on line {}", lineno + 1))?,
                tok[3].parse::<f64>().map_err(|_| format!("stl_parse: bad normal y on line {}", lineno + 1))?,
                tok[4].parse::<f64>().map_err(|_| format!("stl_parse: bad normal z on line {}", lineno + 1))?,
            ];
            verts.clear();
            in_facet = true;
        } else if lower.starts_with("outer loop") {
            if !in_facet {
                return Err(format!("stl_parse: line {}: 'outer loop' outside facet", lineno + 1));
            }
            in_loop = true;
        } else if lower.starts_with("vertex") {
            if !in_loop {
                return Err(format!("stl_parse: line {}: 'vertex' outside loop", lineno + 1));
            }
            if tok.len() < 4 {
                return Err(format!("stl_parse: line {}: malformed vertex", lineno + 1));
            }
            let v = [
                tok[1].parse::<f64>().map_err(|_| format!("stl_parse: bad vertex x on line {}", lineno + 1))?,
                tok[2].parse::<f64>().map_err(|_| format!("stl_parse: bad vertex y on line {}", lineno + 1))?,
                tok[3].parse::<f64>().map_err(|_| format!("stl_parse: bad vertex z on line {}", lineno + 1))?,
            ];
            verts.push(v);
        } else if lower.starts_with("endloop") {
            if verts.len() != 3 {
                return Err(format!(
                    "stl_parse: line {}: loop has {} vertices (expected 3)",
                    lineno + 1, verts.len()
                ));
            }
            in_loop = false;
        } else if lower.starts_with("endfacet") {
            if in_facet && !in_loop && verts.len() == 3 {
                triangles.push(StlTriangle {
                    normal,
                    vertices: [verts[0], verts[1], verts[2]],
                });
            }
            in_facet = false;
        }
        // "solid", "endsolid", blank lines → skip
    }

    if triangles.is_empty() {
        Err("stl_parse: no triangles found in ASCII STL".to_string())
    } else {
        Ok(triangles)
    }
}

// ── Binary parser ─────────────────────────────────────────────────────────────

/// Parse a binary STL byte slice.
///
/// Layout:
/// ```text
/// [0..80]   — 80-byte header (ignored)
/// [80..84]  — uint32 triangle count (little-endian)
/// per triangle (50 bytes):
///   [0..12]   — normal (3 × f32 LE)
///   [12..24]  — vertex 0 (3 × f32 LE)
///   [24..36]  — vertex 1 (3 × f32 LE)
///   [36..48]  — vertex 2 (3 × f32 LE)
///   [48..50]  — attribute byte count (ignored)
/// ```
pub fn parse_stl_binary(bytes: &[u8]) -> Result<Vec<StlTriangle>, String> {
    if bytes.len() < 84 {
        return Err(format!(
            "stl_parse: binary STL too short ({} bytes, need ≥ 84)",
            bytes.len()
        ));
    }

    let n_tris = u32::from_le_bytes([bytes[80], bytes[81], bytes[82], bytes[83]]) as usize;
    let expected = 84 + n_tris * 50;
    if bytes.len() < expected {
        return Err(format!(
            "stl_parse: binary STL truncated (need {} bytes for {} triangles, have {})",
            expected, n_tris, bytes.len()
        ));
    }

    let read_f32 = |off: usize| -> f64 {
        let b = [bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]];
        f32::from_le_bytes(b) as f64
    };

    let mut tris = Vec::with_capacity(n_tris);
    for i in 0..n_tris {
        let base = 84 + i * 50;
        tris.push(StlTriangle {
            normal: [read_f32(base), read_f32(base + 4), read_f32(base + 8)],
            vertices: [
                [read_f32(base + 12), read_f32(base + 16), read_f32(base + 20)],
                [read_f32(base + 24), read_f32(base + 28), read_f32(base + 32)],
                [read_f32(base + 36), read_f32(base + 40), read_f32(base + 44)],
            ],
        });
    }

    Ok(tris)
}

// ── Auto-detect ───────────────────────────────────────────────────────────────

/// Detect format and parse.
///
/// ASCII STL files always start with "solid" (possibly with leading whitespace).
/// Any file starting with "solid" followed by printable ASCII is treated as ASCII.
/// Otherwise binary is assumed (binary STL headers commonly start with non-ASCII
/// bytes or may also start with "solid" but lack the second line "facet normal …").
///
/// For unambiguous dispatch, call `parse_stl_ascii` or `parse_stl_binary` directly.
pub fn parse_stl_text(text: &str) -> Result<Vec<StlTriangle>, String> {
    // ASCII STL starts with "solid"
    if text.trim_start().to_ascii_lowercase().starts_with("solid") {
        parse_stl_ascii(text)
    } else {
        Err("stl_parse: input does not start with 'solid'; use parse_stl_binary for binary STL".to_string())
    }
}

// ── Conversion to Value ───────────────────────────────────────────────────────

/// Convert a slice of triangles to a [`crate::types::Value::Matrix`].
///
/// Columns (12 per row): `nx ny nz v0x v0y v0z v1x v1y v1z v2x v2y v2z`
pub fn stl_to_matrix(triangles: &[StlTriangle]) -> crate::types::Value {
    let rows = triangles.len();
    let cols = 12usize;
    let mut data = Vec::with_capacity(rows * cols);

    for tri in triangles {
        data.push(tri.normal[0]);
        data.push(tri.normal[1]);
        data.push(tri.normal[2]);
        for vertex in &tri.vertices {
            data.extend_from_slice(vertex);
        }
    }

    crate::types::Value::Matrix { rows, cols, data }
}

// ── Helper: write a minimal binary STL (for tests) ────────────────────────────

/// Serialise triangles to binary STL bytes (little-endian).  Used in tests.
pub fn write_stl_binary(triangles: &[StlTriangle]) -> Vec<u8> {
    let mut out = vec![0u8; 80]; // 80-byte header (all zeros)
    let n = triangles.len() as u32;
    out.extend_from_slice(&n.to_le_bytes());

    for tri in triangles {
        // Write as f32 LE
        let push_f32 = |buf: &mut Vec<u8>, v: f64| {
            buf.extend_from_slice(&(v as f32).to_le_bytes());
        };
        push_f32(&mut out, tri.normal[0]);
        push_f32(&mut out, tri.normal[1]);
        push_f32(&mut out, tri.normal[2]);
        for v in &tri.vertices {
            push_f32(&mut out, v[0]);
            push_f32(&mut out, v[1]);
            push_f32(&mut out, v[2]);
        }
        out.extend_from_slice(&[0u8; 2]); // attribute byte count
    }

    out
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const CUBE_FACE_ASCII: &str = r#"
solid cube_face
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
endsolid cube_face
"#;

    #[test]
    fn ascii_parse_two_triangles() {
        let tris = parse_stl_ascii(CUBE_FACE_ASCII).unwrap();
        assert_eq!(tris.len(), 2);
    }

    #[test]
    fn ascii_parse_normal_values() {
        let tris = parse_stl_ascii(CUBE_FACE_ASCII).unwrap();
        assert_eq!(tris[0].normal, [0.0, 0.0, 1.0]);
        assert_eq!(tris[1].normal, [0.0, 0.0, 1.0]);
    }

    #[test]
    fn ascii_parse_vertex_coords() {
        let tris = parse_stl_ascii(CUBE_FACE_ASCII).unwrap();
        assert_eq!(tris[0].vertices[0], [0.0, 0.0, 1.0]);
        assert_eq!(tris[0].vertices[1], [1.0, 0.0, 1.0]);
        assert_eq!(tris[0].vertices[2], [1.0, 1.0, 1.0]);
    }

    #[test]
    fn ascii_parse_empty_returns_error() {
        let result = parse_stl_ascii("solid empty\nendsolid empty\n");
        assert!(result.is_err(), "expected error for empty solid");
    }

    #[test]
    fn binary_round_trip() {
        let original = vec![
            StlTriangle {
                normal: [0.0, 0.0, 1.0],
                vertices: [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
            },
            StlTriangle {
                normal: [0.0, 0.0, -1.0],
                vertices: [[1.0, 1.0, 0.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0]],
            },
        ];
        let bytes = write_stl_binary(&original);
        let parsed = parse_stl_binary(&bytes).unwrap();
        assert_eq!(parsed.len(), 2);

        // Compare with f32 tolerance (stored as f32)
        let eps = 1e-6f64;
        for (a, b) in original.iter().zip(parsed.iter()) {
            for i in 0..3 {
                assert!((a.normal[i] - b.normal[i]).abs() < eps);
                for j in 0..3 {
                    assert!((a.vertices[j][i] - b.vertices[j][i]).abs() < eps);
                }
            }
        }
    }

    #[test]
    fn binary_too_short_returns_error() {
        let result = parse_stl_binary(&[0u8; 50]);
        assert!(result.is_err());
    }

    #[test]
    fn stl_to_matrix_shape() {
        let tris = parse_stl_ascii(CUBE_FACE_ASCII).unwrap();
        let val = stl_to_matrix(&tris);
        match val {
            crate::types::Value::Matrix { rows, cols, ref data } => {
                assert_eq!(rows, 2);
                assert_eq!(cols, 12);
                assert_eq!(data.len(), 24);
            }
            _ => panic!("expected Matrix"),
        }
    }

    #[test]
    fn stl_matrix_column_order() {
        // Single triangle: verify column mapping
        let tri = StlTriangle {
            normal: [1.0, 2.0, 3.0],
            vertices: [[4.0, 5.0, 6.0], [7.0, 8.0, 9.0], [10.0, 11.0, 12.0]],
        };
        let val = stl_to_matrix(&[tri]);
        match val {
            crate::types::Value::Matrix { rows: _, cols: _, data } => {
                let expected = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0];
                for (i, (&got, &exp)) in data.iter().zip(expected.iter()).enumerate() {
                    assert!((got - exp).abs() < 1e-10, "col {i}: got {got}, expected {exp}");
                }
            }
            _ => panic!("expected Matrix"),
        }
    }

    #[test]
    fn auto_detect_ascii() {
        let result = parse_stl_text(CUBE_FACE_ASCII.trim());
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 2);
    }
}
