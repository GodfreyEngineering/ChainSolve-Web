/**
 * portUnitHints.ts — Maps (opId, portId) pairs to unit hint strings.
 *
 * Phase 11: Shown as faded text next to port labels in OperationNode
 * to help users understand expected input units at a glance.
 * Only covers engineering ops where units are most useful.
 */

const hints: Record<string, Record<string, string>> = {
  // Mechanics
  'eng.mechanics.force_ma': { m: 'kg', a: 'm/s²' },
  'eng.mechanics.work_Fd': { F: 'N', d: 'm' },
  'eng.mechanics.power_work_time': { W: 'J', t: 's' },
  'eng.mechanics.ke': { m: 'kg', v: 'm/s' },
  'eng.mechanics.pe': { m: 'kg', h: 'm' },
  'eng.mechanics.impulse': { F: 'N', t: 's' },
  'eng.mechanics.momentum': { m: 'kg', v: 'm/s' },
  'eng.mechanics.torque_Fr': { F: 'N', r: 'm' },
  'eng.mechanics.angular_velocity': { rpm: 'rpm' },
  'eng.mechanics.centripetal_accel': { v: 'm/s', r: 'm' },

  // Materials & Strength
  'eng.materials.stress_F_A': { F: 'N', A: 'm²' },
  'eng.materials.strain_dL_L': { dL: 'm', L: 'm' },
  'eng.materials.youngs_modulus': { sigma: 'Pa', eps: '—' },
  'eng.materials.pressure_F_A': { F: 'N', A: 'm²' },
  'eng.materials.safety_factor': { ult: 'Pa', allow: 'Pa' },
  'eng.materials.spring_force_kx': { k: 'N/m', x: 'm' },
  'eng.materials.spring_energy': { k: 'N/m', x: 'm' },

  // Sections
  'eng.sections.area_rect': { b: 'm', h: 'm' },
  'eng.sections.area_circle': { d: 'm' },
  'eng.sections.area_annulus': { d_outer: 'm', d_inner: 'm' },
  'eng.sections.I_rect': { b: 'm', h: 'm' },
  'eng.sections.I_circle': { d: 'm' },
  'eng.sections.bending_stress': { M: 'N·m', y: 'm', I: 'm⁴' },
  'eng.sections.shear_stress_VA': { V: 'N', A: 'm²' },

  // Fluids
  'eng.fluids.reynolds': { rho: 'kg/m³', v: 'm/s', D: 'm', mu: 'Pa·s' },
  'eng.fluids.bernoulli_v': { p: 'Pa', rho: 'kg/m³', h: 'm' },
  'eng.fluids.flow_rate_Av': { A: 'm²', v: 'm/s' },
  'eng.fluids.head_loss_darcyweisbach': { f: '—', L: 'm', D: 'm', v: 'm/s' },
  'eng.fluids.hydrostatic_p': { rho: 'kg/m³', h: 'm' },

  // Thermo
  'eng.thermo.heat_mcdt': { m: 'kg', c: 'J/kg·K', dT: 'K' },
  'eng.thermo.fourier_conduction': { k: 'W/m·K', A: 'm²', dT: 'K', L: 'm' },
  'eng.thermo.thermal_resistance': { L: 'm', k: 'W/m·K', A: 'm²' },
  'eng.thermo.carnot_eff': { Th: 'K', Tc: 'K' },

  // Electrical
  'eng.electrical.ohms_law_V': { I: 'A', R: 'Ω' },
  'eng.electrical.ohms_law_I': { V: 'V', R: 'Ω' },
  'eng.electrical.power_VI': { V: 'V', I: 'A' },
  'eng.electrical.power_I2R': { I: 'A', R: 'Ω' },
  'eng.electrical.resistivity_RA_L': { R: 'Ω', A: 'm²', L: 'm' },
  'eng.electrical.capacitor_energy': { C: 'F', V: 'V' },
  'eng.electrical.inductor_energy': { L: 'H', I: 'A' },
  'eng.electrical.rc_time_constant': { R: 'Ω', C: 'F' },
}

/**
 * Look up the unit hint for a specific port on a specific op.
 * Returns undefined if no hint is available.
 */
export function getPortUnitHint(opId: string, portId: string): string | undefined {
  return hints[opId]?.[portId]
}
