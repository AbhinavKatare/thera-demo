import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import type { ConnectorProvider } from '@paypilot/core';
import { type OAuthTokens, OAuthTokensSchema } from './accounting-connector.js';

export interface StoredEncryptedRecord {
  id: string;
  companyId: string;
  provider: ConnectorProvider;
  externalAccountId: string;
  encryptedPayload: string; // iv:authTag:ciphertext (hex)
  expiresAt?: number;
  createdAt: string;
  updatedAt: string;
}

export class AesGcmTokenCrypto {
  private readonly key: Buffer;

  constructor(secretKey?: string | Buffer) {
    if (!secretKey) {
      // Fallback to env or deterministic test key
      const keySource = process.env.CONNECTOR_SECRET_KEY ?? 'paypilot-default-insecure-dev-secret-key-32b!';
      this.key = createHash('sha256').update(keySource).digest();
    } else if (Buffer.isBuffer(secretKey)) {
      this.key = secretKey.length === 32 ? secretKey : createHash('sha256').update(secretKey).digest();
    } else {
      this.key = createHash('sha256').update(secretKey).digest();
    }
  }

  /**
   * Encrypts plain text or JSON using AES-256-GCM with 12-byte IV and 16-byte Auth Tag.
   * Returns format: `${ivHex}:${authTagHex}:${ciphertextHex}`
   */
  public encrypt(data: string | object): string {
    const plainText = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = randomBytes(12); // Standard 12 bytes for GCM
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    let ciphertext = cipher.update(plainText, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  }

  /**
   * Decrypts AES-256-GCM ciphertext and validates authentication tag.
   * Throws if tampered or invalid tag.
   */
  public decrypt<T = unknown>(encryptedPayload: string): T {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format: expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return decrypted as unknown as T;
    }
  }
}

export interface ConnectorTokenStoreOptions {
  secretKey?: string | Buffer;
}

export class ConnectorTokenStore {
  private readonly crypto: AesGcmTokenCrypto;
  private readonly store = new Map<string, StoredEncryptedRecord>();

  constructor(options: ConnectorTokenStoreOptions = {}) {
    this.crypto = new AesGcmTokenCrypto(options.secretKey);
  }

  private makeKey(companyId: string, provider: ConnectorProvider): string {
    return `${companyId}:${provider}`;
  }

  public async saveTokens(params: {
    companyId: string;
    provider: ConnectorProvider;
    externalAccountId: string;
    tokens: OAuthTokens;
  }): Promise<StoredEncryptedRecord> {
    const key = this.makeKey(params.companyId, params.provider);
    const encryptedPayload = this.crypto.encrypt(params.tokens);
    const now = new Date().toISOString();

    const record: StoredEncryptedRecord = {
      id: `acc-${Date.now()}-${randomBytes(4).toString('hex')}`,
      companyId: params.companyId,
      provider: params.provider,
      externalAccountId: params.externalAccountId,
      encryptedPayload,
      expiresAt: params.tokens.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(key, record);
    return record;
  }

  public async getTokens(companyId: string, provider: ConnectorProvider): Promise<OAuthTokens | null> {
    const key = this.makeKey(companyId, provider);
    const record = this.store.get(key);
    if (!record) return null;

    try {
      const raw = this.crypto.decrypt(record.encryptedPayload);
      return OAuthTokensSchema.parse(raw);
    } catch (err: any) {
      throw new Error(`Failed to decrypt tokens for ${companyId}/${provider}: ${err.message}`);
    }
  }

  public async updateTokens(
    companyId: string,
    provider: ConnectorProvider,
    tokens: OAuthTokens,
  ): Promise<StoredEncryptedRecord> {
    const key = this.makeKey(companyId, provider);
    const existing = this.store.get(key);
    if (!existing) {
      throw new Error(`No connector account found for ${companyId}/${provider}`);
    }

    const encryptedPayload = this.crypto.encrypt(tokens);
    const updated: StoredEncryptedRecord = {
      ...existing,
      encryptedPayload,
      expiresAt: tokens.expiresAt,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(key, updated);
    return updated;
  }

  public async revokeTokens(companyId: string, provider: ConnectorProvider): Promise<boolean> {
    const key = this.makeKey(companyId, provider);
    return this.store.delete(key);
  }

  public isTokenExpired(tokens: OAuthTokens, bufferSeconds: number = 60): boolean {
    if (!tokens.expiresAt) return false;
    const now = Date.now();
    return now + bufferSeconds * 1000 >= tokens.expiresAt;
  }

  public getRawRecord(companyId: string, provider: ConnectorProvider): StoredEncryptedRecord | null {
    return this.store.get(this.makeKey(companyId, provider)) ?? null;
  }
}
