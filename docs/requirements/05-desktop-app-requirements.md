# 05 — Desktop App Requirements

> Revision: 1.0 · Date: 2026-02-26

ChainSolve Desktop is the **enterprise-grade, offline-capable** distribution.
It packages the web app inside a native shell with local persistence, file
system integration, and security features required by regulated industries.

---

## 1. Strategy

### 1.1 Delivery approach

| Option | Recommendation | Rationale |
|--------|---------------|-----------|
| **Tauri** (Rust + WebView) | **MUST evaluate first** | Shares the Rust toolchain with the engine. Small binary size (~10 MB). Native file system, tray, auto-updater. No bundled Chromium. |
| Electron | Fallback | Larger binary (~150 MB). Well-established ecosystem. Consider only if Tauri's WebView2 (Windows) or WebKitGTK (Linux) coverage is insufficient. |
| Neutralinojs | WON'T | Insufficient native API surface for enterprise requirements. |

**Decision**: The desktop app MUST be a **Tauri wrapper** (or equivalent Rust-based shell) around the existing React app, with a local persistence adapter replacing Supabase for offline scenarios.

### 1.2 Platform targets

| Platform | Priority | Min version |
|----------|----------|------------|
| Windows | MUST | Windows 10 21H2+ (WebView2) |
| macOS | MUST | macOS 12 Monterey+ |
| Linux | SHOULD | Ubuntu 22.04+, Fedora 38+ (WebKitGTK 4.1+) |

---

## 2. Offline mode

### 2.1 Core requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DO-1 | The desktop app MUST be fully functional without any internet connection ("airgapped mode"). | MUST |
| DO-2 | All project data (metadata, canvases, variables, assets) MUST be stored locally. | MUST |
| DO-3 | The Rust/WASM engine MUST be bundled within the app (no CDN fetch). | MUST |
| DO-4 | The block catalog MUST be bundled (no dynamic catalog fetch). | MUST |
| DO-5 | Authentication MUST be optional in offline mode. A local "offline profile" MUST be used when no auth server is reachable. | MUST |
| DO-6 | The app MUST clearly indicate whether it is in "online" or "offline" mode. | MUST |
| DO-7 | When online, the app SHOULD support syncing local projects to the cloud (Supabase) via the persistence adapter. | SHOULD |

### 2.2 Persistence adapter architecture

The desktop app MUST use a **swappable persistence adapter** — the same
interface that the web app uses for Supabase, but backed by local storage.

```
┌───────────────────────────────┐
│        Application layer       │
│  (React components, stores)   │
│                               │
│  calls PersistenceAdapter.*   │
└──────────┬────────────────────┘
           │
    ┌──────▼──────┐
    │   Adapter    │  (interface)
    │  interface   │
    └──────┬──────┘
           │
   ┌───────┴────────┐
   │                │
┌──▼───┐     ┌─────▼──────┐
│Supabase│    │Local (SQLite│
│Adapter │    │+ encrypted  │
│(web)   │    │file store)  │
└────────┘    └─────────────┘
```

| ID | Requirement | Priority |
|----|-------------|----------|
| DA-1 | The `PersistenceAdapter` interface MUST expose all CRUD operations the app needs: project list, project get/put, canvas get/put, variable get/put, asset get/put. | MUST |
| DA-2 | The web app MUST use a `SupabaseAdapter` that wraps existing Supabase calls. | MUST |
| DA-3 | The desktop app MUST provide a `LocalAdapter` backed by SQLite (metadata) + encrypted file store (graph JSON, assets). | MUST |
| DA-4 | The adapter selection MUST be determined at startup based on environment (web → Supabase, desktop → local, or config flag). | MUST |
| DA-5 | The adapter MUST handle migrations (schema versioning) identically to the web app. | MUST |

### 2.3 Local storage encryption

| ID | Requirement | Priority |
|----|-------------|----------|
| DE-1 | Graph JSON files MUST be encrypted at rest when stored locally. | MUST (enterprise) / SHOULD (standard) |
| DE-2 | Encryption MUST use AES-256-GCM (or equivalent AEAD scheme). | MUST |
| DE-3 | The encryption key MUST be derived from the user's local password or the OS keychain. | MUST |
| DE-4 | The encryption scheme MUST be transparent to the application layer (handled inside `LocalAdapter`). | MUST |
| DE-5 | Unencrypted local storage SHOULD be available as a config option for non-enterprise users. | SHOULD |

---

## 3. File system integration

