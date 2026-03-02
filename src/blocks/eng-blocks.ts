/**
 * eng-blocks.ts — Engineering & Physics block pack (W11a).
 *
 * 60 blocks across 8 categories: Mechanics, Materials, Sections,
 * Inertia, Fluids, Thermo, Electrical, Conversions.
 *
 * Evaluation handled by Rust/WASM engine ops (eng.* namespace).
 * Exports a registration function called by registry.ts.
 */

import type { BlockDef } from './types'

export function registerEngBlocks(register: (def: BlockDef) => void): void {
  // ── Mechanics ──────────────────────────────────────────────────────

  register({
    type: 'eng.mechanics.v_from_uat',
    label: 'v = u + at',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'u', label: 'u (m/s)' },
      { id: 'a', label: 'a (m/s²)' },
      { id: 't', label: 't (s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.v_from_uat', label: 'v = u+at' },
  })

  register({
    type: 'eng.mechanics.s_from_ut_a_t',
    label: 's = ut + ½at²',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'u', label: 'u (m/s)' },
      { id: 't', label: 't (s)' },
      { id: 'a', label: 'a (m/s²)' },
    ],
    defaultData: { blockType: 'eng.mechanics.s_from_ut_a_t', label: 's = ut+½at²' },
  })

  register({
    type: 'eng.mechanics.v2_from_u2_as',
    label: 'v = √(u²+2as)',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'u', label: 'u (m/s)' },
      { id: 'a', label: 'a (m/s²)' },
      { id: 's', label: 's (m)' },
    ],
    defaultData: { blockType: 'eng.mechanics.v2_from_u2_as', label: 'v = √(u²+2as)' },
  })

  register({
    type: 'eng.mechanics.force_ma',
    label: 'F = ma',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'a', label: 'a (m/s²)' },
    ],
    defaultData: { blockType: 'eng.mechanics.force_ma', label: 'F = ma' },
  })

  register({
    type: 'eng.mechanics.weight_mg',
    label: 'W = mg',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'g', label: 'g (m/s²)' },
    ],
    defaultData: {
      blockType: 'eng.mechanics.weight_mg',
      label: 'W = mg',
      manualValues: { g: 9.80665 },
    },
  })

  register({
    type: 'eng.mechanics.momentum_mv',
    label: 'p = mv',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.momentum_mv', label: 'p = mv' },
  })

  register({
    type: 'eng.mechanics.kinetic_energy',
    label: 'KE = ½mv²',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.kinetic_energy', label: 'KE = ½mv²' },
  })

  register({
    type: 'eng.mechanics.potential_energy',
    label: 'PE = mgh',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'g', label: 'g (m/s²)' },
      { id: 'h', label: 'h (m)' },
    ],
    defaultData: {
      blockType: 'eng.mechanics.potential_energy',
      label: 'PE = mgh',
      manualValues: { g: 9.80665 },
    },
  })

  register({
    type: 'eng.mechanics.work_Fs',
    label: 'W = Fs',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 's', label: 's (m)' },
    ],
    defaultData: { blockType: 'eng.mechanics.work_Fs', label: 'W = Fs' },
  })

  register({
    type: 'eng.mechanics.power_work_time',
    label: 'P = W/t',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'W', label: 'W (J)' },
      { id: 't', label: 't (s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.power_work_time', label: 'P = W/t' },
  })

  register({
    type: 'eng.mechanics.power_Fv',
    label: 'P = Fv',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.power_Fv', label: 'P = Fv' },
  })

  register({
    type: 'eng.mechanics.torque_Fr',
    label: 'T = Fr',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: { blockType: 'eng.mechanics.torque_Fr', label: 'T = Fr' },
  })

  register({
    type: 'eng.mechanics.omega_from_rpm',
    label: 'ω from RPM',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [{ id: 'rpm', label: 'RPM' }],
    defaultData: { blockType: 'eng.mechanics.omega_from_rpm', label: 'ω from RPM' },
  })

  register({
    type: 'eng.mechanics.rpm_from_omega',
    label: 'RPM from ω',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [{ id: 'omega', label: 'ω (rad/s)' }],
    defaultData: { blockType: 'eng.mechanics.rpm_from_omega', label: 'RPM from ω' },
  })

  register({
    type: 'eng.mechanics.power_rot_Tomega',
    label: 'P = Tω',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'T', label: 'T (N·m)' },
      { id: 'omega', label: 'ω (rad/s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.power_rot_Tomega', label: 'P = Tω' },
  })

  register({
    type: 'eng.mechanics.centripetal_acc',
    label: 'a = v²/r',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'v', label: 'v (m/s)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: { blockType: 'eng.mechanics.centripetal_acc', label: 'a = v²/r' },
  })

  register({
    type: 'eng.mechanics.centripetal_force',
    label: 'F = mv²/r',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'v', label: 'v (m/s)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: { blockType: 'eng.mechanics.centripetal_force', label: 'F = mv²/r' },
  })

  register({
    type: 'eng.mechanics.friction_force',
    label: 'F = μN',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'mu', label: 'μ' },
      { id: 'N', label: 'N (N)' },
    ],
    defaultData: { blockType: 'eng.mechanics.friction_force', label: 'F = μN' },
  })

  register({
    type: 'eng.mechanics.impulse',
    label: 'J = FΔt',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'dt', label: 'Δt (s)' },
    ],
    defaultData: { blockType: 'eng.mechanics.impulse', label: 'J = FΔt' },
  })

  // ── Materials & Strength ────────────────────────────────────────────

  register({
    type: 'eng.materials.stress_F_A',
    label: 'σ = F/A',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'A', label: 'A (m²)' },
    ],
    defaultData: { blockType: 'eng.materials.stress_F_A', label: 'σ = F/A' },
  })

  register({
    type: 'eng.materials.strain_dL_L',
    label: 'ε = ΔL/L',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'dL', label: 'ΔL (m)' },
      { id: 'L', label: 'L (m)' },
    ],
    defaultData: { blockType: 'eng.materials.strain_dL_L', label: 'ε = ΔL/L' },
  })

  register({
    type: 'eng.materials.youngs_modulus',
    label: 'E = σ/ε',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'sigma', label: 'σ (Pa)' },
      { id: 'epsilon', label: 'ε' },
    ],
    defaultData: { blockType: 'eng.materials.youngs_modulus', label: 'E = σ/ε' },
  })

  register({
    type: 'eng.materials.pressure_F_A',
    label: 'p = F/A',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'A', label: 'A (m²)' },
    ],
    defaultData: { blockType: 'eng.materials.pressure_F_A', label: 'p = F/A' },
  })

  register({
    type: 'eng.materials.safety_factor',
    label: 'Safety Factor',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'strength', label: 'Strength (Pa)' },
      { id: 'stress', label: 'Stress (Pa)' },
    ],
    defaultData: { blockType: 'eng.materials.safety_factor', label: 'Safety Factor' },
  })

  register({
    type: 'eng.materials.spring_force_kx',
    label: 'F = kx',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (N/m)' },
      { id: 'x', label: 'x (m)' },
    ],
    defaultData: { blockType: 'eng.materials.spring_force_kx', label: 'F = kx' },
  })

  register({
    type: 'eng.materials.spring_energy',
    label: 'E = ½kx²',
    category: 'engMaterials',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (N/m)' },
      { id: 'x', label: 'x (m)' },
    ],
    defaultData: { blockType: 'eng.materials.spring_energy', label: 'E = ½kx²' },
  })

  // ── Section Properties ──────────────────────────────────────────────

  register({
    type: 'eng.sections.area_circle',
    label: 'Area Circle',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [{ id: 'd', label: 'd (m)' }],
    defaultData: { blockType: 'eng.sections.area_circle', label: 'Area Circle' },
  })

  register({
    type: 'eng.sections.area_annulus',
    label: 'Area Annulus',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'd_outer', label: 'd outer (m)' },
      { id: 'd_inner', label: 'd inner (m)' },
    ],
    defaultData: { blockType: 'eng.sections.area_annulus', label: 'Area Annulus' },
  })

  register({
    type: 'eng.sections.I_rect',
    label: 'I Rectangle',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'b', label: 'b (m)' },
      { id: 'h', label: 'h (m)' },
    ],
    defaultData: { blockType: 'eng.sections.I_rect', label: 'I Rectangle' },
  })

  register({
    type: 'eng.sections.I_circle',
    label: 'I Circle',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [{ id: 'd', label: 'd (m)' }],
    defaultData: { blockType: 'eng.sections.I_circle', label: 'I Circle' },
  })

  register({
    type: 'eng.sections.J_circle',
    label: 'J Circle',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [{ id: 'd', label: 'd (m)' }],
    defaultData: { blockType: 'eng.sections.J_circle', label: 'J Circle' },
  })

  register({
    type: 'eng.sections.bending_stress',
    label: 'σ = My/I',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'M', label: 'M (N·m)' },
      { id: 'y', label: 'y (m)' },
      { id: 'I', label: 'I (m⁴)' },
    ],
    defaultData: { blockType: 'eng.sections.bending_stress', label: 'σ = My/I' },
  })

  register({
    type: 'eng.sections.torsional_shear',
    label: 'τ = Tr/J',
    category: 'engSections',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'T', label: 'T (N·m)' },
      { id: 'r', label: 'r (m)' },
      { id: 'J', label: 'J (m⁴)' },
    ],
    defaultData: { blockType: 'eng.sections.torsional_shear', label: 'τ = Tr/J' },
  })

  // ── Rotational Inertia ──────────────────────────────────────────────

  register({
    type: 'eng.inertia.solid_cylinder',
    label: 'I Solid Cylinder',
    category: 'engInertia',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: { blockType: 'eng.inertia.solid_cylinder', label: 'I Solid Cyl' },
  })

  register({
    type: 'eng.inertia.hollow_cylinder',
    label: 'I Hollow Cylinder',
    category: 'engInertia',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'r_inner', label: 'r inner (m)' },
      { id: 'r_outer', label: 'r outer (m)' },
    ],
    defaultData: { blockType: 'eng.inertia.hollow_cylinder', label: 'I Hollow Cyl' },
  })

  register({
    type: 'eng.inertia.solid_sphere',
    label: 'I Solid Sphere',
    category: 'engInertia',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: { blockType: 'eng.inertia.solid_sphere', label: 'I Solid Sphere' },
  })

  register({
    type: 'eng.inertia.rod_center',
    label: 'I Rod (center)',
    category: 'engInertia',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'L', label: 'L (m)' },
    ],
    defaultData: { blockType: 'eng.inertia.rod_center', label: 'I Rod (center)' },
  })

  register({
    type: 'eng.inertia.rod_end',
    label: 'I Rod (end)',
    category: 'engInertia',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'L', label: 'L (m)' },
    ],
    defaultData: { blockType: 'eng.inertia.rod_end', label: 'I Rod (end)' },
  })

  // ── Fluids ──────────────────────────────────────────────────────────

  register({
    type: 'eng.fluids.flow_Q_from_Av',
    label: 'Q = Av',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'A', label: 'A (m²)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.fluids.flow_Q_from_Av', label: 'Q = Av' },
  })

  register({
    type: 'eng.fluids.velocity_from_QA',
    label: 'v = Q/A',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Q', label: 'Q (m³/s)' },
      { id: 'A', label: 'A (m²)' },
    ],
    defaultData: { blockType: 'eng.fluids.velocity_from_QA', label: 'v = Q/A' },
  })

  register({
    type: 'eng.fluids.mass_flow',
    label: 'ṁ = ρQ',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'Q', label: 'Q (m³/s)' },
    ],
    defaultData: { blockType: 'eng.fluids.mass_flow', label: 'ṁ = ρQ' },
  })

  register({
    type: 'eng.fluids.reynolds',
    label: 'Reynolds Re',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'v', label: 'v (m/s)' },
      { id: 'D', label: 'D (m)' },
      { id: 'mu', label: 'μ (Pa·s)' },
    ],
    defaultData: { blockType: 'eng.fluids.reynolds', label: 'Reynolds Re' },
  })

  register({
    type: 'eng.fluids.dynamic_pressure',
    label: 'q = ½ρv²',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.fluids.dynamic_pressure', label: 'q = ½ρv²' },
  })

  register({
    type: 'eng.fluids.hagen_poiseuille_dp',
    label: 'Hagen-Poiseuille',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'mu', label: 'μ (Pa·s)' },
      { id: 'L', label: 'L (m)' },
      { id: 'Q', label: 'Q (m³/s)' },
      { id: 'D', label: 'D (m)' },
    ],
    defaultData: { blockType: 'eng.fluids.hagen_poiseuille_dp', label: 'Hagen-Poiseuille' },
  })

  register({
    type: 'eng.fluids.darcy_weisbach_dp',
    label: 'Darcy-Weisbach',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'f', label: 'f' },
      { id: 'L', label: 'L (m)' },
      { id: 'D', label: 'D (m)' },
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'eng.fluids.darcy_weisbach_dp', label: 'Darcy-Weisbach' },
  })

  register({
    type: 'eng.fluids.buoyancy',
    label: 'F = ρVg',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'V', label: 'V (m³)' },
      { id: 'g', label: 'g (m/s²)' },
    ],
    defaultData: { blockType: 'eng.fluids.buoyancy', label: 'F = ρVg' },
  })

  // ── Thermo ──────────────────────────────────────────────────────────

  register({
    type: 'eng.thermo.ideal_gas_P',
    label: 'P = nRT/V',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'n', label: 'n (mol)' },
      { id: 'R', label: 'R (J/mol·K)' },
      { id: 'T', label: 'T (K)' },
      { id: 'V', label: 'V (m³)' },
    ],
    defaultData: {
      blockType: 'eng.thermo.ideal_gas_P',
      label: 'P = nRT/V',
      manualValues: { R: 8.314462618 },
    },
  })

  register({
    type: 'eng.thermo.ideal_gas_T',
    label: 'T = PV/nR',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (Pa)' },
      { id: 'V', label: 'V (m³)' },
      { id: 'n', label: 'n (mol)' },
      { id: 'R', label: 'R (J/mol·K)' },
    ],
    defaultData: {
      blockType: 'eng.thermo.ideal_gas_T',
      label: 'T = PV/nR',
      manualValues: { R: 8.314462618 },
    },
  })

  register({
    type: 'eng.thermo.heat_Q_mcDT',
    label: 'Q = mcΔT',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'c', label: 'c (J/kg·K)' },
      { id: 'dT', label: 'ΔT (K)' },
    ],
    defaultData: { blockType: 'eng.thermo.heat_Q_mcDT', label: 'Q = mcΔT' },
  })

  register({
    type: 'eng.thermo.conduction_Qdot',
    label: 'Conduction',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (W/m·K)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'dT', label: 'ΔT (K)' },
      { id: 'L', label: 'L (m)' },
    ],
    defaultData: { blockType: 'eng.thermo.conduction_Qdot', label: 'Conduction' },
  })

  register({
    type: 'eng.thermo.convection_Qdot',
    label: 'Convection',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'h', label: 'h (W/m²·K)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'dT', label: 'ΔT (K)' },
    ],
    defaultData: { blockType: 'eng.thermo.convection_Qdot', label: 'Convection' },
  })

  register({
    type: 'eng.thermo.carnot_efficiency',
    label: 'η = 1−Tc/Th',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'T_cold', label: 'T_cold (K)' },
      { id: 'T_hot', label: 'T_hot (K)' },
    ],
    defaultData: { blockType: 'eng.thermo.carnot_efficiency', label: 'η = 1−Tc/Th' },
  })

  register({
    type: 'eng.thermo.thermal_expansion',
    label: 'ΔL = αLΔT',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'alpha', label: 'α (1/K)' },
      { id: 'L', label: 'L (m)' },
      { id: 'dT', label: 'ΔT (K)' },
    ],
    defaultData: { blockType: 'eng.thermo.thermal_expansion', label: 'ΔL = αLΔT' },
  })

  // ── Electrical ──────────────────────────────────────────────────────

  register({
    type: 'eng.elec.ohms_V',
    label: 'V = IR',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'I', label: 'I (A)' },
      { id: 'R', label: 'R (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.ohms_V', label: 'V = IR' },
  })

  register({
    type: 'eng.elec.power_VI',
    label: 'P = VI',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'V', label: 'V (V)' },
      { id: 'I', label: 'I (A)' },
    ],
    defaultData: { blockType: 'eng.elec.power_VI', label: 'P = VI' },
  })

  register({
    type: 'eng.elec.power_I2R',
    label: 'P = I²R',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'I', label: 'I (A)' },
      { id: 'R', label: 'R (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.power_I2R', label: 'P = I²R' },
  })

  register({
    type: 'eng.elec.power_V2R',
    label: 'P = V²/R',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'V', label: 'V (V)' },
      { id: 'R', label: 'R (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.power_V2R', label: 'P = V²/R' },
  })

  register({
    type: 'eng.elec.capacitance_Q_V',
    label: 'C = Q/V',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Q', label: 'Q (C)' },
      { id: 'V', label: 'V (V)' },
    ],
    defaultData: { blockType: 'eng.elec.capacitance_Q_V', label: 'C = Q/V' },
  })

  register({
    type: 'eng.elec.series_resistance',
    label: 'R = R₁+R₂',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R1', label: 'R₁ (Ω)' },
      { id: 'R2', label: 'R₂ (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.series_resistance', label: 'R = R₁+R₂' },
  })

  register({
    type: 'eng.elec.parallel_resistance',
    label: 'R∥ = R₁R₂/(R₁+R₂)',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R1', label: 'R₁ (Ω)' },
      { id: 'R2', label: 'R₂ (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.parallel_resistance', label: 'R∥ = R₁R₂/(R₁+R₂)' },
  })

  // ── Conversions ─────────────────────────────────────────────────────

  register({
    type: 'eng.conv.deg_to_rad',
    label: 'Deg → Rad',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'deg', label: 'deg' }],
    defaultData: { blockType: 'eng.conv.deg_to_rad', label: 'Deg→Rad' },
  })

  register({
    type: 'eng.conv.rad_to_deg',
    label: 'Rad → Deg',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'rad', label: 'rad' }],
    defaultData: { blockType: 'eng.conv.rad_to_deg', label: 'Rad→Deg' },
  })

  register({
    type: 'eng.conv.mm_to_m',
    label: 'mm → m',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'mm', label: 'mm' }],
    defaultData: { blockType: 'eng.conv.mm_to_m', label: 'mm→m' },
  })

  register({
    type: 'eng.conv.m_to_mm',
    label: 'm → mm',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'm', label: 'm' }],
    defaultData: { blockType: 'eng.conv.m_to_mm', label: 'm→mm' },
  })

  register({
    type: 'eng.conv.bar_to_pa',
    label: 'bar → Pa',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'bar', label: 'bar' }],
    defaultData: { blockType: 'eng.conv.bar_to_pa', label: 'bar→Pa' },
  })

  register({
    type: 'eng.conv.pa_to_bar',
    label: 'Pa → bar',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'Pa', label: 'Pa' }],
    defaultData: { blockType: 'eng.conv.pa_to_bar', label: 'Pa→bar' },
  })

  register({
    type: 'eng.conv.lpm_to_m3s',
    label: 'L/min → m³/s',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'lpm', label: 'L/min' }],
    defaultData: { blockType: 'eng.conv.lpm_to_m3s', label: 'L/min→m³/s' },
  })

  register({
    type: 'eng.conv.m3s_to_lpm',
    label: 'm³/s → L/min',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'm3s', label: 'm³/s' }],
    defaultData: { blockType: 'eng.conv.m3s_to_lpm', label: 'm³/s→L/min' },
  })
}
