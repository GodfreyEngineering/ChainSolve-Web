/**
 * DocsPage.tsx — Full public documentation page at /docs.
 *
 * Features:
 * - Collapsible sidebar groups with expand/collapse
 * - Full-text search across body content with result highlighting
 * - Breadcrumbs showing current location
 * - Table of contents per section (anchored H2 links)
 * - "Was this helpful?" feedback widget per section
 * - Prev/next page navigation
 * - Ctrl+K focuses search
 */

import { useState, useMemo, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import i18n from '../i18n/config'
import { getDocsContentSync, type DocsContentMap } from '../docs/docsContentLoader'

// ── Section definitions ──────────────────────────────────────────────────────

export type DocsSection =
  | 'onboarding'
  | 'ui-overview'
  | 'block-library'
  | 'block-input'
  | 'block-math'
  | 'block-trig'
  | 'block-logic'
  | 'block-output'
  | 'block-engineering'
  | 'block-finance'
  | 'block-stats'
  | 'block-data'
  | 'block-plot'
  | 'block-constants'
  | 'block-annotations'
  | 'chains'
  | 'units'
  | 'variables'
  | 'materials'
  | 'projects'
  | 'groups'
  | 'saved-groups'
  | 'publish'
  | 'explore'
  | 'exports'
  | 'settings-themes'
  | 'ai-assistant'
  | 'formula-bar'
  | 'troubleshooting'
  | 'shortcuts'

interface SidebarGroup {
  label: string
  items: { id: DocsSection; label: string }[]
}

function useSidebarGroups(): SidebarGroup[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        label: t('docsPage.groupGettingStarted'),
        items: [
          { id: 'onboarding' as DocsSection, label: t('docsPage.secOnboarding') },
          { id: 'ui-overview' as DocsSection, label: t('docsPage.secUiOverview') },
        ],
      },
      {
        label: t('docsPage.groupBlocks'),
        items: [
          { id: 'block-library' as DocsSection, label: t('docsPage.secBlockLibrary') },
          { id: 'block-input' as DocsSection, label: t('docsPage.secBlockInput') },
          { id: 'block-math' as DocsSection, label: t('docsPage.secBlockMath') },
          { id: 'block-trig' as DocsSection, label: t('docsPage.secBlockTrig') },
          { id: 'block-logic' as DocsSection, label: t('docsPage.secBlockLogic') },
          { id: 'block-output' as DocsSection, label: t('docsPage.secBlockOutput') },
          { id: 'block-engineering' as DocsSection, label: t('docsPage.secBlockEngineering') },
          { id: 'block-finance' as DocsSection, label: t('docsPage.secBlockFinance') },
          { id: 'block-stats' as DocsSection, label: t('docsPage.secBlockStats') },
          { id: 'block-data' as DocsSection, label: t('docsPage.secBlockData') },
          { id: 'block-plot' as DocsSection, label: t('docsPage.secBlockPlot') },
          { id: 'block-constants' as DocsSection, label: t('docsPage.secBlockConstants') },
          { id: 'block-annotations' as DocsSection, label: t('docsPage.secBlockAnnotations') },
        ],
      },
      {
        label: t('docsPage.groupFeatures'),
        items: [
          { id: 'chains' as DocsSection, label: t('docsPage.secChains') },
          { id: 'units' as DocsSection, label: t('docsPage.secUnits') },
          { id: 'variables' as DocsSection, label: t('docsPage.secVariables') },
          { id: 'materials' as DocsSection, label: t('docsPage.secMaterials') },
          { id: 'projects' as DocsSection, label: t('docsPage.secProjects') },
          { id: 'groups' as DocsSection, label: t('docsPage.secGroups') },
          { id: 'saved-groups' as DocsSection, label: t('docsPage.secSavedGroups') },
          { id: 'publish' as DocsSection, label: t('docsPage.secPublish') },
          { id: 'explore' as DocsSection, label: t('docsPage.secExplore') },
          { id: 'exports' as DocsSection, label: t('docsPage.secExports') },
          { id: 'settings-themes' as DocsSection, label: t('docsPage.secSettingsThemes') },
          { id: 'ai-assistant' as DocsSection, label: t('docsPage.secAiAssistant') },
          {
            id: 'formula-bar' as DocsSection,
            label: t('docsPage.secFormulaBar', 'Formula Bar & CSEL'),
          },
        ],
      },
      {
        label: t('docsPage.groupReference'),
        items: [
          { id: 'shortcuts' as DocsSection, label: t('docsPage.secShortcuts') },
          { id: 'troubleshooting' as DocsSection, label: t('docsPage.secTroubleshooting') },
        ],
      },
    ],
    [t],
  )
}

// ── Section-to-content-key mapping ───────────────────────────────────────────

const SECTION_CONTENT_KEY: Record<DocsSection, string> = {
  onboarding: 'onboarding',
  'ui-overview': 'uiOverview',
  'block-library': 'blockLibrary',
  'block-input': 'blockInput',
  'block-math': 'blockMath',
  'block-trig': 'blockTrig',
  'block-logic': 'blockLogic',
  'block-output': 'blockOutput',
  'block-engineering': 'blockEng',
  'block-finance': 'blockFin',
  'block-stats': 'blockStats',
  'block-data': 'blockData',
  'block-plot': 'blockPlot',
  'block-constants': 'blockConst',
  'block-annotations': 'blockAnnot',
  chains: 'chains',
  units: 'units',
  variables: 'variables',
  materials: 'materials',
  projects: 'projects',
  groups: 'groups',
  'saved-groups': 'savedGroups',
  publish: 'publish',
  explore: 'explore',
  exports: 'exports',
  'settings-themes': 'settingsThemes',
  'ai-assistant': 'ai',
  'formula-bar': 'formulaBar',
  troubleshooting: 'trouble',
  shortcuts: 'shortcuts',
}

// ── Full-text search across body content ─────────────────────────────────────

interface SearchResult {
  sectionId: DocsSection
  sectionLabel: string
  snippet: string
  key: string
}

function searchDocsContent(
  query: string,
  content: DocsContentMap,
  groups: SidebarGroup[],
): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []
  const labelMap = new Map<string, string>()
  for (const g of groups) {
    for (const item of g.items) {
      labelMap.set(item.id, item.label)
    }
  }

  for (const [sectionId, contentKey] of Object.entries(SECTION_CONTENT_KEY)) {
    const sec = content[contentKey]
    if (!sec) continue
    for (const [key, val] of Object.entries(sec)) {
      const idx = val.toLowerCase().indexOf(q)
      if (idx === -1) continue
      const start = Math.max(0, idx - 40)
      const end = Math.min(val.length, idx + query.length + 40)
      const snippet =
        (start > 0 ? '...' : '') + val.slice(start, end) + (end < val.length ? '...' : '')
      results.push({
        sectionId: sectionId as DocsSection,
        sectionLabel: labelMap.get(sectionId) ?? sectionId,
        snippet,
        key,
      })
      break // one match per section is enough for results list
    }
  }
  return results
}

// ── Extract H2 headings for TOC ──────────────────────────────────────────────

interface TocEntry {
  id: string
  label: string
}