| ID | Requirement | Priority |
|----|-------------|----------|
| DF-1 | File → Open: MUST show the native OS file picker to open a `.chainsolvejson` project file. | MUST |
| DF-2 | File → Save: MUST save to the current file path. If no path (new project), MUST show "Save As" dialog. | MUST |
| DF-3 | File → Save As: MUST show the native OS save dialog with `.chainsolvejson` file type filter. | MUST |
| DF-4 | File → Export: MUST support exporting to: PDF (calculation report), CSV (table data), PNG/SVG (plots). | MUST (CSV, PNG/SVG) / SHOULD (PDF) |
| DF-5 | File → Import CSV: MUST show the native OS file picker filtered to `.csv` files. | MUST |
| DF-6 | The app MUST register as a handler for `.chainsolvejson` files on the OS (double-click opens in ChainSolve). | SHOULD |
| DF-7 | Recent files: the OS-native "recent documents" list SHOULD include opened ChainSolve projects. | SHOULD |
| DF-8 | Drag-and-drop: dropping a `.chainsolvejson` file onto the app window MUST open it. Dropping a `.csv` MUST trigger CSV import. | SHOULD |

### 3.1 Project file format (`.chainsolvejson`)

A `.chainsolvejson` file is a self-contained project archive:

```jsonc
{
  "format": "chainsolvejson",
  "version": 1,
  "project": {
    "id": "<uuid>",
    "name": "My Project",
    "variables": { /* ProjectVariable map */ },
    "created_at": "...",
    "updated_at": "..."
  },
  "canvases": [
    {
      "id": "<uuid>",
      "name": "Sheet 1",
      "position": 0,
      "graph": {
        "schemaVersion": 4,
        "nodes": [ /* ... */ ],
        "edges": [ /* ... */ ],
        "datasetRefs": []
      }
    }
  ],
  "assets": [
    {
      "name": "data.csv",
      "mimeType": "text/csv",
      "data": "<base64-encoded>"  // or external reference
    }
  ]
}
```

| ID | Requirement | Priority |
|----|-------------|----------|
| FF-1 | The `.chainsolvejson` format MUST be a single JSON file containing all project data, canvases, and embedded assets. | MUST |
| FF-2 | Assets under 10 MB SHOULD be base64-embedded. Larger assets SHOULD be referenced by path. | SHOULD |
| FF-3 | The format MUST include a `version` field for future migration. | MUST |
| FF-4 | Opening a `.chainsolvejson` file MUST import it into the local store (not open in-place) to preserve the original. | MUST |
| FF-5 | Saving as `.chainsolvejson` MUST export the complete current state, not just the active canvas. | MUST |

---

## 4. Enterprise build requirements

### 4.1 Airgapped mode

| ID | Requirement | Priority |
|----|-------------|----------|
| EA-1 | An "airgapped" build variant MUST make zero external network calls. | MUST |
| EA-2 | Airgapped builds MUST disable: Supabase auth, Stripe billing, analytics, telemetry, update checks, CSP report-uri. | MUST |
| EA-3 | Airgapped builds MUST use the `LocalAdapter` exclusively. | MUST |
| EA-4 | All fonts, icons, and assets MUST be bundled (no CDN references). | MUST |
| EA-5 | The airgapped build MUST be verifiable: a script MUST confirm no outbound network calls are made during a test session. | MUST |

### 4.2 Signed builds

| ID | Requirement | Priority |
|----|-------------|----------|
| ES-1 | All release binaries MUST be code-signed: Authenticode (Windows), Apple Developer ID (macOS), GPG signature (Linux). | MUST |
| ES-2 | macOS builds MUST be notarized with Apple. | MUST |
| ES-3 | The CI pipeline MUST produce signed artifacts automatically on tagged releases. | MUST |
| ES-4 | Enterprise customers MUST be able to verify signatures against published public keys. | MUST |

### 4.3 Policy controls

| ID | Requirement | Priority |
|----|-------------|----------|
| EP-1 | A `policy.json` configuration file MUST allow enterprise admins to control: enabled features, allowed export formats, debug console visibility, update behavior, and telemetry. | MUST |
| EP-2 | The policy file MUST be read at startup and MUST override user preferences. | MUST |
| EP-3 | Example policy flags: | |
| | `"allowCloudSync": false` — disable all cloud connectivity. | MUST |
| | `"allowExport": ["csv", "pdf"]` — restrict export formats. | SHOULD |
| | `"debugConsole": "always_on"` — force debug console visibility. | SHOULD |
| | `"minVerbosity": "info"` — minimum debug console verbosity. | SHOULD |
| | `"updateMode": "disabled"` — disable auto-update (airgapped). | MUST |
| | `"telemetry": "off"` — disable all telemetry. | MUST |
| EP-4 | The policy file MUST be placed in a well-known location (e.g. alongside the binary, or in `/etc/chainsolvejson/policy.json` on Linux). | MUST |
| EP-5 | Missing policy file = default behavior (all features enabled, updates enabled, telemetry opt-in). | MUST |

---

## 5. Update strategy

| ID | Requirement | Priority |
|----|-------------|----------|
| DU-1 | The standard (non-airgapped) build MUST support auto-updates via the Tauri updater (or equivalent). | MUST |
| DU-2 | Updates MUST be signed and verified before installation. | MUST |
| DU-3 | The user MUST be notified of available updates and MUST consent before installation. | MUST |
| DU-4 | In airgapped mode, auto-update MUST be completely disabled (`updateMode: "disabled"`). | MUST |
| DU-5 | Manual update (download + install new version) MUST always be possible. | MUST |
| DU-6 | Update check frequency: daily for standard builds. Configurable via policy. | SHOULD |

