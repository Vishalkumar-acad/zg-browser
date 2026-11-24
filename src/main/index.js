/**
 * Zero-Gravity Browser (zg-browser) - Main Process Entry Point
 * Single Source of Truth: Blueprint v2.3 Section 1, 2, 3, 4 & 5
 */

const { app, protocol, ipcMain, session } = require('electron');
const path = require('path');

const { registerPrivilegedSchemes, setupProtocolHandler } = require('./protocol-handler');
const { WindowManager } = require('./window-manager');
const { SessionManager } = require('./session-manager');
const { PermissionManager } = require('./permission-manager');
const { NavigationController } = require('./navigation-controller');
const { SecurityController } = require('./security-controller');
const { ErrorHandler } = require('./error-handler');
const { TabManager } = require('./tab-manager');
const { DownloadManager } = require('./download-manager');
const { HistoryManager } = require('./history-manager');
const { SettingsManager } = require('./settings-manager');
const { PrivacyManager } = require('./privacy-manager');
const { MainStorageManager } = require('./storage-manager');
const { SecretsManager } = require('./secrets-manager');
const { GitHubService } = require('./github-service');
const { registerIpcHandlers } = require('./ipc-handlers');

// Register zg:// privileged scheme before app.whenReady()
registerPrivilegedSchemes(protocol);

// Single instance lock to prevent duplicate runaway processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let windowManager;
  let errorHandler;
  let permissionManager;
  let securityController;
  let sessionManager;
  let navigationController;
  let tabManager;
  let downloadManager;
  let historyManager;
  let settingsManager;
  let privacyManager;
  let storageManager;
  let secretsManager;
  let githubService;

  const preloadPath = path.join(__dirname, '../preload/index.js');
  const rendererDir = path.join(__dirname, '../renderer');
  const userDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : '/tmp';
  const configPath = path.join(userDataPath, 'settings.json');

  app.on('second-instance', () => {
    if (windowManager && windowManager.mainWindow) {
      if (windowManager.mainWindow.isMinimized()) windowManager.mainWindow.restore();
      windowManager.mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // 1. Setup custom protocol handler for zg://
    setupProtocolHandler(protocol, rendererDir);

    // 2. Initialize Core Subsystems
    windowManager = new WindowManager({ preloadPath });

    const sendToTrustedUI = (channel, data) => {
      const uiWebContents = windowManager.getTrustedUIWebContents();
      if (uiWebContents && !uiWebContents.isDestroyed()) {
        uiWebContents.send(channel, data);
      }
    };

    errorHandler = new ErrorHandler({ sendToTrustedUI });
    errorHandler.attachGlobalHandlers();

    sessionManager = new SessionManager(session);
    permissionManager = new PermissionManager({ sendToTrustedUI });
    securityController = new SecurityController({ sendToTrustedUI });
    navigationController = new NavigationController({
      onNewTabRequested: (url) => {
        if (tabManager) {
          tabManager.createTab({ url });
        }
      }
    });

    historyManager = new HistoryManager();
    settingsManager = new SettingsManager({ configPath });
    downloadManager = new DownloadManager({ sendToTrustedUI });
    privacyManager = new PrivacyManager({ sessionManager });
    storageManager = new MainStorageManager();
    secretsManager = new SecretsManager();
    githubService = new GitHubService({ secretsManager, settingsManager });

    // Attach session managers to persistent session
    const persistentSession = sessionManager.getPersistentSession();
    permissionManager.attachToSession(persistentSession);
    downloadManager.attachToSession(persistentSession);
    privacyManager.attachToSession(persistentSession);

    // Initialize Tab & Lifecycle Manager
    tabManager = new TabManager({
      windowManager,
      sessionManager,
      navigationController,
      historyManager,
      errorHandler,
      sendToTrustedUI
    });

    // Attach certificate fail-closed security handler
    securityController.attachCertificateErrorHandler(app, (wc) => {
      if (tabManager) {
        for (const tab of tabManager.tabs.values()) {
          if (tab.view && tab.view.webContents === wc) {
            return tab.id;
          }
        }
      }
      return 'main';
    });

    // 3. Register 5-Step Frame-Aware IPC Handlers
    registerIpcHandlers({
      ipcMain,
      windowManager,
      permissionManager,
      tabManager,
      settingsManager,
      downloadManager,
      historyManager,
      privacyManager,
      storageManager,
      secretsManager,
      githubService,
      sendToTrustedUI
    });

    // 4. Create Main Window & Layered UI
    windowManager.createWindow();

    // Attach navigation controls to Trusted UI webContents
    const uiWebContents = windowManager.getTrustedUIWebContents();
    if (uiWebContents) {
      navigationController.attachToTrustedUIWebContents(uiWebContents);
    }

    // 5. Create initial default tab
    await tabManager.createTab({ url: 'https://duckduckgo.com' });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
