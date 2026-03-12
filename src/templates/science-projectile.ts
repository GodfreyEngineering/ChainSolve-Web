/**
 * science-projectile.ts — Projectile Motion template.
 *
 * Computes the range of a projectile:
 *   R = v₀² · sin(2θ) / g
 *
 * where:
 *   v₀   = initial velocity (m/s)
 *   θ    = launch angle (degrees, converted to radians)
 *   g    = gravitational acceleration (m/s²)
 *
 * Default values: v₀ = 50 m/s, θ = 45°, g = 9.81 m/s²
 *   → R ≈ 254.84 m
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildScienceProjectile(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Inputs ────────────────────────────────────────────────────────
    {
      id: 'proj-v0',
      type: 'number',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Initial velocity v₀ (m/s)', value: 50 },
    },
    {
      id: 'proj-angle',
      type: 'number',
      position: { x: 0, y: 120 },
      data: { blockType: 'number', label: 'Angle θ (degrees)', value: 45 },
    },
    {
      id: 'proj-g',
      type: 'number',
      position: { x: 0, y: 240 },
      data: { blockType: 'number', label: 'Gravity g (m/s²)', value: 9.81 },
    },
    // deg→rad conversion factor: π/180
    {
      id: 'proj-pi180',
      type: 'number',
      position: { x: 0, y: 360 },
      data: { blockType: 'number', label: 'π/180', value: 0.017453292519943295 },
    },
    // constant 2 (for 2θ and v₀²)
    {
      id: 'proj-two',
      type: 'number',
      position: { x: 0, y: 480 },
      data: { blockType: 'number', label: '2', value: 2 },
    },

    // ── Operations ────────────────────────────────────────────────────
    // v0squared = v₀ * v₀
    {
      id: 'proj-v0sq',
      type: 'multiply',
      position: { x: 240, y: 0 },
      data: { blockType: 'multiply', label: 'v₀²' },
    },
    // theta_rad = angle * (π/180)
    {
      id: 'proj-deg2rad',
      type: 'multiply',
      position: { x: 240, y: 120 },
      data: { blockType: 'multiply', label: 'θ (rad)' },
    },
    // two_theta = 2 * theta_rad
    {
      id: 'proj-2theta',
      type: 'multiply',
      position: { x: 440, y: 120 },
      data: { blockType: 'multiply', label: '2θ' },
    },
    // sin2theta = sin(2θ)
    {
      id: 'proj-sin2theta',
      type: 'sin',
      position: { x: 640, y: 120 },
      data: { blockType: 'sin', label: 'sin(2θ)' },
    },
    // numerator = v0sq * sin(2θ)
    {
      id: 'proj-numer',
      type: 'multiply',
      position: { x: 840, y: 60 },
      data: { blockType: 'multiply', label: 'v₀²·sin(2θ)' },
    },
    // range = numerator / g
    {
      id: 'proj-range',
      type: 'divide',
      position: { x: 1040, y: 60 },
      data: { blockType: 'divide', label: 'R = v₀²·sin(2θ)/g' },
    },

    // ── Output ────────────────────────────────────────────────────────
    {
      id: 'proj-disp',
      type: 'display',
      position: { x: 1240, y: 60 },
      data: { blockType: 'display', label: 'Range R (m)' },
    },
  ]

  const edges = [
    // v0squared = v₀ * v₀
    {
      id: 'proj-e1',
      source: 'proj-v0',
      sourceHandle: 'out',
      target: 'proj-v0sq',
      targetHandle: 'a',
    },
    {
      id: 'proj-e2',
      source: 'proj-v0',
      sourceHandle: 'out',
      target: 'proj-v0sq',
      targetHandle: 'b',
    },
    // theta_rad = angle * (π/180)
    {
      id: 'proj-e3',
      source: 'proj-angle',
      sourceHandle: 'out',
      target: 'proj-deg2rad',
      targetHandle: 'a',
    },
    {
      id: 'proj-e4',
      source: 'proj-pi180',
      sourceHandle: 'out',
      target: 'proj-deg2rad',
      targetHandle: 'b',
    },
    // two_theta = 2 * theta_rad
    {
      id: 'proj-e5',
      source: 'proj-two',
      sourceHandle: 'out',
      target: 'proj-2theta',
      targetHandle: 'a',
    },
    {
      id: 'proj-e6',
      source: 'proj-deg2rad',
      sourceHandle: 'out',
      target: 'proj-2theta',
      targetHandle: 'b',
    },
    // sin(2θ)
    {
      id: 'proj-e7',
      source: 'proj-2theta',
      sourceHandle: 'out',
      target: 'proj-sin2theta',
      targetHandle: 'a',
    },
    // numerator = v0sq * sin(2θ)
    {
      id: 'proj-e8',
      source: 'proj-v0sq',
      sourceHandle: 'out',
      target: 'proj-numer',
      targetHandle: 'a',
    },
    {
      id: 'proj-e9',
      source: 'proj-sin2theta',
      sourceHandle: 'out',
      target: 'proj-numer',
      targetHandle: 'b',
    },
    // range = numerator / g
    {
      id: 'proj-e10',
      source: 'proj-numer',
      sourceHandle: 'out',
      target: 'proj-range',
      targetHandle: 'a',
    },
    {
      id: 'proj-e11',
      source: 'proj-g',
      sourceHandle: 'out',
      target: 'proj-range',
      targetHandle: 'b',
    },
    // display
    {
      id: 'proj-e12',
      source: 'proj-range',
      sourceHandle: 'out',
      target: 'proj-disp',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
