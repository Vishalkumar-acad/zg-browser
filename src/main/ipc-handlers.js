/**
 * Zero-Gravity Browser (zg-browser) - IPC Handlers Registry
 * Single Source of Truth: Blueprint v2.3 Section 6.2
 * 
 * Registers IPC handlers with 5-Step Frame-Aware Validation
 */

const { IPC_CHANNELS } = require('../shared/ipc-channels');
const { createValidatedHandler } = require('./ipc-validator');
const { DEFAULT_SETTINGS } = require('../shared/constants');

/**
 * Registers all core IPC handlers on ipcMain
 * 
 * @param {Object} deps
 * @param {import('electron').IpcMain} deps.ipcMain
 * @param {import('./window-manager').WindowManager} deps.windowManager
 * @param {import('./permission-manager').PermissionManager} deps.permissionManager
 * @param {Object} [deps.tabManager]
 * @param {Object} [deps.settingsManager]
 */
function registerIpcHandlers({ ipcMain, windowManager, permissionManager, tabManager, settingsManager }) {
  const context = {
    getTrustedUIWebContents: () => windowManager.getTrustedUIWebContents(),
    resourceAuthorizer: async (channel, payload) => {
      // Step 4: Validate resource ownership if tabManager is present
      if (tabManager && payload && payload.tabId) {
        if (!tabManager.hasTab(payload.tabId)) {
          return { valid: false, error: `Tab ID not found: ${payload.tabId}` };
        }
      }
      return { valid: true };
    }
  };

  // In-memory fallback settings if settingsManager is not yet mounted
  let currentSettings = { ...DEFAULT_SETTINGS };

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
      if (payload && typeof payload.enabled === 'boolean') {
        currentSettings.distractionFree = payload.enabled;
      } else {
        currentSettings.distractionFree = !currentSettings.distractionFree;
      }
      return { enabled: currentSettings.distractionFree };
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
      if (settingsManager && typeof settingsManager.getSettings === 'function') {
        return { settings: await settingsManager.getSettings() };
      }
      return { settings: currentSettings };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    createValidatedHandler(IPC_CHANNELS.SETTINGS_UPDATE, async (payload) => {
      if (settingsManager && typeof settingsManager.updateSettings === 'function') {
        return { settings: await settingsManager.updateSettings(payload.patch) };
      }
      currentSettings = { ...currentSettings, ...payload.patch };
      return { settings: currentSettings };
    }, context)
  );

  // --- Tab Lifecycle & Navigation (Core Phase 1 / Phase 2 integration) ---
  ipcMain.handle(
    IPC_CHANNELS.TAB_CREATE,
    createValidatedHandler(IPC_CHANNELS.TAB_CREATE, async (payload) => {
      if (tabManager && typeof tabManager.createTab === 'function') {
        return tabManager.createTab(payload);
      }
      return { tabId: 'tab-' + Date.now() };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.TAB_CLOSE,
    createValidatedHandler(IPC_CHANNELS.TAB_CLOSE, async (payload) => {
      if (tabManager && typeof tabManager.closeTab === 'function') {
        return tabManager.closeTab(payload.tabId);
      }
      return { ok: true };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.TAB_SWITCH,
    createValidatedHandler(IPC_CHANNELS.TAB_SWITCH, async (payload) => {
      if (tabManager && typeof tabManager.switchTab === 'function') {
        return tabManager.switchTab(payload.tabId);
      }
      return { activeId: payload.tabId };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_GO,
    createValidatedHandler(IPC_CHANNELS.NAV_GO, async (payload) => {
      if (tabManager && typeof tabManager.navigateTab === 'function') {
        return tabManager.navigateTab(payload.tabId, payload.url);
      }
      return { status: 'navigating' };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_BACK,
    createValidatedHandler(IPC_CHANNELS.NAV_BACK, async (payload) => {
      if (tabManager && typeof tabManager.goBack === 'function') {
        return tabManager.goBack(payload.tabId);
      }
      return { canGoBack: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_FORWARD,
    createValidatedHandler(IPC_CHANNELS.NAV_FORWARD, async (payload) => {
      if (tabManager && typeof tabManager.goForward === 'function') {
        return tabManager.goForward(payload.tabId);
      }
      return { canGoForward: false };
    }, context)
  );

  ipcMain.handle(
    IPC_CHANNELS.NAV_RELOAD,
    createValidatedHandler(IPC_CHANNELS.NAV_RELOAD, async (payload) => {
      if (tabManager && typeof tabManager.reload === 'function') {
        return tabManager.reload(payload.tabId);
      }
      return { reloaded: true };
    }, context)
  );
}

module.exports = { registerIpcHandlers };
