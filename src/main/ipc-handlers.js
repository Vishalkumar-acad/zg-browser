/**
 * Zero-Gravity Browser (zg-browser) - IPC Handlers Registry
 * Single Source of Truth: Blueprint v2.3 Section 6.2
 * 
 * Registers IPC handlers with 5-Step Frame-Aware Validation
 */

const { IPC_CHANNELS } = require('../shared/ipc-channels');
const { createValidatedHandler } = require('./ipc-validator');

/**
 * Registers all core IPC handlers on ipcMain
 * 
 * @param {Object} deps
 * @param {import('electron').IpcMain} deps.ipcMain
 * @param {import('./window-manager').WindowManager} deps.windowManager
 * @param {import('./permission-manager').PermissionManager} deps.permissionManager
 * @param {import('./tab-manager').TabManager} [deps.tabManager]
 * @param {import('./settings-manager').SettingsManager} [deps.settingsManager]
 * @param {import('./download-manager').DownloadManager} [deps.downloadManager]
 * @param {import('./history-manager').HistoryManager} [deps.historyManager]
 * @param {import('./privacy-manager').PrivacyManager} [deps.privacyManager]
 * @param {import('./storage-manager').MainStorageManager} [deps.storageManager]
 * @param {Function} [deps.sendToTrustedUI]
 */
