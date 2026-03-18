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

  // ── Electrical (expanded BLK-05) ────────────────────────────────────

  register({
    type: 'eng.elec.RC_tau',
    label: 'RC Time Constant',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R', label: 'R (Ω)' },
      { id: 'C', label: 'C (F)' },
    ],
    defaultData: { blockType: 'eng.elec.RC_tau', label: 'τ = RC' },
    synonyms: ['RC time constant', 'tau RC'],
    tags: ['electronics', 'filter'],
  })

  register({
    type: 'eng.elec.RL_tau',
    label: 'RL Time Constant',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R', label: 'R (Ω)' },
      { id: 'L', label: 'L (H)' },
    ],
    defaultData: { blockType: 'eng.elec.RL_tau', label: 'τ = L/R' },
    synonyms: ['RL time constant', 'tau RL'],
    tags: ['electronics', 'inductor'],
  })

  register({
    type: 'eng.elec.RLC_f0',
    label: 'RLC Resonant Frequency',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'L', label: 'L (H)' },
      { id: 'C', label: 'C (F)' },
    ],
    defaultData: { blockType: 'eng.elec.RLC_f0', label: 'f₀ = 1/(2π√LC)' },
    synonyms: ['resonant frequency', 'RLC f0', 'LC circuit'],
    tags: ['electronics', 'resonance'],
  })

  register({
    type: 'eng.elec.RLC_Q',
    label: 'RLC Quality Factor',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R', label: 'R (Ω)' },
      { id: 'L', label: 'L (H)' },
      { id: 'C', label: 'C (F)' },
    ],
    defaultData: { blockType: 'eng.elec.RLC_Q', label: 'Q = (1/R)√(L/C)' },
    synonyms: ['Q factor', 'quality factor RLC'],
    tags: ['electronics', 'resonance'],
  })

  register({
    type: 'eng.elec.V_divider',
    label: 'Voltage Divider',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vin', label: 'Vᵢₙ (V)' },
      { id: 'R1', label: 'R₁ (Ω)' },
      { id: 'R2', label: 'R₂ (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.V_divider', label: 'Voltage Divider' },
    synonyms: ['voltage divider', 'potential divider'],
    tags: ['electronics'],
  })

  register({
    type: 'eng.elec.I_divider',
    label: 'Current Divider',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Iin', label: 'Iᵢₙ (A)' },
      { id: 'R1', label: 'R₁ (Ω)' },
      { id: 'R2', label: 'R₂ (Ω)' },
    ],
    defaultData: { blockType: 'eng.elec.I_divider', label: 'Current Divider' },
    synonyms: ['current divider'],
    tags: ['electronics'],
  })

  register({
    type: 'eng.elec.Z_cap',
    label: 'Capacitive Reactance',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'f', label: 'f (Hz)' },
      { id: 'C', label: 'C (F)' },
    ],
    defaultData: { blockType: 'eng.elec.Z_cap', label: 'Xc = 1/(2πfC)' },
    synonyms: ['capacitive reactance', 'Xc', 'impedance capacitor'],
    tags: ['electronics', 'AC'],
  })

  register({
    type: 'eng.elec.Z_ind',
    label: 'Inductive Reactance',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'f', label: 'f (Hz)' },
      { id: 'L', label: 'L (H)' },
    ],
    defaultData: { blockType: 'eng.elec.Z_ind', label: 'XL = 2πfL' },
    synonyms: ['inductive reactance', 'XL', 'impedance inductor'],
    tags: ['electronics', 'AC'],
  })

  register({
    type: 'eng.elec.filter_fc',
    label: 'RC Filter Cutoff',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'R', label: 'R (Ω)' },
      { id: 'C', label: 'C (F)' },
    ],
    defaultData: { blockType: 'eng.elec.filter_fc', label: 'fc = 1/(2πRC)' },
    synonyms: ['cutoff frequency', 'RC filter', '-3dB frequency'],
    tags: ['electronics', 'filter'],
  })

  register({
    type: 'eng.elec.transformer_v2',
    label: 'Transformer Voltage',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'V1', label: 'V₁ (V)' },
      { id: 'N1', label: 'N₁ (turns)' },
      { id: 'N2', label: 'N₂ (turns)' },
    ],
    defaultData: { blockType: 'eng.elec.transformer_v2', label: 'V₂ = V₁·N₂/N₁' },
    synonyms: ['transformer', 'turns ratio'],
    tags: ['electronics', 'magnetics'],
  })

  register({
    type: 'eng.elec.three_phase_P',
    label: 'Three-Phase Power',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'VL', label: 'VL (V)' },
      { id: 'IL', label: 'IL (A)' },
      { id: 'pf', label: 'pf' },
    ],
    defaultData: { blockType: 'eng.elec.three_phase_P', label: 'P = √3·VL·IL·pf' },
    synonyms: ['three phase power', '3-phase', 'three phase'],
    tags: ['electronics', 'power systems'],
  })

  register({
    type: 'eng.elec.diode_shockley',
    label: 'Diode Current (Shockley)',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Is', label: 'Is (A)' },
      { id: 'V', label: 'V (V)' },
      { id: 'eta', label: 'η' },
      { id: 'Vt', label: 'Vt (V)' },
    ],
    defaultData: {
      blockType: 'eng.elec.diode_shockley',
      label: 'Diode I',
      manualValues: { eta: 1, Vt: 0.02585 },
    },
    synonyms: ['Shockley diode', 'diode equation', 'ideal diode'],
    tags: ['electronics', 'semiconductor'],
  })

  // ── Multibody Mechanics (items 2.48–2.51) ──────────────────────────

  register({
    type: 'eng.multibody.spring_force',
    label: 'Spring Force F=kx',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (N/m)' },
      { id: 'x', label: 'x (m)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.spring_force',
      label: 'Spring F=kx',
      manualValues: { k: 1000 },
    },
    synonyms: ['spring', 'Hooke', 'elastic force'],
    tags: ['mechanics', 'spring'],
  })

  register({
    type: 'eng.multibody.damper_force',
    label: 'Damper Force F=bv',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'b', label: 'b (N·s/m)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.damper_force',
      label: 'Damper F=bv',
      manualValues: { b: 100 },
    },
    synonyms: ['damper', 'dashpot', 'viscous damping'],
    tags: ['mechanics', 'damper'],
  })

  register({
    type: 'eng.multibody.mass_accel',
    label: 'Mass Acceleration a=F/m',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'm', label: 'm (kg)' },
    ],
    defaultData: { blockType: 'eng.multibody.mass_accel', label: 'a=F/m', manualValues: { m: 1 } },
    synonyms: ['Newton', 'mass acceleration', 'F=ma'],
    tags: ['mechanics', 'mass'],
  })

  register({
    type: 'eng.multibody.smd_natural_freq',
    label: 'SMD Natural Frequency',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (N/m)' },
      { id: 'm', label: 'm (kg)' },
      { id: 'b', label: 'b (N·s/m)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.smd_natural_freq',
      label: 'SMD ωn, ζ',
      manualValues: { k: 1000, m: 1, b: 10 },
    },
    synonyms: ['natural frequency', 'damping ratio', 'spring mass damper'],
    tags: ['mechanics', 'vibration'],
    description:
      'Spring-Mass-Damper system: outputs ωn (rad/s), ζ (damping ratio), ωd (damped natural freq).',
  })

  register({
    type: 'eng.multibody.rigid_body_1d',
    label: 'Rigid Body 1D',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'F', label: 'F (N)' },
      { id: 'v', label: 'v (m/s)' },
      { id: 'mu', label: 'μ' },
      { id: 'Fn', label: 'Fn (N)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.rigid_body_1d',
      label: 'Rigid Body 1D',
      manualValues: { m: 1, mu: 0.3 },
    },
    synonyms: ['rigid body', 'body dynamics', 'kinetics'],
    tags: ['mechanics', 'rigid body'],
    description:
      'Outputs F_net (N), acceleration (m/s²), and kinetic energy (J) for a 1D rigid body with Coulomb friction.',
  })

  register({
    type: 'eng.multibody.joint_revolute',
    label: 'Revolute Joint α=τ/I',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'tau', label: 'τ (N·m)' },
      { id: 'I', label: 'I (kg·m²)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.joint_revolute',
      label: 'Revolute α=τ/I',
      manualValues: { I: 0.1 },
    },
    synonyms: ['revolute joint', 'rotational joint', 'hinge'],
    tags: ['mechanics', 'joint'],
  })

  register({
    type: 'eng.multibody.joint_prismatic',
    label: 'Prismatic Joint a=F/m',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'F', label: 'F (N)' },
      { id: 'm', label: 'm (kg)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.joint_prismatic',
      label: 'Prismatic a=F/m',
      manualValues: { m: 1 },
    },
    synonyms: ['prismatic joint', 'sliding joint', 'linear joint'],
    tags: ['mechanics', 'joint'],
  })

  register({
    type: 'eng.multibody.dh_transform',
    label: 'DH Transform Matrix',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'theta', label: 'θ (rad)' },
      { id: 'd', label: 'd (m)' },
      { id: 'a', label: 'a (m)' },
      { id: 'alpha', label: 'α (rad)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.dh_transform',
      label: 'DH Matrix',
      manualValues: { theta: 0, d: 0, a: 1, alpha: 0 },
    },
    synonyms: ['Denavit-Hartenberg', 'DH', 'homogeneous transform', 'robot kinematics'],
    tags: ['mechanics', 'kinematics', 'robotics'],
    description: 'Denavit-Hartenberg homogeneous transform. Returns 4×4 matrix for one joint.',
  })

  register({
    type: 'eng.multibody.contact_penalty',
    label: 'Contact Model (Penalty)',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k_p', label: 'k_p (N/m)' },
      { id: 'gap', label: 'gap (m)' },
      { id: 'mu', label: 'μ' },
    ],
    defaultData: {
      blockType: 'eng.multibody.contact_penalty',
      label: 'Contact',
      manualValues: { k_p: 1e5, mu: 0.3 },
    },
    synonyms: ['contact', 'collision', 'impact', 'penalty contact'],
    tags: ['mechanics', 'contact'],
    description:
      'Penalty-based contact with Coulomb friction. gap>0 = no contact, gap<0 = penetration.',
  })

  register({
    type: 'eng.multibody.stribeck_friction',
    label: 'Stribeck Friction',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'mu_s', label: 'μ_s (static)' },
      { id: 'mu_k', label: 'μ_k (kinetic)' },
      { id: 'vs', label: 'v_s (m/s)' },
      { id: 'v', label: 'v (m/s)' },
      { id: 'Fn', label: 'Fn (N)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.stribeck_friction',
      label: 'Stribeck',
      manualValues: { mu_s: 0.5, mu_k: 0.3, vs: 0.01 },
    },
    synonyms: ['Stribeck', 'friction model', 'stick-slip'],
    tags: ['mechanics', 'friction'],
    description:
      'Stribeck friction curve: μ = μk + (μs−μk)·exp(−(v/vs)²). Models static→kinetic transition.',
  })

  register({
    type: 'eng.multibody.fk_2dof_planar',
    label: 'FK 2-DOF Planar Arm',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'l1', label: 'l₁ (m)' },
      { id: 'l2', label: 'l₂ (m)' },
      { id: 'theta1', label: 'θ₁ (rad)' },
      { id: 'theta2', label: 'θ₂ (rad)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.fk_2dof_planar',
      label: 'FK 2-DOF',
      manualValues: { l1: 1, l2: 0.8, theta1: 0, theta2: 0 },
    },
    synonyms: ['forward kinematics', 'planar robot', '2-link arm'],
    tags: ['mechanics', 'kinematics', 'robotics'],
    description:
      'Forward kinematics for a 2-DOF planar robot arm. Outputs end-effector (x, y) position.',
  })

  register({
    type: 'eng.multibody.ik_2dof_planar',
    label: 'IK 2-DOF Planar Arm',
    category: 'engMechanics',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'l1', label: 'l₁ (m)' },
      { id: 'l2', label: 'l₂ (m)' },
      { id: 'x', label: 'x (m)' },
      { id: 'y', label: 'y (m)' },
    ],
    defaultData: {
      blockType: 'eng.multibody.ik_2dof_planar',
      label: 'IK 2-DOF',
      manualValues: { l1: 1, l2: 0.8 },
    },
    synonyms: ['inverse kinematics', 'planar robot', '2-link arm', 'IK'],
    tags: ['mechanics', 'kinematics', 'robotics'],
    description:
      'Inverse kinematics for a 2-DOF planar arm. Given end-effector (x,y), outputs joint angles θ₁, θ₂.',
  })

  // ── Active Electronics (items 2.54–2.57) ───────────────────────────

  register({
    type: 'eng.elec.diode_iv',
    label: 'Diode I-V (Exponential)',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Is', label: 'Is (A)' },
      { id: 'V', label: 'V (V)' },
      { id: 'n', label: 'n (ideality)' },
      { id: 'Vt', label: 'Vt (V)' },
    ],
    defaultData: {
      blockType: 'eng.elec.diode_iv',
      label: 'Diode I-V',
      manualValues: { Is: 1e-12, n: 1, Vt: 0.02585 },
    },
    synonyms: ['diode', 'exponential diode', 'rectifier', 'pn junction'],
    tags: ['electronics', 'semiconductor', 'diode'],
    description:
      'Diode exponential I-V: I = Is·(exp(V/(n·Vt)) − 1). Vt = kT/q ≈ 25.85 mV at 300 K.',
  })

  register({
    type: 'eng.elec.mosfet_id',
    label: 'MOSFET Drain Current',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'kp', label: 'kp (A/V²)' },
      { id: 'Vgs', label: 'Vgs (V)' },
      { id: 'Vth', label: 'Vth (V)' },
      { id: 'Vds', label: 'Vds (V)' },
    ],
    defaultData: {
      blockType: 'eng.elec.mosfet_id',
      label: 'MOSFET Id',
      manualValues: { kp: 0.001, Vth: 1.0 },
    },
    synonyms: ['MOSFET', 'FET', 'transistor', 'square law'],
    tags: ['electronics', 'MOSFET', 'power electronics'],
    description:
      'Square-law MOSFET model: cutoff (Vgs<Vth), triode, or saturation. kp = μn·Cox·W/L.',
  })

  register({
    type: 'eng.elec.igbt_vce_drop',
    label: 'IGBT Vce Drop',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vce0', label: 'Vce0 (V)' },
      { id: 'Ic', label: 'Ic (A)' },
      { id: 'Rce', label: 'Rce (Ω)' },
    ],
    defaultData: {
      blockType: 'eng.elec.igbt_vce_drop',
      label: 'IGBT Vce',
      manualValues: { Vce0: 1.4, Rce: 0.05 },
    },
    synonyms: ['IGBT', 'insulated gate bipolar transistor', 'power switch'],
    tags: ['electronics', 'IGBT', 'power electronics'],
    description: 'IGBT simplified on-state model: Vce = Vce0 + Ic·Rce.',
  })

  register({
    type: 'eng.elec.opamp_vout',
    label: 'OpAmp Output',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vp', label: 'V+ (V)' },
      { id: 'Vm', label: 'V- (V)' },
      { id: 'A', label: 'A (gain)' },
      { id: 'Vcc', label: 'Vcc (V)' },
    ],
    defaultData: {
      blockType: 'eng.elec.opamp_vout',
      label: 'OpAmp',
      manualValues: { A: 1e5, Vcc: 15 },
    },
    synonyms: ['op-amp', 'operational amplifier', 'comparator'],
    tags: ['electronics', 'opamp', 'amplifier'],
    description:
      'OpAmp output: Vout = A·(V+−V−), clipped to ±Vcc. A=1e5 for ideal, finite for real.',
  })

  register({
    type: 'eng.elec.pwm_duty',
    label: 'PWM Average Output',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vdc', label: 'Vdc (V)' },
      { id: 'duty', label: 'duty (0-1)' },
    ],
    defaultData: { blockType: 'eng.elec.pwm_duty', label: 'PWM Vavg', manualValues: { Vdc: 48 } },
    synonyms: ['PWM', 'pulse width modulation', 'duty cycle'],
    tags: ['electronics', 'PWM', 'power electronics'],
    description: 'Average PWM output: V_avg = Vdc × duty. Use for averaged motor drive models.',
  })

  register({
    type: 'eng.elec.hbridge_vout',
    label: 'H-Bridge Output',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vdc', label: 'Vdc (V)' },
      { id: 'duty_a', label: 'duty_a' },
      { id: 'duty_b', label: 'duty_b' },
    ],
    defaultData: {
      blockType: 'eng.elec.hbridge_vout',
      label: 'H-Bridge',
      manualValues: { Vdc: 48 },
    },
    synonyms: ['H-bridge', 'full bridge', 'bipolar PWM', 'motor driver'],
    tags: ['electronics', 'H-bridge', 'motor drive'],
    description:
      'H-bridge average output: Vout = Vdc·(duty_a − duty_b). Models bipolar PWM motor drive.',
  })

  register({
    type: 'eng.elec.three_phase_spwm',
    label: '3-Phase SPWM Voltage',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Vdc', label: 'Vdc (V)' },
      { id: 'm', label: 'm (mod. index)' },
    ],
    defaultData: {
      blockType: 'eng.elec.three_phase_spwm',
      label: '3Ph SPWM',
      manualValues: { Vdc: 400, m: 0.9 },
    },
    synonyms: ['3-phase inverter', 'SPWM', 'VSI', 'variable frequency drive'],
    tags: ['electronics', 'inverter', 'three-phase'],
    description: '3-phase inverter line-to-neutral peak voltage: V_peak = m·Vdc/2. m ∈ [0,1].',
  })

  register({
    type: 'eng.elec.dc_motor',
    label: 'DC Motor Steady-State',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'V', label: 'V (V)' },
      { id: 'Ia', label: 'Ia (A)' },
      { id: 'Ra', label: 'Ra (Ω)' },
      { id: 'Ke', label: 'Ke (V·s/rad)' },
      { id: 'Kt', label: 'Kt (N·m/A)' },
    ],
    defaultData: {
      blockType: 'eng.elec.dc_motor',
      label: 'DC Motor',
      manualValues: { Ra: 0.5, Ke: 0.1, Kt: 0.1 },
    },
    synonyms: ['DC motor', 'back-EMF', 'brushed motor', 'permanent magnet motor'],
    tags: ['electronics', 'motor', 'electromechanical'],
    description:
      'DC motor steady-state: ω = (V−Ia·Ra)/Ke, T = Kt·Ia, P = T·ω. Outputs table {omega, torque, power}.',
  })

  register({
    type: 'eng.elec.pmsm_torque',
    label: 'PMSM Torque (dq-frame)',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (pole pairs)' },
      { id: 'lambda', label: 'λ (Wb)' },
      { id: 'Ld', label: 'Ld (H)' },
      { id: 'Lq', label: 'Lq (H)' },
      { id: 'id', label: 'id (A)' },
      { id: 'iq', label: 'iq (A)' },
    ],
    defaultData: {
      blockType: 'eng.elec.pmsm_torque',
      label: 'PMSM Torque',
      manualValues: { P: 4, lambda: 0.1, Ld: 0.005, Lq: 0.008 },
    },
    synonyms: ['PMSM', 'BLDC', 'permanent magnet synchronous', 'dq frame', 'Park transform'],
    tags: ['electronics', 'motor', 'PMSM'],
    description:
      'PMSM electromagnetic torque: T = (3/2)·(P/2)·(λ·iq + (Ld−Lq)·id·iq). Includes reluctance torque.',
  })

  register({
    type: 'eng.elec.pmsm_vd_vq',
    label: 'PMSM Vd/Vq Equations',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Rs', label: 'Rs (Ω)' },
      { id: 'Ld', label: 'Ld (H)' },
      { id: 'Lq', label: 'Lq (H)' },
      { id: 'lambda', label: 'λ (Wb)' },
      { id: 'omega', label: 'ωe (rad/s)' },
      { id: 'id', label: 'id (A)' },
      { id: 'iq', label: 'iq (A)' },
    ],
    defaultData: {
      blockType: 'eng.elec.pmsm_vd_vq',
      label: 'PMSM Vdq',
      manualValues: { Rs: 0.1, Ld: 0.005, Lq: 0.008, lambda: 0.1 },
    },
    synonyms: ['PMSM voltage', 'dq voltage', 'Park equations'],
    tags: ['electronics', 'motor', 'PMSM'],
    description: 'PMSM dq voltage: Vd = Rs·id − ωe·Lq·iq, Vq = Rs·iq + ωe·Ld·id + ωe·λ.',
  })

  register({
    type: 'eng.elec.battery_thevenin',
    label: 'Battery (Thevenin ECM)',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'OCV', label: 'OCV (V)' },
      { id: 'I', label: 'I (A)' },
      { id: 'R0', label: 'R0 (Ω)' },
      { id: 'R1', label: 'R1 (Ω)' },
      { id: 'C1', label: 'C1 (F)' },
      { id: 'dt', label: 'dt (s)' },
    ],
    defaultData: {
      blockType: 'eng.elec.battery_thevenin',
      label: 'Battery Thevenin',
      manualValues: { OCV: 3.6, R0: 0.01, R1: 0.02, C1: 2000, dt: 1 },
    },
    synonyms: ['battery model', 'Thevenin', 'equivalent circuit model', 'ECM', 'Li-ion'],
    tags: ['electronics', 'battery', 'energy storage'],
    description:
      'Thevenin battery equivalent circuit: Vt = OCV − I·R0 − V_RC. RC branch with τ = R1·C1.',
  })

  register({
    type: 'eng.elec.battery_soc',
    label: 'Battery SOC Update',
    category: 'engElectrical',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'SOC0', label: 'SOC0 (0-1)' },
      { id: 'I', label: 'I (A)' },
      { id: 'dt', label: 'dt (s)' },
      { id: 'Q_nom', label: 'Q_nom (Ah)' },
    ],
    defaultData: {
      blockType: 'eng.elec.battery_soc',
      label: 'Battery SOC',
      manualValues: { SOC0: 1.0, Q_nom: 100, dt: 1 },
    },
    synonyms: ['SOC', 'state of charge', 'coulomb counting', 'battery'],
    tags: ['electronics', 'battery', 'energy storage'],
    description: 'Coulomb-counting SOC update: SOC = SOC0 − (I·dt)/(Q_nom·3600). Clipped to [0,1].',
  })

  // ── Thermal Network (item 2.59) ─────────────────────────────────────

  register({
    type: 'eng.thermal.conductor_R',
    label: 'Thermal Conduction Q=kA·ΔT/L',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'L', label: 'L (m)' },
      { id: 'k', label: 'k (W/mK)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'dT', label: 'ΔT (K)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.conductor_R',
      label: 'Thermal Cond.',
      manualValues: { k: 50, A: 0.01, L: 0.1 },
    },
    synonyms: ['thermal resistance', 'conduction', 'Fourier heat', 'thermal conductor'],
    tags: ['thermal', 'heat transfer'],
    description: 'Thermal conduction: Q = k·A·ΔT/L. R_thermal = L/(k·A).',
  })

  register({
    type: 'eng.thermal.capacitor_dT',
    label: 'Thermal Mass ΔT=Q·dt/(m·c)',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'm', label: 'm (kg)' },
      { id: 'c', label: 'c (J/kgK)' },
      { id: 'Q', label: 'Q (W)' },
      { id: 'dt', label: 'dt (s)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.capacitor_dT',
      label: 'Thermal Mass',
      manualValues: { m: 1, c: 900, dt: 1 },
    },
    synonyms: ['thermal capacitor', 'thermal mass', 'heat capacity'],
    tags: ['thermal', 'heat transfer'],
    description: 'Temperature rise from heat input: ΔT = Q·dt/(m·c). Lumped thermal capacitor.',
  })

  register({
    type: 'eng.thermal.convection',
    label: 'Convection Q=h·A·ΔT',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'h', label: 'h (W/m²K)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'Ts', label: 'Ts (K)' },
      { id: 'Tf', label: 'Tf (K)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.convection',
      label: 'Convection',
      manualValues: { h: 25, A: 0.1 },
    },
    synonyms: ['convection', 'Newton cooling', 'heat transfer coefficient'],
    tags: ['thermal', 'heat transfer'],
    description: 'Newton convection: Q = h·A·(Ts − Tf). h = heat transfer coefficient W/(m²·K).',
  })

  register({
    type: 'eng.thermal.radiation',
    label: 'Radiation Q=ε·σ·A·(T⁴−Tamb⁴)',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'eps', label: 'ε (emissivity)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'Ts', label: 'Ts (K)' },
      { id: 'Tamb', label: 'Tamb (K)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.radiation',
      label: 'Radiation',
      manualValues: { eps: 0.9, A: 0.1, Tamb: 293.15 },
    },
    synonyms: ['radiation', 'Stefan-Boltzmann', 'radiative heat transfer'],
    tags: ['thermal', 'heat transfer'],
    description: 'Radiation: Q = ε·σ·A·(Ts⁴ − Tamb⁴), σ = 5.67×10⁻⁸ W/(m²K⁴).',
  })

  // ── Heat Exchanger (item 2.60) ──────────────────────────────────────

  register({
    type: 'eng.thermal.hx_lmtd',
    label: 'Heat Exchanger (LMTD)',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'U', label: 'U (W/m²K)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'dT1', label: 'ΔT1 (K)' },
      { id: 'dT2', label: 'ΔT2 (K)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.hx_lmtd',
      label: 'HX LMTD',
      manualValues: { U: 500, A: 1 },
    },
    synonyms: ['heat exchanger', 'LMTD', 'log mean temperature'],
    tags: ['thermal', 'heat exchanger'],
    description: 'LMTD method: Q = U·A·LMTD, LMTD = (ΔT1−ΔT2)/ln(ΔT1/ΔT2).',
  })

  register({
    type: 'eng.thermal.hx_ntu',
    label: 'Heat Exchanger (ε-NTU)',
    category: 'engThermo',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'NTU', label: 'NTU' },
      { id: 'Cr', label: 'Cr (Cmin/Cmax)' },
      { id: 'Q_max', label: 'Q_max (W)' },
    ],
    defaultData: {
      blockType: 'eng.thermal.hx_ntu',
      label: 'HX ε-NTU',
      manualValues: { NTU: 2, Cr: 0.5 },
    },
    synonyms: ['heat exchanger', 'NTU method', 'effectiveness-NTU', 'epsilon-NTU'],
    tags: ['thermal', 'heat exchanger'],
    description: 'ε-NTU method: effectiveness ε and heat transfer Q. Outputs table {eps, Q}.',
  })

  // ── Pipe / Valve / Pump / Hydraulics (items 2.61–2.63) ─────────────

  register({
    type: 'eng.fluids.pipe_dp',
    label: 'Pipe Pressure Drop (Darcy-Weisbach)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'f', label: 'f (Darcy friction)' },
      { id: 'L', label: 'L (m)' },
      { id: 'D', label: 'D (m)' },
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'v', label: 'v (m/s)' },
      { id: 'K_minor', label: 'K_minor' },
    ],
    defaultData: {
      blockType: 'eng.fluids.pipe_dp',
      label: 'Pipe ΔP',
      manualValues: { f: 0.02, L: 10, D: 0.05, rho: 1000, K_minor: 0 },
    },
    synonyms: ['pipe pressure drop', 'Darcy-Weisbach', 'pipe friction', 'head loss'],
    tags: ['fluid', 'pipe', 'hydraulics'],
    description:
      'ΔP = (f·L/D + K_minor)·½ρv². Darcy friction factor f from Moody chart or correlations.',
  })

  register({
    type: 'eng.fluids.valve_cv',
    label: 'Valve Flow (Cv)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Cv', label: 'Cv' },
      { id: 'dP', label: 'ΔP (bar)' },
      { id: 'SG', label: 'SG (specific gravity)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.valve_cv',
      label: 'Valve Cv',
      manualValues: { Cv: 10, SG: 1 },
    },
    synonyms: ['valve', 'Cv', 'flow coefficient', 'control valve'],
    tags: ['fluid', 'valve', 'hydraulics'],
    description: 'Valve flow: Q (m³/h) = Cv·√(ΔP_bar/SG). Cv is the valve flow coefficient.',
  })

  register({
    type: 'eng.fluids.pump_power',
    label: 'Pump Power',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'g', label: 'g (m/s²)' },
      { id: 'H', label: 'H (m)' },
      { id: 'Q', label: 'Q (m³/s)' },
      { id: 'eta', label: 'η (efficiency)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.pump_power',
      label: 'Pump Power',
      manualValues: { rho: 1000, g: 9.81, eta: 0.75 },
    },
    synonyms: ['pump', 'hydraulic power', 'pump efficiency'],
    tags: ['fluid', 'pump', 'hydraulics'],
    description:
      'Pump hydraulic power P_hyd = ρ·g·H·Q, shaft power = P_hyd/η. Outputs table {P_hyd, P_shaft}.',
  })

  register({
    type: 'eng.fluids.orifice_flow',
    label: 'Orifice Flow (Cd)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Cd', label: 'Cd (discharge coeff)' },
      { id: 'A', label: 'A (m²)' },
      { id: 'dP', label: 'ΔP (Pa)' },
      { id: 'rho', label: 'ρ (kg/m³)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.orifice_flow',
      label: 'Orifice',
      manualValues: { Cd: 0.61, rho: 1000 },
    },
    synonyms: ['orifice', 'flow meter', 'discharge coefficient', 'sharp-edged orifice'],
    tags: ['fluid', 'orifice', 'flow measurement'],
    description: 'Orifice flow: Q = Cd·A·√(2·ΔP/ρ). Cd ≈ 0.61 for sharp-edged orifice.',
  })

  register({
    type: 'eng.fluids.accumulator',
    label: 'Gas Accumulator P₂=P₁(V₁/V₂)^γ',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P1', label: 'P1 (Pa)' },
      { id: 'V1', label: 'V1 (m³)' },
      { id: 'V2', label: 'V2 (m³)' },
      { id: 'gamma', label: 'γ (adiabatic)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.accumulator',
      label: 'Accumulator',
      manualValues: { gamma: 1.4 },
    },
    synonyms: ['accumulator', 'gas spring', 'hydraulic accumulator', 'bladder'],
    tags: ['fluid', 'accumulator', 'hydraulics'],
    description: 'Isentropic gas accumulator: P2 = P1·(V1/V2)^γ. γ = 1.4 for nitrogen (typical).',
  })

  register({
    type: 'eng.fluids.hydraulic_cylinder',
    label: 'Hydraulic Cylinder',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P_bore', label: 'P_bore (Pa)' },
      { id: 'A_bore', label: 'A_bore (m²)' },
      { id: 'P_rod', label: 'P_rod (Pa)' },
      { id: 'A_rod', label: 'A_rod (m²)' },
      { id: 'Q', label: 'Q (m³/s)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.hydraulic_cylinder',
      label: 'Hyd. Cylinder',
      manualValues: { A_bore: 0.01, A_rod: 0.005 },
    },
    synonyms: ['hydraulic cylinder', 'linear actuator', 'hydraulic ram'],
    tags: ['fluid', 'hydraulics', 'actuator'],
    description:
      'Hydraulic cylinder: F = P_bore·A_bore − P_rod·A_rod, v = Q/A_bore. Outputs table {F, v}.',
  })

  register({
    type: 'eng.fluids.hydraulic_motor',
    label: 'Hydraulic Motor',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'dP', label: 'ΔP (Pa)' },
      { id: 'D', label: 'D (m³/rev)' },
      { id: 'Q', label: 'Q (m³/s)' },
      { id: 'eta', label: 'η (efficiency)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.hydraulic_motor',
      label: 'Hyd. Motor',
      manualValues: { D: 50e-6, eta: 0.9 },
    },
    synonyms: ['hydraulic motor', 'hydrostatic motor', 'hydraulic drive'],
    tags: ['fluid', 'hydraulics', 'motor'],
    description:
      'Hydraulic motor: T = ΔP·D/(2π), ω = Q/D·2π, P_mech = T·ω·η. Outputs table {torque, omega, power}.',
  })

  register({
    type: 'eng.fluids.water_density',
    label: 'Water Density ρ(T)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [{ id: 'T', label: 'T (°C)' }],
    defaultData: {
      blockType: 'eng.fluids.water_density',
      label: 'Water ρ(T)',
      manualValues: { T: 20 },
    },
    synonyms: ['water density', 'fluid density', 'temperature dependent density'],
    tags: ['fluid', 'properties', 'water'],
    description:
      'Water density vs temperature (0–100°C): ρ ≈ 999.84 + 0.068T − 0.0091T² + 1e-5T³ kg/m³.',
  })

  register({
    type: 'eng.fluids.water_viscosity',
    label: 'Water Viscosity μ(T)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [{ id: 'T', label: 'T (°C)' }],
    defaultData: {
      blockType: 'eng.fluids.water_viscosity',
      label: 'Water μ(T)',
      manualValues: { T: 20 },
    },
    synonyms: ['water viscosity', 'dynamic viscosity', 'fluid viscosity'],
    tags: ['fluid', 'properties', 'water'],
    description: 'Water dynamic viscosity vs temperature using Vogel equation. Returns μ in Pa·s.',
  })

  register({
    type: 'eng.fluids.oil_viscosity',
    label: 'Oil Viscosity (Walther ASTM D341)',
    category: 'engFluids',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'nu40', label: 'ν40 (cSt at 40°C)' },
      { id: 'nu100', label: 'ν100 (cSt at 100°C)' },
      { id: 'T', label: 'T (°C)' },
    ],
    defaultData: {
      blockType: 'eng.fluids.oil_viscosity',
      label: 'Oil ν(T)',
      manualValues: { nu40: 46, nu100: 7, T: 60 },
    },
    synonyms: [
      'oil viscosity',
      'lubricant viscosity',
      'ASTM D341',
      'Walther equation',
      'viscosity index',
    ],
    tags: ['fluid', 'properties', 'oil'],
    description:
      'Oil kinematic viscosity vs temperature using Walther ASTM D341 equation. Give ν at 40°C and 100°C.',
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

  // Generic unit conversion block — user picks input/output units via dropdowns.
  register({
    type: 'unit_convert',
    label: 'Unit Convert',
    category: 'engConversions',
    nodeKind: 'csOperation',
    inputs: [{ id: 'value', label: 'value' }],
    defaultData: { blockType: 'unit_convert', label: 'Unit Convert', convFactor: 1 },
  })
}
