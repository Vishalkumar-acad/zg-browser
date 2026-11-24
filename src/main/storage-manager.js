/**
 * Zero-Gravity Browser (zg-browser) - Main Storage Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.7 & 5
 * 
 * Manages backup export and import verification.
 * STRICT ENFORCEMENT: Imported files are treated strictly as untrusted text/data and never executed.
 */

const fs = require('fs');
const path = require('path');
const { CAPS } = require('../shared/constants');

let electron;
try {
  electron = require('electron');
} catch {
  electron = {};
}
const { app } = electron;

class MainStorageManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.exportDir]
   */
  constructor({ exportDir } = {}) {
    this.exportDir = exportDir || (app && typeof app.getPath === 'function' ? app.getPath('downloads') : '/tmp');
  }

  /**
   * Exports backup data to disk
   * @param {'json' | 'md'} format
   * @param {string} content
   */
  async exportToFile(format, content) {
    if (!['json', 'md'].includes(format)) {
      throw new Error('Unsupported export format');
    }

    if (typeof content !== 'string') {
      throw new Error('Export content must be string');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `zg-backup-${timestamp}.${format}`;
    const filePath = path.join(this.exportDir, filename);

    await fs.promises.writeFile(filePath, content, 'utf8');
    return { filePath };
  }

  /**
   * Validates raw import payload before parsing
   * @param {string} rawData
   */
  validateImportPayload(rawData) {
    if (typeof rawData !== 'string') {
      return { valid: false, error: 'Import payload must be a string' };
    }

    const byteLen = Buffer.byteLength(rawData, 'utf8');
    if (byteLen > CAPS.MAX_STORAGE_IMPORT_BYTES) {
      return { valid: false, error: `Import file exceeds maximum size of ${CAPS.MAX_STORAGE_IMPORT_BYTES} bytes` };
    }

    return { valid: true };
  }
}

module.exports = { MainStorageManager };
