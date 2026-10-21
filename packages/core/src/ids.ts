import { z } from 'zod';

/** UUID used for every primary identifier across PayPilot. */
export const idSchema = z.string().uuid();

export const isoDateTimeSchema = z.string().datetime();
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)');

/** ISO 4217 alpha-3 currency code, uppercase. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'must be an ISO 4217 alpha-3 code');

/** Two-letter ISO 3166-1 alpha-2 country code, uppercase. */
export const countryCodeSchema = z
  .string()
  .length(2, 'must be an ISO 3166-1 alpha-2 code')
  .regex(/^[A-Z]{2}$/);

export const minorUnitsSchema = z.number().int().nonnegative();

export type Id = z.infer<typeof idSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type MinorUnits = z.infer<typeof minorUnitsSchema>;
