/**
 * Zero-Gravity Browser (zg-browser) - Window Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.1
 * 
 * Implements the Dual-Layer Composition Strategy:
 * - Bottom Layer: Untrusted Website WebContentsView
 * - Top Layer: Trusted UI WebContentsView (zg://ui/index.html)
 * - Docked Resize for Scratchpad Drawer (Cmd/Ctrl+Shift+E)
 */

let electron;
try {
  electron = require('electron');
} catch {
  electron = {};
}
const { BrowserWindow, WebContentsView } = electron;
const { DEFAULT_TRUSTED_URL, SCRATCHPAD_BOUNDS } = require('../shared/constants');
const { getTrustedUIWebPreferences, getUntrustedWebPreferences } = require('./security-controller');

/**
 * Pure function to calculate bounds for dual layers and scratchpad drawer
 * Enables rigorous unit testing.
 * 
 * @param {Object} params
 * @param {number} params.windowWidth
 * @param {number} params.windowHeight
 * @param {boolean} params.overlayOpen - Whether any floating overlay (omnibar, tabstrip, etc.) is visible
 * @param {boolean} params.scratchpadOpen - Whether scratchpad code drawer is docked open
 * @param {number} [params.scratchpadWidth] - Desired width of scratchpad drawer
 */
function calculateLayerBounds({
  windowWidth,
  windowHeight,
  overlayOpen,
  scratchpadOpen,
  scratchpadWidth = SCRATCHPAD_BOUNDS.DEFAULT_WIDTH
}) {
  const w = Math.max(0, windowWidth);
  const h = Math.max(0, windowHeight);

  // Clamped scratchpad drawer width
  const actualDrawerWidth = scratchpadOpen
    ? Math.max(SCRATCHPAD_BOUNDS.MIN_WIDTH, Math.min(scratchpadWidth, w - SCRATCHPAD_BOUNDS.MIN_WIDTH))
    : 0;

  // Website viewport bounds (shrinks horizontally when scratchpad is docked open)
  const websiteBounds = {
    x: 0,
    y: 0,
    width: Math.max(0, w - actualDrawerWidth),
    height: h
  };

  // Trusted UI bounds:
  // When an overlay is open or scratchpad is open, UI view covers necessary interactive area
  // When overlays are collapsed, UI view shrinks to a 4px top trigger zone (allowing clicks through to website)
  const uiBounds = {
    x: 0,
    y: 0,
    width: w,
    height: (overlayOpen || scratchpadOpen) ? h : 4
  };

  return {
    websiteBounds,
    uiBounds,
    actualDrawerWidth
  };
}

class WindowManager {
  /**
   * @param {Object} options
   * @param {string} options.preloadPath - Path to preload/index.js
   */
  constructor({ preloadPath }) {
    this.preloadPath = preloadPath;
    this.mainWindow = null;
    this.uiView = null;
    this.activeWebsiteView = null;
    this.activeOverlayId = null;
    this.scratchpadOpen = false;
    this.scratchpadWidth = SCRATCHPAD_BOUNDS.DEFAULT_WIDTH;
  }

  /**
   * Creates the main BrowserWindow and initializes Dual-Layer views
   */
  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Zero-Gravity Browser',
      backgroundColor: '#0a0a0a',
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 1. Create Top Layer: Trusted UI WebContentsView
    this.uiView = new WebContentsView({
      webPreferences: getTrustedUIWebPreferences(this.preloadPath)
    });

    // Add UI view to BaseWindow content view
    this.mainWindow.contentView.addChildView(this.uiView);
    this.uiView.webContents.loadURL(DEFAULT_TRUSTED_URL);

    // Initial bounds layout
    this.updateLayout();

    // Handle window resize events
    this.mainWindow.on('resize', () => {
      this.updateLayout();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.uiView = null;
      this.activeWebsiteView = null;
    });

    return this.mainWindow;
  }

  /**
   * Mounts or switches the active Website WebContentsView (Bottom Layer)
   * @param {WebContentsView} websiteView
   */
  setActiveWebsiteView(websiteView) {
    if (this.activeWebsiteView && this.mainWindow) {
      this.mainWindow.contentView.removeChildView(this.activeWebsiteView);
    }

    this.activeWebsiteView = websiteView;

    if (websiteView && this.mainWindow) {
      // Insert bottom layer below UI view
      // In Electron contentView: first added is bottom, later added is top
      // We ensure websiteView is below uiView by managing hierarchy
      this.mainWindow.contentView.removeChildView(this.uiView);
      this.mainWindow.contentView.addChildView(this.activeWebsiteView);
      this.mainWindow.contentView.addChildView(this.uiView);
    }

    this.updateLayout();
  }

  /**
   * Updates bounds for both layers
   */
  updateLayout() {
    if (!this.mainWindow) return;

    const [width, height] = this.mainWindow.getContentSize();
    const isOverlayOpen = Boolean(this.activeOverlayId);

    const { websiteBounds, uiBounds } = calculateLayerBounds({
      windowWidth: width,
      windowHeight: height,
      overlayOpen: isOverlayOpen,
      scratchpadOpen: this.scratchpadOpen,
      scratchpadWidth: this.scratchpadWidth
    });

    if (this.activeWebsiteView) {
      this.activeWebsiteView.setBounds(websiteBounds);
    }

    if (this.uiView) {
      this.uiView.setBounds(uiBounds);
    }
  }

  /**
   * Toggles an overlay (e.g. omnibar, tabstrip, command-palette)
   * @param {string} overlayId
   * @param {boolean} visible
   */
  toggleOverlay(overlayId, visible) {
    if (visible) {
      this.activeOverlayId = overlayId;
    } else if (this.activeOverlayId === overlayId) {
      this.activeOverlayId = null;
    }
    this.updateLayout();

    // Focus management: if overlay opened, focus UI view; if closed, focus website view
    if (visible && this.uiView) {
      this.uiView.webContents.focus();
    } else if (!visible && this.activeWebsiteView) {
      this.activeWebsiteView.webContents.focus();
    }

    return { visible: Boolean(this.activeOverlayId) };
  }

  /**
   * Toggles the docked Scratchpad drawer
   * @param {boolean} [visible]
   * @param {number} [width]
   */
  toggleScratchpad(visible, width) {
    if (typeof visible === 'boolean') {
      this.scratchpadOpen = visible;
    } else {
      this.scratchpadOpen = !this.scratchpadOpen;
    }

    if (typeof width === 'number') {
      this.scratchpadWidth = width;
    }

    this.updateLayout();
    return { visible: this.scratchpadOpen };
  }

  /**
   * Returns the Trusted UI WebContents
   */
  getTrustedUIWebContents() {
    return this.uiView ? this.uiView.webContents : null;
  }
}

module.exports = { WindowManager, calculateLayerBounds };
