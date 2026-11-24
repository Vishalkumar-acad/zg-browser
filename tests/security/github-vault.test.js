/**
 * Security Test Suite: GitHub Vault Synchronization & Path Traversal Pipeline
 * Single Source of Truth: Blueprint v2.3 Section 4.8
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  GitHubService,
  normalizeVaultPath,
  generateDiff
} = require('../../src/main/github-service');
const { SecretsManager } = require('../../src/main/secrets-manager');

describe('GitHub Vault Synchronization & Security Pipeline', () => {
  // Test Harness
  function createHarness() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-gh-vault-test-'));
    const credentialsPath = path.join(tmpDir, 'credentials.enc');

    const mockStorageEngine = {
      isEncryptionAvailable: () => true,
      encryptString: (str) => Buffer.from(str, 'utf8'),
      decryptString: (buf) => buf.toString('utf8')
    };

    const secretsManager = new SecretsManager({
      storageEngine: mockStorageEngine,
      credentialsPath
    });

    let currentRepo = 'Vishalkumar-acad/test-vault';
    const settingsManager = {
      getSettings: () => ({ githubRepo: currentRepo }),
      updateSettings: (patch) => {
        if (patch.githubRepo) currentRepo = patch.githubRepo;
        return { githubRepo: currentRepo };
      }
    };

    // Mock fetch tracking requests
    let mockFetchResponses = new Map();
    let recordedRequests = [];

    const mockFetch = async (url, opts = {}) => {
      recordedRequests.push({ url, method: opts.method || 'GET', headers: opts.headers, body: opts.body });

      const responseConfig = mockFetchResponses.get(url) || { status: 200, data: {} };
      return {
        ok: responseConfig.status >= 200 && responseConfig.status < 300,
        status: responseConfig.status,
        json: async () => responseConfig.data,
        text: async () => JSON.stringify(responseConfig.data)
      };
    };

    const service = new GitHubService({
      secretsManager,
      settingsManager,
      fetchFn: mockFetch
    });

    return {
      service,
      secretsManager,
      settingsManager,
      mockFetchResponses,
      getRecordedRequests: () => recordedRequests,
      cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true })
    };
  }

  // 1. Strict .zg-vault/ Path Validation Pipeline
  describe('Strict .zg-vault/ Path Validation Pipeline', () => {
    it('accepts normalized paths strictly starting with .zg-vault/', () => {
      const res = normalizeVaultPath('.zg-vault/notes/ideas.md');
      assert.equal(res.valid, true);
      assert.equal(res.normalizedPath, '.zg-vault/notes/ideas.md');
    });

    it('rejects paths without .zg-vault/ prefix (boundary escaping)', () => {
      const res1 = normalizeVaultPath('notes/ideas.md');
      assert.equal(res1.valid, false);
      assert.match(res1.error, /must start with/i);

      const res2 = normalizeVaultPath('/etc/passwd');
      assert.equal(res2.valid, false);
    });

    it('rejects raw directory traversal (..)', () => {
      const res = normalizeVaultPath('.zg-vault/../../etc/passwd');
      assert.equal(res.valid, false);
      assert.match(res.error, /traversal/i);
    });

    it('rejects URL-encoded directory traversal (%2e%2e, %2e., .%2e)', () => {
      assert.equal(normalizeVaultPath('.zg-vault/%2e%2e/%2e%2e/secret').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/%2e./secret').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/.%2e/secret').valid, false);
    });

    it('rejects backslashes, double slashes, and control characters', () => {
      assert.equal(normalizeVaultPath('.zg-vault/..\\..\\secret').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault//double-slash.md').valid, false);
      assert.equal(normalizeVaultPath('.zg-vault/null\0byte.md').valid, false);
    });

    it('rejects empty, null, or excessively long paths', () => {
      assert.equal(normalizeVaultPath('').valid, false);
      assert.equal(normalizeVaultPath(null).valid, false);

      const hugePath = '.zg-vault/' + 'a'.repeat(2000) + '.md';
      assert.equal(normalizeVaultPath(hugePath).valid, false);
    });
  });

  // 2. Token Non-Disclosure & Authentication Flow
  describe('Token Non-Disclosure & Authentication Flow', () => {
    it('authStart never exposes confidential OAuth device_code to Renderer', async () => {
      const { service, mockFetchResponses, cleanup } = createHarness();

      mockFetchResponses.set('https://github.com/login/device/code', {
        status: 200,
        data: {
          verification_uri: 'https://github.com/login/device',
          user_code: 'WDJB-MJHT',
          device_code: 'sensitive_device_code_12345'
        }
      });

      const result = await service.authStart();
      assert.ok(result.verificationUri);
      assert.equal(result.userCode, 'WDJB-MJHT');
      assert.equal(result.device_code, undefined, 'device_code MUST NEVER be exposed');

      cleanup();
    });

    it('authPatSubmit encrypts token and NEVER returns the token string', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();

      // Mock GitHub /user response for validation
      mockFetchResponses.set('https://api.github.com/user', {
        status: 200,
        data: { login: 'developer-user' }
      });

      const pat = 'ghp_SampleSecretToken9876543210ABCDEF';
      const result = await service.authPatSubmit(pat);

      assert.equal(result.saved, true);
      assert.equal(result.token, undefined, 'Token MUST NEVER be returned to Renderer');

      // Verify token is encrypted in SecretsManager
      assert.equal(secretsManager.hasSecret('github_token'), true);
      assert.equal(secretsManager.getSecret('github_token'), pat);

      // Verify status returns non-secret info only
      const status = await service.getStatus();
      assert.equal(status.authenticated, true);
      assert.equal(status.user, 'developer-user');
      assert.equal(status.token, undefined);

      cleanup();
    });

    it('authLogout completely wipes stored credentials', async () => {
      const { service, secretsManager, cleanup } = createHarness();

      secretsManager.setSecret('github_token', 'test-token');
      assert.equal(secretsManager.hasSecret('github_token'), true);

      const logoutRes = await service.authLogout();
      assert.equal(logoutRes.ok, true);
      assert.equal(secretsManager.hasSecret('github_token'), false);

      const status = await service.getStatus();
      assert.equal(status.authenticated, false);

      cleanup();
    });
  });

  // 3. GitHub REST API v3 Operations & HTTP Error Handling
  describe('GitHub Vault REST API Operations & Error Handling', () => {
    it('pull decodes Base64 UTF-8 content and returns sha', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'valid-token');

      const expectedContent = '# Daily Scratchpad Notes\n- Task 1';
      const base64 = Buffer.from(expectedContent, 'utf8').toString('base64');

      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/notes.md', {
        status: 200,
        data: {
          content: base64,
          sha: 'sha-abc-123'
        }
      });

      const pulled = await service.pull('.zg-vault/notes.md');
      assert.equal(pulled.content, expectedContent);
      assert.equal(pulled.sha, 'sha-abc-123');

      cleanup();
    });

    it('handles HTTP 404 (file not found) gracefully', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'valid-token');

      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/missing.md', {
        status: 404,
        data: { message: 'Not Found' }
      });

      await assert.rejects(async () => {
        await service.pull('.zg-vault/missing.md');
      }, /404/);

      cleanup();
    });

    it('handles HTTP 401 unauthorized gracefully', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'expired-token');

      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/notes.md', {
        status: 401,
        data: { message: 'Bad credentials' }
      });

      await assert.rejects(async () => {
        await service.pull('.zg-vault/notes.md');
      }, /401/);

      cleanup();
    });

    it('handles HTTP 403 forbidden gracefully', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'valid-token');

      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/notes.md', {
        status: 403,
        data: { message: 'Must have push access' }
      });

      await assert.rejects(async () => {
        await service.pull('.zg-vault/notes.md');
      }, /403/);

      cleanup();
    });

    it('handles HTTP 429 rate limit exceeded gracefully', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'valid-token');

      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/notes.md', {
        status: 429,
        data: { message: 'Rate limit exceeded' }
      });

      await assert.rejects(async () => {
        await service.pull('.zg-vault/notes.md');
      }, /429/);

      cleanup();
    });

    it('handles HTTP 409 conflict and preserves local content without blind overwrite', async () => {
      const { service, secretsManager, mockFetchResponses, cleanup } = createHarness();
      secretsManager.setSecret('github_token', 'valid-token');

      // Pre-update sha lookup succeeds with existing remote file
      const base64 = Buffer.from('old remote content', 'utf8').toString('base64');
      mockFetchResponses.set('https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/conflict.md', {
        status: 200,
        data: { content: base64, sha: 'old-sha' }
      });

      // But when PUT is attempted, GitHub returns 409 Conflict (e.g. concurrent push from another client)
      const putUrl = 'https://api.github.com/repos/Vishalkumar-acad/test-vault/contents/.zg-vault/conflict.md';
      // To simulate PUT failure specifically, we can dynamically override response
      const originalFetch = service.fetch;
      service.fetch = async (url, opts) => {
        if (opts && opts.method === 'PUT') {
          return { ok: false, status: 409, json: async () => ({ message: 'Conflict' }) };
        }
        return originalFetch(url, opts);
      };

      await assert.rejects(async () => {
        await service.push('.zg-vault/conflict.md', 'my local unsaved edits', 'Update');
      }, /CONFLICT/);

      cleanup();
    });

    it('generates line-by-line diff preview cleanly', () => {
      const oldText = 'alpha\nbeta\ngamma';
      const newText = 'alpha\nbeta modified\ngamma\ndelta';

      const diff = generateDiff(oldText, newText);
      assert.ok(diff.includes('  alpha'));
      assert.ok(diff.includes('- beta'));
      assert.ok(diff.includes('+ beta modified'));
      assert.ok(diff.includes('+ delta'));
    });
  });
});
