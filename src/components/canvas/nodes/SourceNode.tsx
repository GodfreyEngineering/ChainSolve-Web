/**
 * SourceNode — for blocks with 0 inputs and 1 output:
 *   Number, Slider, Pi, E, Tau, Phi
 *
 * Shows an editable value or slider in the node body.
 * The single output handle sits on the right edge.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { useShowValuePopover } from '../../../contexts/ValuePopoverContext'
import { formatValue } from '../../../engine/value'
import { CATEGORY_LABELS, getConstantsCatalog, getMaterialsCatalog } from '../../../blocks/registry'
import { CONSTANTS_CATALOG } from '../../../blocks/constantsCatalog'
import type { NodeData } from '../../../blocks/registry'
import { useVariablesStore } from '../../../stores/variablesStore'
import { useCustomMaterialsStore } from '../../../stores/customMaterialsStore'
import { MATERIAL_PROPERTY_META, type MaterialProperty } from '../../../lib/customMaterials'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { usePlan } from '../../../contexts/PlanContext'
import { getEntitlements } from '../../../lib/entitlements'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { useValueFlash } from '../../../hooks/useValueFlash'

const LazyUnitPicker = lazy(() =>
  import('../editors/UnitPicker').then((m) => ({ default: m.UnitPicker })),
)
const LazyMaterialWizard = lazy(() =>
  import('../MaterialWizard').then((m) => ({ default: m.MaterialWizard })),
)

// ── D7-5: Material picker with custom materials ────────────────────────────

/** Parse a custom material selection ID: "custom:<materialId>:<propKey>" */
function parseCustomMaterialId(
  selectedId: string,
): { materialId: string; prop: MaterialProperty } | null {
  const parts = selectedId.split(':')
  if (parts.length === 3 && parts[0] === 'custom') {
    return { materialId: parts[1], prop: parts[2] as MaterialProperty }
  }
  return null
}

