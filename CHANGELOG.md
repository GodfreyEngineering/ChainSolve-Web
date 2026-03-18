# Changelog

All notable changes to ChainSolve Web are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added (2026-03-17 — Legal & Compliance sprint)

- **Legal document PDF export** via browser print dialog (ToS + Privacy Policy download buttons)
- **Legal language notice** component for non-English users on all legal pages (16.75)
- **Enterprise legal pack** generation script (`npm run legal-pack`) assembling DPA template,
  ROPA, DPIA, breach response, SBOM, licence audits into `ChainSolve_Legal_Pack.zip` (16.82)
- **SBOM generation** script (`npm run sbom`) — CycloneDX 1.6 JSON via cargo-sbom + cyclonedx-npm (16.81)
- **Impressum page** at `/de/impressum` satisfying German TMG §5 and Austrian ECG §5 (16.78)
- **GDPR consent audit table** (`user_consents`) with RLS; recording ToS acceptance, cookie consent,
  and marketing opt-in to append-only audit log (16.80)
- **DPA template** (`legal/dpa-template.md`) covering GDPR Art. 28/32 obligations (16.82)
- **Font licence audit** (`legal/font-licences.md`) — Montserrat + JetBrains Mono both OFL 1.1 (16.8)
- **Asset licence audit** (`legal/asset-licences.md`) — Lucide React ISC, first-party SVGs (16.9)
- **Terms of Service** expanded with definitions, 13+/16+ age eligibility, export control +
  WMD prohibited use, GBP currency, VAT note, free tier limits (3 projects, 500MB), licence grants (16.12)
- **Cookie Policy page** at `/cookies` with full storage inventory (16.34–16.35)
- **Privacy Policy** GDPR rewrite (UK/EU GDPR, ePrivacy, COPPA) (16.21–16.33)
- **DPA references** for all 6 sub-processors with transfer mechanisms (16.39–16.42)
- **ROPA** (Art. 30 Record of Processing Activities) at `legal/ropa.md` (16.43)
- **Breach response plan** at `legal/breach-response.md` with ICO 72-hour notification template (16.44)
- **DPIA screening assessment** at `legal/dpia-assessment.md` (16.45)
- **Security.txt** at `/.well-known/security.txt` (RFC 9116) (16.50)
- **Accessibility statement** at `/accessibility` (WCAG 2.1 AA) (16.69)
- **Licences page** at `/licences` with third-party notice attribution (16.73)
- **Cookie settings link** in footer and cookie consent banner re-show mechanism (16.74)
- **Impressum link** in site-wide LegalFooter
- **Do Not Track** support in observability client (16.38)
- **Stripe webhook** handlers for `invoice.payment_failed` / `invoice.paid` lifecycle (16.60)
- **Export control assessment** (`legal/export-control-assessment.md`) — UK SECL / EAR99 (16.70–16.72)
- **Single baseline migration** for fresh Supabase installs (`0001_baseline_schema.sql`)
- Supabase bootstrap documentation (`docs/DEV/SUPABASE_BOOTSTRAP.md`)

### Changed

- **Terms of Service** sections renumbered (added Definitions as §1); calculation accuracy
  disclaimer promoted to its own prominent section
- Archived 54 iterative migrations to `supabase/migrations_archive/`
- Consolidated scripts with README documentation (M1-2)
- `COMPANY` in `src/lib/brand.ts` now includes `registeredAddress` and `director` fields

### Removed

- Custom `./cs` CLI scripts (M1-1)
- Legacy modals and deprecated CSP endpoint (M1-1)

## [Phase L] - 2026-03-03

### Added

- Power user workflows polish (L4-4)
- Unified feedback modal with redacted engine logs (L4-3)
- Pro-grade project file manager with folders and bulk operations (L4-2)
- Perfect scratch canvas workflow for frictionless start (L4-1)
- Operational readiness audit guide for consultancy review (L3-2)
- Robust single-session policy with org-aware enforcement (L3-1)
- Hreflang SEO strategy and locale-aware docs scaffolding (L2-2)

## [Phase K] - 2026-03-03

### Added

- Formal role hierarchy with developer role enforcement (J3-1)
- Split Account Settings and ChainSolve Settings into separate windows (J2-1)
- Optional 2FA setup during onboarding and MFA challenge on login (J1-4)
- Fresh-state user data model: preferences, terms log, reports (J0-1)
- Student license flow with university email verification (I7-1)
- Enterprise policy extensions for org controls (I8-1)
- Explore ecosystem: official content badges, source categorisation (I4-1)

## [Phase H-I] - 2026-03-02

### Added

- In-app suggestion and feature request system (H9-2)
- List input blocks and graph/table output blocks (H8-1)
- Custom function blocks for Pro users (H5-1)
- Custom materials creation for Pro users (H3-2)
- 6-locale i18n: English, German, French, Spanish, Italian, Hebrew

## [Phase D-G] - 2026-03-01

### Added

- AI Copilot with enterprise controls and per-seat quotas
- Marketplace/Explore with comments, likes, moderation
- Organization management with seat model and policy flags
- Stripe billing integration with checkout and customer portal
- PDF, Excel, and .chainsolvejson export/import
- 144 computation blocks (engineering, finance, statistics, constants)

## [Phase A-C] - 2026-02-28

### Added

- Multi-canvas sheets per project
- Canvas visual polish: animated edges, zoom LOD
- Editing power pack: undo/redo, cut/copy/paste, find block
- Command palette and responsive header
- Project management with save status and recent projects
- Rust/WASM computation engine with Web Worker isolation
- Supabase auth with RLS and storage ACLs
