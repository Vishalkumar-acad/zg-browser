/**
 * Unit Test Suite: Privacy Manager & Tracker Blocking
 * Single Source of Truth: Blueprint v2.3 Section 4.5
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { PrivacyManager } = require('../../src/main/privacy-manager');

const BLOCKLIST_PATH = path.resolve(__dirname, '../../src/main/blocklist.json');

describe('Privacy Manager & Tracker Blocking', () => {
  it('loads and schema-validates blocklist.json', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });
    assert.ok(pm.blockedDomains.size > 0);
    assert.equal(pm.blockedDomains.has('doubleclick.net'), true);
    assert.equal(pm.blockedDomains.has('google-analytics.com'), true);
  });

  it('identifies exact domains and subdomains on blocklist', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    // Exact match
    assert.equal(pm.matchesBlocklist('doubleclick.net'), true);
    // Subdomain match
    assert.equal(pm.matchesBlocklist('adservice.google.com'), true);
    assert.equal(pm.matchesBlocklist('connect.facebook.net'), true);
    // Deep subdomain match
    assert.equal(pm.matchesBlocklist('cdn.telemetry.mozilla.org'), true);

    // Non-blocked clean domains
    assert.equal(pm.matchesBlocklist('wikipedia.org'), false);
    assert.equal(pm.matchesBlocklist('duckduckgo.com'), false);
    assert.equal(pm.matchesBlocklist('github.com'), false);
  });

  it('intercepts tracker URLs and allows clean web URLs', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    assert.equal(pm.shouldBlockRequest('https://google-analytics.com/analytics.js'), true);
    assert.equal(pm.shouldBlockRequest('https://adservice.google.com/adsid/integrator.js'), true);
    assert.equal(pm.shouldBlockRequest('https://github.com/index.html'), false);
  });

  it('never blocks internal zg:// custom chrome URLs', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    assert.equal(pm.shouldBlockRequest('zg://ui/index.html'), false);
    assert.equal(pm.shouldBlockRequest('zg://ui/styles/main.css'), false);
  });

  it('respects user allowlist precedence over blocklist', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    // By default, doubleclick is blocked
    assert.equal(pm.shouldBlockRequest('https://doubleclick.net/ad.js'), true);

    // User allowlists doubleclick.net
    pm.allowlistSite('doubleclick.net', true);
    assert.equal(pm.shouldBlockRequest('https://doubleclick.net/ad.js'), false);

    // User removes from allowlist
    pm.allowlistSite('doubleclick.net', false);
    assert.equal(pm.shouldBlockRequest('https://doubleclick.net/ad.js'), true);
  });

  it('disables blocking entirely when toggled off', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    pm.toggleTrackerBlocking(false);
    assert.equal(pm.enabled, false);
    assert.equal(pm.shouldBlockRequest('https://google-analytics.com/analytics.js'), false);

    pm.toggleTrackerBlocking(true);
    assert.equal(pm.enabled, true);
    assert.equal(pm.shouldBlockRequest('https://google-analytics.com/analytics.js'), true);
  });

  it('tracks blocked request metrics per tab', () => {
    const pm = new PrivacyManager({ blocklistPath: BLOCKLIST_PATH });

    let interceptedCallback = null;
    const mockSession = {
      webRequest: {
        onBeforeRequest: (opts, cb) => { interceptedCallback = cb; }
      }
    };

    pm.attachToSession(mockSession);
    assert.ok(interceptedCallback);

    // Simulate blocked request from tab 42
    let cancelDecision = null;
    interceptedCallback(
      { url: 'https://doubleclick.net/tracker.js', webContentsId: 42 },
      (res) => { cancelDecision = res.cancel; }
    );

    assert.equal(cancelDecision, true);

    const stats = pm.getBlockedStats('42');
    assert.equal(stats.count, 1);
    assert.deepEqual(stats.domains, ['doubleclick.net']);
  });
});
