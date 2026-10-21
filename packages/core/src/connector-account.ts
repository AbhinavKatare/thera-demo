import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './ids.js';

export const ConnectorProviderSchema = z.enum(['quickbooks', 'xero', 'zoho', 'netsuite', 'mock']);
export const ConnectorAccountStatusSchema = z.enum([
  'awaiting_action',
  'connected',
  'error',
  'disconnected',
]);

export const ConnectorAccountSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  provider: ConnectorProviderSchema,
  /** Account/tenant identifier on the provider side, e.g. QuickBooks Realm ID. */
  externalAccountId: z.string().min(1),
  status: ConnectorAccountStatusSchema,
  /** Opaque reference to stored credentials; raw secrets never live in this document. */
  credentialsRef: z.string().min(1).optional(),
  lastSyncedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type ConnectorProvider = z.infer<typeof ConnectorProviderSchema>;
export type ConnectorAccountStatus = z.infer<typeof ConnectorAccountStatusSchema>;
export type ConnectorAccount = z.infer<typeof ConnectorAccountSchema>;
