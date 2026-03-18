/**
 * SurfacePlot — 6.9: 3D surface plot renderer using HTML Canvas 2D.
 *
 * Renders a matrix of z-values as a 3D surface with:
 *  - Perspective projection (no Three.js dependency)
 *  - Mouse-drag rotation (azimuth + elevation)
 *  - Viridis-like colormap by z value
 *  - Wireframe toggle
 *  - Painter's algorithm face sorting for correct depth ordering
 *
 * Input:
 *   TableValue  — each row is an x-slice, each column is a y-slice.
 *                 All values are z heights.
 *
 *   The rendered grid is (rows - 1) × (cols - 1) quad patches.
 *   If the table has only 1 row or 1 column no surface can be drawn.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TableValue } from '../../engine/value'

// ── Colormap ──────────────────────────────────────────────────────────────────

/** Viridis-like colormap: t ∈ [0,1] → [r,g,b] each 0-255. */
function viridis(t: number): [number, number, number] {
  // Key colour stops (viridis palette approximation)
  const stops: [number, number, number, number][] = [
    [0.0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1.0, 253, 231, 37],
  ]
  const clamped = Math.max(0, Math.min(1, t))
  let lo = stops[0]
  let hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lo = stops[i]
      hi = stops[i + 1]
      break
    }
  }
  const span = hi[0] - lo[0]
  const f = span === 0 ? 0 : (clamped - lo[0]) / span
  return [
    Math.round(lo[1] + f * (hi[1] - lo[1])),
    Math.round(lo[2] + f * (hi[2] - lo[2])),
    Math.round(lo[3] + f * (hi[3] - lo[3])),
  ]
}

function rgbStr(r: number, g: number, b: number, a = 1): string {
  return `rgba(${r},${g},${b},${a})`
}

// ── Projection ────────────────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }

function rotateX(v: Vec3, c: number, s: number): Vec3 {
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}
function rotateZ(v: Vec3, c: number, s: number): Vec3 {
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z }
}

/** Simple perspective projection to 2D. */
function project(v: Vec3, fov: number, cx: number, cy: number): [number, number] {
  const d = fov / (fov + v.z + 4)
  return [cx + v.x * d * fov, cy - v.y * d * fov]
}

// ── Renderer ──────────────────────────────────────────────────────────────────

interface Quad {
  pts: Vec3[]
  zAvg: number
  t: number // normalised z for colormap
}

function buildQuads(rows: readonly (readonly number[])[]): Quad[] | null {
  const R = rows.length
  const C = rows[0]?.length ?? 0
  if (R < 2 || C < 2) return null

  // Normalise to [-1, 1] in x and y, z scaled proportionally
  let zMin = Infinity
  let zMax = -Infinity
  for (const row of rows) {
    for (const z of row) {
      if (z < zMin) zMin = z
      if (z > zMax) zMax = z
    }
  }
  const zRange = zMax - zMin || 1

  const pts3d: Vec3[][] = []
  for (let r = 0; r < R; r++) {
    pts3d.push([])
    for (let c = 0; c < C; c++) {
      pts3d[r].push({
        x: (c / (C - 1)) * 2 - 1,
        y: (r / (R - 1)) * 2 - 1,
        z: ((rows[r][c] - zMin) / zRange) * 1.4 - 0.7,
      })
    }
  }

  const quads: Quad[] = []
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const p0 = pts3d[r][c]
      const p1 = pts3d[r][c + 1]
      const p2 = pts3d[r + 1][c + 1]
      const p3 = pts3d[r + 1][c]
      const zAvg = (p0.z + p1.z + p2.z + p3.z) / 4
      quads.push({
        pts: [p0, p1, p2, p3],
        zAvg,
        t: (zAvg - (-0.7)) / 1.4,
      })
    }
  }
  return quads
}

