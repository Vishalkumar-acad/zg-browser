# Zero-Gravity Browser (`zg-browser`)

A lightweight, secure, developer-centric web browser built on Electron/Chromium with strict process and security isolation.

## Core Architectural Pillars
- **Strict Process & WebContents Isolation**: Main Process authority, isolated WebContentsViews, zero preload on untrusted websites.
- **Dual-Layer Composition**: Top Trusted UI layer (`zg://ui`) + Bottom Website layer with Main-coordinated bounds (no broken CSS z-index assumptions).
- **5-Step Frame-Aware IPC Validation Pipeline**: Strict sender authentication, frame checks, schema & length verification, resource scoping, and sanitized responses.
- **Zero Heavy UI Frameworks**: Vanilla ES6+ JavaScript, HTML5 Web Components, and modular CSS only.
- **Zero Telemetry**: Zero analytics, zero hidden background network requests.
- **Fail-Closed Security**: Fail-closed on TLS certificate errors, default-deny on permissions & screen capture, strict `.zg-vault/` GitHub synchronization boundaries.

## Development & Testing

```bash
# Run security and unit tests
npm test

# Run security test suite specifically
npm run test:security
```
