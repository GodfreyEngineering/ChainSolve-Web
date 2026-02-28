import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import type { PaletteAction } from '../../lib/actions'

interface Props {
  open: boolean
  onClose: () => void
  actions: PaletteAction[]
}

export function KeyboardShortcutsModal({ open, onClose, actions }: Props) {
  const { t } = useTranslation()

  // Group all actions that carry a keyboard shortcut.
  // A static "Global" group is prepended for shortcuts that live outside the
  // menu system (e.g. Ctrl+K for the command palette).
  const groups = useMemo(() => {
    const globalGroup = t('shortcuts.global')
    const globalActions: PaletteAction[] = [
      {
        id: 'global:commandPalette',
        label: t('commandPalette.title'),
        group: globalGroup,
        shortcut: 'Ctrl+K',
        disabled: false,
        execute: () => {},
      },
    ]

    const withShortcut = actions.filter((a) => a.shortcut)
    const all = [...globalActions, ...withShortcut]

    const map = new Map<string, PaletteAction[]>()
    for (const a of all) {
      const existing = map.get(a.group) ?? []
      map.set(a.group, [...existing, a])
    }
    return [...map.entries()]
  }, [actions, t])

  return (
    <Modal open={open} onClose={onClose} title={t('menu.keyboardShortcuts')} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {groups.map(([group, items]) => (
          <section key={group}>
            <h3 style={groupHeadingStyle}>{group}</h3>
            <table style={tableStyle}>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} style={rowStyle}>
                    <td style={labelCellStyle}>{a.label}</td>
                    <td style={kbdCellStyle}>
                      <kbd style={kbdStyle}>{a.shortcut}</kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  padding: '0.35rem 0.5rem 0.35rem 0',
  fontSize: '0.85rem',
  color: 'var(--text)',
}

const kbdCellStyle: React.CSSProperties = {
  padding: '0.35rem 0',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.45rem',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
  color: 'var(--text)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
}
