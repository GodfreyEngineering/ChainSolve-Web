/**
 * openDrive.ts — Minimal OpenDRIVE (.xodr) road geometry parser.
 *
 * OpenDRIVE (ASAM OpenDRIVE 1.6) is an XML format that describes road
 * networks for driving simulation (AD/ADAS testing). This parser extracts
 * road geometry and outputs a table of (x, y, heading, s) samples along
 * each road's reference line for use in vehicle simulation blocks.
 *
 * Supported geometry types:
 *   - line  : straight segment
 *   - arc   : constant curvature
 *   - spiral: Euler spiral / clothoid (Fresnel integral approximation)
 *   - poly3 : cubic polynomial u(s), v(s)
 *   - paramPoly3: parametric cubic polynomial
 *
 * Output table columns: road_id, lane_section, s, x, y, hdg, length
 */

export interface XodrPoint {
  roadId: string
  s: number
  x: number
  y: number
  hdg: number
  length: number
}

export interface XodrRoad {
  id: string
  name: string
  length: number
  points: XodrPoint[]
}

export interface XodrResult {
  roads: XodrRoad[]
  totalLength: number
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number }
}

/** Parse an OpenDRIVE XML string and return road geometry. */
export function parseOpenDrive(xml: string): XodrResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const roads: XodrRoad[] = []

  const roadEls = doc.querySelectorAll('road')
  for (const roadEl of Array.from(roadEls)) {
    const roadId = roadEl.getAttribute('id') ?? ''
    const roadName = roadEl.getAttribute('name') ?? ''
    const roadLength = parseFloat(roadEl.getAttribute('length') ?? '0')

    const points: XodrPoint[] = []

    // Each road has one <planView> with multiple <geometry> segments
    const geomEls = roadEl.querySelectorAll('planView > geometry')
    for (const geomEl of Array.from(geomEls)) {
      const sStart = parseFloat(geomEl.getAttribute('s') ?? '0')
      const x0 = parseFloat(geomEl.getAttribute('x') ?? '0')
      const y0 = parseFloat(geomEl.getAttribute('y') ?? '0')
      const hdg0 = parseFloat(geomEl.getAttribute('hdg') ?? '0')
      const segLen = parseFloat(geomEl.getAttribute('length') ?? '0')

      if (segLen <= 0) continue

      // Determine geometry type
      const lineEl = geomEl.querySelector('line')
      const arcEl = geomEl.querySelector('arc')
      const spiralEl = geomEl.querySelector('spiral')
      const poly3El = geomEl.querySelector('poly3')
      const pPoly3El = geomEl.querySelector('paramPoly3')

      const SAMPLES = Math.max(2, Math.ceil(segLen / 2) + 1) // ~2 m intervals

      for (let i = 0; i < SAMPLES; i++) {
        const t = i / (SAMPLES - 1)
        const ds = t * segLen
        let x = x0
        let y = y0
        let hdg = hdg0

        if (lineEl) {
          // Line: x = x0 + ds*cos(hdg0), y = y0 + ds*sin(hdg0)
          x = x0 + ds * Math.cos(hdg0)
          y = y0 + ds * Math.sin(hdg0)
          hdg = hdg0
        } else if (arcEl) {
          // Arc: constant curvature k
          const k = parseFloat(arcEl.getAttribute('curvature') ?? '0')
          if (Math.abs(k) < 1e-10) {
            x = x0 + ds * Math.cos(hdg0)
            y = y0 + ds * Math.sin(hdg0)
            hdg = hdg0
          } else {
            const r = 1.0 / k
            const theta = ds * k
            x = x0 + r * (Math.sin(hdg0 + theta) - Math.sin(hdg0))
            y = y0 - r * (Math.cos(hdg0 + theta) - Math.cos(hdg0))
            hdg = hdg0 + theta
          }
        } else if (spiralEl) {
          // Euler spiral: curvature linearly interpolates from curvStart to curvEnd
          const kStart = parseFloat(spiralEl.getAttribute('curvStart') ?? '0')
          const kEnd = parseFloat(spiralEl.getAttribute('curvEnd') ?? '0')
          // Fresnel integral approximation via numerical quadrature (Simpson's rule)
          const N = 20
          let intX = 0
          let intY = 0
          let prevHdg = hdg0
          const dss = ds / N
          for (let j = 0; j <= N; j++) {
            const sj = j * dss
            const k = kStart + (kEnd - kStart) * (sj / segLen)
            const theta = hdg0 + 0.5 * k * sj
            const w = j === 0 || j === N ? 1 : j % 2 === 0 ? 2 : 4
            intX += w * Math.cos(theta)
            intY += w * Math.sin(theta)
            if (j === N) prevHdg = theta
          }
          x = x0 + (dss / 3) * intX
          y = y0 + (dss / 3) * intY
          hdg = prevHdg
        } else if (poly3El) {
          // Cubic polynomial: u(p) = a+b*p+c*p^2+d*p^3, v(p) = ...
          const au = parseFloat(poly3El.getAttribute('a') ?? '0')
          const bu = parseFloat(poly3El.getAttribute('b') ?? '0')
          const cu = parseFloat(poly3El.getAttribute('c') ?? '0')
          const du = parseFloat(poly3El.getAttribute('d') ?? '0')
          const p = ds
          const u = au + bu * p + cu * p * p + du * p * p * p
          // v is zero for poly3 (lateral offset)
          x = x0 + u * Math.cos(hdg0)
          y = y0 + u * Math.sin(hdg0)
          hdg = hdg0 + Math.atan2(bu + 2 * cu * p + 3 * du * p * p, 1)
        } else if (pPoly3El) {
          // Parametric poly3: u(p), v(p) in local frame
          const au = parseFloat(pPoly3El.getAttribute('aU') ?? '0')
          const bu = parseFloat(pPoly3El.getAttribute('bU') ?? '1')
          const cu = parseFloat(pPoly3El.getAttribute('cU') ?? '0')
          const du = parseFloat(pPoly3El.getAttribute('dU') ?? '0')
          const av = parseFloat(pPoly3El.getAttribute('aV') ?? '0')
          const bv = parseFloat(pPoly3El.getAttribute('bV') ?? '0')
          const cv = parseFloat(pPoly3El.getAttribute('cV') ?? '0')
          const dv = parseFloat(pPoly3El.getAttribute('dV') ?? '0')
          const pRange = pPoly3El.getAttribute('pRange') === 'arcLength' ? segLen : 1.0
          const p = (ds / segLen) * pRange
          const u = au + bu * p + cu * p * p + du * p * p * p
          const v = av + bv * p + cv * p * p + dv * p * p * p
          const cos0 = Math.cos(hdg0)
          const sin0 = Math.sin(hdg0)
          x = x0 + u * cos0 - v * sin0
          y = y0 + u * sin0 + v * cos0
          const du_dp = bu + 2 * cu * p + 3 * du * p * p
          const dv_dp = bv + 2 * cv * p + 3 * dv * p * p
          hdg = hdg0 + Math.atan2(dv_dp, du_dp)
        } else {
          // Unknown geometry — straight line fallback
          x = x0 + ds * Math.cos(hdg0)
          y = y0 + ds * Math.sin(hdg0)
          hdg = hdg0
        }

        points.push({ roadId, s: sStart + ds, x, y, hdg, length: segLen })
      }
    }

    roads.push({ id: roadId, name: roadName, length: roadLength, points })
  }

  // Compute bounding box
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let totalLength = 0
  for (const road of roads) {
    totalLength += road.length
    for (const pt of road.points) {
      if (pt.x < minX) minX = pt.x
      if (pt.x > maxX) maxX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.y > maxY) maxY = pt.y
    }
  }
  if (!isFinite(minX)) {
    minX = maxX = minY = maxY = 0
  }

  return { roads, totalLength, boundingBox: { minX, maxX, minY, maxY } }
}

/** Convert XodrResult to tableData (road_id encoded as index, s, x, y, hdg). */
export function xodrToTable(result: XodrResult): { columns: string[]; rows: number[][] } {
  const rows: number[][] = []
  for (let ri = 0; ri < result.roads.length; ri++) {
    for (const pt of result.roads[ri].points) {
      rows.push([ri, pt.s, pt.x, pt.y, pt.hdg])
    }
  }
  return { columns: ['road_idx', 's', 'x', 'y', 'hdg'], rows }
}
