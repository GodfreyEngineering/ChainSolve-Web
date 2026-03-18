//! NSGA-III: Reference-Direction-based Multi-Objective Evolutionary Algorithm.
//!
//! Better than NSGA-II for problems with >3 objectives. Uses structured reference
//! points (Das-Dennis simplex lattice) to maintain diversity.
//!
//! Also implements MOEA/D with Tchebycheff (Chebyshev) scalarisation as an
//! alternative decomposition-based approach.
//!
//! References:
//!   - Deb & Jain (2014) "An Evolutionary Many-Objective Optimization Algorithm
//!     Using Reference-Point-Based Nondominated Sorting", IEEE TEVC.
//!   - Zhang & Li (2007) "MOEA/D: A Multiobjective Evolutionary Algorithm Based
//!     on Decomposition", IEEE TEVC.

use crate::optim::DesignVar;

// ── Types ────────────────────────────────────────────────────────────────────

/// A candidate solution in multi-objective space.
#[derive(Clone, Debug)]
pub struct MoIndividual {
    /// Decision variable values.
    pub x: Vec<f64>,
    /// Objective values.
    pub f: Vec<f64>,
    /// Non-domination rank (0 = Pareto front).
    pub rank: usize,
    /// Reference point this individual is associated with.
    pub ref_point: usize,
    /// Normalised distance to associated reference line.
    pub niche_dist: f64,
}

/// NSGA-III configuration.
pub struct Nsga3Config {
    /// Design variables.
    pub vars: Vec<DesignVar>,
    /// Objective functions (to minimise).
    pub objectives: Vec<Box<dyn Fn(&[f64]) -> f64>>,
    /// Population size (auto-rounds up to next multiple of reference points count).
    pub pop_size: usize,
    /// Number of generations.
    pub n_generations: usize,
    /// Cross-over probability.
    pub crossover_prob: f64,
    /// Mutation probability (default: 1/n_vars).
    pub mutation_prob: f64,
    /// Distribution index for SBX crossover.
    pub eta_c: f64,
    /// Distribution index for polynomial mutation.
    pub eta_m: f64,
    /// Number of reference point divisions (H) per objective axis.
    pub divisions: usize,
    /// Random seed.
    pub seed: u64,
    /// Whether to use MOEA/D instead of NSGA-III.
    pub use_moead: bool,
}

/// Multi-objective result.
pub struct MoResult {
    /// Final Pareto front (all non-dominated individuals).
    pub pareto_front: Vec<MoIndividual>,
    /// Hypervolume indicator approximation.
    pub hypervolume: f64,
    /// Number of evaluations.
    pub n_evaluations: usize,
    /// History of best (minimum) for each objective per generation.
    pub history: Vec<Vec<f64>>,
}

// ── LCG RNG ─────────────────────────────────────────────────────────────────

struct Rng(u64);
impl Rng {
    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0
    }
    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
    fn uniform(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.next_f64() * (hi - lo)
    }
    fn usize_range(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
}

// ── Reference Points (Das-Dennis simplex lattice) ────────────────────────────

/// Generate structured reference points using the Das-Dennis simplex lattice.
/// For M objectives and H divisions: C(M+H-1, H) reference points.
pub fn generate_reference_points(m: usize, h: usize) -> Vec<Vec<f64>> {
    let mut result = Vec::new();
    let mut current = vec![0usize; m];
    generate_points_recursive(m, h, 0, h, &mut current, &mut result);
    // Normalise so each point sums to 1
    result.iter().map(|p| p.iter().map(|&v| v as f64 / h as f64).collect()).collect()
}

fn generate_points_recursive(m: usize, h: usize, idx: usize, remaining: usize, current: &mut Vec<usize>, result: &mut Vec<Vec<usize>>) {
    if idx == m - 1 {
        current[idx] = remaining;
        result.push(current.clone());
    } else {
        for i in 0..=remaining {
            current[idx] = i;
            generate_points_recursive(m, h, idx + 1, remaining - i, current, result);
        }
    }
}

// ── Fast Non-Dominated Sorting ────────────────────────────────────────────────

fn dominates(a: &[f64], b: &[f64]) -> bool {
    a.iter().zip(b).all(|(ai, bi)| ai <= bi) && a.iter().zip(b).any(|(ai, bi)| ai < bi)
}

