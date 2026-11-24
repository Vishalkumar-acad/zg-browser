/**
 * Unit Test Suite: Settings Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.6 & 5
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SettingsManager } = require('../../src/main/settings-manager');
const { DEFAULT_SETTINGS } = require('../../src/shared/constants');

describe('Settings Manager', () => {
  it('initializes with default settings when no config exists', () => {
    const sm = new SettingsManager();
    const settings = sm.getSettings();

    assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
    assert.equal(settings.searchEngine, DEFAULT_SETTINGS.searchEngine);
    assert.equal(settings.trackerBlockingEnabled, true);
  });

  it('updates settings with valid patch and ignores disallowed keys', () => {
    const sm = new SettingsManager();

    const updated = sm.updateSettings({
      theme: 'light',
      searchEngine: 'https://custom-search.com/?q=',
      disallowedKey: 'malicious-value'
    });

    assert.equal(updated.theme, 'light');
    assert.equal(updated.searchEngine, 'https://custom-search.com/?q=');
    assert.equal(updated.disallowedKey, undefined);
  });

  it('persists settings to disk and reloads correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-settings-test-'));
    const configPath = path.join(tmpDir, 'settings.json');

    const sm1 = new SettingsManager({ configPath });
    sm1.updateSettings({ theme: 'light', scratchpadWidth: 500 });

    assert.equal(fs.existsSync(configPath), true);

    // Create sm2 pointing to same path
    const sm2 = new SettingsManager({ configPath });
    const loaded = sm2.getSettings();

    assert.equal(loaded.theme, 'light');
    assert.equal(loaded.scratchpadWidth, 500);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recovers gracefully from corrupted config files by reverting to defaults', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-settings-corrupt-'));
    const configPath = path.join(tmpDir, 'settings.json');

    // Write corrupted JSON
    fs.writeFileSync(configPath, '{ invalid json: [');

    const sm = new SettingsManager({ configPath });
    const settings = sm.getSettings();

    assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
    assert.equal(settings.trackerBlockingEnabled, true);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
