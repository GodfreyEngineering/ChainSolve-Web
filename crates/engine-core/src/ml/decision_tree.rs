//! Decision tree classifier/regressor (CART algorithm).

/// A decision tree node.
#[derive(Debug, Clone)]
pub enum TreeNode {
    Leaf {
        value: f64,
    },
    Split {
        feature: usize,
        threshold: f64,
        left: Box<TreeNode>,
        right: Box<TreeNode>,
    },
}

/// Trained decision tree model.
#[derive(Debug, Clone)]
pub struct DecisionTreeModel {
    pub root: TreeNode,
    pub max_depth: usize,
}

/// Fit a decision tree (regression mode: predict mean of leaf samples).
pub fn fit(
    x_rows: &[Vec<f64>],
    y: &[f64],
    max_depth: usize,
) -> Result<DecisionTreeModel, String> {
    if x_rows.is_empty() {
        return Err("No training data".into());
    }
    if x_rows.len() != y.len() {
        return Err("X and Y length mismatch".into());
    }

    let max_depth = max_depth.max(1).min(20);
    let indices: Vec<usize> = (0..x_rows.len()).collect();
    let root = build_tree(x_rows, y, &indices, 0, max_depth);

    Ok(DecisionTreeModel { root, max_depth })
}

/// Predict using a trained decision tree.
pub fn predict(model: &DecisionTreeModel, x_rows: &[Vec<f64>]) -> Vec<f64> {
    x_rows
        .iter()
        .map(|row| predict_one(&model.root, row))
        .collect()
}

fn predict_one(node: &TreeNode, x: &[f64]) -> f64 {
    match node {
        TreeNode::Leaf { value } => *value,
        TreeNode::Split {
            feature,
            threshold,
            left,
            right,
        } => {
            if x.get(*feature).copied().unwrap_or(f64::NAN) <= *threshold {
                predict_one(left, x)
            } else {
                predict_one(right, x)
            }
        }
    }
}

fn build_tree(
    x_rows: &[Vec<f64>],
    y: &[f64],
    indices: &[usize],
    depth: usize,
    max_depth: usize,
) -> TreeNode {
    // Base cases
    if indices.len() <= 1 || depth >= max_depth {
        return TreeNode::Leaf {
            value: mean_of(y, indices),
        };
    }

    // Check if all y values are the same
    let first_y = y[indices[0]];
    if indices.iter().all(|&i| (y[i] - first_y).abs() < 1e-15) {
        return TreeNode::Leaf { value: first_y };
    }

    let n_features = x_rows[0].len();
    let mut best_feature = 0;
    let mut best_threshold = 0.0;
    let mut best_score = f64::INFINITY;
    let mut best_left = Vec::new();
    let mut best_right = Vec::new();

    for feat in 0..n_features {
        // Get sorted unique thresholds (midpoints between consecutive values)
        let mut vals: Vec<f64> = indices.iter().map(|&i| x_rows[i][feat]).collect();
        vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        vals.dedup();

        for window in vals.windows(2) {
            let threshold = (window[0] + window[1]) / 2.0;

            let mut left_idx = Vec::new();
            let mut right_idx = Vec::new();
            for &i in indices {
                if x_rows[i][feat] <= threshold {
                    left_idx.push(i);
                } else {
                    right_idx.push(i);
                }
            }

            if left_idx.is_empty() || right_idx.is_empty() {
                continue;
            }

            // Weighted MSE as impurity
            let left_mse = mse_of(y, &left_idx);
            let right_mse = mse_of(y, &right_idx);
            let score = (left_idx.len() as f64 * left_mse + right_idx.len() as f64 * right_mse)
                / indices.len() as f64;

            if score < best_score {
                best_score = score;
                best_feature = feat;
                best_threshold = threshold;
                best_left = left_idx;
                best_right = right_idx;
            }
        }
    }

    if best_left.is_empty() || best_right.is_empty() {
        return TreeNode::Leaf {
            value: mean_of(y, indices),
        };
    }

    TreeNode::Split {
        feature: best_feature,
        threshold: best_threshold,
        left: Box::new(build_tree(x_rows, y, &best_left, depth + 1, max_depth)),
        right: Box::new(build_tree(x_rows, y, &best_right, depth + 1, max_depth)),
    }
}

fn mean_of(y: &[f64], indices: &[usize]) -> f64 {
    if indices.is_empty() {
        return f64::NAN;
    }
    indices.iter().map(|&i| y[i]).sum::<f64>() / indices.len() as f64
}

fn mse_of(y: &[f64], indices: &[usize]) -> f64 {
    let m = mean_of(y, indices);
    indices.iter().map(|&i| (y[i] - m).powi(2)).sum::<f64>() / indices.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_simple_threshold() {
        // x < 5 → y=0, x >= 5 → y=10
        let x: Vec<Vec<f64>> = (0..10).map(|i| vec![i as f64]).collect();
        let y: Vec<f64> = (0..10).map(|i| if i < 5 { 0.0 } else { 10.0 }).collect();
        let model = fit(&x, &y, 5).unwrap();

        let preds = predict(&model, &[vec![2.0], vec![7.0]]);
        assert!((preds[0] - 0.0).abs() < 1e-10);
        assert!((preds[1] - 10.0).abs() < 1e-10);
    }

    #[test]
    fn fit_regression() {
        // Approximate y = x with depth 3
        let x: Vec<Vec<f64>> = (0..20).map(|i| vec![i as f64]).collect();
        let y: Vec<f64> = (0..20).map(|i| i as f64).collect();
        let model = fit(&x, &y, 3).unwrap();
        let preds = predict(&model, &[vec![10.0]]);
        // Should be somewhat close (piecewise constant approximation)
        assert!((preds[0] - 10.0).abs() < 3.0);
    }
}
