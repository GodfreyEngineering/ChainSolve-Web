# 04 — Mobile App Requirements

> Revision: 1.0 · Date: 2026-02-26

ChainSolve Mobile is a **companion experience** — not a full replacement for
the web app. It enables viewing, light editing, and parametric exploration on
the go. Heavy graph construction is expected to happen on the web or desktop.

---

## 1. Strategy

### 1.1 Delivery approach

| Option | Recommendation | Rationale |
|--------|---------------|-----------|
| **PWA wrapper** (Capacitor / Ionic) | **MUST evaluate first** | Reuses the web codebase directly. Reduces maintenance burden. Native APIs (file system, share sheet) accessible via Capacitor plugins. |
| Native (React Native / Flutter) | WON'T (for now) | Would require rewriting the UI layer. The graph canvas (React Flow) does not have a native equivalent. |
| Responsive web only | Fallback | Already works at 360 px. A PWA wrapper adds offline caching and native integration. |

**Decision**: The mobile app MUST be a **web-first wrapper** (Capacitor or equivalent PWA shell) around the existing React app with mobile-specific UX adaptations.

### 1.2 Platform targets

| Platform | Priority | Min version |
|----------|----------|------------|
| iOS (Safari WebKit) | MUST | iOS 16+ |
| Android (Chrome WebView) | MUST | Android 10+ (API 29) |

---

## 2. Offline-first expectations

| ID | Requirement | Priority |
|----|-------------|----------|
| MO-1 | The app shell (HTML, JS, CSS, WASM) MUST be cached locally so the app launches without a network connection. | MUST |
| MO-2 | The 10 most recently opened projects MUST be cached for offline read-only access. | MUST |
| MO-3 | Offline changes (variable edits, input value changes) SHOULD be queued and synced when connectivity is restored. | SHOULD |
| MO-4 | Creating new projects offline is WON'T for the initial release (requires Supabase connectivity for UUID + row creation). | WON'T |
| MO-5 | A clear "Offline" indicator MUST be shown when the device has no connectivity. | MUST |
| MO-6 | Cache storage MUST be bounded (e.g. 50 MB) to respect device constraints. Old project caches MUST be evicted LRU. | MUST |

### Acceptance criteria

- [ ] App launches in < 3 seconds when airplane mode is on (cached shell).
- [ ] A recently opened project can be viewed offline (nodes, edges, computed values from last sync).
- [ ] Editing a variable offline and reconnecting syncs the change to Supabase.

---

## 3. Mobile UX rules

### 3.1 Navigation and layout

| ID | Requirement | Priority |
|----|-------------|----------|
| MX-1 | The app MUST use a **bottom navigation bar** for primary navigation (Projects, Canvas, Variables, Settings). | MUST |
| MX-2 | Sidebars (Block Library, Inspector) MUST be replaced with **full-screen drawers** that slide in from the edge. | MUST |
| MX-3 | The menu bar MUST be replaced with a single hamburger menu or the Command Palette (already implemented for < 900 px viewports). | MUST |
| MX-4 | The Sheets bar MUST render as a dropdown selector (already implemented). | MUST |
| MX-5 | The Debug Console (if available) MUST render as a full-screen overlay, not a bottom panel (insufficient vertical space). | SHOULD |

### 3.2 Touch interactions

| ID | Requirement | Priority |
|----|-------------|----------|
| MT-1 | Canvas pan: single-finger drag on empty space. | MUST |
| MT-2 | Canvas zoom: two-finger pinch gesture. | MUST |
| MT-3 | Node selection: tap on node. | MUST |
| MT-4 | Node move: long-press + drag. Short tap MUST NOT initiate a drag (prevents accidental moves). | MUST |
| MT-5 | Context menu: long-press on node, edge, or empty space. | MUST |
| MT-6 | Edge creation: tap source port → tap target port (two-tap connect). Drag-to-connect is COULD (difficult on small screens). | MUST (two-tap) / COULD (drag) |
| MT-7 | All touch targets MUST be ≥ 44 × 44 CSS pixels (Apple HIG / Material 3 minimum). | MUST |
| MT-8 | Hover-dependent UI (tooltips, port highlights) MUST have tap-based alternatives. | MUST |

### 3.3 Acceptance criteria

- [ ] Pinch-to-zoom is smooth (≥ 30 fps) on a mid-range device (e.g. Pixel 6a, iPhone SE 3).
- [ ] Long-press + drag correctly moves a node without triggering the context menu.
- [ ] Two-tap connect successfully creates an edge on the first attempt for a new user.

---

## 4. Feature parity expectations

### 4.1 MUST match web

| Feature | Notes |
|---------|-------|
| Project list (browse, open, recent) | Same data, mobile-optimized list layout. |
| Canvas viewing (pan, zoom, node values) | Full graph rendering with LOD. |
| Input editing (literal values, sliders) | ValueEditor adapted for touch. |
| Variable editing (panel as drawer) | Full CRUD. |
| Engine evaluation (Rust/WASM) | Same WASM module, same results. |
| Entitlement enforcement | Same plan gating rules. |
| Theme (system / light / dark) | Respects device setting. |
| i18n (5 locales) | Same translations. |

### 4.2 MAY be limited on mobile

| Feature | Limitation | Rationale |
|---------|-----------|-----------|
| Block Library | Simplified (flat list, no drag-and-drop; use tap-to-add). | Drag-and-drop is awkward on touch. |
| Table Editor | Read-only inline; editing via full-screen modal. | Inline table editing is too cramped. |
| CSV Import | Via system share sheet / file picker, not drag-and-drop. | No drag-and-drop on mobile. |
| Plot Export | Share sheet integration instead of download button. | Mobile export paradigm. |
| Auto-layout | Available but not prominent (menu only). | Less useful on small screens. |
| Group templates | View only; save-as-template is web-only. | Complex UI. |
| Debug Console | Available but optional; defaults to off; full-screen overlay. | Screen real estate. |

