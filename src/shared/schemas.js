/**
 * Zero-Gravity Browser (zg-browser) - IPC Schemas & Validator
 * Single Source of Truth: Blueprint v2.3 Section 6.1 & 6.2
 */

const { CAPS, OVERLAY_IDS, VAULT_PREFIX } = require('./constants');
const { IPC_CHANNELS } = require('./ipc-channels');

/**
 * Checks if a value is a plain object
 */
function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Validates payload size
 */
function validatePayloadSize(payload) {
  try {
    const jsonStr = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(jsonStr, 'utf8');
    if (byteLength > CAPS.MAX_IPC_PAYLOAD_BYTES) {
      return { valid: false, error: `Payload size ${byteLength} bytes exceeds limit of ${CAPS.MAX_IPC_PAYLOAD_BYTES}` };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Payload cannot be serialized' };
  }
}

/**
 * Ensure no unexpected keys exist
 */
function assertExactKeys(payload, allowedKeys, requiredKeys = []) {
  if (!isPlainObject(payload)) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const payloadKeys = Object.keys(payload);

  for (const key of requiredKeys) {
    if (!(key in payload) || payload[key] === undefined || payload[key] === null) {
      return { valid: false, error: `Missing required key: "${key}"` };
    }
  }

  for (const key of payloadKeys) {
    if (!allowedKeys.includes(key)) {
      return { valid: false, error: `Unexpected property not allowed: "${key}"` };
    }
  }

  return { valid: true };
}

/**
 * Schemas mapping for each IPC channel
 */
const SCHEMAS = {
  [IPC_CHANNELS.TAB_CREATE]: (p) => {
    if (p === undefined || p === null) return { valid: true }; // optional payload
    const check = assertExactKeys(p, ['url', 'ephemeral'], []);
    if (!check.valid) return check;
    if (p.url !== undefined) {
      if (typeof p.url !== 'string' || p.url.length > CAPS.MAX_URL_LENGTH) {
        return { valid: false, error: 'url must be a string within max length' };
      }
    }
    if (p.ephemeral !== undefined && typeof p.ephemeral !== 'boolean') {
      return { valid: false, error: 'ephemeral must be a boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.TAB_CLOSE]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length === 0 || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid non-empty string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.TAB_SWITCH]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length === 0 || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid non-empty string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.NAV_GO]: (p) => {
    const check = assertExactKeys(p, ['tabId', 'url'], ['tabId', 'url']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length === 0 || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid string' };
    }
    if (typeof p.url !== 'string' || p.url.length === 0 || p.url.length > CAPS.MAX_URL_LENGTH) {
      return { valid: false, error: 'url must be a valid non-empty string within length limit' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.NAV_BACK]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.NAV_FORWARD]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.NAV_RELOAD]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string' || p.tabId.length > CAPS.MAX_TAB_ID_LENGTH) {
      return { valid: false, error: 'tabId must be a valid string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.FIND_START]: (p) => {
    const check = assertExactKeys(p, ['tabId', 'text', 'matchCase'], ['tabId', 'text']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string') return { valid: false, error: 'tabId must be a string' };
    if (typeof p.text !== 'string' || p.text.length > CAPS.MAX_FIND_TEXT_LENGTH) {
      return { valid: false, error: 'text must be a string within length limit' };
    }
    if (p.matchCase !== undefined && typeof p.matchCase !== 'boolean') {
      return { valid: false, error: 'matchCase must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.FIND_NEXT]: (p) => {
    const check = assertExactKeys(p, ['tabId', 'text', 'forward'], ['tabId', 'text', 'forward']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string') return { valid: false, error: 'tabId must be a string' };
    if (typeof p.text !== 'string') return { valid: false, error: 'text must be a string' };
    if (typeof p.forward !== 'boolean') return { valid: false, error: 'forward must be boolean' };
    return { valid: true };
  },

  [IPC_CHANNELS.FIND_STOP]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string') return { valid: false, error: 'tabId must be a string' };
    return { valid: true };
  },

  [IPC_CHANNELS.HISTORY_LIST]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['query', 'limit'], []);
    if (!check.valid) return check;
    if (p.query !== undefined && (typeof p.query !== 'string' || p.query.length > CAPS.MAX_SEARCH_QUERY_LENGTH)) {
      return { valid: false, error: 'query must be string within limit' };
    }
    if (p.limit !== undefined && (typeof p.limit !== 'number' || p.limit < 1 || p.limit > 1000)) {
      return { valid: false, error: 'limit must be positive integer <= 1000' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.HISTORY_DELETE_ENTRY]: (p) => {
    const check = assertExactKeys(p, ['entryId'], ['entryId']);
    if (!check.valid) return check;
    if (typeof p.entryId !== 'string' || p.entryId.length > CAPS.MAX_ENTRY_ID_LENGTH) {
      return { valid: false, error: 'entryId must be string within limit' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.HISTORY_CLEAR]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['range'], []);
    if (!check.valid) return check;
    if (p.range !== undefined && !['hour', 'day', 'all'].includes(p.range)) {
      return { valid: false, error: 'range must be "hour", "day", or "all"' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.SETTINGS_GET]: (p) => {
    if (p !== undefined && p !== null && Object.keys(p).length > 0) {
      return { valid: false, error: 'settings:get expects no parameters' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.SETTINGS_UPDATE]: (p) => {
    const check = assertExactKeys(p, ['patch'], ['patch']);
    if (!check.valid) return check;
    if (!isPlainObject(p.patch)) {
      return { valid: false, error: 'patch must be an object' };
    }
    const allowedFields = ['theme', 'searchEngine', 'trackerBlockingEnabled', 'distractionFree', 'scratchpadWidth', 'githubRepo'];
    for (const key of Object.keys(p.patch)) {
      if (!allowedFields.includes(key)) {
        return { valid: false, error: `Disallowed settings field: "${key}"` };
      }
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PRIVACY_TOGGLE_TRACKER_BLOCKING]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['enabled'], []);
    if (!check.valid) return check;
    if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
      return { valid: false, error: 'enabled must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PRIVACY_ALLOWLIST_SITE]: (p) => {
    const check = assertExactKeys(p, ['domain', 'allow'], ['domain', 'allow']);
    if (!check.valid) return check;
    if (typeof p.domain !== 'string' || p.domain.length === 0) {
      return { valid: false, error: 'domain must be non-empty string' };
    }
    if (typeof p.allow !== 'boolean') {
      return { valid: false, error: 'allow must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PRIVACY_CLEAR_SITE_DATA]: (p) => {
    const check = assertExactKeys(p, ['origin'], ['origin']);
    if (!check.valid) return check;
    if (typeof p.origin !== 'string' || p.origin.length === 0) {
      return { valid: false, error: 'origin must be non-empty string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PRIVACY_GET_BLOCKED_STATS]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string') return { valid: false, error: 'tabId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.READER_TOGGLE]: (p) => {
    const check = assertExactKeys(p, ['tabId'], ['tabId']);
    if (!check.valid) return check;
    if (typeof p.tabId !== 'string') return { valid: false, error: 'tabId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.UI_TOGGLE_DISTRACTION_FREE]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['enabled'], []);
    if (!check.valid) return check;
    if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
      return { valid: false, error: 'enabled must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.UI_TOGGLE_OVERLAY]: (p) => {
    const check = assertExactKeys(p, ['overlayId', 'visible'], ['overlayId', 'visible']);
    if (!check.valid) return check;
    if (!OVERLAY_IDS.includes(p.overlayId)) {
      return { valid: false, error: `Invalid overlayId: "${p.overlayId}"` };
    }
    if (typeof p.visible !== 'boolean') {
      return { valid: false, error: 'visible must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.UI_TOGGLE_SCRATCHPAD]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['visible', 'width'], []);
    if (!check.valid) return check;
    if (p.visible !== undefined && typeof p.visible !== 'boolean') {
      return { valid: false, error: 'visible must be boolean' };
    }
    if (p.width !== undefined && (typeof p.width !== 'number' || p.width < 100 || p.width > 2000)) {
      return { valid: false, error: 'width must be reasonable number' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PERMISSION_RESPOND]: (p) => {
    const check = assertExactKeys(p, ['requestId', 'allow', 'persist'], ['requestId', 'allow']);
    if (!check.valid) return check;
    if (typeof p.requestId !== 'string' || p.requestId.length > CAPS.MAX_REQUEST_ID_LENGTH) {
      return { valid: false, error: 'requestId must be string within limit' };
    }
    if (typeof p.allow !== 'boolean') return { valid: false, error: 'allow must be boolean' };
    if (p.persist !== undefined && typeof p.persist !== 'boolean') {
      return { valid: false, error: 'persist must be boolean' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PERMISSION_LIST]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['origin'], []);
    if (!check.valid) return check;
    if (p.origin !== undefined && typeof p.origin !== 'string') {
      return { valid: false, error: 'origin must be string' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.PERMISSION_REVOKE]: (p) => {
    const check = assertExactKeys(p, ['origin', 'permission'], ['origin', 'permission']);
    if (!check.valid) return check;
    if (typeof p.origin !== 'string' || typeof p.permission !== 'string') {
      return { valid: false, error: 'origin and permission must be strings' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.DOWNLOAD_PAUSE]: (p) => {
    const check = assertExactKeys(p, ['downloadId'], ['downloadId']);
    if (!check.valid) return check;
    if (typeof p.downloadId !== 'string') return { valid: false, error: 'downloadId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.DOWNLOAD_RESUME]: (p) => {
    const check = assertExactKeys(p, ['downloadId'], ['downloadId']);
    if (!check.valid) return check;
    if (typeof p.downloadId !== 'string') return { valid: false, error: 'downloadId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.DOWNLOAD_CANCEL]: (p) => {
    const check = assertExactKeys(p, ['downloadId'], ['downloadId']);
    if (!check.valid) return check;
    if (typeof p.downloadId !== 'string') return { valid: false, error: 'downloadId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER]: (p) => {
    const check = assertExactKeys(p, ['downloadId'], ['downloadId']);
    if (!check.valid) return check;
    if (typeof p.downloadId !== 'string') return { valid: false, error: 'downloadId must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.STORAGE_EXPORT]: (p) => {
    const check = assertExactKeys(p, ['format'], ['format']);
    if (!check.valid) return check;
    if (!['json', 'md'].includes(p.format)) {
      return { valid: false, error: 'format must be "json" or "md"' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.STORAGE_IMPORT]: (p) => {
    if (p === undefined || p === null) return { valid: true };
    const check = assertExactKeys(p, ['data', 'format'], []);
    if (!check.valid) return check;
    if (p.format !== undefined && !['json', 'md'].includes(p.format)) {
      return { valid: false, error: 'format must be "json" or "md"' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_AUTH_START]: (p) => {
    if (p !== undefined && p !== null && Object.keys(p).length > 0) {
      return { valid: false, error: 'github:auth-start takes no parameters' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_AUTH_PAT_SUBMIT]: (p) => {
    const check = assertExactKeys(p, ['token'], ['token']);
    if (!check.valid) return check;
    if (typeof p.token !== 'string' || p.token.length === 0 || p.token.length > CAPS.MAX_PAT_LENGTH) {
      return { valid: false, error: 'token must be non-empty string <= 255 chars' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_AUTH_LOGOUT]: (p) => {
    if (p !== undefined && p !== null && Object.keys(p).length > 0) {
      return { valid: false, error: 'github:auth-logout takes no parameters' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_STATUS]: (p) => {
    if (p !== undefined && p !== null && Object.keys(p).length > 0) {
      return { valid: false, error: 'github:status takes no parameters' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_SET_REPO]: (p) => {
    const check = assertExactKeys(p, ['owner', 'repo'], ['owner', 'repo']);
    if (!check.valid) return check;
    if (typeof p.owner !== 'string' || typeof p.repo !== 'string') {
      return { valid: false, error: 'owner and repo must be strings' };
    }
    // Repo format check: alphanumeric and dashes/underscores
    const repoRegex = /^[a-zA-Z0-9_.-]+$/;
    if (!repoRegex.test(p.owner) || !repoRegex.test(p.repo)) {
      return { valid: false, error: 'Invalid owner or repo format' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_PUSH]: (p) => {
    const check = assertExactKeys(p, ['path', 'content', 'message'], ['path', 'content', 'message']);
    if (!check.valid) return check;
    if (typeof p.path !== 'string' || !p.path.startsWith(VAULT_PREFIX)) {
      return { valid: false, error: `Path must start with ${VAULT_PREFIX}` };
    }
    if (p.path.includes('..') || p.path.includes('\\') || p.path.includes('//')) {
      return { valid: false, error: 'Path traversal not permitted' };
    }
    if (typeof p.content !== 'string') return { valid: false, error: 'content must be string' };
    if (typeof p.message !== 'string') return { valid: false, error: 'message must be string' };
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_PULL]: (p) => {
    const check = assertExactKeys(p, ['path'], ['path']);
    if (!check.valid) return check;
    if (typeof p.path !== 'string' || !p.path.startsWith(VAULT_PREFIX)) {
      return { valid: false, error: `Path must start with ${VAULT_PREFIX}` };
    }
    if (p.path.includes('..') || p.path.includes('\\') || p.path.includes('//')) {
      return { valid: false, error: 'Path traversal not permitted' };
    }
    return { valid: true };
  },

  [IPC_CHANNELS.GITHUB_DIFF]: (p) => {
    const check = assertExactKeys(p, ['path', 'localContent'], ['path', 'localContent']);
    if (!check.valid) return check;
    if (typeof p.path !== 'string' || !p.path.startsWith(VAULT_PREFIX)) {
      return { valid: false, error: `Path must start with ${VAULT_PREFIX}` };
    }
    if (p.path.includes('..') || p.path.includes('\\') || p.path.includes('//')) {
      return { valid: false, error: 'Path traversal not permitted' };
    }
    if (typeof p.localContent !== 'string') return { valid: false, error: 'localContent must be string' };
    return { valid: true };
  }
};

/**
 * Validate an IPC call payload against its channel schema
 */
function validateChannelPayload(channel, payload) {
  const sizeCheck = validatePayloadSize(payload);
  if (!sizeCheck.valid) return sizeCheck;

  const schemaValidator = SCHEMAS[channel];
  if (!schemaValidator) {
    return { valid: false, error: `No schema defined for channel: ${channel}` };
  }

  return schemaValidator(payload);
}

module.exports = {
  validateChannelPayload,
  validatePayloadSize,
  assertExactKeys,
  SCHEMAS
};
