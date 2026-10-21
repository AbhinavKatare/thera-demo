import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SlackSignatureVerificationOptions {
  signingSecret: string;
  signature: string;
  timestamp: string | number;
  rawBody: string;
  maxDriftSeconds?: number;
}

export interface VerificationResult {
  valid: boolean;
  reason?: 'MISSING_HEADERS' | 'EXPIRED_TIMESTAMP' | 'INVALID_SIGNATURE';
}

/**
 * Validates Slack HTTP webhook signatures using HMAC-SHA256 and timing-safe comparison.
 * Prevents replay attacks by enforcing a 5-minute timestamp validity window.
 */
export function verifySlackSignature(options: SlackSignatureVerificationOptions): VerificationResult {
  const { signingSecret, signature, timestamp, rawBody, maxDriftSeconds = 300 } = options;

  if (!signingSecret || !signature || !timestamp) {
    return { valid: false, reason: 'MISSING_HEADERS' };
  }

  // 1. Enforce replay attack window: verify timestamp is within maxDriftSeconds
  const tsNum = typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10);
  if (isNaN(tsNum)) {
    return { valid: false, reason: 'EXPIRED_TIMESTAMP' };
  }

  const currentTs = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTs - tsNum) > maxDriftSeconds) {
    return { valid: false, reason: 'EXPIRED_TIMESTAMP' };
  }

  // 2. Compute HMAC SHA-256: "v0:" + timestamp + ":" + rawBody
  const sigBasestring = `v0:${tsNum}:${rawBody}`;
  const hmac = createHmac('sha256', signingSecret);
  hmac.update(sigBasestring);
  const calculatedSignature = `v0=${hmac.digest('hex')}`;

  // 3. Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (sigBuffer.length !== calcBuffer.length) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  const isMatch = timingSafeEqual(sigBuffer, calcBuffer);
  if (!isMatch) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}