### 4.3 WON'T be available on mobile (initial release)

| Feature | Rationale |
|---------|-----------|
| Custom block editor | Complex UI requires desktop-class interaction. |
| Keyboard shortcuts | No physical keyboard (external keyboard support is COULD). |
| Minimap | Too small to be useful on mobile viewports. |
| Multi-select (marquee) | Difficult to combine with pan gesture. Use tap + Shift equivalent. |
| Undo/redo gestures | Shake-to-undo is COULD; primary undo via menu. |

---

## 5. Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| MA-1 | The app MUST support the same auth flows as web (email/password, OAuth). | MUST |
| MA-2 | OAuth redirects MUST use the system browser (ASWebAuthenticationSession on iOS, Custom Tabs on Android) for security. | MUST |
| MA-3 | The app MUST store the auth session securely (Keychain on iOS, EncryptedSharedPreferences on Android). | MUST |
| MA-4 | Deep links (`chainsolve://project/:id`) MUST open the corresponding project. | SHOULD |
| MA-5 | Universal links (`https://chainsolve.app/canvas/:id`) SHOULD open the app if installed, or the web app otherwise. | SHOULD |

### Acceptance criteria

- [ ] OAuth login via Google completes without leaving the app (in-app browser).
- [ ] Tapping a `chainsolve://project/abc-123` link opens project `abc-123` in the app.

---

## 6. File import/export

| ID | Requirement | Priority |
|----|-------------|----------|
| MF-1 | CSV import MUST use the system file picker (Capacitor Filesystem plugin or `<input type="file">`). | MUST |
| MF-2 | CSV import via the system share sheet ("Open with ChainSolve") SHOULD be supported. | SHOULD |
| MF-3 | Plot export MUST use the system share sheet (share PNG/SVG). | MUST |
| MF-4 | Project export (JSON) SHOULD be available via the share sheet. | SHOULD |
| MF-5 | File operations MUST respect platform storage permissions (scoped storage on Android, document picker on iOS). | MUST |

### Acceptance criteria

- [ ] Sharing a CSV from Files.app on iOS opens ChainSolve and imports the data.
- [ ] Exporting a plot opens the share sheet with a PNG attachment.

---

## 7. Debug Console on mobile

| ID | Requirement | Priority |
|----|-------------|----------|
| MD-1 | The Debug Console SHOULD be available on mobile as an opt-in feature. | SHOULD |
| MD-2 | When enabled, it MUST render as a full-screen overlay (not a bottom panel). | MUST |
| MD-3 | Verbosity levels and filters MUST work identically to the web version. | MUST |
| MD-4 | Export MUST use the system share sheet. | MUST |
| MD-5 | The console SHOULD default to `error` verbosity on mobile (to reduce noise). | SHOULD |

---

## 8. Performance targets (mobile)

| ID | Metric | Target | Priority |
|----|--------|--------|----------|
| MP-1 | App launch (cached shell) | < 3 seconds | MUST |
| MP-2 | Project open (cached, 100 nodes) | < 2 seconds | MUST |
| MP-3 | Canvas frame rate (100 nodes, pan/zoom) | ≥ 30 fps | MUST |
| MP-4 | Canvas frame rate (500 nodes, pan/zoom) | ≥ 20 fps | SHOULD |
| MP-5 | WASM init | < 2 seconds on mid-range device | MUST |
| MP-6 | Battery: idle state | < 1% battery per hour (no background processing) | MUST |
| MP-7 | Memory (500-node project) | < 150 MB (to avoid OOM on 3 GB devices) | SHOULD |

---

## 9. Native integration

| ID | Requirement | Priority |
|----|-------------|----------|
| MN-1 | App MUST use the native status bar (no full-screen bleed). | MUST |
| MN-2 | App MUST handle safe areas correctly (notch, dynamic island, gesture bar). | MUST |
| MN-3 | App MUST handle orientation changes (portrait is primary; landscape is SHOULD). | MUST (portrait) / SHOULD (landscape) |
| MN-4 | Push notifications for collaboration events (future) SHOULD be supported via the wrapper. | COULD |
| MN-5 | App MUST follow platform conventions for back navigation (swipe-back on iOS, system back on Android). | MUST |

---

## 10. App Store requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| MS-1 | The app MUST comply with Apple App Store Review Guidelines (no web-only wrapper rejection risk — must provide native value via offline caching and share sheet integration). | MUST |
| MS-2 | The app MUST comply with Google Play Developer Program Policies. | MUST |
| MS-3 | In-app purchases (Pro upgrade) MUST use platform-native IAP if required by store policies (Apple requires IAP for digital goods). | MUST |
| MS-4 | App MUST provide a privacy policy URL and data deletion mechanism. | MUST |

---

## 11. Out of scope (for now)

- Offline project creation (requires backend-less UUID generation + local DB).
- Real-time collaboration on mobile.
- Widgets (iOS Home Screen / Android Glance).
- Watch companion app.
- AR/3D visualization.
- External keyboard shortcut mapping.

---

## 12. Future extensions

1. **Offline project creation**: Local SQLite + sync adapter.
2. **Collaborative mobile editing**: CRDT sync (depends on web implementation).
3. **iOS Shortcuts / Android Intents**: Open a specific project, read a variable value.
4. **Widget**: Show latest project values on home screen.
5. **Tablet-optimized layout**: Split-view (Library + Canvas + Inspector all visible).
6. **Haptic feedback**: Subtle haptics on connect, delete, error.

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial version (v1.0). |
