/**
 * seo.ts — Lightweight per-page SEO helper (I6-2, L2-2).
 *
 * Updates document.title, <meta name="description">, hreflang link
 * tags, and the canonical URL when a public page mounts.  Restores
 * defaults on unmount so in-app routes don't inherit stale SEO text.
 */

import { useEffect } from 'react'

const DEFAULT_TITLE = 'ChainSolve'

/** Base URL for canonical and hreflang links. */
export const SITE_ORIGIN = 'https://app.chainsolve.co.uk'

/** Language codes for hreflang tags (matches SUPPORTED_LANGUAGES in i18n/config). */
const HREFLANG_CODES = ['en', 'es', 'fr', 'it', 'de', 'he'] as const

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

/**
 * Inject per-route hreflang <link> tags and a canonical <link> tag.
 * Call from every public-facing page component (DocsPage, TermsPage,
 * PrivacyPage, MarketplacePage, Login).
 *
 * On mount, creates (or updates) link elements for each supported
 * language plus x-default and canonical.  On unmount, removes the
 * injected tags so in-app routes don't carry stale hreflang signals.
 *
 * Uses ?lang= query param format consistent with the sitemap.xml.
 */
export function useHreflang(routePath: string): void {
  useEffect(() => {
    const created: HTMLLinkElement[] = []
    const baseUrl = `${SITE_ORIGIN}${routePath}`

    // Per-language alternates
    for (const code of HREFLANG_CODES) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = code
      link.href = `${baseUrl}?lang=${code}`
      link.setAttribute('data-seo', 'hreflang')
      document.head.appendChild(link)
      created.push(link)
    }

    // x-default (unlocalized fallback)
    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = baseUrl
    xDefault.setAttribute('data-seo', 'hreflang')
    document.head.appendChild(xDefault)
    created.push(xDefault)

    // Canonical URL (without ?lang= so search engines consolidate)
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const prevCanonical = canonical?.href ?? ''
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
      created.push(canonical)
    }
    canonical.href = baseUrl

    return () => {
      for (const el of created) el.remove()
      // If canonical existed before, restore its previous value
      if (prevCanonical) {
        const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        if (existing) existing.href = prevCanonical
      }
    }
  }, [routePath])
}

/** Build a page title in the standard "Page — ChainSolve" format. */
export function pageTitle(page: string): string {
  return `${page} — ${DEFAULT_TITLE}`
}
