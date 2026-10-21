export interface PromptSecurityCheckResult {
  isSuspicious: boolean;
  reason?: string;
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|above)\s+(instructions|prompts|rules)/i, reason: 'Instruction override pattern' },
  { pattern: /system\s+prompt|reveal\s+(the\s+)?(system|internal)\s+(prompt|instructions)/i, reason: 'System prompt exfiltration attempt' },
  { pattern: /drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set/i, reason: 'SQL modification statement detected' },
  { pattern: /union\s+select|select\s+.*\s+from\s+(information_schema|pg_|users|passwords)/i, reason: 'Direct database exploration attempt' },
  { pattern: /exec(ute)?\s+xp_|;\s*--|--\s*$/i, reason: 'SQL injection comment or stacked statement syntax' },
  { pattern: /act\s+as\s+(dan|developer\s+mode|root|administrator|evil)/i, reason: 'Jailbreak roleplay persona pattern' },
  { pattern: /<script[\s>]/i, reason: 'HTML/Script injection tag detected' },
  { pattern: /api[_-]?key|secret[_-]?token|bearer\s+[a-z0-9-_.]+/i, reason: 'Credential probe or token injection attempt' },
];

export function checkPromptSecurity(question: string): PromptSecurityCheckResult {
  const normalized = question.trim();

  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { isSuspicious: true, reason };
    }
  }

  return { isSuspicious: false };
}
