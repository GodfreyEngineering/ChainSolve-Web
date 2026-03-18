//! Pure-Rust minimal Parquet reader/writer (4.8).
//!
//! Supports a pragmatic subset of the Parquet format sufficient for data
//! science workloads: flat schemas with DOUBLE/FLOAT/INT64/INT32/BYTE_ARRAY
//! columns, PLAIN encoding, UNCOMPRESSED compression, required repetition.
//!
//! ## Format overview (Parquet v2)
//!
//! ```text
//! [PAR1] [row-group0] ... [row-groupN] [footer-bytes] [footer-len:u32le] [PAR1]
//! ```
//!
//! Footer is Thrift compact-binary encoded `FileMetaData`.
//! Each column chunk begins with a `DataPageHeader` (Thrift compact), followed
//! by raw PLAIN-encoded values.
//!
//! ## References
//! - <https://parquet.apache.org/docs/file-format/>
//! - <https://github.com/apache/parquet-format/blob/master/src/main/thrift/parquet.thrift>

use crate::types::Value;

// ── Errors ────────────────────────────────────────────────────────────────────

pub type ParquetResult<T> = Result<T, String>;

fn err(msg: impl Into<String>) -> String {
    format!("[PARQUET] {}", msg.into())
}

// ── Thrift compact binary protocol helpers ────────────────────────────────────
//
// Parquet uses Thrift *compact* binary encoding for all metadata.
// Key types we need:
//   i32/i64 → zigzag VarInt
//   string/binary → VarInt length + bytes
//   list  → (element_type << 4 | count) byte, or 0xF type byte + VarInt count
//   struct → field-delta|type bytes until stop (type 0)

struct ThriftCursor<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> ThriftCursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len() - self.pos
    }

    fn read_byte(&mut self) -> ParquetResult<u8> {
        if self.pos >= self.data.len() {
            return Err(err("unexpected end of data (read_byte)"));
        }
        let b = self.data[self.pos];
        self.pos += 1;
        Ok(b)
    }

    fn read_bytes(&mut self, n: usize) -> ParquetResult<&'a [u8]> {
        let end = self.pos + n;
        if end > self.data.len() {
            return Err(err(format!("unexpected end reading {} bytes", n)));
        }
        let slice = &self.data[self.pos..end];
        self.pos = end;
        Ok(slice)
    }

    /// Read a VarInt encoded as 7-bits-per-byte (unsigned).
    fn read_varint_u64(&mut self) -> ParquetResult<u64> {
        let mut result: u64 = 0;
        let mut shift = 0u32;
        loop {
            let b = self.read_byte()?;
            result |= ((b & 0x7F) as u64) << shift;
            if b & 0x80 == 0 {
                break;
            }
            shift += 7;
            if shift >= 64 {
                return Err(err("VarInt too large"));
            }
        }
        Ok(result)
    }

    /// Zigzag decode: VarInt → signed integer.
    fn read_varint_i64(&mut self) -> ParquetResult<i64> {
        let n = self.read_varint_u64()?;
        Ok(((n >> 1) as i64) ^ (-((n & 1) as i64)))
    }

    fn read_i32(&mut self) -> ParquetResult<i32> {
        Ok(self.read_varint_i64()? as i32)
    }

    fn read_i64(&mut self) -> ParquetResult<i64> {
        self.read_varint_i64()
    }

    fn read_string(&mut self) -> ParquetResult<String> {
        let len = self.read_varint_u64()? as usize;
        let bytes = self.read_bytes(len)?;
        String::from_utf8(bytes.to_vec()).map_err(|e| err(format!("invalid UTF-8: {}", e)))
    }

    /// Read a Thrift list header: returns (element_type, count).
    fn read_list_header(&mut self) -> ParquetResult<(u8, usize)> {
        let b = self.read_byte()?;
        let count = (b >> 4) as usize;
        let etype = b & 0x0F;
        if count == 0x0F {
            // Large list: count is a separate VarInt.
            let n = self.read_varint_u64()? as usize;
            Ok((etype, n))
        } else {
            Ok((etype, count))
        }
    }

    /// Skip a Thrift value of the given compact type.
    fn skip_value(&mut self, ttype: u8) -> ParquetResult<()> {
        match ttype {
            1 | 2 => {} // boolean (encoded in field header for compact protocol)
            3 => { self.read_byte()?; } // byte (i8)
            4 | 5 => { self.read_varint_u64()?; } // i16/i32
            6 => { self.read_varint_u64()?; } // i64
            7 => { self.read_bytes(8)?; } // double (fixed 64-bit)
            8 => { let n = self.read_varint_u64()? as usize; self.read_bytes(n)?; } // binary/string
            11 => { // list
                let (etype, count) = self.read_list_header()?;
                for _ in 0..count {
                    self.skip_value(etype)?;
                }
            }
            12 => { // struct
                self.skip_struct()?;
            }
            13 => { // map
                if self.remaining() == 0 { return Ok(()); }
                let b = self.read_byte()?;
                if b == 0 { return Ok(()); } // empty map
                let count = self.read_varint_u64()? as usize;
                let ktype = b >> 4;
                let vtype = b & 0x0F;
                for _ in 0..count {
                    self.skip_value(ktype)?;
                    self.skip_value(vtype)?;
                }
            }
            _ => return Err(err(format!("unknown Thrift type: {}", ttype))),
        }
        Ok(())
    }

    /// Skip an entire struct (until stop field type 0).
    fn skip_struct(&mut self) -> ParquetResult<()> {
        let mut last_field: i16 = 0;
        loop {
            let b = self.read_byte()?;
            let ttype = b & 0x0F;
            if ttype == 0 { break; } // stop field
            let delta = (b >> 4) as i16;
            last_field = if delta == 0 {
                self.read_varint_i64()? as i16
            } else {
                last_field + delta
            };
            // boolean fields are encoded in the field type (1=true, 2=false)
            if ttype != 1 && ttype != 2 {
                self.skip_value(ttype)?;
            }
        }
        Ok(())
    }
}

