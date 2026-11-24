/**
 * Security Test Suite: Core Security Invariants & Defensive Mandates
 * Single Source of Truth: Blueprint v2.3 Section 2.2, 4.1, 4.4, 4.8
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  getUntrustedWebPreferences,
  getTrustedUIWebPreferences,
  SecurityController
} = require('../../src/main/security-controller');
const { NavigationController } = require('../../src/main/navigation-controller');
const { PermissionManager } = require('../../src/main/permission-manager');
const { ErrorHandler } = require('../../src/main/error-handler');
const { calculateLayerBounds } = require('../../src/main/window-manager');
const { SCRATCHPAD_BOUNDS } = require('../../src/shared/constants');

describe('Core Security Invariants & Defensive Mandates', () => {
  // WebPreferences Mandate
  describe('WebPreferences Isolation Mandate', () => {
    it('enforces strict baseline for untrusted website WebContentsView (zero preload)', () => {
      const prefs = getUntrustedWebPreferences();
      assert.equal(prefs.contextIsolation, true);
      assert.equal(prefs.nodeIntegration, false);
      assert.equal(prefs.sandbox, true);
      assert.equal(prefs.webSecurity, true);
      assert.equal(prefs.preload, undefined, 'Website WebContentsView must have ZERO preload script');
      assert.equal(prefs.allowRunningInsecureContent, false);
    });

    it('enforces strict baseline for Trusted UI WebContents with preload sandbox', () => {
      const preloadPath = path.resolve(__dirname, '../../src/preload/index.js');
      const prefs = getTrustedUIWebPreferences(preloadPath);
      assert.equal(prefs.contextIsolation, true);
      assert.equal(prefs.nodeIntegration, false);
      assert.equal(prefs.sandbox, true);
      assert.equal(prefs.webSecurity, true);
      assert.equal(prefs.preload, preloadPath);
    });

    it('security controller validates valid web preferences', () => {
      const sec = new SecurityController();
      assert.equal(sec.validateWebPreferences(getUntrustedWebPreferences()), true);
      assert.equal(sec.validateWebPreferences({ contextIsolation: false }), false);
      assert.equal(sec.validateWebPreferences({ nodeIntegration: true }), false);
      assert.equal(sec.validateWebPreferences({ sandbox: false }), false);
      assert.equal(sec.validateWebPreferences({ webSecurity: false }), false);
    });

    it('TLS certificate error handler strictly fails closed and emits state:cert-error', () => {
      let emittedCertError = null;
      let callbackResult = 'not-called';
      let defaultPrevented = false;

      const sec = new SecurityController({
        sendToTrustedUI: (ch, data) => {
          emittedCertError = { ch, data };
        }
      });

      let certErrorHandler = null;
      const mockApp = {
        on: (evt, handler) => {
          if (evt === 'certificate-error') certErrorHandler = handler;
        }
      };

      sec.attachCertificateErrorHandler(mockApp, () => 'tab-cert-test');
      assert.ok(certErrorHandler);

      const mockEvent = { preventDefault: () => { defaultPrevented = true; } };
      certErrorHandler(
        mockEvent,
        {},
        'https://expired.badssl.com',
        'net::ERR_CERT_DATE_INVALID',
        { issuerName: 'BadSSL Test CA' },
        (allow) => { callbackResult = allow; }
      );

      assert.equal(defaultPrevented, true, 'Default must be prevented');
      assert.equal(callbackResult, false, 'FAIL-CLOSED: Callback must receive false to reject invalid certificate');
      assert.ok(emittedCertError);
      assert.equal(emittedCertError.data.tabId, 'tab-cert-test');
      assert.equal(emittedCertError.data.errorCode, 'net::ERR_CERT_DATE_INVALID');
      assert.equal(emittedCertError.data.issuer, 'BadSSL Test CA');
    });
  });

  // Navigation Controller Security
  describe('Navigation Controller Restrictions', () => {
    const nav = new NavigationController();

    it('allows standard https and http for website navigation', () => {
      assert.equal(nav.isAllowedWebsiteNavigation('https://github.com'), true);
      assert.equal(nav.isAllowedWebsiteNavigation('http://example.com'), true);
    });

    it('blocks dangerous schemes from website navigation', () => {
      assert.equal(nav.isAllowedWebsiteNavigation('javascript:alert(1)'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('file:///etc/passwd'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('data:text/html,<script>alert(1)</script>'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('vbscript:msgbox'), false);
    });

    it('blocks untrusted websites from navigating to internal zg:// scheme', () => {
      assert.equal(nav.isAllowedWebsiteNavigation('zg://ui/index.html'), false);
      assert.equal(nav.isAllowedWebsiteNavigation('zg://settings'), false);
    });

    it('locks Trusted UI strictly to internal zg:// allowlisted hosts', () => {
      assert.equal(nav.isAllowedTrustedUINavigation('zg://ui/index.html'), true);
      assert.equal(nav.isAllowedTrustedUINavigation('zg://error'), true);
      assert.equal(nav.isAllowedTrustedUINavigation('zg://settings'), true);
      assert.equal(nav.isAllowedTrustedUINavigation('https://evil.com'), false);
      assert.equal(nav.isAllowedTrustedUINavigation('file:///secret'), false);
    });
  });

  // Permission Manager Default-Deny
  describe('Permission Manager Default-Deny', () => {
    it('records and responds to permissions with origin binding', () => {
      let emittedPrompt = null;
      const pm = new PermissionManager({
        sendToTrustedUI: (ch, data) => {
          emittedPrompt = { ch, data };
        }
      });

      // Mock session
      let reqHandler = null;
      let checkHandler = null;
      let displayMediaHandler = null;

      const mockSession = {
        setPermissionRequestHandler: (fn) => { reqHandler = fn; },
        setPermissionCheckHandler: (fn) => { checkHandler = fn; },
        setDisplayMediaRequestHandler: (fn) => { displayMediaHandler = fn; }
      };

      pm.attachToSession(mockSession);
      assert.ok(reqHandler);
      assert.ok(checkHandler);
      assert.ok(displayMediaHandler);

      // Check handler should default-deny
      assert.equal(checkHandler(null, 'media', 'https://example.com'), false);

      // Display media request handler should default-deny (pass null stream)
      let streamResult = 'not-called';
      displayMediaHandler({}, (res) => { streamResult = res; });
      assert.equal(streamResult, null, 'Screen capture must default-deny');

      // Request permission
      let decision = null;
      reqHandler(
        { getURL: () => 'https://example.com/app' },
        'media',
        (allow) => { decision = allow; },
        { requestingUrl: 'https://example.com/app' }
      );

      assert.ok(emittedPrompt);
      assert.equal(emittedPrompt.data.permission, 'media');
      assert.equal(emittedPrompt.data.origin, 'https://example.com');

      // Respond allow with persistence
      const resp = pm.respond(emittedPrompt.data.requestId, true, true);
      assert.equal(resp.ok, true);
      assert.equal(decision, true);

      // After persisting, check handler should return true for that origin
      assert.equal(checkHandler(null, 'media', 'https://example.com'), true);
      // But other permissions for that origin still return false
      assert.equal(checkHandler(null, 'geolocation', 'https://example.com'), false);

      // Revocation works
      pm.revoke('https://example.com', 'media');
      assert.equal(checkHandler(null, 'media', 'https://example.com'), false);
    });
  });

  // Error Redaction & Non-Disclosure
  describe('Error Sanitization & Secret Redaction', () => {
    it('redacts tokens, credentials, and file paths from error messages', () => {
      const errHandler = new ErrorHandler();

      const rawMsg = `Failed to connect with token ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7 at ${errHandler.homedir}/project/secret.js\n    at Object.<anonymous> (/home/ubuntu/...)`;
      const sanitized = errHandler.sanitizeMessage(rawMsg);

      assert.equal(sanitized.includes('ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7'), false);
      assert.match(sanitized, /\[REDACTED_TOKEN\]/);
      assert.equal(sanitized.includes(errHandler.homedir), false);
      assert.match(sanitized, /~/);
      assert.equal(sanitized.includes('at Object.<anonymous>'), false, 'Stack trace lines must be stripped');
    });
  });

  // Dual-Layer Bounds Calculation & Persistent Top Bar Strategy
  describe('Dual-Layer Window Bounds Strategy', () => {
    it('maintains persistent top navigation bar (74px) in default browsing mode', () => {
      const { uiBounds, websiteBounds, topBarHeight } = calculateLayerBounds({
        windowWidth: 1280,
        windowHeight: 800,
        overlayOpen: false,
        scratchpadOpen: false,
        distractionFree: false
      });

      assert.equal(topBarHeight, 74);
      assert.equal(uiBounds.height, 74, 'UI view covers persistent top chrome so address bar and tabs are visible');
      assert.equal(websiteBounds.y, 74, 'Website view starts cleanly below top chrome');
      assert.equal(websiteBounds.height, 800 - 74, 'Website viewport height accounts for persistent top chrome');
      assert.equal(websiteBounds.width, 1280, 'Website view occupies full viewport width');
    });

    it('collapses UI view to 4px hover trigger in distraction-free mode when overlays are closed', () => {
      const { uiBounds, websiteBounds, topBarHeight } = calculateLayerBounds({
        windowWidth: 1280,
        windowHeight: 800,
        overlayOpen: false,
        scratchpadOpen: false,
        distractionFree: true
      });

      assert.equal(uiBounds.height, 4, 'UI view collapses to 4px strip in distraction-free mode');
      assert.equal(websiteBounds.y, 0, 'Website view starts at y: 0 in distraction-free mode');
      assert.equal(websiteBounds.height, 800);
      assert.equal(websiteBounds.width, 1280);
    });

    it('expands UI view to full viewport when an overlay is open', () => {
      const { uiBounds, websiteBounds } = calculateLayerBounds({
        windowWidth: 1280,
        windowHeight: 800,
        overlayOpen: true,
        scratchpadOpen: false
      });

      assert.equal(uiBounds.height, 800, 'UI view covers viewport when overlay is active');
      assert.equal(websiteBounds.width, 1280);
    });

    it('docked scratchpad drawer shrinks website width cleanly without z-index clipping', () => {
      const { websiteBounds, actualDrawerWidth } = calculateLayerBounds({
        windowWidth: 1280,
        windowHeight: 800,
        overlayOpen: false,
        scratchpadOpen: true,
        scratchpadWidth: 420
      });

      assert.equal(actualDrawerWidth, 420);
      assert.equal(websiteBounds.width, 1280 - 420); // 860px
      assert.equal(websiteBounds.height, 800 - 74); // 726px
    });
  });
});
