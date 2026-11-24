/**
 * Zero-Gravity Browser (zg-browser) - Tab & Lifecycle Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.3 & 6.2
 * 
 * Owned exclusively by Main Process.
 * Manages tab creation, active switching, immediate WebContentsView destruction,
 * in-memory ephemeral isolation, and render-process-gone / unresponsive crash recovery.
 */

const { IPC_CHANNELS } = require('../shared/ipc-channels');
const { getUntrustedWebPreferences } = require('./security-controller');

let electron;
try {
  electron = require('electron');
} catch {
  electron = {};
}
const { WebContentsView } = electron;

class TabManager {
  /**
   * @param {Object} deps
   * @param {import('./window-manager').WindowManager} deps.windowManager
   * @param {import('./session-manager').SessionManager} deps.sessionManager
   * @param {import('./navigation-controller').NavigationController} deps.navigationController
   * @param {import('./history-manager').HistoryManager} [deps.historyManager]
   * @param {import('./error-handler').ErrorHandler} [deps.errorHandler]
   * @param {Function} [deps.sendToTrustedUI] - Callback to emit push events to Trusted UI
   */
  constructor({
    windowManager,
    sessionManager,
    navigationController,
    historyManager,
    errorHandler,
    sendToTrustedUI
  }) {
    this.windowManager = windowManager;
    this.sessionManager = sessionManager;
    this.navigationController = navigationController;
    this.historyManager = historyManager;
    this.errorHandler = errorHandler;
    this.sendToTrustedUI = sendToTrustedUI || (() => {});

    // tabId -> TabRecord
    this.tabs = new Map();
    this.activeTabId = null;
    this.tabCounter = 0;
  }

  /**
   * Generate sequential tab ID
   */
  _nextTabId() {
    this.tabCounter += 1;
    return `tab-${Date.now()}-${this.tabCounter}`;
  }

  /**
   * Checks if a tab exists
   * @param {string} tabId
   */
  hasTab(tabId) {
    return this.tabs.has(tabId);
  }

  /**
   * Get Tab Record
   * @param {string} tabId
   */
  getTab(tabId) {
    return this.tabs.get(tabId) || null;
  }

  /**
   * Create a new browser tab
   * @param {Object} [options]
   * @param {string} [options.url]
   * @param {boolean} [options.ephemeral] - Whether tab uses in-memory session partition
   */
  async createTab(options = {}) {
    const tabId = this._nextTabId();
    const isEphemeral = Boolean(options.ephemeral);

    // 1. Session resolution
    let sess = null;
    if (this.sessionManager) {
      sess = isEphemeral
        ? this.sessionManager.createEphemeralSession(tabId)
        : this.sessionManager.getPersistentSession();
    }

    // 2. WebContentsView creation (isolated, zero preload, untrusted)
    let view = null;
    if (typeof WebContentsView === 'function') {
      const webPreferences = {
        ...getUntrustedWebPreferences(),
        ...(sess ? { session: sess } : {})
      };
      view = new WebContentsView({ webPreferences });
    } else {
      // Mock view for unit test / headless environments
      view = {
        webContents: {
          id: tabId,
          loadURL: async () => {},
          goBack: () => {},
          goForward: () => {},
          reload: () => {},
          canGoBack: () => false,
          canGoForward: () => false,
          getURL: () => options.url || 'about:blank',
          getTitle: () => 'New Tab',
          isLoading: () => false,
          destroy: () => {},
          isDestroyed: () => false,
          on: () => {}
        },
        setBounds: () => {}
      };
    }

    const tabRecord = {
      id: tabId,
      url: options.url || 'about:blank',
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isEphemeral,
      isCrashed: false,
      readerActive: false,
      view,
      session: sess,
      createdAt: Date.now()
    };

    // 3. Attach Navigation Restrictions & Lifecycle Event Handlers
    this._attachWebContentsListeners(tabRecord);

    this.tabs.set(tabId, tabRecord);

    // 4. Switch to new tab
    await this.switchTab(tabId);

    // 5. Navigate if initial URL provided
    if (options.url && options.url !== 'about:blank') {
      await this.navigateTab(tabId, options.url);
    }

    this.broadcastState();
    return { tabId };
  }

