# Marketing QA Checklist

> Pre-launch checklist for screenshots, browser support, and common error states.

---

## 1. Screenshots Checklist

Before capturing marketing screenshots, ensure:

- [ ] Browser devtools closed, bookmarks bar hidden
- [ ] Window size: 1440 × 900 (standard 16:10 marketing crop)
- [ ] Theme set to **dark mode** (default) — capture light mode separately if needed
- [ ] Use a project with ≥ 8 blocks and visible edges to show a realistic canvas
- [ ] Signed in as a **Pro** user so all features are unlocked
- [ ] No toasts, modals, or dropdown menus obscuring the canvas
- [ ] Block library panel closed (unless showcasing it)
- [ ] Variables panel visible with at least one slider bound

### Recommended screenshots

| # | Scene | Notes |
|---|-------|-------|
| 1 | Hero — canvas with 10+ connected blocks | Show live values flowing |
| 2 | Block library open, search active | Highlight breadth of operations |
| 3 | Variables panel with slider | Show interactive exploration |
| 4 | Export → Audit PDF preview | Show Pro export value |
| 5 | Explore page with community items | Show ecosystem |
| 6 | Graph health panel with green status | Show validation tooling |
| 7 | Mobile viewport (375 × 812) | Show responsive layout |
| 8 | Light mode variant of hero | Accessibility / preference |

---

## 2. Supported Browsers

ChainSolve requires WebAssembly support. The engine runs in a Web Worker using `wasm-unsafe-eval` CSP policy.

| Browser | Min Version | Status |
|---------|-------------|--------|
| Chrome / Chromium | 89+ | Fully supported |
| Firefox | 89+ | Fully supported |
| Safari | 15.2+ | Fully supported |
| Edge | 89+ | Fully supported (Chromium-based) |
| Opera | 75+ | Supported (Chromium-based) |
| Samsung Internet | 15+ | Supported |
| iOS Safari | 15.2+ | Supported |
| Chrome Android | 89+ | Supported |

### Not supported

| Browser | Reason |
|---------|--------|
| IE 11 | No WebAssembly, no ES modules |
| Safari < 15.2 | Missing `structuredClone`, limited WASM support |
| Opera Mini | No WebAssembly |
| KaiOS | No WebAssembly |

### Feature requirements

- **WebAssembly**: Core engine runs as compiled Rust → WASM
- **Web Workers**: Engine runs off-main-thread for non-blocking UI
- **ES Modules**: Vite outputs native ESM bundles
- **CSS Custom Properties**: Used for theming (dark/light mode)
- **localStorage**: User preferences, blocked users, favourites
- **Clipboard API**: Copy/paste block values

---

## 3. Common Error States and Copy

### Engine errors

| State | UI Treatment | Copy |
|-------|-------------|------|
| WASM failed to load | Full-screen error with reload button | "The calculation engine failed to load. Please refresh the page. If the problem persists, try a different browser." |
| Engine timeout | Toast warning | "Calculation took too long. Try simplifying your chain." |
| NaN propagation | Orange badge on Display block | Block shows "NaN" — user should check input connections |
| Division by zero | Error value in Display block | Shows operator-specific message, e.g. "Power: t = 0" |
| Cycle detected | Graph health warning | "Cycle detected — remove circular connections to continue." |

### Network / auth errors

| State | UI Treatment | Copy |
|-------|-------------|------|
| Not signed in (save) | Toast error | "Sign in to save your work." |
| Not signed in (export) | Toast error | "Sign in to export." |
| Session expired | Toast + redirect to login | "Your session has expired. Please sign in again." |
| Project load failed | Error banner on home | "Failed to load projects" |
| Explore install failed | Toast error | "Install failed. Please try again." |

### Plan / gating errors

| State | UI Treatment | Copy |
|-------|-------------|------|
| Free user → export | Upgrade prompt modal | "Exports require a Pro subscription. Upgrade to unlock PDF, Excel, and JSON exports." |
| Free user → CSV import | Upgrade prompt | "CSV import is a Pro feature." |
| Free user → groups | Upgrade prompt | "Block groups require a Pro subscription." |
| Free user → vectors | Upgrade prompt | "Vector blocks require a Pro subscription." |
| Project limit reached (Free) | Create blocked | "Free accounts are limited to 1 project. Upgrade to Pro for unlimited projects." |
| Canvas limit reached (Free) | Create blocked | "Free accounts are limited to 2 canvases per project." |

### File / storage errors

| State | UI Treatment | Copy |
|-------|-------------|------|
| CSV too large | Toast error | "File exceeds the 50 MB upload limit." |
| Invalid CSV | Toast error | "CSV parse error" |
| Storage upload failed | Toast error | "Upload failed. Please try again." |

---

## 4. Pre-Launch Verification

- [ ] All "coming soon" text removed (D17-1 ✓)
- [ ] Quick guides present in Help → Documentation (D17-2 ✓)
- [ ] Explore page loads and shows items
- [ ] Free-tier gating works (export, CSV, groups, vectors blocked)
- [ ] Pro features accessible with valid subscription
- [ ] Light mode and dark mode both render correctly
- [ ] Mobile layout usable (no overflow, touch targets ≥ 44px)
- [ ] No console errors on initial load
- [ ] CSP headers present and no violations
- [ ] `robots noindex` meta tag present (staging only — remove for production)
- [ ] Build passes `verify-ci.sh` with zero errors
