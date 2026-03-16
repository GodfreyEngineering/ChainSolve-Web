/**
 * RecentProjectsGrid — horizontal scrollable row of recent project cards
 * shown on the WelcomeCanvas landing page.
 *
 * Reuses the same localStorage + DB cross-reference logic as RecentPanel.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen } from 'lucide-react'
import { getRecentProjects, pruneRecentProjects } from '../../lib/recentProjects'
import { listProjects, type ProjectRow } from '../../lib/projects'
import { Skeleton } from '../ui/Skeleton'
import { Icon } from '../ui/Icon'

interface RecentProjectsGridProps {
  onOpenProject: (projectId: string) => void
}

const MAX_SHOWN = 6

export function RecentProjectsGrid({ onOpenProject }: RecentProjectsGridProps) {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listProjects()
      .then((rows) => {
        const map = new Map<string, ProjectRow>()
        for (const r of rows) map.set(r.id, r)

        // Prune stale entries
        pruneRecentProjects(new Set(map.keys()))

        // Build ordered list of valid recent projects
        const validIds = getRecentProjects().map((r) => r.id)
        const ordered = validIds
          .map((id) => map.get(id))
          .filter((p): p is ProjectRow => p !== undefined)
          .slice(0, MAX_SHOWN)

        setProjects(ordered)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={sectionStyle}>
        <h3 style={headingStyle}>{t('welcome.recentProjects', 'Recent Projects')}</h3>
        <div style={scrollStyle}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={skeletonCardStyle}>
              <Skeleton width="70%" height={12} />
              <Skeleton width="50%" height={10} style={{ marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) return null

  return (
    <div style={sectionStyle}>
      <h3 style={headingStyle}>{t('welcome.recentProjects', 'Recent Projects')}</h3>
      <div style={scrollStyle}>
        {projects.map((proj) => (
          <button
            key={proj.id}
            style={cardStyle}
            onClick={() => onOpenProject(proj.id)}
            className="cs-hover-lift"
            aria-label={t('welcome.openProject', 'Open {{name}}', { name: proj.name })}
          >
            <Icon
              icon={FolderOpen}
              size={16}
              style={{ color: 'var(--text-faint)', flexShrink: 0 }}
            />
            <span style={nameStyle}>{proj.name}</span>
            <span style={dateStyle}>{fmtRelative(proj.updated_at)}</span>
          </button>
        ))}
      </div>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '1.5rem',
}

const headingStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  margin: '0 0 0.6rem',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const scrollStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  overflowX: 'auto',
  paddingBottom: 4,
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '0.75rem 1rem',
  minWidth: 140,
  maxWidth: 180,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  flexShrink: 0,
  transition: 'transform 0.15s, box-shadow 0.15s',
}

const nameStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
}

const dateStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
}

const skeletonCardStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  minWidth: 140,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface-2)',
  flexShrink: 0,
}
