# ChainSolve — Product Requirements Suite

> **Single source of truth** for what ChainSolve is, what it must do,
> and how it must behave — across Web, Mobile, Desktop, and the shared
> Rust/WASM platform layer.

---

## How to use these docs

1. **Read 01-product-vision first** — it defines personas, goals, and non-goals.
2. **02-domain-model** is the canonical data contract. Every other doc references it.
3. **03–05** are platform-specific requirement sets (Web, Mobile, Desktop).
4. **06** covers backend services, entitlements, and the marketplace model.
5. **07** covers non-functional requirements that cut across all platforms.

### Requirement language

This suite uses **RFC 2119 / MoSCoW** keywords consistently:

| Keyword | Meaning |
|---------|---------|
| **MUST** | Non-negotiable. Blocking for release. |
| **SHOULD** | Expected for production quality. May defer with documented rationale. |
| **COULD** | Nice-to-have. Include only if low-cost. |
| **WON'T** (for now) | Explicitly out of scope for the current planning horizon. |

### Change process

1. Propose changes in a PR that edits the relevant spec file(s).
2. Add an entry to the **Change Log** section at the bottom of each affected file.
3. Bump the revision date in the file header.
4. Require at least one reviewer who owns the affected domain.

---

## Table of contents

| # | Document | Scope |
|---|----------|-------|
| 01 | [Product Vision](01-product-vision.md) | Goals, personas, workflows, non-goals, competitive framing |
| 02 | [Domain Model & Schema](02-domain-model-and-schema.md) | Canonical graph schema, types, invariants, migration rules |
| 03 | [Web App Requirements](03-web-app-requirements.md) | UI shell, canvas UX, blocks, editors, debug console, perf |
| 04 | [Mobile App Requirements](04-mobile-app-requirements.md) | Wrapper strategy, offline, gestures, feature parity |
| 05 | [Desktop App Requirements](05-desktop-app-requirements.md) | Tauri wrapper, offline/airgapped, file system, enterprise |
| 06 | [Platform, Backend & Entitlements](06-platform-backend-and-entitlements.md) | Supabase, RBAC, marketplace, plan gating, adapters |
| 07 | [Non-Functional, Security & Quality](07-nonfunctional-security-and-quality.md) | Security, privacy, a11y, observability, testing, release |

---

## Glossary

Terms used consistently across all spec documents.

| Term | Definition |
|------|-----------|
| **Project** | Top-level work unit. Has metadata, zero or more canvases, variables, and assets. Owned by a single user (today). |
| **Canvas / Sheet** | A single graph within a project. Contains nodes and edges. Stored as an independent JSON file. |
| **Node** | A block instance placed on a canvas. Carries a `blockType`, label, and data payload. |
| **Edge** | A directed connection from a source node's output port to a target node's input port. |
| **Port** | A named input or output socket on a node. Input ports have a `portId`; output ports default to `"out"`. |
| **Block** | A registered block definition (`BlockDef`): metadata, category, ports, default data. Evaluation lives in Rust. |
| **BlockType** | Stable string identifier for a block definition (e.g. `"add"`, `"eng.mechanics.force_ma"`). |
| **OpId** | Same as BlockType when referring to the Rust engine's evaluation dispatch key. |
| **NodeKind** | React Flow custom node type: `csSource`, `csOperation`, `csDisplay`, `csData`, `csPlot`, `csGroup`. |
| **Category** | Logical grouping of blocks (e.g. `math`, `engMechanics`, `finTvm`). Drives library sidebar sections. |
| **InputBinding** | A value specification for an unconnected input port: `literal`, `const`, or `var`. |
| **ValueKind** | The kind of engine result value: `scalar`, `vector`, `table`, or `error`. |
| **Variable** | A project-level named scalar (`ProjectVariable`). Shared across all canvases. |
| **Constant** | A catalog constant sourced from the Rust engine (e.g. `const.physics.g0`). Full precision. |
| **Group** | A visual container node (`csGroup`) that parents child nodes. Supports collapse/expand. |
| **Template** | A serialized group (nodes + edges) that can be saved and re-inserted. |
| **Dataset** | A table or vector payload, typically from `tableInput`, `csvImport`, or `vectorInput`. |
| **EngineSnapshot** | `EngineSnapshotV1` — the JSON payload sent to the Rust/WASM engine for evaluation. |
| **PatchOp** | An incremental mutation (add/remove/update node or edge) sent to the persistent engine graph. |
| **Entitlement** | A plan-derived capability flag (e.g. `canUsePlots`, `maxProjects`). |
| **Plan** | User subscription tier: `free`, `trialing`, `pro`, `past_due`, `canceled`. |
| **RLS** | Row-Level Security — Supabase/Postgres policy that scopes data access to `auth.uid()`. |
| **CSP** | Content Security Policy — HTTP header restricting script/WASM execution origins. |
| **LOD** | Level of Detail — zoom-dependent rendering fidelity on the canvas. |
| **Adapter** | An abstraction boundary that decouples the app from a specific persistence backend (Supabase, local FS, etc.). |

---

## Related documentation

- [Architecture](../ARCHITECTURE.md) — technical deep-dive (stack, directory map, engine design)
- [Project Format](../PROJECT_FORMAT.md) — `project.json` and per-canvas JSON schemas
- [Conventions](../CONVENTIONS.md) — naming rules, error codes, adding ops
- [Security](../SECURITY.md) — CSP, CORS, headers
- [Engine docs](../W9_ENGINE.md) — Rust/WASM build, ops, debug

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial requirements suite created (v1.0). |
