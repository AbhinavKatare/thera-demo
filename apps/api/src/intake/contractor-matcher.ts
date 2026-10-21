import Fuse from 'fuse.js';
import { ExtractedInvoice } from '@paypilot/ai';

export interface ContractorCandidate {
  id: string;
  companyId: string;
  legalName: string;
  displayName: string;
  email: string;
  taxId?: string | null;
  countryCode: string;
  bankAccountNumber?: string | null;
  bankRoutingNumber?: string | null;
  bankIban?: string | null;
  bankSwiftBic?: string | null;
  bankName?: string | null;
}

export type MatchStrategy =
  | 'tax_id'
  | 'bank_account'
  | 'bank_iban'
  | 'email_exact'
  | 'email_domain'
  | 'fuzzy_name'
  | 'none';

export interface ContractorMatchResult {
  matched: boolean;
  contractor: ContractorCandidate | null;
  matchConfidence: number;
  matchStrategy: MatchStrategy;
  reason?: string;
}

export class ContractorMatchingService {
  private readonly defaultThreshold = 0.75;
  private readonly freeEmailProviders = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com',
  ]);

  public match(
    extracted: ExtractedInvoice,
    senderEmail?: string,
    candidates: ContractorCandidate[] = [],
    threshold: number = this.defaultThreshold,
  ): ContractorMatchResult {
    if (candidates.length === 0) {
      return {
        matched: false,
        contractor: null,
        matchConfidence: 0,
        matchStrategy: 'none',
        reason: 'No contractor candidates available in company.',
      };
    }

    let bestMatch: ContractorCandidate | null = null;
    let highestConfidence = 0;
    let bestStrategy: MatchStrategy = 'none';

    // 1. Strategy: Tax ID / VAT number match
    if (extracted.vendorName || extracted.lineItems) {
      for (const candidate of candidates) {
        if (candidate.taxId) {
          const normCandTax = candidate.taxId.replace(/[\s-]/g, '').toUpperCase();
          // Check if candidate tax ID appears in the invoice text or raw fields
          if (normCandTax.length >= 6) {
            const rawDump = JSON.stringify(extracted).replace(/[\s-]/g, '').toUpperCase();
            if (rawDump.includes(normCandTax)) {
              if (0.98 > highestConfidence) {
                highestConfidence = 0.98;
                bestMatch = candidate;
                bestStrategy = 'tax_id';
              }
            }
          }
        }
      }
    }

    // 2. Strategy: Bank account / IBAN exact match
    if (extracted.bankDetails) {
      const { iban, accountNumber } = extracted.bankDetails;
      for (const candidate of candidates) {
        if (iban && candidate.bankIban) {
          const normIban = iban.replace(/[\s-]/g, '').toUpperCase();
          const normCandIban = candidate.bankIban.replace(/[\s-]/g, '').toUpperCase();
          if (normIban === normCandIban) {
            if (0.95 > highestConfidence) {
              highestConfidence = 0.95;
              bestMatch = candidate;
              bestStrategy = 'bank_iban';
            }
          }
        }

        if (accountNumber && candidate.bankAccountNumber) {
          const normAcc = accountNumber.replace(/[\s-]/g, '');
          const normCandAcc = candidate.bankAccountNumber.replace(/[\s-]/g, '');
          if (normAcc === normCandAcc) {
            if (0.95 > highestConfidence) {
              highestConfidence = 0.95;
              bestMatch = candidate;
              bestStrategy = 'bank_account';
            }
          }
        }
      }
    }

    // 3. Strategy: Sender Email exact or domain match
    if (senderEmail) {
      const normSender = senderEmail.toLowerCase().trim();
      const senderDomain = normSender.split('@')[1];

      for (const candidate of candidates) {
        const normCandEmail = candidate.email.toLowerCase().trim();
        if (normSender === normCandEmail) {
          if (0.92 > highestConfidence) {
            highestConfidence = 0.92;
            bestMatch = candidate;
            bestStrategy = 'email_exact';
          }
        } else if (
          senderDomain &&
          !this.freeEmailProviders.has(senderDomain) &&
          normCandEmail.endsWith(`@${senderDomain}`)
        ) {
          if (0.88 > highestConfidence) {
            highestConfidence = 0.88;
            bestMatch = candidate;
            bestStrategy = 'email_domain';
          }
        }
      }
    }

    // 4. Strategy: Fuzzy Name Match using Fuse.js
    const fuse = new Fuse(candidates, {
      keys: ['displayName', 'legalName'],
      includeScore: true,
      threshold: 0.5, // 0.0 is perfect, 1.0 is anything
    });

    const searchResults = fuse.search(extracted.vendorName);
    if (searchResults.length > 0) {
      const top = searchResults[0]!;
      const fuseScore = top.score ?? 0.5;
      const fuzzyConfidence = Math.max(0, 1.0 - fuseScore);

      if (fuzzyConfidence > highestConfidence) {
        highestConfidence = Math.round(fuzzyConfidence * 100) / 100;
        bestMatch = top.item;
        bestStrategy = 'fuzzy_name';
      }
    }

    // Decision based on threshold
    if (highestConfidence >= threshold && bestMatch) {
      return {
        matched: true,
        contractor: bestMatch,
        matchConfidence: highestConfidence,
        matchStrategy: bestStrategy,
      };
    }

    return {
      matched: false,
      contractor: bestMatch,
      matchConfidence: highestConfidence,
      matchStrategy: bestStrategy,
      reason: `Match confidence ${highestConfidence.toFixed(2)} is below required threshold ${threshold.toFixed(2)}.`,
    };
  }
}
