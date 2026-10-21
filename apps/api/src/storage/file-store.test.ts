import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  LocalDiskFileStore,
  DuplicateFileError,
  UnsupportedFileTypeError,
} from './file-store.js';

describe('LocalDiskFileStore', () => {
  const testStorageDir = path.resolve('./tmp-test-storage');
  let store: LocalDiskFileStore;

  beforeEach(async () => {
    await fs.rm(testStorageDir, { recursive: true, force: true });
    store = new LocalDiskFileStore({
      baseDir: testStorageDir,
      allowedMimeTypes: ['application/pdf', 'image/png'],
    });
  });

  afterEach(async () => {
    await fs.rm(testStorageDir, { recursive: true, force: true });
  });

  it('saves a valid PDF file and computes accurate SHA-256 hash', async () => {
    const fakePdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Invoice 101) >>\nendobj\ntrailer\n%%EOF');
    const expectedHash = createHash('sha256').update(fakePdfContent).digest('hex');

    const record = await store.save({
      filename: 'invoice-101.pdf',
      mimeType: 'application/pdf',
      content: fakePdfContent,
      companyId: 'comp-1',
    });

    expect(record.sha256Hash).toBe(expectedHash);
    expect(record.filename).toBe('invoice-101.pdf');
    expect(record.mimeType).toBe('application/pdf');
    expect(record.sizeBytes).toBe(fakePdfContent.byteLength);
    expect(record.companyId).toBe('comp-1');

    // Confirm that the file is marked as existing
    const exists = await store.has(expectedHash);
    expect(exists).toBe(true);

    // Retrieve file content and verify byte integrity
    const retrieved = await store.get(expectedHash);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.record.id).toBe(record.id);
    expect(retrieved?.buffer.toString('utf8')).toBe(fakePdfContent.toString('utf8'));
  });

  it('rejects duplicate uploads with the exact same SHA-256 hash', async () => {
    const fileContent = Buffer.from('%PDF-1.7 Duplicate Check Payload');
    const expectedHash = createHash('sha256').update(fileContent).digest('hex');

    // First upload succeeds
    const first = await store.save({
      filename: 'first_upload.pdf',
      mimeType: 'application/pdf',
      content: fileContent,
    });
    expect(first.sha256Hash).toBe(expectedHash);

    // Second upload with the same content (even with different filename) must be rejected
    await expect(
      store.save({
        filename: 'second_attempt_different_name.pdf',
        mimeType: 'application/pdf',
        content: fileContent,
      }),
    ).rejects.toThrowError(DuplicateFileError);

    // Re-verify specific error properties
    try {
      await store.save({
        filename: 'another.pdf',
        mimeType: 'application/pdf',
        content: fileContent,
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(DuplicateFileError);
      expect(err.statusCode).toBe(409);
      expect(err.sha256Hash).toBe(expectedHash);
    }
  });

  it('rejects unsupported file MIME types', async () => {
    const scriptContent = Buffer.from('console.log("malicious");');

    await expect(
      store.save({
        filename: 'exploit.js',
        mimeType: 'application/javascript',
        content: scriptContent,
      }),
    ).rejects.toThrowError(UnsupportedFileTypeError);
  });

  it('returns null when retrieving non-existent hash', async () => {
    const missingHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const result = await store.get(missingHash);
    expect(result).toBeNull();
  });

  it('deletes stored file cleanly', async () => {
    const content = Buffer.from('%PDF-1.4 Temp Invoice');
    const record = await store.save({
      filename: 'temp.pdf',
      mimeType: 'application/pdf',
      content,
    });

    expect(await store.has(record.sha256Hash)).toBe(true);

    const deleted = await store.delete(record.sha256Hash);
    expect(deleted).toBe(true);

    expect(await store.has(record.sha256Hash)).toBe(false);
    expect(await store.get(record.sha256Hash)).toBeNull();
  });

  it('lists stored files filtered by companyId', async () => {
    const file1 = Buffer.from('%PDF-1.4 Comp1 File');
    const file2 = Buffer.from('%PDF-1.4 Comp2 File');

    await store.save({
      filename: 'comp1.pdf',
      mimeType: 'application/pdf',
      content: file1,
      companyId: 'company-a',
    });

    await store.save({
      filename: 'comp2.pdf',
      mimeType: 'application/pdf',
      content: file2,
      companyId: 'company-b',
    });

    const all = await store.list();
    expect(all).toHaveLength(2);

    const compAFiles = await store.list('company-a');
    expect(compAFiles).toHaveLength(1);
    expect(compAFiles[0]?.filename).toBe('comp1.pdf');
  });
});