function registerIpcHandlers({
  ipcMain,
  windowManager,
  permissionManager,
  tabManager,
  settingsManager,
  downloadManager,
  historyManager,
  privacyManager,
  storageManager,
  sendToTrustedUI
}) {
  const context = {
    getTrustedUIWebContents: () => windowManager.getTrustedUIWebContents(),
    resourceAuthorizer: async (channel, payload) => {
      // Step 4: Validate resource ownership
      if (payload && payload.tabId) {
        const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
        if (tabManager && !tabManager.hasTab(targetId)) {
          return { valid: false, error: `Tab ID not found: ${payload.tabId}` };
        }
      }
      return { valid: true };
    }
  };

  // --- UI Channels ---
  ipcMain.handle(
    IPC_CHANNELS.UI_TOGGLE_OVERLAY,
    createValidatedHandler(IPC_CHANNELS.UI_TOGGLE_OVERLAY, async (payload) => {
      return windowManager.toggleOverlay(payload.overlayId, payload.visible);
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.UI_TOGGLE_SCRATCHPAD,
    createValidatedHandler(IPC_CHANNELS.UI_TOGGLE_SCRATCHPAD, async (payload) => {
      const visible = payload ? payload.visible : undefined;
      const width = payload ? payload.width : undefined;
      return windowManager.toggleScratchpad(visible, width);
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.UI_TOGGLE_DISTRACTION_FREE,
    createValidatedHandler(IPC_CHANNELS.UI_TOGGLE_DISTRACTION_FREE, async (payload) => {
      if (settingsManager) {
        const current = settingsManager.getSettings();
        const nextState = (payload && typeof payload.enabled === 'boolean') ? payload.enabled : !current.distractionFree;
        const updated = settingsManager.updateSettings({ distractionFree: nextState });
        return { enabled: updated.distractionFree };
      }
      return { enabled: false };
    }, context)
  );

  // --- Permission Channels ---
  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_RESPOND,
    createValidatedHandler(IPC_CHANNELS.PERMISSION_RESPOND, async (payload) => {
      return permissionManager.respond(payload.requestId, payload.allow, payload.persist);
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_LIST,
    createValidatedHandler(IPC_CHANNELS.PERMISSION_LIST, async (payload) => {
      const origin = payload ? payload.origin : undefined;
      return permissionManager.list(origin);
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.PERMISSION_REVOKE,
    createValidatedHandler(IPC_CHANNELS.PERMISSION_REVOKE, async (payload) => {
      return permissionManager.revoke(payload.origin, payload.permission);
    }, context)
  );

  // --- Settings Channels ---
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    createValidatedHandler(IPC_CHANNELS.SETTINGS_GET, async () => {
      if (settingsManager) {
        return { settings: settingsManager.getSettings() };
      }
      return { settings: {} };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    createValidatedHandler(IPC_CHANNELS.SETTINGS_UPDATE, async (payload) => {
      if (settingsManager) {
        return { settings: settingsManager.updateSettings(payload.patch) };
      }
      return { settings: {} };
    }, context)
  );

  // --- Tab Lifecycle & Navigation ---
  ipcMain.handle(
    IPC_CHANNELS.TAB_CREATE,
    createValidatedHandler(IPC_CHANNELS.TAB_CREATE, async (payload) => {
      if (tabManager) {
        return tabManager.createTab(payload);
      }
      return { tabId: 'tab-' + Date.now() };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.TAB_CLOSE,
    createValidatedHandler(IPC_CHANNELS.TAB_CLOSE, async (payload) => {
      if (tabManager) {
        return tabManager.closeTab(payload.tabId);
      }
      return { ok: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.TAB_SWITCH,
    createValidatedHandler(IPC_CHANNELS.TAB_SWITCH, async (payload) => {
      if (tabManager) {
        return tabManager.switchTab(payload.tabId);
      }
      return { activeId: payload.tabId };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_GO,
    createValidatedHandler(IPC_CHANNELS.NAV_GO, async (payload) => {
      if (tabManager) {
        return tabManager.navigateTab(payload.tabId, payload.url);
      }
      return { status: 'navigating' };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_BACK,
    createValidatedHandler(IPC_CHANNELS.NAV_BACK, async (payload) => {
      if (tabManager) {
        return tabManager.goBack(payload.tabId);
      }
      return { canGoBack: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_FORWARD,
    createValidatedHandler(IPC_CHANNELS.NAV_FORWARD, async (payload) => {
      if (tabManager) {
        return tabManager.goForward(payload.tabId);
      }
      return { canGoForward: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_RELOAD,
    createValidatedHandler(IPC_CHANNELS.NAV_RELOAD, async (payload) => {
      if (tabManager) {
        return tabManager.reload(payload.tabId);
      }
      return { reloaded: true };
    }, context)
  );

  // --- Find in Page ---
  ipcMain.handle(
    IPC_CHANNELS.FIND_START,
    createValidatedHandler(IPC_CHANNELS.FIND_START, async (payload) => {
      const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
      const tab = tabManager ? tabManager.getTab(targetId) : null;
      if (!tab || !tab.view || !tab.view.webContents) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Tab view not found' } };
      }

      const wc = tab.view.webContents;
      if (typeof wc.findInPage === 'function') {
        const requestId = wc.findInPage(payload.text, {
          matchCase: Boolean(payload.matchCase),
          forward: true,
          findNext: false
        });

        if (!wc._hasFindListener && typeof wc.on === 'function') {
          wc._hasFindListener = true;
          wc.on('found-in-page', (_evt, result) => {
            if (sendToTrustedUI) {
              sendToTrustedUI(IPC_CHANNELS.STATE_FIND_RESULT, {
                tabId: targetId,
                activeMatchOrdinal: result.activeMatchOrdinal,
                matches: result.matches
              });
            }
          });
        }

        return { requestId };
      }
      return { requestId: 1 };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.FIND_NEXT,
    createValidatedHandler(IPC_CHANNELS.FIND_NEXT, async (payload) => {
      const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
      const tab = tabManager ? tabManager.getTab(targetId) : null;
      if (!tab || !tab.view || !tab.view.webContents) {
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Tab view not found' } };
      }

      const wc = tab.view.webContents;
      if (typeof wc.findInPage === 'function') {
        wc.findInPage(payload.text, {
          forward: payload.forward,
          findNext: true
        });
      }
      return { ok: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.FIND_STOP,
    createValidatedHandler(IPC_CHANNELS.FIND_STOP, async (payload) => {
      const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
      const tab = tabManager ? tabManager.getTab(targetId) : null;
      if (tab && tab.view && tab.view.webContents && typeof tab.view.webContents.stopFindInPage === 'function') {
        tab.view.webContents.stopFindInPage('clearSelection');
      }
      return { ok: true };
    }, context)
  );

  // --- Downloads ---
  ipcMain.handle(
    IPC_CHANNELS.DOWNLOAD_PAUSE,
    createValidatedHandler(IPC_CHANNELS.DOWNLOAD_PAUSE, async (payload) => {
      if (downloadManager) {
        return downloadManager.pause(payload.downloadId);
      }
      return { ok: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.DOWNLOAD_RESUME,
    createValidatedHandler(IPC_CHANNELS.DOWNLOAD_RESUME, async (payload) => {
      if (downloadManager) {
        return downloadManager.resume(payload.downloadId);
      }
      return { ok: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.DOWNLOAD_CANCEL,
    createValidatedHandler(IPC_CHANNELS.DOWNLOAD_CANCEL, async (payload) => {
      if (downloadManager) {
        return downloadManager.cancel(payload.downloadId);
      }
      return { ok: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER,
    createValidatedHandler(IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER, async (payload) => {
      if (downloadManager) {
        return downloadManager.openFolder(payload.downloadId);
      }
      return { ok: false };
    }, context)
  );

  // --- History ---
  ipcMain.handle(
    IPC_CHANNELS.HISTORY_LIST,
    createValidatedHandler(IPC_CHANNELS.HISTORY_LIST, async (payload) => {
      if (historyManager) {
        return historyManager.list(payload || {});
      }
      return { entries: [] };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.HISTORY_DELETE_ENTRY,
    createValidatedHandler(IPC_CHANNELS.HISTORY_DELETE_ENTRY, async (payload) => {
      if (historyManager) {
        return historyManager.deleteEntry(payload.entryId);
      }
      return { ok: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.HISTORY_CLEAR,
    createValidatedHandler(IPC_CHANNELS.HISTORY_CLEAR, async (payload) => {
      if (historyManager) {
        return historyManager.clear(payload ? payload.range : 'all');
      }
      return { ok: true };
    }, context)
  );

  // --- Privacy & Tracker Blocking ---
  ipcMain.handle(
    IPC_CHANNELS.PRIVACY_TOGGLE_TRACKER_BLOCKING,
    createValidatedHandler(IPC_CHANNELS.PRIVACY_TOGGLE_TRACKER_BLOCKING, async (payload) => {
      if (privacyManager) {
        return privacyManager.toggleTrackerBlocking(payload ? payload.enabled : undefined);
      }
      return { enabled: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.PRIVACY_ALLOWLIST_SITE,
    createValidatedHandler(IPC_CHANNELS.PRIVACY_ALLOWLIST_SITE, async (payload) => {
      if (privacyManager) {
        return privacyManager.allowlistSite(payload.domain, payload.allow);
      }
      return { ok: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.PRIVACY_CLEAR_SITE_DATA,
    createValidatedHandler(IPC_CHANNELS.PRIVACY_CLEAR_SITE_DATA, async (payload) => {
      if (privacyManager) {
        return privacyManager.clearSiteData(payload.origin);
      }
      return { ok: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.PRIVACY_GET_BLOCKED_STATS,
    createValidatedHandler(IPC_CHANNELS.PRIVACY_GET_BLOCKED_STATS, async (payload) => {
      const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
      if (privacyManager) {
        return privacyManager.getBlockedStats(targetId);
      }
      return { count: 0, domains: [] };
    }, context)
  );

  // --- Reader Mode (Strictly CSS-only) ---
  ipcMain.handle(
    IPC_CHANNELS.READER_TOGGLE,
    createValidatedHandler(IPC_CHANNELS.READER_TOGGLE, async (payload) => {
      const targetId = payload.tabId === 'active' && tabManager ? tabManager.activeTabId : payload.tabId;
      if (tabManager) {
        return tabManager.toggleReaderMode(targetId);
      }
      return { active: false };
    }, context)
  );

  // --- Storage Export & Import ---
  ipcMain.handle(
    IPC_CHANNELS.STORAGE_EXPORT,
    createValidatedHandler(IPC_CHANNELS.STORAGE_EXPORT, async (payload) => {
      if (storageManager) {
        const sampleContent = payload.format === 'json' ? '{"notes":[]}' : '# Notes\n';
        return storageManager.exportToFile(payload.format, sampleContent);
      }
      return { filePath: '/tmp/backup.' + payload.format };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.STORAGE_IMPORT,
    createValidatedHandler(IPC_CHANNELS.STORAGE_IMPORT, async (payload) => {
      if (storageManager && payload && payload.data) {
        const check = storageManager.validateImportPayload(payload.data);
        if (!check.valid) {
          return { ok: false, error: { code: 'INVALID_DATA', message: check.error } };
        }
      }
      return { importedCount: 0 };
    }, context)
  );
}

module.exports = { registerIpcHandlers };
