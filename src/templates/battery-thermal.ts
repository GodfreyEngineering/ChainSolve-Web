/**
 * battery-thermal.ts — Battery Thermal Model template.
 *
 * 9.11: Lumped thermal model of a lithium-ion cell during discharge.
 *
 * Heat generation:  Q_gen  = I²·R_int          — Joule heating (W)
 * Convective loss:  Q_loss = h·A·(T_cell − T_amb) — Newton cooling (W)
 * Net power:        Q_net  = Q_gen − Q_loss     — net heat rate (W)
 * Temperature rise: ΔT     = Q_net·t / (m·Cp)  — lumped ΔT (°C)
 * Cell temperature: T_cell = T_amb + ΔT         — final temperature (°C)
 *
 * Default: I=20 A, R_int=0.005 Ω, h=10 W/(m²K), A=0.02 m², T_amb=25 °C,
 *          m=0.045 kg, Cp=900 J/(kg·K), t=600 s (10 min discharge)
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildBatteryThermal(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ─────────────────────────────────────────────────
    {
      id: 'bt-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Battery Thermal Model\n\nLumped-capacitance model for a Li-ion cell during discharge.\nQ_gen = I²·R_int (Joule heat), Q_loss = h·A·ΔT_conv (cooling).\nΔT = (Q_gen − Q_loss)·t / (m·Cp)',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 480,
      },
      style: { width: 480 },
    },

    // ── Electrical inputs ─────────────────────────────────────────────────
    { id: 'bt-I', type: 'csSource', position: { x: 0, y: 40 }, data: { blockType: 'number', label: 'Discharge current I (A)', value: 20 } },
    { id: 'bt-Rint', type: 'csSource', position: { x: 0, y: 160 }, data: { blockType: 'number', label: 'Internal resistance R_int (Ω)', value: 0.005 } },

    // ── Thermal inputs ────────────────────────────────────────────────────
    { id: 'bt-h', type: 'csSource', position: { x: 0, y: 320 }, data: { blockType: 'number', label: 'Conv. coeff h (W/m²K)', value: 10 } },
    { id: 'bt-A', type: 'csSource', position: { x: 0, y: 440 }, data: { blockType: 'number', label: 'Surface area A (m²)', value: 0.02 } },
    { id: 'bt-Tamb', type: 'csSource', position: { x: 0, y: 560 }, data: { blockType: 'number', label: 'Ambient temp T_amb (°C)', value: 25 } },
    { id: 'bt-m', type: 'csSource', position: { x: 0, y: 680 }, data: { blockType: 'number', label: 'Cell mass m (kg)', value: 0.045 } },
    { id: 'bt-Cp', type: 'csSource', position: { x: 0, y: 800 }, data: { blockType: 'number', label: 'Specific heat Cp (J/kg·K)', value: 900 } },
    { id: 'bt-t', type: 'csSource', position: { x: 0, y: 920 }, data: { blockType: 'number', label: 'Discharge time t (s)', value: 600 } },

    // ── Operations: Q_gen = I²·R_int ─────────────────────────────────────
    { id: 'bt-I2', type: 'csOperation', position: { x: 320, y: 80 }, data: { blockType: 'math.pow', label: 'I²' } },
    { id: 'bt-Qgen', type: 'csOperation', position: { x: 320, y: 180 }, data: { blockType: 'math.mul', label: 'Q_gen = I²·R_int' } },

    // ── Operations: Q_loss = h·A·(T_cell − T_amb) ────────────────────────
    // (first pass uses T_amb as T_cell estimate — open-loop ΔT)
    { id: 'bt-hA', type: 'csOperation', position: { x: 320, y: 360 }, data: { blockType: 'math.mul', label: 'h·A' } },
    { id: 'bt-Qgen-half', type: 'csOperation', position: { x: 320, y: 460 }, data: { blockType: 'math.mul', label: 'Q_net·t' } }, // placeholder label, reused below
    // estimate ΔT from Q_gen only for cooling calc
    { id: 'bt-mCp', type: 'csOperation', position: { x: 320, y: 560 }, data: { blockType: 'math.mul', label: 'm·Cp' } },
    { id: 'bt-dT-est', type: 'csOperation', position: { x: 320, y: 660 }, data: { blockType: 'math.div', label: 'ΔT_est = Q_gen·t/(m·Cp)' } },
    { id: 'bt-Qgen-t', type: 'csOperation', position: { x: 160, y: 660 }, data: { blockType: 'math.mul', label: 'Q_gen·t' } },
    // cooling loss based on ΔT_est
    { id: 'bt-Qloss', type: 'csOperation', position: { x: 320, y: 780 }, data: { blockType: 'math.mul', label: 'Q_loss = h·A·ΔT_est' } },

    // ── Operations: Q_net = Q_gen − Q_loss ───────────────────────────────
    { id: 'bt-Qnet', type: 'csOperation', position: { x: 320, y: 900 }, data: { blockType: 'math.sub', label: 'Q_net = Q_gen − Q_loss' } },

    // ── Operations: ΔT = Q_net·t / (m·Cp) ───────────────────────────────
    { id: 'bt-Qnet-t', type: 'csOperation', position: { x: 320, y: 1020 }, data: { blockType: 'math.mul', label: 'Q_net·t' } },
    { id: 'bt-dT', type: 'csOperation', position: { x: 320, y: 1120 }, data: { blockType: 'math.div', label: 'ΔT = Q_net·t/(m·Cp)' } },

    // ── Operations: T_cell = T_amb + ΔT ──────────────────────────────────
    { id: 'bt-Tcell', type: 'csOperation', position: { x: 320, y: 1240 }, data: { blockType: 'math.add', label: 'T_cell = T_amb + ΔT' } },

    // ── Displays ──────────────────────────────────────────────────────────
    { id: 'bt-disp-Qgen', type: 'csDisplay', position: { x: 580, y: 180 }, data: { blockType: 'display', label: 'Heat gen Q_gen (W)' } },
    { id: 'bt-disp-Qloss', type: 'csDisplay', position: { x: 580, y: 780 }, data: { blockType: 'display', label: 'Cooling Q_loss (W)' } },
    { id: 'bt-disp-Qnet', type: 'csDisplay', position: { x: 580, y: 900 }, data: { blockType: 'display', label: 'Net heat rate Q_net (W)' } },
    { id: 'bt-disp-dT', type: 'csDisplay', position: { x: 580, y: 1120 }, data: { blockType: 'display', label: 'Temperature rise ΔT (°C)' } },
    { id: 'bt-disp-Tcell', type: 'csDisplay', position: { x: 580, y: 1240 }, data: { blockType: 'display', label: 'Cell temp T_cell (°C)' } },

    // ── Constant 2 for squaring ───────────────────────────────────────────
    { id: 'bt-two', type: 'csSource', position: { x: 140, y: 80 }, data: { blockType: 'number', label: '2', value: 2 } },

    // ── Guidance annotation ───────────────────────────────────────────────
    {
      id: 'bt-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 1320 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Try it:\n• Increase I → Q_gen grows as I² (quadratic!)\n• Increase h or A → more cooling, lower T_cell\n• Safety limit: T_cell < 60 °C for typical Li-ion\n• At I=20A, R=5mΩ → Q_gen = 2 W. Adjust to see thermal runaway risk.',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // Q_gen = I²·R_int
    { id: 'bt-e1', source: 'bt-I', sourceHandle: 'out', target: 'bt-I2', targetHandle: 'base' },
    { id: 'bt-e2', source: 'bt-two', sourceHandle: 'out', target: 'bt-I2', targetHandle: 'exp' },
    { id: 'bt-e3', source: 'bt-I2', sourceHandle: 'out', target: 'bt-Qgen', targetHandle: 'in_0' },
    { id: 'bt-e4', source: 'bt-Rint', sourceHandle: 'out', target: 'bt-Qgen', targetHandle: 'in_1' },
    { id: 'bt-e5', source: 'bt-Qgen', sourceHandle: 'out', target: 'bt-disp-Qgen', targetHandle: 'value' },
    // h·A
    { id: 'bt-e6', source: 'bt-h', sourceHandle: 'out', target: 'bt-hA', targetHandle: 'in_0' },
    { id: 'bt-e7', source: 'bt-A', sourceHandle: 'out', target: 'bt-hA', targetHandle: 'in_1' },
    // ΔT estimate (from Q_gen only) for cooling calc
    { id: 'bt-e8', source: 'bt-Qgen', sourceHandle: 'out', target: 'bt-Qgen-t', targetHandle: 'in_0' },
    { id: 'bt-e9', source: 'bt-t', sourceHandle: 'out', target: 'bt-Qgen-t', targetHandle: 'in_1' },
    { id: 'bt-e10', source: 'bt-m', sourceHandle: 'out', target: 'bt-mCp', targetHandle: 'in_0' },
    { id: 'bt-e11', source: 'bt-Cp', sourceHandle: 'out', target: 'bt-mCp', targetHandle: 'in_1' },
    { id: 'bt-e12', source: 'bt-Qgen-t', sourceHandle: 'out', target: 'bt-dT-est', targetHandle: 'a' },
    { id: 'bt-e13', source: 'bt-mCp', sourceHandle: 'out', target: 'bt-dT-est', targetHandle: 'b' },
    // Q_loss = h·A·ΔT_est
    { id: 'bt-e14', source: 'bt-hA', sourceHandle: 'out', target: 'bt-Qloss', targetHandle: 'in_0' },
    { id: 'bt-e15', source: 'bt-dT-est', sourceHandle: 'out', target: 'bt-Qloss', targetHandle: 'in_1' },
    { id: 'bt-e16', source: 'bt-Qloss', sourceHandle: 'out', target: 'bt-disp-Qloss', targetHandle: 'value' },
    // Q_net = Q_gen − Q_loss
    { id: 'bt-e17', source: 'bt-Qgen', sourceHandle: 'out', target: 'bt-Qnet', targetHandle: 'a' },
    { id: 'bt-e18', source: 'bt-Qloss', sourceHandle: 'out', target: 'bt-Qnet', targetHandle: 'b' },
    { id: 'bt-e19', source: 'bt-Qnet', sourceHandle: 'out', target: 'bt-disp-Qnet', targetHandle: 'value' },
    // ΔT = Q_net·t / (m·Cp)
    { id: 'bt-e20', source: 'bt-Qnet', sourceHandle: 'out', target: 'bt-Qnet-t', targetHandle: 'in_0' },
    { id: 'bt-e21', source: 'bt-t', sourceHandle: 'out', target: 'bt-Qnet-t', targetHandle: 'in_1' },
    { id: 'bt-e22', source: 'bt-Qnet-t', sourceHandle: 'out', target: 'bt-dT', targetHandle: 'a' },
    { id: 'bt-e23', source: 'bt-mCp', sourceHandle: 'out', target: 'bt-dT', targetHandle: 'b' },
    { id: 'bt-e24', source: 'bt-dT', sourceHandle: 'out', target: 'bt-disp-dT', targetHandle: 'value' },
    // T_cell = T_amb + ΔT
    { id: 'bt-e25', source: 'bt-Tamb', sourceHandle: 'out', target: 'bt-Tcell', targetHandle: 'in_0' },
    { id: 'bt-e26', source: 'bt-dT', sourceHandle: 'out', target: 'bt-Tcell', targetHandle: 'in_1' },
    { id: 'bt-e27', source: 'bt-Tcell', sourceHandle: 'out', target: 'bt-disp-Tcell', targetHandle: 'value' },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
