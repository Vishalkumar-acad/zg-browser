# Zero-Gravity Browser - Development & Operational Workflows

## 1. Development Workflows

### Running Tests
The project relies exclusively on the native Node.js test runner (`node:test` and `node:assert`), ensuring zero external testing dependencies.

```bash
# Run the complete test suite (security + unit)
npm test

# Run security invariant tests specifically
npm run test:security

# Run unit tests specifically
npm run test:unit
```

### Continuous Integration (GitHub Actions)
All automated builds and tests are triggered via GitHub Actions (`.github/workflows/ci.yml`) on every push to `main` and pull requests.
To check workflow runs with GitHub CLI:
```bash
gh run list
gh run watch
```

## 2. GitHub Vault Sync Workflow

```
[Scratchpad Edit]
       │
       ▼ (500ms Debounce + Dirty Check)
[Local IndexedDB Save]
       │
       ▼ (User requests Push)
[Normalize Path: .zg-vault/{file}]
       │
       ▼ (Pre-Update SHA Lookup)
[GET /repos/{owner}/{repo}/contents/{path}]
       │
       ├─► HTTP 404 (New File) ──► [PUT Content (Create)]
       │
       ├─► SHA Match ─────────────► [PUT Content (Update)]
       │
       └─► SHA Mismatch (HTTP 409) ──► [Preserve Local & Abort Push]
```

## 3. Ephemeral Private Browsing Workflow
- Private tabs are partitioned with unique `zg-ephemeral-{tabId}` partitions.
- Cache and disk persistence are disabled (`cache: false`).
- Navigation history is strictly excluded from `HistoryManager`.
- Upon tab closure, `clearStorageData()` wipes all in-memory cookies, DOM storage, and cache, followed by immediate `WebContentsView` destruction.
