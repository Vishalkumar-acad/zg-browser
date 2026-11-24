/**
 * Zero-Gravity Browser (zg-browser) - Preload Script
 * Single Source of Truth: Blueprint v2.3 Section 2.2 & 6
 * 
 * Exposes narrowly scoped, type-safe API to Trusted UI via contextBridge.
 * ZERO raw ipcRenderer exposure. Clean listener cleanup functions returned.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Inlined IPC channel mappings for sandboxed preload compatibility
const IPC_CHANNELS = Object.freeze({
  // Tab Lifecycle (Renderer -> Main)
  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SWITCH: 'tab:switch',

  // Navigation (Renderer -> Main)
  NAV_GO: 'nav:go',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',

  // Find in Page (Renderer -> Main)
  FIND_START: 'find:start',
  FIND_NEXT: 'find:next',
  FIND_STOP: 'find:stop',

  // History (Renderer -> Main)
  HISTORY_LIST: 'history:list',
  HISTORY_DELETE_ENTRY: 'history:delete-entry',
  HISTORY_CLEAR: 'history:clear',

  // Settings (Renderer -> Main)
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Privacy (Renderer -> Main)
  PRIVACY_TOGGLE_TRACKER_BLOCKING: 'privacy:toggle-tracker-blocking',
  PRIVACY_ALLOWLIST_SITE: 'privacy:allowlist-site',
  PRIVACY_CLEAR_SITE_DATA: 'privacy:clear-site-data',
  PRIVACY_GET_BLOCKED_STATS: 'privacy:get-blocked-stats',
  PRIVACY_GET_ALLOWLIST: 'privacy:get-allowlist',

  // System & Version Info (Renderer -> Main)
  SYSTEM_GET_ABOUT: 'system:get-about',

  // Reader Mode & Distraction-Free UI (Renderer -> Main)
  READER_TOGGLE: 'reader:toggle',
  UI_TOGGLE_DISTRACTION_FREE: 'ui:toggle-distraction-free',
  UI_TOGGLE_OVERLAY: 'ui:toggle-overlay',
  UI_TOGGLE_SCRATCHPAD: 'ui:toggle-scratchpad',

  // Permissions (Renderer -> Main)
  PERMISSION_RESPOND: 'permission:respond',
  PERMISSION_LIST: 'permission:list',
  PERMISSION_REVOKE: 'permission:revoke',

  // Downloads (Renderer -> Main)
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_OPEN_FOLDER: 'download:open-folder',

  // Storage (Renderer -> Main)
  STORAGE_EXPORT: 'storage:export',
  STORAGE_IMPORT: 'storage:import',

  // GitHub Vault (Renderer -> Main)
  GITHUB_AUTH_START: 'github:auth-start',
  GITHUB_AUTH_PAT_SUBMIT: 'github:auth-pat-submit',
  GITHUB_AUTH_LOGOUT: 'github:auth-logout',
  GITHUB_STATUS: 'github:status',
  GITHUB_SET_REPO: 'github:set-repo',
  GITHUB_PUSH: 'github:push',
  GITHUB_PULL: 'github:pull',
  GITHUB_DIFF: 'github:diff',

  // Push State Events (Main -> Renderer)
  STATE_TABS_UPDATED: 'state:tabs-updated',
  STATE_NAV_UPDATED: 'state:nav-updated',
  STATE_FIND_RESULT: 'state:find-result',
  STATE_CERT_ERROR: 'state:cert-error',
  STATE_PERMISSION_PROMPT: 'state:permission-prompt',
  STATE_DOWNLOAD_UPDATED: 'state:download-updated',
  STATE_ERROR_NOTICE: 'state:error-notice'
});

/**
 * Helper to safely wrap an IPC event listener, stripping raw event
 * and returning an unlisten function.
 */
