/**
 * DebugConsolePanel — Bottom panel showing structured log entries.
 *
 * Renders inside CanvasArea's canvas-wrap div (absolute-positioned at the
 * bottom). All state lives in debugConsoleStore.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useDebugConsoleStore,
  filterEntries,
  exportText,
  exportJson,
  LOG_LEVELS,
  LOG_SCOPES,
} from '../../stores/debugConsoleStore'
import type { LogLevel, LogScope, LogEntry } from '../../stores/debugConsoleStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const d = new Date(ts)
  return d.toISOString().slice(11, 23)
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  debug: '#8b5cf6',
  trace: '#6b7280',
}

const SCOPE_COLORS: Record<LogScope, string> = {
  engine: '#14b8a6',
  bindings: '#a78bfa',
  variables: '#3b82f6',
  persistence: '#f59e0b',
  network: '#10b981',
  perf: '#ec4899',
  ui: '#6b7280',
}

// ── Component ──────────────────────────────────────────────────────────────────

interface DebugConsolePanelProps {
  onClose?: () => void
}

export default function DebugConsolePanel({ onClose }: DebugConsolePanelProps) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  const [minimized, setMinimized] = useState(false)

  const entries = useDebugConsoleStore((s) => s.entries)
  const minLevel = useDebugConsoleStore((s) => s.minLevel)
  const enabledScopes = useDebugConsoleStore((s) => s.enabledScopes)
  const search = useDebugConsoleStore((s) => s.search)
  const paused = useDebugConsoleStore((s) => s.paused)
  const autoScroll = useDebugConsoleStore((s) => s.autoScroll)

  const setMinLevel = useDebugConsoleStore((s) => s.setMinLevel)
  const toggleScope = useDebugConsoleStore((s) => s.toggleScope)
  const setSearch = useDebugConsoleStore((s) => s.setSearch)
  const setPaused = useDebugConsoleStore((s) => s.setPaused)
  const setAutoScroll = useDebugConsoleStore((s) => s.setAutoScroll)
  const clear = useDebugConsoleStore((s) => s.clear)

  const filtered = useMemo(
    () => filterEntries(entries, minLevel, enabledScopes, search),
    [entries, minLevel, enabledScopes, search],
  )

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filtered.length, autoScroll])

  const handleExportTxt = useCallback(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFile(exportText(filtered), `chainsolve-debug-${ts}.txt`, 'text/plain')
  }, [filtered])

  const handleExportJson = useCallback(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFile(exportJson(filtered), `chainsolve-debug-${ts}.json`, 'application/json')
  }, [filtered])

  return (
    <div style={minimized ? { ...panelStyle, height: 'auto' } : panelStyle}>
      {/* Header row */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: '0.75rem', opacity: 0.7 }}>
          {t('debugConsole.title', 'Debug Console')}
        </span>

        {/* Level dropdown */}
        <select
          value={minLevel}
          onChange={(e) => setMinLevel(e.target.value as LogLevel)}
          style={selectStyle}
          title={t('debugConsole.logLevel', 'Log level')}
        >
          {LOG_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Scope chips */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {LOG_SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => toggleScope(s)}
              style={chipStyle(enabledScopes.has(s), SCOPE_COLORS[s])}
              title={s}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('debugConsole.search', 'Filter…')}
          style={searchStyle}
        />

        {/* Controls */}
        <button
          onClick={() => setPaused(!paused)}
          style={ctrlBtn(paused)}
          title={paused ? t('debugConsole.resume', 'Resume') : t('debugConsole.pause', 'Pause')}
        >
          {paused ? '\u25b6' : '\u23f8'}
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={ctrlBtn(autoScroll)}
          title={t('debugConsole.autoScroll', 'Auto-scroll')}
        >
          {'\u2193'}
        </button>
        <button onClick={clear} style={ctrlBtn(false)} title={t('debugConsole.clear', 'Clear')}>
          {'\u2715'}
        </button>
        <button
          onClick={handleExportTxt}
          style={ctrlBtn(false)}
          title={t('debugConsole.exportTxt', 'Export .txt')}
        >
          TXT
        </button>
        <button
          onClick={handleExportJson}
          style={ctrlBtn(false)}
          title={t('debugConsole.exportJson', 'Export .json')}
        >
          JSON
        </button>

        <span style={{ fontSize: '0.65rem', opacity: 0.4, marginLeft: 'auto' }}>
          {filtered.length}/{entries.length}
        </span>

        <button
          onClick={() => setMinimized((v) => !v)}
          style={ctrlBtn(false)}
          title={minimized ? 'Expand' : 'Minimize'}
          aria-label={minimized ? 'Expand' : 'Minimize'}
        >
          {minimized ? '\u25b3' : '\u25bd'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={ctrlBtn(false)}
            title={t('common.close', 'Close')}
            aria-label={t('common.close', 'Close')}
          >
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Log list */}
      {!minimized && (
        <div ref={listRef} style={listStyle}>
          {filtered.length === 0 ? (
            <div
              style={{ padding: '1rem', opacity: 0.4, fontSize: '0.75rem', textAlign: 'center' }}
            >
              {t('debugConsole.noLogs', 'No log entries')}
            </div>
          ) : (
            filtered.map((e) => <Row key={e.id} entry={e} />)
          )}
        </div>
      )}
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────────

