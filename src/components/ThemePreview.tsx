/**
 * ThemePreview.tsx -- V3-4.1 Enhanced live preview with click-to-edit.
 *
 * Renders an SVG mini-canvas with sample nodes (source, operation, display),
 * toolbar slice, sidebar slice, and bottom dock bar. Each clickable region
 * carries a `data-theme-var` attribute so the parent can scroll to / highlight
 * the matching color editor.
 */

import { memo, useCallback } from 'react'

interface Props {
  variables: Record<string, string>
  onClickVar?: (cssVar: string) => void
  highlightedVar?: string | null
}

/** Resolve a variable from the overrides map with a fallback. */
function v(variables: Record<string, string>, key: string, fallback: string): string {
  return variables[key] ?? fallback
}

function ThemePreviewInner({ variables, onClickVar, highlightedVar }: Props) {
  const bg = v(variables, '--bg', '#1a1a1a')
  const surface1 = v(variables, '--surface-1', '#242424')
  const surface2 = v(variables, '--surface-2', '#2e2e2e')
  const surface3 = v(variables, '--surface-3', '#383838')
  const nodeBg = v(variables, '--node-bg', surface2)
  const headerBg = v(variables, '--node-header-bg', 'rgba(28,171,176,0.15)')
  const nodeBorder = v(variables, '--node-border', 'rgba(255,255,255,0.12)')
  const primary = v(variables, '--primary', '#1cabb0')
  const primaryDim = v(variables, '--primary-dim', 'rgba(28,171,176,0.15)')
  const text = v(variables, '--text', '#f4f4f3')
  const textMuted = v(variables, '--text-muted', 'rgba(244,244,243,0.65)')
  const handleIn = v(variables, '--handle-input', primary)
  const handleOut = v(variables, '--handle-output', v(variables, '--success', '#22c55e'))
  const edgeColor = v(variables, '--edge-color', primary)
  const selectedBorder = v(variables, '--node-selected-border', primary)
  const toolbarBg = v(variables, '--toolbar-bg', '#2c2c2c')
  const borderColor = v(variables, '--border', 'rgba(255,255,255,0.1)')
  const badgeBg = v(variables, '--badge-bg', 'rgba(28,171,176,0.15)')
  const separator = v(variables, '--separator', 'rgba(255,255,255,0.08)')
  const success = v(variables, '--success', '#22c55e')
  const danger = v(variables, '--danger', '#ef4444')
  const nodeColorSource = v(variables, '--node-color-source', '#a78bfa')
  const nodeColorOp = v(variables, '--node-color-operation', '#1cabb0')
  const nodeColorDisplay = v(variables, '--node-color-display', '#06b6d4')
  const gridMinor = v(variables, '--grid-minor-color', 'rgba(255,255,255,0.18)')

  const click = useCallback(
    (cssVar: string) => (e: React.MouseEvent) => {
      e.stopPropagation()
      onClickVar?.(cssVar)
    },
    [onClickVar],
  )

  /** Highlight ring for the currently-selected variable region. */
  const hl = (cssVar: string) =>
    highlightedVar === cssVar ? { filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.7))' } : undefined

  return (
    <svg
      viewBox="0 0 520 340"
      style={{ width: '100%', height: '100%', borderRadius: 8, cursor: 'pointer' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Canvas background ─────────────────────────────────── */}
      <rect
        width="520"
        height="340"
        fill={bg}
        rx="8"
        data-theme-var="--bg"
        onClick={click('--bg')}
        style={hl('--bg')}
      />

      {/* ── Left sidebar slice ────────────────────────────────── */}
      <rect
        x="0"
        y="28"
        width="52"
        height="312"
        fill={surface1}
        data-theme-var="--surface-1"
        onClick={click('--surface-1')}
        style={hl('--surface-1')}
      />
      <line x1="52" y1="28" x2="52" y2="340" stroke={borderColor} strokeWidth="1" />
      {/* Sidebar icons (decorative) */}
      {[44, 68, 92].map((cy, i) => (
        <rect
          key={i}
          x="14"
          y={cy}
          width="24"
          height="16"
          rx="3"
          fill={i === 0 ? primaryDim : 'transparent'}
          stroke={i === 0 ? primary : textMuted}
          strokeWidth="0.8"
          opacity={i === 0 ? 1 : 0.3}
          data-theme-var={i === 0 ? '--primary-dim' : '--text-muted'}
          onClick={click(i === 0 ? '--primary-dim' : '--text-muted')}
        />
      ))}

      {/* ── Top toolbar ───────────────────────────────────────── */}
      <rect
        x="0"
        y="0"
        width="520"
        height="28"
        fill={toolbarBg}
        rx="8"
        data-theme-var="--toolbar-bg"
        onClick={click('--toolbar-bg')}
        style={hl('--toolbar-bg')}
      />
      {/* Clip bottom corners of toolbar */}
      <rect x="0" y="20" width="520" height="8" fill={toolbarBg} />
      <line x1="0" y1="28" x2="520" y2="28" stroke={separator} strokeWidth="1" />
      {/* Toolbar labels */}
      <text x="65" y="18" fontSize="7" fill={text} fontFamily="sans-serif" fontWeight="600">
        File
      </text>
      <text x="95" y="18" fontSize="7" fill={textMuted} fontFamily="sans-serif">
        Edit
      </text>
      <text x="122" y="18" fontSize="7" fill={textMuted} fontFamily="sans-serif">
        View
      </text>
      {/* Badge sample */}
      <rect
        x="470"
        y="8"
        width="36"
        height="14"
        rx="4"
        fill={badgeBg}
        data-theme-var="--badge-bg"
        onClick={click('--badge-bg')}
      />
      <text x="488" y="18" fontSize="6" fill={primary} fontFamily="sans-serif" textAnchor="middle">
        PRO
      </text>

      {/* ── Grid dots ─────────────────────────────────────────── */}
      <g data-theme-var="--grid-minor-color" onClick={click('--grid-minor-color')}>
        {Array.from({ length: 11 }, (_, i) =>
          Array.from({ length: 7 }, (_, j) => (
            <circle key={`${i}-${j}`} cx={80 + i * 40} cy={50 + j * 40} r="0.8" fill={gridMinor} />
          )),
        )}
      </g>

      {/* ── Edge: Source → Operation ──────────────────────────── */}
      <path
        d="M 210 120 C 250 120 250 185 290 185"
        fill="none"
        stroke={edgeColor}
        strokeWidth="2"
        opacity="0.7"
        data-theme-var="--edge-color"
        onClick={click('--edge-color')}
        style={hl('--edge-color')}
      />
      {/* ── Edge: Operation → Display ────────────────────────── */}
      <path
        d="M 395 185 C 420 185 420 110 445 110"
        fill="none"
        stroke={edgeColor}
        strokeWidth="1.5"
        opacity="0.5"
      />

      {/* ── Source node ────────────────────────────────────────── */}
      <g data-theme-var="--node-bg" onClick={click('--node-bg')} style={hl('--node-bg')}>
        <rect x="80" y="80" width="130" height="60" rx="8" fill={nodeBg} stroke={nodeBorder} />
        <rect
          x="80"
          y="80"
          width="130"
          height="22"
          rx="8"
          fill={headerBg}
          data-theme-var="--node-header-bg"
          onClick={click('--node-header-bg')}
        />
        <rect x="80" y="94" width="130" height="1" fill={nodeBorder} />
        {/* Source color indicator */}
        <circle cx="90" cy="90" r="3" fill={nodeColorSource} />
        <text x="98" y="92" fontSize="7" fontWeight="700" fill={text} fontFamily="sans-serif">
          NUMBER
        </text>
        <text
          x="196"
          y="92"
          fontSize="7"
          fill={primary}
          fontFamily="monospace"
          textAnchor="end"
          data-theme-var="--primary"
          onClick={click('--primary')}
        >
          42
        </text>
        <text x="92" y="124" fontSize="7" fill={textMuted} fontFamily="sans-serif">
          value
        </text>
        <text x="196" y="124" fontSize="8" fill={primary} fontFamily="monospace" textAnchor="end">
          42
        </text>
        {/* Output handle */}
        <circle
          cx="210"
          cy="110"
          r="5"
          fill={handleOut}
          stroke={nodeBg}
          strokeWidth="2"
          data-theme-var="--handle-output"
          onClick={click('--handle-output')}
          style={hl('--handle-output')}
        />
      </g>

      {/* ── Operation node ────────────────────────────────────── */}
      <g data-theme-var="--node-color-operation" onClick={click('--node-color-operation')}>
        <rect x="285" y="155" width="110" height="56" rx="8" fill={nodeBg} stroke={nodeBorder} />
        <rect x="285" y="155" width="110" height="22" rx="8" fill={headerBg} />
        <rect x="285" y="169" width="110" height="1" fill={nodeBorder} />
        <circle cx="295" cy="165" r="3" fill={nodeColorOp} />
        <text x="303" y="167" fontSize="7" fontWeight="700" fill={text} fontFamily="sans-serif">
          ADD
        </text>
        <text x="297" y="196" fontSize="6.5" fill={textMuted} fontFamily="sans-serif">
          a, b
        </text>
        {/* Input handle */}
        <circle
          cx="285"
          cy="185"
          r="4.5"
          fill={handleIn}
          stroke={nodeBg}
          strokeWidth="2"
          data-theme-var="--handle-input"
          onClick={click('--handle-input')}
          style={hl('--handle-input')}
        />
        {/* Output handle */}
        <circle cx="395" cy="185" r="4.5" fill={handleOut} stroke={nodeBg} strokeWidth="2" />
      </g>

      {/* ── Display node (selected) ───────────────────────────── */}
      <g
        data-theme-var="--node-selected-border"
        onClick={click('--node-selected-border')}
        style={hl('--node-selected-border')}
      >
        <rect
          x="440"
          y="82"
          width="68"
          height="56"
          rx="8"
          fill={nodeBg}
          stroke={selectedBorder}
          strokeWidth="1.5"
        />
        <rect x="440" y="82" width="68" height="20" rx="8" fill={headerBg} />
        <rect x="440" y="95" width="68" height="1" fill={nodeBorder} />
        <circle cx="450" cy="92" r="3" fill={nodeColorDisplay} />
        <text x="458" y="94" fontSize="6.5" fontWeight="700" fill={text} fontFamily="sans-serif">
          DISPLAY
        </text>
        <text
          x="474"
          y="120"
          fontSize="13"
          fontWeight="700"
          fill={primary}
          fontFamily="monospace"
          textAnchor="middle"
        >
          42
        </text>
        {/* Input handle */}
        <circle cx="440" cy="110" r="4.5" fill={handleIn} stroke={nodeBg} strokeWidth="2" />
      </g>

      {/* ── Bottom dock bar ───────────────────────────────────── */}
      <rect
        x="52"
        y="302"
        width="468"
        height="38"
        fill={surface2}
        rx="0"
        data-theme-var="--surface-2"
        onClick={click('--surface-2')}
        style={hl('--surface-2')}
      />
      {/* Bottom dock rounding on the bottom-right */}
      <rect x="512" y="332" width="8" height="8" fill={bg} />
      <line x1="52" y1="302" x2="520" y2="302" stroke={borderColor} strokeWidth="1" />
      {/* Dock tabs */}
      {['Console', 'Health', 'Output'].map((label, i) => (
        <g key={label}>
          <rect
            x={64 + i * 65}
            y={308}
            width={55}
            height={18}
            rx={4}
            fill={i === 0 ? surface3 : 'transparent'}
            data-theme-var={i === 0 ? '--surface-3' : undefined}
            onClick={i === 0 ? click('--surface-3') : undefined}
          />
          <text
            x={91 + i * 65}
            y={320}
            fontSize="6.5"
            fill={i === 0 ? text : textMuted}
            fontFamily="sans-serif"
            textAnchor="middle"
          >
            {label}
          </text>
        </g>
      ))}

      {/* ── Status bar (very bottom) ──────────────────────────── */}
      <rect x="0" y="332" width="520" height="8" fill={toolbarBg} rx="0" />
      {/* Bottom-right corner radius */}
      <rect x="512" y="332" width="8" height="8" fill={toolbarBg} rx="8" />
      {/* Bottom-left corner radius */}
      <rect x="0" y="332" width="8" height="8" fill={toolbarBg} rx="8" />

      {/* ── Accent color swatches in bottom-left ──────────────── */}
      <g transform="translate(70, 260)">
        <circle
          cx="0"
          cy="0"
          r="6"
          fill={success}
          data-theme-var="--success"
          onClick={click('--success')}
          style={hl('--success')}
        />
        <circle
          cx="18"
          cy="0"
          r="6"
          fill={danger}
          data-theme-var="--danger"
          onClick={click('--danger')}
          style={hl('--danger')}
        />
        <circle
          cx="36"
          cy="0"
          r="6"
          fill={nodeColorSource}
          data-theme-var="--node-color-source"
          onClick={click('--node-color-source')}
          style={hl('--node-color-source')}
        />
        <circle cx="54" cy="0" r="6" fill={nodeColorOp} onClick={click('--node-color-operation')} />
        <circle
          cx="72"
          cy="0"
          r="6"
          fill={nodeColorDisplay}
          data-theme-var="--node-color-display"
          onClick={click('--node-color-display')}
          style={hl('--node-color-display')}
        />
      </g>
      <text x="70" y="278" fontSize="5.5" fill={textMuted} fontFamily="sans-serif">
        node type colours
      </text>
    </svg>
  )
}

export const ThemePreview = memo(ThemePreviewInner)
