//! Genetic algorithm optimizer — population-based evolutionary optimization.

use super::{DesignVar, OptimResult};

/// Run a genetic algorithm to minimize `f` over design variables.
///
/// Uses tournament selection, uniform crossover, and Gaussian mutation.
pub fn genetic_algorithm<F>(
    f: &F,
    vars: &[DesignVar],
    max_generations: usize,
    population_size: usize,
    mutation_rate: f64,
    crossover_rate: f64,
    tol: f64,
    seed: u64,
) -> OptimResult
where
    F: Fn(&[f64]) -> f64,
{
    let n = vars.len();
    let mut rng = SimpleRng::new(seed);

    // Initialize population uniformly within bounds
    let mut pop: Vec<Vec<f64>> = (0..population_size)
        .map(|_| {
            vars.iter()
                .map(|v| v.min + rng.next_f64() * (v.max - v.min))
                .collect()
        })
        .collect();

    let mut fitness: Vec<f64> = pop.iter().map(|ind| f(ind)).collect();
    let mut history = Vec::with_capacity(max_generations);
    let mut best_obj = f64::INFINITY;
    let mut best_x = pop[0].clone();

    for gen in 0..max_generations {
        // Track best
        for (i, &fit) in fitness.iter().enumerate() {
            if fit < best_obj {
                best_obj = fit;
                best_x = pop[i].clone();
            }
        }
        history.push(best_obj);

        // Check convergence (stagnation)
        if gen > 10 {
            let recent = &history[gen - 10..=gen];
            let spread = recent.iter().cloned().fold(f64::NEG_INFINITY, f64::max)
                - recent.iter().cloned().fold(f64::INFINITY, f64::min);
            if spread < tol {
                return OptimResult {
                    optimal_values: best_x,
                    best_objective: best_obj,
                    history,
                    converged: true,
                    iterations: gen + 1,
                };
            }
        }

        // Selection + crossover + mutation → new population
        let mut new_pop = Vec::with_capacity(population_size);

        // Elitism: keep best individual
        new_pop.push(best_x.clone());

        while new_pop.len() < population_size {
            // Tournament selection (size 3)
            let parent1 = tournament_select(&pop, &fitness, 3, &mut rng);
            let parent2 = tournament_select(&pop, &fitness, 3, &mut rng);

            // Crossover
            let mut child = if rng.next_f64() < crossover_rate {
                uniform_crossover(&pop[parent1], &pop[parent2], &mut rng)
            } else {
                pop[parent1].clone()
            };

            // Mutation (Gaussian)
            for i in 0..n {
                if rng.next_f64() < mutation_rate {
                    let sigma = (vars[i].max - vars[i].min) * 0.1;
                    child[i] += rng.next_gaussian() * sigma;
                    child[i] = child[i].clamp(vars[i].min, vars[i].max);
                }
            }

            new_pop.push(child);
        }

        pop = new_pop;
        fitness = pop.iter().map(|ind| f(ind)).collect();
    }

    // Final check
    for (i, &fit) in fitness.iter().enumerate() {
        if fit < best_obj {
            best_obj = fit;
            best_x = pop[i].clone();
        }
    }
    history.push(best_obj);

    OptimResult {
        optimal_values: best_x,
        best_objective: best_obj,
        history,
        converged: false,
        iterations: max_generations,
    }
}

fn tournament_select(
    pop: &[Vec<f64>],
    fitness: &[f64],
    tournament_size: usize,
    rng: &mut SimpleRng,
) -> usize {
    let mut best_idx = rng.next_usize(pop.len());
    let mut best_fit = fitness[best_idx];
    for _ in 1..tournament_size {
        let idx = rng.next_usize(pop.len());
        if fitness[idx] < best_fit {
            best_fit = fitness[idx];
            best_idx = idx;
        }
    }
    best_idx
}

fn uniform_crossover(parent1: &[f64], parent2: &[f64], rng: &mut SimpleRng) -> Vec<f64> {
    parent1
        .iter()
        .zip(parent2.iter())
        .map(|(&a, &b)| if rng.next_f64() < 0.5 { a } else { b })
        .collect()
}

/// Simple deterministic PRNG (xorshift64) for reproducible results in WASM.
/// No external dependencies needed.
pub struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    pub fn new(seed: u64) -> Self {
        Self {
            state: if seed == 0 { 1 } else { seed },
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state
    }

    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / ((1u64 << 53) as f64)
    }

    pub fn next_usize(&mut self, max: usize) -> usize {
        (self.next_u64() % max as u64) as usize
    }

    /// Box-Muller transform for Gaussian random numbers.
    pub fn next_gaussian(&mut self) -> f64 {
        let u1 = self.next_f64().max(1e-15);
        let u2 = self.next_f64();
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimize_quadratic_ga() {
        // f(x) = (x-3)², minimum at x=3
        let vars = vec![DesignVar {
            name: "x".into(),
            min: -10.0,
            max: 10.0,
            initial: 0.0,
            step: 0.1,
        }];
        let result = genetic_algorithm(
            &|x: &[f64]| (x[0] - 3.0).powi(2),
            &vars,
            200,
            50,
            0.1,
            0.8,
            1e-8,
            42,
        );
        assert!((result.optimal_values[0] - 3.0).abs() < 0.1);
        assert!(result.best_objective < 0.01);
    }

    #[test]
    fn minimize_2d_ga() {
        // f(x,y) = x² + y², minimum at (0,0)
        let vars = vec![
            DesignVar { name: "x".into(), min: -5.0, max: 5.0, initial: 3.0, step: 0.1 },
            DesignVar { name: "y".into(), min: -5.0, max: 5.0, initial: -4.0, step: 0.1 },
        ];
        let result = genetic_algorithm(
            &|x: &[f64]| x[0] * x[0] + x[1] * x[1],
            &vars,
            300,
            100,
            0.15,
            0.8,
            1e-8,
            123,
        );
        assert!(result.best_objective < 0.1);
    }

    #[test]
    fn rng_deterministic() {
        let mut r1 = SimpleRng::new(42);
        let mut r2 = SimpleRng::new(42);
        for _ in 0..100 {
            assert_eq!(r1.next_u64(), r2.next_u64());
        }
    }
}