  /**
   * Attach lifecycle listeners to tab's WebContents
   */
  _attachWebContentsListeners(tab) {
    const wc = tab.view.webContents;
    if (!wc || typeof wc.on !== 'function') return;

    if (this.navigationController && typeof this.navigationController.attachToWebsiteWebContents === 'function') {
      this.navigationController.attachToWebsiteWebContents(wc);
    }

    wc.on('did-start-loading', () => {
      tab.isLoading = true;
      this.broadcastState();
    });

    wc.on('did-stop-loading', () => {
      tab.isLoading = false;
      if (typeof wc.canGoBack === 'function') tab.canGoBack = wc.canGoBack();
      if (typeof wc.canGoForward === 'function') tab.canGoForward = wc.canGoForward();
      if (typeof wc.getURL === 'function') tab.url = wc.getURL();
      if (typeof wc.getTitle === 'function') tab.title = wc.getTitle() || tab.title;
      this.broadcastState();
    });

    wc.on('page-title-updated', (_event, title) => {
      tab.title = title || 'Untitled';
      this.broadcastState();
    });

    wc.on('did-navigate', (_event, url) => {
      tab.url = url;
      tab.isCrashed = false;
      if (typeof wc.canGoBack === 'function') tab.canGoBack = wc.canGoBack();
      if (typeof wc.canGoForward === 'function') tab.canGoForward = wc.canGoForward();

      // Record browsing history if not ephemeral
      if (!tab.isEphemeral && this.historyManager && typeof this.historyManager.addEntry === 'function') {
        this.historyManager.addEntry({
          url,
          title: tab.title,
          isEphemeral: false
        });
      }

      this.broadcastState();
    });

    wc.on('did-navigate-in-page', (_event, url) => {
      tab.url = url;
      if (typeof wc.canGoBack === 'function') tab.canGoBack = wc.canGoBack();
      if (typeof wc.canGoForward === 'function') tab.canGoForward = wc.canGoForward();
      this.broadcastState();
    });

    // Crash Recovery: render-process-gone
    wc.on('render-process-gone', (_event, details) => {
      tab.isCrashed = true;
      tab.isLoading = false;

      if (this.errorHandler) {
        this.errorHandler.notify(
          'RENDERER_CRASH',
          `Tab process terminated unexpectedly (${details && details.reason ? details.reason : 'killed'})`
        );
      }

      this.broadcastState();
    });

    // Hang Recovery: unresponsive
    wc.on('unresponsive', () => {
      if (this.errorHandler) {
        this.errorHandler.notify('TAB_UNRESPONSIVE', 'Web page has become unresponsive');
      }
    });
  }

