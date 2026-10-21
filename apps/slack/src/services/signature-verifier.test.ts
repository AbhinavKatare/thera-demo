import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySlackSignature } from './signature-verifier.js';

describe('Slack Signature Verifier', () => {
  const secret = 'slack_signing_secret_test_99812481';
  const body = 'command=%2Fpayroll&text=status&user_id=U012345';

  it('validates a genuine Slack signature within the timestamp window', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = createHmac('sha256', secret);
    hmac.update(`v0:${timestamp}:${body}`);
    const signature = `v0=${hmac.digest('hex')}`;

    const result = verifySlackSignature({
      signingSecret: secret,
      signature,
      timestamp,
      rawBody: body,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects an expired timestamp (replay attack prevention)', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago (> 300s)
    const hmac = createHmac('sha256', secret);
    hmac.update(`v0:${timestamp}:${body}`);
    const signature = `v0=${hmac.digest('hex')}`;

    const result = verifySlackSignature({
      signingSecret: secret,
      signature,
      timestamp,
      rawBody: body,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED_TIMESTAMP');
  });

  it('rejects a tampered body or forged signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = verifySlackSignature({
      signingSecret: secret,
      signature: 'v0=0000000000000000000000000000000000000000000000000000000000000000',
      timestamp,
      rawBody: body,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects when required headers are missing', () => {
    const result = verifySlackSignature({
      signingSecret: secret,
      signature: '',
      timestamp: 0,
      rawBody: body,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_HEADERS');
  });
});
