/**
 * Zero-Gravity Browser (zg-browser) - Secrets Manager
 * Single Source of Truth: Blueprint v2.3 Section 2.2, 4.8 & 5
 * 
 * Manages encrypted credential storage at rest using Electron safeStorage.
 * STRICT SECURITY INVARIANT (FAIL-CLOSED):
 * Always verifies safeStorage.isEncryptionAvailable().
 * On platforms (like headless Linux without OS keyring) where encryption is unavailable,
 * explicitly warns and REFUSES to store credentials. NEVER silently falls back to plaintext.
 */

const fs = require('fs');
const path = require('path');

let electron;
try {
  electron = require('electron');
} catch {
  electron = {};
}
const { safeStorage, app } = electron;

class SecretsManager {
  /**
   * @param {Object} [options]
   * @param {import('electron').SafeStorage} [options.storageEngine] - Injectable safeStorage for tests
   * @param {string} [options.credentialsPath] - Path to encrypted credentials file
   */
  constructor({ storageEngine, credentialsPath } = {}) {
    this.storageEngine = storageEngine || safeStorage;

    const defaultDir = app && typeof app.getPath === 'function' ? app.getPath('userData') : '/tmp';
    this.credentialsPath = credentialsPath || path.join(defaultDir, 'credentials.enc');

    // In-memory cache of encrypted buffers: key -> Buffer
    this.encryptedStore = new Map();
    this.loadStore();
  }

  /**
   * Checks whether the underlying OS keychain / encryption backend is available
   * @returns {boolean}
   */
  isAvailable() {
    if (!this.storageEngine || typeof this.storageEngine.isEncryptionAvailable !== 'function') {
      return false;
    }
    return this.storageEngine.isEncryptionAvailable();
  }

  /**
   * Loads existing encrypted blobs from disk
   */
  loadStore() {
    if (!this.credentialsPath) return;

    try {
      if (fs.existsSync(this.credentialsPath)) {
        const raw = fs.readFileSync(this.credentialsPath, 'utf8');
        const parsed = JSON.parse(raw);

        if (typeof parsed === 'object' && parsed !== null) {
          for (const [key, hexStr] of Object.entries(parsed)) {
            if (typeof hexStr === 'string') {
              this.encryptedStore.set(key, Buffer.from(hexStr, 'hex'));
            }
          }
        }
      }
    } catch {
      // Retain empty in-memory store
      this.encryptedStore.clear();
    }
  }

  /**
   * Persists encrypted blobs to disk (hex encoded)
   */
  saveStore() {
    if (!this.credentialsPath) return;

    try {
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const obj = {};
      for (const [key, buffer] of this.encryptedStore.entries()) {
        obj[key] = buffer.toString('hex');
      }

      fs.writeFileSync(this.credentialsPath, JSON.stringify(obj, null, 2), {
        encoding: 'utf8',
        mode: 0o600 // Strict user-only read/write permissions
      });
    } catch {
      // Log or suppress write errors safely without leaking keys
    }
  }

  /**
   * Encrypts and stores a secret string
   * STRICT FAIL-CLOSED: Refuses storage if OS encryption is unavailable.
   * 
   * @param {string} key
   * @param {string} secretPlaintext
   * @returns {{ ok: boolean, error?: string }}
   */
  setSecret(key, secretPlaintext) {
    if (!key || typeof key !== 'string') {
      return { ok: false, error: 'INVALID_KEY' };
    }

    if (typeof secretPlaintext !== 'string' || !secretPlaintext) {
      return { ok: false, error: 'INVALID_SECRET' };
    }

    // 1. Mandatory safeStorage encryption check
    if (!this.isAvailable()) {
      return {
        ok: false,
        error: 'OS_ENCRYPTION_UNAVAILABLE',
        message: 'OS keychain encryption is unavailable. Storing credentials in plaintext is strictly prohibited.'
      };
    }

    try {
      // 2. Encrypt with OS keychain
      const encryptedBuffer = this.storageEngine.encryptString(secretPlaintext);
      this.encryptedStore.set(key, encryptedBuffer);
      this.saveStore();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: 'ENCRYPTION_FAILED',
        message: 'Failed to encrypt secret using OS keychain'
      };
    }
  }

  /**
   * Decrypts and retrieves a secret string into Main Process memory.
   * NEVER expose decrypted secrets to Renderer!
   * 
   * @param {string} key
   * @returns {string|null} Decrypted secret or null if not found
   */
  getSecret(key) {
    if (!this.encryptedStore.has(key)) {
      return null;
    }

    if (!this.isAvailable()) {
      return null;
    }

    const encryptedBuffer = this.encryptedStore.get(key);
    try {
      return this.storageEngine.decryptString(encryptedBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Checks if a secret exists without decrypting it
   * @param {string} key
   * @returns {boolean}
   */
  hasSecret(key) {
    return this.encryptedStore.has(key);
  }

  /**
   * Deletes a secret from storage
   * @param {string} key
   * @returns {boolean}
   */
  deleteSecret(key) {
    const deleted = this.encryptedStore.delete(key);
    if (deleted) {
      this.saveStore();
    }
    return deleted;
  }

  /**
   * Clears all stored credentials (e.g. on full logout)
   */
  clearAll() {
    this.encryptedStore.clear();
    if (this.credentialsPath && fs.existsSync(this.credentialsPath)) {
      try {
        fs.unlinkSync(this.credentialsPath);
      } catch {}
    }
  }
}

module.exports = { SecretsManager };