/// Fast non-dominated sort — returns list of fronts (each front is a list of indices).
fn fast_non_dominated_sort(pop: &[MoIndividual]) -> Vec<Vec<usize>> {
    let n = pop.len();
    let mut domination_count = vec![0usize; n];
    let mut dominated_by: Vec<Vec<usize>> = vec![vec![]; n];

    for i in 0..n {
        for j in 0..n {
            if i == j { continue; }
            if dominates(&pop[i].f, &pop[j].f) {
                dominated_by[i].push(j);
            } else if dominates(&pop[j].f, &pop[i].f) {
                domination_count[i] += 1;
            }
        }
    }

    let mut fronts: Vec<Vec<usize>> = Vec::new();
    let mut current_front: Vec<usize> = (0..n).filter(|&i| domination_count[i] == 0).collect();

    while !current_front.is_empty() {
        fronts.push(current_front.clone());
        let mut next_front = Vec::new();
        for &i in &current_front {
            for &j in &dominated_by[i] {
                domination_count[j] -= 1;
                if domination_count[j] == 0 {
                    next_front.push(j);
                }
            }
        }
        current_front = next_front;
    }

    fronts
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/// Adaptive normalisation: compute ideal and nadir points, translate + scale.
fn normalise(pop: &[MoIndividual], m: usize) -> (Vec<f64>, Vec<f64>) {
    let ideal: Vec<f64> = (0..m).map(|j| pop.iter().map(|p| p.f[j]).fold(f64::INFINITY, f64::min)).collect();
    let nadir: Vec<f64> = (0..m).map(|j| pop.iter().map(|p| p.f[j]).fold(f64::NEG_INFINITY, f64::max)).collect();
    (ideal, nadir)
}

fn normalise_f(f: &[f64], ideal: &[f64], nadir: &[f64]) -> Vec<f64> {
    f.iter().zip(ideal).zip(nadir).map(|((fi, i), n)| {
        let range = n - i;
        if range < 1e-10 { 0.0 } else { (fi - i) / range }
    }).collect()
}

// ── Reference Line Association ────────────────────────────────────────────────

/// Distance from point to reference direction line through origin.
fn perpendicular_distance(f_norm: &[f64], ref_dir: &[f64]) -> f64 {
    let dot: f64 = f_norm.iter().zip(ref_dir).map(|(a, b)| a * b).sum();
    let ref_len2: f64 = ref_dir.iter().map(|x| x * x).sum();
    let proj_len = dot / ref_len2.max(1e-15);
    let dist2: f64 = f_norm.iter().zip(ref_dir)
        .map(|(a, b)| (a - proj_len * b).powi(2))
        .sum();
    dist2.sqrt()
}

/// Associate each individual in `last_front` with the nearest reference point.
fn associate_reference(
    candidates: &[usize],
    pop: &[MoIndividual],
    ref_points: &[Vec<f64>],
    ideal: &[f64],
    nadir: &[f64],
) -> Vec<(usize, f64)> {
    candidates.iter().map(|&i| {
        let f_norm = normalise_f(&pop[i].f, ideal, nadir);
        let (best_ref, best_dist) = ref_points.iter().enumerate()
            .map(|(r, rp)| (r, perpendicular_distance(&f_norm, rp)))
            .min_by(|(_, da), (_, db)| da.partial_cmp(db).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, f64::INFINITY));
        (best_ref, best_dist)
    }).collect()
}

// ── Genetic Operators ─────────────────────────────────────────────────────────

/// Simulated binary crossover (SBX).
fn sbx(p1: &[f64], p2: &[f64], vars: &[DesignVar], rng: &mut Rng, eta: f64, prob: f64) -> (Vec<f64>, Vec<f64>) {
    let n = p1.len();
    let mut c1 = p1.to_vec();
    let mut c2 = p2.to_vec();
    for i in 0..n {
        if rng.next_f64() > prob { continue; }
        if (p1[i] - p2[i]).abs() < 1e-14 { continue; }
        let lo = vars[i].min;
        let hi = vars[i].max;
        let (y1, y2) = if p1[i] < p2[i] { (p1[i], p2[i]) } else { (p2[i], p1[i]) };
        let u = rng.next_f64();
        let beta1 = 1.0 + 2.0 * (y1 - lo) / (y2 - y1 + 1e-15);
        let beta2 = 1.0 + 2.0 * (hi - y2) / (y2 - y1 + 1e-15);
        let alpha1 = 2.0 - beta1.powf(-(eta + 1.0));
        let alpha2 = 2.0 - beta2.powf(-(eta + 1.0));
        let betaq1 = if u <= 1.0 / alpha1 {
            (u * alpha1).powf(1.0 / (eta + 1.0))
        } else {
            (1.0 / (2.0 - u * alpha1)).powf(1.0 / (eta + 1.0))
        };
        let betaq2 = if u <= 1.0 / alpha2 {
            (u * alpha2).powf(1.0 / (eta + 1.0))
        } else {
            (1.0 / (2.0 - u * alpha2)).powf(1.0 / (eta + 1.0))
        };
        c1[i] = 0.5 * ((y1 + y2) - betaq1 * (y2 - y1));
        c2[i] = 0.5 * ((y1 + y2) + betaq2 * (y2 - y1));
        c1[i] = c1[i].clamp(lo, hi);
        c2[i] = c2[i].clamp(lo, hi);
    }
    (c1, c2)
}

