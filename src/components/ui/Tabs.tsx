interface Tab {
  key: string
  label: string
  icon?: string
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  style?: React.CSSProperties
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  borderBottom: '1px solid var(--border)',
  paddingBottom: 0,
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'inherit',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    padding: '0.55rem 0.85rem',
    fontSize: '0.85rem',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  }
}

export function Tabs({ tabs, active, onChange, style }: TabsProps) {
  return (
    <div style={{ ...barStyle, ...style }} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === active}
          style={tabStyle(tab.key === active)}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
