/**
 * Zero-Gravity Browser (zg-browser) - Settings Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.6 & 5
 * 
 * Manages local user settings. Validates updates, handles default fallbacks,
 * multi-engine search resolution, and recovers gracefully from corrupted configurations.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_SETTINGS, CAPS, SEARCH_ENGINES, formatSearchUrl } = require('../shared/constants');

class SettingsManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.configPath] - Path to local settings.json
   */
  constructor({ configPath } = {}) {
    this.configPath = configPath;
    this.settings = { ...DEFAULT_SETTINGS };
    this.load();
  }

  /**
   * Loads settings from disk if available
   */
  load() {
    if (!this.configPath) return;

    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          this.settings = { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch {
      // Corruption recovery: fall back safely to defaults
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Persists current settings to disk
   */
  save() {
    if (!this.configPath) return;

    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch {
      // Log or suppress disk write failures gracefully
    }
  }

  /**
   * Get current settings snapshot
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Formats a search query URL using current settings
   * @param {string} query
   */
  formatSearchUrl(query) {
    return formatSearchUrl(this.settings.searchEngine, query, this.settings.customSearchUrl);
  }

  /**
   * Updates settings with a validated patch
   * @param {Partial<import('../shared/constants').DEFAULT_SETTINGS>} patch
   */
  updateSettings(patch) {
    if (!patch || typeof patch !== 'object') {
      return this.getSettings();
    }

    const allowedKeys = [
      'theme',
      'searchEngine',
      'customSearchUrl',
      'newTabUrl',
      'trackerBlockingEnabled',
      'distractionFree',
      'scratchpadWidth',
      'githubRepo'
    ];

    for (const [key, value] of Object.entries(patch)) {
      if (!allowedKeys.includes(key)) {
        continue;
      }

      // Safe validation for customSearchUrl
      if (key === 'customSearchUrl') {
        if (typeof value !== 'string' || value.length > CAPS.MAX_URL_LENGTH) {
          continue;
        }
        const trimmed = value.trim();
        if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          continue; // Must be valid http/https scheme or empty
        }
        this.settings.customSearchUrl = trimmed;
        continue;
      }

      // Safe validation for newTabUrl
      if (key === 'newTabUrl') {
        if (typeof value !== 'string' || value.length > CAPS.MAX_URL_LENGTH) {
          continue;
        }
        this.settings.newTabUrl = value.trim();
        continue;
      }

      // Safe validation for searchEngine
      if (key === 'searchEngine') {
        if (typeof value !== 'string' || value.length > CAPS.MAX_URL_LENGTH) {
          continue;
        }
        this.settings.searchEngine = value.trim();
        continue;
      }

      // Safe validation for theme
      if (key === 'theme') {
        if (['dark', 'light', 'system'].includes(value)) {
          this.settings.theme = value;
        }
        continue;
      }

      // Safe validation for scratchpadWidth
      if (key === 'scratchpadWidth') {
        if (typeof value === 'number' && !Number.isNaN(value)) {
          this.settings.scratchpadWidth = value;
        }
        continue;
      }

      this.settings[key] = value;
    }

    this.save();
    return this.getSettings();
  }
}

module.exports = { SettingsManager };
