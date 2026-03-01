/**
 * ExpressionPanel — E6-2: Pretty math rendering + substitution.
 *
 * Shows symbolic and substituted expression forms for a selected node.
 * Provides copy-as-text and copy-as-LaTeX buttons.
 */

import { useMemo, useCallback, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { Value } from '../../engine/value'
import {
  buildExpressionTree,
  renderExpressionText,
  renderExpressionSubstituted,
  renderExpressionLatex,
  renderEquationText,
  renderEquationLatex,
} from '../../lib/expressionExtractor'

interface ExpressionPanelProps {
  nodeId: string
  nodes: Node[]
  edges: Edge[]
  computed: ReadonlyMap<string, Value>
  onClose: () => void
}

export function ExpressionPanel({ nodeId, nodes, edges, computed, onClose }: ExpressionPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const tree = useMemo(
    () => buildExpressionTree(nodeId, nodes, edges, computed),
    [nodeId, nodes, edges, computed],
  )

  const symbolic = useMemo(() => (tree ? renderExpressionText(tree) : null), [tree])
  const substituted = useMemo(() => (tree ? renderExpressionSubstituted(tree) : null), [tree])
  const equation = useMemo(() => (tree ? renderEquationText(tree) : null), [tree])
  const latexSym = useMemo(() => (tree ? renderExpressionLatex(tree, 'symbolic') : null), [tree])
  const latexEq = useMemo(() => (tree ? renderEquationLatex(tree) : null), [tree])

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }, [])

  if (!tree) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>Expression</span>
          <button style={closeBtnStyle} onClick={onClose}>
            &times;
          </button>
        </div>
        <div style={bodyStyle}>
          <span style={emptyStyle}>No expression available for this node.</span>
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Expression</span>
        <button style={closeBtnStyle} onClick={onClose}>
          &times;
        </button>
      </div>
      <div style={bodyStyle}>
        {/* Symbolic form */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>Symbolic</div>
          <div style={exprBoxStyle}>{symbolic}</div>
          <button
            style={copyBtnStyle}
            onClick={() => copyToClipboard(symbolic!, 'symbolic')}
            title="Copy as text"
          >
            {copied === 'symbolic' ? 'Copied!' : 'Copy text'}
          </button>
        </div>

        {/* Substituted form */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>Substituted</div>
          <div style={exprBoxStyle}>{substituted}</div>
        </div>

        {/* Equation (symbolic = value) */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>Equation</div>
          <div style={exprBoxStyle}>{equation}</div>
          <button
            style={copyBtnStyle}
            onClick={() => copyToClipboard(equation!, 'equation')}
            title="Copy equation"
          >
            {copied === 'equation' ? 'Copied!' : 'Copy text'}
          </button>
        </div>

        {/* LaTeX */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>LaTeX</div>
          <div
            style={{
              ...exprBoxStyle,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.72rem',
            }}
          >
            {latexSym}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              style={copyBtnStyle}
              onClick={() => copyToClipboard(latexSym!, 'latex-sym')}
              title="Copy LaTeX (symbolic)"
            >
              {copied === 'latex-sym' ? 'Copied!' : 'Copy symbolic'}
            </button>
            <button
              style={copyBtnStyle}
              onClick={() => copyToClipboard(latexEq!, 'latex-eq')}
              title="Copy LaTeX (equation)"
            >
              {copied === 'latex-eq' ? 'Copied!' : 'Copy equation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-lg)',
  width: 320,
  maxHeight: 400,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Montserrat', system-ui, sans-serif",
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1rem',
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
  fontFamily: 'inherit',
}

const bodyStyle: React.CSSProperties = {
  overflowY: 'auto',
  padding: '0.4rem 0.6rem 0.6rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
}

const exprBoxStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border)',
  fontSize: '0.78rem',
  color: 'var(--text)',
  wordBreak: 'break-word',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const copyBtnStyle: React.CSSProperties = {
  padding: '0.15rem 0.5rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.62rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  alignSelf: 'flex-start',
}

const emptyStyle: React.CSSProperties = {
  color: 'var(--text-faint)',
  fontSize: '0.78rem',
  padding: '0.5rem 0',
  textAlign: 'center',
}