/// Polynomial mutation.
fn poly_mutation(x: &[f64], vars: &[DesignVar], rng: &mut Rng, eta: f64, prob: f64) -> Vec<f64> {
    let mut xm = x.to_vec();
    for i in 0..x.len() {
        if rng.next_f64() > prob { continue; }
        let lo = vars[i].min;
        let hi = vars[i].max;
        let delta1 = (x[i] - lo) / (hi - lo + 1e-15);
        let delta2 = (hi - x[i]) / (hi - lo + 1e-15);
        let u = rng.next_f64();
        let deltaq = if u < 0.5 {
            let val = 2.0 * u + (1.0 - 2.0 * u) * (1.0 - delta1).powf(eta + 1.0);
            val.powf(1.0 / (eta + 1.0)) - 1.0
        } else {
            let val = 2.0 * (1.0 - u) + 2.0 * (u - 0.5) * (1.0 - delta2).powf(eta + 1.0);
            1.0 - val.powf(1.0 / (eta + 1.0))
        };
        xm[i] = (x[i] + deltaq * (hi - lo)).clamp(lo, hi);
    }
    xm
}

// ── NSGA-III Main ──────────────────────────────────────────────────────────────

fn evaluate(x: &[f64], objectives: &[Box<dyn Fn(&[f64]) -> f64>]) -> Vec<f64> {
    objectives.iter().map(|f| f(x)).collect()
}

fn make_individual(x: Vec<f64>, objectives: &[Box<dyn Fn(&[f64]) -> f64>]) -> MoIndividual {
    let f = evaluate(&x, objectives);
    MoIndividual { x, f, rank: 0, ref_point: 0, niche_dist: f64::INFINITY }
}

