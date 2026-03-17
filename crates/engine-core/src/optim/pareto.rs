//! NSGA-II multi-objective optimisation — Pareto front discovery.
//!
//! Finds the set of non-dominated solutions (Pareto front) for problems
//! with multiple conflicting objectives.
//!
//! Reference: Deb et al. "A Fast and Elitist Multiobjective Genetic Algorithm:
//! NSGA-II" (2002), IEEE Trans. Evolutionary Computation.

use crate::optim::genetic::SimpleRng;

/// Result of a multi-objective optimisation.
#[derive(Debug, Clone)]
pub struct ParetoResult {
    /// Pareto-optimal solutions (each is a vector of decision variables).
    pub solutions: Vec<Vec<f64>>,
    /// Objective values for each Pareto solution (each is a vector of objective values).
    pub objectives: Vec<Vec<f64>>,
    /// Number of generations run.
    pub generations: usize,
}

/// Configuration for NSGA-II.
#[derive(Debug, Clone)]
pub struct NsgaConfig {
    pub population_size: usize,
    pub generations: usize,
    pub crossover_rate: f64,
    pub mutation_rate: f64,
    pub bounds: Vec<(f64, f64)>, // (min, max) for each decision variable
}

impl Default for NsgaConfig {
    fn default() -> Self {
        Self {
            population_size: 100,
            generations: 50,
            crossover_rate: 0.9,
            mutation_rate: 0.1,
            bounds: vec![(-10.0, 10.0)],
        }
    }
}

