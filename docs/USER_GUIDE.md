# Zero-Gravity Browser - User Guide

Welcome to **Zero-Gravity Browser (`zg-browser`)**, a lightweight, developer-centric, local-first Electron browser.

## Keyboard-First Navigation & Shortcuts

| Shortcut | Action | Description |
|---|---|---|
| `Ctrl+L` / `Cmd+L` | **Omnibar** | Search DuckDuckGo or enter destination URL |
| `Ctrl+T` / `Cmd+T` | **New Tab** | Creates a new browsing tab and opens Omnibar |
| `Ctrl+W` / `Cmd+W` | **Close Tab** | Closes active tab and cleans up resources |
| `Ctrl+K` / `Cmd+K` | **Command Palette** | Quick action picker for all browser commands |
| `Ctrl+F` / `Cmd+F` | **Find in Page** | Search in-page text with previous/next matches |
| `Ctrl+H` / `Cmd+H` | **History** | View, search, and clear browsing history |
| `Ctrl+,` / `Cmd+,` | **Settings** | Configure themes, search engine, and tracker blocking |
| `Ctrl+Shift+E` / `Cmd+Shift+E` | **Scratchpad** | Docked side code drawer for snippets and notes |
| `Ctrl+Shift+D` / `Cmd+Shift+D` | **Distraction-Free** | Toggle minimal distraction-free chrome |
| `Esc` | **Dismiss** | Closes any open overlay or scratchpad drawer |

## Features

### 1. Dual-Layer Floating UI
Overlays float smoothly above website content. When dismissed, the Trusted UI collapses to a 4px top trigger zone, allowing mouse and keyboard clicks to flow directly to the website.

### 2. Built-in Scratchpad & Tagging
- Supports `@project-name` and `#tag-name` syntax tagging.
- Smart auto-save automatically writes edits to local IndexedDB storage with 500ms debounce.

### 3. GitHub Vault Synchronization
- Push and pull markdown notes and snippets to your GitHub repository under `.zg-vault/`.
- Authenticate seamlessly using OAuth Device Flow or Personal Access Token (PAT).
- Credentials are encrypted at rest with OS keychain (`safeStorage`). Plaintext fallback is prohibited.

### 4. Privacy & Tracker Blocking
- Built-in network request filtering blocks invasive trackers using `blocklist.json`.
- Per-site allowlisting lets you bypass blocking when needed.
- Ephemeral private tabs ensure zero disk history and zero session persistence.
