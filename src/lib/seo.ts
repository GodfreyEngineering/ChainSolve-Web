/**
 * seo.ts — Lightweight per-page SEO helper (I6-2).
 *
 * Updates document.title and the <meta name="description"> tag when a
 * public page mounts.  Restores the default values on unmount so
 * in-app routes don't inherit stale SEO text.
 */

import { useEffect } from 'react'

const DEFAULT_TITLE = 'ChainSolve'

/**
 * Set document title and meta description for the lifetime of the
 * calling component.  Both are restored to defaults on unmount.
 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDescription = meta?.content ?? ''

    if (description) {
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = description
    }

    return () => {
      document.title = prevTitle
      if (meta) meta.content = prevDescription
    }
  }, [title, description])
}

/** Build a page title in the standard "Page — ChainSolve" format. */
export function pageTitle(page: string): string {
  return `${page} — ${DEFAULT_TITLE}`
}
