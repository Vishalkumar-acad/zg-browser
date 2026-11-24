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
const { BrowserWindow, WebContentsView, Menu } = electron;
const { DEFAULT_TRUSTED_URL, SCRATCHPAD_BOUNDS, TOP_BAR_HEIGHT } = require('../shared/constants');
const { getTrustedUIWebPreferences, getUntrustedWebPreferences } = require('./security-controller');

/**
 * Pure function to calculate bounds for dual layers and scratchpad drawer
 * Enables rigorous unit testing.
 * 
 * @param {Object} params
 * @param {number} params.windowWidth
 * @param {number} params.windowHeight
 * @param {boolean} params.overlayOpen - Whether any floating overlay (omnibar, settings, etc.) is visible
 * @param {boolean} params.scratchpadOpen - Whether scratchpad code drawer is docked open
 * @param {number} [params.scratchpadWidth] - Desired width of scratchpad drawer
 * @param {boolean} [params.distractionFree] - Whether distraction-free mode is enabled
 */
function calculateLayerBounds({
  windowWidth,
  windowHeight,
  overlayOpen,
  scratchpadOpen,
  scratchpadWidth = SCRATCHPAD_BOUNDS.DEFAULT_WIDTH,
  distractionFree = false
}) {
  const w = Math.max(0, windowWidth);
  const h = Math.max(0, windowHeight);

  // In standard browsing mode, the top chrome is persistent (TOP_BAR_HEIGHT = 74)
  // In distraction-free mode without active overlays, it collapses to 4px
  const topBarH = distractionFree ? (overlayOpen ? TOP_BAR_HEIGHT : 4) : TOP_BAR_HEIGHT;

  // Clamped scratchpad drawer width
  const actualDrawerWidth = scratchpadOpen
    ? Math.max(SCRATCHPAD_BOUNDS.MIN_WIDTH, Math.min(scratchpadWidth, w - SCRATCHPAD_BOUNDS.MIN_WIDTH))
    : 0;

  // Website viewport bounds (starts below top bar when not in distraction-free mode)
  const websiteBounds = {
    x: 0,
    y: distractionFree ? 0 : topBarH,
    width: Math.max(0, w - actualDrawerWidth),
    height: Math.max(0, h - (distractionFree ? 0 : topBarH))
  };

  // Trusted UI bounds:
  // When an overlay or scratchpad is open: covers full window
  // When overlays are collapsed: covers persistent top bar (or 4px strip in distraction-free mode)
  const uiBounds = {
    x: 0,
    y: 0,
    width: w,
    height: (overlayOpen || scratchpadOpen) ? h : topBarH
  };

  return {
    websiteBounds,
    uiBounds,
    actualDrawerWidth,
    topBarHeight: topBarH
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
    this.distractionFree = false;
  }

  /**
   * Creates the main BrowserWindow and initializes Dual-Layer views
   */
  createWindow() {
    // Suppress native File Edit View Window Help application menu
    if (Menu && typeof Menu.setApplicationMenu === 'function') {
      Menu.setApplicationMenu(null);
    }

    this.mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Zero-Gravity Browser',
      backgroundColor: '#0a0a0a',
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    if (typeof this.mainWindow.setMenuBarVisibility === 'function') {
      this.mainWindow.setMenuBarVisibility(false);
    }

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
      scratchpadWidth: this.scratchpadWidth,
      distractionFree: this.distractionFree
    });

    if (this.activeWebsiteView) {
      this.activeWebsiteView.setBounds(websiteBounds);
    }

    if (this.uiView) {
      this.uiView.setBounds(uiBounds);
    }
  }

  /**
   * Sets distraction-free UI mode
   * @param {boolean} enabled
   */
  setDistractionFree(enabled) {
    this.distractionFree = Boolean(enabled);
    this.updateLayout();
    return { distractionFree: this.distractionFree };
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
