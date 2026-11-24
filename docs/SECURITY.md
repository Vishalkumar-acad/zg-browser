# Zero-Gravity Browser Security Policy & Invariants

## 1. WebContents Security Domain Separation
- **Untrusted Website WebContents**:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webSecurity: true`
  - ZERO preload scripts
  - ZERO IPC access
  - Blocked from navigating or framing `zg://` or accessing `file://`
- **Trusted UI WebContents (`zg://ui`)**:
  - Served strictly via `zg://` custom privileged protocol
  - Strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';`
  - Narrowly scoped `contextBridge` API only (`window.zgAPI`)
  - No generic `ipcRenderer` exposure

## 2. 5-Step Frame-Aware IPC Validation Pipeline (`ipc-validator.js`)
Every IPC channel handled on `ipcMain` executes:
1. **Sender WebContents Authentication**: Matches registered Trusted UI instance.
2. **Sender Frame & Origin Authentication**: `senderFrame.parent === null` (main frame only) and origin is `zg://` allowlisted route.
3. **Schema & Size Validation**: Enforces exact schemas, byte limits, and rejects unexpected properties.
4. **Resource Authorization**: Verifies ownership and access control for resources (`tabId`, `requestId`, etc.).
5. **Execution & Sanitized Structured Response**: Returns standardized `{ ok: true, data }` or sanitized `{ ok: false, error: { code, message } }`.

## 3. Defense-in-Depth Policies
- **TLS Validation**: Preserves Chromium validation; fail-closed on cert errors; surfaces `state:cert-error`.
- **Permissions**: Default-deny for camera, microphone, geolocation, and dedicated `setDisplayMediaRequestHandler` for screen capture.
- **Path Traversal Defense**: Strict URL resolution in `protocol-handler.js` rejecting dot-dot and encoded traversal.
- **Redaction**: Error handler sanitizes home directories, tokens, credentials, and stack traces.
