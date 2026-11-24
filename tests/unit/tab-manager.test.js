/**
 * Unit Test Suite: Tab & Lifecycle Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.3
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { TabManager } = require('../../src/main/tab-manager');

describe('Tab & Lifecycle Manager', () => {
  function createTestHarness() {
    let broadcastTabs = null;
    let broadcastNav = null;
    let destroyedEphemeralId = null;
    let reportedError = null;

    const mockSessionManager = {
      getPersistentSession: () => ({ id: 'persist:default' }),
      createEphemeralSession: (tabId) => ({ id: `zg-ephemeral-${tabId}` }),
      cleanupEphemeralSession: async (tabId) => { destroyedEphemeralId = tabId; }
    };

    const mockWindowManager = {
      activeView: null,
      setActiveWebsiteView: (view) => { mockWindowManager.activeView = view; }
    };

    const mockNavigationController = {
      isAllowedWebsiteNavigation: (url) => url.startsWith('https://') || url.startsWith('http://'),
      attachToWebsiteWebContents: () => {}
    };

    const mockHistoryManager = {
      entries: [],
      addEntry: (entry) => { mockHistoryManager.entries.push(entry); }
    };

    const mockErrorHandler = {
      notify: (code, message) => { reportedError = { code, message }; }
    };

    const sendToTrustedUI = (channel, data) => {
      if (channel === 'state:tabs-updated') broadcastTabs = data;
      if (channel === 'state:nav-updated') broadcastNav = data;
    };

    const tabManager = new TabManager({
      windowManager: mockWindowManager,
      sessionManager: mockSessionManager,
      navigationController: mockNavigationController,
      historyManager: mockHistoryManager,
      errorHandler: mockErrorHandler,
      sendToTrustedUI
    });

    return {
      tabManager,
      mockSessionManager,
      mockWindowManager,
      mockHistoryManager,
      mockErrorHandler,
      getBroadcastTabs: () => broadcastTabs,
      getBroadcastNav: () => broadcastNav,
      getDestroyedEphemeralId: () => destroyedEphemeralId,
      getReportedError: () => reportedError
    };
  }

  it('creates a new tab with default state and broadcasts update', async () => {
    const { tabManager, getBroadcastTabs } = createTestHarness();

    const res = await tabManager.createTab({ url: 'https://example.com' });
    assert.ok(res.tabId);
    assert.equal(tabManager.hasTab(res.tabId), true);
    assert.equal(tabManager.activeTabId, res.tabId);

    const snapshot = getBroadcastTabs();
    assert.ok(snapshot);
    assert.equal(snapshot.activeId, res.tabId);
    assert.equal(snapshot.tabs.length, 1);
    assert.equal(snapshot.tabs[0].id, res.tabId);
    assert.equal(snapshot.tabs[0].isEphemeral, false);
  });

  it('creates an ephemeral private tab and assigns ephemeral session', async () => {
    const { tabManager } = createTestHarness();

    const res = await tabManager.createTab({ ephemeral: true });
    const tab = tabManager.getTab(res.tabId);
    assert.ok(tab);
    assert.equal(tab.isEphemeral, true);
    assert.equal(tab.session.id, `zg-ephemeral-${res.tabId}`);
  });

  it('switches between multiple tabs safely', async () => {
    const { tabManager, mockWindowManager } = createTestHarness();

    const tab1 = await tabManager.createTab({ url: 'https://site1.com' });
    const tab2 = await tabManager.createTab({ url: 'https://site2.com' });

    assert.equal(tabManager.activeTabId, tab2.tabId);

    const switchRes = await tabManager.switchTab(tab1.tabId);
    assert.equal(switchRes.ok, true);
    assert.equal(tabManager.activeTabId, tab1.tabId);
    assert.equal(mockWindowManager.activeView, tabManager.getTab(tab1.tabId).view);
  });

  it('cleans up ephemeral session immediately when private tab is closed', async () => {
    const { tabManager, getDestroyedEphemeralId } = createTestHarness();

    const tab = await tabManager.createTab({ ephemeral: true });
    assert.equal(tabManager.hasTab(tab.tabId), true);

    const closeRes = await tabManager.closeTab(tab.tabId);
    assert.equal(closeRes.ok, true);
    assert.equal(tabManager.hasTab(tab.tabId), false);
    assert.equal(getDestroyedEphemeralId(), tab.tabId);
  });

  it('switches to remaining tab or auto-creates default tab when active tab closes', async () => {
    const { tabManager } = createTestHarness();

    const tab1 = await tabManager.createTab();
    const tab2 = await tabManager.createTab();

    // Close tab2 (active): should switch to tab1
    await tabManager.closeTab(tab2.tabId);
    assert.equal(tabManager.activeTabId, tab1.tabId);

    // Close tab1: should auto-create a clean new tab
    await tabManager.closeTab(tab1.tabId);
    assert.equal(tabManager.tabs.size, 1);
    assert.notEqual(tabManager.activeTabId, tab1.tabId);
  });

  it('blocks navigation to dangerous or disallowed schemes', async () => {
    const { tabManager } = createTestHarness();

    const tab = await tabManager.createTab();
    const navRes = await tabManager.navigateTab(tab.tabId, 'javascript:alert(1)');
    assert.equal(navRes.ok, false);
    assert.equal(navRes.error.code, 'BLOCKED_SCHEME');
  });

  it('handles render-process-gone crash and emits sanitized crash notice', async () => {
    const { tabManager, getReportedError } = createTestHarness();

    const tab = await tabManager.createTab();
    const tabRecord = tabManager.getTab(tab.tabId);

    // Simulate crash listener on webContents
    let crashHandler = null;
    tabRecord.view.webContents.on = (evt, fn) => {
      if (evt === 'render-process-gone') crashHandler = fn;
    };
    tabManager._attachWebContentsListeners(tabRecord);

    assert.ok(crashHandler);
    crashHandler({}, { reason: 'crashed' });

    assert.equal(tabRecord.isCrashed, true);
    assert.equal(tabRecord.isLoading, false);
    assert.ok(getReportedError());
    assert.equal(getReportedError().code, 'RENDERER_CRASH');
  });
});
