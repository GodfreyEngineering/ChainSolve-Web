/**
 * LeftSidebar — collapsible left sidebar for the unified workspace (V3-UI Phase 5).
 *
 * Tabs: Projects | Explore | Recent
 * Collapsible with Ctrl/Cmd+B. On mobile, renders as overlay drawer.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Compass, Clock, ChevronLeft } from 'lucide-react'
import { useSidebarStore, type SidebarTab } from '../../stores/sidebarStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { useScrollShadow } from '../../hooks/useScrollShadow'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { Skeleton } from '../ui/Skeleton'
import type { Plan } from '../../lib/entitlements'

const ProjectsPanel = lazy(() =>
  import('./sidebar/ProjectsPanel').then((m) => ({ default: m.ProjectsPanel })),
)
const ExplorePanel = lazy(() =>
  import('./sidebar/ExplorePanel').then((m) => ({ default: m.ExplorePanel })),
)
const RecentPanel = lazy(() =>
  import('./sidebar/RecentPanel').then((m) => ({ default: m.RecentPanel })),
)

const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 480

interface LeftSidebarProps {
  plan: Plan
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
}

export function LeftSidebar({ plan, onOpenProject, onNewProject }: LeftSidebarProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { open, activeTab, setActiveTab, toggle, setOpen } = useSidebarStore()
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const resizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const mobileDrawerRef = useRef<HTMLDivElement>(null)
  const { ref: scrollRef, className: scrollShadowClass } = useScrollShadow()

  // Swipe left to dismiss mobile sidebar
  useSwipeGesture(mobileDrawerRef, {
    direction: 'left',
    threshold: 60,
    onSwipe: () => setOpen(false),
    enabled: isMobile && open,
  })

  // Keyboard shortcut: Ctrl/Cmd+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'

      const onMove = (me: MouseEvent) => {
        if (!resizing.current) return
        const delta = me.clientX - startX.current
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
      }
      const onUp = () => {
        resizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width],
  )

  if (!open) return null

  const tabs: { id: SidebarTab; icon: typeof FolderOpen; label: string }[] = [
    { id: 'projects', icon: FolderOpen, label: t('sidebar.projects', 'Projects') },
    { id: 'explore', icon: Compass, label: t('sidebar.explore', 'Explore') },
    { id: 'recent', icon: Clock, label: t('sidebar.recent', 'Recent') },
  ]

  const sidebarContent = (
    <div style={{ ...panelStyle, width: isMobile ? '100%' : width }}>
      {/* Tab bar */}
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <Tooltip key={tab.id} content={tab.label} side="bottom">
            <button
              style={{
                ...tabBtnStyle,
                ...(activeTab === tab.id ? tabBtnActiveStyle : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.label}
            >
              <Icon icon={tab.icon} size={14} />
              <span style={{ fontSize: '0.7rem' }}>{tab.label}</span>
            </button>
          </Tooltip>
        ))}
        <div style={{ flex: 1 }} />
        <Tooltip content={t('sidebar.collapse', 'Collapse sidebar')} side="bottom">
          <button style={collapseBtnStyle} onClick={toggle} aria-label={t('sidebar.collapse')}>
            <Icon icon={ChevronLeft} size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Panel content */}
      <div ref={scrollRef} className={scrollShadowClass} style={contentStyle}>
        <Suspense fallback={<SidebarSkeleton />}>
          {activeTab === 'projects' && (
            <ProjectsPanel plan={plan} onOpenProject={onOpenProject} onNewProject={onNewProject} />
          )}
          {activeTab === 'explore' && <ExplorePanel />}
          {activeTab === 'recent' && <RecentPanel onOpenProject={onOpenProject} />}
        </Suspense>
      </div>

      {/* Resize handle */}
      {!isMobile && <div style={resizeHandleStyle} onMouseDown={onResizeStart} />}
    </div>
  )

  // On mobile, wrap in overlay
  if (isMobile) {
    return (
      <>
        <div style={overlayStyle} onClick={() => setOpen(false)} />
        <div
          ref={mobileDrawerRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 'var(--z-sidebar, 50)' as unknown as number,
            animation: 'cs-slide-in-left 0.3s ease',
          }}
        >
          {sidebarContent}
        </div>
      </>
    )
  }

  return sidebarContent
}

function SidebarSkeleton() {
  return (
    <div style={{ padding: '0.75rem' }}>
      <Skeleton height={28} style={{ marginBottom: 8 }} />
      <Skeleton height={28} style={{ marginBottom: 8 }} />
      <Skeleton height={28} style={{ marginBottom: 8 }} />
      <Skeleton height={28} />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--surface-1, var(--card-bg))',
  borderRight: '1px solid var(--border)',
  flexShrink: 0,
  position: 'relative',
  overflow: 'hidden',
  transition: 'width var(--transition-sidebar, 0.3s cubic-bezier(0.34, 1.56, 0.64, 1))',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '0.3rem 0.4rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const tabBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '0.3rem 0.5rem',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-faint)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.72rem',
  fontWeight: 500,
  transition: 'background 0.1s, color 0.1s',
}

const tabBtnActiveStyle: React.CSSProperties = {
  background: 'var(--primary-dim)',
  color: 'var(--primary-text)',
}

const collapseBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text-faint)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
}

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  right: -3,
  top: 0,
  bottom: 0,
  width: 6,
  cursor: 'ew-resize',
  zIndex: 10,
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 49,
}
