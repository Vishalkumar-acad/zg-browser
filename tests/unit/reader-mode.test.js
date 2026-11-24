/**
 * Unit Test Suite: Reader Mode CSS-Only Mandate
 * Single Source of Truth: Blueprint v2.3 Section 4.5
 * 
 * Verifies that Reader Mode strictly uses webContents.insertCSS and NEVER
 * injects executeJavaScript scrapers or third-party DOM parsers into untrusted pages.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { TabManager } = require('../../src/main/tab-manager');

describe('Reader Mode (CSS-Only Security Mandate)', () => {
  it('reader.css exists and contains pure stylesheet rules without scripts', () => {
    const cssPath = path.resolve(__dirname, '../../src/renderer/styles/reader.css');
    assert.equal(fs.existsSync(cssPath), true);

    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert.ok(cssContent.includes('font-family'));
    assert.ok(cssContent.includes('display: none !important'));
    // Ensure no HTML script tags or JS leaks
    assert.equal(cssContent.includes('<script>'), false);
    assert.equal(cssContent.includes('executeJavaScript'), false);
  });

  it('toggles Reader Mode via insertCSS/removeInsertedCSS and NEVER calls executeJavaScript', async () => {
    let insertedCSS = null;
    let removedKey = null;
    let jsExecutionAttempted = false;

    const mockWebContents = {
      id: 'tab-test-reader',
      insertCSS: async (css) => {
        insertedCSS = css;
        return 'css-key-1234';
      },
      removeInsertedCSS: async (key) => {
        removedKey = key;
      },
      executeJavaScript: async () => {
        jsExecutionAttempted = true;
        throw new Error('SECURITY VIOLATION: executeJavaScript must NOT be called for Reader Mode');
      },
      on: () => {},
      isDestroyed: () => false
    };

    const tabManager = new TabManager({
      windowManager: { setActiveWebsiteView: () => {} },
      sessionManager: { getPersistentSession: () => ({}) },
      navigationController: { isAllowedWebsiteNavigation: () => true },
      sendToTrustedUI: () => {}
    });

    const tabRes = await tabManager.createTab();
    const tabRecord = tabManager.getTab(tabRes.tabId);
    tabRecord.view.webContents = mockWebContents;

    // 1. First toggle: Turn Reader Mode ON
    const turnOnRes = await tabManager.toggleReaderMode(tabRes.tabId);
    assert.equal(turnOnRes.ok, true);
    assert.equal(turnOnRes.data.active, true);
    assert.ok(insertedCSS, 'Must insert reader CSS stylesheet');
    assert.equal(tabRecord.readerCSSKey, 'css-key-1234');
    assert.equal(jsExecutionAttempted, false, 'ZERO executeJavaScript allowed');

    // 2. Second toggle: Turn Reader Mode OFF
    const turnOffRes = await tabManager.toggleReaderMode(tabRes.tabId);
    assert.equal(turnOffRes.ok, true);
    assert.equal(turnOffRes.data.active, false);
    assert.equal(removedKey, 'css-key-1234');
    assert.equal(tabRecord.readerCSSKey, null);
    assert.equal(jsExecutionAttempted, false, 'ZERO executeJavaScript allowed');
  });
});
