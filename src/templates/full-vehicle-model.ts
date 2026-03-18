/**
 * full-vehicle-model.ts — Full-Vehicle Model template (2.82).
 *
 * Pre-wired graph covering the major vehicle simulation subsystems:
 *
 *  § 1  Full-vehicle 7-DOF suspension dynamics (body heave/pitch/roll + 4 wheels)
 *       with step-steer event input
 *  § 2  Powertrain chain: engine → gear ratio → drivetrain loss → wheel speed
 *  § 3  Aerodynamic forces: drag, front/rear downforce, aero balance %
 *  § 4  Pacejka tyre model: lateral Fy sweep table (plot-ready)
 *  § 5  Brake system: kinetic energy dissipated + braking power
 *  § 6  K&C (Kinematics & Compliance) analysis: bump steer, roll centre, anti-dive
 *
 * All parameter values are representative for a 1200 kg sports saloon.
 * Pro-only blocks — users without Pro will see upgrade prompts on those blocks.
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildFullVehicleModel(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [

    // ─── Title ───────────────────────────────────────────────────────────────
    {
      id: 'fv-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Full-Vehicle Model\n\n' +
          'Complete vehicle simulation template — 7-DOF suspension, powertrain, aero,\n' +
          'Pacejka tyre model, brake energy analysis, and K&C geometry.\n' +
          'All values are representative for a 1 200 kg sports saloon.',
        annotationColor: '#1CABB0',
        annotationFontSize: 14,
        annotationBold: true,
        width: 720,
      },
      style: { width: 720 },
    },

    // ════════════════════════════════════════════════════════════════════
    // § 1  Full-Vehicle 7-DOF Suspension
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec1-label',
      type: 'csAnnotation',
      position: { x: -20, y: 30 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 1  Full-Vehicle 7-DOF Suspension\n' +
          'Body heave, pitch, roll + 4 wheel DOFs. Anti-roll bars front and rear.',
        annotationColor: '#22c55e',
        annotationFontSize: 11,
        width: 500,
      },
      style: { width: 500 },
    },

    // Step steer event → full-vehicle model
    {
      id: 'fv-step-steer',
      type: 'csOperation',
      position: { x: 0, y: 90 },
      data: {
        blockType: 'veh.event.stepSteer',
        label: 'Step Steer Event',
        t_start: 0.5, ramp_time: 0.1, target_angle: 0.08,
        t_end: 5.0, dt: 0.01, throttle: 0.4,
      },
    },

    {
      id: 'fv-fullcar',
      type: 'csOperation',
      position: { x: 280, y: 80 },
      data: {
        blockType: 'veh.suspension.fullCar',
        label: 'Full Vehicle (7-DOF)',
        m_s: 1200, i_pitch: 1800, i_roll: 500,
        m_wfl: 35, m_wfr: 35, m_wrl: 40, m_wrr: 40,
        k_fl: 22000, c_fl: 1400, k_fr: 22000, c_fr: 1400,
        k_rl: 24000, c_rl: 1600, k_rr: 24000, c_rr: 1600,
        k_tf: 180000, k_tr: 180000,
        k_arb_f: 8000, k_arb_r: 5000,
        a: 1.20, b: 1.50, tw_f: 0.75, tw_r: 0.75,
        t_end: 5.0, dt: 0.01,
      },
    },

    // Road inputs (uniform bump — all four corners)
    {
      id: 'fv-road-fl',
      type: 'csSource',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Road FL (m)', value: 0 },
    },
    {
      id: 'fv-road-fr',
      type: 'csSource',
      position: { x: 0, y: 310 },
      data: { blockType: 'number', label: 'Road FR (m)', value: 0 },
    },
    {
      id: 'fv-road-rl',
      type: 'csSource',
      position: { x: 0, y: 380 },
      data: { blockType: 'number', label: 'Road RL (m)', value: 0 },
    },
    {
      id: 'fv-road-rr',
      type: 'csSource',
      position: { x: 0, y: 450 },
      data: { blockType: 'number', label: 'Road RR (m)', value: 0 },
    },

    // Display: body motion time series
    {
      id: 'fv-disp-body',
      type: 'csDisplay',
      position: { x: 560, y: 80 },
      data: { blockType: 'display', label: 'Body Motion (14-state series)' },
    },

    // ════════════════════════════════════════════════════════════════════
    // § 2  Powertrain Chain
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec2-label',
      type: 'csAnnotation',
      position: { x: -20, y: 550 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 2  Powertrain Chain\n' +
          'Engine torque/RPM → gear ratio → drivetrain loss → wheel speed.',
        annotationColor: '#f97316',
        annotationFontSize: 11,
        width: 500,
      },
      style: { width: 500 },
    },

    // Inputs
    { id: 'fv-eng-torque', type: 'csSource', position: { x: 0, y: 610 }, data: { blockType: 'number', label: 'Engine torque (Nm)', value: 350 } },
    { id: 'fv-eng-rpm',    type: 'csSource', position: { x: 0, y: 680 }, data: { blockType: 'number', label: 'Engine RPM', value: 3500 } },
    { id: 'fv-gear-ratio', type: 'csSource', position: { x: 0, y: 750 }, data: { blockType: 'number', label: 'Gear ratio', value: 4.2 } },
    { id: 'fv-tire-r',     type: 'csSource', position: { x: 0, y: 820 }, data: { blockType: 'number', label: 'Tyre radius (m)', value: 0.32 } },
    { id: 'fv-drv-eta',    type: 'csSource', position: { x: 0, y: 890 }, data: { blockType: 'number', label: 'Drivetrain η', value: 0.88 } },

    // Gear ratio block
    {
      id: 'fv-gear',
      type: 'csOperation',
      position: { x: 280, y: 640 },
      data: { blockType: 'veh.powertrain.gearRatio', label: 'Gear Ratio' },
    },

    // Drivetrain loss
    {
      id: 'fv-drv-loss',
      type: 'csOperation',
      position: { x: 280, y: 770 },
      data: { blockType: 'veh.powertrain.drivetrainLoss', label: 'Drivetrain Loss' },
    },

    // Wheel speed
    {
      id: 'fv-wheel-spd',
      type: 'csOperation',
      position: { x: 280, y: 870 },
      data: { blockType: 'veh.powertrain.wheelSpeed', label: 'Wheel Speed' },
    },

    // Displays
    { id: 'fv-disp-torque-out', type: 'csDisplay', position: { x: 560, y: 640 }, data: { blockType: 'display', label: 'Wheel torque (Nm)' } },
    { id: 'fv-disp-p-out',      type: 'csDisplay', position: { x: 560, y: 770 }, data: { blockType: 'display', label: 'Wheel power (W)' } },
    { id: 'fv-disp-veh-spd',    type: 'csDisplay', position: { x: 560, y: 870 }, data: { blockType: 'display', label: 'Vehicle speed (m/s)' } },

    // ════════════════════════════════════════════════════════════════════
    // § 3  Aerodynamics
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec3-label',
      type: 'csAnnotation',
      position: { x: -20, y: 1010 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 3  Aerodynamics\n' +
          'Drag force and front/rear downforce → aero balance at vehicle speed.',
        annotationColor: '#06b6d4',
        annotationFontSize: 11,
        width: 500,
      },
      style: { width: 500 },
    },

    // Shared aero inputs
    { id: 'fv-aero-rho',     type: 'csSource', position: { x: 0, y: 1070 }, data: { blockType: 'number', label: 'Air density ρ (kg/m³)', value: 1.225 } },
    { id: 'fv-aero-v',       type: 'csSource', position: { x: 0, y: 1140 }, data: { blockType: 'number', label: 'Speed (m/s)', value: 50 } },
    { id: 'fv-aero-A',       type: 'csSource', position: { x: 0, y: 1210 }, data: { blockType: 'number', label: 'Front area A (m²)', value: 2.2 } },
    { id: 'fv-aero-Cd',      type: 'csSource', position: { x: 0, y: 1280 }, data: { blockType: 'number', label: 'Drag coeff Cd', value: 0.30 } },
    { id: 'fv-aero-Cl-f',    type: 'csSource', position: { x: 0, y: 1350 }, data: { blockType: 'number', label: 'Lift coeff front Cl_f', value: 0.25 } },
    { id: 'fv-aero-Cl-r',    type: 'csSource', position: { x: 0, y: 1420 }, data: { blockType: 'number', label: 'Lift coeff rear Cl_r', value: 0.45 } },

    // Drag
    {
      id: 'fv-drag',
      type: 'csOperation',
      position: { x: 280, y: 1100 },
      data: { blockType: 'veh.aero.drag', label: 'Aero Drag' },
    },

    // Front downforce
    {
      id: 'fv-df-front',
      type: 'csOperation',
      position: { x: 280, y: 1240 },
      data: { blockType: 'veh.aero.downforce', label: 'Front Downforce' },
    },

    // Rear downforce
    {
      id: 'fv-df-rear',
      type: 'csOperation',
      position: { x: 280, y: 1380 },
      data: { blockType: 'veh.aero.downforce', label: 'Rear Downforce' },
    },

    // Add front + rear downforce for total
    {
      id: 'fv-df-total',
      type: 'csOperation',
      position: { x: 560, y: 1310 },
      data: { blockType: 'add', label: 'Total Downforce' },
    },

    // Aero balance
    {
      id: 'fv-aero-bal',
      type: 'csOperation',
      position: { x: 760, y: 1310 },
      data: { blockType: 'veh.aero.balance', label: 'Aero Balance %' },
    },

    // Displays
    { id: 'fv-disp-drag',   type: 'csDisplay', position: { x: 560, y: 1100 }, data: { blockType: 'display', label: 'Drag force (N)' } },
    { id: 'fv-disp-df-f',   type: 'csDisplay', position: { x: 560, y: 1200 }, data: { blockType: 'display', label: 'Front downforce (N)' } },
    { id: 'fv-disp-df-r',   type: 'csDisplay', position: { x: 560, y: 1420 }, data: { blockType: 'display', label: 'Rear downforce (N)' } },
    { id: 'fv-disp-balance',type: 'csDisplay', position: { x: 980, y: 1310 }, data: { blockType: 'display', label: 'Aero balance (%)' } },

    // ════════════════════════════════════════════════════════════════════
    // § 4  Pacejka Tyre Model
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec4-label',
      type: 'csAnnotation',
      position: { x: -20, y: 1550 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 4  Pacejka Tyre Model\n' +
          'Magic Formula coefficients for a typical road tyre (B, C, D, E).\n' +
          'Sweep output is a table of (slip, Fy) ready to wire into a plot block.',
        annotationColor: '#a855f7',
        annotationFontSize: 11,
        width: 600,
      },
      style: { width: 600 },
    },

    // Pacejka inputs (typical medium-compound road tyre)
    { id: 'fv-tire-Fz',  type: 'csSource', position: { x: 0, y: 1620 }, data: { blockType: 'number', label: 'Vertical load Fz (N)', value: 3000 } },
    { id: 'fv-tire-B',   type: 'csSource', position: { x: 0, y: 1690 }, data: { blockType: 'number', label: 'Pacejka B', value: 10 } },
    { id: 'fv-tire-C',   type: 'csSource', position: { x: 0, y: 1760 }, data: { blockType: 'number', label: 'Pacejka C', value: 1.9 } },
    { id: 'fv-tire-D',   type: 'csSource', position: { x: 0, y: 1830 }, data: { blockType: 'number', label: 'Pacejka D (peak Fy, N)', value: 3300 } },
    { id: 'fv-tire-E',   type: 'csSource', position: { x: 0, y: 1900 }, data: { blockType: 'number', label: 'Pacejka E', value: -0.5 } },
    { id: 'fv-tire-sa',  type: 'csSource', position: { x: 0, y: 1970 }, data: { blockType: 'number', label: 'Slip angle (rad)', value: 0.05 } },

    // Lateral force at given slip angle
    {
      id: 'fv-tire-lat',
      type: 'csOperation',
      position: { x: 280, y: 1680 },
      data: { blockType: 'veh.tire.lateralForce', label: 'Pacejka Fy' },
    },

    // Sweep table for plotting
    {
      id: 'fv-tire-sweep',
      type: 'csOperation',
      position: { x: 280, y: 1850 },
      data: {
        blockType: 'veh.tire.sweep',
        label: 'Tyre Fy Sweep',
        slipMin: -0.3,
        slipMax: 0.3,
        points: 121,
      },
    },

    { id: 'fv-disp-fy',    type: 'csDisplay', position: { x: 560, y: 1680 }, data: { blockType: 'display', label: 'Lateral force Fy (N)' } },
    { id: 'fv-disp-sweep', type: 'csDisplay', position: { x: 560, y: 1850 }, data: { blockType: 'display', label: 'Fy Sweep table' } },

    // ════════════════════════════════════════════════════════════════════
    // § 5  Brake System
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec5-label',
      type: 'csAnnotation',
      position: { x: -20, y: 2060 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 5  Brake System\n' +
          'Kinetic energy dissipated E = ½m(v₁²−v₂²) and braking power P = E/Δt.',
        annotationColor: '#ef4444',
        annotationFontSize: 11,
        width: 500,
      },
      style: { width: 500 },
    },

    { id: 'fv-brk-mass',  type: 'csSource', position: { x: 0, y: 2120 }, data: { blockType: 'number', label: 'Vehicle mass (kg)', value: 1200 } },
    { id: 'fv-brk-v1',   type: 'csSource', position: { x: 0, y: 2190 }, data: { blockType: 'number', label: 'Initial speed v₁ (m/s)', value: 38.9 } },
    { id: 'fv-brk-v2',   type: 'csSource', position: { x: 0, y: 2260 }, data: { blockType: 'number', label: 'Final speed v₂ (m/s)', value: 0 } },
    { id: 'fv-brk-dt',   type: 'csSource', position: { x: 0, y: 2330 }, data: { blockType: 'number', label: 'Braking time Δt (s)', value: 3.5 } },

    {
      id: 'fv-brk-energy',
      type: 'csOperation',
      position: { x: 280, y: 2160 },
      data: { blockType: 'veh.brake.energy', label: 'Brake Energy' },
    },

    {
      id: 'fv-brk-power',
      type: 'csOperation',
      position: { x: 280, y: 2280 },
      data: { blockType: 'veh.brake.power', label: 'Brake Power' },
    },

    { id: 'fv-disp-brk-e', type: 'csDisplay', position: { x: 560, y: 2160 }, data: { blockType: 'display', label: 'Brake energy (J)' } },
    { id: 'fv-disp-brk-p', type: 'csDisplay', position: { x: 560, y: 2280 }, data: { blockType: 'display', label: 'Average brake power (W)' } },

    // ════════════════════════════════════════════════════════════════════
    // § 6  K&C (Kinematics & Compliance)
    // ════════════════════════════════════════════════════════════════════

    {
      id: 'fv-sec6-label',
      type: 'csAnnotation',
      position: { x: -20, y: 2430 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          '§ 6  K&C Analysis\n' +
          'Linearised double-wishbone geometry. No inputs required — all geometry in block data.\n' +
          'Outputs: bump steer gradient, bump camber gradient, roll centre height,\n' +
          'lateral stiffness, anti-dive %, anti-squat %.',
        annotationColor: '#eab308',
        annotationFontSize: 11,
        width: 600,
      },
      style: { width: 600 },
    },

    {
      id: 'fv-kc',
      type: 'csOperation',
      position: { x: 280, y: 2510 },
      data: {
        blockType: 'veh.suspension.kc',
        label: 'K&C Analysis',
        a_upper: 0.35, b_upper: 0.30,
        a_lower: 0.18, b_lower: 0.10,
        track_half: 0.75,
        wheel_rate: 22000,
        toe_link_angle_deg: 3,
        anti_angle_deg: 8,
      },
    },

    { id: 'fv-disp-kc', type: 'csDisplay', position: { x: 560, y: 2510 }, data: { blockType: 'display', label: 'K&C Results' } },
  ]

  const edges = [

    // § 1 — Step steer produces road data; road inputs to full car
    // (step steer here drives the event table but we just pass zero road inputs;
    //  the step steer output port 'out' is shown connected to a display for the driver input)
    { id: 'fv-e-road-fl', source: 'fv-road-fl', sourceHandle: 'out', target: 'fv-fullcar', targetHandle: 'road_fl', animated: true },
    { id: 'fv-e-road-fr', source: 'fv-road-fr', sourceHandle: 'out', target: 'fv-fullcar', targetHandle: 'road_fr', animated: true },
    { id: 'fv-e-road-rl', source: 'fv-road-rl', sourceHandle: 'out', target: 'fv-fullcar', targetHandle: 'road_rl', animated: true },
    { id: 'fv-e-road-rr', source: 'fv-road-rr', sourceHandle: 'out', target: 'fv-fullcar', targetHandle: 'road_rr', animated: true },
    { id: 'fv-e-body',    source: 'fv-fullcar',  sourceHandle: 'out', target: 'fv-disp-body', targetHandle: 'value', animated: true },

    // § 2 — Powertrain
    { id: 'fv-e-g-torque', source: 'fv-eng-torque', sourceHandle: 'out', target: 'fv-gear', targetHandle: 'torque', animated: true },
    { id: 'fv-e-g-rpm',    source: 'fv-eng-rpm',    sourceHandle: 'out', target: 'fv-gear', targetHandle: 'rpm',    animated: true },
    { id: 'fv-e-g-ratio',  source: 'fv-gear-ratio', sourceHandle: 'out', target: 'fv-gear', targetHandle: 'ratio',  animated: true },
    { id: 'fv-e-gear-out', source: 'fv-gear',        sourceHandle: 'torque_out', target: 'fv-disp-torque-out', targetHandle: 'value', animated: true },

    // Drivetrain loss takes power = torque × angular_speed, but here we use the rpm_out port
    // by connecting gear rpm_out → wheel speed, and torque_out → drivetrain loss
    { id: 'fv-e-dl-power', source: 'fv-gear', sourceHandle: 'torque_out', target: 'fv-drv-loss', targetHandle: 'power', animated: true },
    { id: 'fv-e-dl-eta',   source: 'fv-drv-eta',  sourceHandle: 'out', target: 'fv-drv-loss', targetHandle: 'efficiency', animated: true },
    { id: 'fv-e-dl-out',   source: 'fv-drv-loss', sourceHandle: 'out', target: 'fv-disp-p-out', targetHandle: 'value', animated: true },

    { id: 'fv-e-ws-rpm',   source: 'fv-gear',      sourceHandle: 'rpm_out', target: 'fv-wheel-spd', targetHandle: 'rpm',   animated: true },
    { id: 'fv-e-ws-r',     source: 'fv-tire-r',    sourceHandle: 'out',     target: 'fv-wheel-spd', targetHandle: 'radius', animated: true },
    { id: 'fv-e-ws-ratio', source: 'fv-gear-ratio',sourceHandle: 'out',     target: 'fv-wheel-spd', targetHandle: 'ratio',  animated: true },
    { id: 'fv-e-ws-out',   source: 'fv-wheel-spd', sourceHandle: 'out',     target: 'fv-disp-veh-spd', targetHandle: 'value', animated: true },

    // § 3 — Aerodynamics
    { id: 'fv-e-drag-rho', source: 'fv-aero-rho', sourceHandle: 'out', target: 'fv-drag', targetHandle: 'rho', animated: true },
    { id: 'fv-e-drag-Cd',  source: 'fv-aero-Cd',  sourceHandle: 'out', target: 'fv-drag', targetHandle: 'Cd',  animated: true },
    { id: 'fv-e-drag-A',   source: 'fv-aero-A',   sourceHandle: 'out', target: 'fv-drag', targetHandle: 'A',   animated: true },
    { id: 'fv-e-drag-v',   source: 'fv-aero-v',   sourceHandle: 'out', target: 'fv-drag', targetHandle: 'v',   animated: true },
    { id: 'fv-e-drag-out', source: 'fv-drag',      sourceHandle: 'out', target: 'fv-disp-drag', targetHandle: 'value', animated: true },

    { id: 'fv-e-dff-rho', source: 'fv-aero-rho', sourceHandle: 'out', target: 'fv-df-front', targetHandle: 'rho', animated: true },
    { id: 'fv-e-dff-Cl',  source: 'fv-aero-Cl-f',sourceHandle: 'out', target: 'fv-df-front', targetHandle: 'Cl',  animated: true },
    { id: 'fv-e-dff-A',   source: 'fv-aero-A',   sourceHandle: 'out', target: 'fv-df-front', targetHandle: 'A',   animated: true },
    { id: 'fv-e-dff-v',   source: 'fv-aero-v',   sourceHandle: 'out', target: 'fv-df-front', targetHandle: 'v',   animated: true },
    { id: 'fv-e-dff-out', source: 'fv-df-front',  sourceHandle: 'out', target: 'fv-disp-df-f', targetHandle: 'value', animated: true },

    { id: 'fv-e-dfr-rho', source: 'fv-aero-rho', sourceHandle: 'out', target: 'fv-df-rear', targetHandle: 'rho', animated: true },
    { id: 'fv-e-dfr-Cl',  source: 'fv-aero-Cl-r',sourceHandle: 'out', target: 'fv-df-rear', targetHandle: 'Cl',  animated: true },
    { id: 'fv-e-dfr-A',   source: 'fv-aero-A',   sourceHandle: 'out', target: 'fv-df-rear', targetHandle: 'A',   animated: true },
    { id: 'fv-e-dfr-v',   source: 'fv-aero-v',   sourceHandle: 'out', target: 'fv-df-rear', targetHandle: 'v',   animated: true },
    { id: 'fv-e-dfr-out', source: 'fv-df-rear',   sourceHandle: 'out', target: 'fv-disp-df-r', targetHandle: 'value', animated: true },

    { id: 'fv-e-tot-f',   source: 'fv-df-front', sourceHandle: 'out', target: 'fv-df-total', targetHandle: 'in_0', animated: true },
    { id: 'fv-e-tot-r',   source: 'fv-df-rear',  sourceHandle: 'out', target: 'fv-df-total', targetHandle: 'in_1', animated: true },
    { id: 'fv-e-bal-f',   source: 'fv-df-front', sourceHandle: 'out', target: 'fv-aero-bal', targetHandle: 'f_front', animated: true },
    { id: 'fv-e-bal-t',   source: 'fv-df-total', sourceHandle: 'out', target: 'fv-aero-bal', targetHandle: 'f_total', animated: true },
    { id: 'fv-e-bal-out', source: 'fv-aero-bal', sourceHandle: 'out', target: 'fv-disp-balance', targetHandle: 'value', animated: true },

    // § 4 — Tyre
    { id: 'fv-e-tl-sa',  source: 'fv-tire-sa',   sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'slip_angle', animated: true },
    { id: 'fv-e-tl-Fz',  source: 'fv-tire-Fz',   sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'Fz', animated: true },
    { id: 'fv-e-tl-B',   source: 'fv-tire-B',    sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'B',  animated: true },
    { id: 'fv-e-tl-C',   source: 'fv-tire-C',    sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'C',  animated: true },
    { id: 'fv-e-tl-D',   source: 'fv-tire-D',    sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'D',  animated: true },
    { id: 'fv-e-tl-E',   source: 'fv-tire-E',    sourceHandle: 'out', target: 'fv-tire-lat', targetHandle: 'E',  animated: true },
    { id: 'fv-e-tl-out', source: 'fv-tire-lat',  sourceHandle: 'out', target: 'fv-disp-fy', targetHandle: 'value', animated: true },

    { id: 'fv-e-ts-Fz',  source: 'fv-tire-Fz',   sourceHandle: 'out', target: 'fv-tire-sweep', targetHandle: 'Fz', animated: true },
    { id: 'fv-e-ts-B',   source: 'fv-tire-B',    sourceHandle: 'out', target: 'fv-tire-sweep', targetHandle: 'B',  animated: true },
    { id: 'fv-e-ts-C',   source: 'fv-tire-C',    sourceHandle: 'out', target: 'fv-tire-sweep', targetHandle: 'C',  animated: true },
    { id: 'fv-e-ts-D',   source: 'fv-tire-D',    sourceHandle: 'out', target: 'fv-tire-sweep', targetHandle: 'D',  animated: true },
    { id: 'fv-e-ts-E',   source: 'fv-tire-E',    sourceHandle: 'out', target: 'fv-tire-sweep', targetHandle: 'E',  animated: true },
    { id: 'fv-e-ts-out', source: 'fv-tire-sweep',sourceHandle: 'out', target: 'fv-disp-sweep', targetHandle: 'value', animated: true },

    // § 5 — Brake
    { id: 'fv-e-be-m',   source: 'fv-brk-mass',  sourceHandle: 'out', target: 'fv-brk-energy', targetHandle: 'mass', animated: true },
    { id: 'fv-e-be-v1',  source: 'fv-brk-v1',    sourceHandle: 'out', target: 'fv-brk-energy', targetHandle: 'v1',   animated: true },
    { id: 'fv-e-be-v2',  source: 'fv-brk-v2',    sourceHandle: 'out', target: 'fv-brk-energy', targetHandle: 'v2',   animated: true },
    { id: 'fv-e-be-out', source: 'fv-brk-energy',sourceHandle: 'out', target: 'fv-disp-brk-e', targetHandle: 'value', animated: true },
    { id: 'fv-e-bp-e',   source: 'fv-brk-energy',sourceHandle: 'out', target: 'fv-brk-power',  targetHandle: 'energy', animated: true },
    { id: 'fv-e-bp-dt',  source: 'fv-brk-dt',    sourceHandle: 'out', target: 'fv-brk-power',  targetHandle: 'dt',   animated: true },
    { id: 'fv-e-bp-out', source: 'fv-brk-power', sourceHandle: 'out', target: 'fv-disp-brk-p', targetHandle: 'value', animated: true },

    // § 6 — K&C (no input edges needed — geometry is embedded in block data)
    { id: 'fv-e-kc-out', source: 'fv-kc', sourceHandle: 'out', target: 'fv-disp-kc', targetHandle: 'value', animated: true },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
