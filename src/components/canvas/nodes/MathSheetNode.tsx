/**
 * MathSheetNode — 2.133: Spreadsheet-like computation block.
 *
 * Presents an inline mini-spreadsheet within the node graph:
 *   - Named input ports map to formula variables (x, y, …)
 *   - Cells accept constants or formulas (=A1+B1, =sin(x)*y, …)
 *   - The result cell's value is output via node.data.value → engine sees 'number'
 *
 * Formula language:
 *   - Cell references: A1, B2, C3 (col letter + 1-indexed row)
 *   - Variable names: whatever the user configured as input ports
 *   - Constants: pi, e, tau, inf, nan
 *   - Arithmetic: +  -  *  /  ^
 *   - Functions: sin cos tan asin acos atan atan2 sqrt abs ln log log2
 *                exp floor ceil round min max pow mod sign
 *   - Parentheses for grouping
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, Position, useEdges, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import { isScalar } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SheetVar {
  name: string
}

interface MathSheetData extends NodeData {
  sheetVars: SheetVar[]
  cells: string[][]
  numRows: number
  numCols: number
  resultCell: string
}

// ── Formula evaluator ─────────────────────────────────────────────────────────

type TokKind = 'num' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'eof'
interface Tok {
  kind: TokKind
  val: string
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    if (
      (c >= '0' && c <= '9') ||
      (c === '.' && i + 1 < src.length && src[i + 1] >= '0' && src[i + 1] <= '9')
    ) {
      let j = i
      while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++
      if (j < src.length && (src[j] === 'e' || src[j] === 'E')) {
        j++
        if (j < src.length && (src[j] === '+' || src[j] === '-')) j++
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j++
      }
      toks.push({ kind: 'num', val: src.slice(i, j) })
      i = j
    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i
      while (
        j < src.length &&
        ((src[j] >= 'a' && src[j] <= 'z') ||
          (src[j] >= 'A' && src[j] <= 'Z') ||
          (src[j] >= '0' && src[j] <= '9') ||
          src[j] === '_')
      )
        j++
      toks.push({ kind: 'id', val: src.slice(i, j) })
      i = j
    } else if ('+-*/^'.includes(c)) {
      toks.push({ kind: 'op', val: c })
      i++
    } else if (c === '(') {
      toks.push({ kind: 'lp', val: '(' })
      i++
    } else if (c === ')') {
      toks.push({ kind: 'rp', val: ')' })
      i++
    } else if (c === ',') {
      toks.push({ kind: 'comma', val: ',' })
      i++
    } else {
      i++
    }
  }
  toks.push({ kind: 'eof', val: '' })
  return toks
}

class FormulaParser {
  private toks: Tok[]
  private pos = 0
  private ctx: Record<string, number>

  constructor(toks: Tok[], ctx: Record<string, number>) {
    this.toks = toks
    this.ctx = ctx
  }

  private peek(): Tok {
    return this.toks[this.pos]
  }
  private next(): Tok {
    return this.toks[this.pos++]
  }

  parse(): number {
    return this.addSub()
  }

