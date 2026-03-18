//! MATLAB Level 5 (.mat) file parser (4.9) — pure Rust, no dependencies.
//!
//! Parses the MATLAB Level 5 MAT-file format (pre-v7.3 — not HDF5-based).
//! Handles real double, single, and integer arrays (1D and 2D).
//!
//! ## Supported
//! - mxDOUBLE_CLASS, mxSINGLE_CLASS, mxINT8/UINT8/INT16/UINT16/INT32/UINT32_CLASS
//! - 1D and 2D real (non-complex) arrays
//! - Multiple named variables in a single file
//! - Both little-endian (default) and big-endian files
//!
//! ## Not supported (elements are silently skipped)
//! - v7.3 (HDF5-based) files — detected by header text "MATLAB 7.3"
//! - Complex arrays
//! - Sparse, cell, struct, and object arrays
//! - Compressed elements (miCOMPRESSED) — use `save('f.mat','v','-v6')` in MATLAB
//!
//! Reference: "MATLAB Level 5 MAT-File Format", MathWorks (2023).

// ── Data-type codes ───────────────────────────────────────────────────────────
const MI_INT8:       u32 = 1;
const MI_UINT8:      u32 = 2;
const MI_INT16:      u32 = 3;
const MI_UINT16:     u32 = 4;
const MI_INT32:      u32 = 5;
const MI_UINT32:     u32 = 6;
const MI_SINGLE:     u32 = 7;
const MI_DOUBLE:     u32 = 9;
const MI_INT64:      u32 = 12;
const MI_UINT64:     u32 = 13;
const MI_MATRIX:     u32 = 14;
const MI_COMPRESSED: u32 = 15;

// ── Array-class codes ─────────────────────────────────────────────────────────
const MX_CHAR_CLASS:   u8 = 4;
const MX_DOUBLE_CLASS: u8 = 6;
const MX_SINGLE_CLASS: u8 = 7;
const MX_INT8_CLASS:   u8 = 8;
const MX_UINT8_CLASS:  u8 = 9;
const MX_INT16_CLASS:  u8 = 10;
const MX_UINT16_CLASS: u8 = 11;
const MX_INT32_CLASS:  u8 = 12;
const MX_UINT32_CLASS: u8 = 13;

// ── Public types ──────────────────────────────────────────────────────────────

/// A named numeric array extracted from a MATLAB v5 .mat file.
#[derive(Debug, Clone)]
pub struct MatVar {
    /// Variable name.
    pub name: String,
    /// Number of rows.
    pub rows: usize,
    /// Number of columns.
    pub cols: usize,
    /// Flat data in MATLAB's COLUMN-MAJOR order.
    pub data: Vec<f64>,
    /// Human-readable class ("double", "single", "int32", …).
    pub class: &'static str,
}

// ── Reader cursor ─────────────────────────────────────────────────────────────

struct Cursor<'a> {
    buf: &'a [u8],
    pos: usize,
    le: bool, // little-endian
}

impl<'a> Cursor<'a> {
    fn new(buf: &'a [u8], le: bool) -> Self {
        Cursor { buf, pos: 0, le }
    }

    fn remaining(&self) -> usize {
        self.buf.len().saturating_sub(self.pos)
    }

