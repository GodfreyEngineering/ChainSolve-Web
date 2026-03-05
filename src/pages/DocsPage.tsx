/**
 * DocsPage.tsx — Full public documentation page at /docs (I1-1).
 *
 * Sidebar navigation with search, structured into sections covering
 * onboarding, block library, units, variables, materials, publishing,
 * Explore, exports, AI assistant, and troubleshooting.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import i18n from '../i18n/config'
import { getDocsContentSync } from '../docs/docsContentLoader'

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

  const section = (searchParams.get('section') as DocsSection) || 'onboarding'
  const groups = useSidebarGroups()

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Filter sidebar items by search query
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, search])

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

  function setSection(id: DocsSection) {
    setSearchParams({ section: id })
  }

  // Determine prev/next for navigation
  const currentIndex = allItems.findIndex((it) => it.id === section)
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null
  const nextItem = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

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
            placeholder={t('docsPage.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
            aria-label={t('docsPage.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
          <nav style={sidebarNavStyle}>
            {filteredGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: '0.75rem' }}>
                <div style={groupLabelStyle}>{group.label}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    style={sidebarItemStyle(section === item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.5rem' }}>
                {t('docsPage.noResults')}
              </p>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main ref={contentRef} style={contentStyle}>
          <DocsContent section={section} />

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

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={h2Style}>{children}</h2>
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

      <H2>{c('onboarding', 'whatIsTitle')}</H2>
      <P>{c('onboarding', 'whatIsBody')}</P>

      <H2>{c('onboarding', 'firstCanvasTitle')}</H2>
      <Ol>
        <Li>{c('onboarding', 'step1')}</Li>
        <Li>{c('onboarding', 'step2')}</Li>
        <Li>{c('onboarding', 'step3')}</Li>
        <Li>{c('onboarding', 'step4')}</Li>
        <Li>{c('onboarding', 'step5')}</Li>
      </Ol>

      <H2>{c('onboarding', 'connectingTitle')}</H2>
      <P>{c('onboarding', 'connectingBody')}</P>

      <H2>{c('onboarding', 'savingTitle')}</H2>
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

      <H2>{c('uiOverview', 'headerTitle')}</H2>
      <P>{c('uiOverview', 'headerBody')}</P>

      <H2>{c('uiOverview', 'canvasTitle')}</H2>
      <P>{c('uiOverview', 'canvasBody')}</P>

      <H2>{c('uiOverview', 'toolbarTitle')}</H2>
      <P>{c('uiOverview', 'toolbarBody')}</P>

      <H2>{c('uiOverview', 'inspectorTitle')}</H2>
      <P>{c('uiOverview', 'inspectorBody')}</P>

      <H2>{c('uiOverview', 'panelsTitle')}</H2>
      <P>{c('uiOverview', 'panelsBody')}</P>

      <H2>{c('uiOverview', 'windowsTitle')}</H2>
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

      <H2>{c('blockLibrary', 'categoriesTitle')}</H2>
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

      <H2>{c('blockLibrary', 'addingTitle')}</H2>
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
      <H2>{c('blockMath', 'arithmeticTitle')}</H2>
      <BlockRef name="Add" desc="A + B" />
      <BlockRef name="Subtract" desc="A - B" />
      <BlockRef name="Multiply" desc="A * B" />
      <BlockRef name="Divide" desc="A / B (error if B = 0)" />
      <BlockRef name="Negate" desc="-A" />
      <BlockRef name="Mod" desc="A mod B (error if B = 0)" />

      <H2>{c('blockMath', 'roundingTitle')}</H2>
      <BlockRef name="Floor" desc={c('blockMath', 'floor')} />
      <BlockRef name="Ceil" desc={c('blockMath', 'ceil')} />
      <BlockRef name="Round" desc={c('blockMath', 'round')} />
      <BlockRef name="Round N" desc={c('blockMath', 'roundN')} />
      <BlockRef name="Trunc" desc={c('blockMath', 'trunc')} />
      <BlockRef name="Sign" desc={c('blockMath', 'sign')} />

      <H2>{c('blockMath', 'expLogTitle')}</H2>
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

      <H2>{c('blockEng', 'mechanicsTitle')}</H2>
      <P>{c('blockEng', 'mechanicsBody')}</P>
      <BlockRef name="Force (F = m * a)" desc={c('blockEng', 'force')} />
      <BlockRef name="Kinetic Energy (KE = 0.5 * m * v^2)" desc={c('blockEng', 'ke')} />
      <BlockRef name="Power/Work/Time (P = W / t)" desc={c('blockEng', 'power')} />
      <BlockRef name="Hooke's Law (F = k * x)" desc={c('blockEng', 'hooke')} />

      <H2>{c('blockEng', 'sectionsTitle')}</H2>
      <P>{c('blockEng', 'sectionsBody')}</P>

      <H2>{c('blockEng', 'fluidsTitle')}</H2>
      <P>{c('blockEng', 'fluidsBody')}</P>

      <H2>{c('blockEng', 'thermoTitle')}</H2>
      <P>{c('blockEng', 'thermoBody')}</P>

      <H2>{c('blockEng', 'electricalTitle')}</H2>
      <P>{c('blockEng', 'electricalBody')}</P>

      <H2>{c('blockEng', 'conversionsTitle')}</H2>
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

      <H2>{c('blockFin', 'tvmTitle')}</H2>
      <P>{c('blockFin', 'tvmBody')}</P>
      <BlockRef name="Compound FV" desc={c('blockFin', 'compoundFv')} />
      <BlockRef name="NPV" desc={c('blockFin', 'npv')} />
      <BlockRef name="IRR" desc={c('blockFin', 'irr')} />
      <BlockRef name="Annuity PV" desc={c('blockFin', 'annuityPv')} />
      <BlockRef name="Rule of 72" desc={c('blockFin', 'rule72')} />

      <H2>{c('blockFin', 'returnsTitle')}</H2>
      <P>{c('blockFin', 'returnsBody')}</P>

      <H2>{c('blockFin', 'deprTitle')}</H2>
      <P>{c('blockFin', 'deprBody')}</P>
    </>
  )
}

function BlockStatsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secBlockStats')}</H1>
      <P>{c('blockStats', 'intro')}</P>

      <H2>{c('blockStats', 'descTitle')}</H2>
      <P>{c('blockStats', 'descBody')}</P>
      <BlockRef name="Mean" desc={c('blockStats', 'mean')} />
      <BlockRef name="Std Dev" desc={c('blockStats', 'stddev')} />
      <BlockRef name="Median" desc={c('blockStats', 'median')} />
      <BlockRef name="Variance" desc={c('blockStats', 'variance')} />

      <H2>{c('blockStats', 'relTitle')}</H2>
      <P>{c('blockStats', 'relBody')}</P>

      <H2>{c('blockStats', 'probTitle')}</H2>
      <P>{c('blockStats', 'probBody')}</P>
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

      <H2>{c('blockData', 'vectorTitle')}</H2>
      <P>{c('blockData', 'vectorBody')}</P>

      <H2>{c('blockData', 'csvTitle')}</H2>
      <P>{c('blockData', 'csvBody')}</P>

      <H2>{c('blockData', 'opsTitle')}</H2>
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

      <H2>{c('blockConst', 'mathTitle')}</H2>
      <P>{c('blockConst', 'mathBody')}</P>

      <H2>{c('blockConst', 'physicsTitle')}</H2>
      <P>{c('blockConst', 'physicsBody')}</P>

      <H2>{c('blockConst', 'atmoTitle')}</H2>
      <P>{c('blockConst', 'atmoBody')}</P>

      <H2>{c('blockConst', 'thermoTitle')}</H2>
      <P>{c('blockConst', 'thermoBody')}</P>

      <H2>{c('blockConst', 'elecTitle')}</H2>
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

      <H2>{c('chains', 'createTitle')}</H2>
      <P>{c('chains', 'createBody')}</P>

      <H2>{c('chains', 'deleteTitle')}</H2>
      <P>{c('chains', 'deleteBody')}</P>

      <H2>{c('chains', 'dataFlowTitle')}</H2>
      <P>{c('chains', 'dataFlowBody')}</P>

      <H2>{c('chains', 'typesTitle')}</H2>
      <P>{c('chains', 'typesBody')}</P>

      <H2>{c('chains', 'multiTitle')}</H2>
      <P>{c('chains', 'multiBody')}</P>

      <H2>{c('chains', 'animatedTitle')}</H2>
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

      <H2>{c('units', 'assignTitle')}</H2>
      <P>{c('units', 'assignBody')}</P>

      <H2>{c('units', 'convertTitle')}</H2>
      <P>{c('units', 'convertBody')}</P>

      <H2>{c('units', 'dimensionsTitle')}</H2>
      <P>{c('units', 'dimensionsBody')}</P>

      <Tip>{c('units', 'tip')}</Tip>
    </>
  )
}

function VariablesSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secVariables')}</H1>
      <P>{c('variables', 'intro')}</P>

      <H2>{c('variables', 'createTitle')}</H2>
      <P>{c('variables', 'createBody')}</P>

      <H2>{c('variables', 'bindTitle')}</H2>
      <P>{c('variables', 'bindBody')}</P>

      <H2>{c('variables', 'sliderTitle')}</H2>
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

      <H2>{c('materials', 'presetsTitle')}</H2>
      <P>{c('materials', 'presetsBody')}</P>

      <H2>{c('materials', 'customTitle')}</H2>
      <P>{c('materials', 'customBody')}</P>

      <H2>{c('materials', 'fluidsTitle')}</H2>
      <P>{c('materials', 'fluidsBody')}</P>
    </>
  )
}

function ProjectsSection() {
  const { t } = useTranslation()
  return (
    <>
      <H1>{t('docsPage.secProjects')}</H1>
      <P>{c('projects', 'intro')}</P>

      <H2>{c('projects', 'createTitle')}</H2>
      <P>{c('projects', 'createBody')}</P>

      <H2>{c('projects', 'scratchTitle')}</H2>
      <P>{c('projects', 'scratchBody')}</P>

      <H2>{c('projects', 'savingTitle')}</H2>
      <P>{c('projects', 'savingBody')}</P>

      <H2>{c('projects', 'sheetsTitle')}</H2>
      <P>
        {c('projects', 'sheetsBody')} <ProBadge />
      </P>

      <H2>{c('projects', 'importExportTitle')}</H2>
      <P>{c('projects', 'importExportBody')}</P>

      <H2>{c('projects', 'deleteTitle')}</H2>
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

      <H2>{c('groups', 'createTitle')}</H2>
      <P>{c('groups', 'createBody')}</P>

      <H2>{c('groups', 'editTitle')}</H2>
      <P>{c('groups', 'editBody')}</P>

      <H2>{c('groups', 'moveTitle')}</H2>
      <P>{c('groups', 'moveBody')}</P>

      <H2>{c('groups', 'nestedTitle')}</H2>
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

      <H2>{c('savedGroups', 'saveTitle')}</H2>
      <P>{c('savedGroups', 'saveBody')}</P>

      <H2>{c('savedGroups', 'insertTitle')}</H2>
      <P>{c('savedGroups', 'insertBody')}</P>

      <H2>{c('savedGroups', 'manageTitle')}</H2>
      <P>{c('savedGroups', 'manageBody')}</P>

      <H2>{c('savedGroups', 'shareTitle')}</H2>
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

      <H2>{c('publish', 'howTitle')}</H2>
      <Ol>
        <Li>{c('publish', 'step1')}</Li>
        <Li>{c('publish', 'step2')}</Li>
        <Li>{c('publish', 'step3')}</Li>
        <Li>{c('publish', 'step4')}</Li>
      </Ol>

      <H2>{c('publish', 'typesTitle')}</H2>
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

      <H2>{c('explore', 'browseTitle')}</H2>
      <P>{c('explore', 'browseBody')}</P>

      <H2>{c('explore', 'installTitle')}</H2>
      <P>{c('explore', 'installBody')}</P>

      <H2>{c('explore', 'ratingsTitle')}</H2>
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

      <H2>{c('exports', 'pdfTitle')}</H2>
      <P>{c('exports', 'pdfBody')}</P>

      <H2>{c('exports', 'excelTitle')}</H2>
      <P>{c('exports', 'excelBody')}</P>

      <H2>{c('exports', 'jsonTitle')}</H2>
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

      <H2>{c('settingsThemes', 'accountTitle')}</H2>
      <P>{c('settingsThemes', 'accountBody')}</P>

      <H2>{c('settingsThemes', 'generalTitle')}</H2>
      <P>{c('settingsThemes', 'generalBody')}</P>

      <H2>{c('settingsThemes', 'canvasTitle')}</H2>
      <P>{c('settingsThemes', 'canvasBody')}</P>

      <H2>{c('settingsThemes', 'valuesTitle')}</H2>
      <P>{c('settingsThemes', 'valuesBody')}</P>

      <H2>{c('settingsThemes', 'perfTitle')}</H2>
      <P>{c('settingsThemes', 'perfBody')}</P>

      <H2>{c('settingsThemes', 'themeTitle')}</H2>
      <P>{c('settingsThemes', 'themeBody')}</P>

      <H2>{c('settingsThemes', 'wizardTitle')}</H2>
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

      <H2>{c('ai', 'openTitle')}</H2>
      <P>{c('ai', 'openBody')}</P>

      <H2>{c('ai', 'modeTitle')}</H2>
      <P>{c('ai', 'modeBody')}</P>

      <H2>{c('ai', 'chatTitle')}</H2>
      <P>{c('ai', 'chatBody')}</P>

      <H2>{c('ai', 'capabilitiesTitle')}</H2>
      <Ul>
        <Li>{c('ai', 'cap1')}</Li>
        <Li>{c('ai', 'cap2')}</Li>
        <Li>{c('ai', 'cap3')}</Li>
        <Li>{c('ai', 'cap4')}</Li>
      </Ul>

      <H2>{c('ai', 'privacyTitle')}</H2>
      <P>{c('ai', 'privacyBody')}</P>

      <Tip>{c('ai', 'tip')}</Tip>
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

      <H2>{c('shortcuts', 'generalTitle')}</H2>
      <ShortcutRow keys="Ctrl + S" desc={c('shortcuts', 'save')} />
      <ShortcutRow keys="Ctrl + Z" desc={c('shortcuts', 'undo')} />
      <ShortcutRow keys="Ctrl + Y" desc={c('shortcuts', 'redo')} />
      <ShortcutRow keys="Ctrl + K" desc={c('shortcuts', 'palette')} />
      <ShortcutRow keys="Delete" desc={c('shortcuts', 'delete')} />

      <H2>{c('shortcuts', 'canvasTitle')}</H2>
      <ShortcutRow keys="Ctrl + G" desc={c('shortcuts', 'group')} />
      <ShortcutRow keys="Ctrl + D" desc={c('shortcuts', 'duplicate')} />
      <ShortcutRow keys="Ctrl + A" desc={c('shortcuts', 'selectAll')} />
      <ShortcutRow keys="Ctrl + +" desc={c('shortcuts', 'zoomIn')} />
      <ShortcutRow keys="Ctrl + -" desc={c('shortcuts', 'zoomOut')} />
      <ShortcutRow keys="Ctrl + 0" desc={c('shortcuts', 'fitView')} />
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

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 1.5rem',
  height: 56,
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-2)',
}

const backBtnStyle: React.CSSProperties = {
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

const layoutStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  maxWidth: 1100,
  width: '100%',
  margin: '0 auto',
  padding: '2rem 1.5rem',
  gap: '2rem',
}

const sidebarStyle: React.CSSProperties = {
  width: 240,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  maxHeight: 'calc(100vh - 56px - 4rem)',
  overflowY: 'auto',
}

const sidebarTitle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const searchInputStyle: React.CSSProperties = {
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

const sidebarNavStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const groupLabelStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  padding: '0.25rem 0.5rem',
  marginTop: '0.25rem',
}

function sidebarItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '0.35rem 0.65rem',
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

const contentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: 720,
}

const h1Style: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  margin: '0 0 0.75rem',
  color: 'var(--text)',
  lineHeight: 1.3,
}

const h2Style: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  margin: '1.5rem 0 0.5rem',
  color: 'var(--text)',
  lineHeight: 1.3,
}

const h3Style: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  margin: '1.25rem 0 0.35rem',
  color: 'var(--text)',
}

const pStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  lineHeight: 1.65,
  color: 'var(--text-muted)',
  margin: '0 0 0.75rem',
}

const ulStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  paddingLeft: '1.25rem',
}

const olStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  paddingLeft: '1.25rem',
}

const liStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  lineHeight: 1.65,
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
}

const tipStyle: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: 8,
  background: 'var(--primary-dim)',
  border: '1px solid var(--primary)',
  fontSize: '0.84rem',
  lineHeight: 1.55,
  color: 'var(--text)',
  margin: '1rem 0',
}

const blockRefStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
}

const proBadgeStyle: React.CSSProperties = {
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

const kbdStyle: React.CSSProperties = {
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

const shortcutRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.35rem 0',
  fontSize: '0.85rem',
}

const pageNavStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '2.5rem',
  paddingTop: '1.25rem',
  borderTop: '1px solid var(--border)',
}

const pageNavBtnStyle: React.CSSProperties = {
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
