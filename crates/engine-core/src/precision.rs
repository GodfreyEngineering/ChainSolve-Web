//! High-precision arithmetic helpers using `dashu-float`.
//!
//! These functions operate on string-serialised decimal values and return
//! string results at the requested precision. The string representation
//! is lossless across the WASM boundary (no f64 truncation).
//!
//! Gated behind the `high-precision` Cargo feature flag.

#[cfg(feature = "high-precision")]
use dashu_float::DBig;

#[cfg(feature = "high-precision")]
use std::str::FromStr;

/// Parse a decimal string into a `DBig` with the given precision context.
#[cfg(feature = "high-precision")]
fn parse(s: &str, precision: u32) -> Result<DBig, String> {
    let val = DBig::from_str(s).map_err(|e| format!("HP parse error: {e}"))?;
    // Set precision context (significant digits)
    Ok(val.with_precision(precision as usize).value())
}

/// Convert a `DBig` to a decimal string representation.
#[cfg(feature = "high-precision")]
fn to_string(val: &DBig, _precision: u32) -> String {
    val.to_string()
}

/// Convert a `DBig` to an f64 approximation.
#[cfg(feature = "high-precision")]
fn to_f64(val: &DBig) -> f64 {
    val.to_f64().value()
}

// ── Public API ──────────────────────────────────────────────────────

/// High-precision addition: a + b at the given decimal precision.
#[cfg(feature = "high-precision")]
pub fn hp_add(a: &str, b: &str, precision: u32) -> Result<(String, f64), String> {
    let va = parse(a, precision)?;
    let vb = parse(b, precision)?;
    let result = va + vb;
    Ok((to_string(&result, precision), to_f64(&result)))
}

/// High-precision subtraction: a - b.
#[cfg(feature = "high-precision")]
pub fn hp_sub(a: &str, b: &str, precision: u32) -> Result<(String, f64), String> {
    let va = parse(a, precision)?;
    let vb = parse(b, precision)?;
    let result = va - vb;
    Ok((to_string(&result, precision), to_f64(&result)))
}

/// High-precision multiplication: a * b.
#[cfg(feature = "high-precision")]
pub fn hp_mul(a: &str, b: &str, precision: u32) -> Result<(String, f64), String> {
    let va = parse(a, precision)?;
    let vb = parse(b, precision)?;
    let result = va * vb;
    Ok((to_string(&result, precision), to_f64(&result)))
}

/// High-precision division: a / b.
#[cfg(feature = "high-precision")]
pub fn hp_div(a: &str, b: &str, precision: u32) -> Result<(String, f64), String> {
    let va = parse(a, precision)?;
    let vb = parse(b, precision)?;
    if vb == DBig::ZERO {
        return Err("Division by zero".to_string());
    }
    let result = va / vb;
    Ok((to_string(&result, precision), to_f64(&result)))
}

// ── Stub API when feature is disabled ───────────────────────────────

#[cfg(not(feature = "high-precision"))]
pub fn hp_add(_a: &str, _b: &str, _precision: u32) -> Result<(String, f64), String> {
    Err("High-precision not enabled (compile with --features high-precision)".to_string())
}

#[cfg(not(feature = "high-precision"))]
pub fn hp_sub(_a: &str, _b: &str, _precision: u32) -> Result<(String, f64), String> {
    Err("High-precision not enabled".to_string())
}

#[cfg(not(feature = "high-precision"))]
pub fn hp_mul(_a: &str, _b: &str, _precision: u32) -> Result<(String, f64), String> {
    Err("High-precision not enabled".to_string())
}

#[cfg(not(feature = "high-precision"))]
pub fn hp_div(_a: &str, _b: &str, _precision: u32) -> Result<(String, f64), String> {
    Err("High-precision not enabled".to_string())
}

#[cfg(test)]
#[cfg(feature = "high-precision")]
mod tests {
    use super::*;

    #[test]
    fn add_basic() {
        let (s, f) = hp_add("1.5", "2.5", 10).unwrap();
        let val: f64 = s.parse().unwrap_or(f64::NAN);
        assert!((val - 4.0).abs() < 1e-5, "Expected ~4.0, got string: {}", s);
        assert!((f - 4.0).abs() < 1e-10);
    }

    #[test]
    fn mul_basic() {
        let (s, f) = hp_mul("3.0", "7.0", 10).unwrap();
        let val: f64 = s.parse().unwrap_or(f64::NAN);
        assert!((val - 21.0).abs() < 1e-5, "Expected ~21.0, got string: {}", s);
        assert!((f - 21.0).abs() < 1e-10);
    }

    #[test]
    fn div_by_zero() {
        let result = hp_div("1.0", "0", 10);
        assert!(result.is_err());
    }

    #[test]
    fn one_third_times_three() {
        // The classic precision test: 1/3 * 3 should be very close to 1
        let (third, _) = hp_div("1", "3", 100).unwrap();
        let (result, approx) = hp_mul(&third, "3", 100).unwrap();
        let val: f64 = result.parse().unwrap_or(f64::NAN);
        assert!(
            (val - 1.0).abs() < 1e-5,
            "Expected ~1.0, got: {} (approx: {})",
            result,
            approx
        );
        assert!((approx - 1.0).abs() < 1e-10);
    }
}
