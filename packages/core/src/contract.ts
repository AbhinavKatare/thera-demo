import { z } from 'zod';
import {
  countryCodeSchema,
  currencyCodeSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  minorUnitsSchema,
} from './ids.js';

export const RateTypeSchema = z.enum(['hourly', 'fixed', 'per_invoice']);
export const ContractStatusSchema = z.enum(['draft', 'active', 'ending', 'ended']);

export const ContractSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  contractorId: idSchema,
  status: ContractStatusSchema,
  effectiveDate: isoDateSchema,
  endDate: isoDateSchema.nullable().default(null),
  rateType: RateTypeSchema,
  /** For hourly: per-hour rate; fixed: per-period amount; per_invoice: fee per invoice. */
  rateMinor: minorUnitsSchema,
  currency: currencyCodeSchema,
  /** Tax/compliance classification: contractor is responsible for own taxes. */
  contractorCountryCode: countryCodeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateContractSchema = ContractSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RateType = z.infer<typeof RateTypeSchema>;
export type ContractStatus = z.infer<typeof ContractStatusSchema>;
export type Contract = z.infer<typeof ContractSchema>;
export type CreateContract = z.infer<typeof CreateContractSchema>;
