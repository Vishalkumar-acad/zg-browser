/**
 * Security Test Suite: zg:// Custom Scheme Resolution & Path Traversal Rejection
 * Single Source of Truth: Blueprint v2.3 Section 4.2
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveZgUrl } = require('../../src/main/protocol-handler');

const MOCK_RENDERER_DIR = path.resolve(__dirname, '../../src/renderer');

describe('zg:// Scheme Security & Directory Traversal Defense', () => {
  it('allows valid packaged asset requests to zg://ui', () => {
    const result = resolveZgUrl('zg://ui/index.html', MOCK_RENDERER_DIR);
    assert.equal(result.valid, true);
    assert.equal(result.mimeType, 'text/html; charset=utf-8');
    assert.equal(result.resolvedPath, path.join(MOCK_RENDERER_DIR, 'index.html'));
  });

  it('allows valid packaged asset requests with subdirectory', () => {
    const result = resolveZgUrl('zg://ui/styles/main.css', MOCK_RENDERER_DIR);
    assert.equal(result.valid, true);
    assert.equal(result.mimeType, 'text/css; charset=utf-8');
    assert.equal(result.resolvedPath, path.join(MOCK_RENDERER_DIR, 'styles', 'main.css'));
  });

  it('rejects raw directory traversal (..)', () => {
    const result = resolveZgUrl('zg://ui/../../package.json', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
    assert.match(result.error, /traversal/i);
  });

  it('rejects URL-encoded directory traversal (%2e%2e)', () => {
    const result = resolveZgUrl('zg://ui/%2e%2e/%2e%2e/package.json', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
    assert.match(result.error, /traversal/i);
  });

  it('rejects mixed encoded directory traversal (%2e.)', () => {
    const result = resolveZgUrl('zg://ui/%2e./secret.txt', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
  });

  it('rejects unauthorized host (e.g. zg://evil.com)', () => {
    const result = resolveZgUrl('zg://evil.com/index.html', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
    assert.match(result.error, /unauthorized host/i);
  });

  it('rejects requests specifying ports (e.g. zg://ui:8080/index.html)', () => {
    const result = resolveZgUrl('zg://ui:8080/index.html', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
    assert.match(result.error, /port/i);
  });

  it('rejects non-zg schemes', () => {
    const resultHttp = resolveZgUrl('http://ui/index.html', MOCK_RENDERER_DIR);
    assert.equal(resultHttp.valid, false);
    assert.equal(resultHttp.statusCode, 403);

    const resultFile = resolveZgUrl('file:///etc/passwd', MOCK_RENDERER_DIR);
    assert.equal(resultFile.valid, false);
    assert.equal(resultFile.statusCode, 403);
  });

  it('rejects null bytes in URL path', () => {
    const result = resolveZgUrl('zg://ui/index.html%00.png', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
  });

  it('rejects backslashes in URL path', () => {
    const result = resolveZgUrl('zg://ui/..\\..\\secret', MOCK_RENDERER_DIR);
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
  });

  it('handles empty or malformed URLs gracefully', () => {
    const resEmpty = resolveZgUrl('', MOCK_RENDERER_DIR);
    assert.equal(resEmpty.valid, false);
    assert.equal(resEmpty.statusCode, 400);

    const resNull = resolveZgUrl(null, MOCK_RENDERER_DIR);
    assert.equal(resNull.valid, false);
    assert.equal(resNull.statusCode, 400);

    const resMalformed = resolveZgUrl('zg://', MOCK_RENDERER_DIR);
    assert.equal(resMalformed.valid, false);
  });
});