function extractToc(section: DocsSection, content: DocsContentMap): TocEntry[] {
  const contentKey = SECTION_CONTENT_KEY[section]
  const sec = content[contentKey]
  if (!sec) return []
  const entries: TocEntry[] = []
  for (const [key, val] of Object.entries(sec)) {
    if (key.endsWith('Title') && key !== 'intro') {
      entries.push({ id: `toc-${key}`, label: val })
    }
  }
  return entries
}

// ── Highlight helper ─────────────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const q = query.toLowerCase()
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={highlightMarkStyle}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DocsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  usePageMeta(t('seo.docs.title'), t('seo.docs.description'))
  useHreflang('/docs')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<Record<string, 'yes' | 'no'>>({})

  const section = (searchParams.get('section') as DocsSection) || 'onboarding'
  const groups = useSidebarGroups()
  const docsContent = getDocsContentSync(i18n.language)

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Full-text search results
  const searchResults = useMemo(
    () => searchDocsContent(search, docsContent, groups),
    [search, docsContent, groups],
  )

  // Filter sidebar items by search query (labels + body content match)
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    const matchedSections = new Set(searchResults.map((r) => r.sectionId))
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => it.label.toLowerCase().includes(q) || matchedSections.has(it.id),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, search, searchResults])

  // TOC for current section
  const toc = useMemo(() => extractToc(section, docsContent), [section, docsContent])

  // Ctrl+K focuses the search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Scroll content to top when section changes
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [section])

  const setSection = useCallback(
    (id: DocsSection) => {
      setSearchParams({ section: id })
      setSearch('')
    },
    [setSearchParams],
  )

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const handleFeedback = useCallback((sectionId: string, value: 'yes' | 'no') => {
    setFeedback((prev) => ({ ...prev, [sectionId]: value }))
  }, [])

  // Determine prev/next for navigation
  const currentIndex = allItems.findIndex((it) => it.id === section)
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

  // Find current group label for breadcrumb
  const currentGroup = groups.find((g) => g.items.some((it) => it.id === section))
  const currentLabel = allItems.find((it) => it.id === section)?.label ?? section

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav bar */}
      <nav style={navStyle}>
        <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src={BRAND.logoWideText} alt={t('app.name')} style={{ height: 28 }} />
        </a>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button style={backBtnStyle} onClick={() => navigate('/app')}>
            &larr; {t('nav.backToApp')}
          </button>
        </div>
      </nav>

      <div style={layoutStyle}>
        {/* Sidebar */}
        <aside style={sidebarStyle}>
          <h2 style={sidebarTitle}>{t('docsPage.title')}</h2>
          <input
            ref={searchRef}
            type="search"
            placeholder={`${t('docsPage.searchPlaceholder')} (Ctrl+K)`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
            aria-label={t('docsPage.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Search results dropdown */}
          {search.trim() && searchResults.length > 0 && (
            <div style={searchResultsStyle}>
              {searchResults.slice(0, 8).map((r) => (
                <button
                  key={`${r.sectionId}-${r.key}`}
                  style={searchResultItemStyle}
                  onClick={() => setSection(r.sectionId)}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {r.sectionLabel}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <HighlightText text={r.snippet} query={search} />
                  </span>
                </button>
              ))}
            </div>
          )}

          <nav style={sidebarNavStyle}>
            {filteredGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.label) && !search.trim()
              return (
                <div key={group.label} style={{ marginBottom: '0.5rem' }}>
                  <button
                    style={groupLabelBtnStyle}
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={!isCollapsed}
                  >
                    <span style={chevronStyle(isCollapsed)}>{'\u25B6'}</span>
                    {group.label}
                  </button>
                  {!isCollapsed &&
                    group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        style={sidebarItemStyle(section === item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              )
            })}
            {filteredGroups.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>
                {t('docsPage.noResults')}
              </p>
            )}
          </nav>
        </aside>

        {/* Content area */}
        <main ref={contentRef} style={contentStyle}>
          {/* Breadcrumbs */}
          <div style={breadcrumbStyle}>
            <span style={breadcrumbLink}>{t('docsPage.title')}</span>
            {currentGroup && (
              <>
                <span style={breadcrumbSep}>/</span>
                <span style={breadcrumbLink}>{currentGroup.label}</span>
              </>
            )}
            <span style={breadcrumbSep}>/</span>
            <span style={breadcrumbCurrent}>{currentLabel}</span>
          </div>

          {/* Table of Contents */}
          {toc.length > 1 && (
            <div style={tocContainerStyle}>
              <div style={tocTitle}>{t('docsPage.onThisPage')}</div>
              {toc.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  style={tocLinkStyle}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  {entry.label}
                </a>
              ))}
            </div>
          )}

          <DocsContent section={section} />

          {/* Feedback widget */}
          <div style={feedbackContainerStyle}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('docsPage.wasHelpful')}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                style={feedbackBtnStyle(feedback[section] === 'yes')}
                onClick={() => handleFeedback(section, 'yes')}
              >
                {t('docsPage.yes')}
              </button>
              <button
                style={feedbackBtnStyle(feedback[section] === 'no')}
                onClick={() => handleFeedback(section, 'no')}
              >
                {t('docsPage.no')}
              </button>
            </div>
            {feedback[section] && (
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                {t('docsPage.thanksFeedback')}
              </span>
            )}
          </div>

          {/* Prev / Next navigation */}
          <div style={pageNavStyle}>
            {prevItem ? (
              <button style={pageNavBtnStyle} onClick={() => setSection(prevItem.id)}>
                &larr; {prevItem.label}
              </button>
            ) : (
              <span />
            )}
            {nextItem ? (
              <button style={pageNavBtnStyle} onClick={() => setSection(nextItem.id)}>
                {nextItem.label} &rarr;
              </button>
            ) : (
              <span />
            )}
          </div>
        </main>
      </div>
      <LegalFooter />
    </div>
  )
}

// ── Content router ───────────────────────────────────────────────────────────

function DocsContent({ section }: { section: DocsSection }) {
  switch (section) {
    case 'onboarding':
      return <OnboardingSection />
    case 'ui-overview':
      return <UiOverviewSection />
    case 'block-library':
      return <BlockLibrarySection />
    case 'block-input':
      return <BlockInputSection />
    case 'block-math':
      return <BlockMathSection />
    case 'block-trig':
      return <BlockTrigSection />
    case 'block-logic':
      return <BlockLogicSection />
    case 'block-output':
      return <BlockOutputSection />
    case 'block-engineering':
      return <BlockEngineeringSection />
    case 'block-finance':
      return <BlockFinanceSection />
    case 'block-stats':
      return <BlockStatsSection />
    case 'block-data':
      return <BlockDataSection />
    case 'block-plot':
      return <BlockPlotSection />
    case 'block-constants':
      return <BlockConstantsSection />
    case 'block-annotations':
      return <BlockAnnotationsSection />
    case 'chains':
      return <ChainsSection />
    case 'units':
      return <UnitsSection />
    case 'variables':
      return <VariablesSection />
    case 'materials':
      return <MaterialsSection />
    case 'projects':
      return <ProjectsSection />
    case 'groups':
      return <GroupsSection />
    case 'saved-groups':
      return <SavedGroupsSection />
    case 'publish':
      return <PublishSection />
    case 'explore':
      return <ExploreSection />
    case 'exports':
      return <ExportsSection />
    case 'settings-themes':
      return <SettingsThemesSection />
    case 'ai-assistant':
      return <AiAssistantSection />
    case 'formula-bar':
      return <FormulaBarSection />
    case 'troubleshooting':
      return <TroubleshootingSection />
    case 'shortcuts':
      return <ShortcutsSection />
    default:
      return <OnboardingSection />
  }
}

