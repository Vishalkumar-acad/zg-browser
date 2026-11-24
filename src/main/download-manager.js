/**
 * Zero-Gravity Browser (zg-browser) - Download Manager
 * Single Source of Truth: Blueprint v2.3 Section 4.9
 * 
 * Enforces controlled download destination, strict filename sanitization,
 * OS-reserved name defense, duplicate name handling, dangerous file detection,
 * and strict prohibition against auto-executing downloaded files.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { IPC_CHANNELS } = require('../shared/ipc-channels');
const { DANGEROUS_EXTENSIONS } = require('../shared/constants');

let electron;
try {
  electron = require('electron');
} catch {
  electron = {};
}
const { app, shell } = electron;

// Windows reserved device names
const OS_RESERVED_NAMES = Object.freeze([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

/**
 * Sanitizes a filename to prevent directory traversal and OS-level exploits.
 * Pure function designed for runtime security and automated testing.
 * 
 * @param {string} rawFilename
 * @returns {string} Sanitized safe filename
 */
function sanitizeFilename(rawFilename) {
  if (typeof rawFilename !== 'string' || !rawFilename.trim()) {
    return 'download';
  }

  // 1. Normalize backslashes and strip directory traversal / path separators
  const normalized = rawFilename.trim().replace(/\\/g, '/');
  let name = path.basename(normalized);

  // 2. Remove null bytes and control characters (0-31)
  name = name.replace(/[\x00-\x1F\x7F]/g, '');

  // 3. Remove OS-reserved illegal characters: < > : " / \ | ? *
  name = name.replace(/[<>:"/\\|?*]/g, '_');

  // 4. Strip leading/trailing dots and spaces
  name = name.replace(/^[.\s]+|[.\s]+$/g, '');

  // 5. Defend against Windows reserved device names (e.g. CON, NUL, COM1)
  const baseWithoutExt = path.parse(name).name.toUpperCase();
  if (OS_RESERVED_NAMES.includes(baseWithoutExt)) {
    name = `safe_${name}`;
  }

  // 6. Clamp max length to 255 chars
  if (name.length > 255) {
    const ext = path.extname(name);
    const base = name.slice(0, 255 - ext.length);
    name = `${base}${ext}`;
  }

  return name || 'download';
}

/**
 * Checks whether a file extension is classified as potentially dangerous/executable
 * @param {string} filename
 * @returns {boolean}
 */
function isDangerousFilename(filename) {
  if (typeof filename !== 'string') return false;
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
}

/**
 * Resolves a unique filename if target already exists (e.g., file (1).txt)
 * @param {string} directory
 * @param {string} filename
 */
function getUniqueDownloadPath(directory, filename) {
  const sanitized = sanitizeFilename(filename);
  let targetPath = path.join(directory, sanitized);

  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }

  const parsed = path.parse(sanitized);
  let counter = 1;
  while (fs.existsSync(targetPath)) {
    targetPath = path.join(directory, `${parsed.name} (${counter})${parsed.ext}`);
    counter += 1;
  }

  return targetPath;
}

class DownloadManager {
  /**
   * @param {Object} options
   * @param {string} [options.downloadPath] - Default download directory
   * @param {Function} [options.sendToTrustedUI] - Callback to broadcast progress
   */
  constructor({ downloadPath, sendToTrustedUI } = {}) {
    this.defaultDownloadPath = downloadPath || (app && typeof app.getPath === 'function' ? app.getPath('downloads') : '/tmp');
    this.sendToTrustedUI = sendToTrustedUI || (() => {});
    // downloadId -> { item, state, progress, filename, filePath, isDangerous }
    this.activeDownloads = new Map();
  }

  /**
   * Attach will-download listener to an Electron session
   * @param {import('electron').Session} sess
   */
  attachToSession(sess) {
    if (!sess || typeof sess.on !== 'function') return;

    sess.on('will-download', (_event, item) => {
      const downloadId = crypto.randomUUID();
      const rawFilename = item.getFilename();
      const sanitizedName = sanitizeFilename(rawFilename);
      const isDangerous = isDangerousFilename(sanitizedName);

      const targetPath = getUniqueDownloadPath(this.defaultDownloadPath, sanitizedName);
      item.setSavePath(targetPath);

      const downloadRecord = {
        downloadId,
        item,
        state: 'progressing',
        progress: 0,
        filename: sanitizedName,
        filePath: targetPath,
        isDangerous
      };

      this.activeDownloads.set(downloadId, downloadRecord);

      // Initial notification to Trusted UI
      this._broadcastUpdate(downloadRecord);

      item.on('updated', (_evt, state) => {
        downloadRecord.state = state;
        const total = item.getTotalBytes();
        const received = item.getReceivedBytes();
        downloadRecord.progress = total > 0 ? Math.round((received / total) * 100) : 0;
        this._broadcastUpdate(downloadRecord);
      });

      item.once('done', (_evt, state) => {
        downloadRecord.state = state; // 'completed', 'cancelled', 'interrupted'
        if (state === 'completed') {
          downloadRecord.progress = 100;
        }
        this._broadcastUpdate(downloadRecord);
        // STRICT PROHIBITION: Never auto-execute downloaded files!
      });
    });
  }

  /**
   * Broadcast download state update
   */
  _broadcastUpdate(record) {
    this.sendToTrustedUI(IPC_CHANNELS.STATE_DOWNLOAD_UPDATED, {
      downloadId: record.downloadId,
      state: record.state,
      progress: record.progress,
      filename: record.filename,
      isDangerous: record.isDangerous
    });
  }

  /**
   * Pause active download
   * @param {string} downloadId
   */
  pause(downloadId) {
    const record = this.activeDownloads.get(downloadId);
    if (record && record.item && typeof record.item.pause === 'function') {
      record.item.pause();
      record.state = 'paused';
      this._broadcastUpdate(record);
      return { ok: true };
    }
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Download not found' } };
  }

  /**
   * Resume paused download
   * @param {string} downloadId
   */
  resume(downloadId) {
    const record = this.activeDownloads.get(downloadId);
    if (record && record.item && typeof record.item.resume === 'function') {
      record.item.resume();
      record.state = 'progressing';
      this._broadcastUpdate(record);
      return { ok: true };
    }
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Download not found' } };
  }

  /**
   * Cancel download
   * @param {string} downloadId
   */
  cancel(downloadId) {
    const record = this.activeDownloads.get(downloadId);
    if (record && record.item && typeof record.item.cancel === 'function') {
      record.item.cancel();
      record.state = 'cancelled';
      this._broadcastUpdate(record);
      return { ok: true };
    }
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Download not found' } };
  }

  /**
   * Open the folder containing the downloaded file in the OS file manager
   * (Does NOT execute the file)
   * @param {string} downloadId
   */
  openFolder(downloadId) {
    const record = this.activeDownloads.get(downloadId);
    if (!record || !record.filePath) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Download not found' } };
    }

    if (shell && typeof shell.showItemInFolder === 'function') {
      shell.showItemInFolder(record.filePath);
      return { ok: true };
    }

    return { ok: true };
  }
}

module.exports = {
  DownloadManager,
  sanitizeFilename,
  isDangerousFilename,
  getUniqueDownloadPath
};
