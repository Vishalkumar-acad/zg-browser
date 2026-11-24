/**
 * Zero-Gravity Browser (zg-browser) - Shared Constants
 * Single Source of Truth: Blueprint v2.3
 */

const SCHEME = 'zg';

const TRUSTED_HOSTS = Object.freeze(['ui', 'app', 'error', 'settings']);

const TRUSTED_ORIGINS = Object.freeze([
  'zg://ui',
  'zg://app',
  'zg://error',
  'zg://settings'
]);

const DEFAULT_TRUSTED_URL = 'zg://ui/index.html';

const ALLOWED_SCHEMES = Object.freeze(['https:', 'http:', 'zg:']);

const DANGEROUS_SCHEMES = Object.freeze([
  'javascript:',
  'file:',
  'data:',
  'vbscript:',
  'about:',
  'chrome:',
  'electron:',
  'shell:'
]);

const DANGEROUS_EXTENSIONS = Object.freeze([
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.app', '.msi',
  '.vbs', '.js', '.jar', '.com', '.ps1', '.scr', '.pif'
]);

// Size and Length Caps
const CAPS = Object.freeze({
  MAX_IPC_PAYLOAD_BYTES: 1024 * 1024, // 1MB general max
  MAX_URL_LENGTH: 2048,
  MAX_TITLE_LENGTH: 500,
  MAX_TAB_ID_LENGTH: 64,
  MAX_REQUEST_ID_LENGTH: 64,
  MAX_DOWNLOAD_ID_LENGTH: 64,
  MAX_ENTRY_ID_LENGTH: 64,
  MAX_SEARCH_QUERY_LENGTH: 1000,
  MAX_FIND_TEXT_LENGTH: 500,
  MAX_PAT_LENGTH: 255,
  MAX_VAULT_PATH_LENGTH: 1024,
  MAX_VAULT_FILE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_STORAGE_IMPORT_BYTES: 50 * 1024 * 1024 // 50MB
});

// Partitions
const PARTITIONS = Object.freeze({
  PERSISTENT: 'persist:default',
  EPHEMERAL_PREFIX: 'zg-ephemeral-'
});

// Vault Path Prefix
const VAULT_PREFIX = '.zg-vault/';

// UI Overlays & Drawer
const OVERLAY_IDS = Object.freeze([
  'omnibar',
  'tabstrip',
  'command-palette',
  'find-bar',
  'permission-prompt',
  'cert-error-banner',
  'download-bar'
]);

const SCRATCHPAD_BOUNDS = Object.freeze({
  DEFAULT_WIDTH: 420,
  MIN_WIDTH: 280,
  MAX_WIDTH: 800
});

// Default App Settings
const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  searchEngine: 'https://duckduckgo.com/?q=',
  trackerBlockingEnabled: true,
  distractionFree: false,
  scratchpadWidth: 420,
  githubRepo: null
});

module.exports = {
  SCHEME,
  TRUSTED_HOSTS,
  TRUSTED_ORIGINS,
  DEFAULT_TRUSTED_URL,
  ALLOWED_SCHEMES,
  DANGEROUS_SCHEMES,
  DANGEROUS_EXTENSIONS,
  CAPS,
  PARTITIONS,
  VAULT_PREFIX,
  OVERLAY_IDS,
  SCRATCHPAD_BOUNDS,
  DEFAULT_SETTINGS
};