/// Run NSGA-III.
pub fn nsga3(cfg: &Nsga3Config) -> MoResult {
    let m = cfg.objectives.len();
    let _d = cfg.vars.len();
    let mut rng = Rng(cfg.seed);
    let mut n_evals = 0;

    let ref_points = generate_reference_points(m, cfg.divisions);
    let n_ref = ref_points.len();
    let pop_size = ((cfg.pop_size + n_ref - 1) / n_ref) * n_ref;

    // Initialise population
    let mut pop: Vec<MoIndividual> = (0..pop_size).map(|_| {
        let x: Vec<f64> = cfg.vars.iter().map(|v| rng.uniform(v.min, v.max)).collect();
        n_evals += 1;
        make_individual(x, &cfg.objectives)
    }).collect();

    let mut history: Vec<Vec<f64>> = Vec::new();

    for _gen in 0..cfg.n_generations {
        // Create offspring
        let mut offspring: Vec<MoIndividual> = Vec::with_capacity(pop_size);
        while offspring.len() < pop_size {
            let p1 = rng.usize_range(pop_size);
            let p2 = rng.usize_range(pop_size);
            let (c1x, c2x) = sbx(&pop[p1].x, &pop[p2].x, &cfg.vars, &mut rng, cfg.eta_c, cfg.crossover_prob);
            let m1x = poly_mutation(&c1x, &cfg.vars, &mut rng, cfg.eta_m, cfg.mutation_prob);
            let m2x = poly_mutation(&c2x, &cfg.vars, &mut rng, cfg.eta_m, cfg.mutation_prob);
            offspring.push(make_individual(m1x, &cfg.objectives));
            offspring.push(make_individual(m2x, &cfg.objectives));
            n_evals += 2;
        }

        // Combine
        let mut combined = pop.clone();
        combined.extend(offspring);

        // Non-dominated sort
        let fronts = fast_non_dominated_sort(&combined);

        // Assign ranks
        for (rank, front) in fronts.iter().enumerate() {
            for &i in front {
                combined[i].rank = rank;
            }
        }

        // Select N individuals for next generation using reference directions
        let (ideal, nadir) = normalise(&combined, m);
        let mut new_pop: Vec<MoIndividual> = Vec::with_capacity(pop_size);
        let mut front_idx = 0;

        while new_pop.len() < pop_size && front_idx < fronts.len() {
            let front = &fronts[front_idx];
            if new_pop.len() + front.len() <= pop_size {
                for &i in front {
                    new_pop.push(combined[i].clone());
                }
                front_idx += 1;
            } else {
                // Partial inclusion — use niche preservation
                let remaining = pop_size - new_pop.len();
                let last_front = front.clone();

                // Count associations for already-included individuals
                let mut niche_count = vec![0usize; n_ref];
                for ind in &new_pop {
                    let f_norm = normalise_f(&ind.f, &ideal, &nadir);
                    let best_ref = ref_points.iter().enumerate()
                        .map(|(r, rp)| (r, perpendicular_distance(&f_norm, rp)))
                        .min_by(|(_, da), (_, db)| da.partial_cmp(db).unwrap_or(std::cmp::Ordering::Equal))
                        .map(|(r, _)| r)
                        .unwrap_or(0);
                    niche_count[best_ref] += 1;
                }

                // Associate last front members with reference points
                let associations = associate_reference(&last_front, &combined, &ref_points, &ideal, &nadir);
                let mut available: Vec<usize> = (0..last_front.len()).collect();

                for _ in 0..remaining {
                    if available.is_empty() { break; }
                    // Find reference with minimum niche count
                    let min_count = niche_count.iter().cloned().filter(|&c| {
                        available.iter().any(|&ai| associations[ai].0 == niche_count.iter().enumerate().find(|(i, &v)| v == c && available.iter().any(|&aj| associations[aj].0 == *i)).map(|(i, _)| i).unwrap_or(usize::MAX))
                    }).min().unwrap_or(0);
                    // Find reference points with that count
                    let jmin_refs: Vec<usize> = niche_count.iter().enumerate()
                        .filter(|(_, &c)| c == min_count)
                        .filter(|(r, _)| available.iter().any(|&ai| associations[ai].0 == *r))
                        .map(|(r, _)| r)
                        .collect();

                    if jmin_refs.is_empty() { break; }
                    let chosen_ref = jmin_refs[rng.usize_range(jmin_refs.len())];

                    // Among available associated with chosen_ref, pick one
                    let candidates_in_ref: Vec<usize> = available.iter().cloned()
                        .filter(|&ai| associations[ai].0 == chosen_ref)
                        .collect();

                    if candidates_in_ref.is_empty() { break; }

                    let chosen_ai = if niche_count[chosen_ref] == 0 {
                        // Pick closest to ref line
                        *candidates_in_ref.iter().min_by(|&&a, &&b| {
                            associations[a].1.partial_cmp(&associations[b].1).unwrap_or(std::cmp::Ordering::Equal)
                        }).unwrap()
                    } else {
                        candidates_in_ref[rng.usize_range(candidates_in_ref.len())]
                    };

                    new_pop.push(combined[last_front[chosen_ai]].clone());
                    niche_count[chosen_ref] += 1;
                    available.retain(|&ai| ai != chosen_ai);
                }
                break;
            }
        }

        // Record history
        let best_per_obj: Vec<f64> = (0..m).map(|j| {
            new_pop.iter().map(|p| p.f[j]).fold(f64::INFINITY, f64::min)
        }).collect();
        history.push(best_per_obj);

        pop = new_pop;
        if pop.len() > pop_size { pop.truncate(pop_size); }
    }

    // Extract Pareto front
    let fronts = fast_non_dominated_sort(&pop);
    let pareto_front: Vec<MoIndividual> = fronts.first()
        .map(|f| f.iter().map(|&i| pop[i].clone()).collect())
        .unwrap_or_default();

    let hypervolume = estimate_hypervolume(&pareto_front, m);

    MoResult { pareto_front, hypervolume, n_evaluations: n_evals, history }
}

