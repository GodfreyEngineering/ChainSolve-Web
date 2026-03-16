/**
 * GroupInspector — property panel for csGroup nodes.
 *
 * Shows group name, color picker (presets + custom hex), notes textarea,
 * member list, and action buttons (collapse/expand, ungroup).
 * All fields are read-only when the user lacks group entitlements.
 */

import { useNodes } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../blocks/types'
import { validateUserLabel } from '../../lib/validateUserString'

const COLOR_PRESETS = [
  '#1CABB0', // teal
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ef4444', // red
  '#22c55e', // green
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#64748b', // slate
]

interface GroupInspectorProps {
  groupId: string
  data: NodeData
  onUpdate: (patch: Partial<NodeData>) => void
  onCollapse: () => void
  onUngroup: () => void
  readOnly: boolean
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '0.28rem 0.45rem',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.2)',
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'rgba(244,244,243,0.4)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '0.2rem',
  userSelect: 'none',
}

const actionBtn: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text)',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
}

export function GroupInspector({
  groupId,
  data,
  onUpdate,
  onCollapse,
  onUngroup,
  readOnly,
}: GroupInspectorProps) {
  const { t } = useTranslation()
  const allNodes = useNodes()
  const members = allNodes.filter((n) => n.parentId === groupId)
  const color = data.groupColor ?? '#1CABB0'
  const collapsed = data.groupCollapsed ?? false

  const field = (label: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '0.7rem' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </div>
  )

  return (
    <>
      {/* Name */}
      {field(
        t('groups.name'),
        <input
          style={inp}
          value={data.label}
          onChange={(e) => {
            if (readOnly) return
            const v = e.target.value
            const result = validateUserLabel(v, { field: 'Group name' })
            if (result.ok || v === '') onUpdate({ label: v })
          }}
          readOnly={readOnly}
        />,
      )}

      {/* Color */}
      {field(
        t('groups.color'),
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => !readOnly && onUpdate({ groupColor: c })}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c,
                border: c === color ? '2px solid #F4F4F3' : '2px solid transparent',
                cursor: readOnly ? 'default' : 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
              title={c}
            />
          ))}
          <input
            type="text"
            style={{
              ...inp,
              width: 70,
              fontSize: '0.72rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            value={color}
            onChange={(e) => {
              if (readOnly) return
              const v = e.target.value
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onUpdate({ groupColor: v })
            }}
            readOnly={readOnly}
            maxLength={7}
          />
        </div>,
      )}

      {/* Notes */}
      {field(
        t('groups.notes'),
        <textarea
          style={{ ...inp, minHeight: 60, resize: 'vertical' }}
          value={data.groupNotes ?? ''}
          placeholder={t('groups.notesPlaceholder')}
          onChange={(e) => !readOnly && onUpdate({ groupNotes: e.target.value })}
          readOnly={readOnly}
        />,
      )}

      {/* Members */}
      {field(
        `${t('groups.members')} (${members.length})`,
        <div
          style={{
            maxHeight: 120,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 6,
            padding: '0.3rem 0.5rem',
          }}
        >
          {members.length === 0 ? (
            <span style={{ color: 'rgba(244,244,243,0.3)', fontSize: '0.75rem' }}>
              {t('groups.noMembers')}
            </span>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                style={{
                  fontSize: '0.75rem',
                  color: 'rgba(244,244,243,0.6)',
                  padding: '0.12rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                />
                {(m.data as NodeData).label}
              </div>
            ))
          )}
        </div>,
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <button
          style={actionBtn}
          onClick={onCollapse}
          title={collapsed ? t('groups.expand') : t('groups.collapse')}
        >
          <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{collapsed ? '▼' : '▶'}</span>
          {collapsed ? t('groups.expand') : t('groups.collapse')}
        </button>
        {!readOnly && (
          <button
            style={{
              ...actionBtn,
              color: 'var(--danger-text)',
              borderColor: 'rgba(239,68,68,0.25)',
            }}
            onClick={onUngroup}
            title={t('groups.ungroup')}
          >
            <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>⊟</span>
            {t('groups.ungroup')}
          </button>
        )}
      </div>
    </>
  )
}