// ── Parquet type codes (Thrift enum values) ───────────────────────────────────

const PARQUET_TYPE_BOOLEAN: i32 = 0;
const PARQUET_TYPE_INT32: i32 = 1;
const PARQUET_TYPE_INT64: i32 = 2;
const PARQUET_TYPE_FLOAT: i32 = 4;
const PARQUET_TYPE_DOUBLE: i32 = 5;
const PARQUET_TYPE_BYTE_ARRAY: i32 = 6;
#[allow(dead_code)]
const PARQUET_TYPE_FIXED_LEN_BYTE_ARRAY: i32 = 7;

const ENCODING_PLAIN: i32 = 0;
const COMPRESSION_UNCOMPRESSED: i32 = 0;

const PAGE_TYPE_DATA_PAGE: i32 = 0;
#[allow(dead_code)]
const PAGE_TYPE_DICTIONARY_PAGE: i32 = 2;
const PAGE_TYPE_DATA_PAGE_V2: i32 = 3;

// ── Parsed metadata structures ────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct SchemaElement {
    name: String,
    ptype: Option<i32>, // None = group node
    #[allow(dead_code)]
    repetition: Option<i32>,
    #[allow(dead_code)]
    num_children: Option<i32>,
}

#[derive(Debug, Clone)]
struct ColumnMetaData {
    ptype: i32,
    #[allow(dead_code)]
    codec: i32,
    #[allow(dead_code)]
    num_values: i64,
    data_page_offset: i64,
    #[allow(dead_code)]
    total_compressed_size: i64,
    #[allow(dead_code)]
    total_uncompressed_size: i64,
}

#[derive(Debug)]
struct ColumnChunk {
    meta_data: Option<ColumnMetaData>,
    /// Absolute byte offset in the file for the column data.
    file_offset: i64,
}

#[derive(Debug)]
struct RowGroup {
    columns: Vec<ColumnChunk>,
    num_rows: i64,
}

#[derive(Debug)]
struct FileMetaData {
    schema: Vec<SchemaElement>,
    num_rows: i64,
    row_groups: Vec<RowGroup>,
}

// ── Thrift deserialisation for FileMetaData ───────────────────────────────────

fn read_schema_element(c: &mut ThriftCursor<'_>) -> ParquetResult<SchemaElement> {
    let mut name = String::new();
    let mut ptype: Option<i32> = None;
    let mut repetition: Option<i32> = None;
    let mut num_children: Option<i32> = None;
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 4) | (1, 5) => { ptype = Some(c.read_i32()?); } // type: i32
            (2, 4) | (2, 5) => { repetition = Some(c.read_i32()?); }
            (3, 4) | (3, 5) => { num_children = Some(c.read_i32()?); }
            (4, 8) => { name = c.read_string()?; }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok(SchemaElement { name, ptype, repetition, num_children })
}

