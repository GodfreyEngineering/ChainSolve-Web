/**
 * ml-blocks.ts — Machine Learning block pack (5.06).
 *
 * Blocks for dataset handling, train/test split, regression, classification,
 * and evaluation metrics. Evaluation handled by Rust/WASM engine ops (ml.* namespace).
 */

import type { BlockDef } from './types'

export function registerMLBlocks(register: (def: BlockDef) => void): void {
  // ── Data Preparation ────────────────────────────────────────────────────

  register({
    type: 'ml.trainTestSplit',
    label: 'Train/Test Split',
    category: 'machineLearning',
    nodeKind: 'csOperation',
    inputs: [{ id: 'data', label: 'Dataset (table)' }],
    defaultData: {
      blockType: 'ml.trainTestSplit',
      label: 'Train/Test Split',
      manualValues: { ratio: 0.8 },
    },
    synonyms: ['train test split', 'data split', 'holdout'],
    tags: ['ml', 'data'],
    description: 'Splits a table dataset into training and test sets. Default 80/20 split ratio.',
  })

  // ── Regression Models ───────────────────────────────────────────────────

  register({
    type: 'ml.linearRegression',
    label: 'Linear Regression',
    category: 'machineLearning',
    nodeKind: 'csMLModel',
    inputs: [
      { id: 'trainX', label: 'Training features' },
      { id: 'trainY', label: 'Training labels' },
    ],
    defaultData: { blockType: 'ml.linearRegression', label: 'Linear Regression' },
    synonyms: ['linear regression', 'OLS', 'least squares'],
    tags: ['ml', 'regression'],
    description:
      'Ordinary Least Squares linear regression. Outputs model coefficients, intercept, and predictions.',
  })

  register({
    type: 'ml.polynomialRegression',
    label: 'Polynomial Regression',
    category: 'machineLearning',
    nodeKind: 'csMLModel',
    inputs: [
      { id: 'trainX', label: 'Training features' },
      { id: 'trainY', label: 'Training labels' },
    ],
    defaultData: {
      blockType: 'ml.polynomialRegression',
      label: 'Polynomial Regression',
      manualValues: { degree: 2 },
    },
    synonyms: ['polynomial regression', 'poly fit', 'curve fit'],
    tags: ['ml', 'regression'],
    description:
      'Polynomial regression with configurable degree. Fits y = a₀ + a₁x + a₂x² + ... aₙxⁿ.',
  })

  // ── Classification Models ───────────────────────────────────────────────

  register({
    type: 'ml.knnClassifier',
    label: 'KNN Classifier',
    category: 'machineLearning',
    nodeKind: 'csMLModel',
    inputs: [
      { id: 'trainX', label: 'Training features' },
      { id: 'trainY', label: 'Training labels' },
    ],
    defaultData: {
      blockType: 'ml.knnClassifier',
      label: 'KNN Classifier',
      manualValues: { k: 5 },
    },
    synonyms: ['knn', 'k nearest neighbors', 'classifier'],
    tags: ['ml', 'classification'],
    description: 'K-Nearest Neighbors classifier. Configurable k (number of neighbors).',
  })

  register({
    type: 'ml.decisionTree',
    label: 'Decision Tree',
    category: 'machineLearning',
    nodeKind: 'csMLModel',
    inputs: [
      { id: 'trainX', label: 'Training features' },
      { id: 'trainY', label: 'Training labels' },
    ],
    defaultData: {
      blockType: 'ml.decisionTree',
      label: 'Decision Tree',
      manualValues: { maxDepth: 5 },
    },
    synonyms: ['decision tree', 'CART', 'tree classifier'],
    tags: ['ml', 'classification'],
    description: 'Decision tree for classification or regression. Configurable max depth.',
  })

  // ── Prediction ──────────────────────────────────────────────────────────

  register({
    type: 'ml.predict',
    label: 'ML Predict',
    category: 'machineLearning',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'model', label: 'Trained model' },
      { id: 'data', label: 'New data' },
    ],
    defaultData: { blockType: 'ml.predict', label: 'ML Predict' },
    synonyms: ['predict', 'inference', 'apply model'],
    tags: ['ml', 'predict'],
    description: 'Apply a trained model to new data and output predictions.',
  })

  // ── Metrics ─────────────────────────────────────────────────────────────

  register({
    type: 'ml.mse',
    label: 'MSE',
    category: 'machineLearning',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'actual', label: 'Actual' },
      { id: 'predicted', label: 'Predicted' },
    ],
    defaultData: { blockType: 'ml.mse', label: 'MSE' },
    synonyms: ['mean squared error', 'MSE', 'loss'],
    tags: ['ml', 'metrics'],
    description: 'Mean Squared Error between actual and predicted values.',
  })

  register({
    type: 'ml.r2',
    label: 'R² Score',
    category: 'machineLearning',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'actual', label: 'Actual' },
      { id: 'predicted', label: 'Predicted' },
    ],
    defaultData: { blockType: 'ml.r2', label: 'R² Score' },
    synonyms: ['r squared', 'coefficient of determination', 'R2'],
    tags: ['ml', 'metrics'],
    description: 'R² (coefficient of determination). 1.0 = perfect fit, 0.0 = no better than mean.',
  })

  register({
    type: 'ml.confusionMatrix',
    label: 'Confusion Matrix',
    category: 'machineLearning',
    nodeKind: 'csDisplay',
    inputs: [
      { id: 'actual', label: 'Actual' },
      { id: 'predicted', label: 'Predicted' },
    ],
    defaultData: { blockType: 'ml.confusionMatrix', label: 'Confusion Matrix' },
    synonyms: ['confusion matrix', 'error matrix'],
    tags: ['ml', 'metrics', 'classification'],
    description:
      'Displays a confusion matrix for classification results. Shows true/false positives/negatives.',
  })
}
