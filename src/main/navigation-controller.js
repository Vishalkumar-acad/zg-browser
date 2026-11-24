/**
 * Zero-Gravity Browser (zg-browser) - Navigation Controller
 * Single Source of Truth: Blueprint v2.3 Section 4.4
 * 
 * Controls will-navigate and setWindowOpenHandler across all WebContents.
 * Prevents untrusted websites from navigating to zg://, blocks dangerous schemes,
 * and restricts popups.
 */

const { SCHEME, ALLOWED_SCHEMES, DANGEROUS_SCHEMES, TRUSTED_HOSTS } = require('../shared/constants');

class NavigationController {
  /**
   * @param {Object} options
   * @param {Function} [options.onNewTabRequested] - Callback when link requests new tab
   */
  constructor({ onNewTabRequested } = {}) {
    this.onNewTabRequested = onNewTabRequested || (() => {});
  }

  /**
   * Validates if a URL is permitted for untrusted website navigation
   * @param {string} urlString
   */
  isAllowedWebsiteNavigation(urlString) {
    if (typeof urlString !== 'string' || !urlString) return false;

    // Check for dangerous schemes
    for (const dangerous of DANGEROUS_SCHEMES) {
      if (urlString.toLowerCase().startsWith(dangerous)) {
        return false;
      }
    }

    try {
      const parsed = new URL(urlString);
      // Websites can only navigate to https: or http:
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Validates if a URL is permitted for Trusted UI WebContents
   * @param {string} urlString
   */
  isAllowedTrustedUINavigation(urlString) {
    if (typeof urlString !== 'string' || !urlString) return false;

    try {
      const parsed = new URL(urlString);
      if (parsed.protocol !== `${SCHEME}:`) return false;
      const host = parsed.hostname || parsed.host;
      return TRUSTED_HOSTS.includes(host);
    } catch {
      return false;
    }
  }

  /**
   * Attaches navigation restrictions to an untrusted website WebContents
   * @param {import('electron').WebContents} webContents
   */
  attachToWebsiteWebContents(webContents) {
    if (!webContents) return;

    // 1. will-navigate: intercept and enforce allowed schemes
    webContents.on('will-navigate', (event, navigationUrl) => {
      if (!this.isAllowedWebsiteNavigation(navigationUrl)) {
        event.preventDefault();
      }
    });

    // 2. will-redirect: intercept redirects
    webContents.on('will-redirect', (event, navigationUrl) => {
      if (!this.isAllowedWebsiteNavigation(navigationUrl)) {
        event.preventDefault();
      }
    });

    // 3. setWindowOpenHandler: block popups, route approved URLs to new tabs
    if (typeof webContents.setWindowOpenHandler === 'function') {
      webContents.setWindowOpenHandler(({ url }) => {
        if (this.isAllowedWebsiteNavigation(url)) {
          this.onNewTabRequested(url);
        }
        // Always deny native popup window creation
        return { action: 'deny' };
      });
    }
  }

  /**
   * Attaches navigation restrictions to Trusted UI WebContents
   * @param {import('electron').WebContents} webContents
   */
  attachToTrustedUIWebContents(webContents) {
    if (!webContents) return;

    // Trusted UI must NEVER navigate to external websites or arbitrary URLs
    webContents.on('will-navigate', (event, navigationUrl) => {
      if (!this.isAllowedTrustedUINavigation(navigationUrl)) {
        event.preventDefault();
      }
    });

    webContents.on('will-redirect', (event, navigationUrl) => {
      if (!this.isAllowedTrustedUINavigation(navigationUrl)) {
        event.preventDefault();
      }
    });

    if (typeof webContents.setWindowOpenHandler === 'function') {
      webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
      });
    }
  }
}

module.exports = { NavigationController };