function createEventListener(channel) {
  return (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Listener callback must be a function');
    }
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

const zgAPI = Object.freeze({
  // Tab Management
  tabs: Object.freeze({
    create: (opts) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CREATE, opts),
    close: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE, { tabId }),
    switch: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_SWITCH, { tabId }),
    onTabsUpdated: createEventListener(IPC_CHANNELS.STATE_TABS_UPDATED)
  }),

  // Navigation
  nav: Object.freeze({
    go: (tabId, url) => ipcRenderer.invoke(IPC_CHANNELS.NAV_GO, { tabId, url }),
    back: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.NAV_BACK, { tabId }),
    forward: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.NAV_FORWARD, { tabId }),
    reload: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.NAV_RELOAD, { tabId }),
    onNavUpdated: createEventListener(IPC_CHANNELS.STATE_NAV_UPDATED)
  }),

  // UI Layering & Overlays
  ui: Object.freeze({
    toggleOverlay: (overlayId, visible) =>
      ipcRenderer.invoke(IPC_CHANNELS.UI_TOGGLE_OVERLAY, { overlayId, visible }),
    toggleScratchpad: (visible, width) =>
      ipcRenderer.invoke(IPC_CHANNELS.UI_TOGGLE_SCRATCHPAD, { visible, width }),
    toggleDistractionFree: (enabled) =>
      ipcRenderer.invoke(IPC_CHANNELS.UI_TOGGLE_DISTRACTION_FREE, { enabled })
  }),

  // Permissions
  permissions: Object.freeze({
    respond: (requestId, allow, persist) =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_RESPOND, { requestId, allow, persist }),
    list: (origin) =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_LIST, origin ? { origin } : undefined),
    revoke: (origin, permission) =>
      ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_REVOKE, { origin, permission }),
    onPermissionPrompt: createEventListener(IPC_CHANNELS.STATE_PERMISSION_PROMPT)
  }),

  // Find in Page
  find: Object.freeze({
    start: (tabId, text, matchCase) =>
      ipcRenderer.invoke(IPC_CHANNELS.FIND_START, { tabId, text, matchCase }),
    next: (tabId, text, forward) =>
      ipcRenderer.invoke(IPC_CHANNELS.FIND_NEXT, { tabId, text, forward }),
    stop: (tabId) =>
      ipcRenderer.invoke(IPC_CHANNELS.FIND_STOP, { tabId }),
    onFindResult: createEventListener(IPC_CHANNELS.STATE_FIND_RESULT)
  }),

  // History
  history: Object.freeze({
    list: (opts) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, opts),
    deleteEntry: (entryId) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE_ENTRY, { entryId }),
    clear: (range) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR, range ? { range } : undefined)
  }),

  // Settings
  settings: Object.freeze({
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (patch) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, { patch })
  }),

  // Privacy & Tracker Blocking
  privacy: Object.freeze({
    toggleTrackerBlocking: (enabled) =>
      ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_TOGGLE_TRACKER_BLOCKING, { enabled }),
    allowlistSite: (domain, allow) =>
      ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_ALLOWLIST_SITE, { domain, allow }),
    getAllowlist: () =>
      ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_GET_ALLOWLIST),
    clearSiteData: (origin) =>
      ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_CLEAR_SITE_DATA, { origin }),
    getBlockedStats: (tabId) =>
      ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_GET_BLOCKED_STATS, { tabId })
  }),

  // Reader Mode
  reader: Object.freeze({
    toggle: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.READER_TOGGLE, { tabId })
  }),

  // Downloads
  downloads: Object.freeze({
    pause: (downloadId) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_PAUSE, { downloadId }),
    resume: (downloadId) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RESUME, { downloadId }),
    cancel: (downloadId) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, { downloadId }),
    openFolder: (downloadId) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER, { downloadId }),
    onDownloadUpdated: createEventListener(IPC_CHANNELS.STATE_DOWNLOAD_UPDATED)
  }),

  // Storage
  storage: Object.freeze({
    export: (format) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_EXPORT, { format }),
    import: (data, format) => ipcRenderer.invoke(IPC_CHANNELS.STORAGE_IMPORT, { data, format })
  }),

  // GitHub Vault
  github: Object.freeze({
    authStart: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_START),
    authPatSubmit: (token) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_PAT_SUBMIT, { token }),
    authLogout: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_AUTH_LOGOUT),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_STATUS),
    setRepo: (owner, repo) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_SET_REPO, { owner, repo }),
    push: (path, content, message) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_PUSH, { path, content, message }),
    pull: (path) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_PULL, { path }),
    diff: (path, localContent) => ipcRenderer.invoke(IPC_CHANNELS.GITHUB_DIFF, { path, localContent })
  }),

  // System & Security Events
  system: Object.freeze({
    getAbout: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_ABOUT),
    onCertError: createEventListener(IPC_CHANNELS.STATE_CERT_ERROR),
    onErrorNotice: createEventListener(IPC_CHANNELS.STATE_ERROR_NOTICE)
  })
});

// Expose safe API to main world
contextBridge.exposeInMainWorld('zgAPI', zgAPI);