---

## 6. Debug Console in Desktop

| ID | Requirement | Priority |
|----|-------------|----------|
| DD-1 | The Debug Console MUST exist in all desktop builds (standard and enterprise). | MUST |
| DD-2 | All web Debug Console features (verbosity, filters, export) MUST be available. | MUST |
| DD-3 | Desktop builds SHOULD additionally support a **persistent log file** that writes debug output to disk. | SHOULD |
| DD-4 | The log file path MUST be configurable (default: `~/.chainsolvejson/logs/debug.log`). | SHOULD |
| DD-5 | Log rotation: the log file SHOULD rotate at 10 MB (keep last 3 rotations). | SHOULD |
| DD-6 | Enterprise policy MUST be able to mandate persistent logging (`"persistentLog": true`). | SHOULD |
| DD-7 | The persistent log MUST NOT include auth tokens or credentials. Same redaction rules as web export. | MUST |

---

## 7. Native shell features

| ID | Requirement | Priority |
|----|-------------|----------|
| DN-1 | The app MUST have a native title bar with the project name. | MUST |
| DN-2 | The app MUST support the native system tray (optional; for background sync notifications). | COULD |
| DN-3 | The app MUST respond to OS-level events: close (with unsaved-changes check), minimize, maximize, full-screen. | MUST |
| DN-4 | Multiple windows SHOULD be supported (one project per window). | SHOULD |
| DN-5 | The app MUST respect OS-level font size / display scaling. | MUST |
| DN-6 | Print (Ctrl+P) SHOULD generate a formatted view of the active canvas (or defer to PDF export). | COULD |

---

## 8. Performance targets (Desktop)

| ID | Metric | Target | Priority |
|----|--------|--------|----------|
| DP-1 | Cold start (app launch to ready) | < 2 seconds | MUST |
| DP-2 | Project open (local, 500 nodes) | < 1 second | MUST |
| DP-3 | WASM init | < 500 ms (bundled, no network) | MUST |
| DP-4 | Full evaluation (1 000 nodes) | < 200 ms | MUST |
| DP-5 | Canvas frame rate (1 000 nodes) | ≥ 30 fps | MUST |
| DP-6 | Memory (1 000-node project) | < 300 MB | SHOULD |
| DP-7 | Binary size (installed) | < 50 MB (Tauri) | SHOULD |
| DP-8 | Local save latency | < 500 ms | MUST |

---

## 9. CI/CD for Desktop

| ID | Requirement | Priority |
|----|-------------|----------|
| DC-1 | The CI pipeline MUST build desktop artifacts for all three platforms (Windows, macOS, Linux). | MUST |
| DC-2 | Builds MUST be triggered on tagged releases (e.g. `desktop-v1.0.0`). | MUST |
| DC-3 | Artifacts MUST include: `.msi` or `.exe` (Windows), `.dmg` (macOS), `.AppImage` + `.deb` (Linux). | MUST |
| DC-4 | All artifacts MUST be code-signed in CI. | MUST |
| DC-5 | A smoke test MUST verify the built app launches and can open a test project on each platform. | SHOULD |

---

## 10. Security (Desktop-specific)

| ID | Requirement | Priority |
|----|-------------|----------|
| DS-1 | The WebView MUST NOT allow navigation to external URLs. All content MUST be loaded from the bundled app. | MUST |
| DS-2 | The Tauri `allowlist` MUST be minimal — only the IPC commands needed by the app. | MUST |
| DS-3 | Local project files MUST be encrypted at rest (see §2.3). | MUST (enterprise) |
| DS-4 | The app MUST NOT store credentials in plain text. Use the OS keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux). | MUST |
| DS-5 | The app MUST NOT spawn child processes or execute shell commands (defense in depth against injection). | MUST |
| DS-6 | CSP for the WebView MUST be at least as strict as the web app's CSP. | MUST |

---

## 11. Out of scope (for now)

- Real-time collaboration in the desktop app.
- Plugin / extension loading from the file system.
- Custom block editor (same exclusion as web).
- Differential sync (full project save/load for now, not CRDT).
- Multi-user login on a shared machine (one user profile per install).
- Linux Snap / Flatpak packaging (AppImage + deb first).

---

## 12. Future extensions

1. **Differential cloud sync**: Sync only changed canvases, not entire projects.
2. **Multi-user mode**: OS-level user profiles mapping to ChainSolve accounts.
3. **Plugin system**: Load trusted third-party block packs from the file system.
4. **PDF report generation**: Native PDF renderer for calculation audit trails.
5. **Hardware acceleration**: Use GPU for large-graph rendering via WebGPU in WebView.
6. **CLI mode**: `chainsolvejson evaluate --project foo.chainsolvejson --output results.json` for CI/batch.

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial version (v1.0). |
