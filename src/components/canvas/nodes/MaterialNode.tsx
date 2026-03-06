/**
 * MaterialNode — multi-output material block (Phase 10).
 *
 * Shows a searchable material picker and lists all properties with
 * per-property output handles (prop_rho, prop_E, etc.).
 */

import { memo, useCallback, useMemo, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import type { NodeData } from '../../../blocks/registry'
import {
  MATERIAL_FULL_DATA,
  PROPERTY_META,
  PROPERTY_ORDER,
  type MaterialFullEntry,
} from '../../../blocks/materialCatalog'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { formatValue } from '../../../engine/value'

const ROW_H = 26

function MaterialNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const value = computed.get(id)

  const { t } = useTranslation()
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const [search, setSearch] = useState('')

  // Group materials by subcategory for the picker
  const grouped = useMemo(() => {
    const map = new Map<string, MaterialFullEntry[]>()
    for (const m of MATERIAL_FULL_DATA) {
      const group = map.get(m.subcategory) ?? []
      group.push(m)
      map.set(m.subcategory, group)
    }
    return Array.from(map.entries()).map(([sub, entries]) => ({ label: sub, entries }))
  }, [])

  // Current selection
  const selectedPrefix = (nd.selectedMaterialPrefix as string) ?? ''
  const selectedMaterial = useMemo(
    () => MATERIAL_FULL_DATA.find((m) => m.prefix === selectedPrefix),
    [selectedPrefix],
  )

  // Properties to display (from selection)
  const properties = useMemo(() => {
    if (!selectedMaterial) return []
    return PROPERTY_ORDER.filter((k) => k in selectedMaterial.properties).map((k) => ({
      key: k,
      value: selectedMaterial.properties[k],
      meta: PROPERTY_META[k],
    }))
  }, [selectedMaterial])

  const onSelect = useCallback(
    (prefix: string | undefined) => {
      if (!prefix) {
        updateNodeData(id, {
          selectedMaterialPrefix: undefined,
          materialProperties: undefined,
          label: 'Material',
        })
        return
      }
      const mat = MATERIAL_FULL_DATA.find((m) => m.prefix === prefix)
      if (mat) {
        updateNodeData(id, {
          selectedMaterialPrefix: prefix,
          materialProperties: mat.properties,
          label: mat.name,
        })
      }
    },
    [id, updateNodeData],
  )

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.toLowerCase()
    return grouped
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (m) => m.name.toLowerCase().includes(q) || m.subcategory.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.entries.length > 0)
  }, [grouped, search])

  return (
    <div
      style={{
        ...s.node,
        minWidth: 240,
        maxWidth: 340,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
    >
      {/* Header */}
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span className="cs-node-header-value" style={s.headerValue}>
          {formatValue(value)}
        </span>
      </div>

      {/* Body: Material picker + property list */}
      <div className="cs-node-body" style={s.body}>
        {/* Search input */}
        <input
          type="text"
          className="nodrag"
          placeholder={t('canvas.materialSearchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.2rem 0.3rem',
            marginBottom: '0.25rem',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.2)',
            color: 'var(--text)',
            fontSize: '0.68rem',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Material dropdown */}
        <select
          className="nodrag"
          style={{
            width: '100%',
            padding: '0.2rem 0.3rem',
            borderRadius: 4,
            border: `1px solid ${selectedPrefix ? 'rgba(255,255,255,0.12)' : 'rgba(251,191,36,0.4)'}`,
            background: 'rgba(0,0,0,0.2)',
            color: selectedPrefix ? '#93c5fd' : 'rgba(244,244,243,0.4)',
            fontSize: '0.7rem',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: 'pointer',
          }}
          value={selectedPrefix}
          onChange={(e) => onSelect(e.target.value || undefined)}
        >
          <option value="">Select material...</option>
          {filteredGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.entries.map((m) => (
                <option key={m.prefix} value={m.prefix}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Property list */}
        {properties.length > 0 && (
          <div style={{ marginTop: '0.35rem' }}>
            {properties.map((p) => (
              <div
                key={p.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: ROW_H,
                  padding: '0 0.15rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {p.meta?.label ?? p.key}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem',
                    color: 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  {formatPropertyValue(p.value)}
                  <span
                    style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-faint)',
                      marginLeft: '0.2rem',
                    }}
                  >
                    {p.meta?.unit ?? ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handles — one per property */}
      {properties.map((p, i) => (
        <Handle
          key={p.key}
          type="source"
          position={Position.Right}
          id={`prop_${p.key}`}
          style={{
            ...s.handleRight,
            top: `${headerOffset() + i * ROW_H + ROW_H / 2}px`,
          }}
          title={p.meta?.label ?? p.key}
        />
      ))}

      {/* Fallback single output when no material selected */}
      {properties.length === 0 && (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />
      )}
    </div>
  )
}

/** Offset in px from top of node to first property row */
function headerOffset(): number {
  // header (~36px) + body padding (~7px) + search input (~26px) + dropdown (~26px) + gap (~8px)
  return 103
}

/** Format a property value compactly */
function formatPropertyValue(v: number): string {
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e9) return (v / 1e9).toPrecision(4) + 'G'
  if (abs >= 1e6) return (v / 1e6).toPrecision(4) + 'M'
  if (abs >= 1e3) return (v / 1e3).toPrecision(4) + 'k'
  if (abs >= 1) return v.toPrecision(4)
  if (abs >= 1e-3) return v.toPrecision(3)
  return v.toExponential(2)
}

export const MaterialNode = memo(MaterialNodeInner)
