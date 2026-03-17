//! Classification metrics: precision, recall, F1, ROC curve, AUC.

/// Compute precision, recall, and F1 score for binary classification.
/// y_true and y_pred are vectors of 0.0/1.0.
pub fn precision_recall_f1(y_true: &[f64], y_pred: &[f64]) -> (f64, f64, f64) {
    let mut tp = 0.0;
    let mut fp = 0.0;
    let mut fn_ = 0.0;

    for (t, p) in y_true.iter().zip(y_pred.iter()) {
        let t_pos = *t > 0.5;
        let p_pos = *p > 0.5;
        if p_pos && t_pos { tp += 1.0; }
        if p_pos && !t_pos { fp += 1.0; }
        if !p_pos && t_pos { fn_ += 1.0; }
    }

    let precision = if tp + fp > 0.0 { tp / (tp + fp) } else { 0.0 };
    let recall = if tp + fn_ > 0.0 { tp / (tp + fn_) } else { 0.0 };
    let f1 = if precision + recall > 0.0 { 2.0 * precision * recall / (precision + recall) } else { 0.0 };

    (precision, recall, f1)
}

/// Compute ROC curve points (FPR, TPR) by sweeping threshold.
/// y_true is 0/1 labels, y_scores is predicted probability.
/// Returns Vec of (fpr, tpr) sorted by threshold.
pub fn roc_curve(y_true: &[f64], y_scores: &[f64]) -> Vec<(f64, f64)> {
    let n = y_true.len();
    if n == 0 { return vec![(0.0, 0.0), (1.0, 1.0)]; }

    // Collect and sort by score descending
    let mut pairs: Vec<(f64, f64)> = y_true.iter().zip(y_scores.iter()).map(|(t, s)| (*t, *s)).collect();
    pairs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let total_pos = y_true.iter().filter(|t| **t > 0.5).count() as f64;
    let total_neg = n as f64 - total_pos;
    if total_pos == 0.0 || total_neg == 0.0 {
        return vec![(0.0, 0.0), (1.0, 1.0)];
    }

    let mut points = vec![(0.0, 0.0)];
    let mut tp = 0.0;
    let mut fp = 0.0;

    for (label, _score) in &pairs {
        if *label > 0.5 { tp += 1.0; } else { fp += 1.0; }
        points.push((fp / total_neg, tp / total_pos));
    }

    points
}

/// Compute AUC (area under ROC curve) using trapezoidal rule.
pub fn auc(roc_points: &[(f64, f64)]) -> f64 {
    let mut area = 0.0;
    for i in 1..roc_points.len() {
        let dx = roc_points[i].0 - roc_points[i - 1].0;
        let avg_y = (roc_points[i].1 + roc_points[i - 1].1) / 2.0;
        area += dx * avg_y;
    }
    area
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perfect_classifier() {
        let y_true = vec![1.0, 1.0, 0.0, 0.0];
        let y_pred = vec![1.0, 1.0, 0.0, 0.0];
        let (p, r, f1) = precision_recall_f1(&y_true, &y_pred);
        assert_eq!(p, 1.0);
        assert_eq!(r, 1.0);
        assert_eq!(f1, 1.0);
    }

    #[test]
    fn all_false_positives() {
        let y_true = vec![0.0, 0.0, 0.0];
        let y_pred = vec![1.0, 1.0, 1.0];
        let (p, _r, _f1) = precision_recall_f1(&y_true, &y_pred);
        assert_eq!(p, 0.0);
    }

    #[test]
    fn roc_perfect() {
        let y_true = vec![1.0, 1.0, 0.0, 0.0];
        let y_scores = vec![0.9, 0.8, 0.3, 0.1];
        let roc = roc_curve(&y_true, &y_scores);
        let a = auc(&roc);
        assert!((a - 1.0).abs() < 1e-10, "Perfect classifier AUC should be 1.0, got {}", a);
    }

    #[test]
    fn auc_basic() {
        // Manual ROC points: straight line from (0,0) to (1,1) → AUC = 0.5
        let points = vec![(0.0, 0.0), (0.5, 0.5), (1.0, 1.0)];
        let a = auc(&points);
        assert!((a - 0.5).abs() < 1e-10, "Diagonal ROC AUC should be 0.5, got {}", a);
    }
}
