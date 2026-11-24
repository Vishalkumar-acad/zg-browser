/**
 * Zero-Gravity Browser (zg-browser) - Shared Types & JSDoc Definitions
 * Single Source of Truth: Blueprint v2.3
 */

/**
 * @typedef {Object} TabState
 * @property {string} id - Unique Tab ID
 * @property {string} url - Active URL
 * @property {string} title - Tab Title
 * @property {boolean} isLoading - Loading state
 * @property {boolean} canGoBack - Navigation back availability
 * @property {boolean} canGoForward - Navigation forward availability
 * @property {boolean} isEphemeral - Whether tab belongs to an in-memory private session
 * @property {boolean} isCrashed - Whether render process crashed
 * @property {boolean} readerActive - Whether Reader Mode is active
 */

/**
 * @typedef {Object} PermissionRecord
 * @property {string} id - Permission record ID
 * @property {string} origin - Requesting origin
 * @property {string} permission - Permission type (camera, microphone, geolocation, etc.)
 * @property {boolean} allowed - Decision
 * @property {number} timestamp - Epoch timestamp of decision
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id - Entry ID
 * @property {string} url - Visited URL
 * @property {string} title - Page title
 * @property {number} visitedAt - Visit timestamp
 */

/**
 * @typedef {Object} AppSettings
 * @property {string} theme - 'dark' | 'light' | 'system'
 * @property {string} searchEngine - Search query base URL
 * @property {boolean} trackerBlockingEnabled - Privacy blocklist toggle
 * @property {boolean} distractionFree - Minimal chrome toggle
 * @property {number} scratchpadWidth - Scratchpad drawer width in pixels
 * @property {string|null} githubRepo - Configured target repository (owner/repo)
 */

/**
 * Standard IPC Result Shapes
 * @template T
 * @typedef {Object} IpcResult
 * @property {boolean} ok - Success flag
 * @property {T} [data] - Result data if ok === true
 * @property {{ code: string, message: string }} [error] - Sanitized error if ok === false
 */

module.exports = {};
