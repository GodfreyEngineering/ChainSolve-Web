/**
 * ProjectsPanel — sidebar tab showing the user's projects.
 *
 * Compact list view of projects with search, create, and open actions.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Upload } from 'lucide-react'
import {
  listProjects,
  renameProject,
  deleteProject,
  duplicateProject,
  importProject,
  type ProjectRow,
  type ProjectJSON,
} from '../../../lib/projects'
import { canCreateProject, getEntitlements, type Plan } from '../../../lib/entitlements'
import { getPinnedProjects, togglePinnedProject } from '../../../lib/pinnedProjects'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/Tooltip'

interface ProjectsPanelProps {
  plan: Plan
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
}

export function ProjectsPanel({ plan, onOpenProject, onNewProject }: ProjectsPanelProps) {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => getPinnedProjects())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listProjects()
      setProjects(rows)
    } catch {
      // Ignore — projects may be loading
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void listProjects()
      .then((rows) => setProjects(rows))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ent = getEntitlements(plan)
  const allowCreate = canCreateProject(plan, projects.length)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = projects
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    // Sort: pinned first, then by updated_at desc
    return [...list].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1
      const bp = pinnedIds.has(b.id) ? 0 : 1
      if (ap !== bp) return ap - bp
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [projects, query, pinnedIds])

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text) as ProjectJSON
        await importProject(json)
        fetchProjects()
      } catch {
        // Import error
      }
      // Reset input so same file can be re-imported
      if (importRef.current) importRef.current.value = ''
    },
    [fetchProjects],
  )

  const handleRename = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      const next = window.prompt(t('home.renamePrompt', 'Rename project:'), proj.name)
      if (!next?.trim() || next.trim() === proj.name) return
      await renameProject(proj.id, next.trim())
      fetchProjects()
    },
    [t, fetchProjects],
  )

  const handleDuplicate = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      await duplicateProject(proj.id, `${proj.name} (copy)`)
      fetchProjects()
    },
    [fetchProjects],
  )

  const handleDelete = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      if (!window.confirm(t('home.confirmDelete', 'Delete "{{name}}"?', { name: proj.name })))
        return
      await deleteProject(proj.id)
      fetchProjects()
    },
    [t, fetchProjects],
  )

  const handlePin = useCallback((projId: string) => {
    setMenuOpen(null)
    setPinnedIds(togglePinnedProject(projId))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header: Search + Create */}
      <div style={headerStyle}>
        <div style={searchRowStyle}>
          <Icon icon={Search} size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            type="search"
            placeholder={t('home.searchProjects', 'Search projects...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip content={t('home.createProject', 'New project')} side="bottom">
            <button
              style={actionBtnStyle}
              onClick={onNewProject}
              disabled={!allowCreate}
              aria-label={t('home.createProject')}
            >
              <Icon icon={Plus} size={14} />
            </button>
          </Tooltip>
          <Tooltip content={t('home.importProject', 'Import')} side="bottom">
            <button
              style={actionBtnStyle}
              onClick={() => importRef.current?.click()}
              aria-label={t('home.importProject')}
            >
              <Icon icon={Upload} size={14} />
            </button>
          </Tooltip>
          <input
            ref={importRef}
            type="file"
            accept=".json,.chainsolvejson"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Count */}
      <div style={countStyle}>
        {ent.maxProjects === Infinity
          ? `${projects.length} ${t('sidebar.projectsCount', 'projects')}`
          : `${projects.length} / ${ent.maxProjects}`}
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.3rem 0.5rem' }}>
        {loading && projects.length === 0 && (
          <div style={emptyStyle}>{t('home.loadingProjects', 'Loading...')}</div>
        )}
        {!loading && projects.length === 0 && (
          <div style={emptyStyle}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
            <div>{t('home.noProjectsTitle', 'No projects yet')}</div>
            <div style={{ fontSize: '0.68rem', opacity: 0.5, marginTop: 2 }}>
              {t('home.noProjectsHint', 'Create one to get started')}
            </div>
          </div>
        )}
        {filtered.map((proj) => (
          <ProjectRow
            key={proj.id}
            project={proj}
            pinned={pinnedIds.has(proj.id)}
            menuOpen={menuOpen === proj.id}
            onOpen={() => onOpenProject(proj.id)}
            onMenuToggle={() => setMenuOpen(menuOpen === proj.id ? null : proj.id)}
            onRename={() => handleRename(proj)}
            onDuplicate={() => handleDuplicate(proj)}
            onDelete={() => handleDelete(proj)}
            onPin={() => handlePin(proj.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── ProjectRow ─────────────────────────────────────────────────────

interface ProjectRowProps {
  project: import('../../../lib/projects').ProjectRow
  pinned: boolean
  menuOpen: boolean
  onOpen: () => void
  onMenuToggle: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPin: () => void
}

function ProjectRow({
  project,
  pinned,
  menuOpen,
  onOpen,
  onMenuToggle,
  onRename,
  onDuplicate,
  onDelete,
  onPin,
}: ProjectRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        ...rowStyle,
        background: hovered ? 'var(--primary-dim)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        if (menuOpen) onMenuToggle()
      }}
      onClick={onOpen}
    >
      {pinned && (
        <span style={{ fontSize: '0.6rem', color: 'var(--warning)', flexShrink: 0 }}>★</span>
      )}
      <span style={rowNameStyle}>{project.name}</span>
      <span style={rowDateStyle}>{fmtDate(project.updated_at)}</span>
      {hovered && (
        <div style={{ position: 'relative' }}>
          <button
            style={menuBtnStyle}
            onClick={(e) => {
              e.stopPropagation()
              onMenuToggle()
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={menuStyle}>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen()
                }}
              >
                Open
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onPin()
                }}
              >
                {pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onRename()
                }}
              >
                Rename
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
              >
                Duplicate
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
              <button
                className="cs-header-dropdown-item"
                style={{ color: 'var(--danger)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Styles ────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const searchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  padding: '0.2rem 0.4rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3, rgba(0,0,0,0.15))',
}

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.72rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const countStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
  letterSpacing: '0.03em',
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
  gap: 6,
  padding: '0.35rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  margin: '1px 0',
  position: 'relative',
}

const rowNameStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const rowDateStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
  flexShrink: 0,
}

const menuBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-faint)',
  fontSize: '0.85rem',
  padding: '0 4px',
  fontFamily: 'inherit',
  lineHeight: 1,
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  background: 'var(--surface-2, var(--card-bg))',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.2rem',
  zIndex: 100,
  minWidth: 120,
  boxShadow: 'var(--shadow-lg)',
}