function MaterialPickerBody({
  id,
  nd,
  materialsCatalog,
  updateNodeData,
}: {
  id: string
  nd: NodeData
  materialsCatalog: {
    category: string
    label: string
    entries: { type: string; label: string }[]
  }[]
  updateNodeData: (id: string, data: Partial<NodeData>) => void
}) {
  const [wizardOpen, setWizardOpen] = useState(false)
  const { t } = useTranslation()
  const plan = usePlan()
  const canCreate = getEntitlements(plan).canCreateCustomMaterials
  const customMaterials = useCustomMaterialsStore((s) => s.materials)
  const selectedId = (nd.selectedMaterialId as string) ?? ''

  // D7-5: Sync custom material property value when material data changes
  const parsed = selectedId ? parseCustomMaterialId(selectedId) : null
  const customMat = parsed ? customMaterials.find((m) => m.id === parsed.materialId) : undefined
  const customValue = customMat && parsed ? customMat.properties[parsed.prop] : undefined

  useEffect(() => {
    if (!parsed) return
    if (customMat === undefined) {
      // Custom material was deleted — set value to NaN
      if (nd.value === nd.value) updateNodeData(id, { value: NaN })
    } else if (customValue !== undefined && customValue !== nd.value) {
      updateNodeData(id, { value: customValue })
    }
  }, [parsed, customMat, customValue, nd.value, id, updateNodeData])

  const handleChange = (matId: string | undefined) => {
    if (!matId) {
      updateNodeData(id, { selectedMaterialId: undefined, label: 'Material' })
      return
    }
    // Check custom material
    const custom = parseCustomMaterialId(matId)
    if (custom) {
      const mat = customMaterials.find((m) => m.id === custom.materialId)
      const propMeta = MATERIAL_PROPERTY_META[custom.prop]
      updateNodeData(id, {
        selectedMaterialId: matId,
        value: mat?.properties[custom.prop] ?? 0,
        label: `${mat?.name ?? '?'} ${propMeta.label}`,
      })
    } else {
      // Preset material
      const entry = materialsCatalog.flatMap((g) => g.entries).find((m) => m.type === matId)
      updateNodeData(id, {
        selectedMaterialId: matId,
        label: entry?.label ?? 'Material',
      })
    }
  }

  return (
    <div className="cs-node-body" style={s.body}>
      {parsed && !customMat && (
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--danger-text)',
            marginBottom: '0.2rem',
            fontWeight: 600,
          }}
        >
          Custom material deleted
        </div>
      )}
      <select
        className="nodrag"
        style={{
          width: '100%',
          padding: '0.2rem 0.3rem',
          borderRadius: 4,
          border: `1px solid ${selectedId ? (parsed && !customMat ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.12)') : 'rgba(251,191,36,0.4)'}`,
          background: 'rgba(0,0,0,0.2)',
          color: selectedId ? '#93c5fd' : 'rgba(244,244,243,0.4)',
          fontSize: '0.7rem',
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
        }}
        value={selectedId}
        onChange={(e) => handleChange(e.target.value || undefined)}
      >
        <option value="">Select material...</option>
        {materialsCatalog.map((group) => (
          <optgroup key={group.category} label={group.label}>
            {group.entries.map((m) => (
              <option key={m.type} value={m.type}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
        {customMaterials.length > 0 && (
          <optgroup label="Custom">
            {customMaterials.flatMap((mat) =>
              Object.entries(mat.properties)
                .filter(([, v]) => v !== undefined)
                .map(([prop, v]) => {
                  const meta = MATERIAL_PROPERTY_META[prop as MaterialProperty]
                  return (
                    <option key={`custom:${mat.id}:${prop}`} value={`custom:${mat.id}:${prop}`}>
                      {mat.name} {meta?.label ?? prop} ({v})
                    </option>
                  )
                }),
            )}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        className="nodrag"
        style={{
          width: '100%',
          marginTop: '0.25rem',
          padding: '0.15rem 0.3rem',
          borderRadius: 4,
          border: '1px dashed rgba(255,255,255,0.15)',
          background: 'transparent',
          color: canCreate ? 'rgba(244,244,243,0.5)' : 'rgba(244,244,243,0.3)',
          fontSize: '0.65rem',
          cursor: canCreate ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          opacity: canCreate ? 1 : 0.6,
        }}
        onClick={() => canCreate && setWizardOpen(true)}
        title={canCreate ? undefined : t('entitlements.featureLockedTitle')}
      >
        {canCreate ? t('canvas.createCustomMaterial') : t('canvas.createCustomMaterialPro')}
      </button>
      {wizardOpen && canCreate && (
        <Suspense fallback={null}>
          <LazyMaterialWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

// ── BUG-01: Raw-string number input with scroll-to-increment ──────────────

function NumberInputBody({
  value,
  unit,
  onCommit,
  onUnitChange,
  step = 1,
  min,
  max,
  onSwitchToVariable,
  onSwitchToConstant,
}: {
  value: number
  unit?: string
  onCommit: (v: number) => void
  onUnitChange: (unitId: string | undefined) => void
  step?: number
  min?: number
  max?: number
  /** UX-01: Switch this node to variable-binding mode */
  onSwitchToVariable?: () => void
  /** UX-01: Switch this node to constant-picker mode */
  onSwitchToConstant?: () => void
}) {
  // raw holds the user's in-progress string; null means "use external value"
  const [raw, setRaw] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // UX-01: Right-click context menu state
  const [inputMenu, setInputMenu] = useState<{ x: number; y: number } | null>(null)

  // When raw is null we show the committed value from props.
  // raw becomes non-null only on focus; cleared on blur/commit.
  const displayValue = raw ?? String(value)

  const commit = useCallback(
    (str: string) => {
      const trimmed = str.trim()
      if (trimmed === '' || trimmed === '-') {
        setError(true)
        return
      }
      const n = parseFloat(trimmed)
      if (isNaN(n)) {
        setError(true)
        return
      }
      const clamped =
        min !== undefined && max !== undefined
          ? Math.min(max, Math.max(min, n))
          : min !== undefined
            ? Math.max(min, n)
            : max !== undefined
              ? Math.min(max, n)
              : n
      setError(false)
      setRaw(null)
      onCommit(clamped)
    },
    [onCommit, min, max],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? step : -step
      const next = value + delta
      const clamped =
        min !== undefined && max !== undefined
          ? Math.min(max, Math.max(min, next))
          : min !== undefined
            ? Math.max(min, next)
            : max !== undefined
              ? Math.min(max, next)
              : next
      onCommit(clamped)
    },
    [value, step, min, max, onCommit],
  )

  return (
    <div className="cs-node-body" style={s.body}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          style={{
            ...s.numInput,
            flex: 1,
            borderColor: error ? 'var(--danger, #f87171)' : undefined,
            outline: error ? '1px solid var(--danger, #f87171)' : undefined,
          }}
          value={displayValue}
          className="nodrag"
          title={error ? 'Enter a numeric value' : undefined}
          onChange={(e) => {
            setRaw(e.target.value)
            setError(false)
          }}
          onFocus={(e) => {
            setRaw(String(value))
            e.target.select()
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              setRaw(null)
              setError(false)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          onWheel={onWheel}
          onContextMenu={(e) => {
            if (!onSwitchToVariable && !onSwitchToConstant) return
            e.preventDefault()
            e.stopPropagation()
            setInputMenu({ x: e.clientX, y: e.clientY })
          }}
        />
        <Suspense fallback={null}>
          <LazyUnitPicker compact value={unit} onChange={(unitId) => onUnitChange(unitId)} />
        </Suspense>
      </div>
      {error && (
        <span style={{ fontSize: '0.6rem', color: 'var(--danger, #f87171)', marginTop: '0.15rem' }}>
          Enter a numeric value
        </span>
      )}
      {/* UX-01: Input mode context menu */}
      {inputMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1998 }}
            onClick={() => setInputMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setInputMenu(null)
            }}
          />
          <div
            className="nodrag"
            style={{
              position: 'fixed',
              left: inputMenu.x,
              top: inputMenu.y,
              zIndex: 1999,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0.25rem',
              minWidth: 160,
              boxShadow: 'var(--shadow-lg)',
              fontSize: '0.8rem',
            }}
          >
            <div
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 4,
                cursor: 'default',
                opacity: 0.5,
              }}
            >
              ✎ Set literal
            </div>
            {onSwitchToVariable && (
              <div
                style={{ padding: '0.35rem 0.75rem', borderRadius: 4, cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--menu-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
                onClick={() => {
                  setInputMenu(null)
                  onSwitchToVariable()
                }}
              >
                𝑥 Bind to variable…
              </div>
            )}
            {onSwitchToConstant && (
              <div
                style={{ padding: '0.35rem 0.75rem', borderRadius: 4, cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'var(--menu-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
                onClick={() => {
                  setInputMenu(null)
                  onSwitchToConstant()
                }}
              >
                π Bind to constant…
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SourceNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const value = useComputedValue(id)
  const showPopover = useShowValuePopover()
  const flashing = useValueFlash(value)
  const isLocked = draggable === false

  const updateVarValue = useVariablesStore((s) => s.updateValue)
  const updateValue = useCallback(
    (v: number) => {
      updateNodeData(id, { value: v })
      // W12.2: Two-way slider→variable binding
      const nodeData = data as NodeData
      if (nodeData.varId) updateVarValue(nodeData.varId, v)
    },
    [id, data, updateNodeData, updateVarValue],
  )

  const isSlider = nd.blockType === 'slider'
  const isNumber = nd.blockType === 'number'
  const isVariableSource = nd.blockType === 'variableSource'
  const isConstantPicker = nd.blockType === 'constant'
  const isMaterialPicker = nd.blockType === 'material'
  const isEditable =
    isSlider || isNumber || isVariableSource || isConstantPicker || isMaterialPicker

  const constantsCatalog = useMemo(() => {
    if (!isConstantPicker) return []
    const catalog = getConstantsCatalog()
    const descMap = new Map(CONSTANTS_CATALOG.map((c) => [c.type, c.description]))
    const grouped = new Map<string, { type: string; label: string; description: string }[]>()
    for (const entry of catalog) {
      const group = grouped.get(entry.category) ?? []
      group.push({ ...entry, description: descMap.get(entry.type) ?? '' })
      grouped.set(entry.category, group)
    }
    return Array.from(grouped.entries()).map(([cat, entries]) => ({
      category: cat,
      label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      entries,
    }))
  }, [isConstantPicker])

  const materialsCatalog = useMemo(() => {
    if (!isMaterialPicker) return []
    const catalog = getMaterialsCatalog()
    const grouped = new Map<string, { type: string; label: string }[]>()
    for (const entry of catalog) {
      const group = grouped.get(entry.subcategory) ?? []
      group.push({ type: entry.type, label: entry.label })
      grouped.set(entry.subcategory, group)
    }
    return Array.from(grouped.entries()).map(([sub, entries]) => ({
      category: sub,
      label: sub,
      entries,
    }))
  }, [isMaterialPicker])

  // W12.2: variableSource — sync variable value → node value
  const variables = useVariablesStore((s) => s.variables)
  const varId = nd.varId
  const boundVar = varId ? variables[varId] : undefined

  useEffect(() => {
    if (!isVariableSource) return
    if (varId && !boundVar) {
      // Variable was deleted — set value to NaN to surface error
      if (nd.value === nd.value) updateNodeData(id, { value: NaN })
    } else if (boundVar !== undefined) {
      // Phase 11: Sync both value and name (rename propagation)
      const updates: Partial<NodeData> = {}
      if (boundVar.value !== nd.value) updates.value = boundVar.value
      if (boundVar.name !== nd.label) updates.label = boundVar.name
      if (Object.keys(updates).length > 0) updateNodeData(id, updates)
    }
  }, [isVariableSource, varId, boundVar, nd.value, nd.label, id, updateNodeData])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const ariaLabel = `${nd.label} block, output: ${formatValue(value)}`

  return (
    <div
      style={{
        ...s.node,
        ...userColorBg(nd.userColor),
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          <span
            className={`cs-node-header-value cs-value-badge nodrag${flashing ? ' cs-flashing' : ''}`}
            style={{ ...s.headerValue, color: typeColor, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              showPopover(id, e.clientX, e.clientY)
            }}
          >
            {formatValue(value)}
            {nd.unit && (
              <span style={{ fontSize: '0.6rem', marginLeft: '0.15rem', opacity: 0.7 }}>
                {getUnitSymbol(nd.unit)}
              </span>
            )}
          </span>
        </div>
      </div>

      {isNumber && (
        <NumberInputBody
          value={nd.value ?? 0}
          unit={nd.unit as string | undefined}
          onCommit={updateValue}
          onUnitChange={(unitId) => updateNodeData(id, { unit: unitId })}
          step={nd.step as number | undefined}
          min={nd.min as number | undefined}
          max={nd.max as number | undefined}
          onSwitchToVariable={() =>
            updateNodeData(id, { blockType: 'variableSource', label: 'Variable', varId: undefined })
          }
          onSwitchToConstant={() =>
            updateNodeData(id, {
              blockType: 'constant',
              label: 'Constant',
              selectedConstantId: undefined,
            })
          }
        />
      )}

      {isSlider && (
        <div className="cs-node-body" style={s.body}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              marginBottom: '0.15rem',
            }}
          >
            <span style={{ flex: 1 }} />
            <Suspense fallback={null}>
              <LazyUnitPicker
                compact
                value={nd.unit as string | undefined}
                onChange={(unitId) => updateNodeData(id, { unit: unitId })}
              />
            </Suspense>
          </div>
          <input
            type="range"
            className="nodrag"
            style={{ width: '100%', accentColor: 'var(--primary)' }}
            min={nd.min ?? 0}
            max={nd.max ?? 100}
            step={nd.step ?? 1}
            value={nd.value ?? 0}
            onChange={(e) => updateValue(parseFloat(e.target.value))}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              opacity: 0.5,
            }}
          >
            <span>{nd.min ?? 0}</span>
            <span style={{ fontWeight: 600, opacity: 1 }}>{nd.value ?? 0}</span>
            <span>{nd.max ?? 100}</span>
          </div>
        </div>
      )}

      {isVariableSource && (
        <div className="cs-node-body" style={s.body}>
          {varId && !boundVar && (
            <div
              style={{
                fontSize: '0.6rem',
                color: 'var(--danger-text)',
                marginBottom: '0.2rem',
                fontWeight: 600,
              }}
            >
              Variable deleted
            </div>
          )}
          <select
            className="nodrag"
            style={{
              width: '100%',
              padding: '0.2rem 0.3rem',
              borderRadius: 4,
              border: `1px solid ${varId && !boundVar ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(0,0,0,0.2)',
              color: varId && boundVar ? '#93c5fd' : 'rgba(244,244,243,0.4)',
              fontSize: '0.7rem',
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
            value={varId ?? ''}
            onChange={(e) => {
              const val = e.target.value
              if (val === '__create__') {
                const newId = crypto.randomUUID()
                const count = Object.keys(variables).length
                const newVar = {
                  id: newId,
                  name: `var${count + 1}`,
                  value: 0,
                }
                useVariablesStore.getState().setVariable(newVar)
                updateNodeData(id, {
                  varId: newId,
                  value: 0,
                  label: newVar.name,
                })
                return
              }
              const selectedVarId = val || undefined
              const selectedVar = selectedVarId ? variables[selectedVarId] : undefined
              updateNodeData(id, {
                varId: selectedVarId,
                value: selectedVar?.value ?? 0,
                label: selectedVar?.name ?? 'Variable',
              })
            }}
          >
            <option value="">Select variable...</option>
            {Object.values(variables).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.unit ? ` (${v.unit})` : ''}
              </option>
            ))}
            <option value="__create__">+ New variable</option>
          </select>
          {boundVar && (
            <div
              style={{
                marginTop: '0.25rem',
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.25rem',
                padding: '0.15rem 0.3rem',
                borderRadius: 4,
                background: 'rgba(28,171,176,0.08)',
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                }}
              >
                {boundVar.value}
              </span>
              {boundVar.unit && (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {boundVar.unit}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {isConstantPicker && (
        <div className="cs-node-body" style={s.body}>
          <select
            className="nodrag"
            style={{
              width: '100%',
              padding: '0.2rem 0.3rem',
              borderRadius: 4,
              border: `1px solid ${nd.selectedConstantId ? 'rgba(255,255,255,0.12)' : 'rgba(251,191,36,0.4)'}`,
              background: 'rgba(0,0,0,0.2)',
              color: nd.selectedConstantId ? '#93c5fd' : 'rgba(244,244,243,0.4)',
              fontSize: '0.7rem',
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
            value={(nd.selectedConstantId as string) ?? ''}
            onChange={(e) => {
              const constId = e.target.value || undefined
              const entry = constantsCatalog
                .flatMap((g) => g.entries)
                .find((c) => c.type === constId)
              updateNodeData(id, {
                selectedConstantId: constId,
                label: entry?.label ?? 'Constant',
              })
            }}
          >
            <option value="">Select constant...</option>
            {constantsCatalog.map((group) => (
              <optgroup key={group.category} label={group.label}>
                {group.entries.map((c) => (
                  <option key={c.type} value={c.type} title={c.description}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {nd.selectedConstantId &&
            (() => {
              const catEntry = CONSTANTS_CATALOG.find((c) => c.type === nd.selectedConstantId)
              if (!catEntry) return null
              const fullPrecision = catEntry.value.toPrecision(17)
              return (
                <div
                  style={{
                    fontSize: '0.6rem',
                    color: 'rgba(244,244,243,0.5)',
                    marginTop: '0.25rem',
                    lineHeight: 1.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem',
                  }}
                >
                  {/* PREC-03: Full f64 value */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--primary)',
                      fontSize: '0.62rem',
                    }}
                  >
                    {catEntry.symbol ? `${catEntry.symbol} = ` : ''}
                    {fullPrecision}
                    {catEntry.unit ? ` ${catEntry.unit}` : ''}
                  </span>
                  {catEntry.description && <span>{catEntry.description}</span>}
                  {/* PREC-03: Uncertainty and source */}
                  <span style={{ opacity: 0.7 }}>
                    {catEntry.uncertainty ? `\u00B1 ${catEntry.uncertainty}` : ''}
                    {catEntry.uncertainty && catEntry.source ? ' \u2022 ' : ''}
                    {catEntry.source ?? ''}
                  </span>
                </div>
              )
            })()}
        </div>
      )}

      {isMaterialPicker && (
        <MaterialPickerBody
          id={id}
          nd={nd}
          materialsCatalog={materialsCatalog}
          updateNodeData={updateNodeData}
        />
      )}

      {!isEditable && (
        <div className="cs-node-body" style={s.body}>
          <span style={s.constValue}>{formatValue(value)}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="out" style={s.handleRight} />
    </div>
  )
}

export const SourceNode = memo(SourceNodeInner)
