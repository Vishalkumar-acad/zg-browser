/**
 * Zero-Gravity Browser (zg-browser) - IPC Validator Pipeline
 * Single Source of Truth: Blueprint v2.3 Section 6.1
 * 
 * Enforces the Mandatory 5-Step Frame-Aware IPC Validation Pipeline:
 * 1. Sender WebContents Authentication
 * 2. Sender Frame & Origin Authentication (reject iframes, popups, external schemes)
 * 3. Schema & Size Validation (reject unexpected keys, validate caps)
 * 4. Resource & Capability Authorization
 * 5. Execution & Sanitized Structured Response { ok, data | error }
 */

const { SCHEME, TRUSTED_HOSTS } = require('../shared/constants');
const { validateChannelPayload } = require('../shared/schemas');

/**
 * Step 1: Verify sender matches the registered Trusted UI WebContents
 * @param {import('electron').IpcMainInvokeEvent} event
 * @param {import('electron').WebContents} trustedUIWebContents
 */
function validateSenderWebContents(event, trustedUIWebContents) {
  if (!event || !event.sender) {
    return { valid: false, error: 'Missing IPC sender event' };
  }

  if (!trustedUIWebContents || trustedUIWebContents.isDestroyed()) {
    return { valid: false, error: 'Trusted UI WebContents not available or destroyed' };
  }

  if (event.sender !== trustedUIWebContents) {
    return { valid: false, error: 'IPC sender is not the registered Trusted UI' };
  }

  return { valid: true };
}

/**
 * Step 2: Verify sender frame is the main frame, origin is zg:// and route is allowlisted
 * @param {import('electron').IpcMainInvokeEvent} event
 */
function validateSenderFrame(event) {
  const frame = event.senderFrame;
  if (!frame) {
    return { valid: false, error: 'Missing senderFrame on IPC event' };
  }

  // Reject child frames / iframes (senderFrame must be top/main frame)
  if (frame.parent !== null) {
    return { valid: false, error: 'IPC from child frame/iframe rejected' };
  }

  // Verify URL origin and scheme
  const frameUrl = frame.url;
  if (typeof frameUrl !== 'string' || !frameUrl) {
    return { valid: false, error: 'Invalid or missing senderFrame URL' };
  }

  let parsed;
  try {
    parsed = new URL(frameUrl);
  } catch {
    return { valid: false, error: 'Malformed senderFrame URL' };
  }

  if (parsed.protocol !== `${SCHEME}:`) {
    return { valid: false, error: `Unauthorized sender protocol: ${parsed.protocol}` };
  }

  const host = parsed.hostname || parsed.host;
  if (!TRUSTED_HOSTS.includes(host)) {
    return { valid: false, error: `Unauthorized sender host: ${host}` };
  }

  return { valid: true };
}

/**
 * Step 3: Schema & Size Validation
 * @param {string} channel
 * @param {any} payload
 */
function validatePayload(channel, payload) {
  return validateChannelPayload(channel, payload);
}

/**
 * Sanitizes error messages for Step 5
 * @param {Error|string} err
 */
function sanitizeErrorMessage(err) {
  if (!err) return 'Unknown error occurred';
  const msg = typeof err === 'string' ? err : err.message || 'Operation failed';
  // Strip potential paths or tokens
  return msg.split('\n')[0].replace(/(ghp|gho|ghu)_[A-Za-z0-9_]+/g, '[REDACTED]').trim();
}

/**
 * Creates a validated IPC handler wrapped with the 5-Step Pipeline
 * 
 * @param {string} channel - The IPC channel name
 * @param {Function} handlerFn - The underlying business logic function (payload, event) => result
 * @param {Object} context
 * @param {Function} context.getTrustedUIWebContents - Getter for active Trusted UI WebContents
 * @param {Function} [context.resourceAuthorizer] - Step 4 custom resource authorization hook (payload) => { valid, error }
 */
function createValidatedHandler(channel, handlerFn, context) {
  return async (event, payload) => {
    // Step 1: Sender WebContents Authentication
    const trustedUIWebContents = context.getTrustedUIWebContents ? context.getTrustedUIWebContents() : null;
    const step1 = validateSenderWebContents(event, trustedUIWebContents);
    if (!step1.valid) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED_SENDER', message: step1.error }
      };
    }

    // Step 2: Sender Frame & Origin Authentication
    const step2 = validateSenderFrame(event);
    if (!step2.valid) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED_FRAME', message: step2.error }
      };
    }

    // Step 3: Schema & Size Validation
    const step3 = validatePayload(channel, payload);
    if (!step3.valid) {
      return {
        ok: false,
        error: { code: 'INVALID_PAYLOAD', message: step3.error }
      };
    }

    // Step 4: Resource & Capability Authorization
    if (context.resourceAuthorizer) {
      const step4 = await context.resourceAuthorizer(channel, payload, event);
      if (step4 && !step4.valid) {
        return {
          ok: false,
          error: { code: 'FORBIDDEN_RESOURCE', message: step4.error || 'Resource not authorized' }
        };
      }
    }

    // Step 5: Execution & Sanitized Structured Response
    try {
      const result = await handlerFn(payload, event);
      return {
        ok: true,
        data: result !== undefined ? result : null
      };
    } catch (err) {
      const sanitized = sanitizeErrorMessage(err);
      return {
        ok: false,
        error: { code: 'EXECUTION_ERROR', message: sanitized }
      };
    }
  };
}

module.exports = {
  createValidatedHandler,
  validateSenderWebContents,
  validateSenderFrame,
  validatePayload,
  sanitizeErrorMessage
};
