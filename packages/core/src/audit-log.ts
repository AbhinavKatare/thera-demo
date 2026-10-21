import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './ids.js';

export const ActorTypeSchema = z.enum(['user', 'service', 'connector']);

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  /** Identifier relative to the actor type: user id, service name, connector account id. */
  id: z.string().min(1),
});

/** JSON payload shared across audit entries. */
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const AuditLogSchema = z.object({
  id: idSchema,
  companyId: idSchema.optional(),
  timestamp: isoDateTimeSchema,
  actor: ActorSchema,
  /** Dot-namespaced verb, e.g. "invoice.approved", "payment_draft.created". */
  action: z.string().regex(/^[a-z_]+([a-z0-9_.]*[a-z0-9_])?$/),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  /** Snapshot of the entity state before the action, when it existed. */
  before: jsonValueSchema.optional(),
  after: jsonValueSchema.optional(),
  metadata: z.record(jsonValueSchema).optional(),
});

export type ActorType = z.infer<typeof ActorTypeSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
