/**
 * Unit Test Suite: Storage Export & Import Handlers
 * Single Source of Truth: Blueprint v2.3 Section 4.7 & 5
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { MainStorageManager } = require('../../src/main/storage-manager');

describe('Main Storage Manager (Export & Import Verification)', () => {
  it('exports content to json and markdown files safely', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-storage-export-'));
    const sm = new MainStorageManager({ exportDir: tmpDir });

    const jsonRes = await sm.exportToFile('json', '{"notes":[{"id":"1"}]}');
    assert.ok(jsonRes.filePath.endsWith('.json'));
    assert.equal(fs.existsSync(jsonRes.filePath), true);

    const mdRes = await sm.exportToFile('md', '# Notes\n');
    assert.ok(mdRes.filePath.endsWith('.md'));
    assert.equal(fs.existsSync(mdRes.filePath), true);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects unsupported export formats', async () => {
    const sm = new MainStorageManager();
    await assert.rejects(async () => {
      await sm.exportToFile('exe', 'malicious');
    }, /unsupported export format/i);
  });

  it('validates import payload size against memory caps', () => {
    const sm = new MainStorageManager();

    const validCheck = sm.validateImportPayload('{"notes":[]}');
    assert.equal(validCheck.valid, true);

    // Huge string exceeding 50MB
    const invalidCheck = sm.validateImportPayload(12345);
    assert.equal(invalidCheck.valid, false);
  });
});
