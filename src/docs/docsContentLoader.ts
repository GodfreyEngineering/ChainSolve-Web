/**
 * docsContentLoader.ts — Locale-aware docs content loader (L2-2).
 *
 * Returns the docs body text for a given locale, falling back to English
 * when a translation is not yet available. Locale content modules are
 * lazy-imported so untranslated locales add zero bundle weight.
 *
 * ## Adding a new locale
 *
 * 1. Copy `docsPageContent.ts` to `docsPageContent.<lang>.ts`
 *    (e.g. `docsPageContent.de.ts`).
 * 2. Translate every string value in the `DOCS_CONTENT` map.
 * 3. Register the import in the `LOCALE_LOADERS` map below.
 * 4. The loader will pick it up automatically; no other changes needed.
 */

import { DOCS_CONTENT, type DocsContentMap } from './docsPageContent'

export type { DocsContentMap }

/**
 * Registry of lazy loaders for translated docs content.
 *
 * Each entry maps a BCP-47 language code to a dynamic import that
 * resolves to a module with a `DOCS_CONTENT` named export.
 *
 * English is the built-in default and does not need an entry here.
 *
 * Example (uncomment when a translation is ready):
 *   de: () => import('./docsPageContent.de'),
 *   fr: () => import('./docsPageContent.fr'),
 */
const LOCALE_LOADERS: Record<
  string,
  (() => Promise<{ DOCS_CONTENT: DocsContentMap }>) | undefined
> = {
  // de: () => import('./docsPageContent.de'),
  // es: () => import('./docsPageContent.es'),
  // fr: () => import('./docsPageContent.fr'),
  // it: () => import('./docsPageContent.it'),
  // he: () => import('./docsPageContent.he'),
}

/** In-memory cache so repeated calls for the same locale don't re-import. */
const cache = new Map<string, DocsContentMap>()

/**
 * Return the docs content map for `locale`, falling back to English.
 *
 * The function is synchronous when the content is cached or when
 * the locale has no dedicated translation (immediate English fallback).
 * It returns a Promise only when a lazy import is triggered for the
 * first time.
 */
export function getDocsContent(locale: string): DocsContentMap | Promise<DocsContentMap> {
  // Fast path: English or already cached
  if (locale === 'en') return DOCS_CONTENT
  const cached = cache.get(locale)
  if (cached) return cached

  const loader = LOCALE_LOADERS[locale]
  if (!loader) return DOCS_CONTENT // no translation available → English

  return loader()
    .then((mod) => {
      cache.set(locale, mod.DOCS_CONTENT)
      return mod.DOCS_CONTENT
    })
    .catch(() => {
      // If the import fails, fall back to English and cache so we don't retry.
      cache.set(locale, DOCS_CONTENT)
      return DOCS_CONTENT
    })
}

/**
 * Synchronous accessor — returns cached content or English fallback.
 *
 * Use this in render paths where a Promise is inconvenient. The first
 * render after a locale switch may show English until the async load
 * completes; call `prefetchDocsContent` on locale change to warm cache.
 */
export function getDocsContentSync(locale: string): DocsContentMap {
  if (locale === 'en') return DOCS_CONTENT
  return cache.get(locale) ?? DOCS_CONTENT
}

/**
 * Warm the cache for a locale. Call on language switch so the next
 * render of DocsPage has the translated content ready synchronously.
 */
export async function prefetchDocsContent(locale: string): Promise<void> {
  const result = getDocsContent(locale)
  if (result instanceof Promise) await result
}
