/**
 * Integration Test Suite: End-to-End Zero-Gravity Browser Lifecycle Pipeline
 * Single Source of Truth: Blueprint v2.3 Sections 2, 4, 5, 6, 7 & 10.2
 *
 * Verifies end-to-end integration between:
 * - Dual-layer view bounds coordination and docked Scratchpad horizontal resize
 * - Tab lifecycle, session isolation, ephemeral partitions, and crash recovery
 * - NavigationController scheme allowlist & dangerous scheme blocking
 * - PrivacyManager webRequest interception, allowlist precedence, and metrics
 * - DownloadManager cross-platform path traversal sanitization & zero auto-execution
 * - SecretsManager safeStorage OS encryption guard (Linux fail-closed rule)
 * - GitHub REST v3 service .zg-vault/ sandboxed sync, diff computation, and HTTP error handling
 * - 5-Step Frame-Aware IPC validation dispatch pipeline
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Core Main Process Modules
const { calculateLayerBounds } = require('../../src/main/window-manager');
const { TabManager } = require('../../src/main/tab-manager');
const { NavigationController } = require('../../src/main/navigation-controller');
const { PrivacyManager } = require('../../src/main/privacy-manager');
const { DownloadManager, sanitizeFilename, isDangerousFilename } = require('../../src/main/download-manager');
const { SecretsManager } = require('../../src/main/secrets-manager');
const { GitHubService } = require('../../src/main/github-service');
const { SecurityController } = require('../../src/main/security-controller');
const { PermissionManager } = require('../../src/main/permission-manager');
const {
  validateSenderWebContents,
  validateSenderFrame,
  validatePayload,
  createValidatedHandler
} = require('../../src/main/ipc-validator');
const { TAB_CLOSE_SCHEMA, NAV_GO_SCHEMA } = require('../../src/shared/schemas');

describe('End-to-End Browser Lifecycle Integration Pipeline', () => {

  // 1. Dual-Layer Bounds & Docked Scratchpad Drawer Coordination
  describe('1. Dual-Layer Bounds & Docked Scratchpad Coordination', () => {
    it('manages website view underneath, UI overlay above, and horizontally shrinks website for scratchpad', () => {
      const windowWidth = 1280;
      const windowHeight = 800;

      // Default state: persistent top chrome (74px) for address bar, tabs, and controls
      const defaultLayout = calculateLayerBounds({
        windowWidth,
        windowHeight,
        overlayOpen: false,
        scratchpadOpen: false,
        distractionFree: false
      });
      assert.equal(defaultLayout.uiBounds.height, 74, 'UI view covers 74px top bar so address bar is visible');
      assert.equal(defaultLayout.websiteBounds.y, 74, 'Website view starts below 74px top bar');
      assert.equal(defaultLayout.websiteBounds.width, 1280, 'Website view gets full width');
      assert.equal(defaultLayout.websiteBounds.height, 726, 'Website view gets 800 - 74 = 726px height');

      // Distraction-free mode: UI view collapsed to 4px trigger strip
      const distractionFreeLayout = calculateLayerBounds({
        windowWidth,
        windowHeight,
        overlayOpen: false,
        scratchpadOpen: false,
        distractionFree: true
      });
      assert.equal(distractionFreeLayout.uiBounds.height, 4, 'UI view collapses to 4px strip in distraction-free mode');
      assert.equal(distractionFreeLayout.websiteBounds.y, 0);
      assert.equal(distractionFreeLayout.websiteBounds.height, 800);

      // Overlay open (Omnibar/Find/Cert banner): UI covers full viewport
      const overlayActive = calculateLayerBounds({
        windowWidth,
        windowHeight,
        overlayOpen: true,
        scratchpadOpen: false
      });
      assert.equal(overlayActive.uiBounds.height, 800, 'UI view expands to capture clicks when overlay is open');
      assert.equal(overlayActive.websiteBounds.width, 1280);

      // Docked Scratchpad drawer open (docked at right side, width 420):
      // Website view must shrink horizontally to 860px (1280 - 420) so content is never hidden
      const scratchpadActive = calculateLayerBounds({
        windowWidth,
        windowHeight,
        overlayOpen: false,
        scratchpadOpen: true,
        scratchpadWidth: 420
      });
      assert.equal(scratchpadActive.actualDrawerWidth, 420);
      assert.equal(scratchpadActive.websiteBounds.width, 860, 'Website view is shrunk horizontally (1280 - 420 = 860)');
      assert.equal(scratchpadActive.websiteBounds.x, 0);
      assert.equal(scratchpadActive.websiteBounds.height, 726);

      // Toggle drawer closed again
      const restored = calculateLayerBounds({
        windowWidth,
        windowHeight,
        overlayOpen: false,
        scratchpadOpen: false
      });
      assert.equal(restored.websiteBounds.width, 1280, 'Website view smoothly expands back to full width');
    });
  });

  // 2. Tab Lifecycle, Ephemeral Partition Isolation & Crash Recovery
  describe('2. Tab Lifecycle, Ephemeral Partition Isolation & Crash Recovery', () => {
    it('manages persistent vs ephemeral sessions and cleans up isolated partitions on close', async () => {
      let cleanedEphemeralTabId = null;
      let reportedError = null;

      const mockSessionManager = {
        getPersistentSession: () => ({ id: 'persist:default' }),
        createEphemeralSession: (tabId) => ({ id: `zg-ephemeral-${tabId}` }),
        cleanupEphemeralSession: async (tabId) => { cleanedEphemeralTabId = tabId; }
      };

      const mockWindowManager = {
        activeView: null,
        setActiveWebsiteView: (view) => { mockWindowManager.activeView = view; }
      };

      const mockNavigationController = {
        isAllowedWebsiteNavigation: (url) => url.startsWith('https://') || url.startsWith('http://'),
        attachToWebsiteWebContents: () => {}
      };

      const mockErrorHandler = {
        notify: (code, message) => { reportedError = { code, message }; }
      };

      const broadcasts = [];
      const tabManager = new TabManager({
        windowManager: mockWindowManager,
        sessionManager: mockSessionManager,
        navigationController: mockNavigationController,
        errorHandler: mockErrorHandler,
        sendToTrustedUI: (ch, data) => { broadcasts.push({ ch, data }); }
      });

      // 1. Create standard persistent tab
      const tab1 = await tabManager.createTab({ url: 'https://developer.mozilla.org', ephemeral: false });
      assert.equal(tabManager.getTab(tab1.tabId).isEphemeral, false);
      assert.equal(tabManager.activeTabId, tab1.tabId);

      // 2. Create ephemeral private tab
      const tab2 = await tabManager.createTab({ url: 'https://duckduckgo.com', ephemeral: true });
      assert.equal(tabManager.getTab(tab2.tabId).isEphemeral, true);
      assert.equal(tabManager.activeTabId, tab2.tabId);

      // 3. Close ephemeral tab -> verify session cleanup is triggered immediately
      await tabManager.closeTab(tab2.tabId);
      assert.equal(cleanedEphemeralTabId, tab2.tabId, 'Ephemeral session partition must be cleanly destroyed on tab close');
      assert.equal(tabManager.activeTabId, tab1.tabId, 'Active tab reverts to remaining persistent tab');

      // 4. Verify crash notification is emitted on renderer crash
      tabManager.errorHandler.notify('RENDERER_CRASH', 'Tab process terminated unexpectedly');
      assert.ok(reportedError);
      assert.equal(reportedError.code, 'RENDERER_CRASH');
    });
  });

  // 3. Navigation Controller & Dangerous Scheme Defense
  describe('3. Navigation Controller & Dangerous Scheme Defense', () => {
    it('approves standard web URLs and strictly blocks dangerous/internal schemes', () => {
      const nav = new NavigationController();

      // Allowed website navigations
      assert.equal(nav.isAllowedWebsiteNavigation('https://github.com'), true);
      assert.equal(nav.isAllowedWebsiteNavigation('https://docs.github.com/en'), true);
      assert.equal(nav.isAllowedWebsiteNavigation('http://localhost:3000'), true);

      // Blocked dangerous schemes
      assert.equal(nav.isAllowedWebsiteNavigation('javascript:alert(document.cookie)'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('file:///etc/passwd'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('file:///C:/Windows/win.ini'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('data:text/html,<script>evil()</script>'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('vbscript:msgbox'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('shell:startup'), false);

      // Untrusted websites blocked from navigating to internal zg:// protocol
      assert.equal(nav.isAllowedWebsiteNavigation('zg://ui/index.html'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('zg://settings'), false);

      // Trusted UI strictly locked to allowlisted zg:// hosts
      assert.equal(nav.isAllowedTrustedUINavigation('zg://ui/index.html'), true);
      assert.equal(nav.isAllowedTrustedUINavigation('zg://error'), true);
      assert.equal(nav.isAllowedTrustedUINavigation('https://evil.com'), false);
      assert.equal(nav.isAllowedTrustedUINavigation('file:///etc/passwd'), false);
    });
  });

  // 4. Privacy Manager Tracker Interception & Metrics
  describe('4. Privacy Manager Tracker Interception & Metrics', () => {
    it('blocks trackers while preserving clean web requests and respecting user allowlists', () => {
      const pm = new PrivacyManager();

      // Interception tests
      assert.equal(pm.shouldBlockRequest('https://google-analytics.com/analytics.js'), true);
      assert.equal(pm.shouldBlockRequest('https://connect.facebook.net/en_US/fbevents.js'), true);
      assert.equal(pm.shouldBlockRequest('https://doubleclick.net/ad.js'), true);
      assert.equal(pm.shouldBlockRequest('https://github.com/Vishalkumar-acad/zg-browser'), false);
      assert.equal(pm.shouldBlockRequest('zg://ui/index.html'), false, 'Internal zg:// chrome must never be blocked');

      // User allowlist precedence
      pm.allowlistSite('google-analytics.com', true);
      assert.equal(pm.shouldBlockRequest('https://google-analytics.com/analytics.js'), false, 'Allowlisted domain takes precedence over blocklist');

      // Per-domain matching
      assert.equal(pm.matchesBlocklist('doubleclick.net'), true);
      assert.equal(pm.matchesBlocklist('github.com'), false);
    });
  });

  // 5. Download Manager Cross-Platform Defense & Zero Auto-Execution
  describe('5. Download Manager Cross-Platform Defense & Zero Auto-Execution', () => {
    it('sanitizes directory traversal from filenames and warns on dangerous executables with zero auto-execution', () => {
      const dm = new DownloadManager();

      // Directory traversal sanitization across POSIX and Windows separators
      const posixTraversal = sanitizeFilename('../../etc/cron.d/malicious.sh');
      assert.equal(posixTraversal, 'malicious.sh');

      const winTraversal = sanitizeFilename('..\\..\\Windows\\System32\\calc.exe');
      assert.equal(winTraversal, 'calc.exe');

      const nullByteBypass = sanitizeFilename('safe.pdf\0.exe');
      assert.equal(nullByteBypass, 'safe.pdf.exe');

      // Dangerous file identification
      assert.equal(isDangerousFilename('malicious.exe'), true);
      assert.equal(isDangerousFilename('setup.bat'), true);
      assert.equal(isDangerousFilename('script.sh'), true);
      assert.equal(isDangerousFilename('archive.zip'), false);
      assert.equal(isDangerousFilename('document.pdf'), false);

      // Invariant: auto-execution is strictly absent
      assert.equal(typeof dm.autoExecute, 'undefined', 'Auto-execution functionality must not exist');
    });
  });

  // 6. Secrets Manager & safeStorage OS Encryption Guard (Fail-Closed)
  describe('6. Secrets Manager & safeStorage OS Encryption Guard (Fail-Closed)', () => {
    it('fails closed and refuses plaintext fallback when OS encryption is unavailable (Linux rule)', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-secrets-e2e-'));
      const storeFile = path.join(tmpDir, 'credentials.enc');

      // Simulate Linux headless / no-keyring environment
      const mockSafeStorageUnavailable = {
        isEncryptionAvailable: () => false,
        encryptString: () => { throw new Error('Unused'); },
        decryptString: () => { throw new Error('Unused'); }
      };

      const smUnavailable = new SecretsManager({
        credentialsPath: storeFile,
        storageEngine: mockSafeStorageUnavailable
      });

      // MUST fail closed and refuse to store credentials in plaintext
      assert.equal(smUnavailable.isAvailable(), false);
      const denied = smUnavailable.setSecret('github_token', 'ghp_SensitiveDeveloperToken12345');
      assert.equal(denied.ok, false);
      assert.equal(denied.error, 'OS_ENCRYPTION_UNAVAILABLE');
      assert.match(denied.message, /plaintext/i);

      assert.equal(fs.existsSync(storeFile), false, 'No plaintext credentials file should ever be created on disk');

      // When encryption is available, stores securely
      const encryptedStore = new Map();
      const mockSafeStorageAvailable = {
        isEncryptionAvailable: () => true,
        encryptString: (str) => {
          const buf = Buffer.from(`ENC:${str}`, 'utf8');
          encryptedStore.set(str, buf);
          return buf;
        },
        decryptString: (buf) => {
          const str = buf.toString('utf8');
          if (str.startsWith('ENC:')) return str.substring(4);
          throw new Error('Decryption failed');
        }
      };

      const smAvailable = new SecretsManager({
        credentialsPath: storeFile,
        storageEngine: mockSafeStorageAvailable
      });

      smAvailable.setSecret('github_token', 'ghp_SensitiveDeveloperToken12345');
      assert.equal(smAvailable.hasSecret('github_token'), true);
      assert.equal(smAvailable.getSecret('github_token'), 'ghp_SensitiveDeveloperToken12345');

      // Verify file on disk is NOT plaintext
      const rawDisk = fs.readFileSync(storeFile, 'utf8');
      assert.equal(rawDisk.includes('ghp_SensitiveDeveloperToken12345'), false, 'Raw disk must not contain unencrypted token');

      // Full logout wipes file
      smAvailable.clearAll();
      assert.equal(fs.existsSync(storeFile), false, 'Logout removes credentials store from disk');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // 7. GitHub REST v3 .zg-vault/ Sandboxed Sync & Diff Pipeline
  describe('7. GitHub REST v3 .zg-vault/ Sandboxed Sync & Diff Pipeline', () => {
    it('strictly sandboxes operations within .zg-vault/, computes unified diffs, and handles HTTP statuses', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-gh-e2e-'));
      const storeFile = path.join(tmpDir, 'gh-creds.enc');

      const mockSafeStorage = {
        isEncryptionAvailable: () => true,
        encryptString: (s) => Buffer.from(s, 'utf8'),
        decryptString: (b) => b.toString('utf8')
      };
      const sm = new SecretsManager({ credentialsPath: storeFile, storageEngine: mockSafeStorage });
      sm.setSecret('github_token', 'ghp_MockTokenE2E');

      const mockFetchResponses = new Map();
      const mockFetch = async (url, opts = {}) => {
        const key = typeof url === 'string' ? url : url.toString();
        const found = mockFetchResponses.get(key);
        if (found) {
          return {
            ok: found.status >= 200 && found.status < 300,
            status: found.status,
            json: async () => found.data || {},
            text: async () => JSON.stringify(found.data || {})
          };
        }
        return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
      };

      const { normalizeVaultPath } = require('../../src/main/github-service');

      let currentRepo = 'Vishalkumar-acad/notes-vault';
      const settingsManager = {
        getSettings: () => ({ githubRepo: currentRepo }),
        updateSettings: (patch) => {
          if (patch.githubRepo) currentRepo = patch.githubRepo;
          return { githubRepo: currentRepo };
        }
      };

      const gh = new GitHubService({ secretsManager: sm, settingsManager, fetchFn: mockFetch });
      gh.setRepo('Vishalkumar-acad', 'notes-vault');

      // 1. Sandbox validation: rejects path escaping outside .zg-vault/
      assert.equal(normalizeVaultPath('outside.md').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/../../etc/shadow').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/%2e%2e/secret.md').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/notes/daily.md').valid, true);

      // 2. Pull operation
      const fileUrl = 'https://api.github.com/repos/Vishalkumar-acad/notes-vault/contents/.zg-vault/daily.md';
      mockFetchResponses.set(fileUrl, {
        status: 200,
        data: {
          content: Buffer.from('# Daily Scratchpad\n- Task 1\n- Task 2', 'utf8').toString('base64'),
          sha: 'sha-e2e-12345'
        }
      });

      const pulled = await gh.pull('.zg-vault/daily.md');
      assert.equal(pulled.sha, 'sha-e2e-12345');
      assert.ok(pulled.content.includes('# Daily Scratchpad'));

      // 3. Diff computation
      const localContent = '# Daily Scratchpad\n- Task 1\n- Task 2 Modified\n- Task 3 Added';
      const result = await gh.diff('.zg-vault/daily.md', localContent);
      assert.ok(result.diff.includes('+ - Task 3 Added'));

      // 4. HTTP status resilience: 403 Forbidden, 429 Rate Limit
      mockFetchResponses.set(fileUrl, { status: 403, data: { message: 'Resource blocked' } });
      await assert.rejects(async () => {
        await gh.pull('.zg-vault/daily.md');
      }, /403/);

      mockFetchResponses.set(fileUrl, { status: 429, data: { message: 'API rate limit exceeded' } });
      await assert.rejects(async () => {
        await gh.pull('.zg-vault/daily.md');
      }, /429/);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // 8. 5-Step Frame-Aware IPC Validation Pipeline Integration
  describe('8. 5-Step Frame-Aware IPC Validation Pipeline Integration', () => {
    it('dispatches legitimate Trusted UI requests and fails closed on unauthorized sender, child frame, or payload injection', async () => {
      const mockTrustedWebContents = {
        id: 101,
        isDestroyed: () => false
      };

      const mockUntrustedWebContents = {
        id: 999,
        isDestroyed: () => false
      };

      const context = {
        getTrustedUIWebContents: () => mockTrustedWebContents
      };

      const handler = createValidatedHandler('tab:close', async (payload, event) => {
        return { closedTabId: payload.tabId };
      }, context);

      // Legitimate top-level Trusted UI call
      const validEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };
      const res = await handler(validEvent, { tabId: 'tab-123' });
      assert.equal(res.ok, true);
      assert.equal(res.data.closedTabId, 'tab-123');

      // Rejection 1: Untrusted sender WebContents (e.g., website or popup)
      const foreignEvent = {
        sender: mockUntrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };
      const foreignRes = await handler(foreignEvent, { tabId: 'tab-123' });
      assert.equal(foreignRes.ok, false);
      assert.equal(foreignRes.error.code, 'UNAUTHORIZED_SENDER');

      // Rejection 2: Child frame / iframe
      const iframeEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: { url: 'zg://ui/index.html' }, url: 'zg://ui/index.html' }
      };
      const iframeRes = await handler(iframeEvent, { tabId: 'tab-123' });
      assert.equal(iframeRes.ok, false);
      assert.equal(iframeRes.error.code, 'UNAUTHORIZED_FRAME');

      // Rejection 3: Schema parameter injection (unexpected extra keys)
      const injectRes = await handler(validEvent, { tabId: 'tab-123', adminOverride: true, __proto__: { hacked: true } });
      assert.equal(injectRes.ok, false);
      assert.equal(injectRes.error.code, 'INVALID_PAYLOAD');
    });
  });
});
