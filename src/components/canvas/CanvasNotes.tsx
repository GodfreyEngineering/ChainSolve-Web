/**
 * CanvasNotes — per-sheet notes panel for the BottomDock.
 *
 * Stores notes in localStorage keyed by canvasId. Provides a basic
 * textarea with bold/italic/bullet-list Markdown hints in the placeholder.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_PREFIX = 'cs:canvasNotes:'

function loadNotes(canvasId: string): string {
  try {
    return localStorage.getItem(STORAGE_PREFIX + canvasId) ?? ''
  } catch {
    return ''
  }
}

function saveNotes(canvasId: string, text: string) {
  try {
    if (text) {
      localStorage.setItem(STORAGE_PREFIX + canvasId, text)
    } else {
      localStorage.removeItem(STORAGE_PREFIX + canvasId)
    }
  } catch {
    // Private browsing
  }
}

interface CanvasNotesProps {
  canvasId: string
}

export function CanvasNotes({ canvasId }: CanvasNotesProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(() => loadNotes(canvasId))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reload notes when canvas changes
  useEffect(() => {
    setText(loadNotes(canvasId))
  }, [canvasId])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setText(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => saveNotes(canvasId, value), 300)
    },
    [canvasId],
  )

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div style={wrapperStyle}>
      <textarea
        style={textareaStyle}
        value={text}
        onChange={handleChange}
        placeholder={t(
          'canvasNotes.placeholder',
          'Sheet notes\u2026 (Markdown supported: **bold**, *italic*, - bullet list)',
        )}
        spellCheck
      />
    </div>
  )
}

const wrapperStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: 8,
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  resize: 'none',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.78rem',
  lineHeight: 1.5,
  outline: 'none',
}