  /**
   * Switch the active tab
   * @param {string} tabId
   */
  async switchTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Tab does not exist' } };
    }

    this.activeTabId = tabId;
    const tab = this.tabs.get(tabId);

    // Mount tab view via window manager
    if (this.windowManager && typeof this.windowManager.setActiveWebsiteView === 'function') {
      this.windowManager.setActiveWebsiteView(tab.view);
    }

    this.broadcastState();
    return { ok: true, data: { activeId: tabId } };
  }

  /**
   * Close a browser tab and immediately clean up resources
   * @param {string} tabId
   */
  async closeTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Tab does not exist' } };
    }

    const tab = this.tabs.get(tabId);

    // 1. Clean up ephemeral session if private tab
    if (tab.isEphemeral && this.sessionManager && typeof this.sessionManager.cleanupEphemeralSession === 'function') {
      await this.sessionManager.cleanupEphemeralSession(tabId);
    }

    // 2. Destroy WebContentsView immediately
    if (tab.view && tab.view.webContents && typeof tab.view.webContents.destroy === 'function') {
      if (!tab.view.webContents.isDestroyed()) {
        try {
          tab.view.webContents.destroy();
        } catch {
          // ignore cleanup errors on already closed webContents
        }
      }
    }

    // 3. Remove from tabs map
    this.tabs.delete(tabId);

    // 4. If closed tab was active, switch to next available tab
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        await this.switchTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        // Automatically create clean default tab if all tabs were closed
        await this.createTab();
      }
    } else {
      this.broadcastState();
    }

    return { ok: true };
  }

  /**
   * Navigate tab to a destination URL
   * @param {string} tabId
   * @param {string} url
   */
  async navigateTab(tabId, url) {
    const targetId = tabId === 'active' ? this.activeTabId : tabId;
    const tab = this.tabs.get(targetId);
    if (!tab) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Tab does not exist' } };
    }

    // Scheme validation via navigationController
    if (this.navigationController && !this.navigationController.isAllowedWebsiteNavigation(url)) {
      return { ok: false, error: { code: 'BLOCKED_SCHEME', message: 'Navigation to scheme blocked by security policy' } };
    }

    tab.isCrashed = false;
    tab.isLoading = true;

    try {
      if (tab.view && tab.view.webContents && typeof tab.view.webContents.loadURL === 'function') {
        await tab.view.webContents.loadURL(url);
      } else {
        tab.url = url;
      }
      return { ok: true, data: { status: 'navigating' } };
    } catch (err) {
      tab.isLoading = false;
      return { ok: false, error: { code: 'LOAD_ERROR', message: err.message || 'Failed to load URL' } };
    }
  }

  /**
   * Navigation controls: back, forward, reload
   */
  goBack(tabId) {
    const targetId = tabId === 'active' ? this.activeTabId : tabId;
    const tab = this.tabs.get(targetId);
    if (!tab) return { ok: false };
    if (tab.view && tab.view.webContents && typeof tab.view.webContents.goBack === 'function') {
      tab.view.webContents.goBack();
    }
    return { ok: true, data: { canGoBack: tab.canGoBack } };
  }

  goForward(tabId) {
    const targetId = tabId === 'active' ? this.activeTabId : tabId;
    const tab = this.tabs.get(targetId);
    if (!tab) return { ok: false };
    if (tab.view && tab.view.webContents && typeof tab.view.webContents.goForward === 'function') {
      tab.view.webContents.goForward();
    }
    return { ok: true, data: { canGoForward: tab.canGoForward } };
  }

  reload(tabId) {
    const targetId = tabId === 'active' ? this.activeTabId : tabId;
    const tab = this.tabs.get(targetId);
    if (!tab) return { ok: false };
    tab.isCrashed = false;
    if (tab.view && tab.view.webContents && typeof tab.view.webContents.reload === 'function') {
      tab.view.webContents.reload();
    }
    return { ok: true, data: { reloaded: true } };
  }

  /**
   * Generate sanitized, serializable state snapshot for Trusted UI
   */
  getTabSnapshot() {
    const snapshot = [];
    for (const tab of this.tabs.values()) {
      snapshot.push({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        isLoading: tab.isLoading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward,
        isEphemeral: tab.isEphemeral,
        isCrashed: tab.isCrashed,
        readerActive: tab.readerActive
      });
    }
    return snapshot;
  }

  /**
   * Broadcast state update snapshots to Trusted UI
   */
  broadcastState() {
    const tabs = this.getTabSnapshot();
    this.sendToTrustedUI(IPC_CHANNELS.STATE_TABS_UPDATED, {
      tabs,
      activeId: this.activeTabId
    });

    const activeTab = this.tabs.get(this.activeTabId);
    if (activeTab) {
      this.sendToTrustedUI(IPC_CHANNELS.STATE_NAV_UPDATED, {
        tabId: activeTab.id,
        canGoBack: activeTab.canGoBack,
        canGoForward: activeTab.canGoForward,
        url: activeTab.url,
        title: activeTab.title
      });
    }
  }
}

module.exports = { TabManager };
