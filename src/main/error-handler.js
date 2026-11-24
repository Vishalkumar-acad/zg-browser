/**
 * Zero-Gravity Browser (zg-browser) - Error & Recovery Controller
 * Single Source of Truth: Blueprint v2.3 Section 4.8
 * 
 * Sanitizes errors and emits structured state:error-notice events.
 * Strips stack traces, filesystem paths, OS user names, and secret tokens.
 */

const os = require('os');
const { IPC_CHANNELS } = require('../shared/ipc-channels');

class ErrorHandler {
  /**
   * @param {Object} options
   * @param {Function} [options.sendToTrustedUI] - Callback to broadcast errors to UI
   */
  constructor({ sendToTrustedUI } = {}) {
    this.sendToTrustedUI = sendToTrustedUI || (() => {});
    this.homedir = os.homedir();
  }

  /**
   * Redacts sensitive information from error messages
   * @param {string} rawMessage
   */
  sanitizeMessage(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') {
      return 'An unexpected error occurred';
    }

    let sanitized = rawMessage;

    // Redact home directory paths
    if (this.homedir) {
      sanitized = sanitized.split(this.homedir).join('~');
    }

    // Redact common auth token patterns (ghp_, gho_, Bearer, Authorization)
    sanitized = sanitized.replace(/(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{16,255}/g, '[REDACTED_TOKEN]');
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, 'Bearer [REDACTED_TOKEN]');
    sanitized = sanitized.replace(/([?&](?:token|key|secret|password|access_token)=)[^&]+/gi, '$1[REDACTED]');

    // Strip stack trace lines (starts with " at ")
    sanitized = sanitized.split('\n')[0].trim();

    return sanitized;
  }

  /**
   * Emits a sanitized error notice to Trusted UI
   * @param {string} code
   * @param {Error|string} error
   */
  notify(code, error) {
    const rawMessage = typeof error === 'string' ? error : (error && error.message ? error.message : 'Unknown error');
    const sanitized = this.sanitizeMessage(rawMessage);

    this.sendToTrustedUI(IPC_CHANNELS.STATE_ERROR_NOTICE, {
      code: code || 'INTERNAL_ERROR',
      message: sanitized
    });
  }

  /**
   * Global uncaught exception and rejection handlers
   */
  attachGlobalHandlers() {
    process.on('uncaughtException', (err) => {
      this.notify('UNCAUGHT_EXCEPTION', err);
    });

    process.on('unhandledRejection', (reason) => {
      this.notify('UNHANDLED_REJECTION', reason instanceof Error ? reason : String(reason));
    });
  }
}

module.exports = { ErrorHandler };
