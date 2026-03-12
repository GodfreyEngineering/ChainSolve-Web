/**
 * KeyboardShortcutsSettings — KB-01: View and edit keyboard shortcuts.
 *
 * Displays all configurable actions grouped by category. Each row has an
 * Edit button that enters capture mode — the next keydown (that is not
 * a bare modifier) becomes the new binding. Conflicts are shown inline.
 * Reset all restores factory defaults.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ACTION_GROUPS,
  ACTION_LABELS,
  DEFAULT_KEYBINDINGS,
  formatKeyboardEvent,
  findConflict,
  isBrowserReserved,
  type KeybindingAction,
  type KeyCombo,
} from '../../lib/keybindings'
import { useAllKeybindings } from '../../hooks/useKeybinding'
import { usePreferencesStore } from '../../stores/preferencesStore'

interface Props {
  cardStyle: React.CSSProperties
}

export function KeyboardShortcutsSettings({ cardStyle }: Props) {
  const allBindings = useAllKeybindings()
  const update = usePreferencesStore((s) => s.update)

  const [capturingAction, setCapturingAction] = useState<KeybindingAction | null>(null)
  const [previewCombo, setPreviewCombo] = useState<KeyCombo | null>(null)
  const [conflictAction, setConflictAction] = useState<KeybindingAction | null>(null)
  const [browserWarning, setBrowserWarning] = useState(false)
  const captureRef = useRef<HTMLDivElement | null>(null)

  const startCapture = useCallback((action: KeybindingAction) => {
    setCapturingAction(action)
    setPreviewCombo(null)
    setConflictAction(null)
    setBrowserWarning(false)
  }, [])

  const cancelCapture = useCallback(() => {
    setCapturingAction(null)
    setPreviewCombo(null)
    setConflictAction(null)
    setBrowserWarning(false)
  }, [])

  const commitCapture = useCallback(
    (action: KeybindingAction, combo: KeyCombo) => {
      const current = usePreferencesStore.getState().keybindings
      update({ keybindings: { ...current, [action]: combo } })
      setCapturingAction(null)
      setPreviewCombo(null)
      setConflictAction(null)
      setBrowserWarning(false)
    },
    [update],
  )

  const resetAll = useCallback(() => {
    update({ keybindings: {} })
  }, [update])

  const resetOne = useCallback(
    (action: KeybindingAction) => {
      const current = usePreferencesStore.getState().keybindings
      const next = { ...current }
      delete next[action]
      update({ keybindings: next })
    },
    [update],
  )

  useEffect(() => {
    if (capturingAction && captureRef.current) {
      captureRef.current.focus()
    }
  }, [capturingAction])

  const handleCaptureKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!capturingAction) return
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        cancelCapture()
        return
      }

      const combo = formatKeyboardEvent(e.nativeEvent)
      if (!combo) return

      const conflict = findConflict(combo, capturingAction, allBindings)
      const reserved = isBrowserReserved(combo)

      setPreviewCombo(combo)
      setConflictAction(conflict)
      setBrowserWarning(reserved)
    },
    [capturingAction, allBindings, cancelCapture],
  )

  const handleCaptureKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!capturingAction || !previewCombo) return
      e.preventDefault()
      commitCapture(capturingAction, previewCombo)
    },
    [capturingAction, previewCombo, commitCapture],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={resetAll}
          style={{
            padding: '0.3rem 0.8rem',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Reset all to defaults
        </button>
      </div>

      {ACTION_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 style={groupHeadingStyle}>{group.title}</h3>
          <div style={cardStyle}>
            <table style={tableStyle}>
              <tbody>
                {group.actions.map((action) => {
                  const currentCombo = allBindings[action]
                  const isDefault = currentCombo === DEFAULT_KEYBINDINGS[action]
                  const isCapturing = capturingAction === action

                  return (
                    <tr key={action} style={rowStyle}>
                      <td style={labelCellStyle}>{ACTION_LABELS[action]}</td>
                      <td style={kbdCellStyle}>
                        {isCapturing ? (
                          <div
                            ref={captureRef}
                            tabIndex={0}
                            onKeyDown={handleCaptureKeyDown}
                            onKeyUp={handleCaptureKeyUp}
                            onBlur={cancelCapture}
                            style={captureBoxStyle}
                          >
                            {previewCombo ? (
                              <>
                                <kbd style={{ ...kbdStyle, opacity: 1 }}>{previewCombo}</kbd>
                                {conflictAction && (
                                  <span style={conflictStyle}>
                                    Conflicts with {ACTION_LABELS[conflictAction]}
                                  </span>
                                )}
                                {browserWarning && (
                                  <span style={warnStyle}>May conflict with browser</span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                                Press new shortcut (Esc to cancel)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <kbd style={kbdStyle}>{currentCombo}</kbd>
                            <button
                              onClick={() => startCapture(action)}
                              style={editBtnStyle}
                              title="Edit shortcut"
                            >
                              Edit
                            </button>
                            {!isDefault && (
                              <button
                                onClick={() => resetOne(action)}
                                style={resetBtnStyle}
                                title="Reset to default"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

const groupHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.5rem 0',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--primary)',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const rowStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
}

const labelCellStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem 0.4rem 0',
  fontSize: '0.85rem',
  color: 'var(--text)',
}

const kbdCellStyle: React.CSSProperties = {
  padding: '0.3rem 0',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  width: '55%',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.45rem',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.75rem',
  color: 'var(--text)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
}

const editBtnStyle: React.CSSProperties = {
  padding: '0.1rem 0.45rem',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
}

const resetBtnStyle: React.CSSProperties = {
  padding: '0.1rem 0.4rem',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
}

const captureBoxStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.2rem 0.5rem',
  border: '1.5px solid var(--primary)',
  borderRadius: 6,
  background: 'var(--surface-1)',
  minWidth: 160,
  justifyContent: 'center',
  outline: 'none',
  cursor: 'pointer',
}

const conflictStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--danger)',
  whiteSpace: 'nowrap',
}

const warnStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--warning)',
  whiteSpace: 'nowrap',
}
