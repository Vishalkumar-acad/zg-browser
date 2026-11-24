/**
 * Zero-Gravity Browser (zg-browser) - Privacy Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.5
 * 
 * Enforces network-level tracker and ad blocking via webRequest.onBeforeRequest.
 * Schema-validated blocklist.json, user allowlist precedence, and per-tab blocked metrics.
 */

const fs = require('fs');
const path = require('path');

class PrivacyManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.blocklistPath] - Path to blocklist.json
   * @param {import('./session-manager').SessionManager} [options.sessionManager]
   */
  constructor({ blocklistPath, sessionManager } = {}) {
    this.blocklistPath = blocklistPath || path.join(__dirname, 'blocklist.json');
    this.sessionManager = sessionManager;
    this.enabled = true;

    // Set of blocked domain suffixes
    this.blockedDomains = new Set();
    // Set of user-allowlisted domains (precedence over blocklist)
    this.allowlistedDomains = new Set();
    // tabId -> { count: number, domains: Set<string> }
    this.tabStats = new Map();

    this.loadBlocklist();
  }

  /**
   * Validates blocklist JSON schema and loads domain rules
   */
  loadBlocklist() {
    try {
      if (fs.existsSync(this.blocklistPath)) {
        const raw = fs.readFileSync(this.blocklistPath, 'utf8');
        const parsed = JSON.parse(raw);

        // Schema validation
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.version === 'string' &&
          Array.isArray(parsed.domains)
        ) {
          this.blockedDomains.clear();
          for (const d of parsed.domains) {
            if (typeof d === 'string' && d.trim()) {
              this.blockedDomains.add(d.trim().toLowerCase());
            }
          }
        }
      }
    } catch {
      // Retain existing rules or fail closed gracefully
    }
  }

  /**
   * Pure domain matching helper. Checks if a hostname matches a blocked domain or parent.
   * e.g. "adservice.google.com" matches "google.com" if "google.com" in blocklist.
   * 
   * @param {string} hostname
   */
  matchesBlocklist(hostname) {
    if (!hostname) return false;
    const lowerHost = hostname.toLowerCase();

    if (this.blockedDomains.has(lowerHost)) {
      return true;
    }

    // Check parent domains
    const parts = lowerHost.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (this.blockedDomains.has(parentDomain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates if a network request should be blocked.
   * Deterministic precedence: User Allowlist > Blocklist > Default Allow.
   * 
   * @param {string} requestUrl
   * @param {string} [siteContextDomain]
   */
  shouldBlockRequest(requestUrl, siteContextDomain) {
    if (!this.enabled) return false;
    if (!requestUrl || typeof requestUrl !== 'string') return false;

    // Never block internal zg:// chrome assets
    if (requestUrl.startsWith('zg://')) return false;

    let reqHost;
    try {
      const parsed = new URL(requestUrl);
      reqHost = parsed.hostname;
    } catch {
      return false;
    }

    // 1. User Allowlist Precedence
    if (siteContextDomain && this.allowlistedDomains.has(siteContextDomain.toLowerCase())) {
      return false;
    }
    if (this.allowlistedDomains.has(reqHost.toLowerCase())) {
      return false;
    }

    // 2. Blocklist Matching
    return this.matchesBlocklist(reqHost);
  }

  /**
   * Attaches request interception filter to an Electron session
   * @param {import('electron').Session} sess
   */
  attachToSession(sess) {
    if (!sess || !sess.webRequest) return;

    sess.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (!this.enabled) {
        return callback({ cancel: false });
      }

      let siteContext = null;
      if (details.initiator) {
        try {
          siteContext = new URL(details.initiator).hostname;
        } catch {}
      }

      const block = this.shouldBlockRequest(details.url, siteContext);

      if (block) {
        // Track blocked stats for requesting tab
        const tabId = details.webContentsId ? String(details.webContentsId) : 'unknown';
        if (!this.tabStats.has(tabId)) {
          this.tabStats.set(tabId, { count: 0, domains: new Set() });
        }

        const stats = this.tabStats.get(tabId);
        stats.count += 1;
        try {
          stats.domains.add(new URL(details.url).hostname);
        } catch {}

        return callback({ cancel: true });
      }

      callback({ cancel: false });
    });
  }

  /**
   * Toggle tracker blocking globally
   * @param {boolean} [enabled]
   */
  toggleTrackerBlocking(enabled) {
    if (typeof enabled === 'boolean') {
      this.enabled = enabled;
    } else {
      this.enabled = !this.enabled;
    }
    return { enabled: this.enabled };
  }

  /**
   * Add or remove a site domain from user allowlist
   * @param {string} domain
   * @param {boolean} allow
   */
  allowlistSite(domain, allow) {
    if (!domain || typeof domain !== 'string') {
      return { ok: false, error: 'Invalid domain' };
    }

    const clean = domain.trim().toLowerCase();
    if (allow) {
      this.allowlistedDomains.add(clean);
    } else {
      this.allowlistedDomains.delete(clean);
    }
    return { ok: true };
  }

  /**
   * Returns list of currently user-allowlisted domains
   * @returns {string[]}
   */
  getAllowlist() {
    return Array.from(this.allowlistedDomains);
  }

  /**
   * Returns blocked tracking statistics for a specific tab
   * @param {string} tabId
   */
  getBlockedStats(tabId) {
    const stats = this.tabStats.get(tabId);
    if (!stats) {
      return { count: 0, domains: [] };
    }
    return {
      count: stats.count,
      domains: Array.from(stats.domains)
    };
  }

  /**
   * Clear storage data for an origin
   * @param {string} origin
   */
  async clearSiteData(origin) {
    if (this.sessionManager && typeof this.sessionManager.clearSiteData === 'function') {
      await this.sessionManager.clearSiteData(origin);
      return { ok: true };
    }
    return { ok: false };
  }
}

module.exports = { PrivacyManager };
