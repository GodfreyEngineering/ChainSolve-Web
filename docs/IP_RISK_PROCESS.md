# Intellectual Property Risk Process

> Engineering-level IP hygiene for ChainSolve.
> This is NOT legal advice. Schedule professional IP counsel before any
> enterprise launch or external funding round.

---

## 1. Purpose

This document establishes an engineering process for tracking
intellectual property risks, documenting design inspiration, and
maintaining a novelty log. The goal is to create a professional audit
trail that a lawyer can review efficiently, not to replace legal counsel.

---

## 2. Design originality checklist

Before shipping any major feature, the implementing engineer should
confirm each item:

- [ ] The feature's UI layout was designed from first principles or from
  our own UX guidelines (see `docs/UX.md`), not copied pixel-for-pixel
  from a proprietary application.
- [ ] If a UI pattern was inspired by another product, the inspiration
  source is logged in section 4 below.
- [ ] The feature does not reproduce a patented workflow end-to-end.
  Individual well-known UI primitives (drag-and-drop, context menus,
  node graphs) are generic and acceptable. Specific multi-step workflows
  unique to a competitor require review.
- [ ] Any third-party code, algorithms, or assets have compatible
  licenses (see `docs/ASSET_LICENSE_POLICY.md` and
  `THIRD_PARTY_NOTICES.md`).
- [ ] No proprietary documentation, specification files, or decompiled
  code was used as a reference for the implementation.

---

## 3. Inspiration sources log

This section documents external products, papers, and standards that
informed ChainSolve's design. Being transparent about inspiration is a
strength, not a weakness.

### 3.1 Node-graph computation paradigm

The concept of visual, node-based computation is decades old and widely
used across industries. ChainSolve is one of many implementations of
this general paradigm.

| Source | What we drew from it | What we did differently |
|--------|---------------------|------------------------|
| Spreadsheets (Excel, Sheets) | Cell-based reactive recalculation model | Graph topology is explicit (visible edges), not implicit (cell references). Deterministic Rust engine replaces floating-point-order-dependent spreadsheet engines. |
| Grasshopper (Rhino) | Visual programming for parametric design | ChainSolve targets general engineering/math, not geometry. No 3D viewport. Web-first rather than desktop plugin. |
| Blender Geometry Nodes | Node-graph evaluation with typed ports | ChainSolve is a standalone product, not embedded in a 3D modelling tool. Evaluation is Rust/WASM, not C++. |
| Simulink (MATLAB) | Block diagrams for system simulation | ChainSolve is algebraic (DAG evaluation), not time-stepping simulation. Open web platform vs proprietary desktop. |
| Houdini (SideFX) | Procedural node graphs with caching | ChainSolve focuses on mathematical formulas, not VFX. Incremental patch protocol is our own design. |
| MathCAD / SMath Studio | Document-style engineering calculations | ChainSolve uses a graph canvas rather than a linear document. Results are live, not print-oriented. |

### 3.2 AI copilot features

| Source | What we drew from it | What we did differently |
|--------|---------------------|------------------------|
| GitHub Copilot | AI-assisted code generation inline | ChainSolve Copilot generates graph patches (node/edge operations), not text. Risk-tiered confirmation model is our own design. |
| ChatGPT canvas | Conversational UI with artifact editing | ChainSolve constrains AI output to typed patch operations validated against the block catalog. No freeform code generation. |

### 3.3 Marketplace and publishing

| Source | What we drew from it | What we did differently |
|--------|---------------------|------------------------|
| npm / crates.io | Package publishing and discovery | ChainSolve marketplace publishes graph templates and block packs, not code packages. Entitlement-gated access. |
| VS Code Extension Marketplace | Curated extension marketplace with ratings | ChainSolve marketplace items are domain-specific calculation templates, not IDE extensions. |

### 3.4 UI patterns

| Source | What we drew from it | What we did differently |
|--------|---------------------|------------------------|
| React Flow (xyflow) | Open-source node-graph canvas (MIT) | Used as a library dependency with documented compliance (see `docs/XYFLOW_COMPLIANCE.md`). All custom node renderers, evaluation logic, and data model are our own. |
| Figma | Canvas interaction: zoom, pan, selection | Standard canvas interaction patterns. Our implementation uses React Flow's built-in handlers, not Figma code. |
| Linear | Clean, minimal UI aesthetic | Visual style only. No code or specific UI components were referenced. |

