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
  CUSTOM_MATERIAL_CATEGORIES,
  CUSTOM_MATERIAL_CATEGORY_LABELS,
  generateMaterialId,
  validateMaterialName,
  validateMaterialDescription,
  validateMaterialProperties,
  type CustomMaterial,
  type CustomMaterialCategory,
  type MaterialProperty,
} from '../../lib/customMaterials'
import { useTranslation } from 'react-i18next'
import { useCustomMaterialsStore } from '../../stores/customMaterialsStore'

// ── Base templates ──────────────────────────────────────────────────────────

interface Template {
  labelKey: string
  fallback: string
  properties: Partial<Record<MaterialProperty, number>>
  defaultCategory?: CustomMaterialCategory
}

const TEMPLATES: Template[] = [
  { labelKey: 'materialWizard.tplBlank', fallback: 'Blank', properties: {} },
  {
    labelKey: 'materialWizard.tplSteel',
    fallback: 'Steel-like',
    properties: { rho: 7850, E: 200e9, nu: 0.3, k: 50, cp: 500 },
    defaultCategory: 'metal',
  },
  {
    labelKey: 'materialWizard.tplAluminium',
    fallback: 'Aluminium-like',
    properties: { rho: 2700, E: 69e9, nu: 0.33, k: 237, cp: 897 },
    defaultCategory: 'metal',
  },
  {
    labelKey: 'materialWizard.tplFluid',
    fallback: 'Fluid (water-like)',
    properties: { rho: 998, mu: 1.002e-3, k: 0.606, cp: 4182 },
    defaultCategory: 'fluid',
  },
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
  color: 'var(--color-on-primary)',
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
  color: 'var(--danger-text)',
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
  const { t } = useTranslation()
  const addMaterial = useCustomMaterialsStore((s) => s.addMaterial)
  const updateMaterial = useCustomMaterialsStore((s) => s.updateMaterial)

  const [name, setName] = useState(editMaterial?.name ?? '')
  const [description, setDescription] = useState(editMaterial?.description ?? '')
  const [category, setCategory] = useState<CustomMaterialCategory>(
    editMaterial?.category ?? 'other',
  )
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
    if (tpl.defaultCategory) setCategory(tpl.defaultCategory)
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

      const descResult = validateMaterialDescription(description)
      if (!descResult.ok) {
        setError(descResult.error!)
        return
      }

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

      const trimmedDesc = description.trim() || undefined
      if (editMaterial) {
        updateMaterial(editMaterial.id, {
          name: name.trim(),
          description: trimmedDesc,
          category,
          properties: parsed,
        })
      } else {
        addMaterial({
          id: generateMaterialId(),
          name: name.trim(),
          description: trimmedDesc,
          category,
          properties: parsed,
        })
      }
      onClose()
    },
    [name, description, category, properties, editMaterial, addMaterial, updateMaterial, onClose],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editMaterial
          ? t('materialWizard.editTitle', 'Edit Custom Material')
          : t('materialWizard.createTitle', 'Create Custom Material')
      }
      width={420}
    >
      <form onSubmit={handleSubmit}>
        {/* Base template picker */}
        {!editMaterial && (
          <div style={{ marginBottom: '0.8rem' }}>
            <div
              style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}
            >
              {t('materialWizard.startFromTemplate', 'Start from template')}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.labelKey}
                  type="button"
                  style={templateBtn}
                  onClick={() => applyTemplate(tpl)}
                >
                  {t(tpl.labelKey, tpl.fallback)}
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
            {t('materialWizard.nameLabel', 'Material name')}
          </label>
          <input
            style={{ ...inputStyle, width: '100%' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Description field */}
        <div style={{ marginBottom: '0.8rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: '0.2rem',
            }}
          >
            {t('materialWizard.descriptionLabel', 'Description')}
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: '0.3rem' }}>
              {t('materialWizard.optional', '(optional)')}
            </span>
          </label>
          <input
            style={{ ...inputStyle, width: '100%' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('materialWizard.descriptionPlaceholder', 'e.g. Grade 304, annealed')}
          />
        </div>

        {/* Category field */}
        <div style={{ marginBottom: '0.8rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: '0.2rem',
            }}
          >
            {t('materialWizard.categoryLabel', 'Category')}
          </label>
          <select
            style={{
              ...inputStyle,
              width: '100%',
              cursor: 'pointer',
            }}
            value={category}
            onChange={(e) => setCategory(e.target.value as CustomMaterialCategory)}
          >
            {CUSTOM_MATERIAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CUSTOM_MATERIAL_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        {/* Properties table */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div
            style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}
          >
            {t('materialWizard.propertiesLabel', 'Properties')}
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
            {t('materialWizard.cancel', 'Cancel')}
          </button>
          <button type="submit" style={btnPrimary}>
            {editMaterial ? t('materialWizard.save', 'Save') : t('materialWizard.create', 'Create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
