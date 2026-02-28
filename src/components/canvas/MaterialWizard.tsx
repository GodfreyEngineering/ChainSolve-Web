/**
 * MaterialWizard — Modal for creating/editing custom materials (D7-5, Pro only).
 *
 * Guided creation flow:
 *   1. Pick a base template (blank, steel-like, aluminium-like, fluid)
 *   2. Name the material
 *   3. Fill numeric property fields (rho, E, nu, mu, k, cp)
 *   4. Validate and save
 */

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import {
  MATERIAL_PROPERTIES,
  MATERIAL_PROPERTY_META,
  generateMaterialId,
  validateMaterialName,
  validateMaterialProperties,
  type CustomMaterial,
  type MaterialProperty,
} from '../../lib/customMaterials'
import { useCustomMaterialsStore } from '../../stores/customMaterialsStore'

// ── Base templates ──────────────────────────────────────────────────────────

interface Template {
  label: string
  properties: Partial<Record<MaterialProperty, number>>
}

const TEMPLATES: Template[] = [
  { label: 'Blank', properties: {} },
  { label: 'Steel-like', properties: { rho: 7850, E: 200e9, nu: 0.3, k: 50, cp: 500 } },
  { label: 'Aluminium-like', properties: { rho: 2700, E: 69e9, nu: 0.33, k: 237, cp: 897 } },
  { label: 'Fluid (water-like)', properties: { rho: 998, mu: 1.002e-3, k: 0.606, cp: 4182 } },
]

// ── Styles ──────────────────────────────────────────────────────────────────

const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 80px 60px',
  gap: '0.4rem',
  alignItems: 'center',
  marginBottom: '0.35rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.3rem 0.4rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'rgba(0,0,0,0.15)',
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  outline: 'none',
}

const unitLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textAlign: 'right',
}

const btnPrimary: React.CSSProperties = {
  padding: '0.5rem 1.2rem',
  borderRadius: 6,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const errorText: React.CSSProperties = {
  color: '#f87171',
  fontSize: '0.75rem',
  marginTop: '0.3rem',
}

const templateBtn: React.CSSProperties = {
  padding: '0.35rem 0.7rem',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'rgba(0,0,0,0.1)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// ── Component ───────────────────────────────────────────────────────────────

interface MaterialWizardProps {
  open: boolean
  onClose: () => void
  /** If provided, edit an existing material instead of creating a new one. */
  editMaterial?: CustomMaterial
}

export function MaterialWizard({ open, onClose, editMaterial }: MaterialWizardProps) {
  const addMaterial = useCustomMaterialsStore((s) => s.addMaterial)
  const updateMaterial = useCustomMaterialsStore((s) => s.updateMaterial)

  const [name, setName] = useState(editMaterial?.name ?? '')
  const [properties, setProperties] = useState<Partial<Record<MaterialProperty, string>>>(
    editMaterial
      ? Object.fromEntries(Object.entries(editMaterial.properties).map(([k, v]) => [k, String(v)]))
      : {},
  )
  const [error, setError] = useState<string | null>(null)

  const applyTemplate = useCallback((tpl: Template) => {
    setProperties(
      Object.fromEntries(Object.entries(tpl.properties).map(([k, v]) => [k, String(v)])),
    )
    setError(null)
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError(null)

      const nameResult = validateMaterialName(name)
      if (!nameResult.ok) {
        setError(nameResult.error!)
        return
      }

      // Parse string values to numbers
      const parsed: Partial<Record<MaterialProperty, number>> = {}
      for (const key of MATERIAL_PROPERTIES) {
        const raw = properties[key]
        if (raw !== undefined && raw.trim() !== '') {
          const n = parseFloat(raw)
          if (isNaN(n)) {
            setError(`${MATERIAL_PROPERTY_META[key].label}: invalid number`)
            return
          }
          parsed[key] = n
        }
      }

      const propsResult = validateMaterialProperties(parsed)
      if (!propsResult.ok) {
        setError(propsResult.error!)
        return
      }

      if (editMaterial) {
        updateMaterial(editMaterial.id, { name: name.trim(), properties: parsed })
      } else {
        addMaterial({ id: generateMaterialId(), name: name.trim(), properties: parsed })
      }
      onClose()
    },
    [name, properties, editMaterial, addMaterial, updateMaterial, onClose],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editMaterial ? 'Edit Custom Material' : 'Create Custom Material'}
      width={420}
    >
      <form onSubmit={handleSubmit}>
        {/* Base template picker */}
        {!editMaterial && (
          <div style={{ marginBottom: '0.8rem' }}>
            <div
              style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}
            >
              Start from template
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  style={templateBtn}
                  onClick={() => applyTemplate(tpl)}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name field */}
        <div style={{ marginBottom: '0.8rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: '0.2rem',
            }}
          >
            Material name
          </label>
          <input
            style={{ ...inputStyle, width: '100%' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Properties table */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div
            style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}
          >
            Properties
          </div>
          {MATERIAL_PROPERTIES.map((key) => {
            const meta = MATERIAL_PROPERTY_META[key]
            return (
              <div key={key} style={fieldRow}>
                <label style={{ fontSize: '0.8rem' }}>{meta.label}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  style={inputStyle}
                  placeholder={meta.placeholder}
                  value={properties[key] ?? ''}
                  onChange={(e) => setProperties((p) => ({ ...p, [key]: e.target.value }))}
                />
                <span style={unitLabel}>{meta.unit}</span>
              </div>
            )
          })}
        </div>

        {error && <div style={errorText}>{error}</div>}

        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}
        >
          <button type="button" style={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={btnPrimary}>
            {editMaterial ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