function renderSurface(
  ctx: CanvasRenderingContext2D,
  quads: Quad[],
  azimuth: number,
  elevation: number,
  width: number,
  height: number,
  wireframe: boolean,
) {
  ctx.clearRect(0, 0, width, height)

  const cosA = Math.cos(azimuth)
  const sinA = Math.sin(azimuth)
  const cosE = Math.cos(elevation)
  const sinE = Math.sin(elevation)

  const fov = 2.2
  const cx = width / 2
  const cy = height / 2

  type DrawQuad = { screen: [number, number][]; zAvg: number; t: number }
  const draws: DrawQuad[] = []

  for (const q of quads) {
    // Apply azimuth rotation (around Z) then elevation (around X)
    const rotated = q.pts.map((p) => {
      const rz = rotateZ(p, cosA, sinA)
      return rotateX(rz, cosE, sinE)
    })
    const screen = rotated.map((p) => project(p, fov, cx, cy)) as [number, number][]
    draws.push({ screen, zAvg: rotated.reduce((s, p) => s + p.z, 0) / 4, t: q.t })
  }

  // Painter's algorithm: draw back-to-front
  draws.sort((a, b) => a.zAvg - b.zAvg)

  for (const d of draws) {
    const [r, g, b] = viridis(d.t)
    ctx.beginPath()
    ctx.moveTo(d.screen[0][0], d.screen[0][1])
    for (let i = 1; i < 4; i++) ctx.lineTo(d.screen[i][0], d.screen[i][1])
    ctx.closePath()

    if (!wireframe) {
      ctx.fillStyle = rgbStr(r, g, b, 0.85)
      ctx.fill()
    }
    ctx.strokeStyle = wireframe ? rgbStr(r, g, b, 0.9) : rgbStr(r, g, b, 0.3)
    ctx.lineWidth = wireframe ? 0.7 : 0.3
    ctx.stroke()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SurfacePlotProps {
  data: TableValue
  width: number
  height: number
  title?: string
}

export function SurfacePlot({ data, width, height, title }: SurfacePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [wireframe, setWireframe] = useState(false)
  const [azimuth, setAzimuth] = useState(-0.6)
  const [elevation, setElevation] = useState(0.55)

  const dragRef = useRef<{ startX: number; startY: number; az: number; el: number } | null>(null)

  const quads = buildQuads(data.rows)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !quads) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderSurface(ctx, quads, azimuth, elevation, width, height, wireframe)
  }, [quads, azimuth, elevation, width, height, wireframe])

  useEffect(() => {
    draw()
  }, [draw])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, az: azimuth, el: elevation }
    },
    [azimuth, elevation],
  )

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) * 0.01
    const dy = (e.clientY - drag.startY) * 0.008
    setAzimuth(drag.az + dx)
    setElevation(Math.max(0.05, Math.min(Math.PI / 2 - 0.05, drag.el + dy)))
  }, [])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const titleH = title ? 20 : 0
  const canvasH = height - titleH

  if (!quads) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-faint, #888)',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '0 1rem',
        }}
      >
        Connect a DataTable (≥2 rows × ≥2 cols) to render the surface
      </div>
    )
  }

  return (
    <div style={{ width, height, position: 'relative', userSelect: 'none' }}>
      {title && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text, #F4F4F3)',
            paddingTop: 4,
            height: titleH,
            lineHeight: `${titleH}px`,
          }}
        >
          {title}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={canvasH}
        style={{ display: 'block', cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      {/* Wireframe toggle */}
      <button
        onClick={() => setWireframe((w) => !w)}
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          fontSize: '0.55rem',
          padding: '1px 5px',
          background: wireframe ? 'rgba(28,171,176,0.85)' : 'rgba(40,40,60,0.85)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 3,
          color: '#fff',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        {wireframe ? 'Solid' : 'Wire'}
      </button>
      {/* Drag hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          fontSize: '0.5rem',
          color: 'rgba(255,255,255,0.3)',
          pointerEvents: 'none',
        }}
      >
        drag to rotate
      </div>
    </div>
  )
}
