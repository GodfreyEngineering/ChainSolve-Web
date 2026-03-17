//! Machine Learning module — linear regression, polynomial regression,
//! KNN classifier, decision tree, and evaluation metrics.
//!
//! All implementations are pure Rust with no external dependencies
//! to keep WASM size minimal.

pub mod linreg;
pub mod polyreg;
pub mod knn;
pub mod decision_tree;
pub mod metrics;
pub mod preprocess;