    #[allow(dead_code)]
    fn peek_u32(&self) -> Option<u32> {
        if self.pos + 4 > self.buf.len() { return None; }
        let b: [u8; 4] = self.buf[self.pos..self.pos+4].try_into().ok()?;
        Some(if self.le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }

    fn read_u8(&mut self) -> Option<u8> {
        if self.pos < self.buf.len() {
            let v = self.buf[self.pos];
            self.pos += 1;
            Some(v)
        } else {
            None
        }
    }

    fn read_u16(&mut self) -> Option<u16> {
        if self.pos + 2 > self.buf.len() { return None; }
        let b = [self.buf[self.pos], self.buf[self.pos+1]];
        self.pos += 2;
        Some(if self.le { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    }

    fn read_u32(&mut self) -> Option<u32> {
        if self.pos + 4 > self.buf.len() { return None; }
        let b: [u8; 4] = self.buf[self.pos..self.pos+4].try_into().ok()?;
        self.pos += 4;
        Some(if self.le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }

    fn read_i32(&mut self) -> Option<i32> {
        self.read_u32().map(|v| v as i32)
    }

    fn read_f32(&mut self) -> Option<f64> {
        if self.pos + 4 > self.buf.len() { return None; }
        let b: [u8; 4] = self.buf[self.pos..self.pos+4].try_into().ok()?;
        self.pos += 4;
        // Data is always native LE regardless of file endianness
        Some(f32::from_le_bytes(b) as f64)
    }

    fn read_f64(&mut self) -> Option<f64> {
        if self.pos + 8 > self.buf.len() { return None; }
        let b: [u8; 8] = self.buf[self.pos..self.pos+8].try_into().ok()?;
        self.pos += 8;
        Some(f64::from_le_bytes(b))
    }

    fn skip(&mut self, n: usize) {
        self.pos = (self.pos + n).min(self.buf.len());
    }

    fn align8(&mut self) {
        let r = self.pos % 8;
        if r != 0 { self.skip(8 - r); }
    }

    fn read_bytes(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.pos + n > self.buf.len() { return None; }
        let s = &self.buf[self.pos..self.pos+n];
        self.pos += n;
        Some(s)
    }

    /// Read a data element tag. Returns `(type, nbytes, is_small_element)`.
    /// For small elements, the 4 data bytes immediately follow the tag word.
    fn read_tag(&mut self) -> Option<(u32, usize, bool)> {
        let w0 = self.read_u32()?;
        let hi = w0 >> 16;
        if hi != 0 {
            // Small data element: upper 16 bits = nbytes, lower 16 = type
            let elem_type = w0 & 0xFFFF;
            let nbytes = hi as usize;
            Some((elem_type, nbytes, true))
        } else {
            let nbytes = self.read_u32()? as usize;
            Some((w0, nbytes, false))
        }
    }
}

// ── Top-level parser ──────────────────────────────────────────────────────────

/// Parse a MATLAB Level 5 .mat file from raw bytes.
///
/// Returns all numeric (real) variables found. Non-numeric or complex
/// variables are silently skipped.
pub fn parse_mat_v5(bytes: &[u8]) -> Result<Vec<MatVar>, String> {
    if bytes.len() < 128 {
        return Err(format!(
            "matfile: too short ({} bytes; need ≥ 128 for header)",
            bytes.len()
        ));
    }

    // Endian indicator at bytes 126..128
    let le = match (bytes[126], bytes[127]) {
        (0x4D, 0x49) => true,   // 'M','I' → little-endian
        (0x49, 0x4D) => false,  // 'I','M' → big-endian
        (a, b) => {
            return Err(format!(
                "matfile: unrecognised endian bytes 0x{:02X} 0x{:02X} at offsets 126-127",
                a, b
            ));
        }
    };

    // Version at bytes 124..126
    let version = {
        let b = [bytes[124], bytes[125]];
        if le { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) }
    };
    if version != 0x0100 {
        let desc = std::str::from_utf8(&bytes[0..116]).unwrap_or("");
        if desc.contains("MATLAB 7.3") || desc.contains("MATLAB 8") || desc.contains("MATLAB 9") {
            return Err(
                "matfile: v7.3 (HDF5) format is not supported; \
                 save with '-v6' or '-v7' flag in MATLAB".to_string()
            );
        }
        return Err(format!(
            "matfile: unsupported version 0x{:04X} (expected 0x0100 for MATLAB 5.0)",
            version
        ));
    }

    let mut cur = Cursor::new(bytes, le);
    cur.pos = 128; // skip header

    let mut vars: Vec<MatVar> = Vec::new();

    while cur.remaining() >= 8 {
        let tag_pos = cur.pos;
        let (elem_type, nbytes, small) = match cur.read_tag() {
            Some(t) => t,
            None => break,
        };

        let data_pos = cur.pos;

        if elem_type == MI_COMPRESSED {
            // Skip — requires zlib; not supported
            if small {
                cur.pos = tag_pos + 8;
            } else {
                cur.pos = data_pos + nbytes;
                cur.align8();
            }
            continue;
        }

        if elem_type == MI_MATRIX {
            if !small && data_pos + nbytes <= bytes.len() {
                let sub = &bytes[data_pos..data_pos + nbytes];
                if let Some(var) = parse_matrix(sub, le) {
                    vars.push(var);
                }
            }
        }

        // Advance past this element
        if small {
            cur.pos = tag_pos + 8; // 4-byte tag word + 4-byte data
        } else {
            cur.pos = data_pos + nbytes;
            cur.align8();
        }
    }

    Ok(vars)
}

// ── miMATRIX element parser ───────────────────────────────────────────────────

fn parse_matrix(data: &[u8], le: bool) -> Option<MatVar> {
    let mut c = Cursor::new(data, le);

    // ── Sub-element 1: Array Flags (miUINT32, 8 bytes) ────────────────────────
    let (ft0, fn0, fs0) = c.read_tag()?;
    if ft0 != MI_UINT32 { return None; }
    // flags word 0: class + flag bits
    let flags_w0 = c.read_u32()?;
    let _flags_w1 = c.read_u32()?; // nzmax (0 for dense)
    // Array Flags is always a normal element (8 bytes of data).
    // We've read tag(8) + 2×u32(8) = 16 bytes; skip any extra if fn0 > 8.
    if !fs0 {
        if fn0 > 8 { c.skip(fn0 - 8); }
        c.align8();
    }

    let mx_class = (flags_w0 & 0xFF) as u8;
    let _is_complex = (flags_w0 >> 11) & 1 != 0;

    // Skip char and unsupported classes
    match mx_class {
        MX_DOUBLE_CLASS | MX_SINGLE_CLASS |
        MX_INT8_CLASS | MX_UINT8_CLASS |
        MX_INT16_CLASS | MX_UINT16_CLASS |
        MX_INT32_CLASS | MX_UINT32_CLASS => {}
        MX_CHAR_CLASS => return None,
        _ => return None,
    }

    // ── Sub-element 2: Dimensions (miINT32) ───────────────────────────────────
    let (dt, dn, ds) = c.read_tag()?;
    if dt != MI_INT32 { return None; }
    let ndim = if ds { dn / 4 } else { dn / 4 };
    let rows = if ndim >= 1 { c.read_i32()?.max(0) as usize } else { 0 };
    let cols = if ndim >= 2 { c.read_i32()?.max(0) as usize } else { 1 };
    // Skip remaining dims
    let extra_dims = ndim.saturating_sub(2);
    c.skip(extra_dims * 4);
    if !ds { c.align8(); }

    // ── Sub-element 3: Array Name (miINT8) ────────────────────────────────────
    let (nt, nn, ns) = c.read_tag()?;
    if nt != MI_INT8 { return None; }
    let name_bytes = c.read_bytes(nn)?;
    let name = std::str::from_utf8(name_bytes)
        .unwrap_or("")
        .trim_end_matches('\0')
        .to_string();
    let name = if name.is_empty() { "var".to_string() } else { name };
    if ns {
        // Small element: 4-byte tag + 4-byte data = 8 bytes total.
        // We consumed nn bytes of data; skip the remaining (4 - nn) padding bytes.
        c.skip(4usize.saturating_sub(nn));
    } else {
        c.align8();
    }

    // ── Sub-element 4: Real Data ──────────────────────────────────────────────
    let (rdt, rdn, _rds) = c.read_tag()?;
    let numel = rows * cols;

    let class_name: &'static str = match mx_class {
        MX_DOUBLE_CLASS => "double",
        MX_SINGLE_CLASS => "single",
        MX_INT8_CLASS   => "int8",
        MX_UINT8_CLASS  => "uint8",
        MX_INT16_CLASS  => "int16",
        MX_UINT16_CLASS => "uint16",
        MX_INT32_CLASS  => "int32",
        MX_UINT32_CLASS => "uint32",
        _ => "unknown",
    };

    let elem_bytes: usize = match rdt {
        MI_DOUBLE => 8,
        MI_SINGLE => 4,
        MI_INT8 | MI_UINT8 => 1,
        MI_INT16 | MI_UINT16 => 2,
        MI_INT32 | MI_UINT32 => 4,
        MI_INT64 | MI_UINT64 => 8,
        _ => return None,
    };

    let n_in_file = if elem_bytes > 0 { rdn / elem_bytes } else { 0 };
    let n_to_read = numel.min(n_in_file);

    let mut flat = Vec::with_capacity(numel);
    for _ in 0..n_to_read {
        let v: f64 = match rdt {
            MI_DOUBLE => c.read_f64()?,
            MI_SINGLE => c.read_f32()?,
            MI_INT8   => { let b = c.read_u8()?; b as i8 as f64 }
            MI_UINT8  => { let b = c.read_u8()?; b as f64 }
            MI_INT16  => { let h = c.read_u16()?; h as i16 as f64 }
            MI_UINT16 => { let h = c.read_u16()?; h as f64 }
            MI_INT32  => { let w = c.read_u32()?; w as i32 as f64 }
            MI_UINT32 => { let w = c.read_u32()?; w as f64 }
            MI_INT64 | MI_UINT64 => {
                let lo = c.read_u32()? as u64;
                let hi = c.read_u32()? as u64;
                ((hi << 32) | lo) as f64
            }
            _ => 0.0,
        };
        flat.push(v);
    }
    flat.resize(numel, 0.0); // pad if truncated

    Some(MatVar { name, rows, cols, data: flat, class: class_name })
}

// ── Serialiser for tests ──────────────────────────────────────────────────────

/// Write a minimal Level 5 MAT file containing one named double array.
/// The output is readable by `parse_mat_v5`.
pub fn write_mat_v5_double(name: &str, rows: usize, cols: usize, data: &[f64]) -> Vec<u8> {
    let mut body: Vec<u8> = Vec::new();

    // Sub-element 1: Array Flags (miUINT32, 8 bytes of actual data)
    push_u32(&mut body, MI_UINT32);
    push_u32(&mut body, 8u32);
    push_u32(&mut body, MX_DOUBLE_CLASS as u32); // flags word 0
    push_u32(&mut body, 0u32);                   // nzmax

    // Sub-element 2: Dimensions (miINT32, 2 × 4 = 8 bytes)
    push_u32(&mut body, MI_INT32);
    push_u32(&mut body, 8u32);
    body.extend_from_slice(&(rows as i32).to_le_bytes());
    body.extend_from_slice(&(cols as i32).to_le_bytes());

    // Sub-element 3: Name (small element if ≤4 chars, normal otherwise)
    let nb = name.len();
    if nb == 0 {
        // Empty name: small element with 0 bytes
        let tag = 0u32; // nbytes=0, type=MI_INT8 (both zero → fine as zero tag)
        push_u32(&mut body, tag);
        push_u32(&mut body, 0u32);
    } else if nb <= 4 {
        let tag_word = ((nb as u32) << 16) | MI_INT8;
        push_u32(&mut body, tag_word);
        let mut name_bytes = [0u8; 4];
        name_bytes[..nb].copy_from_slice(name.as_bytes());
        body.extend_from_slice(&name_bytes);
    } else {
        push_u32(&mut body, MI_INT8);
        push_u32(&mut body, nb as u32);
        body.extend_from_slice(name.as_bytes());
        let pad = (8 - nb % 8) % 8;
        body.resize(body.len() + pad, 0u8);
    }

    // Sub-element 4: Real data (miDOUBLE)
    let data_nbytes = data.len() * 8;
    push_u32(&mut body, MI_DOUBLE);
    push_u32(&mut body, data_nbytes as u32);
    for &v in data {
        body.extend_from_slice(&v.to_le_bytes());
    }
    let pad = (8 - data_nbytes % 8) % 8;
    body.resize(body.len() + pad, 0u8);

    // Outer miMATRIX element
    let mut out = Vec::new();

    // Header (128 bytes)
    let desc = b"MATLAB 5.0 MAT-file, ChainSolve test\0";
    let mut header_text = desc.to_vec();
    header_text.resize(116, 0u8);
    out.extend_from_slice(&header_text);
    out.extend_from_slice(&[0u8; 8]); // subsystem offset
    out.extend_from_slice(&0x0100u16.to_le_bytes()); // version
    out.extend_from_slice(b"MI"); // little-endian

    // miMATRIX tag
    push_u32(&mut out, MI_MATRIX);
    push_u32(&mut out, body.len() as u32);
    out.extend_from_slice(&body);
    let pad = (8 - body.len() % 8) % 8;
    out.resize(out.len() + pad, 0u8);

    out
}

fn push_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_2x3_double() {
        // Column-major: col0=[1,2], col1=[3,4], col2=[5,6]
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        let bytes = write_mat_v5_double("A", 2, 3, &data);
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars.len(), 1);
        let v = &vars[0];
        assert_eq!(v.name, "A");
        assert_eq!(v.rows, 2);
        assert_eq!(v.cols, 3);
        for (i, (&got, &exp)) in v.data.iter().zip(data.iter()).enumerate() {
            assert!((got - exp).abs() < 1e-12, "index {i}: {got} ≠ {exp}");
        }
    }

