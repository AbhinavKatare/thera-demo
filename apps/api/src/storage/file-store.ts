import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class DuplicateFileError extends Error {
  public readonly statusCode = 409;
  constructor(
    public readonly sha256Hash: string,
    public readonly filename?: string,
  ) {
    super(`Duplicate file upload rejected: file with SHA-256 hash '${sha256Hash}' already exists`);
    this.name = 'DuplicateFileError';
  }
}

export class UnsupportedFileTypeError extends Error {
  public readonly statusCode = 415;
  constructor(public readonly mimeType: string) {
    super(`Unsupported file type: '${mimeType}'. Allowed formats are PDF, PNG, JPEG, and TIFF`);
    this.name = 'UnsupportedFileTypeError';
  }
}

export interface StoredFileRecord {
  id: string;
  companyId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storagePath: string;
  createdAt: Date;
}

export interface StoredFileContent {
  record: StoredFileRecord;
  buffer: Buffer;
}

export interface UploadFileInput {
  filename: string;
  mimeType: string;
  content: Buffer | Uint8Array;
  companyId?: string | null;
}

/**
 * FileStore interface for storing PDFs, invoice receipts, and documents.
 */
export interface FileStore {
  save(file: UploadFileInput): Promise<StoredFileRecord>;
  get(sha256Hash: string): Promise<StoredFileContent | null>;
  has(sha256Hash: string): Promise<boolean>;
  delete(sha256Hash: string): Promise<boolean>;
  list(companyId?: string): Promise<StoredFileRecord[]>;
}

export interface LocalDiskFileStoreOptions {
  baseDir: string;
  allowedMimeTypes?: string[];
}

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'application/octet-stream',
];

/**
 * Local-disk implementation of FileStore.
 * Computes SHA-256 hash per file and rejects duplicate uploads by hash.
 */
export class LocalDiskFileStore implements FileStore {
  private readonly baseDir: string;
  private readonly allowedMimeTypes: Set<string>;
  private initialized = false;

  constructor(options: LocalDiskFileStoreOptions) {
    this.baseDir = path.resolve(options.baseDir);
    this.allowedMimeTypes = new Set(options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.initialized = true;
    }
  }

  /**
   * Computes SHA-256 digest hex string for a given buffer.
   */
  public computeHash(content: Buffer | Uint8Array): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Helper to determine directory path partitioned by hash prefix (e.g. ab/cd/<hash>).
   */
  private getStorageSubpath(sha256Hash: string): { dir: string; filePath: string; metaPath: string } {
    const shard1 = sha256Hash.slice(0, 2);
    const shard2 = sha256Hash.slice(2, 4);
    const dir = path.join(this.baseDir, shard1, shard2);
    const filePath = path.join(dir, `${sha256Hash}.bin`);
    const metaPath = path.join(dir, `${sha256Hash}.meta.json`);
    return { dir, filePath, metaPath };
  }

  public async has(sha256Hash: string): Promise<boolean> {
    await this.ensureInitialized();
    const { metaPath, filePath } = this.getStorageSubpath(sha256Hash);
    try {
      await fs.access(metaPath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async save(file: UploadFileInput): Promise<StoredFileRecord> {
    await this.ensureInitialized();

    const normalizedMime = file.mimeType.toLowerCase();
    // Allow PDF and invoices/images
    if (this.allowedMimeTypes.size > 0 && !this.allowedMimeTypes.has(normalizedMime)) {
      throw new UnsupportedFileTypeError(file.mimeType);
    }

    const contentBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content);

    const sha256Hash = this.computeHash(contentBuffer);
    const { dir, filePath, metaPath } = this.getStorageSubpath(sha256Hash);

    // Reject duplicate uploads by hash
    const exists = await this.has(sha256Hash);
    if (exists) {
      throw new DuplicateFileError(sha256Hash, file.filename);
    }

    await fs.mkdir(dir, { recursive: true });

    const now = new Date();
    const record: StoredFileRecord = {
      id: randomUUID(),
      companyId: file.companyId ?? null,
      filename: path.basename(file.filename),
      mimeType: normalizedMime,
      sizeBytes: contentBuffer.byteLength,
      sha256Hash,
      storagePath: path.relative(this.baseDir, filePath).replace(/\\/g, '/'),
      createdAt: now,
    };

    // Write file payload and metadata atomically
    await fs.writeFile(filePath, contentBuffer);
    await fs.writeFile(metaPath, JSON.stringify(record, null, 2), 'utf8');

    return record;
  }

  public async get(sha256Hash: string): Promise<StoredFileContent | null> {
    await this.ensureInitialized();
    const { filePath, metaPath } = this.getStorageSubpath(sha256Hash);

    try {
      const [metaContent, buffer] = await Promise.all([
        fs.readFile(metaPath, 'utf8'),
        fs.readFile(filePath),
      ]);
      const recordRaw = JSON.parse(metaContent) as StoredFileRecord;
      const record: StoredFileRecord = {
        ...recordRaw,
        createdAt: new Date(recordRaw.createdAt),
      };
      return { record, buffer };
    } catch {
      return null;
    }
  }

  public async delete(sha256Hash: string): Promise<boolean> {
    await this.ensureInitialized();
    const { filePath, metaPath } = this.getStorageSubpath(sha256Hash);

    try {
      await Promise.all([
        fs.unlink(filePath).catch(() => {}),
        fs.unlink(metaPath).catch(() => {}),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  public async list(companyId?: string): Promise<StoredFileRecord[]> {
    await this.ensureInitialized();
    const results: StoredFileRecord[] = [];

    async function walk(currentDir: string): Promise<void> {
      let entries: string[] = [];
      try {
        entries = await fs.readdir(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath);
        } else if (entry.endsWith('.meta.json')) {
          try {
            const raw = await fs.readFile(fullPath, 'utf8');
            const rec = JSON.parse(raw) as StoredFileRecord;
            rec.createdAt = new Date(rec.createdAt);
            if (!companyId || rec.companyId === companyId) {
              results.push(rec);
            }
          } catch {
            // Ignore malformed metadata files
          }
        }
      }
    }

    await walk(this.baseDir);
    return results;
  }
}
