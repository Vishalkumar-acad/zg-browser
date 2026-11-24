/**
 * Zero-Gravity Browser (zg-browser) - IPC Channel Names
 * Single Source of Truth: Blueprint v2.3 Section 6.2
 */

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

module.exports = { IPC_CHANNELS };
