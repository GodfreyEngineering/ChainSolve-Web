/**
 * RecentPanel — sidebar tab showing recently opened projects.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { getRecentProjects, removeRecentProject } from '../../../lib/recentProjects'
import { listProjects, type ProjectRow } from '../../../lib/projects'
import { Icon } from '../../ui/Icon'

interface RecentPanelProps {
  onOpenProject: (projectId: string) => void
}

export function RecentPanel({ onOpenProject }: RecentPanelProps) {
  const { t } = useTranslation()
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentProjects().map((r) => r.id))
  const [projects, setProjects] = useState<Map<string, ProjectRow>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listProjects()
      .then((rows) => {
        const map = new Map<string, ProjectRow>()
        for (const r of rows) map.set(r.id, r)
        setProjects(map)

        // Prune stale entries that no longer exist in DB
        const currentIds = getRecentProjects().map((r) => r.id)
        const staleIds = currentIds.filter((id) => !map.has(id))
        if (staleIds.length > 0) {
          for (const id of staleIds) removeRecentProject(id)
          setRecentIds(getRecentProjects().map((r) => r.id))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const recentProjects = recentIds
    .map((id) => projects.get(id))
    .filter((p): p is ProjectRow => p !== undefined)

  if (loading) {
    return <div style={emptyStyle}>{t('home.loadingProjects', 'Loading...')}</div>
  }

  if (recentProjects.length === 0) {
    return (
      <div style={emptyStyle}>
        <Icon icon={Clock} size={24} style={{ color: 'var(--text-faint)', opacity: 0.4 }} />
        <div style={{ marginTop: 8 }}>{t('sidebar.noRecent', 'No recent projects')}</div>
        <div style={{ fontSize: '0.68rem', opacity: 0.5, marginTop: 2 }}>
          {t('sidebar.noRecentHint', 'Projects you open will appear here')}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0.3rem' }}>
      {recentProjects.map((proj) => (
        <div
          key={proj.id}
          style={rowStyle}
          onClick={() => onOpenProject(proj.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onOpenProject(proj.id)}
        >
          <span style={nameStyle}>{proj.name}</span>
          <span style={dateStyle}>{fmtRelative(proj.updated_at)}</span>
        </div>
      ))}
    </div>
  )
}

function fmtRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  fontSize: '0.78rem',
  color: 'var(--text-faint)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.4rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  margin: '1px 0',
  transition: 'background 0.1s',
}

const nameStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const dateStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
  flexShrink: 0,
}
