# Zero-Gravity Browser Architecture (v2.3 Specification)

## Process Separation
```
ELECTRON MAIN PROCESS (Trusted Authority)
├── Window Manager (Dual-Layer bounds coordinator)
├── Protocol Handler (zg:// allowlisted assets)
├── Session Manager (Default persistent & in-memory ephemeral partitions)
├── Navigation Controller (will-navigate & setWindowOpenHandler)
├── Permission Manager (Default-deny & display capture handler)
├── Security Controller (TLS validation & WebPreferences enforcement)
├── IPC Validator (5-step frame-aware security pipeline)
├── IPC Handlers (Structured response registry)
└── Error Handler (Sanitized error broadcaster)
      │
      ├── [Strict Frame-Aware Privileged IPC (invoke/handle)]
      │
      └── Trusted UI WebContents (zg://ui/index.html)
            └── Preload Sandbox (contextBridge: window.zgAPI)
            └── Vanilla JS Floating UI & Docked Scratchpad
      │
      └── [Zero Preload / Zero IPC Isolation]
            └── Untrusted Website WebContents (WebContentsView)
                  └── Chromium Isolated Website Rendering
```

## Dual-Layer WebContentsView Composition
Standard `BrowserWindow` DOM cannot render above native `WebContentsView`. To guarantee zero clipping and smooth floating overlays without CSS `z-index` defects:
- **Bottom Layer**: Active untrusted website `WebContentsView`.
- **Top Layer**: Trusted UI overlay `WebContentsView` (`zg://ui/index.html`).
- When overlays are closed: Main process shrinks UI view height to a 4px top trigger zone so mouse/keyboard events pass directly through to website.
- When an overlay opens: Main process expands UI view bounds over the website and focuses it.
- When Scratchpad opens: Main process shrinks the website view width horizontally for side-by-side browsing and coding.
