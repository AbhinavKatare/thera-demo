import { createHash } from 'node:crypto';

export function generateAnomalyFingerprint(
  rule: string,
  entityType: string,
  entityId: string,
  evidence: Record<string, unknown>,
): string {
  // Sort keys for deterministic JSON serialization
  const canonicalEvidence = Object.keys(evidence)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = evidence[key];
      return acc;
    }, {});

  const payload = JSON.stringify({
    rule,
    entityType,
    entityId,
    evidence: canonicalEvidence,
  });

  return createHash('sha256').update(payload).digest('hex');
}