/// Run NSGA-II to find the Pareto front.
///
/// `objectives` is a list of objective functions. Each takes a slice of decision
/// variables and returns a scalar (to be minimised).
pub fn nsga2(
    objectives: &[Box<dyn Fn(&[f64]) -> f64>],
    config: &NsgaConfig,
) -> ParetoResult {
    let n_vars = config.bounds.len();
    let n_obj = objectives.len();
    let pop_size = config.population_size;
    let mut rng = SimpleRng::new(42);

    // Initialise random population
    let mut population: Vec<Vec<f64>> = (0..pop_size)
        .map(|_| {
            config
                .bounds
                .iter()
                .map(|(lo, hi)| lo + rng.next_f64() * (hi - lo))
                .collect()
        })
        .collect();

    for _gen in 0..config.generations {
        // Evaluate objectives for current population
        let obj_values: Vec<Vec<f64>> = population
            .iter()
            .map(|x| objectives.iter().map(|f| f(x)).collect())
            .collect();

        // Non-dominated sorting
        let fronts = non_dominated_sort(&obj_values);

        // Crowding distance within each front
        let mut crowding = vec![0.0; pop_size];
        for front in &fronts {
            let cd = crowding_distance(&obj_values, front, n_obj);
            for (i, &idx) in front.iter().enumerate() {
                crowding[idx] = cd[i];
            }
        }

        // Generate offspring via tournament selection + crossover + mutation
        let mut offspring = Vec::with_capacity(pop_size);
        while offspring.len() < pop_size {
            let p1 = tournament_select(&fronts, &crowding, &mut rng, pop_size);
            let p2 = tournament_select(&fronts, &crowding, &mut rng, pop_size);

            let mut child = if rng.next_f64() < config.crossover_rate {
                sbx_crossover(&population[p1], &population[p2], &config.bounds, &mut rng)
            } else {
                population[p1].clone()
            };

            // Polynomial mutation
            for i in 0..n_vars {
                if rng.next_f64() < config.mutation_rate {
                    let (lo, hi) = config.bounds[i];
                    let delta = (hi - lo) * 0.1 * (rng.next_f64() - 0.5);
                    child[i] = (child[i] + delta).clamp(lo, hi);
                }
            }

            offspring.push(child);
        }

        // Combine parent + offspring, select best pop_size by front rank + crowding
        let mut combined = population.clone();
        combined.extend(offspring);

        let combined_obj: Vec<Vec<f64>> = combined
            .iter()
            .map(|x| objectives.iter().map(|f| f(x)).collect())
            .collect();

        let combined_fronts = non_dominated_sort(&combined_obj);
        let mut combined_crowding = vec![0.0; combined.len()];
        for front in &combined_fronts {
            let cd = crowding_distance(&combined_obj, front, n_obj);
            for (i, &idx) in front.iter().enumerate() {
                combined_crowding[idx] = cd[i];
            }
        }

        // Select next generation: fill from front 0, front 1, etc.
        let mut next_pop = Vec::with_capacity(pop_size);
        for front in &combined_fronts {
            if next_pop.len() + front.len() <= pop_size {
                for &idx in front {
                    next_pop.push(combined[idx].clone());
                }
            } else {
                // Sort by crowding distance (descending) and take remaining
                let mut sorted: Vec<usize> = front.clone();
                sorted.sort_by(|&a, &b| {
                    combined_crowding[b]
                        .partial_cmp(&combined_crowding[a])
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
                for &idx in &sorted {
                    if next_pop.len() >= pop_size {
                        break;
                    }
                    next_pop.push(combined[idx].clone());
                }
                break;
            }
        }

        population = next_pop;
    }

    // Final evaluation — return first Pareto front
    let final_obj: Vec<Vec<f64>> = population
        .iter()
        .map(|x| objectives.iter().map(|f| f(x)).collect())
        .collect();
    let fronts = non_dominated_sort(&final_obj);
    let front0 = &fronts[0];

    ParetoResult {
        solutions: front0.iter().map(|&i| population[i].clone()).collect(),
        objectives: front0.iter().map(|&i| final_obj[i].clone()).collect(),
        generations: config.generations,
    }
}

/// Non-dominated sorting: returns list of fronts (each front is a list of indices).
fn non_dominated_sort(objectives: &[Vec<f64>]) -> Vec<Vec<usize>> {
    let n = objectives.len();
    let mut domination_count = vec![0usize; n];
    let mut dominated_by: Vec<Vec<usize>> = vec![vec![]; n];
    let mut fronts: Vec<Vec<usize>> = vec![];

    for i in 0..n {
        for j in (i + 1)..n {
            if dominates(&objectives[i], &objectives[j]) {
                dominated_by[i].push(j);
                domination_count[j] += 1;
            } else if dominates(&objectives[j], &objectives[i]) {
                dominated_by[j].push(i);
                domination_count[i] += 1;
            }
        }
    }

    let mut front: Vec<usize> = (0..n).filter(|&i| domination_count[i] == 0).collect();
    while !front.is_empty() {
        let mut next_front = vec![];
        for &i in &front {
            for &j in &dominated_by[i] {
                domination_count[j] -= 1;
                if domination_count[j] == 0 {
                    next_front.push(j);
                }
            }
        }
        fronts.push(front);
        front = next_front;
    }

    fronts
}

/// Returns true if a dominates b (all objectives <=, at least one strictly <).
fn dominates(a: &[f64], b: &[f64]) -> bool {
    let mut any_better = false;
    for (ai, bi) in a.iter().zip(b.iter()) {
        if ai > bi {
            return false;
        }
        if ai < bi {
            any_better = true;
        }
    }
    any_better
}

/// Compute crowding distance for solutions in a front.
fn crowding_distance(objectives: &[Vec<f64>], front: &[usize], n_obj: usize) -> Vec<f64> {
    let n = front.len();
    if n <= 2 {
        return vec![f64::INFINITY; n];
    }

    let mut distances = vec![0.0; n];

    for m in 0..n_obj {
        let mut sorted: Vec<(usize, f64)> = front
            .iter()
            .enumerate()
            .map(|(i, &idx)| (i, objectives[idx][m]))
            .collect();
        sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        distances[sorted[0].0] = f64::INFINITY;
        distances[sorted[n - 1].0] = f64::INFINITY;

        let range = sorted[n - 1].1 - sorted[0].1;
        if range > 1e-15 {
            for i in 1..n - 1 {
                distances[sorted[i].0] += (sorted[i + 1].1 - sorted[i - 1].1) / range;
            }
        }
    }

    distances
}

fn tournament_select(
    fronts: &[Vec<usize>],
    crowding: &[f64],
    rng: &mut SimpleRng,
    pop_size: usize,
) -> usize {
    let a = (rng.next_f64() * pop_size as f64) as usize % pop_size;
    let b = (rng.next_f64() * pop_size as f64) as usize % pop_size;

    let rank_a = fronts.iter().position(|f| f.contains(&a)).unwrap_or(usize::MAX);
    let rank_b = fronts.iter().position(|f| f.contains(&b)).unwrap_or(usize::MAX);

    if rank_a < rank_b {
        a
    } else if rank_b < rank_a {
        b
    } else if crowding[a] > crowding[b] {
        a
    } else {
        b
    }
}

/// Simulated binary crossover (SBX).
fn sbx_crossover(
    p1: &[f64],
    p2: &[f64],
    bounds: &[(f64, f64)],
    rng: &mut SimpleRng,
) -> Vec<f64> {
    let eta = 2.0; // Distribution index
    p1.iter()
        .zip(p2.iter())
        .zip(bounds.iter())
        .map(|((x1, x2), (lo, hi))| {
            let u = rng.next_f64();
            let beta = if u <= 0.5 {
                (2.0 * u).powf(1.0 / (eta + 1.0))
            } else {
                (1.0 / (2.0 * (1.0 - u))).powf(1.0 / (eta + 1.0))
            };
            let child = 0.5 * ((1.0 + beta) * x1 + (1.0 - beta) * x2);
            child.clamp(*lo, *hi)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dominates_basic() {
        assert!(dominates(&[1.0, 1.0], &[2.0, 2.0]));
        assert!(!dominates(&[1.0, 3.0], &[2.0, 2.0])); // Not dominated (trade-off)
        assert!(!dominates(&[2.0, 2.0], &[1.0, 1.0])); // Reversed
    }

    #[test]
    fn simple_pareto_front() {
        // Bi-objective: minimize f1(x) = x^2, minimize f2(x) = (x-2)^2
        // Pareto front is x in [0, 2]
        let objectives: Vec<Box<dyn Fn(&[f64]) -> f64>> = vec![
            Box::new(|x: &[f64]| x[0] * x[0]),
            Box::new(|x: &[f64]| (x[0] - 2.0) * (x[0] - 2.0)),
        ];
        let config = NsgaConfig {
            population_size: 50,
            generations: 30,
            crossover_rate: 0.9,
            mutation_rate: 0.2,
            bounds: vec![(-1.0, 3.0)],
        };
        let result = nsga2(&objectives, &config);
        assert!(!result.solutions.is_empty(), "Should find Pareto solutions");
        // All solutions should be roughly in [0, 2]
        for sol in &result.solutions {
            assert!(
                sol[0] >= -0.5 && sol[0] <= 2.5,
                "Solution {} outside expected range",
                sol[0]
            );
        }
    }
}
