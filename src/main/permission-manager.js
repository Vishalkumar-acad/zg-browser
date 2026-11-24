/**
 * Zero-Gravity Browser (zg-browser) - Permission Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.4
 * 
 * Enforces centralized default-deny permission handling for sensitive capabilities.
 * Binds decisions to requesting origin, supports persistent and session decisions,
 * and handles screen capture via setDisplayMediaRequestHandler.
 */

const crypto = require('crypto');
const { IPC_CHANNELS } = require('../shared/ipc-channels');

const SENSITIVE_PERMISSIONS = Object.freeze([
  'media',
  'geolocation',
  'notifications',
  'midi',
  'midiSysex',
  'pointerLock',
  'fullscreen',
  'openExternal',
  'clipboard-read',
  'clipboard-sanitized-write',
  'display-capture',
  'window-management',
  'local-fonts',
  'idle-detection'
]);

class PermissionManager {
  /**
   * @param {Object} options
   * @param {Function} options.sendToTrustedUI - Callback to broadcast events to Trusted UI
   */
  constructor({ sendToTrustedUI } = {}) {
    this.sendToTrustedUI = sendToTrustedUI || (() => {});
    // Origin -> Map<permission, boolean>
    this.persistedPermissions = new Map();
    // Pending requests: requestId -> { origin, permission, callback, timer }
    this.pendingRequests = new Map();
  }

  /**
   * Normalize origin from URL string
   */
  getOrigin(urlString) {
    try {
      const parsed = new URL(urlString);
      return parsed.origin;
    } catch {
      return null;
    }
  }

  /**
   * Attach permission handlers to an Electron session
   * @param {import('electron').Session} sess
   */
  attachToSession(sess) {
    if (!sess) return;

    // 1. Permission Request Handler (async requests)
    sess.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || (webContents ? webContents.getURL() : '');
      const origin = this.getOrigin(requestingUrl);

      // Deny if origin is missing or untrusted scheme
      if (!origin || (!origin.startsWith('https://') && !origin.startsWith('http://'))) {
        return callback(false);
      }

      // Check persisted decision
      if (this.persistedPermissions.has(origin)) {
        const sitePerms = this.persistedPermissions.get(origin);
        if (sitePerms.has(permission)) {
          return callback(sitePerms.get(permission));
        }
      }

      // Generate unique request ID
      const requestId = crypto.randomUUID();

      // Timeout handler: fail closed after 30 seconds
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          const req = this.pendingRequests.get(requestId);
          this.pendingRequests.delete(requestId);
          req.callback(false);
        }
      }, 30000);

      this.pendingRequests.set(requestId, {
        origin,
        permission,
        callback,
        timer
      });

      // Prompt user in Trusted UI
      this.sendToTrustedUI(IPC_CHANNELS.STATE_PERMISSION_PROMPT, {
        requestId,
        permission,
        origin
      });
    });

    // 2. Permission Check Handler (synchronous checks)
    sess.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (!requestingOrigin) return false;

      if (this.persistedPermissions.has(requestingOrigin)) {
        const sitePerms = this.persistedPermissions.get(requestingOrigin);
        if (sitePerms.has(permission)) {
          return sitePerms.get(permission);
        }
      }

      // Default deny
      return false;
    });

    // 3. Screen Capture / Display Media Request Handler
    if (typeof sess.setDisplayMediaRequestHandler === 'function') {
      sess.setDisplayMediaRequestHandler((request, callback) => {
        // Enforce fail-closed for display capture by default
        // Requires user explicit approval
        callback(null); // null denies stream capture
      });
    }
  }

  /**
   * Responds to a pending permission prompt
   * @param {string} requestId
   * @param {boolean} allow
   * @param {boolean} [persist=false]
   */
  respond(requestId, allow, persist = false) {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Permission request expired or invalid' } };
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);

    if (persist) {
      if (!this.persistedPermissions.has(pending.origin)) {
        this.persistedPermissions.set(pending.origin, new Map());
      }
      this.persistedPermissions.get(pending.origin).set(pending.permission, allow);
    }

    pending.callback(allow);
    return { ok: true };
  }

  /**
   * Lists permissions, optionally filtered by origin
   * @param {string} [origin]
   */
  list(origin) {
    const records = [];
    for (const [siteOrigin, perms] of this.persistedPermissions.entries()) {
      if (!origin || siteOrigin === origin) {
        for (const [perm, allowed] of perms.entries()) {
          records.push({
            id: `${siteOrigin}:${perm}`,
            origin: siteOrigin,
            permission: perm,
            allowed,
            timestamp: Date.now()
          });
        }
      }
    }
    return { ok: true, data: { permissions: records } };
  }

  /**
   * Revokes a previously granted or denied permission
   * @param {string} origin
   * @param {string} permission
   */
  revoke(origin, permission) {
    if (this.persistedPermissions.has(origin)) {
      const sitePerms = this.persistedPermissions.get(origin);
      sitePerms.delete(permission);
      if (sitePerms.size === 0) {
        this.persistedPermissions.delete(origin);
      }
    }
    return { ok: true };
  }
}

module.exports = { PermissionManager, SENSITIVE_PERMISSIONS };
