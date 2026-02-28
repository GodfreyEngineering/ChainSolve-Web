/**
 * SourceNode — for blocks with 0 inputs and 1 output:
 *   Number, Slider, Pi, E, Tau, Phi
 *
 * Shows an editable value or slider in the node body.
 * The single output handle sits on the right edge.
 */

import { memo, useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { useShowValuePopover } from '../../../contexts/ValuePopoverContext'
import { formatValue } from '../../../engine/value'
import { CATEGORY_LABELS, getConstantsCatalog, getMaterialsCatalog } from '../../../blocks/registry'
import type { NodeData } from '../../../blocks/registry'
import { useVariablesStore } from '../../../stores/variablesStore'
import { useCustomMaterialsStore } from '../../../stores/customMaterialsStore'
import { MATERIAL_PROPERTY_META, type MaterialProperty } from '../../../lib/customMaterials'
import { NODE_STYLES as s } from './nodeStyles'

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
          style={{ fontSize: '0.6rem', color: '#f87171', marginBottom: '0.2rem', fontWeight: 600 }}
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
          color: 'rgba(244,244,243,0.5)',
          fontSize: '0.65rem',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onClick={() => setWizardOpen(true)}
      >
        + Create custom...
      </button>
      {wizardOpen && (
        <Suspense fallback={null}>
          <LazyMaterialWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

function SourceNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const showPopover = useShowValuePopover()
  const value = computed.get(id)
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

  // D7-3/D7-4: Catalog grouping helper for unified picker nodes
  const groupCatalog = useCallback(
    (catalog: { type: string; label: string; category: string }[]) => {
      const grouped = new Map<string, typeof catalog>()
      for (const entry of catalog) {
        const group = grouped.get(entry.category) ?? []
        group.push(entry)
        grouped.set(entry.category, group)
      }
      return Array.from(grouped.entries()).map(([cat, entries]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
        entries,
      }))
    },
    [],
  )

  const constantsCatalog = useMemo(
    () => (isConstantPicker ? groupCatalog(getConstantsCatalog()) : []),
    [isConstantPicker, groupCatalog],
  )

  const materialsCatalog = useMemo(
    () => (isMaterialPicker ? groupCatalog(getMaterialsCatalog()) : []),
    [isMaterialPicker, groupCatalog],
  )

  // W12.2: variableSource — sync variable value → node value
  const variables = useVariablesStore((s) => s.variables)
  const varId = nd.varId
  const boundVar = varId ? variables[varId] : undefined

  useEffect(() => {
    if (!isVariableSource) return
    if (varId && !boundVar) {
      // Variable was deleted — set value to NaN to surface error
      if (nd.value === nd.value) updateNodeData(id, { value: NaN })
    } else if (boundVar !== undefined && boundVar.value !== nd.value) {
      updateNodeData(id, { value: boundVar.value })
    }
  }, [isVariableSource, varId, boundVar, nd.value, id, updateNodeData])

  return (
    <div style={{ ...s.node, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          <span
            className="cs-node-header-value cs-value-badge nodrag"
            style={{ ...s.headerValue, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              showPopover(id, e.clientX, e.clientY)
            }}
          >
            {formatValue(value)}
          </span>
        </div>
      </div>

      {isNumber && (
        <div className="cs-node-body" style={s.body}>
          <input
            type="number"
            style={s.numInput}
            value={nd.value ?? 0}
            step="any"
            className="nodrag"
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) updateValue(n)
            }}
          />
        </div>
      )}

      {isSlider && (
        <div className="cs-node-body" style={s.body}>
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
                color: '#f87171',
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
              const selectedVarId = e.target.value || undefined
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
                {v.name} = {v.value}
                {v.unit ? ` ${v.unit}` : ''}
              </option>
            ))}
          </select>
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
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
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
