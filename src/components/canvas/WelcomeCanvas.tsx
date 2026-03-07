/**
 * WelcomeCanvas — shown when no project is open in the workspace.
 *
 * Displays a welcome message with quick action cards on the canvas grid background.
 */

import { useTranslation } from 'react-i18next'
import { Plus, FileDown, Compass, Pencil } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { Icon } from '../ui/Icon'
import { RecentProjectsGrid } from './RecentProjectsGrid'

interface WelcomeCanvasProps {
  onNewProject: () => void
  onOpenScratch: () => void
  onOpenExplore: () => void
  onImport: () => void
  onOpenProject: (id: string) => void
}

export function WelcomeCanvas({
  onNewProject,
  onOpenScratch,
  onOpenExplore,
  onImport,
  onOpenProject,
}: WelcomeCanvasProps) {
  const { t } = useTranslation()

  const actions = [
    {
      icon: Plus,
      label: t('welcome.newProject', 'New Project'),
      desc: t('welcome.newProjectDesc', 'Start a fresh project'),
      onClick: onNewProject,
      primary: true,
    },
    {
      icon: Pencil,
      label: t('welcome.scratchCanvas', 'Scratch Canvas'),
      desc: t('welcome.scratchDesc', 'Quick calculations, no save'),
      onClick: onOpenScratch,
    },
    {
      icon: Compass,
      label: t('welcome.browseTemplates', 'Browse Templates'),
      desc: t('welcome.browseDesc', 'Community templates'),
      onClick: onOpenExplore,
    },
    {
      icon: FileDown,
      label: t('welcome.importProject', 'Import Project'),
      desc: t('welcome.importDesc', 'From .chainsolvejson file'),
      onClick: onImport,
    },
  ]

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <img
          src={BRAND.logoWideText}
          alt="ChainSolve"
          style={{ height: 32, opacity: 0.6, marginBottom: '0.5rem' }}
        />
        <h2 style={headingStyle}>{t('welcome.title', 'Welcome to your workspace')}</h2>
        <p style={subtitleStyle}>
          {t('welcome.subtitle', 'Open a project from the sidebar, or start something new.')}
        </p>

        <div style={cardsStyle}>
          {actions.map((a) => (
            <button
              key={a.label}
              style={{
                ...cardStyle,
                ...(a.primary ? cardPrimaryStyle : {}),
              }}
              onClick={a.onClick}
              className="cs-hover-lift"
              aria-label={a.label}
            >
              <Icon
                icon={a.icon}
                size={20}
                style={{ color: a.primary ? 'var(--primary)' : 'var(--text-faint)' }}
              />
              <span style={cardLabelStyle}>{a.label}</span>
              <span style={cardDescStyle}>{a.desc}</span>
            </button>
          ))}
        </div>

        <RecentProjectsGrid onOpenProject={onOpenProject} />
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface-0, var(--bg))',
  animation: 'cs-scale-in 0.3s ease',
}

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: 520,
  padding: '2rem',
}

const headingStyle: React.CSSProperties = {
  fontSize: '1.3rem',
  fontWeight: 600,
  margin: '0 0 0.3rem',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--text-faint)',
  margin: '0 0 1.5rem',
  lineHeight: 1.5,
}

const cardsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.75rem',
  width: '100%',
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '1.2rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'inherit',
  transition: 'transform 0.15s, box-shadow 0.15s',
}

const cardPrimaryStyle: React.CSSProperties = {
  borderColor: 'var(--primary)',
  background: 'color-mix(in srgb, var(--primary) 5%, var(--surface-2))',
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
}

const cardDescStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  lineHeight: 1.3,
}
