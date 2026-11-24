/**
 * Security Test Suite: 5-Step Frame-Aware IPC Validation Pipeline
 * Single Source of Truth: Blueprint v2.3 Section 6.1
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createValidatedHandler,
  validateSenderWebContents,
  validateSenderFrame,
  validatePayload
} = require('../../src/main/ipc-validator');
const { IPC_CHANNELS } = require('../../src/shared/ipc-channels');

describe('5-Step Frame-Aware IPC Validation Pipeline', () => {
  // Mock WebContents
  const mockTrustedWebContents = {
    id: 1,
    isDestroyed: () => false
  };

  const mockDestroyedWebContents = {
    id: 1,
    isDestroyed: () => true
  };

  const mockUntrustedWebContents = {
    id: 99,
    isDestroyed: () => false
  };

  // Step 1: Sender WebContents Authentication
  describe('Step 1: Sender WebContents Authentication', () => {
    it('approves registered Trusted UI WebContents', () => {
      const event = { sender: mockTrustedWebContents };
      const res = validateSenderWebContents(event, mockTrustedWebContents);
      assert.equal(res.valid, true);
    });

    it('rejects foreign or untrusted WebContents sender', () => {
      const event = { sender: mockUntrustedWebContents };
      const res = validateSenderWebContents(event, mockTrustedWebContents);
      assert.equal(res.valid, false);
      assert.match(res.error, /not the registered trusted ui/i);
    });

    it('rejects destroyed WebContents', () => {
      const event = { sender: mockDestroyedWebContents };
      const res = validateSenderWebContents(event, mockDestroyedWebContents);
      assert.equal(res.valid, false);
      assert.match(res.error, /destroyed/i);
    });

    it('rejects missing or null event', () => {
      const res = validateSenderWebContents(null, mockTrustedWebContents);
      assert.equal(res.valid, false);
    });
  });

  // Step 2: Sender Frame & Origin Authentication
  describe('Step 2: Sender Frame & Origin Authentication', () => {
    it('approves top-level main frame with zg://ui origin', () => {
      const event = {
        senderFrame: {
          parent: null,
          url: 'zg://ui/index.html'
        }
      };
      const res = validateSenderFrame(event);
      assert.equal(res.valid, true);
    });

    it('rejects child frames and iframes (parent !== null)', () => {
      const event = {
        senderFrame: {
          parent: { url: 'zg://ui/index.html' }, // is an iframe/child
          url: 'zg://ui/index.html'
        }
      };
      const res = validateSenderFrame(event);
      assert.equal(res.valid, false);
      assert.match(res.error, /iframe rejected/i);
    });

    it('rejects external website origins (e.g. https://evil.com)', () => {
      const event = {
        senderFrame: {
          parent: null,
          url: 'https://evil.com/malicious.html'
        }
      };
      const res = validateSenderFrame(event);
      assert.equal(res.valid, false);
      assert.match(res.error, /unauthorized sender protocol/i);
    });

    it('rejects unauthorized internal host (e.g. zg://untrusted-host)', () => {
      const event = {
        senderFrame: {
          parent: null,
          url: 'zg://untrusted-host/page.html'
        }
      };
      const res = validateSenderFrame(event);
      assert.equal(res.valid, false);
      assert.match(res.error, /unauthorized sender host/i);
    });
  });

  // Step 3: Schema & Size Validation (reject unexpected properties)
  describe('Step 3: Schema & Size Validation', () => {
    it('validates tab:close payload with valid tabId', () => {
      const res = validatePayload(IPC_CHANNELS.TAB_CLOSE, { tabId: 'tab-123' });
      assert.equal(res.valid, true);
    });

    it('rejects tab:close payload with unexpected extra keys (parameter injection)', () => {
      const res = validatePayload(IPC_CHANNELS.TAB_CLOSE, {
        tabId: 'tab-123',
        extraField: 'exploit',
        __proto__: { admin: true }
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /unexpected property/i);
    });

    it('rejects nav:go when url is missing or not a string', () => {
      const resMissing = validatePayload(IPC_CHANNELS.NAV_GO, { tabId: 'tab-1' });
      assert.equal(resMissing.valid, false);

      const resBadType = validatePayload(IPC_CHANNELS.NAV_GO, { tabId: 'tab-1', url: 12345 });
      assert.equal(resBadType.valid, false);
    });

    it('rejects payloads exceeding size limits', () => {
      const hugeString = 'A'.repeat(2 * 1024 * 1024); // 2MB string
      const res = validatePayload(IPC_CHANNELS.TAB_CREATE, { url: hugeString });
      assert.equal(res.valid, false);
      assert.match(res.error, /exceeds limit/i);
    });
  });

  // Full 5-Step Pipeline Integration
  describe('Full 5-Step Pipeline Integration with createValidatedHandler', () => {
    it('executes cleanly and returns standardized { ok: true, data }', async () => {
      const handler = createValidatedHandler(
        IPC_CHANNELS.UI_TOGGLE_OVERLAY,
        async (payload) => ({ visible: payload.visible }),
        { getTrustedUIWebContents: () => mockTrustedWebContents }
      );

      const validEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };

      const result = await handler(validEvent, { overlayId: 'omnibar', visible: true });
      assert.equal(result.ok, true);
      assert.deepEqual(result.data, { visible: true });
    });

    it('fails closed with UNAUTHORIZED_SENDER on foreign sender', async () => {
      const handler = createValidatedHandler(
        IPC_CHANNELS.UI_TOGGLE_OVERLAY,
        async () => ({ success: true }),
        { getTrustedUIWebContents: () => mockTrustedWebContents }
      );

      const invalidEvent = {
        sender: mockUntrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };

      const result = await handler(invalidEvent, { overlayId: 'omnibar', visible: true });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'UNAUTHORIZED_SENDER');
    });

    it('fails closed with UNAUTHORIZED_FRAME when originating from an iframe', async () => {
      const handler = createValidatedHandler(
        IPC_CHANNELS.UI_TOGGLE_OVERLAY,
        async () => ({ success: true }),
        { getTrustedUIWebContents: () => mockTrustedWebContents }
      );

      const iframeEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: { url: 'zg://ui/index.html' }, url: 'zg://ui/index.html' }
      };

      const result = await handler(iframeEvent, { overlayId: 'omnibar', visible: true });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'UNAUTHORIZED_FRAME');
    });

    it('fails closed with INVALID_PAYLOAD on schema breach', async () => {
      const handler = createValidatedHandler(
        IPC_CHANNELS.UI_TOGGLE_OVERLAY,
        async () => ({ success: true }),
        { getTrustedUIWebContents: () => mockTrustedWebContents }
      );

      const validEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };

      // Invalid overlayId
      const result = await handler(validEvent, { overlayId: 'malicious-overlay', visible: true });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'INVALID_PAYLOAD');
    });

    it('fails closed with sanitized error when handler throws exception', async () => {
      const handler = createValidatedHandler(
        IPC_CHANNELS.UI_TOGGLE_OVERLAY,
        async () => {
          throw new Error('Database failed at /home/user/.secret with token ghp_1234567890abcdef12345');
        },
        { getTrustedUIWebContents: () => mockTrustedWebContents }
      );

      const validEvent = {
        sender: mockTrustedWebContents,
        senderFrame: { parent: null, url: 'zg://ui/index.html' }
      };

      const result = await handler(validEvent, { overlayId: 'omnibar', visible: true });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'EXECUTION_ERROR');
      // Token must NOT be leaked
      assert.equal(result.error.message.includes('ghp_1234567890abcdef12345'), false);
      assert.match(result.error.message, /\[REDACTED\]/);
    });
  });
});
