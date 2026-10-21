import { z } from 'zod';
import { countryCodeSchema, currencyCodeSchema, idSchema, isoDateTimeSchema } from './ids.js';

export const CompanySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** URL-friendly unique identifier, e.g. "acme-gmbh". */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  countryCode: countryCodeSchema,
  defaultCurrency: currencyCodeSchema,
  /** IANA timezone, e.g. "Europe/Berlin". */
  timezone: z.string().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateCompanySchema = CompanySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Company = z.infer<typeof CompanySchema>;
export type CreateCompany = z.infer<typeof CreateCompanySchema>;
