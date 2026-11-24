/**
 * Zero-Gravity Browser (zg-browser) - Protocol Handler
 * Single Source of Truth: Blueprint v2.3 Section 4.2
 * 
 * Enforces strict allowlisted asset resolution for zg:// custom scheme.
 * Defends against path traversal, encoded traversal, and unauthorized filesystem access.
 */

const path = require('path');
const fs = require('fs');
const { SCHEME, TRUSTED_HOSTS, DEFAULT_TRUSTED_URL } = require('../shared/constants');

// MIME type map for packaged assets
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
});

// Strict Content Security Policy for Trusted UI
const TRUSTED_UI_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

/**
 * Registers zg:// scheme as privileged before app.whenReady()
 * @param {import('electron').protocol} protocolModule
 */
function registerPrivilegedSchemes(protocolModule) {
  if (!protocolModule || typeof protocolModule.registerSchemesAsPrivileged !== 'function') {
    return;
  }
  protocolModule.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

/**
 * Resolves and validates a zg:// URL into a safe filesystem path.
 * Returns { valid: true, resolvedPath, mimeType } or { valid: false, error, statusCode }
 * Pure function designed for both runtime and unit testing.
 * 
 * @param {string} urlString - The requested URL string
 * @param {string} baseDir - The root renderer directory allowed for zg:// assets
 */
function resolveZgUrl(urlString, baseDir) {
  if (typeof urlString !== 'string' || !urlString) {
    return { valid: false, error: 'Empty URL', statusCode: 400 };
  }

  // Reject raw or encoded path traversal strings before URL parsing
  if (urlString.includes('..') || /%2e\.|\.%2e|%2e%2e/i.test(urlString)) {
    return { valid: false, error: 'Directory traversal rejected', statusCode: 403 };
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    return { valid: false, error: 'Malformed URL', statusCode: 400 };
  }

  // Scheme must be zg:
  if (parsed.protocol !== `${SCHEME}:`) {
    return { valid: false, error: `Invalid scheme: ${parsed.protocol}`, statusCode: 403 };
  }

  // Host must be in TRUSTED_HOSTS
  const host = parsed.hostname || parsed.host;
  if (!TRUSTED_HOSTS.includes(host)) {
    return { valid: false, error: `Unauthorized host: ${host}`, statusCode: 403 };
  }

  // Port is not permitted for internal zg:// scheme
  if (parsed.port) {
    return { valid: false, error: 'Port not permitted for internal scheme', statusCode: 403 };
  }

  // Normalize path
  let relativePath = parsed.pathname;
  if (!relativePath || relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  // Decode URI components safely
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(relativePath);
  } catch (err) {
    return { valid: false, error: 'Malformed path encoding', statusCode: 400 };
  }

  // Defend against directory traversal in decoded path (catches %2e., .%2e, etc.)
  if (decodedPath.includes('..')) {
    return { valid: false, error: 'Directory traversal rejected', statusCode: 403 };
  }

  // Defend against null bytes and backslashes
  if (decodedPath.includes('\0') || decodedPath.includes('\\')) {
    return { valid: false, error: 'Illegal characters in path', statusCode: 403 };
  }

  // Normalize and resolve against baseDir
  const normalizedBase = path.resolve(baseDir);
  const targetPath = path.resolve(normalizedBase, '.' + decodedPath);

  // Enforce boundary containment: targetPath must start with normalizedBase + path.sep
  if (targetPath !== normalizedBase && !targetPath.startsWith(normalizedBase + path.sep)) {
    return { valid: false, error: 'Path escapes authorized base directory', statusCode: 403 };
  }

  const ext = path.extname(targetPath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  return {
    valid: true,
    resolvedPath: targetPath,
    mimeType
  };
}

/**
 * Sets up the Electron protocol.handle for zg://
 * @param {import('electron').protocol} protocolModule
 * @param {string} rendererDir - Path to renderer assets
 */
function setupProtocolHandler(protocolModule, rendererDir) {
  if (!protocolModule || typeof protocolModule.handle !== 'function') {
    return;
  }

  protocolModule.handle(SCHEME, async (request) => {
    const resolution = resolveZgUrl(request.url, rendererDir);

    if (!resolution.valid) {
      return new Response(
        JSON.stringify({ error: resolution.error, code: resolution.statusCode }),
        {
          status: resolution.statusCode,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Security-Policy': TRUSTED_UI_CSP
          }
        }
      );
    }

    try {
      const stats = await fs.promises.stat(resolution.resolvedPath);
      if (!stats.isFile()) {
        return new Response('Not Found', {
          status: 404,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Security-Policy': TRUSTED_UI_CSP
          }
        });
      }

      const fileBuffer = await fs.promises.readFile(resolution.resolvedPath);
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': resolution.mimeType,
          'Content-Security-Policy': TRUSTED_UI_CSP,
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch (err) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Security-Policy': TRUSTED_UI_CSP
        }
      });
    }
  });
}

module.exports = {
  registerPrivilegedSchemes,
  resolveZgUrl,
  setupProtocolHandler,
  TRUSTED_UI_CSP,
  MIME_TYPES
};
