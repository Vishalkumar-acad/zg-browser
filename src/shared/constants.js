/**
 * Zero-Gravity Browser (zg-browser) - Shared Constants
 * Single Source of Truth: Blueprint v2.3
 */

const SCHEME = 'zg';

const TRUSTED_HOSTS = Object.freeze(['ui', 'app', 'error', 'settings', 'about']);

const TRUSTED_ORIGINS = Object.freeze([
  'zg://ui',
  'zg://app',
  'zg://error',
  'zg://settings',
  'zg://about'
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

// Persistent Top Bar Height (Dual-Layer Top Chrome)
const TOP_BAR_HEIGHT = 74;

// UI Overlays & Drawer
const OVERLAY_IDS = Object.freeze([
  'omnibar',
  'tabstrip',
  'command-palette',
  'find-bar',
  'history',
  'settings',
  'permission-prompt',
  'cert-error-banner',
  'download-bar'
]);

const SCRATCHPAD_BOUNDS = Object.freeze({
  DEFAULT_WIDTH: 420,
  MIN_WIDTH: 280,
  MAX_WIDTH: 800
});

// Built-in Search Engines
const SEARCH_ENGINES = Object.freeze({
  duckduckgo: {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q='
  },
  google: {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q='
  },
  brave: {
    id: 'brave',
    name: 'Brave Search',
    url: 'https://search.brave.com/search?q='
  },
  startpage: {
    id: 'startpage',
    name: 'Startpage',
    url: 'https://www.startpage.com/sp/search?query='
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    url: ''
  }
});

// Default App Settings
const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  searchEngine: 'duckduckgo',
  customSearchUrl: '',
  newTabUrl: 'about:blank',
  trackerBlockingEnabled: true,
  distractionFree: false,
  scratchpadWidth: 420,
  githubRepo: null
});

/**
 * Pure helper to format search engine URL safely
 * @param {string} engineIdOrUrl - Engine ID (duckduckgo, google, brave, startpage, custom) or full URL
 * @param {string} query - Raw search query
 * @param {string} [customTemplate] - Optional custom template URL with %s
 */
function formatSearchUrl(engineOrId, query, customTemplate = '') {
  const encoded = encodeURIComponent(query.trim());
  const engineKey = (engineOrId || 'duckduckgo').toLowerCase();

  if (engineKey === 'custom' || (!SEARCH_ENGINES[engineKey] && customTemplate)) {
    const template = customTemplate || engineOrId;
    if (template && (template.startsWith('http://') || template.startsWith('https://'))) {
      if (template.includes('%s')) {
        return template.replace(/%s/g, encoded);
      }
      if (template.endsWith('=') || template.endsWith('&') || template.endsWith('?')) {
        return template + encoded;
      }
      return template + (template.includes('?') ? '&q=' : '?q=') + encoded;
    }
  }

  if (SEARCH_ENGINES[engineKey] && SEARCH_ENGINES[engineKey].url) {
    return SEARCH_ENGINES[engineKey].url + encoded;
  }

  // Fallback if engineOrId is a direct URL
  if (typeof engineOrId === 'string' && (engineOrId.startsWith('http://') || engineOrId.startsWith('https://'))) {
    if (engineOrId.includes('%s')) {
      return engineOrId.replace(/%s/g, encoded);
    }
    return engineOrId + encoded;
  }

  return SEARCH_ENGINES.duckduckgo.url + encoded;
}

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
  TOP_BAR_HEIGHT,
  OVERLAY_IDS,
  SCRATCHPAD_BOUNDS,
  SEARCH_ENGINES,
  DEFAULT_SETTINGS,
  formatSearchUrl
};
