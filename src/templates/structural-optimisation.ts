/**
 * structural-optimisation.ts — Structural Optimisation template.
 *
 * 9.11: Minimises beam cross-sectional area (weight proxy) subject to
 *       bending stress and deflection constraints.
 *
 * Hollow circular cross-section: outer radius R, wall thickness t.
 *   A      = π(R² − r²)          — cross-sectional area (r = R − t)
 *   I      = π(R⁴ − r⁴)/4       — second moment of area
 *   Z      = I/R                  — section modulus
 *   σ      = M/Z                  — bending stress (M = PL/4)
 *   δ      = PL³/(48EI)          — central deflection
 *   Mass   = ρ·A·L               — beam mass
 *
 * Default: P=10000 N, L=2 m, E=210e9 Pa, ρ=7850 kg/m³, R=0.05 m, t=0.005 m
 */

import type { CanvasJSON } from '../lib/canvasSchema'

export function buildStructuralOptimisation(canvasId: string, projectId: string): CanvasJSON {
  const nodes = [
    // ── Title annotation ─────────────────────────────────────────────────
    {
      id: 'so-title',
      type: 'csAnnotation',
      position: { x: -20, y: -100 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Structural Optimisation — Hollow Circular Beam\n\nAdjust R (outer radius) and t (wall thickness) to minimise mass\nwhile keeping σ < σ_allow and δ < δ_allow.',
        annotationColor: '#1CABB0',
        annotationFontSize: 13,
        annotationBold: true,
        width: 460,
      },
      style: { width: 460 },
    },

    // ── Load / geometry inputs ────────────────────────────────────────────
    {
      id: 'so-P',
      type: 'csSource',
      position: { x: 0, y: 40 },
      data: { blockType: 'number', label: 'Point load P (N)', value: 10000 },
    },
    {
      id: 'so-L',
      type: 'csSource',
      position: { x: 0, y: 160 },
      data: { blockType: 'number', label: 'Beam length L (m)', value: 2 },
    },
    {
      id: 'so-E',
      type: 'csSource',
      position: { x: 0, y: 280 },
      data: { blockType: 'number', label: "Young's modulus E (Pa)", value: 210e9 },
    },
    {
      id: 'so-rho',
      type: 'csSource',
      position: { x: 0, y: 400 },
      data: { blockType: 'number', label: 'Density ρ (kg/m³)', value: 7850 },
    },

    // ── Design variables ─────────────────────────────────────────────────
    {
      id: 'so-R',
      type: 'csSource',
      position: { x: 0, y: 560 },
      data: { blockType: 'number', label: 'Outer radius R (m)', value: 0.05 },
    },
    {
      id: 'so-t',
      type: 'csSource',
      position: { x: 0, y: 680 },
      data: { blockType: 'number', label: 'Wall thickness t (m)', value: 0.005 },
    },

    // ── Allowable limits ──────────────────────────────────────────────────
    {
      id: 'so-sig-allow',
      type: 'csSource',
      position: { x: 0, y: 840 },
      data: { blockType: 'number', label: 'Allowable stress σ_allow (Pa)', value: 250e6 },
    },
    {
      id: 'so-del-allow',
      type: 'csSource',
      position: { x: 0, y: 960 },
      data: { blockType: 'number', label: 'Allowable deflection δ_allow (m)', value: 0.01 },
    },

    // ── Operations: inner radius r = R - t ───────────────────────────────
    {
      id: 'so-r',
      type: 'csOperation',
      position: { x: 320, y: 600 },
      data: { blockType: 'math.sub', label: 'r = R − t' },
    },

    // ── Operations: geometry ─────────────────────────────────────────────
    {
      id: 'so-R2',
      type: 'csOperation',
      position: { x: 320, y: 720 },
      data: { blockType: 'math.pow', label: 'R²' },
    },
    {
      id: 'so-r2',
      type: 'csOperation',
      position: { x: 320, y: 820 },
      data: { blockType: 'math.pow', label: 'r²' },
    },
    {
      id: 'so-A-diff',
      type: 'csOperation',
      position: { x: 320, y: 920 },
      data: { blockType: 'math.sub', label: 'R² − r²' },
    },
    {
      id: 'so-pi',
      type: 'csSource',
      position: { x: 140, y: 1020 },
      data: { blockType: 'number', label: 'π', value: Math.PI },
    },
    {
      id: 'so-A',
      type: 'csOperation',
      position: { x: 320, y: 1020 },
      data: { blockType: 'math.mul', label: 'A = π(R²−r²)' },
    },

    // ── Operations: second moment of area I = π(R⁴−r⁴)/4 ────────────────
    {
      id: 'so-R4',
      type: 'csOperation',
      position: { x: 320, y: 1140 },
      data: { blockType: 'math.pow', label: 'R⁴' },
    },
    {
      id: 'so-r4',
      type: 'csOperation',
      position: { x: 320, y: 1240 },
      data: { blockType: 'math.pow', label: 'r⁴' },
    },
    {
      id: 'so-I-diff',
      type: 'csOperation',
      position: { x: 320, y: 1340 },
      data: { blockType: 'math.sub', label: 'R⁴ − r⁴' },
    },
    {
      id: 'so-I-num',
      type: 'csOperation',
      position: { x: 320, y: 1440 },
      data: { blockType: 'math.mul', label: 'π(R⁴−r⁴)' },
    },
    {
      id: 'so-four',
      type: 'csSource',
      position: { x: 140, y: 1540 },
      data: { blockType: 'number', label: '4', value: 4 },
    },
    {
      id: 'so-I',
      type: 'csOperation',
      position: { x: 320, y: 1540 },
      data: { blockType: 'math.div', label: 'I = π(R⁴−r⁴)/4' },
    },

    // ── Operations: section modulus Z = I/R ──────────────────────────────
    {
      id: 'so-Z',
      type: 'csOperation',
      position: { x: 320, y: 1660 },
      data: { blockType: 'math.div', label: 'Z = I/R' },
    },

    // ── Operations: bending moment M = PL/4 ──────────────────────────────
    {
      id: 'so-PL',
      type: 'csOperation',
      position: { x: 320, y: 80 },
      data: { blockType: 'math.mul', label: 'P·L' },
    },
    {
      id: 'so-M',
      type: 'csOperation',
      position: { x: 320, y: 180 },
      data: { blockType: 'math.div', label: 'M = PL/4' },
    },
    {
      id: 'so-four2',
      type: 'csSource',
      position: { x: 140, y: 180 },
      data: { blockType: 'number', label: '4', value: 4 },
    },

    // ── Operations: bending stress σ = M/Z ───────────────────────────────
    {
      id: 'so-sigma',
      type: 'csOperation',
      position: { x: 320, y: 1760 },
      data: { blockType: 'math.div', label: 'σ = M/Z' },
    },

    // ── Operations: deflection δ = PL³/(48EI) ────────────────────────────
    {
      id: 'so-L3',
      type: 'csOperation',
      position: { x: 320, y: 280 },
      data: { blockType: 'math.pow', label: 'L³' },
    },
    {
      id: 'so-PL3',
      type: 'csOperation',
      position: { x: 320, y: 380 },
      data: { blockType: 'math.mul', label: 'P·L³' },
    },
    {
      id: 'so-EI',
      type: 'csOperation',
      position: { x: 320, y: 480 },
      data: { blockType: 'math.mul', label: '48·E·I' },
    },
    {
      id: 'so-48',
      type: 'csSource',
      position: { x: 140, y: 480 },
      data: { blockType: 'number', label: '48', value: 48 },
    },
    {
      id: 'so-48EI',
      type: 'csOperation',
      position: { x: 320, y: 560 },
      data: { blockType: 'math.mul', label: '48EI' },
    },
    {
      id: 'so-delta',
      type: 'csOperation',
      position: { x: 320, y: 1860 },
      data: { blockType: 'math.div', label: 'δ = PL³/(48EI)' },
    },

    // ── Operations: mass = ρ·A·L ─────────────────────────────────────────
    {
      id: 'so-rhoA',
      type: 'csOperation',
      position: { x: 320, y: 1960 },
      data: { blockType: 'math.mul', label: 'ρ·A' },
    },
    {
      id: 'so-mass',
      type: 'csOperation',
      position: { x: 320, y: 2060 },
      data: { blockType: 'math.mul', label: 'Mass = ρ·A·L' },
    },

    // ── Displays ──────────────────────────────────────────────────────────
    {
      id: 'so-disp-A',
      type: 'csDisplay',
      position: { x: 580, y: 1020 },
      data: { blockType: 'display', label: 'Area A (m²)' },
    },
    {
      id: 'so-disp-I',
      type: 'csDisplay',
      position: { x: 580, y: 1540 },
      data: { blockType: 'display', label: 'Second moment I (m⁴)' },
    },
    {
      id: 'so-disp-sigma',
      type: 'csDisplay',
      position: { x: 580, y: 1760 },
      data: { blockType: 'display', label: 'Bending stress σ (Pa)' },
    },
    {
      id: 'so-disp-delta',
      type: 'csDisplay',
      position: { x: 580, y: 1860 },
      data: { blockType: 'display', label: 'Deflection δ (m)' },
    },
    {
      id: 'so-disp-mass',
      type: 'csDisplay',
      position: { x: 580, y: 2060 },
      data: { blockType: 'display', label: 'Beam mass (kg)' },
    },

    // ── Guidance annotation ───────────────────────────────────────────────
    {
      id: 'so-ann2',
      type: 'csAnnotation',
      position: { x: 0, y: 1080 },
      data: {
        blockType: '__annotation__',
        label: '',
        annotationType: 'text',
        annotationText:
          'Optimisation goal: minimise Mass\nConstraints: σ < σ_allow (250 MPa), δ < δ_allow (10 mm)\n\nTry:\n• Increase R → lower σ & δ but heavier\n• Decrease t → lighter but weaker\n• Find the smallest R,t where constraints are just satisfied',
        annotationColor: '#fb923c',
        annotationFontSize: 11,
        width: 700,
      },
      style: { width: 700 },
    },
  ]

  const edges = [
    // r = R - t
    { id: 'so-re1', source: 'so-R', sourceHandle: 'out', target: 'so-r', targetHandle: 'a' },
    { id: 'so-re2', source: 'so-t', sourceHandle: 'out', target: 'so-r', targetHandle: 'b' },
    // R²
    { id: 'so-re3', source: 'so-R', sourceHandle: 'out', target: 'so-R2', targetHandle: 'base' },
    { id: 'so-re4', source: 'so-R', sourceHandle: 'out', target: 'so-R2', targetHandle: 'exp' }, // pow(R,2) — will use constant 2
    // r²
    { id: 'so-re5', source: 'so-r', sourceHandle: 'out', target: 'so-r2', targetHandle: 'base' },
    { id: 'so-re6', source: 'so-r', sourceHandle: 'out', target: 'so-r2', targetHandle: 'exp' },
    // A = π(R²−r²)
    { id: 'so-re7', source: 'so-R2', sourceHandle: 'out', target: 'so-A-diff', targetHandle: 'a' },
    { id: 'so-re8', source: 'so-r2', sourceHandle: 'out', target: 'so-A-diff', targetHandle: 'b' },
    { id: 'so-re9', source: 'so-pi', sourceHandle: 'out', target: 'so-A', targetHandle: 'in_0' },
    {
      id: 'so-re10',
      source: 'so-A-diff',
      sourceHandle: 'out',
      target: 'so-A',
      targetHandle: 'in_1',
    },
    {
      id: 'so-re11',
      source: 'so-A',
      sourceHandle: 'out',
      target: 'so-disp-A',
      targetHandle: 'value',
    },
    // R⁴
    { id: 'so-re12', source: 'so-R', sourceHandle: 'out', target: 'so-R4', targetHandle: 'base' },
    { id: 'so-re13', source: 'so-R', sourceHandle: 'out', target: 'so-R4', targetHandle: 'exp' },
    // r⁴
    { id: 'so-re14', source: 'so-r', sourceHandle: 'out', target: 'so-r4', targetHandle: 'base' },
    { id: 'so-re15', source: 'so-r', sourceHandle: 'out', target: 'so-r4', targetHandle: 'exp' },
    // I
    { id: 'so-re16', source: 'so-R4', sourceHandle: 'out', target: 'so-I-diff', targetHandle: 'a' },
    { id: 'so-re17', source: 'so-r4', sourceHandle: 'out', target: 'so-I-diff', targetHandle: 'b' },
    {
      id: 'so-re18',
      source: 'so-pi',
      sourceHandle: 'out',
      target: 'so-I-num',
      targetHandle: 'in_0',
    },
    {
      id: 'so-re19',
      source: 'so-I-diff',
      sourceHandle: 'out',
      target: 'so-I-num',
      targetHandle: 'in_1',
    },
    { id: 'so-re20', source: 'so-I-num', sourceHandle: 'out', target: 'so-I', targetHandle: 'a' },
    { id: 'so-re21', source: 'so-four', sourceHandle: 'out', target: 'so-I', targetHandle: 'b' },
    {
      id: 'so-re22',
      source: 'so-I',
      sourceHandle: 'out',
      target: 'so-disp-I',
      targetHandle: 'value',
    },
    // Z = I/R
    { id: 'so-re23', source: 'so-I', sourceHandle: 'out', target: 'so-Z', targetHandle: 'a' },
    { id: 'so-re24', source: 'so-R', sourceHandle: 'out', target: 'so-Z', targetHandle: 'b' },
    // M = PL/4
    { id: 'so-re25', source: 'so-P', sourceHandle: 'out', target: 'so-PL', targetHandle: 'in_0' },
    { id: 'so-re26', source: 'so-L', sourceHandle: 'out', target: 'so-PL', targetHandle: 'in_1' },
    { id: 'so-re27', source: 'so-PL', sourceHandle: 'out', target: 'so-M', targetHandle: 'a' },
    { id: 'so-re28', source: 'so-four2', sourceHandle: 'out', target: 'so-M', targetHandle: 'b' },
    // σ = M/Z
    { id: 'so-re29', source: 'so-M', sourceHandle: 'out', target: 'so-sigma', targetHandle: 'a' },
    { id: 'so-re30', source: 'so-Z', sourceHandle: 'out', target: 'so-sigma', targetHandle: 'b' },
    {
      id: 'so-re31',
      source: 'so-sigma',
      sourceHandle: 'out',
      target: 'so-disp-sigma',
      targetHandle: 'value',
    },
    // δ = PL³/(48EI)
    { id: 'so-re32', source: 'so-L', sourceHandle: 'out', target: 'so-L3', targetHandle: 'base' },
    { id: 'so-re33', source: 'so-L', sourceHandle: 'out', target: 'so-L3', targetHandle: 'exp' },
    { id: 'so-re34', source: 'so-P', sourceHandle: 'out', target: 'so-PL3', targetHandle: 'in_0' },
    { id: 'so-re35', source: 'so-L3', sourceHandle: 'out', target: 'so-PL3', targetHandle: 'in_1' },
    { id: 'so-re36', source: 'so-48', sourceHandle: 'out', target: 'so-EI', targetHandle: 'in_0' },
    { id: 'so-re37', source: 'so-E', sourceHandle: 'out', target: 'so-EI', targetHandle: 'in_1' },
    {
      id: 'so-re38',
      source: 'so-EI',
      sourceHandle: 'out',
      target: 'so-48EI',
      targetHandle: 'in_0',
    },
    { id: 'so-re39', source: 'so-I', sourceHandle: 'out', target: 'so-48EI', targetHandle: 'in_1' },
    { id: 'so-re40', source: 'so-PL3', sourceHandle: 'out', target: 'so-delta', targetHandle: 'a' },
    {
      id: 'so-re41',
      source: 'so-48EI',
      sourceHandle: 'out',
      target: 'so-delta',
      targetHandle: 'b',
    },
    {
      id: 'so-re42',
      source: 'so-delta',
      sourceHandle: 'out',
      target: 'so-disp-delta',
      targetHandle: 'value',
    },
    // mass = ρ·A·L
    {
      id: 'so-re43',
      source: 'so-rho',
      sourceHandle: 'out',
      target: 'so-rhoA',
      targetHandle: 'in_0',
    },
    { id: 'so-re44', source: 'so-A', sourceHandle: 'out', target: 'so-rhoA', targetHandle: 'in_1' },
    {
      id: 'so-re45',
      source: 'so-rhoA',
      sourceHandle: 'out',
      target: 'so-mass',
      targetHandle: 'in_0',
    },
    { id: 'so-re46', source: 'so-L', sourceHandle: 'out', target: 'so-mass', targetHandle: 'in_1' },
    {
      id: 'so-re47',
      source: 'so-mass',
      sourceHandle: 'out',
      target: 'so-disp-mass',
      targetHandle: 'value',
    },
  ]

  return { schemaVersion: 4, canvasId, projectId, nodes, edges, datasetRefs: [] }
}
