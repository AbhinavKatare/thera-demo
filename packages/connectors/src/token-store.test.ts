import { describe, expect, it } from 'vitest';
import { AesGcmTokenCrypto, ConnectorTokenStore } from './token-store.js';
import type { OAuthTokens } from './accounting-connector.js';

describe('AES-256-GCM Token Encryption', () => {
  const secretKey = 'super-secret-encryption-key-for-testing!';
  const crypto = new AesGcmTokenCrypto(secretKey);

  it('encrypts payload with 12-byte IV and 16-byte Auth Tag into iv:authTag:ciphertext', () => {
    const payload = { accessToken: 'secret_token_123', refreshToken: 'secret_refresh_456' };
    const encrypted = crypto.encrypt(payload);

    expect(typeof encrypted).toBe('string');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);

    const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
    expect(ivHex.length).toBe(24); // 12 bytes * 2 hex chars
    expect(authTagHex.length).toBe(32); // 16 bytes * 2 hex chars
    expect(ciphertextHex.length).toBeGreaterThan(0);
    expect(encrypted).not.toContain('secret_token_123'); // Confidentiality guaranteed
  });

  it('decrypts valid ciphertext and verifies authenticated integrity', () => {
    const payload = {
      accessToken: 'xero_oauth_access_xyz',
      refreshToken: 'xero_oauth_refresh_abc',
      expiresAt: 1729438000000,
    };

    const encrypted = crypto.encrypt(payload);
    const decrypted = crypto.decrypt<typeof payload>(encrypted);

    expect(decrypted).toEqual(payload);
  });

  it('detects tampering and throws an authentication error when ciphertext is modified', () => {
    const payload = { secret: 'do-not-modify' };
    const encrypted = crypto.encrypt(payload);
    const parts = encrypted.split(':');

    // Flip last hex character of ciphertext
    const tamperedCiphertext =
      parts[2]!.slice(0, -1) + (parts[2]!.slice(-1) === 'a' ? 'b' : 'a');
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('detects tampering and throws an authentication error when auth tag is modified', () => {
    const payload = { secret: 'integrity-check' };
    const encrypted = crypto.encrypt(payload);
    const parts = encrypted.split(':');

    // Tamper with the 16-byte authentication tag
    const tamperedTag =
      '00' + parts[1]!.slice(2);
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => crypto.decrypt(tampered)).toThrow();
  });
});

describe('ConnectorTokenStore', () => {
  it('saves, retrieves, updates, and revokes tokens encrypted at rest', async () => {
    const store = new ConnectorTokenStore({ secretKey: 'token-store-test-key-32b-length!!' });
    const companyId = 'c0000000-0000-0000-0000-000000000001';

    const tokens: OAuthTokens = {
      accessToken: 'xero-tok-999',
      refreshToken: 'xero-ref-888',
      tokenType: 'Bearer',
      expiresInSeconds: 1800,
      expiresAt: Date.now() + 1800_000,
      tenantId: 'tenant-xero-01',
    };

    // 1. Save
    const stored = await store.saveTokens({
      companyId,
      provider: 'xero',
      externalAccountId: 'tenant-xero-01',
      tokens,
    });

    expect(stored.id).toBeDefined();
    expect(stored.encryptedPayload).not.toContain('xero-tok-999');

    // 2. Retrieve
    const retrieved = await store.getTokens(companyId, 'xero');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.accessToken).toBe('xero-tok-999');
    expect(retrieved?.refreshToken).toBe('xero-ref-888');

    // 3. Update
    const updatedTokens: OAuthTokens = {
      ...tokens,
      accessToken: 'xero-tok-refreshed-111',
    };
    await store.updateTokens(companyId, 'xero', updatedTokens);

    const afterUpdate = await store.getTokens(companyId, 'xero');
    expect(afterUpdate?.accessToken).toBe('xero-tok-refreshed-111');

    // 4. Revoke
    const revoked = await store.revokeTokens(companyId, 'xero');
    expect(revoked).toBe(true);

    const afterRevoke = await store.getTokens(companyId, 'xero');
    expect(afterRevoke).toBeNull();
  });

  it('checks token expiry with configurable buffer seconds', () => {
    const store = new ConnectorTokenStore();

    const notExpired: OAuthTokens = {
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 300_000, // 5 min future
    };
    expect(store.isTokenExpired(notExpired, 60)).toBe(false);

    const expiringSoon: OAuthTokens = {
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 30_000, // 30 sec future
    };
    expect(store.isTokenExpired(expiringSoon, 60)).toBe(true); // Buffer of 60s triggers refresh
  });
});
