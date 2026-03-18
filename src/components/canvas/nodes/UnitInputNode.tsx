/**
 * UnitInputNode — 2.13: Physical quantity input with unit picker.
 *
 * User enters a numeric value in any supported unit; the block converts it to
 * SI base units and outputs that as a scalar to the engine (bridge treats it
 * as 'number'). The selected unit symbol and SI unit are shown as badges.
 *
 * Implements a searchable dropdown over 500+ units (SI, CGS, imperial, engineering).
 * Temperature conversions handle the additive offset (°C → K, °F → K).
 */

import { memo, createElement, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { searchUnits, UNIT_BY_SYMBOL, type UnitDef } from '../../../blocks/unitCatalog'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UnitInputNodeData extends NodeData {
  rawValue: number
  unit: string
  siUnit: string
  toSI: number
  offsetSI: number
  value: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toSiValue(raw: number, def: UnitDef): number {
  return raw * def.toSI + def.offsetSI
}

function fmtSI(v: number, siUnit: string): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  let str: string
  if (abs === 0) str = '0'
  else if (abs >= 1e6 || abs < 1e-3) str = v.toExponential(4)
  else str = parseFloat(v.toPrecision(6)).toString()
  return `${str} ${siUnit}`
}

// ── Component ──────────────────────────────────────────────────────────────────

function UnitInputNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as UnitInputNodeData
  const { updateNodeData } = useReactFlow()

  const rawValue = nd.rawValue ?? 1
  const unit = nd.unit ?? 'm'
  const siUnit = nd.siUnit ?? 'm'
  const toSI = nd.toSI ?? 1
  const offsetSI = nd.offsetSI ?? 0

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentDef = UNIT_BY_SYMBOL.get(unit)
  const siValue = toSiValue(rawValue, { toSI, offsetSI } as UnitDef)

  const suggestions = searchUnits(searchQuery, 12)

  const selectUnit = useCallback(
    (def: UnitDef) => {
      const newSiValue = toSiValue(rawValue, def)
      updateNodeData(id, {
        unit: def.symbol,
        siUnit: def.siUnit,
        toSI: def.toSI,
        offsetSI: def.offsetSI,
        value: newSiValue,
      })
      setSearchOpen(false)
      setSearchQuery('')
    },
    [id, rawValue, updateNodeData],
  )

  const onValueChange = useCallback(
    (raw: number) => {
      const si = toSiValue(raw, { toSI, offsetSI } as UnitDef)
      updateNodeData(id, { rawValue: raw, value: si })
    },
    [id, toSI, offsetSI, updateNodeData],
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      {/* Header */}
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('unitInput.label', 'Unit Input')}</span>
      </div>

      <div style={s.nodeBody}>
        {/* Value input + unit badge */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
          <input
            className="nodrag"
            type="number"
            value={rawValue}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
            style={{
              flex: 1,
              background: '#1a1a1a',
              color: '#F4F4F3',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
              minWidth: 0,
            }}
          />
          {/* Unit badge / picker trigger */}
          <button
            className="nodrag"
            onClick={() => setSearchOpen((o) => !o)}
            style={{
              background: typeColor,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              minWidth: 44,
              textAlign: 'center',
            }}
            title={currentDef?.name ?? unit}
          >
            {unit}
          </button>
        </div>

        {/* SI conversion display */}
        <div
          style={{
            fontSize: 9,
            color: '#888',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: 4,
          }}
        >
          {fmtSI(siValue, siUnit)}
        </div>

        {/* Unit category badge */}
        {currentDef && (
          <div style={{ fontSize: 8, color: '#666', display: 'flex', gap: 4 }}>
            <span style={{ background: '#2a2a2a', padding: '1px 4px', borderRadius: 3 }}>
              {currentDef.category}
            </span>
            <span style={{ background: '#2a2a2a', padding: '1px 4px', borderRadius: 3 }}>
              {currentDef.system}
            </span>
          </div>
        )}

        {/* Search dropdown */}
        {searchOpen && (
          <div
            ref={dropdownRef}
            className="nodrag"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#2a2a2a',
              border: '1px solid #555',
              borderRadius: 4,
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              marginTop: 4,
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('unitInput.searchPlaceholder', 'Search units…')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#1a1a1a',
                color: '#F4F4F3',
                border: 'none',
                borderBottom: '1px solid #444',
                padding: '6px 8px',
                fontSize: 10,
                outline: 'none',
                borderRadius: '4px 4px 0 0',
              }}
            />
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {suggestions.length === 0 ? (
                <div style={{ padding: '6px 8px', fontSize: 9, color: '#666' }}>
                  {t('unitInput.noResults', 'No units found')}
                </div>
              ) : (
                suggestions.map((u) => (
                  <div
                    key={u.symbol}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectUnit(u)
                    }}
                    style={{
                      padding: '5px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 10,
                      borderBottom: '1px solid #333',
                      background: u.symbol === unit ? '#333' : 'transparent',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = '#3a3a3a')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background =
                        u.symbol === unit ? '#333' : 'transparent')
                    }
                  >
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        color: typeColor,
                        fontWeight: 700,
                      }}
                    >
                      {u.symbol}
                    </span>
                    <span style={{ color: '#aaa', fontSize: 9, textAlign: 'right' }}>{u.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          top: '50%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
      />
    </div>
  )
}

export const UnitInputNode = memo(UnitInputNodeInner)