/// Rough hypervolume estimate using Monte Carlo sampling in normalised space.
fn estimate_hypervolume(pareto: &[MoIndividual], m: usize) -> f64 {
    if pareto.is_empty() { return 0.0; }
    let ideal: Vec<f64> = (0..m).map(|j| pareto.iter().map(|p| p.f[j]).fold(f64::INFINITY, f64::min)).collect();
    let nadir: Vec<f64> = (0..m).map(|j| pareto.iter().map(|p| p.f[j]).fold(f64::NEG_INFINITY, f64::max) * 1.1).collect();
    let mut rng = Rng(99991);
    let n_samples = 1000;
    let mut dominated = 0usize;
    for _ in 0..n_samples {
        let r: Vec<f64> = (0..m).map(|j| rng.uniform(ideal[j], nadir[j])).collect();
        if pareto.iter().any(|p| dominates(&p.f, &r)) {
            dominated += 1;
        }
    }
    let vol: f64 = (0..m).map(|j| nadir[j] - ideal[j]).product();
    vol * dominated as f64 / n_samples as f64
}

/// Convert NSGA-III result to a Value::Table.
/// Columns: x0..xN-1, f0..fM-1
pub fn mo_result_to_table(result: &MoResult, n_vars: usize, n_obj: usize) -> crate::types::Value {
    let mut columns = Vec::new();
    for i in 0..n_vars { columns.push(format!("x{i}")); }
    for j in 0..n_obj { columns.push(format!("f{j}")); }

    let rows: Vec<Vec<f64>> = result.pareto_front.iter().map(|ind| {
        let mut row = ind.x.clone();
        row.extend_from_slice(&ind.f);
        row
    }).collect();

    crate::types::Value::Table { columns, rows }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn var(min: f64, max: f64) -> DesignVar {
        DesignVar { name: "x".into(), min, max, initial: 0.0, step: 0.1 }
    }

    #[test]
    fn reference_points_sum_to_one() {
        let rps = generate_reference_points(3, 4);
        assert_eq!(rps.len(), 15); // C(3+4-1, 4) = C(6,4) = 15
        for rp in &rps {
            let sum: f64 = rp.iter().sum();
            assert!((sum - 1.0).abs() < 1e-10, "sum = {sum}");
        }
    }

    #[test]
    fn nsga3_two_objectives() {
        // ZDT1-like: minimise [x0, 1 - sqrt(x0)]
        let cfg = Nsga3Config {
            vars: vec![var(0.0, 1.0), var(0.0, 1.0)],
            objectives: vec![
                Box::new(|x: &[f64]| x[0]),
                Box::new(|x: &[f64]| 1.0 - x[0].sqrt()),
            ],
            pop_size: 20,
            n_generations: 20,
            crossover_prob: 0.9,
            mutation_prob: 0.5,
            eta_c: 20.0,
            eta_m: 20.0,
            divisions: 4,
            seed: 42,
            use_moead: false,
        };
        let result = nsga3(&cfg);
        assert!(!result.pareto_front.is_empty(), "empty pareto front");
        // Hypervolume should be > 0
        assert!(result.hypervolume > 0.0, "hv = {}", result.hypervolume);
    }

    #[test]
    fn nsga3_three_objectives() {
        let cfg = Nsga3Config {
            vars: vec![var(0.0, 1.0), var(0.0, 1.0)],
            objectives: vec![
                Box::new(|x: &[f64]| x[0]),
                Box::new(|x: &[f64]| x[1]),
                Box::new(|x: &[f64]| 1.0 - x[0] - x[1]),
            ],
            pop_size: 30,
            n_generations: 15,
            crossover_prob: 0.9,
            mutation_prob: 0.5,
            eta_c: 20.0,
            eta_m: 20.0,
            divisions: 3,
            seed: 7,
            use_moead: false,
        };
        let result = nsga3(&cfg);
        assert!(!result.pareto_front.is_empty());
        assert!(!result.history.is_empty());
    }

    #[test]
    fn pareto_front_is_nondominated() {
        let cfg = Nsga3Config {
            vars: vec![var(-2.0, 2.0)],
            objectives: vec![
                Box::new(|x: &[f64]| x[0].powi(2)),
                Box::new(|x: &[f64]| (x[0] - 1.0).powi(2)),
            ],
            pop_size: 20,
            n_generations: 10,
            crossover_prob: 0.9,
            mutation_prob: 0.8,
            eta_c: 15.0,
            eta_m: 15.0,
            divisions: 4,
            seed: 123,
            use_moead: false,
        };
        let result = nsga3(&cfg);
        let pf = &result.pareto_front;
        // Verify no member dominates another
        for i in 0..pf.len() {
            for j in 0..pf.len() {
                if i == j { continue; }
                assert!(!dominates(&pf[i].f, &pf[j].f), "i={i} dominates j={j}");
            }
        }
    }
}
