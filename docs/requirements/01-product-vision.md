# 01 — Product Vision

> Revision: 1.0 · Date: 2026-02-26

---

## 1. Mission statement

ChainSolve is a **visual, graph-based computation workbench** that lets users
build, explore, and share mathematical and engineering calculations as
interactive node graphs — with deterministic, auditable results powered by a
Rust/WASM engine.

The product targets three delivery surfaces — **Web** (primary), **Mobile**
(companion), and **Desktop** (enterprise/offline) — sharing a single evaluation
engine, graph schema, and block catalog.

---

## 2. Product goals

| # | Goal | Priority |
|---|------|----------|
| G-1 | **Instant feedback**: any change to inputs or topology re-evaluates the graph in < 100 ms for typical workloads. | MUST |
| G-2 | **Deterministic & auditable**: identical graph + inputs → identical outputs, always. No hidden state, no NaN-as-silence. | MUST |
| G-3 | **Low floor, high ceiling**: a student can build a unit-conversion chain in 2 minutes; an engineer can model a complex system with 1 000+ nodes. | MUST |
| G-4 | **Portable projects**: a `.chainsolvejson` project opens identically on Web, Mobile, and Desktop with no manual conversion. | MUST |
| G-5 | **Offline-capable**: Desktop MUST work fully offline; Mobile SHOULD support cached read-only; Web MAY degrade gracefully when offline. | MUST (Desktop) / SHOULD (Mobile) |
| G-6 | **Extensible block catalog**: new engineering, finance, statistics, and custom blocks can be added without touching the evaluation core. | MUST |
| G-7 | **Enterprise-ready**: signed builds, airgapped mode, org accounts, RBAC, audit logging. | SHOULD |
| G-8 | **Marketplace ecosystem**: users can publish and discover project templates, block packs, and themes. | COULD |

---

## 3. Target personas

### 3.1 Student / Learner

- **Context**: Homework, lab reports, course projects.
- **Needs**: Free tier, quick start, clear error messages, simple graph topology.
- **Pain today**: Spreadsheet formulas are opaque; MATLAB is expensive; hand calculations are error-prone.
- **Success metric**: Can build a 10-node physics chain (e.g. projectile motion) in < 5 minutes without documentation.

### 3.2 Working Engineer

- **Context**: Design calculations, trade studies, what-if analysis.
- **Needs**: Large block catalog (engineering, materials, fluids), tables/CSV, plots, variables for parametric sweeps, groups for sub-system organization.
- **Pain today**: Excel chains are fragile and hard to audit; Simulink is heavyweight.
- **Success metric**: Can model a 200-node thermal system with tables, plots, and grouped sub-systems, and share a read-only link with a reviewer.

### 3.3 Enterprise / Compliance team

- **Context**: Regulated industries (aerospace, energy, construction) where calculation traceability is required.
- **Needs**: Offline/airgapped Desktop build, signed binaries, RBAC, audit logging, PDF export of calculation chains.
- **Pain today**: Shared spreadsheets lack version control and access control.
- **Success metric**: Can deploy a locked-down Desktop build behind a corporate firewall with no external network calls, and produce a PDF audit trail.

### 3.4 Educator / Content creator

- **Context**: Creates reusable calculation templates for courses or consulting deliverables.
- **Needs**: Marketplace publishing, template packaging, branding/theming.
- **Pain today**: No good way to distribute interactive calculation workbooks.
- **Success metric**: Can publish a "Beam Design 101" template to the marketplace and see download metrics.

---

## 4. Primary workflows

### 4.1 Build a calculation chain (core loop)

1. Create or open a project.
2. Add blocks from the library (drag, double-click, or search).
3. Connect ports to define data flow.
4. Set input values (literal, constant reference, or variable binding).
5. Observe computed results in real time on display/plot nodes.
6. Adjust inputs; results update instantly (incremental evaluation).

### 4.2 Parametric exploration

1. Define project-level variables (e.g. `beam_length`, `load`).
2. Bind input ports to variables.
3. Adjust variables via the Variables panel or slider nodes.
4. All bound nodes update simultaneously across all canvases.

### 4.3 Data-driven analysis

1. Import a CSV dataset or create a table inline.
2. Connect table outputs to vector/stats/plot blocks.
3. Explore data visually with plots (scatter, histogram, bar, heatmap).
4. Export plot images or computed results.

### 4.4 Organize and document

1. Group related nodes into collapsible groups.
2. Add notes and color-coding to groups.
3. Use multiple canvases (sheets) to separate concerns within a project.
4. Save groups as templates for reuse.