---

## 4. Novelty log

Features where ChainSolve's approach may be distinctive. This log helps
a patent attorney quickly identify what (if anything) merits protection.

| Feature | Description | Why it may be distinctive | Date introduced |
|---------|-------------|--------------------------|-----------------|
| Rust/WASM deterministic engine | Pure-Rust algebraic DAG evaluator compiled to WASM, running in a Web Worker with incremental patch evaluation | Combination of Rust/WASM, incremental dirty propagation, and web worker isolation for a general-purpose computation canvas. Most competitors use JS or C++ engines. | 2025 (W9 wave) |
| Typed patch protocol | `PatchOp` enum (AddNode, RemoveNode, AddEdge, RemoveEdge, UpdateNodeData) with incremental re-evaluation returning only changed values | Fine-grained incremental protocol for node-graph computation. Enables sub-100ms response on large graphs. | 2025 (W9.2) |
| AI graph builder with risk tiers | AI copilot that generates typed graph patch operations, with LOW/MEDIUM/HIGH risk classification and progressive auto-apply | Risk-tiered AI confirmation model specific to graph computation (not general code generation). | 2026 (AI-1..AI-3) |
| Graph health diagnostics | Automated detection of orphans, cycles, fan-in violations, type mismatches, with AI-assisted fix suggestions | Integrated diagnostic + AI fix pipeline for node-graph computation. | 2026 (K3/K4 wave) |
| Portable .chainsolvejson format | Platform-agnostic project format with schema versioning, SHA-256 integrity hashing, and deterministic serialization | Content-addressed portable format for engineering calculations across web/mobile/desktop. | 2025 (W7) |
| Block catalog governance | Dual-layer catalog (Rust ops + TS presentation) with boot-time validation, stable op IDs, and automated golden fixture testing | Engineering governance model for a computation block catalog with cross-language validation. | 2025 (W5) |
| Scientific debug console | Context-aware error explanations with domain-specific scientific guidance (e.g. "Reynolds number requires non-zero viscosity") | Debug console that maps computation errors to scientific/engineering explanations. | 2026 (K4 wave) |

---

## 5. Third-party IP dependencies

All third-party dependencies are tracked in `THIRD_PARTY_NOTICES.md`
(auto-generated by `scripts/generate-licenses.mjs`). Key compliance
documents:

| Document | Covers |
|----------|--------|
| `THIRD_PARTY_NOTICES.md` | Full inventory of npm, Cargo, and asset dependencies with licenses |
| `docs/ASSET_LICENSE_POLICY.md` | Permitted and forbidden license types |
| `docs/XYFLOW_COMPLIANCE.md` | React Flow (xyflow) licensing compliance review |

All production dependencies use permissive licenses (MIT, Apache-2.0,
BSD, ISC, OFL-1.1). No GPL, AGPL, SSPL, or copyleft dependencies.

---

## 6. Process for new features

When implementing a new feature that introduces a novel workflow or UI
pattern:

1. **Before implementation:** Check the design originality checklist
   (section 2). If the feature is inspired by a specific product, add an
   entry to section 3.
2. **During implementation:** If the approach seems distinctive (not
   just standard CRUD/UI), add an entry to the novelty log (section 4).
3. **Before enterprise launch:** Schedule a professional IP review
   covering this document, the novelty log, and the third-party
   inventory. The review should confirm:
   - No third-party patent infringement risks
   - Whether any novel features merit patent or trade-secret protection
   - License compliance for all dependencies
4. **Annually:** Review and update this document. Remove entries from the
   novelty log that turn out to be standard practice. Add new entries for
   features shipped since the last review.

---

## 7. Professional legal review schedule

| Milestone | Review scope | Status |
|-----------|-------------|--------|
| Pre-enterprise launch | Full IP review: novelty log, third-party inventory, competitor landscape | Not yet scheduled |
| Pre-funding round | Freedom-to-operate analysis, patent landscape search | Not yet scheduled |
| Annual review | Update novelty log, refresh third-party inventory, check for new competitor patents | Not yet scheduled |

---

## 8. Contacts

- **Engineering lead:** Responsible for maintaining this document and the
  novelty log.
- **Legal counsel:** To be appointed before enterprise launch.
- **Patent attorney:** To be appointed if any features in the novelty
  log merit patent protection.

---

Last reviewed: 2026-03-03
Reviewed by: Engineering team (automated audit)