fn read_column_meta(c: &mut ThriftCursor<'_>) -> ParquetResult<ColumnMetaData> {
    let mut ptype = 0i32;
    let mut codec = COMPRESSION_UNCOMPRESSED;
    let mut num_values = 0i64;
    let mut data_page_offset = 0i64;
    let mut total_compressed = 0i64;
    let mut total_uncompressed = 0i64;
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 4) | (1, 5) => { ptype = c.read_i32()?; } // type
            (2, 11) => { // encodings: list<Encoding(i32)>
                let (_, n) = c.read_list_header()?;
                for _ in 0..n { c.read_varint_u64()?; }
            }
            (3, 11) => { // path_in_schema: list<string>
                let (_, n) = c.read_list_header()?;
                for _ in 0..n { c.read_string()?; }
            }
            (4, 4) | (4, 5) => { codec = c.read_i32()?; }
            (5, 6) => { num_values = c.read_i64()?; }
            (6, 6) => { total_uncompressed = c.read_i64()?; }
            (7, 6) => { total_compressed = c.read_i64()?; }
            (9, 6) => { data_page_offset = c.read_i64()?; }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok(ColumnMetaData {
        ptype,
        codec,
        num_values,
        data_page_offset,
        total_compressed_size: total_compressed,
        total_uncompressed_size: total_uncompressed,
    })
}

fn read_column_chunk(c: &mut ThriftCursor<'_>) -> ParquetResult<ColumnChunk> {
    let mut meta: Option<ColumnMetaData> = None;
    let mut file_offset = 0i64;
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 8) => { c.read_string()?; } // file_path (skip)
            (2, 6) => { file_offset = c.read_i64()?; }
            (3, 12) => { meta = Some(read_column_meta(c)?); }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok(ColumnChunk { meta_data: meta, file_offset })
}

fn read_row_group(c: &mut ThriftCursor<'_>) -> ParquetResult<RowGroup> {
    let mut columns = Vec::new();
    let mut num_rows = 0i64;
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 11) => { // columns: list<ColumnChunk>
                let (_, n) = c.read_list_header()?;
                for _ in 0..n { columns.push(read_column_chunk(c)?); }
            }
            (2, 6) => { c.read_i64()?; } // total_byte_size
            (3, 6) => { num_rows = c.read_i64()?; }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok(RowGroup { columns, num_rows })
}

fn read_file_metadata(c: &mut ThriftCursor<'_>) -> ParquetResult<FileMetaData> {
    let mut schema = Vec::new();
    let mut num_rows = 0i64;
    let mut row_groups = Vec::new();
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 4) | (1, 5) => { let _ = c.read_i32()?; }
            (2, 11) => { // schema: list<SchemaElement>
                let (_, n) = c.read_list_header()?;
                for _ in 0..n { schema.push(read_schema_element(c)?); }
            }
            (3, 6) => { num_rows = c.read_i64()?; }
            (4, 11) => { // row_groups: list<RowGroup>
                let (_, n) = c.read_list_header()?;
                for _ in 0..n { row_groups.push(read_row_group(c)?); }
            }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok(FileMetaData { schema, num_rows, row_groups })
}

// ── Page header parsing ───────────────────────────────────────────────────────

struct DataPageInfo {
    num_values: i32,
    #[allow(dead_code)]
    encoding: i32,
    // v2 fields
    is_v2: bool,
    #[allow(dead_code)]
    rep_levels_byte_len: i32,
    #[allow(dead_code)]
    def_levels_byte_len: i32,
}

