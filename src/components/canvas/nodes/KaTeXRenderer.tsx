/**
 * KaTeXRenderer — UX-22: Lazy-loaded KaTeX math renderer for annotation nodes.
 *
 * Parses text for `$...$` (inline) and `$$...$$` (display) math patterns,
 * renders each segment using KaTeX, and falls back to raw text on error.
 *
 * KaTeX is loaded lazily via dynamic import on first render.
 */

import { useState, useEffect } from 'react'
import 'katex/dist/katex.min.css'

// ── KaTeX lazy loader ────────────────────────────────────────────────────────

type KatexLib = {
  renderToString: (
    expr: string,
    opts?: { throwOnError?: boolean; displayMode?: boolean },
  ) => string
}

let katexPromise: Promise<KatexLib> | null = null
let katexLib: KatexLib | null = null

function loadKatex(): Promise<KatexLib> {
  if (katexLib) return Promise.resolve(katexLib)
  if (!katexPromise) {
    katexPromise = import('katex').then((mod) => {
      katexLib = mod.default as unknown as KatexLib
      return katexLib
    })
  }
  return katexPromise
}

// ── Segment parser ────────────────────────────────────────────────────────────

type Segment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'display'; content: string }

/** Split text into plain-text and LaTeX segments. $$...$$ takes priority. */
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  // Match $$...$$ first (display), then $...$ (inline)
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'text', content: text.slice(lastIdx, match.index) })
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'display', content: match[1] })
    } else {
      segments.push({ type: 'inline', content: match[2] ?? '' })
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIdx) })
  }
  return segments
}

// ── Rendered segment ──────────────────────────────────────────────────────────

interface RenderedSegmentProps {
  segment: Segment
  katex: KatexLib | null
}

function RenderedSegment({ segment, katex }: RenderedSegmentProps) {
  if (segment.type === 'text') {
    return <>{segment.content}</>
  }
  if (!katex) {
    // Not yet loaded — show raw delimited form
    return (
      <>
        {segment.type === 'display' ? '$$' : '$'}
        {segment.content}
        {segment.type === 'display' ? '$$' : '$'}
      </>
    )
  }
  // Compute HTML string (may throw) outside JSX to satisfy react-hooks/error-boundaries
  let html: string
  try {
    html = katex.renderToString(segment.content, {
      throwOnError: false,
      displayMode: segment.type === 'display',
    })
  } catch {
    return <>{segment.content}</>
  }
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      style={segment.type === 'display' ? { display: 'block', textAlign: 'center' } : undefined}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface KaTeXRendererProps {
  text: string
}

/**
 * Renders text with inline $...$ and display $$...$$ LaTeX math via KaTeX.
 * KaTeX CSS is imported at module level; the JS is lazy-loaded on first mount.
 */
export function KaTeXRenderer({ text }: KaTeXRendererProps) {
  const [katex, setKatex] = useState<KatexLib | null>(katexLib)

  useEffect(() => {
    if (katexLib) return
    let cancelled = false
    loadKatex().then((lib) => {
      if (!cancelled) setKatex(lib)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const segments = parseSegments(text)
  return (
    <>
      {segments.map((seg, i) => (
        <RenderedSegment key={i} segment={seg} katex={katex} />
      ))}
    </>
  )
}
