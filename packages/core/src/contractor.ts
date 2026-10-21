import { z } from 'zod';
import { countryCodeSchema, idSchema, isoDateTimeSchema, minorUnitsSchema } from './ids.js';

export const ContractorStatusSchema = z.enum(['invited', 'active', 'offboarded']);

export const ContractorSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  taxId: z.string().min(1).optional(),
  countryCode: countryCodeSchema,
  status: ContractorStatusSchema,
  /** Default rate charged on contracts that do not override it. */
  defaultRateMinor: minorUnitsSchema,
  /** IANA timezone; set at invite time to localize reminders. */
  timezone: z.string().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateContractorSchema = ContractorSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContractorStatus = z.infer<typeof ContractorStatusSchema>;
export type Contractor = z.infer<typeof ContractorSchema>;
export type CreateContractor = z.infer<typeof CreateContractorSchema>;