### 4.5 Share and collaborate (future)

1. Share a project link (read-only or edit).
2. Publish a project template to the marketplace.
3. Fork a marketplace template into a personal project.

---

## 5. Non-goals (explicit exclusions)

| # | Non-goal | Rationale |
|---|----------|-----------|
| NG-1 | **General-purpose programming language**: ChainSolve is a structured graph tool, not a code editor. No arbitrary scripting. | Keep the evaluation model deterministic and auditable. |
| NG-2 | **Real-time collaboration (Google Docs style)**: Concurrent multi-user editing of the same canvas is WON'T for the current horizon. | Conflict resolution in graph topologies is extremely complex. Single-user editing with share-link is sufficient. |
| NG-3 | **Symbolic algebra / CAS**: The engine evaluates numerical values, not symbolic expressions. | CAS is a separate product category. |
| NG-4 | **3D visualization / CAD**: Plots are 2D (Vega-Lite). No 3D rendering. | Scope control. Integrate with external tools via export. |
| NG-5 | **Custom Rust/WASM user code execution**: Users cannot upload arbitrary WASM modules. Blocks are curated. | Security and determinism. Custom blocks will be a structured editor, not raw code. |
| NG-6 | **Social features (profiles, followers, feeds)**: The marketplace is a content store, not a social network. | Focus on engineering utility. |

---

## 6. Competitive framing (factual)

ChainSolve occupies the intersection of:

| Category | Examples | ChainSolve differentiation |
|----------|----------|---------------------------|
| Spreadsheets | Excel, Google Sheets | Graph topology makes dependencies explicit and auditable; no hidden cell references. |
| Dataflow tools | Simulink, LabVIEW, Grasshopper | Lighter weight, web-first, open block catalog, free tier. No proprietary runtime. |
| Calculation notebooks | Jupyter, Mathcad | Structured visual graph vs. linear document; deterministic engine vs. Python kernel state. |
| Engineering calculators | Wolfram Alpha, online converters | Composable chains vs. one-shot queries; persistent projects; offline Desktop support. |

ChainSolve is **not** trying to replace MATLAB or Simulink for simulation-grade
workloads. It targets the **80% of engineering calculations** that are currently
done in spreadsheets or by hand: unit conversions, design checks, parametric
trade studies, and teaching/learning workflows.

---

## 7. Platform strategy

```
┌─────────────────────────────────────────────────────────┐
│                  Shared platform layer                    │
│  Rust/WASM engine · Graph schema · Block catalog          │
│  Persistence adapters · Entitlements · i18n               │
└────────────┬──────────────────┬──────────────┬───────────┘
             │                  │              │
        ┌────▼────┐      ┌─────▼─────┐  ┌─────▼──────┐
        │   Web   │      │  Mobile   │  │  Desktop   │
        │  (SPA)  │      │ (wrapper) │  │  (Tauri)   │
        │ Vite+   │      │ Capacitor │  │ local FS + │
        │ React   │      │ or PWA    │  │ encrypted  │
        │ Supabase│      │           │  │ store      │
        └─────────┘      └───────────┘  └────────────┘
```

- **Web** is the reference implementation. All features land here first.
- **Mobile** is a thin wrapper around the web app with mobile-specific UX adaptations.
- **Desktop** adds local persistence, file-system integration, and enterprise packaging.
- The **shared platform layer** (engine, schema, catalog, adapters) is identical across all three.

---

## 8. Success metrics (product-level)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first result | < 2 min for a new user to see a computed value | Onboarding funnel analytics |
| Graph evaluation latency | < 100 ms for 95th percentile at 500 nodes | Engine perf telemetry |
| Project portability | 100% of projects open identically across platforms | Cross-platform test suite |
| Free tier retention | > 40% weekly active after 4 weeks | Cohort analytics |
| Pro conversion | > 5% of free users convert within 60 days | Billing analytics |
| Uptime (web) | 99.9% monthly | Cloudflare analytics |

---

## 9. Future extensions (planning horizon: 6–12 months)

These are not in scope for the current requirements but shape architectural decisions:

1. **Real-time collaboration** — operational transform or CRDT for graph edits.
2. **Custom block editor** — structured visual editor for user-defined blocks (not raw code).
3. **Simulation mode** — time-stepping evaluation for dynamic systems.
4. **API / webhook triggers** — external data sources feeding into graphs.
5. **White-label / OEM** — enterprise customers embed ChainSolve in their own tools.
6. **LLM-assisted graph building** — natural-language-to-graph suggestions.

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial version (v1.0). |
