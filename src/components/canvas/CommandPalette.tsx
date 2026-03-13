/**
 * CommandPalette — UX-03: Cmd+K global command palette.
 *
 * Shows all canvas actions, block search, and node navigation.
 * Fuzzy search across command labels, block names, and node labels.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { BLOCK_REGISTRY } from '../../blocks/registry'
import { trackBlockUsed } from './blockLibraryUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommandKind = 'action' | 'block' | 'node'

export interface PaletteCommand {
  id: string
  kind: CommandKind
  label: string
  /** Short description shown below the label */
  hint?: string
  /** Keyboard shortcut hint (e.g. 'Ctrl+Z') */
  kbd?: string
  icon?: string
  onExecute: () => void
}

interface CommandPaletteProps {
  commands: PaletteCommand[]
  /** Canvas nodes for "navigate to node" search */
  nodeLabels?: { id: string; label: string; onJump: () => void }[]
  /** Called when palette should close */
  onClose: () => void
  /** Called when user enters a plain block-name query and hits Enter */
  onInsertBlock?: (blockType: string) => void
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyScore(text: string, query: string): number | null {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  if (t.includes(q)) return 2
  // Simple subsequence check
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  if (qi === q.length) return 3 + t.length
  return null
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
}

const panel: CSSProperties = {
  width: 540,
  maxWidth: 'calc(100vw - 32px)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.85rem 1rem',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '1rem',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const resultList: CSSProperties = {
  maxHeight: 360,
  overflowY: 'auto',
  padding: '0.3rem 0',
}

const groupLabel: CSSProperties = {
  padding: '0.3rem 1rem 0.1rem',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.07em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
}

const kindColors: Record<CommandKind, string> = {
  action: 'var(--primary-text)',
  block: '#22c55e',
  node: '#f97316',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette({
  commands,
  nodeLabels = [],
  onClose,
  onInsertBlock,
}: CommandPaletteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Build block commands
  const blockCommands: PaletteCommand[] = useMemo(() => {
    return [...BLOCK_REGISTRY.values()].map((def) => ({
      id: `block:${def.type}`,
      kind: 'block' as CommandKind,
      label: def.label,
      hint: def.description,
      icon: '⊞',
      onExecute: () => {
        if (onInsertBlock) {
          trackBlockUsed(def.type)
          onInsertBlock(def.type)
        }
      },
    }))
  }, [onInsertBlock])

  // Build node navigation commands
  const nodeCommands: PaletteCommand[] = useMemo(() => {
    return nodeLabels.map((n) => ({
      id: `node:${n.id}`,
      kind: 'node' as CommandKind,
      label: n.label,
      hint: t('commandPalette.jumpToNode', 'Jump to block'),
      icon: '⤳',
      onExecute: n.onJump,
    }))
  }, [nodeLabels, t])

  const q = query.trim().toLowerCase()

  // Filter and score all commands
  const allItems: PaletteCommand[] = useMemo(() => {
    const all = [...commands, ...blockCommands, ...nodeCommands]
    if (!q) {
      // Show only actions when no query; recent blocks first, then all actions
      return commands.filter((c) => c.kind === 'action')
    }
    const scored: { cmd: PaletteCommand; score: number }[] = []
    for (const cmd of all) {
      const s = fuzzyScore(cmd.label, q)
      if (s !== null) scored.push({ cmd, score: s })
      else if (cmd.hint) {
        const hs = fuzzyScore(cmd.hint, q)
        if (hs !== null) scored.push({ cmd, score: hs + 5 })
      }
    }
    // Deduplicate by id
    const seen = new Set<string>()
    return scored
      .sort((a, b) => a.score - b.score || a.cmd.label.localeCompare(b.cmd.label))
      .filter(({ cmd }) => {
        if (seen.has(cmd.id)) return false
        seen.add(cmd.id)
        return true
      })
      .map(({ cmd }) => cmd)
  }, [q, commands, blockCommands, nodeCommands])

  // Clamp selection
  const clampedIndex = Math.min(selectedIndex, Math.max(0, allItems.length - 1))

  const execute = (item: PaletteCommand) => {
    item.onExecute()
    onClose()
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[clampedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [clampedIndex])

  // Group items for display
  const grouped = useMemo(() => {
    if (!q) return [{ label: '', items: allItems }]
    const groups: Record<CommandKind, PaletteCommand[]> = { action: [], block: [], node: [] }
    for (const item of allItems) groups[item.kind].push(item)
    const result: { label: string; items: PaletteCommand[] }[] = []
    if (groups.action.length > 0)
      result.push({ label: t('commandPalette.actions', 'Actions'), items: groups.action })
    if (groups.block.length > 0)
      result.push({ label: t('commandPalette.blocks', 'Blocks'), items: groups.block.slice(0, 12) })
    if (groups.node.length > 0)
      result.push({ label: t('commandPalette.nodes', 'Blocks'), items: groups.node.slice(0, 8) })
    return result
  }, [q, allItems, t])

  // Flat indexed list for keyboard nav
  const flatItems = grouped.flatMap((g) => g.items)

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder={t(
            'commandPalette.placeholder',
            'Type a command, block name, or block label…',
          )}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              const item = flatItems[clampedIndex]
              if (item) execute(item)
            } else if (e.key === 'Escape') {
              onClose()
            }
          }}
        />

        {flatItems.length === 0 && q && (
          <div
            style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: '0.85rem',
            }}
          >
            {t('commandPalette.noResults', 'No results for')} &ldquo;{query}&rdquo;
          </div>
        )}

        {flatItems.length === 0 && !q && (
          <div
            style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: '0.85rem',
            }}
          >
            {t(
              'commandPalette.hint',
              'Start typing to search actions, blocks, or navigate to a node.',
            )}
          </div>
        )}

        {flatItems.length > 0 && (
          <div ref={listRef} style={resultList}>
            {grouped.map((group) => {
              let itemOffset = 0
              for (const g of grouped) {
                if (g === group) break
                itemOffset += g.items.length
              }
              return (
                <div key={group.label}>
                  {group.label && <div style={groupLabel}>{group.label}</div>}
                  {group.items.map((item, localIdx) => {
                    const globalIdx = itemOffset + localIdx
                    const isSelected = globalIdx === clampedIndex
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.5rem 1rem',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary-dim)' : 'transparent',
                          borderLeft: isSelected
                            ? `2px solid ${kindColors[item.kind]}`
                            : '2px solid transparent',
                          gap: '0.6rem',
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        onClick={() => execute(item)}
                      >
                        {item.icon && (
                          <span
                            style={{
                              fontSize: '0.9rem',
                              opacity: 0.7,
                              width: 18,
                              textAlign: 'center',
                            }}
                          >
                            {item.icon}
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.label}</div>
                          {item.hint && (
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.hint}
                            </div>
                          )}
                        </div>
                        {item.kbd && (
                          <kbd
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.1rem 0.4rem',
                              background: 'var(--surface-3, rgba(255,255,255,0.06))',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-faint)',
                              fontFamily: 'inherit',
                              flexShrink: 0,
                            }}
                          >
                            {item.kbd}
                          </kbd>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
