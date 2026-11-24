/**
 * Zero-Gravity Browser (zg-browser) - Main Process Entry Point
 * Single Source of Truth: Blueprint v2.3 Section 1, 2, 3 & 4
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

  const preloadPath = path.join(__dirname, '../preload/index.js');
  const rendererDir = path.join(__dirname, '../renderer');

  app.on('second-instance', () => {
    if (windowManager && windowManager.mainWindow) {
      if (windowManager.mainWindow.isMinimized()) windowManager.mainWindow.restore();
      windowManager.mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
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
    navigationController = new NavigationController();

    // Attach permission handlers to persistent session
    permissionManager.attachToSession(sessionManager.getPersistentSession());

    // Attach certificate fail-closed security handler
    securityController.attachCertificateErrorHandler(app, () => 'main');

    // 3. Register 5-Step Frame-Aware IPC Handlers
    registerIpcHandlers({
      ipcMain,
      windowManager,
      permissionManager
    });

    // 4. Create Main Window & Layered UI
    const win = windowManager.createWindow();

    // Attach navigation controls to Trusted UI webContents
    const uiWebContents = windowManager.getTrustedUIWebContents();
    if (uiWebContents) {
      navigationController.attachToTrustedUIWebContents(uiWebContents);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