function Row({ entry }: { entry: LogEntry }) {
  return (
    <div style={rowStyle(entry.level)}>
      <span style={tsStyle}>{formatTs(entry.ts)}</span>
      <span style={levelBadge(entry.level)}>{entry.level.toUpperCase().padEnd(5)}</span>
      <span style={scopeBadge(entry.scope)}>{entry.scope}</span>
      <span style={msgStyle}>{entry.msg}</span>
      {entry.meta && <span style={metaStyle}>{JSON.stringify(entry.meta)}</span>}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 200,
  zIndex: 15,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--card-bg, #1e1e1e)',
  borderTop: '1px solid var(--border, #333)',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.72rem',
  color: 'var(--text, #f4f4f3)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderBottom: '1px solid var(--border, #333)',
  flexShrink: 0,
  flexWrap: 'wrap',
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg, #121212)',
  color: 'var(--text, #f4f4f3)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  fontSize: '0.68rem',
  padding: '1px 4px',
}

const searchStyle: React.CSSProperties = {
  background: 'var(--bg, #121212)',
  color: 'var(--text, #f4f4f3)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  fontSize: '0.68rem',
  padding: '1px 6px',
  width: 100,
  outline: 'none',
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    fontSize: '0.6rem',
    padding: '0px 4px',
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? `${color}33` : 'transparent',
    color: active ? color : 'var(--text-muted, #888)',
    opacity: active ? 1 : 0.5,
  }
}

function ctrlBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: 'var(--text, #f4f4f3)',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: '0.68rem',
    padding: '1px 5px',
    fontFamily: 'inherit',
    opacity: active ? 1 : 0.6,
  }
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
}

function rowStyle(level: LogLevel): React.CSSProperties {
  const isError = level === 'error'
  return {
    display: 'flex',
    gap: 6,
    padding: '1px 8px',
    alignItems: 'baseline',
    background: isError ? 'rgba(239,68,68,0.08)' : 'transparent',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    lineHeight: 1.6,
  }
}

const tsStyle: React.CSSProperties = {
  color: 'var(--text-muted, #888)',
  flexShrink: 0,
  fontSize: '0.65rem',
}

function levelBadge(level: LogLevel): React.CSSProperties {
  return {
    color: LEVEL_COLORS[level],
    fontWeight: 600,
    flexShrink: 0,
    width: 36,
    fontSize: '0.65rem',
  }
}

function scopeBadge(scope: LogScope): React.CSSProperties {
  return {
    color: SCOPE_COLORS[scope],
    flexShrink: 0,
    width: 72,
    fontSize: '0.65rem',
  }
}

const msgStyle: React.CSSProperties = {
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const metaStyle: React.CSSProperties = {
  color: 'var(--text-muted, #888)',
  fontSize: '0.6rem',
  maxWidth: 300,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexShrink: 0,
}