// ── Content accessor ─────────────────────────────────────────────────────────

/** Read a body-text key from the locale-aware content map. */
function c(section: string, key: string): string {
  return getDocsContentSync(i18n.language)[section]?.[key] ?? key
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function H1({ children }: { children: React.ReactNode }) {
  return <h1 style={h1Style}>{children}</h1>
}

function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={h2Style}>
      {children}
    </h2>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={h3Style}>{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={pStyle}>{children}</p>
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={liStyle}>{children}</li>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={ulStyle}>{children}</ul>
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol style={olStyle}>{children}</ol>
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div style={tipStyle}>{children}</div>
}

function BlockRef({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={blockRefStyle}>
      <strong style={{ color: 'var(--text)' }}>{name}</strong>
      <span style={{ color: 'var(--text-muted)' }}> &mdash; {desc}</span>
    </div>
  )
}

function ProBadge() {
  return <span style={proBadgeStyle}>Pro</span>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd style={kbdStyle}>{children}</kbd>
}

// ── Section content ──────────────────────────────────────────────────────────

function OnboardingSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secOnboarding')}</H1>
      <P>{c('onboarding', 'intro')}</P>

      <H2 id="toc-whatIsTitle">{c('onboarding', 'whatIsTitle')}</H2>
      <P>{c('onboarding', 'whatIsBody')}</P>

      <H2 id="toc-firstCanvasTitle">{c('onboarding', 'firstCanvasTitle')}</H2>
      <Ol>
        <Li>{c('onboarding', 'step1')}</Li>
        <Li>{c('onboarding', 'step2')}</Li>
        <Li>{c('onboarding', 'step3')}</Li>
        <Li>{c('onboarding', 'step4')}</Li>
        <Li>{c('onboarding', 'step5')}</Li>
      </Ol>

      <H2 id="toc-connectingTitle">{c('onboarding', 'connectingTitle')}</H2>
      <P>{c('onboarding', 'connectingBody')}</P>

      <H2 id="toc-savingTitle">{c('onboarding', 'savingTitle')}</H2>
      <P>{c('onboarding', 'savingBody')}</P>

      <Tip>{c('onboarding', 'tip')}</Tip>
    </>
  )
}

function UiOverviewSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secUiOverview')}</H1>
      <P>{c('uiOverview', 'intro')}</P>

      <H2 id="toc-headerTitle">{c('uiOverview', 'headerTitle')}</H2>
      <P>{c('uiOverview', 'headerBody')}</P>

      <H2 id="toc-canvasTitle">{c('uiOverview', 'canvasTitle')}</H2>
      <P>{c('uiOverview', 'canvasBody')}</P>

      <H2 id="toc-toolbarTitle">{c('uiOverview', 'toolbarTitle')}</H2>
      <P>{c('uiOverview', 'toolbarBody')}</P>

      <H2 id="toc-inspectorTitle">{c('uiOverview', 'inspectorTitle')}</H2>
      <P>{c('uiOverview', 'inspectorBody')}</P>

      <H2 id="toc-panelsTitle">{c('uiOverview', 'panelsTitle')}</H2>
      <P>{c('uiOverview', 'panelsBody')}</P>

      <H2 id="toc-windowsTitle">{c('uiOverview', 'windowsTitle')}</H2>
      <P>{c('uiOverview', 'windowsBody')}</P>
    </>
  )
}

function BlockLibrarySection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockLibrary')}</H1>
      <P>{c('blockLibrary', 'intro')}</P>

      <H2 id="toc-categoriesTitle">{c('blockLibrary', 'categoriesTitle')}</H2>
      <P>{c('blockLibrary', 'categoriesBody')}</P>
      <Ul>
        <Li>
          <strong>{c('blockLibrary', 'catInput')}</strong> &mdash;{' '}
          {c('blockLibrary', 'catInputDesc')}
        </Li>
        <Li>
          <strong>{c('blockLibrary', 'catMath')}</strong> &mdash; {c('blockLibrary', 'catMathDesc')}
        </Li>
        <Li>
          <strong>{c('blockLibrary', 'catEngineering')}</strong> &mdash;{' '}
          {c('blockLibrary', 'catEngineeringDesc')}
        </Li>
        <Li>
          <strong>{c('blockLibrary', 'catFinance')}</strong> &mdash;{' '}
          {c('blockLibrary', 'catFinanceDesc')}
        </Li>
        <Li>
          <strong>{c('blockLibrary', 'catStats')}</strong> &mdash;{' '}
          {c('blockLibrary', 'catStatsDesc')}
        </Li>
        <Li>
          <strong>{c('blockLibrary', 'catOutput')}</strong> &mdash;{' '}
          {c('blockLibrary', 'catOutputDesc')}
        </Li>
      </Ul>

      <H2 id="toc-addingTitle">{c('blockLibrary', 'addingTitle')}</H2>
      <P>{c('blockLibrary', 'addingBody')}</P>

      <Tip>{c('blockLibrary', 'tip')}</Tip>
    </>
  )
}

function BlockInputSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockInput')}</H1>
      <P>{c('blockInput', 'intro')}</P>
      <BlockRef name="Number" desc={c('blockInput', 'number')} />
      <BlockRef name="Slider" desc={c('blockInput', 'slider')} />
      <BlockRef name="Variable Source" desc={c('blockInput', 'variableSource')} />
      <BlockRef name="Constant" desc={c('blockInput', 'constant')} />
      <BlockRef name="Material" desc={c('blockInput', 'material')} />
    </>
  )
}

function BlockMathSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockMath')}</H1>
      <P>{c('blockMath', 'intro')}</P>
      <H2 id="toc-arithmeticTitle">{c('blockMath', 'arithmeticTitle')}</H2>
      <BlockRef name="Add" desc="A + B" />
      <BlockRef name="Subtract" desc="A - B" />
      <BlockRef name="Multiply" desc="A * B" />
      <BlockRef name="Divide" desc="A / B (error if B = 0)" />
      <BlockRef name="Negate" desc="-A" />
      <BlockRef name="Mod" desc="A mod B (error if B = 0)" />

      <H2 id="toc-roundingTitle">{c('blockMath', 'roundingTitle')}</H2>
      <BlockRef name="Floor" desc={c('blockMath', 'floor')} />
      <BlockRef name="Ceil" desc={c('blockMath', 'ceil')} />
      <BlockRef name="Round" desc={c('blockMath', 'round')} />
      <BlockRef name="Round N" desc={c('blockMath', 'roundN')} />
      <BlockRef name="Trunc" desc={c('blockMath', 'trunc')} />
      <BlockRef name="Sign" desc={c('blockMath', 'sign')} />

      <H2 id="toc-expLogTitle">{c('blockMath', 'expLogTitle')}</H2>
      <BlockRef name="Power" desc="Base^Exp" />
      <BlockRef name="Sqrt" desc={c('blockMath', 'sqrt')} />
      <BlockRef name="Abs" desc={c('blockMath', 'abs')} />
      <BlockRef name="Exp" desc="e^A" />
      <BlockRef name="Ln" desc={c('blockMath', 'ln')} />
      <BlockRef name="Log10" desc={c('blockMath', 'log10')} />
      <BlockRef name="Log Base" desc={c('blockMath', 'logBase')} />
      <BlockRef name="Clamp" desc={c('blockMath', 'clamp')} />
    </>
  )
}

function BlockTrigSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockTrig')}</H1>
      <P>{c('blockTrig', 'intro')}</P>
      <BlockRef name="Sin" desc={c('blockTrig', 'sin')} />
      <BlockRef name="Cos" desc={c('blockTrig', 'cos')} />
      <BlockRef name="Tan" desc={c('blockTrig', 'tan')} />
      <BlockRef name="Asin" desc={c('blockTrig', 'asin')} />
      <BlockRef name="Acos" desc={c('blockTrig', 'acos')} />
      <BlockRef name="Atan" desc={c('blockTrig', 'atan')} />
      <BlockRef name="Atan2" desc={c('blockTrig', 'atan2')} />
      <BlockRef name="Deg to Rad" desc={c('blockTrig', 'degToRad')} />
      <BlockRef name="Rad to Deg" desc={c('blockTrig', 'radToDeg')} />
    </>
  )
}

function BlockLogicSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockLogic')}</H1>
      <P>{c('blockLogic', 'intro')}</P>
      <BlockRef name="Greater" desc={c('blockLogic', 'greater')} />
      <BlockRef name="Less" desc={c('blockLogic', 'less')} />
      <BlockRef name="Equal" desc={c('blockLogic', 'equal')} />
      <BlockRef name="If/Then/Else" desc={c('blockLogic', 'ifThenElse')} />
      <BlockRef name="Max" desc={c('blockLogic', 'max')} />
      <BlockRef name="Min" desc={c('blockLogic', 'min')} />
    </>
  )
}

function BlockOutputSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockOutput')}</H1>
      <P>{c('blockOutput', 'intro')}</P>
      <BlockRef name="Display" desc={c('blockOutput', 'display')} />
    </>
  )
}

function BlockEngineeringSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockEngineering')}</H1>
      <P>{c('blockEng', 'intro')}</P>

      <H2 id="toc-mechanicsTitle">{c('blockEng', 'mechanicsTitle')}</H2>
      <P>{c('blockEng', 'mechanicsBody')}</P>
      <BlockRef name="Force (F = m * a)" desc={c('blockEng', 'force')} />
      <BlockRef name="Kinetic Energy (KE = 0.5 * m * v^2)" desc={c('blockEng', 'ke')} />
      <BlockRef name="Power/Work/Time (P = W / t)" desc={c('blockEng', 'power')} />
      <BlockRef name="Hooke's Law (F = k * x)" desc={c('blockEng', 'hooke')} />

      <H2 id="toc-sectionsTitle">{c('blockEng', 'sectionsTitle')}</H2>
      <P>{c('blockEng', 'sectionsBody')}</P>
      <BlockRef
        name="Second Moment (Rect)"
        desc={c('blockEng', 'secondMomentRect') || 'I = b*h^3/12 for rectangular cross-sections.'}
      />
      <BlockRef
        name="Second Moment (Circular)"
        desc={
          c('blockEng', 'secondMomentCirc') || 'I = pi*d^4/64 for solid circular cross-sections.'
        }
      />
      <BlockRef
        name="Bending Stress"
        desc={c('blockEng', 'bendingStress') || 'sigma = M*y/I. Stress from bending moment.'}
      />
      <BlockRef
        name="Area of Annulus"
        desc={
          c('blockEng', 'areaAnnulus') ||
          'A = pi/4*(d_outer^2 - d_inner^2). Area of a hollow circle.'
        }
      />

      <H2 id="toc-fluidsTitle">{c('blockEng', 'fluidsTitle')}</H2>
      <P>{c('blockEng', 'fluidsBody')}</P>
      <BlockRef
        name="Reynolds Number"
        desc={c('blockEng', 'reynolds') || 'Re = rho*v*D/mu. Determines laminar vs turbulent flow.'}
      />

      <H2 id="toc-thermoTitle">{c('blockEng', 'thermoTitle')}</H2>
      <P>{c('blockEng', 'thermoBody')}</P>
      <BlockRef
        name="Ideal Gas"
        desc={c('blockEng', 'idealGas') || 'PV = nRT. Relates pressure, volume, and temperature.'}
      />
      <BlockRef
        name="Fourier Conduction"
        desc={
          c('blockEng', 'fourierConduction') ||
          'Q = k*A*dT/L. Heat conduction through a solid wall.'
        }
      />

      <H2 id="toc-electricalTitle">{c('blockEng', 'electricalTitle')}</H2>
      <P>{c('blockEng', 'electricalBody')}</P>
      <BlockRef
        name="Ohm's Law"
        desc={c('blockEng', 'ohmsLaw') || 'V = I*R. Voltage, current, and resistance.'}
      />
      <BlockRef
        name="Power Dissipation"
        desc={
          c('blockEng', 'powerDissipation') || 'P = I^2*R or P = V^2/R. Electrical power consumed.'
        }
      />

      <H2 id="toc-conversionsTitle">{c('blockEng', 'conversionsTitle')}</H2>
      <P>{c('blockEng', 'conversionsBody')}</P>
    </>
  )
}

function BlockFinanceSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockFinance')}</H1>
      <P>{c('blockFin', 'intro')}</P>

      <H2 id="toc-tvmTitle">{c('blockFin', 'tvmTitle')}</H2>
      <P>{c('blockFin', 'tvmBody')}</P>
      <BlockRef name="Compound FV" desc={c('blockFin', 'compoundFv')} />
      <BlockRef name="NPV" desc={c('blockFin', 'npv')} />
      <BlockRef name="IRR" desc={c('blockFin', 'irr')} />
      <BlockRef name="Annuity PV" desc={c('blockFin', 'annuityPv')} />
      <BlockRef name="Rule of 72" desc={c('blockFin', 'rule72')} />

      <H2 id="toc-returnsTitle">{c('blockFin', 'returnsTitle')}</H2>
      <P>{c('blockFin', 'returnsBody')}</P>
      <BlockRef
        name="CAGR"
        desc={
          c('blockFin', 'cagr') ||
          'Compound annual growth rate. Smoothed annualised return over a period.'
        }
      />
      <BlockRef
        name="Sharpe Ratio"
        desc={
          c('blockFin', 'sharpeRatio') ||
          'Risk-adjusted return: (Rp - Rf) / sigma_p. Higher is better.'
        }
      />

      <H2 id="toc-deprTitle">{c('blockFin', 'deprTitle')}</H2>
      <P>{c('blockFin', 'deprBody')}</P>
      <BlockRef
        name="Straight-Line"
        desc={
          c('blockFin', 'straightLineDepr') ||
          'Equal depreciation per period: (Cost - Salvage) / Life.'
        }
      />
      <BlockRef
        name="Declining Balance"
        desc={
          c('blockFin', 'decliningBalanceDepr') ||
          'Accelerated depreciation based on remaining book value.'
        }
      />
    </>
  )
}

function BlockStatsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockStats')}</H1>
      <P>{c('blockStats', 'intro')}</P>

      <H2 id="toc-descTitle">{c('blockStats', 'descTitle')}</H2>
      <P>{c('blockStats', 'descBody')}</P>
      <BlockRef name="Mean" desc={c('blockStats', 'mean')} />
      <BlockRef name="Std Dev" desc={c('blockStats', 'stddev')} />
      <BlockRef name="Median" desc={c('blockStats', 'median')} />
      <BlockRef name="Variance" desc={c('blockStats', 'variance')} />

      <H2 id="toc-relTitle">{c('blockStats', 'relTitle')}</H2>
      <P>{c('blockStats', 'relBody')}</P>
      <BlockRef
        name="Linear Regression Slope"
        desc={c('blockStats', 'linregSlope') || 'Best-fit line slope from paired (x, y) data.'}
      />
      <BlockRef
        name="Linear Regression Intercept"
        desc={
          c('blockStats', 'linregIntercept') || 'Y-intercept of the best-fit line from (x, y) data.'
        }
      />
      <BlockRef
        name="Pearson Correlation"
        desc={
          c('blockStats', 'pearsonCorr') ||
          'Correlation coefficient r in [-1, 1]. Measures linear relationship strength.'
        }
      />

      <H2 id="toc-probTitle">{c('blockStats', 'probTitle')}</H2>
      <P>{c('blockStats', 'probBody')}</P>
      <BlockRef
        name="Factorial"
        desc={c('blockStats', 'factorial') || 'n! — product of all positive integers up to n.'}
      />
      <BlockRef
        name="Permutation"
        desc={c('blockStats', 'permutation') || 'P(n,r) = n!/(n-r)!. Ordered arrangements.'}
      />
      <BlockRef
        name="Combination"
        desc={c('blockStats', 'combination') || 'C(n,r) = n!/(r!(n-r)!). Unordered selections.'}
      />
    </>
  )
}

function BlockDataSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>
        {t('docsPage.secBlockData')} <ProBadge />
      </H1>
      <P>{c('blockData', 'intro')}</P>

      <H2 id="toc-vectorTitle">{c('blockData', 'vectorTitle')}</H2>
      <P>{c('blockData', 'vectorBody')}</P>

      <H2 id="toc-csvTitle">{c('blockData', 'csvTitle')}</H2>
      <P>{c('blockData', 'csvBody')}</P>

      <H2 id="toc-opsTitle">{c('blockData', 'opsTitle')}</H2>
      <P>{c('blockData', 'opsBody')}</P>
      <BlockRef name="Length" desc={c('blockData', 'opLength')} />
      <BlockRef name="Sum" desc={c('blockData', 'opSum')} />
      <BlockRef name="Mean" desc={c('blockData', 'opMean')} />
      <BlockRef name="Sort" desc={c('blockData', 'opSort')} />
      <BlockRef name="Reverse" desc={c('blockData', 'opReverse')} />
      <BlockRef name="Slice" desc={c('blockData', 'opSlice')} />
      <BlockRef name="Concat" desc={c('blockData', 'opConcat')} />
      <BlockRef name="Map" desc={c('blockData', 'opMap')} />
    </>
  )
}

function BlockPlotSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>
        {t('docsPage.secBlockPlot')} <ProBadge />
      </H1>
      <P>{c('blockPlot', 'intro')}</P>
      <BlockRef name="XY Plot" desc={c('blockPlot', 'xy')} />
      <BlockRef name="Histogram" desc={c('blockPlot', 'histogram')} />
      <BlockRef name="Bar Chart" desc={c('blockPlot', 'bar')} />
      <Tip>{c('blockPlot', 'tip')}</Tip>
    </>
  )
}

function BlockConstantsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockConstants')}</H1>
      <P>{c('blockConst', 'intro')}</P>

      <H2 id="toc-mathTitle">{c('blockConst', 'mathTitle')}</H2>
      <P>{c('blockConst', 'mathBody')}</P>

      <H2 id="toc-physicsTitle">{c('blockConst', 'physicsTitle')}</H2>
      <P>{c('blockConst', 'physicsBody')}</P>

      <H2 id="toc-atmoTitle">{c('blockConst', 'atmoTitle')}</H2>
      <P>{c('blockConst', 'atmoBody')}</P>

      <H2 id="toc-thermoTitle">{c('blockConst', 'thermoTitle')}</H2>
      <P>{c('blockConst', 'thermoBody')}</P>

      <H2 id="toc-elecTitle">{c('blockConst', 'elecTitle')}</H2>
      <P>{c('blockConst', 'elecBody')}</P>
    </>
  )
}

function BlockAnnotationsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockAnnotations')}</H1>
      <P>{c('blockAnnot', 'intro')}</P>
      <BlockRef name="Text" desc={c('blockAnnot', 'text')} />
      <BlockRef name="Callout" desc={c('blockAnnot', 'callout')} />
      <BlockRef name="Highlight" desc={c('blockAnnot', 'highlight')} />
      <BlockRef name="Arrow" desc={c('blockAnnot', 'arrow')} />
    </>
  )
}

function ChainsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secChains')}</H1>
      <P>{c('chains', 'intro')}</P>

      <H2 id="toc-createTitle">{c('chains', 'createTitle')}</H2>
      <P>{c('chains', 'createBody')}</P>

      <H2 id="toc-deleteTitle">{c('chains', 'deleteTitle')}</H2>
      <P>{c('chains', 'deleteBody')}</P>

      <H2 id="toc-dataFlowTitle">{c('chains', 'dataFlowTitle')}</H2>
      <P>{c('chains', 'dataFlowBody')}</P>

      <H2 id="toc-typesTitle">{c('chains', 'typesTitle')}</H2>
      <P>{c('chains', 'typesBody')}</P>

      <H2 id="toc-multiTitle">{c('chains', 'multiTitle')}</H2>
      <P>{c('chains', 'multiBody')}</P>

      <H2 id="toc-animatedTitle">{c('chains', 'animatedTitle')}</H2>
      <P>{c('chains', 'animatedBody')}</P>
    </>
  )
}

function UnitsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secUnits')}</H1>
      <P>{c('units', 'intro')}</P>

      <H2 id="toc-assignTitle">{c('units', 'assignTitle')}</H2>
      <P>{c('units', 'assignBody')}</P>

      <H2 id="toc-convertTitle">{c('units', 'convertTitle')}</H2>
      <P>{c('units', 'convertBody')}</P>

      <H2 id="toc-dimensionsTitle">{c('units', 'dimensionsTitle')}</H2>
      <P>{c('units', 'dimensionsBody')}</P>

      {/* Dimension reference table */}
      <div style={dimTableContainerStyle}>
        <DimensionRow dim="Length" si="metre (m)" alt="km, cm, mm, in, ft, yd, mi" />
        <DimensionRow dim="Mass" si="kilogram (kg)" alt="g, mg, lb, oz, tonne" />
        <DimensionRow dim="Time" si="second (s)" alt="ms, min, hr, day" />
        <DimensionRow dim="Temperature" si="kelvin (K)" alt="degC, degF" />
        <DimensionRow dim="Force" si="newton (N)" alt="kN, lbf, kgf" />
        <DimensionRow dim="Pressure" si="pascal (Pa)" alt="kPa, MPa, bar, psi, atm" />
        <DimensionRow dim="Energy" si="joule (J)" alt="kJ, MJ, cal, kcal, kWh, BTU" />
        <DimensionRow dim="Power" si="watt (W)" alt="kW, MW, hp" />
        <DimensionRow dim="Velocity" si="m/s" alt="km/h, mph, ft/s, knot" />
        <DimensionRow dim="Acceleration" si="m/s^2" alt="g (9.81)" />
        <DimensionRow dim="Density" si="kg/m^3" alt="g/cm^3, lb/ft^3" />
        <DimensionRow dim="Dyn. viscosity" si="Pa*s" alt="cP, mPa*s" />
        <DimensionRow dim="Kin. viscosity" si="m^2/s" alt="cSt, mm^2/s" />
        <DimensionRow dim="Torque" si="N*m" alt="kN*m, lbf*ft" />
        <DimensionRow dim="Frequency" si="hertz (Hz)" alt="kHz, MHz, rpm" />
        <DimensionRow dim="Angle" si="radian (rad)" alt="deg, rev" />
        <DimensionRow dim="Area" si="m^2" alt="cm^2, mm^2, ft^2, in^2, acre, ha" />
        <DimensionRow dim="Volume" si="m^3" alt="L, mL, gal, ft^3" />
        <DimensionRow dim="Current" si="ampere (A)" alt="mA, kA" />
      </div>

      <Tip>{c('units', 'tip')}</Tip>
    </>
  )
}

function DimensionRow({ dim, si, alt }: { dim: string; si: string; alt: string }) {
  return (
    <div style={dimRowStyle}>
      <strong style={{ minWidth: 120, color: 'var(--text)' }}>{dim}</strong>
      <span style={{ minWidth: 120, color: 'var(--primary)' }}>{si}</span>
      <span style={{ color: 'var(--text-muted)' }}>{alt}</span>
    </div>
  )
}

function VariablesSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secVariables')}</H1>
      <P>{c('variables', 'intro')}</P>

      <H2 id="toc-createTitle">{c('variables', 'createTitle')}</H2>
      <P>{c('variables', 'createBody')}</P>

      <H2 id="toc-bindTitle">{c('variables', 'bindTitle')}</H2>
      <P>{c('variables', 'bindBody')}</P>

      <H2 id="toc-sliderTitle">{c('variables', 'sliderTitle')}</H2>
      <P>{c('variables', 'sliderBody')}</P>

      <Tip>{c('variables', 'tip')}</Tip>
    </>
  )
}

function MaterialsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secMaterials')}</H1>
      <P>{c('materials', 'intro')}</P>

      <H2 id="toc-presetsTitle">{c('materials', 'presetsTitle')}</H2>
      <P>{c('materials', 'presetsBody')}</P>

      {/* Material reference table */}
      <H3>{t('docsPage.materialTableTitle')}</H3>
      <div style={dimTableContainerStyle}>
        <MaterialRow
          name="Structural Steel (S275)"
          props="rho=7850 kg/m3, E=200 GPa, sigma_y=275 MPa, k=50 W/mK"
        />
        <MaterialRow
          name="Stainless Steel (304)"
          props="rho=8000 kg/m3, E=193 GPa, sigma_y=215 MPa, k=16 W/mK"
        />
        <MaterialRow
          name="Aluminium 6061-T6"
          props="rho=2700 kg/m3, E=69 GPa, sigma_y=276 MPa, k=167 W/mK"
        />
        <MaterialRow
          name="Copper (C11000)"
          props="rho=8960 kg/m3, E=117 GPa, sigma_y=69 MPa, k=385 W/mK"
        />
        <MaterialRow
          name="Concrete (C30)"
          props="rho=2400 kg/m3, E=30 GPa, f_ck=30 MPa, k=1.0 W/mK"
        />
        <MaterialRow name="Douglas Fir" props="rho=530 kg/m3, E=12.4 GPa, k=0.12 W/mK" />
      </div>

      <H2 id="toc-customTitle">{c('materials', 'customTitle')}</H2>
      <P>{c('materials', 'customBody')}</P>

      <H2 id="toc-fluidsTitle">{c('materials', 'fluidsTitle')}</H2>
      <P>{c('materials', 'fluidsBody')}</P>

      <div style={dimTableContainerStyle}>
        <MaterialRow
          name="Water (20 degC)"
          props="rho=998 kg/m3, mu=1.002e-3 Pa*s, nu=1.004e-6 m2/s"
        />
        <MaterialRow
          name="Air (20 degC, 1 atm)"
          props="rho=1.204 kg/m3, mu=1.825e-5 Pa*s, nu=1.516e-5 m2/s"
        />
        <MaterialRow name="SAE 30 Oil" props="rho=875 kg/m3, mu=0.29 Pa*s, nu=3.31e-4 m2/s" />
      </div>
    </>
  )
}

function MaterialRow({ name, props }: { name: string; props: string }) {
  return (
    <div style={dimRowStyle}>
      <strong style={{ minWidth: 180, color: 'var(--text)' }}>{name}</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{props}</span>
    </div>
  )
}

function ProjectsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secProjects')}</H1>
      <P>{c('projects', 'intro')}</P>

      <H2 id="toc-createTitle">{c('projects', 'createTitle')}</H2>
      <P>{c('projects', 'createBody')}</P>

      <H2 id="toc-scratchTitle">{c('projects', 'scratchTitle')}</H2>
      <P>{c('projects', 'scratchBody')}</P>

      <H2 id="toc-savingTitle">{c('projects', 'savingTitle')}</H2>
      <P>{c('projects', 'savingBody')}</P>

      <H2 id="toc-sheetsTitle">{c('projects', 'sheetsTitle')}</H2>
      <P>
        {c('projects', 'sheetsBody')} <ProBadge />
      </P>

      <H2 id="toc-importExportTitle">{c('projects', 'importExportTitle')}</H2>
      <P>{c('projects', 'importExportBody')}</P>

      <H2 id="toc-deleteTitle">{c('projects', 'deleteTitle')}</H2>
      <P>{c('projects', 'deleteBody')}</P>
    </>
  )
}

function GroupsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secGroups')}</H1>
      <P>
        {c('groups', 'intro')} <ProBadge />
      </P>

      <H2 id="toc-createTitle">{c('groups', 'createTitle')}</H2>
      <P>{c('groups', 'createBody')}</P>

      <H2 id="toc-editTitle">{c('groups', 'editTitle')}</H2>
      <P>{c('groups', 'editBody')}</P>

      <H2 id="toc-moveTitle">{c('groups', 'moveTitle')}</H2>
      <P>{c('groups', 'moveBody')}</P>

      <H2 id="toc-nestedTitle">{c('groups', 'nestedTitle')}</H2>
      <P>{c('groups', 'nestedBody')}</P>
    </>
  )
}

function SavedGroupsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secSavedGroups')}</H1>
      <P>{c('savedGroups', 'intro')}</P>

      <H2 id="toc-saveTitle">{c('savedGroups', 'saveTitle')}</H2>
      <P>{c('savedGroups', 'saveBody')}</P>

      <H2 id="toc-insertTitle">{c('savedGroups', 'insertTitle')}</H2>
      <P>{c('savedGroups', 'insertBody')}</P>

      <H2 id="toc-manageTitle">{c('savedGroups', 'manageTitle')}</H2>
      <P>{c('savedGroups', 'manageBody')}</P>

      <H2 id="toc-shareTitle">{c('savedGroups', 'shareTitle')}</H2>
      <P>{c('savedGroups', 'shareBody')}</P>
    </>
  )
}

function PublishSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secPublish')}</H1>
      <P>{c('publish', 'intro')}</P>

      <H2 id="toc-howTitle">{c('publish', 'howTitle')}</H2>
      <Ol>
        <Li>{c('publish', 'step1')}</Li>
        <Li>{c('publish', 'step2')}</Li>
        <Li>{c('publish', 'step3')}</Li>
        <Li>{c('publish', 'step4')}</Li>
      </Ol>

      <H2 id="toc-typesTitle">{c('publish', 'typesTitle')}</H2>
      <P>{c('publish', 'typesBody')}</P>

      <Tip>{c('publish', 'tip')}</Tip>
    </>
  )
}

function ExploreSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secExplore')}</H1>
      <P>{c('explore', 'intro')}</P>

      <H2 id="toc-browseTitle">{c('explore', 'browseTitle')}</H2>
      <P>{c('explore', 'browseBody')}</P>

      <H2 id="toc-installTitle">{c('explore', 'installTitle')}</H2>
      <P>{c('explore', 'installBody')}</P>

      <H2 id="toc-ratingsTitle">{c('explore', 'ratingsTitle')}</H2>
      <P>{c('explore', 'ratingsBody')}</P>
    </>
  )
}

function ExportsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secExports')}</H1>
      <P>{c('exports', 'intro')}</P>

      <H2 id="toc-pdfTitle">{c('exports', 'pdfTitle')}</H2>
      <P>{c('exports', 'pdfBody')}</P>

      <H2 id="toc-excelTitle">{c('exports', 'excelTitle')}</H2>
      <P>{c('exports', 'excelBody')}</P>

      <H2 id="toc-jsonTitle">{c('exports', 'jsonTitle')}</H2>
      <P>{c('exports', 'jsonBody')}</P>

      <Tip>{c('exports', 'tip')}</Tip>
    </>
  )
}

function SettingsThemesSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secSettingsThemes')}</H1>
      <P>{c('settingsThemes', 'intro')}</P>

      <H2 id="toc-accountTitle">{c('settingsThemes', 'accountTitle')}</H2>
      <P>{c('settingsThemes', 'accountBody')}</P>

      <H2 id="toc-generalTitle">{c('settingsThemes', 'generalTitle')}</H2>
      <P>{c('settingsThemes', 'generalBody')}</P>

      <H2 id="toc-canvasTitle">{c('settingsThemes', 'canvasTitle')}</H2>
      <P>{c('settingsThemes', 'canvasBody')}</P>

      <H2 id="toc-valuesTitle">{c('settingsThemes', 'valuesTitle')}</H2>
      <P>{c('settingsThemes', 'valuesBody')}</P>

      <H2 id="toc-perfTitle">{c('settingsThemes', 'perfTitle')}</H2>
      <P>{c('settingsThemes', 'perfBody')}</P>

      <H2 id="toc-themeTitle">{c('settingsThemes', 'themeTitle')}</H2>
      <P>{c('settingsThemes', 'themeBody')}</P>

      <H2 id="toc-wizardTitle">{c('settingsThemes', 'wizardTitle')}</H2>
      <P>{c('settingsThemes', 'wizardBody')}</P>
    </>
  )
}

function AiAssistantSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secAiAssistant')}</H1>
      <P>{c('ai', 'intro')}</P>

      <H2 id="toc-openTitle">{c('ai', 'openTitle')}</H2>
      <P>{c('ai', 'openBody')}</P>

      <H2 id="toc-modeTitle">{c('ai', 'modeTitle')}</H2>
      <P>{c('ai', 'modeBody')}</P>

      <H2 id="toc-chatTitle">{c('ai', 'chatTitle')}</H2>
      <P>{c('ai', 'chatBody')}</P>

      <H2 id="toc-capabilitiesTitle">{c('ai', 'capabilitiesTitle')}</H2>
      <Ul>
        <Li>{c('ai', 'cap1')}</Li>
        <Li>{c('ai', 'cap2')}</Li>
        <Li>{c('ai', 'cap3')}</Li>
        <Li>{c('ai', 'cap4')}</Li>
      </Ul>

      <H2 id="toc-privacyTitle">{c('ai', 'privacyTitle')}</H2>
      <P>{c('ai', 'privacyBody')}</P>

      <Tip>{c('ai', 'tip')}</Tip>
    </>
  )
}

function FormulaBarSection() {
  return (
    <>
      <H1>{c('formulaBar', 'intro').split('.')[0]}</H1>
      <P>{c('formulaBar', 'intro')}</P>

      <H2 id="toc-openTitle">{c('formulaBar', 'openTitle')}</H2>
      <P>{c('formulaBar', 'openBody')}</P>

      <H2 id="toc-syntaxTitle">{c('formulaBar', 'syntaxTitle')}</H2>
      <P>{c('formulaBar', 'syntaxBasic')}</P>
      <P>{c('formulaBar', 'syntaxFunctions')}</P>
      <P>{c('formulaBar', 'syntaxVariables')}</P>
      <P>{c('formulaBar', 'syntaxConstants')}</P>

      <H2 id="toc-autocompleteTitle">{c('formulaBar', 'autocompleteTitle')}</H2>
      <P>{c('formulaBar', 'autocompleteBody')}</P>

      <H2 id="toc-historyTitle">{c('formulaBar', 'historyTitle')}</H2>
      <P>{c('formulaBar', 'historyBody')}</P>

      <H2 id="toc-latexTitle">{c('formulaBar', 'latexTitle')}</H2>
      <P>{c('formulaBar', 'latexBody')}</P>

      <Tip>{c('formulaBar', 'tip')}</Tip>
    </>
  )
}

function TroubleshootingSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secTroubleshooting')}</H1>
      <P>{c('trouble', 'intro')}</P>

      <H3>{c('trouble', 'nanTitle')}</H3>
      <P>{c('trouble', 'nanBody')}</P>

      <H3>{c('trouble', 'cycleTitle')}</H3>
      <P>{c('trouble', 'cycleBody')}</P>

      <H3>{c('trouble', 'slowTitle')}</H3>
      <P>{c('trouble', 'slowBody')}</P>

      <H3>{c('trouble', 'saveTitle')}</H3>
      <P>{c('trouble', 'saveBody')}</P>

      <H3>
        {c('trouble', 'unitsTitle') !== 'unitsTitle'
          ? c('trouble', 'unitsTitle')
          : 'Unit mismatch warnings'}
      </H3>
      <P>
        {c('trouble', 'unitsBody') !== 'unitsBody'
          ? c('trouble', 'unitsBody')
          : 'If you see a unit warning on a chain, the connected blocks have incompatible dimensions. Open the unit picker on one of the blocks and correct the assignment, or remove the unit to treat the value as dimensionless.'}
      </P>

      <H3>
        {c('trouble', 'offlineTitle') !== 'offlineTitle'
          ? c('trouble', 'offlineTitle')
          : 'Offline and network issues'}
      </H3>
      <P>
        {c('trouble', 'offlineBody') !== 'offlineBody'
          ? c('trouble', 'offlineBody')
          : 'ChainSolve runs its engine entirely in the browser. You can continue working offline, but saving to the cloud and AI features require a network connection. Data is queued and synced when connectivity returns.'}
      </P>

      <H3>{c('trouble', 'proTitle')}</H3>
      <P>{c('trouble', 'proBody')}</P>

      <H3>{c('trouble', 'contactTitle')}</H3>
      <P>{c('trouble', 'contactBody')}</P>
    </>
  )
}

function ShortcutsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secShortcuts')}</H1>
      <P>{c('shortcuts', 'intro')}</P>

      <H2 id="toc-generalTitle">{c('shortcuts', 'generalTitle')}</H2>
      <ShortcutRow keys="Ctrl + S" desc={c('shortcuts', 'save')} />
      <ShortcutRow keys="Ctrl + Z" desc={c('shortcuts', 'undo')} />
      <ShortcutRow keys="Ctrl + Y" desc={c('shortcuts', 'redo')} />
      <ShortcutRow keys="Ctrl + K" desc={c('shortcuts', 'palette')} />
      <ShortcutRow keys="Delete" desc={c('shortcuts', 'delete')} />
      <ShortcutRow keys="Escape" desc={c('shortcuts', 'escape') || 'Deselect all / close panel'} />

      <H2 id="toc-canvasTitle">{c('shortcuts', 'canvasTitle')}</H2>
      <ShortcutRow keys="Ctrl + G" desc={c('shortcuts', 'group')} />
      <ShortcutRow keys="Ctrl + D" desc={c('shortcuts', 'duplicate')} />
      <ShortcutRow keys="Ctrl + A" desc={c('shortcuts', 'selectAll')} />
      <ShortcutRow keys="Ctrl + +" desc={c('shortcuts', 'zoomIn')} />
      <ShortcutRow keys="Ctrl + -" desc={c('shortcuts', 'zoomOut')} />
      <ShortcutRow keys="Ctrl + 0" desc={c('shortcuts', 'fitView')} />
      <ShortcutRow keys="Space + Drag" desc={c('shortcuts', 'panCanvas') || 'Pan the canvas'} />
      <ShortcutRow keys="Scroll wheel" desc={c('shortcuts', 'scrollZoom') || 'Zoom in/out'} />
    </>
  )
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div style={shortcutRowStyle}>
      <Kbd>{keys}</Kbd>
      <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 1.5rem',
  height: 56,
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-2)',
}

const backBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '0.4rem 0.85rem',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  borderRadius: 8,
  fontWeight: 500,
}

const layoutStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  maxWidth: 1100,
  width: '100%',
  margin: '0 auto',
  padding: '2rem 1.5rem',
  gap: '2rem',
}

const sidebarStyle: CSSProperties = {
  width: 240,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  maxHeight: 'calc(100vh - 56px - 4rem)',
  overflowY: 'auto',
}

const sidebarTitle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const searchInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.45rem 0.65rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '0.82rem',
  outline: 'none',
  marginBottom: '0.75rem',
  fontFamily: 'inherit',
}

const searchResultsStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: '0.75rem',
  maxHeight: 280,
  overflowY: 'auto',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
}

const searchResultItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
  width: '100%',
  padding: '0.5rem 0.65rem',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  color: 'inherit',
}

const highlightMarkStyle: CSSProperties = {
  background: 'rgba(28,171,176,0.25)',
  color: 'inherit',
  borderRadius: 2,
  padding: '0 1px',
}

const sidebarNavStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const groupLabelBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  width: '100%',
  border: 'none',
  background: 'transparent',
  padding: '0.3rem 0.5rem',
  marginTop: '0.25rem',
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function chevronStyle(collapsed: boolean): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '0.55rem',
    transition: 'transform 0.15s',
    transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
  }
}

function sidebarItemStyle(active: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '0.35rem 0.65rem 0.35rem 1.2rem',
    border: 'none',
    borderRadius: 6,
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
    transition: 'background 0.12s',
    marginBottom: '0.1rem',
  }
}

const contentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: 720,
}

const breadcrumbStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.78rem',
  marginBottom: '1rem',
  flexWrap: 'wrap',
}

const breadcrumbLink: CSSProperties = {
  color: 'var(--text-muted)',
}

const breadcrumbSep: CSSProperties = {
  color: 'var(--text-muted)',
  opacity: 0.4,
}

const breadcrumbCurrent: CSSProperties = {
  color: 'var(--text)',
  fontWeight: 600,
}

const tocContainerStyle: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  marginBottom: '1.25rem',
}

const tocTitle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  marginBottom: '0.5rem',
}

const tocLinkStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  color: 'var(--primary)',
  textDecoration: 'none',
  padding: '0.2rem 0',
  cursor: 'pointer',
}

const feedbackContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginTop: '2rem',
  padding: '0.75rem 1rem',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  flexWrap: 'wrap',
}

function feedbackBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.75rem',
    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
    borderRadius: 6,
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

const h1Style: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  margin: '0 0 0.75rem',
  color: 'var(--text)',
  lineHeight: 1.3,
}

const h2Style: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  margin: '1.5rem 0 0.5rem',
  color: 'var(--text)',
  lineHeight: 1.3,
}

const h3Style: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  margin: '1.25rem 0 0.35rem',
  color: 'var(--text)',
}

const pStyle: CSSProperties = {
  fontSize: '0.88rem',
  lineHeight: 1.65,
  color: 'var(--text-muted)',
  margin: '0 0 0.75rem',
}

const ulStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  paddingLeft: '1.25rem',
}

const olStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  paddingLeft: '1.25rem',
}

const liStyle: CSSProperties = {
  fontSize: '0.88rem',
  lineHeight: 1.65,
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
}

const tipStyle: CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: 8,
  background: 'var(--primary-dim)',
  border: '1px solid var(--primary)',
  fontSize: '0.84rem',
  lineHeight: 1.55,
  color: 'var(--text)',
  margin: '1rem 0',
}

const blockRefStyle: CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
}

const proBadgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.4rem',
  borderRadius: 4,
  background: 'var(--primary)',
  color: '#fff',
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  verticalAlign: 'middle',
  marginLeft: '0.35rem',
}

const kbdStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.45rem',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  fontFamily: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--text)',
  minWidth: 100,
}

const shortcutRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.35rem 0',
  fontSize: '0.85rem',
}

const dimTableContainerStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  overflow: 'hidden',
  marginBottom: '1rem',
}

const dimRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.35rem 0.65rem',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.82rem',
  flexWrap: 'wrap',
}

const pageNavStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '2.5rem',
  paddingTop: '1.25rem',
  borderTop: '1px solid var(--border)',
}

const pageNavBtnStyle: CSSProperties = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontSize: '0.84rem',
  padding: '0.4rem 0.85rem',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--primary)',
  borderRadius: 8,
  fontWeight: 500,
}