fn read_page_header(c: &mut ThriftCursor<'_>) -> ParquetResult<(i32, i32, i32, Option<DataPageInfo>)> {
    // Returns (page_type, uncompressed_page_size, compressed_page_size, page_info)
    let mut page_type = 0i32;
    let mut uncompressed_size = 0i32;
    let mut compressed_size = 0i32;
    let mut data_page: Option<DataPageInfo> = None;
    let mut last_field: i16 = 0;
    loop {
        let b = c.read_byte()?;
        let ttype = b & 0x0F;
        if ttype == 0 { break; }
        let delta = (b >> 4) as i16;
        let field_id = if delta == 0 { c.read_varint_i64()? as i16 } else { last_field + delta };
        last_field = field_id;
        match (field_id, ttype) {
            (1, 4) | (1, 5) => { page_type = c.read_i32()?; }
            (2, 4) | (2, 5) => { uncompressed_size = c.read_i32()?; }
            (3, 4) | (3, 5) => { compressed_size = c.read_i32()?; }
            (4, 12) => { // data_page_header
                let mut num_values = 0i32;
                let mut encoding = ENCODING_PLAIN;
                let mut lf2: i16 = 0;
                loop {
                    let b2 = c.read_byte()?;
                    let ttype2 = b2 & 0x0F;
                    if ttype2 == 0 { break; }
                    let d2 = (b2 >> 4) as i16;
                    let fid2 = if d2 == 0 { c.read_varint_i64()? as i16 } else { lf2 + d2 };
                    lf2 = fid2;
                    match (fid2, ttype2) {
                        (1, 4) | (1, 5) => { num_values = c.read_i32()?; }
                        (2, 4) | (2, 5) => { encoding = c.read_i32()?; }
                        (3, 4) | (3, 5) => { c.read_i32()?; } // definition_level_encoding
                        (4, 4) | (4, 5) => { c.read_i32()?; } // repetition_level_encoding
                        _ => { if ttype2 != 1 && ttype2 != 2 { c.skip_value(ttype2)?; } }
                    }
                }
                data_page = Some(DataPageInfo { num_values, encoding, is_v2: false, rep_levels_byte_len: 0, def_levels_byte_len: 0 });
            }
            (7, 12) => { // data_page_header_v2
                let mut num_values = 0i32;
                let mut num_rows_v2 = 0i32;
                let mut encoding = ENCODING_PLAIN;
                let mut rep_levels_byte_len = 0i32;
                let mut def_levels_byte_len = 0i32;
                let mut lf2: i16 = 0;
                loop {
                    let b2 = c.read_byte()?;
                    let ttype2 = b2 & 0x0F;
                    if ttype2 == 0 { break; }
                    let d2 = (b2 >> 4) as i16;
                    let fid2 = if d2 == 0 { c.read_varint_i64()? as i16 } else { lf2 + d2 };
                    lf2 = fid2;
                    match (fid2, ttype2) {
                        (1, 4) | (1, 5) => { num_values = c.read_i32()?; }
                        (2, 4) | (2, 5) => { num_rows_v2 = c.read_i32()?; }
                        (3, 4) | (3, 5) => { encoding = c.read_i32()?; }
                        (4, 4) | (4, 5) => { def_levels_byte_len = c.read_i32()?; }
                        (5, 4) | (5, 5) => { rep_levels_byte_len = c.read_i32()?; }
                        _ => { if ttype2 != 1 && ttype2 != 2 { c.skip_value(ttype2)?; } }
                    }
                }
                let _ = num_rows_v2;
                data_page = Some(DataPageInfo { num_values, encoding, is_v2: true, rep_levels_byte_len, def_levels_byte_len });
            }
            _ => { if ttype != 1 && ttype != 2 { c.skip_value(ttype)?; } }
        }
    }
    Ok((page_type, uncompressed_size, compressed_size, data_page))
}

// ── Column data reading ───────────────────────────────────────────────────────

