import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationQuerySchema, paginateArray } from '../pagination.js';
import { InvoiceProcessingPipeline } from '../../intake/invoice-pipeline.js';
import { ImapInvoicePoller } from '../../intake/imap-poller.js';

export const inboundDocFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PROCESSED', 'NEEDS_REVIEW', 'FAILED', 'all']).optional(),
});

export const uploadInboundDocBodySchema = z.object({
  companyId: z.string().uuid().optional(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
  senderEmail: z.string().email().optional(),
  subject: z.string().optional(),
});

export async function inboundDocumentsRoutes(app: FastifyInstance): Promise<void> {
  const pipeline = app.prisma && app.fileStore ? new InvoiceProcessingPipeline(app.prisma, app.fileStore) : null;
  const poller = app.prisma && app.fileStore ? new ImapInvoicePoller(app.prisma, app.fileStore) : null;

  // GET /v1/inbound-documents
  app.get(
    '/v1/inbound-documents',
    {
      schema: {
        description: 'Lists all inbound documents with review status and extraction summaries',
        tags: ['Inbound Documents & Intake'],
      },
    },
    async (req, reply) => {
      const parsed = inboundDocFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, companyId } = parsed.data;

      if (!app.prisma) {
        return paginateArray([], limit, cursor);
      }

      const where: any = { deletedAt: null };
      if (companyId) where.companyId = companyId;
      if (status && status !== 'all') where.status = status;

      const items = await app.prisma.inboundDocument.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: 'desc' },
        include: {
          file: true,
          contractor: true,
          invoice: true,
        },
      });

      const hasMore = items.length > limit;
      const resultItems = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? resultItems[resultItems.length - 1]!.id : null;

      return { items: resultItems, nextCursor, limit };
    },
  );

  // GET /v1/inbound-documents/:id
  app.get(
    '/v1/inbound-documents/:id',
    {
      schema: {
        description: 'Retrieves an inbound document with full extraction payload and review reasons',
        tags: ['Inbound Documents & Intake'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'InboundDocument not found' });
      }

      const doc = await app.prisma.inboundDocument.findUnique({
        where: { id },
        include: { file: true, contractor: true, invoice: true },
      });

      if (!doc) {
        return reply.status(404).send({ error: 'not_found', message: `InboundDocument '${id}' not found` });
      }

      return doc;
    },
  );

  // POST /v1/inbound-documents/upload
  app.post(
    '/v1/inbound-documents/upload',
    {
      schema: {
        description: 'Directly uploads an invoice document, stores it in FileStore, and triggers the extraction pipeline',
        tags: ['Inbound Documents & Intake'],
      },
    },
    async (req, reply) => {
      const parsed = uploadInboundDocBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { filename, mimeType, contentBase64, senderEmail, subject } = parsed.data;
      const companyId = parsed.data.companyId ?? 'c0000000-0000-0000-0000-000000000001';

      if (!app.fileStore || !app.prisma || !pipeline) {
        return reply.status(200).send({
          inboundDocumentId: 'mock-doc-id',
          status: 'PROCESSED',
          invoiceId: 'mock-invoice-id',
          anomaliesCount: 0,
          reasons: [],
        });
      }

      const buffer = Buffer.from(contentBase64, 'base64');
      const storedFile = await app.fileStore.save({
        filename,
        content: buffer,
        mimeType,
        companyId,
      });

      const inboundDoc = await app.prisma.inboundDocument.create({
        data: {
          companyId,
          source: 'UPLOAD',
          senderEmail,
          subject,
          fileId: storedFile.id,
          status: 'PENDING',
        },
      });

      const result = await pipeline.processInboundDocument(inboundDoc.id);
      return reply.status(201).send(result);
    },
  );

  // POST /v1/inbound-documents/:id/process
  app.post(
    '/v1/inbound-documents/:id/process',
    {
      schema: {
        description: 'Triggers the extraction and validation pipeline on an existing inbound document',
        tags: ['Inbound Documents & Intake'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      if (!pipeline) {
        return reply.status(200).send({ inboundDocumentId: id, status: 'PROCESSED' });
      }

      const result = await pipeline.processInboundDocument(id);
      return reply.status(200).send(result);
    },
  );

  // POST /v1/inbound-documents/poll-inbox
  app.post(
    '/v1/inbound-documents/poll-inbox',
    {
      schema: {
        description: 'Polls IMAP inbox for unread invoice emails and attachments',
        tags: ['Inbound Documents & Intake'],
      },
    },
    async (req, reply) => {
      if (!poller) {
        return reply.status(200).send({ fetchedCount: 0, processedCount: 0, skippedDuplicates: 0 });
      }

      const pollResult = await poller.pollInbox();
      return reply.status(200).send(pollResult);
    },
  );
}
