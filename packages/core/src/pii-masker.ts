/**
 * PII Masker Utility for PayPilot.
 * Masks sensitive financial and personal data (IBANs, bank account numbers,
 * routing numbers, SSNs, credit card numbers) before writing to logs,
 * audit traces, or feeding into external LLM prompts.
 */

const SENSITIVE_KEY_PATTERNS = [
  /iban/i,
  /account_?number/i,
  /routing_?number/i,
  /sort_?code/i,
  /swift/i,
  /bic/i,
  /tax_?id/i,
  /ssn/i,
  /credit_?card/i,
  /pan/i,
  /cvv/i,
  /password/i,
  /secret/i,
  /token/i,
  /api_?key/i,
];

// IBAN regex pattern (2 letters, 2 digits, up to 30 alphanumeric characters)
const IBAN_REGEX = /\b([A-Z]{2}[0-9]{2})[A-Z0-9]{4,30}\b/g;

// US Routing transit number pattern (9 digits)
const ROUTING_REGEX = /\b(routing\s*(?:number|#)?[:\s]*)(\d{5})(\d{4})\b/gi;

// Credit card / PAN (13 to 19 digits with optional spaces or dashes)
const CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

// Generic bank account numbers preceded by labels
const ACCOUNT_LABEL_REGEX = /\b((?:account|acc|acct)\s*(?:number|#|id)?[:\s]+)([A-Za-z0-9-]{4,34})\b/gi;

/**
 * Masks an IBAN keeping first 4 characters and last 4 characters visible.
 * Example: "IT60X0542811101000000123456" -> "IT60••••••••••••••••••••3456"
 */
export function maskIban(iban: string): string {
  const cleaned = iban.replace(/\s+/g, '');
  if (cleaned.length <= 8) {
    return '••••'.repeat(Math.max(1, Math.floor(cleaned.length / 4)));
  }
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  const maskedMiddle = '•'.repeat(cleaned.length - 8);
  return `${prefix}${maskedMiddle}${suffix}`;
}

/**
 * Masks a bank account or routing number keeping only the last 4 digits visible.
 * Example: "123456789012" -> "••••••••9012"
 */
export function maskAccountNumber(acc: string): string {
  const trimmed = acc.trim();
  if (trimmed.length <= 4) {
    return '••••';
  }
  const suffix = trimmed.slice(-4);
  const maskedPrefix = '•'.repeat(Math.min(trimmed.length - 4, 8));
  return `${maskedPrefix}${suffix}`;
}

/**
 * Masks general text string replacing any detected IBANs, account numbers, or cards.
 */
export function maskPii(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // 1. Mask credit cards
  let result = text.replace(CARD_REGEX, (match) => {
    const digits = match.replace(/[\s-]/g, '');
    return `••••-••••-••••-${digits.slice(-4)}`;
  });

  // 2. Mask IBANs first (ensuring country code & last 4 digits stay visible)
  result = result.replace(IBAN_REGEX, (match) => {
    if (match.length >= 15) {
      return maskIban(match);
    }
    return match;
  });

  // 3. Mask labeled account numbers
  result = result.replace(ACCOUNT_LABEL_REGEX, (_match, label, value) => {
    return `${label}${maskAccountNumber(value)}`;
  });

  // 4. Mask routing numbers
  result = result.replace(ROUTING_REGEX, (_match, label, _prefix, suffix) => {
    return `${label}•••••${suffix}`;
  });

  return result;
}

/**
 * Recursively masks sensitive fields in any JSON-serializable object or array.
 */
export function maskObjectPii<T>(target: T): T {
  if (target === null || target === undefined) return target;
  if (typeof target === 'string') {
    return maskPii(target) as unknown as T;
  }
  if (typeof target !== 'object') {
    return target;
  }
  if (Array.isArray(target)) {
    return target.map((item) => maskObjectPii(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitiveKey) {
      if (typeof value === 'string') {
        if (/iban/i.test(key)) {
          result[key] = maskIban(value);
        } else if (/account|routing|number|pan|card/i.test(key)) {
          result[key] = maskAccountNumber(value);
        } else {
          result[key] = '••••[REDACTED]••••';
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = maskObjectPii(value);
      } else {
        result[key] = '••••[REDACTED]••••';
      }
    } else {
      result[key] = maskObjectPii(value);
    }
  }

  return result as T;
}