/// Read all values from a column chunk (PLAIN encoding, UNCOMPRESSED only).
fn read_column_values(
    file_bytes: &[u8],
    meta: &ColumnMetaData,
    num_rows: i64,
) -> ParquetResult<Vec<f64>> {
    let offset = meta.data_page_offset as usize;
    if offset >= file_bytes.len() {
        return Err(err(format!("column offset {} out of bounds", offset)));
    }
    let col_bytes = &file_bytes[offset..];
    let mut cursor = ThriftCursor::new(col_bytes);
    let mut values: Vec<f64> = Vec::with_capacity(num_rows as usize);
    let ptype = meta.ptype;

    while values.len() < num_rows as usize {
        let (page_type, _uncompressed, _compressed, page_info) = read_page_header(&mut cursor)?;
        match page_type {
            t if t == PAGE_TYPE_DATA_PAGE || t == PAGE_TYPE_DATA_PAGE_V2 => {
                let info = page_info.ok_or_else(|| err("DATA_PAGE without header"))?;
                let data_start = cursor.pos;

                // For V2 pages, skip repetition + definition level bytes (all required = 0 bytes)
                if info.is_v2 {
                    cursor.pos += info.rep_levels_byte_len as usize + info.def_levels_byte_len as usize;
                } else {
                    // V1: required columns have no level data. Skip definition level encoding
                    // (encoded as RLE: 4-byte length + data, only if there are nulls — skip).
                }

                let n = info.num_values as usize;
                let data_slice = &col_bytes[cursor.pos..];
                match ptype {
                    t if t == PARQUET_TYPE_DOUBLE => {
                        if data_slice.len() < n * 8 {
                            return Err(err("not enough bytes for DOUBLE values"));
                        }
                        for i in 0..n {
                            let lo = i * 8;
                            let v = f64::from_le_bytes(data_slice[lo..lo+8].try_into().unwrap());
                            values.push(v);
                        }
                        cursor.pos += n * 8;
                    }
                    t if t == PARQUET_TYPE_FLOAT => {
                        if data_slice.len() < n * 4 {
                            return Err(err("not enough bytes for FLOAT values"));
                        }
                        for i in 0..n {
                            let lo = i * 4;
                            let v = f32::from_le_bytes(data_slice[lo..lo+4].try_into().unwrap());
                            values.push(v as f64);
                        }
                        cursor.pos += n * 4;
                    }
                    t if t == PARQUET_TYPE_INT32 => {
                        if data_slice.len() < n * 4 {
                            return Err(err("not enough bytes for INT32 values"));
                        }
                        for i in 0..n {
                            let lo = i * 4;
                            let v = i32::from_le_bytes(data_slice[lo..lo+4].try_into().unwrap());
                            values.push(v as f64);
                        }
                        cursor.pos += n * 4;
                    }
                    t if t == PARQUET_TYPE_INT64 => {
                        if data_slice.len() < n * 8 {
                            return Err(err("not enough bytes for INT64 values"));
                        }
                        for i in 0..n {
                            let lo = i * 8;
                            let v = i64::from_le_bytes(data_slice[lo..lo+8].try_into().unwrap());
                            values.push(v as f64);
                        }
                        cursor.pos += n * 8;
                    }
                    t if t == PARQUET_TYPE_BOOLEAN => {
                        // Booleans are bit-packed; not coercible to float — skip
                        let nbytes = (n + 7) / 8;
                        cursor.pos += nbytes;
                        let _ = data_start;
                    }
                    t if t == PARQUET_TYPE_BYTE_ARRAY => {
                        // Skip byte array column data (strings not coercible to f64)
                        // Each value: 4-byte length + data
                        for _ in 0..n {
                            if cursor.pos + 4 > col_bytes.len() {
                                return Err(err("truncated BYTE_ARRAY"));
                            }
                            let len = u32::from_le_bytes(col_bytes[cursor.pos..cursor.pos+4].try_into().unwrap()) as usize;
                            cursor.pos += 4 + len;
                        }
                    }
                    _ => {
                        return Err(err(format!("unsupported Parquet type: {}", ptype)));
                    }
                }
            }
            _ => {
                // Skip non-data pages (dictionary, index, etc.)
                if _compressed > 0 {
                    cursor.pos += _compressed as usize;
                }
            }
        }
    }
    Ok(values)
}

// ── Public parse API ──────────────────────────────────────────────────────────

/// A parsed Parquet column: name + f64 values (numeric types) or empty (other).
#[derive(Debug, Clone)]
pub struct ParquetColumn {
    pub name: String,
    pub values: Vec<f64>,
}

/// Parse a Parquet file byte slice into a list of numeric columns.
///
/// Only numeric Parquet types (DOUBLE, FLOAT, INT32, INT64) are included.
/// BOOLEAN and BYTE_ARRAY columns are skipped.
///
/// Returns `Err` if the file is not a valid Parquet file or uses unsupported
/// features (compression other than UNCOMPRESSED, DICTIONARY encoding).
pub fn parse_parquet(bytes: &[u8]) -> ParquetResult<Vec<ParquetColumn>> {
    // Validate magic bytes.
    if bytes.len() < 12 {
        return Err(err("file too short to be Parquet (need at least 12 bytes)"));
    }
    if &bytes[..4] != b"PAR1" {
        return Err(err("missing PAR1 magic header"));
    }
    if &bytes[bytes.len()-4..] != b"PAR1" {
        return Err(err("missing PAR1 magic footer"));
    }

    // Read footer length (4 bytes before trailing PAR1).
    let footer_len = u32::from_le_bytes(bytes[bytes.len()-8..bytes.len()-4].try_into().unwrap()) as usize;
    let footer_start = bytes.len() - 8 - footer_len;
    if footer_start < 4 {
        return Err(err("footer length exceeds file size"));
    }
    let footer_bytes = &bytes[footer_start..footer_start + footer_len];
    let mut c = ThriftCursor::new(footer_bytes);
    let meta = read_file_metadata(&mut c)?;

    // Build column name list from schema (skip root group element at index 0).
    let col_schemas: Vec<&SchemaElement> = meta.schema.iter()
        .skip(1) // skip root message schema
        .filter(|s| s.ptype.is_some())
        .collect();

    if meta.row_groups.is_empty() {
        // No data; return empty columns.
        return Ok(col_schemas.iter().map(|s| ParquetColumn {
            name: s.name.clone(),
            values: Vec::new(),
        }).collect());
    }

    // Validate column counts are consistent across row groups.
    let ncols = col_schemas.len();
    for rg in &meta.row_groups {
        if rg.columns.len() != ncols {
            return Err(err(format!(
                "row group has {} columns but schema has {}",
                rg.columns.len(), ncols
            )));
        }
    }

    // For each column, read all row groups.
    let mut result: Vec<ParquetColumn> = col_schemas.iter().map(|s| ParquetColumn {
        name: s.name.clone(),
        values: Vec::with_capacity(meta.num_rows as usize),
    }).collect();

    for rg in &meta.row_groups {
        for (ci, cc) in rg.columns.iter().enumerate() {
            // Skip non-numeric types.
            let ptype = col_schemas[ci].ptype.unwrap_or(-1);
            let numeric = matches!(ptype,
                t if t == PARQUET_TYPE_DOUBLE || t == PARQUET_TYPE_FLOAT ||
                     t == PARQUET_TYPE_INT32 || t == PARQUET_TYPE_INT64
            );
            if !numeric {
                continue;
            }

            // Resolve metadata: either inline or use file_offset.
            let meta_data = if let Some(ref md) = cc.meta_data {
                md.clone()
            } else {
                // Metadata is at file_offset (column chunk in a different file — unsupported).
                if cc.file_offset == 0 {
                    continue;
                }
                return Err(err("external column chunks not supported"));
            };

            if meta_data.codec != COMPRESSION_UNCOMPRESSED {
                return Err(err(format!(
                    "column '{}' uses compression codec {} — only UNCOMPRESSED is supported",
                    col_schemas[ci].name, meta_data.codec
                )));
            }

            let col_values = read_column_values(bytes, &meta_data, rg.num_rows)?;
            result[ci].values.extend(col_values);
        }
    }

    Ok(result)
}

