//! Feature preprocessing: standardisation, normalisation, train/test split.

/// Standardise features (z-score): (x - mean) / std for each column.
/// Returns (scaled_data, means, stds).
pub fn standardize(data: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>) {
    if data.is_empty() { return (vec![], vec![], vec![]); }
    let n = data.len() as f64;
    let cols = data[0].len();

    let mut means = vec![0.0; cols];
    let mut stds = vec![0.0; cols];

    for row in data {
        for (j, val) in row.iter().enumerate() {
            means[j] += val;
        }
    }
    for m in &mut means { *m /= n; }

    for row in data {
        for (j, val) in row.iter().enumerate() {
            let d = val - means[j];
            stds[j] += d * d;
        }
    }
    for s in &mut stds { *s = (*s / n).sqrt(); }

    let scaled: Vec<Vec<f64>> = data.iter().map(|row| {
        row.iter().enumerate().map(|(j, val)| {
            if stds[j] > 1e-15 { (val - means[j]) / stds[j] } else { 0.0 }
        }).collect()
    }).collect();

    (scaled, means, stds)
}

/// Normalise features to \[0, 1\]: (x - min) / (max - min) for each column.
/// Returns (scaled_data, mins, maxs).
pub fn normalize(data: &[Vec<f64>]) -> (Vec<Vec<f64>>, Vec<f64>, Vec<f64>) {
    if data.is_empty() { return (vec![], vec![], vec![]); }
    let cols = data[0].len();

    let mut mins = vec![f64::INFINITY; cols];
    let mut maxs = vec![f64::NEG_INFINITY; cols];

    for row in data {
        for (j, val) in row.iter().enumerate() {
            if *val < mins[j] { mins[j] = *val; }
            if *val > maxs[j] { maxs[j] = *val; }
        }
    }

    let scaled: Vec<Vec<f64>> = data.iter().map(|row| {
        row.iter().enumerate().map(|(j, val)| {
            let range = maxs[j] - mins[j];
            if range > 1e-15 { (val - mins[j]) / range } else { 0.0 }
        }).collect()
    }).collect();

    (scaled, mins, maxs)
}

/// Split data into train and test sets by ratio (e.g., 0.8 for 80% train).
/// Deterministic split (takes first N rows as train, rest as test).
pub fn train_test_split(
    x: &[Vec<f64>],
    y: &[f64],
    train_ratio: f64,
) -> (Vec<Vec<f64>>, Vec<f64>, Vec<Vec<f64>>, Vec<f64>) {
    let n = x.len();
    let train_n = ((n as f64) * train_ratio.clamp(0.0, 1.0)).round() as usize;
    (
        x[..train_n].to_vec(),
        y[..train_n].to_vec(),
        x[train_n..].to_vec(),
        y[train_n..].to_vec(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standardize_basic() {
        let data = vec![vec![1.0, 10.0], vec![2.0, 20.0], vec![3.0, 30.0]];
        let (scaled, means, _stds) = standardize(&data);
        assert!((means[0] - 2.0).abs() < 1e-10);
        assert!((means[1] - 20.0).abs() < 1e-10);
        // Mean of standardized should be ~0
        let mean_scaled: f64 = scaled.iter().map(|r| r[0]).sum::<f64>() / 3.0;
        assert!(mean_scaled.abs() < 1e-10);
    }

    #[test]
    fn normalize_basic() {
        let data = vec![vec![1.0, 100.0], vec![3.0, 300.0], vec![5.0, 500.0]];
        let (scaled, mins, maxs) = normalize(&data);
        assert_eq!(mins, vec![1.0, 100.0]);
        assert_eq!(maxs, vec![5.0, 500.0]);
        assert_eq!(scaled[0], vec![0.0, 0.0]);
        assert_eq!(scaled[2], vec![1.0, 1.0]);
    }

    #[test]
    fn train_test_split_basic() {
        let x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0], vec![5.0]];
        let y = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let (x_train, y_train, x_test, y_test) = train_test_split(&x, &y, 0.6);
        assert_eq!(x_train.len(), 3);
        assert_eq!(y_train.len(), 3);
        assert_eq!(x_test.len(), 2);
        assert_eq!(y_test.len(), 2);
    }
}
