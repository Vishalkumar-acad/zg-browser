/**
 * Unit Test Suite: Settings Manager & Search Engines
 * Single Source of Truth: Blueprint v2.3 Section 4.6 & 5
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SettingsManager } = require('../../src/main/settings-manager');
const { DEFAULT_SETTINGS, formatSearchUrl, SEARCH_ENGINES } = require('../../src/shared/constants');

describe('Settings Manager & Search Engine Resolution', () => {
  it('initializes with default settings when no config exists', () => {
    const sm = new SettingsManager();
    const settings = sm.getSettings();

    assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
    assert.equal(settings.searchEngine, 'duckduckgo');
    assert.equal(settings.newTabUrl, 'about:blank');
    assert.equal(settings.trackerBlockingEnabled, true);
  });

  it('resolves all built-in search engines correctly (DuckDuckGo, Google, Brave, Startpage)', () => {
    // DuckDuckGo
    assert.equal(
      formatSearchUrl('duckduckgo', 'zero gravity browser'),
      'https://duckduckgo.com/?q=zero%20gravity%20browser'
    );

    // Google
    assert.equal(
      formatSearchUrl('google', 'zero gravity browser'),
      'https://www.google.com/search?q=zero%20gravity%20browser'
    );

    // Brave Search
    assert.equal(
      formatSearchUrl('brave', 'zero gravity browser'),
      'https://search.brave.com/search?q=zero%20gravity%20browser'
    );

    // Startpage
    assert.equal(
      formatSearchUrl('startpage', 'zero gravity browser'),
      'https://www.startpage.com/sp/search?query=zero%20gravity%20browser'
    );
  });

  it('formats custom search engine URLs with %s template placeholder', () => {
    // Custom URL with %s
    const customTemplate = 'https://kagi.com/search?q=%s';
    assert.equal(
      formatSearchUrl('custom', 'electron linux app', customTemplate),
      'https://kagi.com/search?q=electron%20linux%20app'
    );

    // Custom URL with multiple occurrences of %s
    const multiTemplate = 'https://search.internal.net/?query=%s&ref=%s';
    assert.equal(
      formatSearchUrl('custom', 'quantum computing', multiTemplate),
      'https://search.internal.net/?query=quantum%20computing&ref=quantum%20computing'
    );

    // Custom URL without %s (appends query)
    const appendTemplate = 'https://private-search.org/?q=';
    assert.equal(
      formatSearchUrl('custom', 'test query', appendTemplate),
      'https://private-search.org/?q=test%20query'
    );
  });

  it('validates custom search URL and rejects dangerous or non-http/https schemes', () => {
    const sm = new SettingsManager();

    // Valid HTTPS custom URL
    sm.updateSettings({
      searchEngine: 'custom',
      customSearchUrl: 'https://kagi.com/search?q=%s'
    });
    assert.equal(sm.getSettings().customSearchUrl, 'https://kagi.com/search?q=%s');

    // Reject javascript: scheme
    sm.updateSettings({
      customSearchUrl: 'javascript:alert(1)'
    });
    // Should NOT have changed to javascript:
    assert.equal(sm.getSettings().customSearchUrl, 'https://kagi.com/search?q=%s');

    // Reject file: scheme
    sm.updateSettings({
      customSearchUrl: 'file:///etc/passwd'
    });
    assert.equal(sm.getSettings().customSearchUrl, 'https://kagi.com/search?q=%s');

    // Reject data: scheme
    sm.updateSettings({
      customSearchUrl: 'data:text/html,payload'
    });
    assert.equal(sm.getSettings().customSearchUrl, 'https://kagi.com/search?q=%s');
  });

  it('updates newTabUrl and persists across reload', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-settings-newtab-'));
    const configPath = path.join(tmpDir, 'settings.json');

    const sm1 = new SettingsManager({ configPath });
    sm1.updateSettings({ newTabUrl: 'https://duckduckgo.com' });

    assert.equal(sm1.getSettings().newTabUrl, 'https://duckduckgo.com');

    // Reload from disk
    const sm2 = new SettingsManager({ configPath });
    assert.equal(sm2.getSettings().newTabUrl, 'https://duckduckgo.com');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates settings with valid patch and ignores disallowed keys', () => {
    const sm = new SettingsManager();

    const updated = sm.updateSettings({
      theme: 'light',
      searchEngine: 'google',
      disallowedKey: 'malicious-value'
    });

    assert.equal(updated.theme, 'light');
    assert.equal(updated.searchEngine, 'google');
    assert.equal(updated.disallowedKey, undefined);
  });

  it('persists settings to disk and reloads correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-settings-test-'));
    const configPath = path.join(tmpDir, 'settings.json');

    const sm1 = new SettingsManager({ configPath });
    sm1.updateSettings({ theme: 'light', scratchpadWidth: 500 });

    assert.equal(fs.existsSync(configPath), true);

    const sm2 = new SettingsManager({ configPath });
    const loaded = sm2.getSettings();

    assert.equal(loaded.theme, 'light');
    assert.equal(loaded.scratchpadWidth, 500);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recovers gracefully from corrupted config files by reverting to defaults', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-settings-corrupt-'));
    const configPath = path.join(tmpDir, 'settings.json');

    fs.writeFileSync(configPath, '{ invalid json: [');

    const sm = new SettingsManager({ configPath });
    const settings = sm.getSettings();

    assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
    assert.equal(settings.trackerBlockingEnabled, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