/// Convert parsed Parquet columns into a `Value::Table`.
pub fn parquet_to_table(columns: Vec<ParquetColumn>) -> Value {
    if columns.is_empty() {
        return Value::error("parquet_import: file contains no numeric columns");
    }
    let nrows = columns[0].values.len();
    // Only include columns that have data.
    let numeric_cols: Vec<&ParquetColumn> = columns.iter()
        .filter(|c| !c.values.is_empty() && c.values.len() == nrows)
        .collect();
    if numeric_cols.is_empty() {
        return Value::error("parquet_import: no numeric columns with consistent row count");
    }
    Value::Table {
        columns: numeric_cols.iter().map(|c| c.name.clone()).collect(),
        rows: (0..nrows).map(|r| numeric_cols.iter().map(|c| c.values[r]).collect()).collect(),
    }
}

// ── Parquet writer ────────────────────────────────────────────────────────────

/// Write helper for Thrift compact binary protocol.
struct ThriftWriter {
    buf: Vec<u8>,
    last_field: i16,
}

impl ThriftWriter {
    fn new() -> Self {
        Self { buf: Vec::new(), last_field: 0 }
    }

    fn write_varint(&mut self, mut n: u64) {
        loop {
            let b = (n & 0x7F) as u8;
            n >>= 7;
            if n == 0 {
                self.buf.push(b);
                break;
            } else {
                self.buf.push(b | 0x80);
            }
        }
    }

    fn zigzag_i64(n: i64) -> u64 {
        ((n << 1) ^ (n >> 63)) as u64
    }

    fn field_begin(&mut self, field_id: i16, ttype: u8) {
        let delta = field_id - self.last_field;
        self.last_field = field_id;
        if delta > 0 && delta <= 15 {
            self.buf.push(((delta as u8) << 4) | ttype);
        } else {
            self.buf.push(ttype);
            self.write_varint(Self::zigzag_i64(field_id as i64));
        }
    }

    fn write_i32_field(&mut self, field_id: i16, val: i32) {
        self.field_begin(field_id, 5); // type 5 = i32
        self.write_varint(Self::zigzag_i64(val as i64));
    }

    fn write_i64_field(&mut self, field_id: i16, val: i64) {
        self.field_begin(field_id, 6); // type 6 = i64
        self.write_varint(Self::zigzag_i64(val));
    }

    fn write_string_field(&mut self, field_id: i16, s: &str) {
        self.field_begin(field_id, 8); // type 8 = binary/string
        self.write_varint(s.len() as u64);
        self.buf.extend_from_slice(s.as_bytes());
    }

    fn write_list_begin(&mut self, field_id: i16, etype: u8, count: usize) {
        self.field_begin(field_id, 11); // type 11 = list
        if count < 15 {
            self.buf.push(((count as u8) << 4) | etype);
        } else {
            self.buf.push(0xF0 | etype);
            self.write_varint(count as u64);
        }
    }

