# Hreflang and International SEO Strategy

Revision: v1.0 (L2-2)

---

## Overview

ChainSolve supports six languages: English (en), Spanish (es), French (fr),
Italian (it), German (de), and Hebrew (he). All public pages emit hreflang
`<link>` tags so search engines serve the correct language variant to each
user.

---

## Architecture

### Locale detection

The i18n system (i18next) resolves the active locale in this order:

1. `?lang=` query parameter (highest priority)
2. `localStorage` preference
3. Browser `navigator.language`
4. Fallback: `en`

### Dynamic hreflang tags

The `useHreflang(routePath)` hook in `src/lib/seo.ts` injects `<link>` tags
into `<head>` when a public page mounts and removes them on unmount:

| Tag | Example |
|-----|---------|
| Per-language alternate | `<link rel="alternate" hreflang="de" href="https://app.chainsolve.co.uk/docs?lang=de">` |
| x-default (fallback) | `<link rel="alternate" hreflang="x-default" href="https://app.chainsolve.co.uk/docs">` |
| Canonical | `<link rel="canonical" href="https://app.chainsolve.co.uk/docs">` |

### Pages using hreflang

| Page | Route | Hook call |
|------|-------|-----------|
| Docs | `/docs` | `useHreflang('/docs')` |
| Terms | `/terms` | `useHreflang('/terms')` |
| Privacy | `/privacy` | `useHreflang('/privacy')` |
| Explore | `/explore` | `useHreflang('/explore')` |
| Login/Signup | `/login`, `/signup`, `/reset-password` | `useHreflang(location.pathname)` |

In-app authenticated routes (canvas, settings, billing) do **not** emit
hreflang because they are behind auth and should not be indexed.

### Sitemap

`public/sitemap.xml` mirrors the same hreflang structure. Each public URL
has `<xhtml:link rel="alternate">` entries for every supported language plus
x-default. Keep sitemap.xml and the `HREFLANG_CODES` array in `seo.ts`
in sync when adding a language.

---

## Docs content localisation

Docs body text lives in `src/docs/docsPageContent.ts` (English) and is
loaded via `src/docs/docsContentLoader.ts`. The loader:

- Returns English content synchronously (zero overhead).
- Lazy-imports locale-specific content modules when available.
- Falls back to English for any missing locale.
- Caches loaded content in memory.

### Adding a translated docs module

1. Copy `src/docs/docsPageContent.ts` to `src/docs/docsPageContent.<lang>.ts`.
2. Translate every string value (keys must stay identical).
3. Uncomment the corresponding line in `LOCALE_LOADERS` inside
   `src/docs/docsContentLoader.ts`.
4. Run `./scripts/verify-ci.sh` to confirm the build succeeds.

Sidebar labels are already localised via i18n JSON files (`docsPage.*` keys).

---

## Checklist for adding a new language

1. Add locale JSON file: `src/i18n/locales/<lang>.json`.
2. Register in `SUPPORTED_LANGUAGES` (`src/i18n/config.ts`).
3. Add `<lang>` to `HREFLANG_CODES` in `src/lib/seo.ts`.
4. Add hreflang entries to `public/sitemap.xml` for every public URL.
5. (Optional) Add translated docs content module per instructions above.
6. Run `./scripts/verify-ci.sh`.

---

## Key files

| File | Purpose |
|------|---------|
| `src/lib/seo.ts` | `useHreflang` hook, `usePageMeta`, `SITE_ORIGIN` |
| `src/docs/docsContentLoader.ts` | Locale-aware docs content with fallback |
| `src/docs/docsPageContent.ts` | English docs body text |
| `src/i18n/config.ts` | Supported languages, detection order |
| `public/sitemap.xml` | Static sitemap with hreflang |