  private addSub(): number {
    let v = this.mulDiv()
    while (this.peek().kind === 'op' && (this.peek().val === '+' || this.peek().val === '-')) {
      const op = this.next().val
      const r = this.mulDiv()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  private mulDiv(): number {
    let v = this.pow()
    while (this.peek().kind === 'op' && (this.peek().val === '*' || this.peek().val === '/')) {
      const op = this.next().val
      const r = this.pow()
      v = op === '*' ? v * r : v / r
    }
    return v
  }

  private pow(): number {
    const base = this.unary()
    if (this.peek().kind === 'op' && this.peek().val === '^') {
      this.next()
      return Math.pow(base, this.pow()) // right-assoc
    }
    return base
  }

  private unary(): number {
    if (this.peek().kind === 'op' && this.peek().val === '-') {
      this.next()
      return -this.call()
    }
    return this.call()
  }

  private call(): number {
    if (this.peek().kind === 'id' && this.toks[this.pos + 1]?.kind === 'lp') {
      const name = this.next().val
      this.next() // '('
      const args: number[] = []
      if (this.peek().kind !== 'rp') {
        args.push(this.parse())
        while (this.peek().kind === 'comma') {
          this.next()
          args.push(this.parse())
        }
      }
      if (this.peek().kind === 'rp') this.next()
      return this.applyFn(name, args)
    }
    return this.primary()
  }

  private applyFn(name: string, args: number[]): number {
    const [a = NaN, b = NaN] = args
    switch (name.toLowerCase()) {
      case 'sin':
        return Math.sin(a)
      case 'cos':
        return Math.cos(a)
      case 'tan':
        return Math.tan(a)
      case 'asin':
        return Math.asin(a)
      case 'acos':
        return Math.acos(a)
      case 'atan':
        return Math.atan(a)
      case 'atan2':
        return Math.atan2(a, b)
      case 'sqrt':
        return Math.sqrt(a)
      case 'abs':
        return Math.abs(a)
      case 'ln':
        return Math.log(a)
      case 'log':
        return Math.log10(a)
      case 'log2':
        return Math.log2(a)
      case 'exp':
        return Math.exp(a)
      case 'floor':
        return Math.floor(a)
      case 'ceil':
        return Math.ceil(a)
      case 'round':
        return Math.round(a)
      case 'sign':
        return Math.sign(a)
      case 'mod':
        return a % b
      case 'pow':
        return Math.pow(a, b)
      case 'min':
        return Math.min(...args)
      case 'max':
        return Math.max(...args)
      case 'if':
        return args[0] ? args[1] : args[2]
      default:
        return NaN
    }
  }

  private primary(): number {
    const tok = this.peek()
    if (tok.kind === 'num') {
      this.next()
      return parseFloat(tok.val)
    }
    if (tok.kind === 'id') {
      this.next()
      const n = tok.val
      if (n === 'pi' || n === 'PI') return Math.PI
      if (n === 'e') return Math.E
      if (n === 'tau') return Math.PI * 2
      if (n === 'inf' || n === 'Inf') return Infinity
      if (n === 'nan' || n === 'NaN') return NaN
      if (n in this.ctx) return this.ctx[n]
      return NaN
    }
    if (tok.kind === 'lp') {
      this.next()
      const v = this.parse()
      if (this.peek().kind === 'rp') this.next()
      return v
    }
    return NaN
  }
}

function evalFormula(formula: string, ctx: Record<string, number>): number {
  const expr = formula.startsWith('=') ? formula.slice(1).trim() : formula.trim()
  if (expr === '') return NaN
  try {
    const parser = new FormulaParser(tokenize(expr), ctx)
    return parser.parse()
  } catch {
    return NaN
  }
}

function colLetter(col: number): string {
  return String.fromCharCode(65 + col)
}
function colIdx(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65
}

function parseCellAddr(addr: string): { row: number; col: number } | null {
  const m = addr.match(/^([A-Za-z])([0-9]+)$/)
  if (!m) return null
  return { col: colIdx(m[1]), row: parseInt(m[2], 10) - 1 }
}

function evaluateSheet(
  cells: string[][],
  numRows: number,
  numCols: number,
  varValues: Record<string, number>,
): number[][] {
  const result: number[][] = Array.from(
    { length: numRows },
    () => new Array(numCols).fill(NaN) as number[],
  )
  const ctx: Record<string, number> = { ...varValues }
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const cellStr = cells[r]?.[c] ?? ''
      if (cellStr !== '') {
        const n = parseFloat(cellStr)
        result[r][c] = cellStr.startsWith('=') ? evalFormula(cellStr, ctx) : isNaN(n) ? NaN : n
      }
      const ref = `${colLetter(c)}${r + 1}`
      if (!isNaN(result[r][c])) ctx[ref] = result[r][c]
    }
  }
  return result
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4)
  return parseFloat(n.toPrecision(6)).toString()
}

// ── Component ─────────────────────────────────────────────────────────────────

const CELL_W = 60
const CELL_H = 20
const ROW_HDR_W = 18
const COL_HDR_H = 16

function MathSheetNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as MathSheetData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const edges = useEdges()

  const sheetVars: SheetVar[] = nd.sheetVars ?? [{ name: 'x' }, { name: 'y' }]
  const numRows: number = nd.numRows ?? 5
  const numCols: number = nd.numCols ?? 3
  const cells: string[][] =
    nd.cells ?? Array.from({ length: numRows }, () => new Array(numCols).fill('') as string[])
  const resultCell: string = nd.resultCell ?? ''

  // ── Resolve upstream variable values ────────────────────────────────────────
  const varValues = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const v of sheetVars) {
      const portId = `var_${v.name}`
      const edge = edges.find((e) => e.target === id && e.targetHandle === portId)
      if (edge) {
        const upstream = computed.get(edge.source)
        if (upstream && isScalar(upstream)) vals[v.name] = upstream.value
      }
    }
    return vals
  }, [computed, edges, id, sheetVars])

  // ── Evaluate sheet ───────────────────────────────────────────────────────────
  const sheetValues = useMemo(
    () => evaluateSheet(cells, numRows, numCols, varValues),
    [cells, numRows, numCols, varValues],
  )

  // ── Result value ─────────────────────────────────────────────────────────────
  const resultValue = useMemo(() => {
    const addr = parseCellAddr(resultCell)
    if (addr && addr.row >= 0 && addr.row < numRows && addr.col >= 0 && addr.col < numCols) {
      return sheetValues[addr.row][addr.col]
    }
    // Fall back to last non-NaN cell
    for (let r = numRows - 1; r >= 0; r--) {
      for (let c = numCols - 1; c >= 0; c--) {
        if (!isNaN(sheetValues[r][c])) return sheetValues[r][c]
      }
    }
    return NaN
  }, [sheetValues, resultCell, numRows, numCols])

  // ── Push result to engine via node.data.value ────────────────────────────────
  const prevResultRef = useRef<number>(NaN)
  useEffect(() => {
    if (resultValue !== prevResultRef.current) {
      prevResultRef.current = resultValue
      updateNodeData(id, { value: isNaN(resultValue) ? 0 : resultValue })
    }
  }, [id, resultValue, updateNodeData])

  // ── Cell editing ─────────────────────────────────────────────────────────────
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = useCallback(
    (r: number, c: number) => {
      setEditCell({ r, c })
      setEditVal(cells[r]?.[c] ?? '')
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    [cells],
  )

  const commitEdit = useCallback(
    (r: number, c: number, val: string) => {
      const newCells = cells.map((row) => [...row])
      while (newCells.length <= r) newCells.push(new Array(numCols).fill('') as string[])
      while ((newCells[r]?.length ?? 0) <= c) newCells[r].push('')
      newCells[r][c] = val
      updateNodeData(id, { cells: newCells })
      setEditCell(null)
    },
    [cells, id, numCols, updateNodeData],
  )

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const bodyWidth = ROW_HDR_W + numCols * CELL_W + 2
  const nodeWidth = Math.max(bodyWidth + 12, 200)

  return (
    <div
      style={{
        ...s.node,
        width: nodeWidth,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={nd.label}
    >
      {/* Header */}
      <div style={{ ...s.header, borderBottom: `2px solid ${typeColor}44` }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span
          style={{
            fontSize: '0.6rem',
            color: 'var(--muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {isNaN(resultValue) ? '—' : fmtNum(resultValue)}
        </span>
      </div>

      <div
        className="cs-node-body"
        style={{ ...s.body, padding: '0.4rem 0.5rem', position: 'relative' }}
      >
        {/* Input handles (variables) */}
        {sheetVars.map((v, vi) => (
          <Handle
            key={v.name}
            type="target"
            position={Position.Left}
            id={`var_${v.name}`}
            style={{
              ...s.handleLeft,
              top: COL_HDR_H + vi * CELL_H + CELL_H / 2 + 4,
              transform: 'translateY(-50%)',
            }}
          />
        ))}

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Variable labels */}
        {sheetVars.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {sheetVars.map((v, _vi) => {
              const portId = `var_${v.name}`
              const edge = edges.find((e) => e.target === id && e.targetHandle === portId)
              const val = edge ? (varValues[v.name] ?? '—') : '—'
              return (
                <div
                  key={v.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: CELL_H,
                    fontSize: '0.6rem',
                  }}
                >
                  <span
                    style={{
                      color: typeColor,
                      fontFamily: "'JetBrains Mono', monospace",
                      width: 16,
                    }}
                  >
                    {v.name}
                  </span>
                  <span
                    style={{ color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    = {typeof val === 'number' ? fmtNum(val) : val}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Sheet grid */}
        <div
          style={{
            display: 'inline-block',
            border: '1px solid var(--border)',
            borderRadius: 3,
            overflow: 'hidden',
            fontSize: '0.6rem',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: 'flex',
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ width: ROW_HDR_W, height: COL_HDR_H, flexShrink: 0 }} />
            {Array.from({ length: numCols }, (_, c) => (
              <div
                key={c}
                style={{
                  width: CELL_W,
                  height: COL_HDR_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  borderLeft: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              >
                {colLetter(c)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: numRows }, (_, r) => (
            <div
              key={r}
              style={{
                display: 'flex',
                borderTop: r > 0 ? '1px solid var(--border)' : undefined,
              }}
            >
              {/* Row header */}
              <div
                style={{
                  width: ROW_HDR_W,
                  height: CELL_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  background: 'var(--card)',
                  borderRight: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              >
                {r + 1}
              </div>

              {/* Cells */}
              {Array.from({ length: numCols }, (_, c) => {
                const addr = `${colLetter(c)}${r + 1}`
                const isResultCell = resultCell.toUpperCase() === addr
                const isEditing = editCell?.r === r && editCell?.c === c
                const displayVal = sheetValues[r]?.[c]
                const cellContent = cells[r]?.[c] ?? ''

                return (
                  <div
                    key={c}
                    style={{
                      width: CELL_W,
                      height: CELL_H,
                      borderLeft: '1px solid var(--border)',
                      background: isResultCell ? `${typeColor}22` : 'transparent',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                    onDoubleClick={() => startEdit(r, c)}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => commitEdit(r, c, editVal)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault()
                            commitEdit(r, c, editVal)
                          }
                          if (e.key === 'Escape') {
                            setEditCell(null)
                          }
                        }}
                        className="nodrag"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          border: `1px solid ${typeColor}`,
                          background: 'var(--card)',
                          color: 'var(--text)',
                          fontSize: '0.6rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '0 2px',
                          zIndex: 1,
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '0 2px',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: cellContent.startsWith('=') ? 'flex-end' : 'flex-start',
                          color:
                            isNaN(displayVal) && cellContent !== ''
                              ? '#ef4444'
                              : isResultCell
                                ? typeColor
                                : 'var(--text)',
                          overflow: 'hidden',
                          cursor: 'default',
                          userSelect: 'none',
                        }}
                        title={cellContent}
                      >
                        {cellContent === '' ? null : isNaN(displayVal) ? '!' : fmtNum(displayVal)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Config row: result cell + rows/cols */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
            {t('mathSheet.result', 'Result')}:
          </span>
          <input
            type="text"
            value={resultCell}
            onChange={(e) => updateNodeData(id, { resultCell: e.target.value.toUpperCase() })}
            placeholder="C5"
            className="nodrag"
            style={{
              width: 28,
              fontSize: '0.6rem',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '1px 2px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              textAlign: 'center',
            }}
          />
          <button
            onClick={() => {
              const newRows = Math.min(numRows + 1, 10)
              const newCells = Array.from({ length: newRows }, (_, r) =>
                Array.from({ length: numCols }, (_, c) => cells[r]?.[c] ?? ''),
              )
              updateNodeData(id, { numRows: newRows, cells: newCells })
            }}
            className="nodrag"
            title={t('mathSheet.addRow', 'Add row')}
            style={{ ...btnStyle, marginLeft: 'auto' }}
          >
            +R
          </button>
          <button
            onClick={() => {
              if (numRows <= 1) return
              const newRows = numRows - 1
              updateNodeData(id, { numRows: newRows, cells: cells.slice(0, newRows) })
            }}
            className="nodrag"
            title={t('mathSheet.removeRow', 'Remove row')}
            style={btnStyle}
          >
            −R
          </button>
          <button
            onClick={() => {
              const newCols = Math.min(numCols + 1, 6)
              const newCells = cells.map((row) => [...row, ...Array(newCols - row.length).fill('')])
              updateNodeData(id, { numCols: newCols, cells: newCells })
            }}
            className="nodrag"
            title={t('mathSheet.addCol', 'Add column')}
            style={btnStyle}
          >
            +C
          </button>
          <button
            onClick={() => {
              if (numCols <= 1) return
              const newCols = numCols - 1
              const newCells = cells.map((row) => row.slice(0, newCols))
              updateNodeData(id, { numCols: newCols, cells: newCells })
            }}
            className="nodrag"
            title={t('mathSheet.removeCol', 'Remove column')}
            style={btnStyle}
          >
            −C
          </button>
        </div>

        {/* Variable management */}
        <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
              {t('mathSheet.inputs', 'Inputs')}:
            </span>
            {sheetVars.map((v) => (
              <span
                key={v.name}
                style={{
                  fontSize: '0.6rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: typeColor,
                  background: `${typeColor}18`,
                  borderRadius: 3,
                  padding: '0 3px',
                }}
              >
                {v.name}
              </span>
            ))}
            <button
              onClick={() => {
                const letters = 'xyzabcdefghijklmnopqrstuvw'
                const used = new Set(sheetVars.map((v) => v.name))
                let name = ''
                for (const l of letters) {
                  if (!used.has(l)) {
                    name = l
                    break
                  }
                }
                if (!name) name = `v${sheetVars.length}`
                updateNodeData(id, { sheetVars: [...sheetVars, { name }] })
              }}
              className="nodrag"
              title={t('mathSheet.addInput', 'Add input')}
              style={btnStyle}
            >
              +
            </button>
            {sheetVars.length > 0 && (
              <button
                onClick={() => updateNodeData(id, { sheetVars: sheetVars.slice(0, -1) })}
                className="nodrag"
                title={t('mathSheet.removeInput', 'Remove last input')}
                style={btnStyle}
              >
                −
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  padding: '1px 4px',
  borderRadius: 3,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--muted)',
  cursor: 'pointer',
  lineHeight: 1.4,
}

export const MathSheetNode = memo(MathSheetNodeInner)
