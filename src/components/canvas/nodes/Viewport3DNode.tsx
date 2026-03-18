/**
 * Viewport3DNode — 6.16: 3D viewport with orbit camera and mesh rendering.
 *
 * Renders a 3D mesh using Canvas 2D with perspective projection.
 * Input "mesh": DataTable with columns x, y, z (vertex positions).
 *   Optional additional columns fi, fj, fk define triangle face indices.
 *   If no input is connected, shows a demo wireframe cube.
 *
 * Camera: orbit model (azimuth + elevation + zoom).
 * Render modes: wireframe | solid (flat shading) | transparent.
 * Controls: mouse-drag to orbit, wheel to zoom, double-click to reset.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vertex { x: number; y: number; z: number }
interface Face { i: number; j: number; k: number }
interface Mesh { vertices: Vertex[]; faces: Face[] }

interface Vp3dNodeData extends NodeData {
  vp3dMode: 'wireframe' | 'solid' | 'transparent'
  vp3dAzimuth: number
  vp3dElevation: number
  vp3dZoom: number
  vp3dBgColor: string
  vp3dMeshColor: string
}

// ── Demo mesh: unit cube ──────────────────────────────────────────────────────

const DEMO_CUBE: Mesh = {
  vertices: [
    { x: -0.5, y: -0.5, z: -0.5 }, { x:  0.5, y: -0.5, z: -0.5 },
    { x:  0.5, y:  0.5, z: -0.5 }, { x: -0.5, y:  0.5, z: -0.5 },
    { x: -0.5, y: -0.5, z:  0.5 }, { x:  0.5, y: -0.5, z:  0.5 },
    { x:  0.5, y:  0.5, z:  0.5 }, { x: -0.5, y:  0.5, z:  0.5 },
  ],
  faces: [
    // Front
    { i: 4, j: 5, k: 6 }, { i: 4, j: 6, k: 7 },
    // Back
    { i: 1, j: 0, k: 3 }, { i: 1, j: 3, k: 2 },
    // Left
    { i: 0, j: 4, k: 7 }, { i: 0, j: 7, k: 3 },
    // Right
    { i: 5, j: 1, k: 2 }, { i: 5, j: 2, k: 6 },
    // Top
    { i: 7, j: 6, k: 2 }, { i: 7, j: 2, k: 3 },
    // Bottom
    { i: 0, j: 1, k: 5 }, { i: 0, j: 5, k: 4 },
  ],
}

// ── Mesh parsing from DataTable ───────────────────────────────────────────────

interface RawTable { columns: string[]; rows: number[][] }

function parseTableToMesh(raw: RawTable): Mesh | null {
  const { columns, rows } = raw
  const xi = columns.indexOf('x')
  const yi = columns.indexOf('y')
  const zi = columns.indexOf('z')
  if (xi < 0 || yi < 0 || zi < 0) return null

  const fii = columns.indexOf('fi')
  const fji = columns.indexOf('fj')
  const fki = columns.indexOf('fk')

  const vertices: Vertex[] = rows.map((r) => ({ x: r[xi], y: r[yi], z: r[zi] }))
  const faces: Face[] = []

  if (fii >= 0 && fji >= 0 && fki >= 0) {
    for (const r of rows) {
      const fi = Math.round(r[fii])
      const fj = Math.round(r[fji])
      const fk = Math.round(r[fki])
      if (fi >= 0 && fj >= 0 && fk >= 0 && fi < vertices.length && fj < vertices.length && fk < vertices.length) {
        faces.push({ i: fi, j: fj, k: fk })
      }
    }
  }

  if (vertices.length === 0) return null
  return { vertices, faces }
}

// ── Projection helpers ────────────────────────────────────────────────────────

function deg2rad(d: number) { return (d * Math.PI) / 180 }

/**
 * Project a 3D vertex to 2D canvas coordinates using perspective projection.
 * Camera sits on a sphere of radius `zoom` centered on origin.
 */
function project(
  v: Vertex,
  az: number, // azimuth in degrees
  el: number, // elevation in degrees
  zoom: number,
  cx: number,
  cy: number,
  scale: number,
): { x: number; y: number; z: number } {
  const azR = deg2rad(az)
  const elR = deg2rad(el)

  // Rotate around Y axis (azimuth), then X axis (elevation)
  const cosAz = Math.cos(azR), sinAz = Math.sin(azR)
  const cosEl = Math.cos(elR), sinEl = Math.sin(elR)

  // Azimuth rotation
  const x1 = cosAz * v.x + sinAz * v.z
  const y1 = v.y
  const z1 = -sinAz * v.x + cosAz * v.z

  // Elevation rotation
  const x2 = x1
  const y2 = cosEl * y1 - sinEl * z1
  const z2 = sinEl * y1 + cosEl * z1

  // Perspective
  const dist = zoom + z2
  const fov = 2.0
  const px = cx + (x2 / dist) * scale * fov
  const py = cy - (y2 / dist) * scale * fov

  return { x: px, y: py, z: z2 }
}

// ── Face normal for flat shading / back-face culling ─────────────────────────

function faceNormal(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
) {
  const ux = b.x - a.x, uy = b.y - a.y
  const vx = c.x - a.x, vy = c.y - a.y
  // 2D cross product — z-component of 3D cross product
  return ux * vy - uy * vx
}

