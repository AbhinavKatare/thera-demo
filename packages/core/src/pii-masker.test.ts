import { describe, it, expect } from 'vitest';
import { maskIban, maskAccountNumber, maskPii, maskObjectPii } from './pii-masker.js';

describe('PII Masker Utility', () => {
  it('masks IBANs keeping prefix and last 4 characters', () => {
    const rawIban = 'IT60X0542811101000000123456';
    const masked = maskIban(rawIban);
    expect(masked.startsWith('IT60')).toBe(true);
    expect(masked.endsWith('3456')).toBe(true);
    expect(masked).not.toContain('0542811101');
  });

  it('masks bank account numbers retaining only last 4 digits', () => {
    const rawAccount = '123456789012';
    const masked = maskAccountNumber(rawAccount);
    expect(masked.endsWith('9012')).toBe(true);
    expect(masked).not.toContain('12345678');
  });

  it('masks PII embedded inside freeform text and LLM prompts', () => {
    const prompt =
      'Contractor Sofia Rossi submitted invoice with IBAN IT60X0542811101000000123456 and account number: 9876543210. Please explain.';
    const sanitized = maskPii(prompt);

    expect(sanitized).not.toContain('IT60X0542811101000000123456');
    expect(sanitized).not.toContain('9876543210');
    expect(sanitized).toContain('IT60');
    expect(sanitized).toContain('3456');
  });

  it('recursively masks sensitive object fields for JSON audit logging', () => {
    const contractorData = {
      id: 'cnt_001',
      name: 'Sofia Rossi',
      bankDetails: {
        iban: 'IT60X0542811101000000123456',
        accountNumber: '9876543210',
        routingNumber: '021000021',
      },
      apiKey: 'sec_test_secret_998129',
      metadata: {
        lastFour: '3456',
      },
    };

    const sanitized = maskObjectPii(contractorData);

    expect(sanitized.name).toBe('Sofia Rossi');
    expect(sanitized.bankDetails.iban.endsWith('3456')).toBe(true);
    expect(sanitized.bankDetails.iban).not.toContain('05428111');
    expect(sanitized.bankDetails.accountNumber.endsWith('3210')).toBe(true);
    expect(sanitized.apiKey).toBe('••••[REDACTED]••••');
    expect(sanitized.metadata.lastFour).toBe('3456');
  });
});
