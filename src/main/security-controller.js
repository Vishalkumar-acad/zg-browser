/**
 * Zero-Gravity Browser (zg-browser) - Security Controller
 * Single Source of Truth: Blueprint v2.3 Section 2.2 & 4.4
 * 
 * Enforces baseline WebPreferences across all WebContents.
 * Enforces strict fail-closed TLS certificate validation.
 */

const { IPC_CHANNELS } = require('../shared/ipc-channels');

/**
 * Returns hardened WebPreferences for untrusted website WebContents
 * (ZERO preload scripts, ZERO IPC access)
 */
function getUntrustedWebPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    plugins: false,
    experimentalFeatures: false,
    enableBlinkFeatures: '',
    preload: undefined // ZERO preload scripts for website views
  };
}

/**
 * Returns hardened WebPreferences for Trusted UI WebContents
 * (Preload sandbox, narrowly scoped contextBridge only)
 * @param {string} preloadPath - Absolute path to preload/index.js
 */
function getTrustedUIWebPreferences(preloadPath) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    plugins: false,
    preload: preloadPath
  };
}

class SecurityController {
  /**
   * @param {Object} options
   * @param {Function} options.sendToTrustedUI - Callback to notify Trusted UI
   */
  constructor({ sendToTrustedUI } = {}) {
    this.sendToTrustedUI = sendToTrustedUI || (() => {});
  }

  /**
   * Attaches TLS certificate error listener to an Electron app or WebContents
   * Enforces fail-closed policy (never bypasses errors) and notifies UI.
   * 
   * @param {import('electron').App} appInstance
   * @param {Function} getTabIdForWebContents - Resolver for tabId
   */
  attachCertificateErrorHandler(appInstance, getTabIdForWebContents) {
    if (!appInstance || typeof appInstance.on !== 'function') return;

    appInstance.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      // 1. Fail closed: Prevent default and explicitly reject
      event.preventDefault();
      callback(false); // Reject certificate

      // 2. Resolve tabId
      const tabId = getTabIdForWebContents ? getTabIdForWebContents(webContents) : 'unknown';

      // 3. Emit sanitized cert-error notification to Trusted UI
      this.sendToTrustedUI(IPC_CHANNELS.STATE_CERT_ERROR, {
        tabId,
        url,
        errorCode: error || 'CERT_ERROR_UNKNOWN',
        issuer: certificate && certificate.issuerName ? certificate.issuerName : undefined
      });
    });
  }

  /**
   * Validates that webPreferences object strictly satisfies security mandates
   * @param {Object} webPreferences
   */
  validateWebPreferences(webPreferences) {
    if (!webPreferences) return false;
    return (
      webPreferences.contextIsolation === true &&
      webPreferences.nodeIntegration === false &&
      webPreferences.sandbox === true &&
      webPreferences.webSecurity === true
    );
  }
}

module.exports = {
  SecurityController,
  getUntrustedWebPreferences,
  getTrustedUIWebPreferences
};
