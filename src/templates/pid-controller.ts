/**
 * pid-controller.ts — PID Controller Tuning template.
 *
 * 9.11: Demonstrates PID output computation with error and integral inputs.
 *
 * P = Kp × e(t)
 * I = Ki × ∫e dt
 * D = Kd × Δe/Δt
 * u = P + I + D
 *
 * Default: Kp=1, Ki=0.1, Kd=0.05, e=1, ∫e=0, Δt=0.01
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildPidController(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ──────────────────────────────────────────────────────────
    { id: 'pid-kp', type: 'csSource', position: { x: 0, y: 0 }, data: { blockType: 'number', label: 'Kp (proportional gain)', value: 1 } },
    { id: 'pid-ki', type: 'csSource', position: { x: 0, y: 100 }, data: { blockType: 'number', label: 'Ki (integral gain)', value: 0.1 } },
    { id: 'pid-kd', type: 'csSource', position: { x: 0, y: 200 }, data: { blockType: 'number', label: 'Kd (derivative gain)', value: 0.05 } },
    { id: 'pid-error', type: 'csSource', position: { x: 0, y: 320 }, data: { blockType: 'number', label: 'Error e(t)', value: 1 } },
    { id: 'pid-integral', type: 'csSource', position: { x: 0, y: 420 }, data: { blockType: 'number', label: 'Integral ∫e dt', value: 0 } },
    { id: 'pid-dt', type: 'csSource', position: { x: 0, y: 520 }, data: { blockType: 'number', label: 'Time step Δt (s)', value: 0.01 } },

    // ── PID block ────────────────────────────────────────────────────────
    { id: 'pid-out', type: 'csOperation', position: { x: 280, y: 240 }, data: { blockType: 'ctrl.pid_output', label: 'PID Output u(t)' } },

    // ── Display ──────────────────────────────────────────────────────────
    { id: 'pid-disp', type: 'csDisplay', position: { x: 500, y: 240 }, data: { blockType: 'display', label: 'Control output u(t)' } },

    // ── Annotation ───────────────────────────────────────────────────────
    {
      id: 'pid-ann',
      type: 'csAnnotation',
      position: { x: 0, y: -80 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText: 'PID Controller\n\nu(t) = Kp·e(t) + Ki·∫e dt + Kd·Δe/Δt\n\nAdjust gains Kp, Ki, Kd to tune response.\nConnect real error signal from a simulation for closed-loop tuning.',
        annotationColor: '#1CABB0',
        annotationFontSize: 12,
        width: 400,
      },
      style: { width: 400 },
    },
  ]

  const edges = [
    { id: 'pid-e1', source: 'pid-kp', sourceHandle: 'out', target: 'pid-out', targetHandle: 'Kp' },
    { id: 'pid-e2', source: 'pid-ki', sourceHandle: 'out', target: 'pid-out', targetHandle: 'Ki' },
    { id: 'pid-e3', source: 'pid-kd', sourceHandle: 'out', target: 'pid-out', targetHandle: 'Kd' },
    { id: 'pid-e4', source: 'pid-error', sourceHandle: 'out', target: 'pid-out', targetHandle: 'error' },
    { id: 'pid-e5', source: 'pid-integral', sourceHandle: 'out', target: 'pid-out', targetHandle: 'integral' },
    { id: 'pid-e6', source: 'pid-dt', sourceHandle: 'out', target: 'pid-out', targetHandle: 'dt' },
    { id: 'pid-e7', source: 'pid-out', sourceHandle: 'out', target: 'pid-disp', targetHandle: 'value' },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