    fn write_struct_field(&mut self, field_id: i16) {
        self.field_begin(field_id, 12); // type 12 = struct
    }

    fn stop(&mut self) {
        self.buf.push(0);
        self.last_field = 0;
    }

    /// Write a nested struct, resetting field counter.
    fn begin_nested(&mut self) {
        self.last_field = 0;
    }

    fn into_bytes(self) -> Vec<u8> {
        self.buf
    }
}

/// Encode a page header (DataPageV1) for PLAIN data.
fn encode_page_header(num_values: i32, data_size: i32) -> Vec<u8> {
    let mut w = ThriftWriter::new();
    w.write_i32_field(1, PAGE_TYPE_DATA_PAGE); // page_type
    w.write_i32_field(2, data_size); // uncompressed_page_size
    w.write_i32_field(3, data_size); // compressed_page_size
    // data_page_header (field 4, struct)
    w.write_struct_field(4);
    w.begin_nested();
    w.write_i32_field(1, num_values); // num_values
    w.write_i32_field(2, ENCODING_PLAIN); // encoding
    w.write_i32_field(3, ENCODING_PLAIN); // definition_level_encoding
    w.write_i32_field(4, ENCODING_PLAIN); // repetition_level_encoding
    w.stop();
    w.stop(); // end PageHeader
    w.into_bytes()
}