    #[test]
    fn round_trip_column_vector() {
        let data: Vec<f64> = (1..=7).map(|x| x as f64).collect();
        let bytes = write_mat_v5_double("vec", 7, 1, &data);
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars[0].rows, 7);
        assert_eq!(vars[0].cols, 1);
        assert_eq!(vars[0].data, data);
    }

    #[test]
    fn round_trip_scalar() {
        let bytes = write_mat_v5_double("x", 1, 1, &[3.14]);
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars.len(), 1);
        assert!((vars[0].data[0] - 3.14).abs() < 1e-12);
    }

    #[test]
    fn class_name_is_double() {
        let bytes = write_mat_v5_double("m", 1, 1, &[0.0]);
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars[0].class, "double");
    }

    #[test]
    fn header_too_short_returns_error() {
        assert!(parse_mat_v5(&[0u8; 100]).is_err());
    }

    #[test]
    fn bad_endian_bytes_return_error() {
        let mut bytes = vec![0u8; 128];
        bytes[124] = 0x00;
        bytes[125] = 0x01;
        bytes[126] = 0xAA;
        bytes[127] = 0xBB;
        assert!(parse_mat_v5(&bytes).is_err());
    }

    #[test]
    fn empty_file_no_elements() {
        let mut bytes = vec![0u8; 128];
        bytes[124] = 0x00; // version LE bytes
        bytes[125] = 0x01;
        bytes[126] = b'M'; // little-endian
        bytes[127] = b'I';
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars.len(), 0);
    }

    #[test]
    fn identity_2x2() {
        // Column-major identity: [1,0,0,1]
        let data = vec![1.0, 0.0, 0.0, 1.0];
        let bytes = write_mat_v5_double("eye", 2, 2, &data);
        let vars = parse_mat_v5(&bytes).unwrap();
        assert_eq!(vars[0].data, data);
        assert_eq!(vars[0].rows, 2);
        assert_eq!(vars[0].cols, 2);
    }
}
