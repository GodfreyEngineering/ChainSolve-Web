# Changelog

All notable changes to ChainSolve Web are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Single baseline migration for fresh Supabase installs (`0001_baseline_schema.sql`)
- Supabase bootstrap documentation (`docs/DEV/SUPABASE_BOOTSTRAP.md`)
- Root `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md` standard repo docs
- Verify-ci, env setup, and DB bootstrap sections in root README

### Changed

- Archived 54 iterative migrations to `supabase/migrations_archive/`
- Updated all documentation references to archived migration paths
- Consolidated scripts with README documentation (M1-2)

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
