# Architecture Decision Records (ADR) - Zero-Gravity Browser

## ADR-0001: Dual-Layer WebContentsView Composition Strategy
- **Status**: Accepted
- **Context**: Standard `BrowserWindow` DOM cannot render cleanly above native Chromium `WebContentsView` instances due to native windowing layering boundaries. CSS `z-index` does not elevate DOM elements above native views.
- **Decision**: window-manager.js implements a Dual-Layer Composition Strategy. The untrusted website view sits at the bottom layer. A dedicated Trusted UI view (`zg://ui/index.html`) sits at the top layer. When overlays are collapsed, the UI view shrinks to a 4px top trigger zone. When overlays open, the UI view expands over the website and focuses. For the Scratchpad drawer, the website view is shrunk horizontally.

## ADR-0002: Fail-Closed safeStorage Credential Security
- **Status**: Accepted
- **Context**: On platforms lacking a running OS keychain backend (e.g. headless Linux, minimal container environments), Electron safeStorage encryption may be unavailable.
- **Decision**: The browser strictly enforces `safeStorage.isEncryptionAvailable()`. If unavailable, `SecretsManager` refuses to store credentials and returns `OS_ENCRYPTION_UNAVAILABLE`. Under zero circumstances will credentials fall back to plaintext storage on disk.

## ADR-0003: CSS-Only Reader Mode
- **Status**: Accepted
- **Context**: Traditional Reader Mode implementations inject complex JavaScript scrapers (e.g. Readability.js) via `executeJavaScript` into untrusted websites, risking DOM poisoning, script injection, and security boundary violations.
- **Decision**: Zero-Gravity Browser enforces a strictly CSS-only Reader Mode. Reader mode styling is injected via `webContents.insertCSS` using `reader.css` and removed with `removeInsertedCSS`. ZERO `executeJavaScript` scrapers or DOM parsers are injected into untrusted WebContentsView pages.

## ADR-0004: Native Node.js Fetch for GitHub REST API v3
- **Status**: Accepted
- **Context**: Minimizing third-party dependencies reduces supply-chain attack surface and process startup overhead.
- **Decision**: `github-service.js` uses native Node.js `fetch` (built into Node 18/20+) targeting GitHub REST API v3 directly, eliminating dependencies on external SDKs like Octokit.
