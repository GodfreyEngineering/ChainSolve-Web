/**
 * SaveAsDialog — "Save As" modal with project name input.
 *
 * Pre-fills with the current project name + " (copy)".
 * Enter confirms, Escape closes. Confirm disabled while saving.
 */

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'

interface SaveAsDialogProps {
  open: boolean
  onClose: () => void
  currentName: string
  onConfirm: (newName: string) => void
  saving: boolean
}

export function SaveAsDialog({ open, onClose, currentName, onConfirm, saving }: SaveAsDialogProps) {
  if (!open) return null
  return (
    <SaveAsDialogInner
      onClose={onClose}
      currentName={currentName}
      onConfirm={onConfirm}
      saving={saving}
    />
  )
}

function SaveAsDialogInner({
  onClose,
  currentName,
  onConfirm,
  saving,
}: Omit<SaveAsDialogProps, 'open'>) {
  const { t } = useTranslation()
  const [name, setName] = useState(`${currentName} (copy)`)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const canConfirm = name.trim().length > 0 && !saving

  const handleConfirm = () => {
    if (canConfirm) onConfirm(name.trim())
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <Modal open onClose={onClose} title={t('project.saveAs')} width={400}>
      <label
        style={{
          display: 'block',
          fontSize: '0.78rem',
          fontWeight: 600,
          marginBottom: '0.4rem',
          color: 'var(--text-muted)',
        }}
      >
        {t('project.nameLabel')}
      </label>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={saving}
        style={{
          width: '100%',
          padding: '0.45rem 0.65rem',
          fontSize: '0.85rem',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          marginBottom: '1rem',
        }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={cancelBtnStyle}>
          {t('project.cancel')}
        </button>
        <button onClick={handleConfirm} disabled={!canConfirm} style={confirmBtnStyle(!canConfirm)}>
          {saving ? '…' : t('project.confirm')}
        </button>
      </div>
    </Modal>
  )
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
}

function confirmBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.9rem',
    borderRadius: 6,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    background: disabled ? 'rgba(28,171,176,0.3)' : 'var(--primary)',
    color: '#fff',
    border: 'none',
    opacity: disabled ? 0.6 : 1,
  }
}
