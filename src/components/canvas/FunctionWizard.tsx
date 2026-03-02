/**
 * FunctionWizard — Modal for creating/editing custom function blocks (H5-1, Pro only).
 *
 * Guided creation flow:
 *   1. Name the function
 *   2. Add description (optional)
 *   3. Pick a tag (math, physics, engineering, etc.)
 *   4. Define inputs (id + label)
 *   5. Write the formula expression
 *   6. Validate and save
 */

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import {
  CUSTOM_FUNCTION_TAGS,
  CUSTOM_FUNCTION_TAG_LABELS,
  MAX_FUNCTION_INPUTS,
  validateFunctionName,
  validateFunctionDescription,
  validateFunctionFormula,
  validateFunctionInputs,
  generateFunctionId,
  type CustomFunction,
  type CustomFunctionInput,
  type CustomFunctionTag,
} from '../../lib/customFunctions'
import { useTranslation } from 'react-i18next'
import { useCustomFunctionsStore } from '../../stores/customFunctionsStore'
import { registerCustomFunction } from '../../blocks/registry'

// ── Styles ──────────────────────────────────────────────────────────────────

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  marginBottom: '0.2rem',
}

const inputRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '80px 1fr 28px',
  gap: '0.3rem',
  alignItems: 'center',
  marginBottom: '0.25rem',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '0.15rem 0.4rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.7rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// ── Component ───────────────────────────────────────────────────────────────

interface FunctionWizardProps {
  open: boolean
  onClose: () => void
  editFunction?: CustomFunction
}

