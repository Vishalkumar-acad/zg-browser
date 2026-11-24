/**
 * Security Test Suite: Secrets Manager & safeStorage Encryption Guard
 * Single Source of Truth: Blueprint v2.3 Section 2.2 & 4.8
 * 
 * Verifies that safeStorage.isEncryptionAvailable() is strictly enforced.
 * STRICT SECURITY INVARIANT (FAIL-CLOSED):
 * If OS encryption is unavailable (e.g. Linux without OS keyring),
 * credential storage is REFUSED. Plaintext storage is NEVER allowed.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SecretsManager } = require('../../src/main/secrets-manager');

describe('Secrets Manager & safeStorage OS Encryption Guard', () => {
  // Test Harness with mock storage engine
  function createHarness(encryptionAvailable = true) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-secrets-test-'));
    const credentialsPath = path.join(tmpDir, 'credentials.enc');

    const mockStorageEngine = {
      isEncryptionAvailable: () => encryptionAvailable,
      encryptString: (str) => Buffer.from(`ENC[${str}]`, 'utf8'),
      decryptString: (buf) => {
        const str = buf.toString('utf8');
        return str.replace(/^ENC\[/, '').replace(/\]$/, '');
      }
    };

    const manager = new SecretsManager({
      storageEngine: mockStorageEngine,
      credentialsPath
    });

    return {
      manager,
      tmpDir,
      credentialsPath,
      mockStorageEngine
    };
  }

  it('FAIL-CLOSED: Refuses to store credentials and rejects plaintext when OS encryption is unavailable', () => {
    // Simulate Linux headless environment without OS keyring (encryptionAvailable: false)
    const { manager, tmpDir, credentialsPath } = createHarness(false);

    assert.equal(manager.isAvailable(), false);

    const result = manager.setSecret('github_token', 'ghp_secret_token_12345');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'OS_ENCRYPTION_UNAVAILABLE');
    assert.match(result.message, /plaintext/i);

    // Verify ZERO credentials exist in memory or on disk
    assert.equal(manager.hasSecret('github_token'), false);
    assert.equal(manager.getSecret('github_token'), null);
    assert.equal(fs.existsSync(credentialsPath), false);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('encrypts credentials using safeStorage when OS encryption is available', () => {
    const { manager, tmpDir, credentialsPath } = createHarness(true);

    assert.equal(manager.isAvailable(), true);

    const result = manager.setSecret('github_token', 'ghp_super_secret_pat_9999');
    assert.equal(result.ok, true);

    // Verify encrypted file was written to disk
    assert.equal(fs.existsSync(credentialsPath), true);
    const diskContent = fs.readFileSync(credentialsPath, 'utf8');

    // STRICT VERIFICATION: Plaintext token MUST NOT appear on disk
    assert.equal(diskContent.includes('ghp_super_secret_pat_9999'), false);

    // Verify recovery via decrypt
    const recovered = manager.getSecret('github_token');
    assert.equal(recovered, 'ghp_super_secret_pat_9999');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes secret completely and updates disk storage', () => {
    const { manager, tmpDir, credentialsPath } = createHarness(true);

    manager.setSecret('github_token', 'token-to-delete');
    assert.equal(manager.hasSecret('github_token'), true);

    const deleted = manager.deleteSecret('github_token');
    assert.equal(deleted, true);
    assert.equal(manager.hasSecret('github_token'), false);
    assert.equal(manager.getSecret('github_token'), null);

    const diskRaw = fs.readFileSync(credentialsPath, 'utf8');
    const diskParsed = JSON.parse(diskRaw);
    assert.equal(diskParsed['github_token'], undefined);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('clearAll removes store and unlinks file from disk on full logout', () => {
    const { manager, tmpDir, credentialsPath } = createHarness(true);

    manager.setSecret('k1', 'val1');
    assert.equal(fs.existsSync(credentialsPath), true);

    manager.clearAll();
    assert.equal(manager.hasSecret('k1'), false);
    assert.equal(fs.existsSync(credentialsPath), false);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