/** Hex colour string to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [28, 171, 176]
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

function renderMesh(
  canvas: HTMLCanvasElement,
  mesh: Mesh,
  az: number,
  el: number,
  zoom: number,
  mode: 'wireframe' | 'solid' | 'transparent',
  bgColor: string,
  meshColor: string,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h) * 0.38

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, w, h)

  // Project all vertices
  const projected = mesh.vertices.map((v) => project(v, az, el, zoom, cx, cy, scale))
  const [mr, mg, mb] = hexToRgb(meshColor)

  if (mesh.faces.length === 0) {
    // Point cloud / vertex-only: draw dots
    ctx.fillStyle = meshColor
    for (const p of projected) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  // Sort faces by average depth (painter's algorithm)
  const facesSorted = mesh.faces
    .map((f) => ({
      f,
      depth: (projected[f.i].z + projected[f.j].z + projected[f.k].z) / 3,
    }))
    .sort((a, b) => b.depth - a.depth)

  for (const { f } of facesSorted) {
    const pa = projected[f.i]
    const pb = projected[f.j]
    const pc = projected[f.k]

    // Back-face cull (positive winding = facing camera)
    const normal = faceNormal(pa, pb, pc)

    if (mode === 'wireframe') {
      ctx.strokeStyle = meshColor
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.lineTo(pc.x, pc.y)
      ctx.closePath()
      ctx.stroke()
    } else {
      // Compute a simple light intensity from face normal direction
      const brightness = mode === 'transparent'
        ? 0.5
        : Math.max(0.15, Math.min(1.0, (normal > 0 ? 0.7 : 0.25) + 0.3))

      const alpha = mode === 'transparent' ? 0.4 : 1.0
      const r = Math.round(mr * brightness)
      const g = Math.round(mg * brightness)
      const b = Math.round(mb * brightness)

      // Skip strongly back-facing in solid mode
      if (mode === 'solid' && normal < -0.5 * scale * 0.1) continue

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.lineTo(pc.x, pc.y)
      ctx.closePath()
      ctx.fill()

      // Subtle edge lines on solid faces
      ctx.strokeStyle = `rgba(0,0,0,0.25)`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }
}

// ── Node component ────────────────────────────────────────────────────────────

function Viewport3DNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as Vp3dNodeData
  const { updateNodeData } = useReactFlow()
  const meshInput = useComputedValue(id, 'mesh')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [az, setAz] = useState(nd.vp3dAzimuth ?? 45)
  const [el, setEl] = useState(nd.vp3dElevation ?? 30)
  const [zoom, setZoom] = useState(nd.vp3dZoom ?? 1.5)
  const [mode, setMode] = useState<'wireframe' | 'solid' | 'transparent'>(nd.vp3dMode ?? 'wireframe')
  const dragRef = useRef<{ startX: number; startY: number; az: number; el: number } | null>(null)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  // Derive mesh from computed input or use demo cube
  const mesh: Mesh = (() => {
    if (meshInput && meshInput.kind === 'table') {
      const raw = meshInput as unknown as { columns: string[]; rows: number[][] }
      const parsed = parseTableToMesh(raw)
      if (parsed) return parsed
    }
    return DEMO_CUBE
  })()

  // Re-render whenever camera or mesh changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderMesh(canvas, mesh, az, el, zoom, mode, nd.vp3dBgColor ?? '#1a1a1a', nd.vp3dMeshColor ?? '#1CABB0')
  }, [mesh, az, el, zoom, mode, nd.vp3dBgColor, nd.vp3dMeshColor])

  // Mouse drag to orbit
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, az, el }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setAz(dragRef.current.az + dx * 0.5)
      setEl(Math.max(-89, Math.min(89, dragRef.current.el - dy * 0.5)))
    }
    const onUp = () => {
      setAz((a) => { updateNodeData(id, { vp3dAzimuth: a }); return a })
      setEl((e2) => { updateNodeData(id, { vp3dElevation: e2 }); return e2 })
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [az, el, id, updateNodeData])

  // Mouse wheel to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => {
      const next = Math.max(0.5, Math.min(10, z + e.deltaY * 0.005))
      updateNodeData(id, { vp3dZoom: next })
      return next
    })
  }, [id, updateNodeData])

  // Double-click to reset view
  const handleDoubleClick = useCallback(() => {
    setAz(45); setEl(30); setZoom(1.5)
    updateNodeData(id, { vp3dAzimuth: 45, vp3dElevation: 30, vp3dZoom: 1.5 })
  }, [id, updateNodeData])

  const cycleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'wireframe' ? 'solid' : m === 'solid' ? 'transparent' : 'wireframe'
      updateNodeData(id, { vp3dMode: next })
      return next
    })
  }, [id, updateNodeData])

  const isDemoMesh = mesh === DEMO_CUBE

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 220,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('viewport3d.label', '3D Viewport')}</span>
      </div>

      <div style={s.nodeBody}>
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="nodrag"
          width={200}
          height={160}
          style={{ display: 'block', borderRadius: 4, cursor: 'grab', userSelect: 'none' }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
        />

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <button
            className="nodrag"
            onClick={cycleMode}
            title={t('viewport3d.cycleMode', 'Toggle render mode')}
            style={{
              background: '#2a2a2a', color: '#aaa', border: '1px solid #333',
              borderRadius: 3, padding: '1px 7px', fontSize: 9, cursor: 'pointer',
            }}
          >
            {mode}
          </button>
          <span style={{ flex: 1 }} />
          {isDemoMesh && (
            <span style={{ fontSize: 8, color: '#555' }}>
              {t('viewport3d.demo', 'demo cube')}
            </span>
          )}
          <span style={{ fontSize: 8, color: '#555' }}>
            {mesh.vertices.length}v {mesh.faces.length}f
          </span>
        </div>
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="mesh"
        style={{ top: '50%', background: typeColor, width: 8, height: 8, border: '2px solid #1a1a1a' }}
      />
    </div>
  )
}

export const Viewport3DNode = memo(Viewport3DNodeInner)
