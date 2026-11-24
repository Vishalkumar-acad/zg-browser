/**
 * Unit Test Suite: Download Manager & Filename Sanitization
 * Single Source of Truth: Blueprint v2.3 Section 4.9
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  sanitizeFilename,
  isDangerousFilename,
  getUniqueDownloadPath,
  DownloadManager
} = require('../../src/main/download-manager');

describe('Download Manager & Filename Sanitization', () => {
  describe('sanitizeFilename', () => {
    it('strips directory traversal paths', () => {
      assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
      assert.equal(sanitizeFilename('..\\..\\windows\\system32\\calc.exe'), 'calc.exe');
      assert.equal(sanitizeFilename('/var/log/secret.txt'), 'secret.txt');
    });

    it('removes OS-reserved illegal characters (<>:"/\\|?*)', () => {
      assert.equal(sanitizeFilename('file<bad>:name*?.txt'), 'file_bad__name__.txt');
    });

    it('removes null bytes and control characters', () => {
      assert.equal(sanitizeFilename('exploit\x00\x01\x1F.pdf'), 'exploit.pdf');
    });

    it('protects against Windows reserved device names (CON, NUL, COM1)', () => {
      assert.equal(sanitizeFilename('CON.txt'), 'safe_CON.txt');
      assert.equal(sanitizeFilename('nul'), 'safe_nul');
      assert.equal(sanitizeFilename('COM1.png'), 'safe_COM1.png');
    });

    it('falls back to safe default if filename is empty or spaces', () => {
      assert.equal(sanitizeFilename(''), 'download');
      assert.equal(sanitizeFilename('    '), 'download');
      assert.equal(sanitizeFilename('...'), 'download');
    });

    it('clamps filenames exceeding 255 characters while preserving extension', () => {
      const hugeName = 'a'.repeat(300) + '.pdf';
      const sanitized = sanitizeFilename(hugeName);
      assert.ok(sanitized.length <= 255);
      assert.ok(sanitized.endsWith('.pdf'));
    });
  });

  describe('isDangerousFilename', () => {
    it('detects executable and potentially harmful extensions', () => {
      assert.equal(isDangerousFilename('setup.exe'), true);
      assert.equal(isDangerousFilename('script.bat'), true);
      assert.equal(isDangerousFilename('payload.sh'), true);
      assert.equal(isDangerousFilename('installer.msi'), true);
      assert.equal(isDangerousFilename('macro.vbs'), true);
      assert.equal(isDangerousFilename('archive.jar'), true);
      assert.equal(isDangerousFilename('tool.ps1'), true);
    });

    it('classifies non-executable documents and images as non-dangerous', () => {
      assert.equal(isDangerousFilename('document.pdf'), false);
      assert.equal(isDangerousFilename('photo.png'), false);
      assert.equal(isDangerousFilename('readme.txt'), false);
      assert.equal(isDangerousFilename('styles.css'), false);
    });
  });

  describe('getUniqueDownloadPath', () => {
    it('appends incrementing counter if file already exists', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-download-test-'));
      const existingFile = path.join(tmpDir, 'report.txt');
      fs.writeFileSync(existingFile, 'content');

      const uniquePath1 = getUniqueDownloadPath(tmpDir, 'report.txt');
      assert.equal(path.basename(uniquePath1), 'report (1).txt');

      fs.writeFileSync(uniquePath1, 'content 1');
      const uniquePath2 = getUniqueDownloadPath(tmpDir, 'report.txt');
      assert.equal(path.basename(uniquePath2), 'report (2).txt');

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('DownloadManager Controls', () => {
    it('supports pause, resume, cancel on active downloads', () => {
      let emitted = [];
      const dm = new DownloadManager({
        sendToTrustedUI: (ch, data) => emitted.push({ ch, data })
      });

      let paused = false;
      let resumed = false;
      let cancelled = false;

      const mockItem = {
        pause: () => { paused = true; },
        resume: () => { resumed = true; },
        cancel: () => { cancelled = true; }
      };

      dm.activeDownloads.set('dl-1', {
        downloadId: 'dl-1',
        item: mockItem,
        state: 'progressing',
        progress: 50,
        filename: 'test.zip',
        isDangerous: false
      });

      dm.pause('dl-1');
      assert.equal(paused, true);

      dm.resume('dl-1');
      assert.equal(resumed, true);

      dm.cancel('dl-1');
      assert.equal(cancelled, true);
    });
  });
});
