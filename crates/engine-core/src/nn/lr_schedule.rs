//! Learning rate schedules for neural network training.

/// Learning rate schedule types.
#[derive(Debug, Clone)]
pub enum LRSchedule {
    /// Constant learning rate (no decay).
    Constant,
    /// Step decay: drop by `factor` every `step_size` epochs.
    StepDecay { factor: f64, step_size: usize },
    /// Cosine annealing: decay from base_lr to 0 over `t_max` epochs.
    CosineAnnealing { t_max: usize },
    /// Exponential decay: lr = base_lr * gamma^epoch.
    ExponentialDecay { gamma: f64 },
}

impl LRSchedule {
    /// Parse from a string name.
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "step" | "step_decay" => Self::StepDecay {
                factor: 0.1,
                step_size: 30,
            },
            "cosine" | "cosine_annealing" => Self::CosineAnnealing { t_max: 100 },
            "exponential" | "exp_decay" => Self::ExponentialDecay { gamma: 0.95 },
            _ => Self::Constant,
        }
    }

    /// Get the learning rate at a given epoch.
    pub fn get_lr(&self, base_lr: f64, epoch: usize) -> f64 {
        match self {
            Self::Constant => base_lr,
            Self::StepDecay { factor, step_size } => {
                base_lr * factor.powi((epoch / step_size) as i32)
            }
            Self::CosineAnnealing { t_max } => {
                if *t_max == 0 {
                    return base_lr;
                }
                let t = epoch.min(*t_max) as f64;
                let t_max_f = *t_max as f64;
                base_lr * 0.5 * (1.0 + (std::f64::consts::PI * t / t_max_f).cos())
            }
            Self::ExponentialDecay { gamma } => base_lr * gamma.powi(epoch as i32),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_lr() {
        let s = LRSchedule::Constant;
        assert_eq!(s.get_lr(0.01, 0), 0.01);
        assert_eq!(s.get_lr(0.01, 100), 0.01);
    }

    #[test]
    fn step_decay() {
        let s = LRSchedule::StepDecay {
            factor: 0.1,
            step_size: 10,
        };
        assert_eq!(s.get_lr(1.0, 0), 1.0);
        assert!((s.get_lr(1.0, 10) - 0.1).abs() < 1e-10);
        assert!((s.get_lr(1.0, 20) - 0.01).abs() < 1e-10);
    }

    #[test]
    fn cosine_annealing() {
        let s = LRSchedule::CosineAnnealing { t_max: 100 };
        let lr_0 = s.get_lr(0.1, 0);
        let lr_50 = s.get_lr(0.1, 50);
        let lr_100 = s.get_lr(0.1, 100);
        assert!((lr_0 - 0.1).abs() < 1e-10); // Start at base_lr
        assert!(lr_50 < lr_0); // Decreased at midpoint
        assert!(lr_100.abs() < 1e-10); // Near zero at end
    }

    #[test]
    fn exponential_decay() {
        let s = LRSchedule::ExponentialDecay { gamma: 0.9 };
        let lr_0 = s.get_lr(1.0, 0);
        let lr_10 = s.get_lr(1.0, 10);
        assert_eq!(lr_0, 1.0);
        assert!((lr_10 - 0.9_f64.powi(10)).abs() < 1e-10);
    }

    #[test]
    fn from_str_parsing() {
        assert!(matches!(LRSchedule::from_str("constant"), LRSchedule::Constant));
        assert!(matches!(LRSchedule::from_str("step"), LRSchedule::StepDecay { .. }));
        assert!(matches!(LRSchedule::from_str("cosine"), LRSchedule::CosineAnnealing { .. }));
        assert!(matches!(LRSchedule::from_str("exponential"), LRSchedule::ExponentialDecay { .. }));
    }
}