export function FunctionWizard({ open, onClose, editFunction }: FunctionWizardProps) {
  const { t } = useTranslation()
  const addFunction = useCustomFunctionsStore((s) => s.addFunction)
  const updateFunction = useCustomFunctionsStore((s) => s.updateFunction)

  const [name, setName] = useState(editFunction?.name ?? '')
  const [description, setDescription] = useState(editFunction?.description ?? '')
  const [tag, setTag] = useState<CustomFunctionTag>(editFunction?.tag ?? 'math')
  const [inputs, setInputs] = useState<CustomFunctionInput[]>(
    editFunction?.inputs ?? [{ id: 'a', label: 'A' }],
  )
  const [formula, setFormula] = useState(editFunction?.formula ?? '')
  const [unit, setUnit] = useState(editFunction?.unit ?? '')
  const [error, setError] = useState<string | null>(null)

  const addInput = useCallback(() => {
    if (inputs.length >= MAX_FUNCTION_INPUTS) return
    const nextId = String.fromCharCode(97 + inputs.length) // a, b, c, ...
    setInputs((prev) => [...prev, { id: nextId, label: nextId.toUpperCase() }])
  }, [inputs.length])

  const removeInput = useCallback(
    (index: number) => {
      if (inputs.length <= 1) return
      setInputs((prev) => prev.filter((_, i) => i !== index))
    },
    [inputs.length],
  )

  const updateInput = useCallback((index: number, field: 'id' | 'label', value: string) => {
    setInputs((prev) => prev.map((inp, i) => (i === index ? { ...inp, [field]: value } : inp)))
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError(null)

      const nameResult = validateFunctionName(name)
      if (!nameResult.ok) {
        setError(nameResult.error!)
        return
      }

      const descResult = validateFunctionDescription(description)
      if (!descResult.ok) {
        setError(descResult.error!)
        return
      }

      const inputsResult = validateFunctionInputs(inputs)
      if (!inputsResult.ok) {
        setError(inputsResult.error!)
        return
      }

      const formulaResult = validateFunctionFormula(formula)
      if (!formulaResult.ok) {
        setError(formulaResult.error!)
        return
      }

      const trimmedDesc = description.trim() || undefined
      const trimmedUnit = unit.trim() || undefined
      const fn: CustomFunction = {
        id: editFunction?.id ?? generateFunctionId(),
        name: name.trim(),
        description: trimmedDesc,
        tag,
        inputs: inputs.map((inp) => ({ id: inp.id.trim(), label: inp.label.trim() })),
        formula: formula.trim(),
        unit: trimmedUnit,
      }

      if (editFunction) {
        updateFunction(editFunction.id, fn)
      } else {
        addFunction(fn)
      }
      registerCustomFunction(fn)
      onClose()
    },
    [
      name,
      description,
      tag,
      inputs,
      formula,
      unit,
      editFunction,
      addFunction,
      updateFunction,
      onClose,
    ],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editFunction
          ? t('functionWizard.editTitle', 'Edit Custom Function')
          : t('functionWizard.createTitle', 'Create Custom Function')
      }
      width={460}
    >
      <form onSubmit={handleSubmit}>
        {/* Name field */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>{t('functionWizard.nameLabel', 'Function name')}</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('functionWizard.namePlaceholder', 'e.g. Beam deflection')}
            autoFocus
          />
        </div>

        {/* Description field */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>
            {t('functionWizard.descriptionLabel', 'Description')}
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: '0.3rem' }}>
              {t('functionWizard.optional', '(optional)')}
            </span>
          </label>
          <input
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('functionWizard.descPlaceholder', 'e.g. PL^3 / (48 * E * I)')}
          />
        </div>

        {/* Tag field */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>{t('functionWizard.tagLabel', 'Category')}</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={tag}
            onChange={(e) => setTag(e.target.value as CustomFunctionTag)}
          >
            {CUSTOM_FUNCTION_TAGS.map((t_) => (
              <option key={t_} value={t_}>
                {CUSTOM_FUNCTION_TAG_LABELS[t_]}
              </option>
            ))}
          </select>
        </div>

        {/* Inputs definition */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>
            {t('functionWizard.inputsLabel', 'Inputs')}
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: '0.3rem' }}>
              ({inputs.length}/{MAX_FUNCTION_INPUTS})
            </span>
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 28px',
              gap: '0.3rem',
              marginBottom: '0.15rem',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>{t('functionWizard.inputId', 'ID')}</span>
            <span>{t('functionWizard.inputLabel', 'Label')}</span>
            <span />
          </div>
          {inputs.map((inp, i) => (
            <div key={i} style={inputRowStyle}>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace' }}
                value={inp.id}
                onChange={(e) => updateInput(i, 'id', e.target.value)}
                placeholder="x"
              />
              <input
                style={inputStyle}
                value={inp.label}
                onChange={(e) => updateInput(i, 'label', e.target.value)}
                placeholder="X"
              />
              <button
                type="button"
                style={{
                  ...smallBtnStyle,
                  opacity: inputs.length <= 1 ? 0.3 : 1,
                  cursor: inputs.length <= 1 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => removeInput(i)}
                disabled={inputs.length <= 1}
                title={t('functionWizard.removeInput', 'Remove input')}
              >
                x
              </button>
            </div>
          ))}
          {inputs.length < MAX_FUNCTION_INPUTS && (
            <button type="button" style={smallBtnStyle} onClick={addInput}>
              + {t('functionWizard.addInput', 'Add input')}
            </button>
          )}
        </div>

        {/* Formula field */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>{t('functionWizard.formulaLabel', 'Formula')}</label>
          <input
            style={{ ...inputStyle, fontFamily: 'monospace' }}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder={t('functionWizard.formulaPlaceholder', 'e.g. a * b^2 / (2 * c)')}
          />
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {t(
              'functionWizard.formulaHint',
              'Use input IDs as variables. Supports +, -, *, /, ^, sqrt(), sin(), cos(), abs(), min(), max(), pi, e',
            )}
          </div>
        </div>

        {/* Unit field */}
        <div style={{ marginBottom: '0.7rem' }}>
          <label style={labelStyle}>
            {t('functionWizard.unitLabel', 'Default unit')}
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: '0.3rem' }}>
              {t('functionWizard.optional', '(optional)')}
            </span>
          </label>
          <input
            style={inputStyle}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('functionWizard.unitPlaceholder', 'e.g. m, N, Pa')}
          />
        </div>

        {error && <div style={errorText}>{error}</div>}

        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}
        >
          <button type="button" style={btnSecondary} onClick={onClose}>
            {t('functionWizard.cancel', 'Cancel')}
          </button>
          <button type="submit" style={btnPrimary}>
            {editFunction ? t('functionWizard.save', 'Save') : t('functionWizard.create', 'Create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
