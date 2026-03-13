//! K-Nearest Neighbors classifier.

/// A trained KNN model (just stores the training data).
#[derive(Debug, Clone)]
pub struct KnnModel {
    pub x_train: Vec<Vec<f64>>,
    pub y_train: Vec<f64>,
    pub k: usize,
}

/// Fit a KNN classifier (stores training data).
pub fn fit(x_train: Vec<Vec<f64>>, y_train: Vec<f64>, k: usize) -> Result<KnnModel, String> {
    if x_train.is_empty() {
        return Err("No training data".into());
    }
    if x_train.len() != y_train.len() {
        return Err("X and Y length mismatch".into());
    }
    let k = k.max(1).min(x_train.len());
    Ok(KnnModel { x_train, y_train, k })
}

/// Predict class labels for new data points.
pub fn predict(model: &KnnModel, x_test: &[Vec<f64>]) -> Vec<f64> {
    x_test
        .iter()
        .map(|point| predict_one(model, point))
        .collect()
}

fn predict_one(model: &KnnModel, point: &[f64]) -> f64 {
    // Compute distances to all training points
    let mut distances: Vec<(f64, f64)> = model
        .x_train
        .iter()
        .zip(model.y_train.iter())
        .map(|(x, &y)| {
            let dist: f64 = x
                .iter()
                .zip(point.iter())
                .map(|(&a, &b)| (a - b).powi(2))
                .sum::<f64>()
                .sqrt();
            (dist, y)
        })
        .collect();

    // Sort by distance
    distances.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // Take k nearest neighbors and vote (majority for classification)
    let neighbors: Vec<f64> = distances.iter().take(model.k).map(|&(_, y)| y).collect();

    // Find most common class
    majority_vote(&neighbors)
}

fn majority_vote(values: &[f64]) -> f64 {
    let mut counts: Vec<(f64, usize)> = Vec::new();
    for &v in values {
        if let Some(entry) = counts.iter_mut().find(|(val, _)| (*val - v).abs() < 1e-10) {
            entry.1 += 1;
        } else {
            counts.push((v, 1));
        }
    }
    counts
        .iter()
        .max_by_key(|(_, c)| *c)
        .map(|(v, _)| *v)
        .unwrap_or(f64::NAN)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knn_simple_classification() {
        // Two clusters: class 0 around (0,0), class 1 around (5,5)
        let x = vec![
            vec![0.0, 0.0],
            vec![0.1, 0.1],
            vec![0.2, 0.0],
            vec![5.0, 5.0],
            vec![5.1, 5.1],
            vec![4.9, 5.0],
        ];
        let y = vec![0.0, 0.0, 0.0, 1.0, 1.0, 1.0];
        let model = fit(x, y, 3).unwrap();

        let preds = predict(&model, &[vec![0.05, 0.05], vec![4.95, 4.95]]);
        assert!((preds[0] - 0.0).abs() < 1e-10);
        assert!((preds[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn knn_k1_exact_match() {
        let x = vec![vec![1.0], vec![2.0], vec![3.0]];
        let y = vec![10.0, 20.0, 30.0];
        let model = fit(x, y, 1).unwrap();
        let preds = predict(&model, &[vec![1.0]]);
        assert!((preds[0] - 10.0).abs() < 1e-10);
    }
}
