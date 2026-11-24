# Zero-Gravity Browser (`zg-browser`)

A lightweight, secure, developer-centric Electron/Chromium browser built strictly according to **Zero-Gravity Browser: AI Architectural Pathway & Blueprint (v2.3)**.

[![CI](https://github.com/Vishalkumar-acad/zg-browser/actions/workflows/ci.yml/badge.svg)](https://github.com/Vishalkumar-acad/zg-browser/actions/workflows/ci.yml)

---

## Architectural Pillars

- **Strict Process & WebContents Isolation:**
  - Main Process holds exclusive authority over windows, tabs, files, and credentials.
  - Every `WebContents` enforces `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`.
  - Untrusted Website `WebContentsView`: Zero preload scripts, zero IPC access, blocked from accessing `zg://` or `file://`.
  - Trusted UI `WebContentsView`: Custom privileged `zg://` protocol, strict CSP (`default-src 'self'`), and narrowly scoped `contextBridge` API (`window.zgAPI`).
- **Dual-Layer Native Bounds Coordination:**
  - Solves the native WebContentsView z-index boundary using Main-Process bounds management: Website view underneath, Trusted UI overlay above (collapsed to a 4px non-blocking trigger zone when closed), and docked Scratchpad drawer resizing the website view horizontally.
- **5-Step Frame-Aware IPC Validation Pipeline (`ipc-validator.js`):**
  - Enforces sender WebContents registration, main frame origin (`zg://ui`), strict schema & payload size validation, resource scope ownership, and sanitized responses with zero stack or secret leakage.
- **Fail-Closed Security by Default:**
  - **TLS:** Rejects invalid/expired/mismatched certificates immediately, displays `state:cert-error` UI, zero silent bypass.
  - **Permissions:** Default-deny via `setPermissionRequestHandler`, `setPermissionCheckHandler`, and `setDisplayMediaRequestHandler`.
  - **Credentials:** Electron `safeStorage` credential encryption requiring `safeStorage.isEncryptionAvailable()`. Fails closed on Linux when OS keyring is unavailable with zero plaintext fallback.
  - **Downloads:** Cross-platform path traversal rejection, filename sanitization, dangerous executable warnings, and zero auto-execution.
  - **GitHub Vault:** Native Node.js `fetch` REST API v3, strict `.zg-vault/` repository root sandbox, pre-update SHA concurrency checks, unified diff computation, and write-only token handling.
  - **Reader Mode:** Pure CSS injection (`webContents.insertCSS`) with zero DOM scraper scripts.
- **Zero Heavy UI Frameworks:**
  - Pure Vanilla ES6+, HTML5 Web Components, and CSS custom properties only. No React, Vue, Angular, Svelte, Tailwind, Bootstrap, Monaco, or Ace.
- **Zero External Runtime Dependencies:**
  - Built entirely on Node.js built-ins and Electron APIs with zero npm dependencies.
- **Zero Telemetry:**
  - Zero analytics, zero phone-homes, zero hidden background network requests.

---

## Implementation Phases (Tier 1 — v0.1 Local MVP)

| Phase | Description | Status | Tests |
| :--- | :--- | :---: | :---: |
| **Phase 1** | Secure Shell, `zg://` Protocol, Sessions, TLS & Frame-Aware IPC Pipeline | Passed | 40 passed |
| **Phase 2** | Layered UI, Tabs Lifecycle, Find Bar, History, Settings & Downloads | Passed | 66 passed |
| **Phase 3** | Modular Privacy System (`webRequest` blocklist), Scratchpad & Backup | Passed | 87 passed |
| **Phase 4** | Hardened GitHub Vault Sync (`.zg-vault/`), SafeStorage & Docs | Passed | 105 passed |

---

## Directory Structure

```
zg-browser/
├── .github/workflows/ci.yml       # GitHub Actions CI workflow (Node.js native test runner)
├── docs/
│   ├── ARCHITECTURE.md            # Architectural invariants & security boundaries
│   ├── SECURITY.md                # Security policy & vulnerability reporting
│   ├── USER_GUIDE.md              # User manual & keyboard shortcuts
│   ├── WORKFLOWS.md               # End-to-end user workflows
│   └── ADR/
│       └── 0001-architecture-decisions.md  # Architectural Decision Records
├── src/
│   ├── main/                      # Electron Main Process (sole authority)
│   │   ├── index.js               # Application entry point & lifecycle
│   │   ├── window-manager.js      # Window creation & dual-layer bounds coordination
│   │   ├── tab-manager.js         # Tab lifecycle & crash recovery
│   │   ├── protocol-handler.js    # Privileged zg:// protocol & path traversal defense
│   │   ├── session-manager.js     # Default & ephemeral partition management
│   │   ├── permission-manager.js  # Default-deny permissions & screen capture handler
│   │   ├── security-controller.js # TLS fail-closed & certificate error handler
│   │   ├── navigation-controller.js # Navigation safety & scheme allowlist
│   │   ├── ipc-validator.js       # 5-step frame-aware IPC validator
│   │   ├── ipc-handlers.js        # Dispatched IPC channel implementations
│   │   ├── download-manager.js    # Sanitized downloads & executable warnings
│   │   ├── history-manager.js     # Ephemeral-excluded browsing history
│   │   ├── settings-manager.js    # Browser configuration & corruption fallback
│   │   ├── privacy-manager.js     # webRequest tracker blocking & site allowlist
│   │   ├── storage-manager.js     # JSON/Markdown backup import/export
│   │   ├── secrets-manager.js     # Electron safeStorage fail-closed credentials
│   │   ├── github-service.js      # REST API v3 sync & .zg-vault/ sandboxing
│   │   └── error-handler.js       # Sanitized error wrapper
│   ├── preload/                   # Isolated Preload Script (zg:// UI only)
│   │   └── index.js               # Strictly scoped window.zgAPI contextBridge
│   ├── renderer/                  # Trusted UI (zg://ui) - Vanilla Web Components
│   │   ├── index.html             # Shell layout (tabs, omnibar, drawers, cert banner)
│   │   ├── components/            # Tabstrip, Omnibar, Find, Command Palette, etc.
│   │   ├── services/              # Client-side storage (IndexedDB) & syntax highlighter
│   │   └── styles/                # Modular CSS & CSS-only reader mode (reader.css)
│   └── shared/                    # Shared constants, IPC channel map & schemas
│       ├── constants.js           # Layout bounds, CSP, and config defaults
│       ├── ipc-channels.js        # Strongly typed IPC channel registry
│       ├── schemas.js             # Strict IPC payload schemas
│       └── types.js               # Core data structures & types
├── tests/                         # Comprehensive automated test suite
│   ├── functional/                # Tab lifecycle, history, downloads, privacy tests
│   ├── integration/               # End-to-end browser lifecycle & security pipeline
│   ├── security/                  # IPC validation, zg:// traversal, TLS, safeStorage, vault tests
│   └── unit/                      # Schemas, types, syntax highlighter, backup tests
```

---

## Verification & Testing

The test suite runs using Node.js's built-in test runner with sequential low-memory execution (capped at 256MB heap, ~55MB peak RSS):

```bash
# Run all 123 tests across 41 suites
npm test

# Run security test suite only
npm run test:security

# Run integration test suite only
npm run test:integration

# Run functional test suite only
npm run test:functional

# Run unit test suite only
npm run test:unit
```

---

## Linux Packaging & SHA-256 Verification

Packaged for Linux via `electron-builder` in GitHub Actions CI:
- **Formats:** `.AppImage` (standalone) and `.deb` (Debian/Ubuntu)
- **Integrity Verification:** Every release automatically generates `SHA256SUMS.txt` and executes `sha256sum -c SHA256SUMS.txt` before publishing.

All tests are continuously verified on every commit via [GitHub Actions CI](https://github.com/Vishalkumar-acad/zg-browser/actions).
