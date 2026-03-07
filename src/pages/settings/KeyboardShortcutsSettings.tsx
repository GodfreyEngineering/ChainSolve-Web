import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface ShortcutEntry {
  label: string
  keys: string
}

interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

interface Props {
  cardStyle: React.CSSProperties
}

export function KeyboardShortcutsSettings({ cardStyle }: Props) {
  const { t } = useTranslation()

  const groups: ShortcutGroup[] = useMemo(
    () => [
      {
        title: t('shortcuts.global'),
        entries: [
          { label: t('commandPalette.title'), keys: 'Ctrl+K' },
          { label: t('shortcuts.toggleDock'), keys: 'Ctrl+Shift+D' },
          { label: t('settings.shortcutInspector'), keys: 'Ctrl+J' },
          { label: t('settings.shortcutSave'), keys: 'Ctrl+S' },
          { label: t('settings.shortcutUndo'), keys: 'Ctrl+Z' },
          { label: t('settings.shortcutRedo'), keys: 'Ctrl+Shift+Z' },
        ],
      },
      {
        title: t('shortcuts.canvas'),
        entries: [
          { label: t('shortcuts.groupSelected'), keys: 'Ctrl+G' },
          { label: t('shortcuts.ungroupSelected'), keys: 'Ctrl+Shift+G' },
          { label: t('shortcuts.collapseGroup'), keys: 'Ctrl+Alt+G' },
          { label: t('shortcuts.hideSelected'), keys: 'Space' },
          { label: t('settings.shortcutDelete'), keys: 'Delete' },
          { label: t('settings.shortcutSelectAll'), keys: 'Ctrl+A' },
        ],
      },
    ],
    [t],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {groups.map((group) => (
        <div key={group.title}>
          <h3 style={groupHeadingStyle}>{group.title}</h3>
          <div style={cardStyle}>
            <table style={tableStyle}>
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.keys} style={rowStyle}>
                    <td style={labelCellStyle}>{entry.label}</td>
                    <td style={kbdCellStyle}>
                      <kbd style={kbdStyle}>{entry.keys}</kbd>
                    </td>
                  </tr>
                ))}
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
  padding: '0.4rem 0',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.45rem',
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.75rem',
  color: 'var(--text)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
}