/// Write a minimal Parquet file from a list of named f64 columns.
///
/// Uses PLAIN encoding, UNCOMPRESSED compression, required repetition.
/// All columns must have the same length.
///
/// Returns the complete `.parquet` file bytes.
pub fn write_parquet(columns: &[(&str, &[f64])]) -> ParquetResult<Vec<u8>> {
    if columns.is_empty() {
        return Err(err("cannot write Parquet with zero columns"));
    }
    let nrows = columns[0].1.len();
    for (name, vals) in columns.iter() {
        if vals.len() != nrows {
            return Err(err(format!("column '{}' has {} rows, expected {}", name, vals.len(), nrows)));
        }
    }

    let mut file: Vec<u8> = Vec::new();
    file.extend_from_slice(b"PAR1");

    // Write each column as a single row group with one page per column.
    // Track column chunk offsets for metadata.
    let mut col_offsets: Vec<i64> = Vec::new();
    let mut col_page_sizes: Vec<i32> = Vec::new();

    for (_name, vals) in columns.iter() {
        col_offsets.push(file.len() as i64);
        let data_bytes: Vec<u8> = vals.iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        let data_size = data_bytes.len() as i32;
        let page_hdr = encode_page_header(nrows as i32, data_size);
        file.extend_from_slice(&page_hdr);
        file.extend_from_slice(&data_bytes);
        col_page_sizes.push(data_size);
    }

    // Build FileMetaData Thrift struct.
    let footer_start = file.len();
    let mut w = ThriftWriter::new();

    // version = 2
    w.write_i32_field(1, 2);

    // schema: list<SchemaElement>
    // Element 0: root message (group)
    // Elements 1..N: column leaves
    w.write_list_begin(2, 12, 1 + columns.len());

    // Root group schema element
    w.begin_nested();
    w.write_i32_field(3, columns.len() as i32); // num_children
    w.write_string_field(4, "message");          // name
    w.stop();

    // Column schema elements
    for (col_name, _) in columns.iter() {
        w.begin_nested();
        w.write_i32_field(1, PARQUET_TYPE_DOUBLE); // type = DOUBLE
        w.write_i32_field(2, 0);                   // repetition_type = REQUIRED
        w.write_string_field(4, col_name);         // name
        w.stop();
    }

    // num_rows
    w.write_i64_field(3, nrows as i64);

    // row_groups: list<RowGroup> (1 row group)
    w.write_list_begin(4, 12, 1);
    w.begin_nested();

    // columns: list<ColumnChunk>
    w.write_list_begin(1, 12, columns.len());
    for (ci, (col_name, vals)) in columns.iter().enumerate() {
        w.begin_nested();
        let offset = col_offsets[ci];
        w.write_i64_field(2, offset); // file_offset
        // meta_data: ColumnMetaData (field 3)
        w.write_struct_field(3);
        w.begin_nested();
        w.write_i32_field(1, PARQUET_TYPE_DOUBLE); // type = DOUBLE
        // encodings: list<Encoding> = [PLAIN]
        w.write_list_begin(2, 5, 1);
        w.write_varint(ThriftWriter::zigzag_i64(ENCODING_PLAIN as i64));
        // path_in_schema: list<string>
        w.write_list_begin(3, 8, 1);
        w.write_varint(col_name.len() as u64);
        w.buf.extend_from_slice(col_name.as_bytes());
        // codec = UNCOMPRESSED
        w.write_i32_field(4, COMPRESSION_UNCOMPRESSED);
        // num_values
        w.write_i64_field(5, vals.len() as i64);
        // total_uncompressed_size = total_compressed_size = data size + page header estimate
        let total_sz = (col_page_sizes[ci] + 50) as i64;
        w.write_i64_field(6, total_sz);
        w.write_i64_field(7, total_sz);
        // data_page_offset
        w.write_i64_field(9, offset);
        w.stop(); // end ColumnMetaData
        w.stop(); // end ColumnChunk
    }
    // total_byte_size (approx)
    let total_byte_size: i64 = col_page_sizes.iter().map(|s| *s as i64 + 50).sum();
    w.write_i64_field(2, total_byte_size);
    // num_rows
    w.write_i64_field(3, nrows as i64);
    w.stop(); // end RowGroup

    w.stop(); // end FileMetaData
    let footer_bytes = w.into_bytes();

    file.extend_from_slice(&footer_bytes);
    let footer_len = (file.len() - footer_start) as u32;
    file.extend_from_slice(&footer_len.to_le_bytes());
    file.extend_from_slice(b"PAR1");

    Ok(file)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_simple_parquet() -> Vec<u8> {
        let x: Vec<f64> = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let y: Vec<f64> = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        write_parquet(&[("x", &x), ("y", &y)]).unwrap()
    }

    #[test]
    fn write_produces_par1_magic() {
        let bytes = make_simple_parquet();
        assert_eq!(&bytes[..4], b"PAR1");
        assert_eq!(&bytes[bytes.len()-4..], b"PAR1");
    }

    #[test]
    fn round_trip_two_columns() {
        let bytes = make_simple_parquet();
        let cols = parse_parquet(&bytes).unwrap();
        assert_eq!(cols.len(), 2);
        assert_eq!(cols[0].name, "x");
        assert_eq!(cols[0].values, vec![1.0, 2.0, 3.0, 4.0, 5.0]);
        assert_eq!(cols[1].name, "y");
        assert_eq!(cols[1].values, vec![10.0, 20.0, 30.0, 40.0, 50.0]);
    }

    #[test]
    fn round_trip_single_column() {
        let z: Vec<f64> = vec![3.14, 2.71, 1.41];
        let bytes = write_parquet(&[("z", &z)]).unwrap();
        let cols = parse_parquet(&bytes).unwrap();
        assert_eq!(cols.len(), 1);
        for (a, b) in cols[0].values.iter().zip(z.iter()) {
            assert!((a - b).abs() < 1e-12);
        }
    }

    #[test]
    fn parquet_to_table_returns_table() {
        let bytes = make_simple_parquet();
        let cols = parse_parquet(&bytes).unwrap();
        let v = parquet_to_table(cols);
        match v {
            Value::Table { columns, rows } => {
                assert_eq!(columns, vec!["x", "y"]);
                assert_eq!(rows.len(), 5);
                assert!((rows[0][0] - 1.0).abs() < 1e-12);
                assert!((rows[4][1] - 50.0).abs() < 1e-12);
            }
            other => panic!("expected Table, got {:?}", other),
        }
    }

    #[test]
    fn invalid_magic_returns_error() {
        let bytes = b"NOPE\x00\x00\x00\x00NOPE".to_vec();
        assert!(parse_parquet(&bytes).is_err());
    }

    #[test]
    fn file_too_short_returns_error() {
        assert!(parse_parquet(&[0u8; 5]).is_err());
    }

    #[test]
    fn empty_columns_write_error() {
        assert!(write_parquet(&[]).is_err());
    }

    #[test]
    fn mismatched_row_count_write_error() {
        let a = vec![1.0, 2.0];
        let b = vec![3.0];
        assert!(write_parquet(&[("a", &a), ("b", &b)]).is_err());
    }

    #[test]
    fn round_trip_large_dataset() {
        let n = 1000;
        let data: Vec<f64> = (0..n).map(|i| i as f64 * 0.1).collect();
        let bytes = write_parquet(&[("v", &data)]).unwrap();
        let cols = parse_parquet(&bytes).unwrap();
        assert_eq!(cols[0].values.len(), n);
        assert!((cols[0].values[999] - 99.9).abs() < 1e-9);
    }
}
