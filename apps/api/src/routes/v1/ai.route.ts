import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createLLMProvider,
  AnomalyExplainer,
  AskPayrollService,
  PayrollAnomalyDetector,
  DetectedAnomaly,
} from '@paypilot/ai';
import { PrismaPayrollQueryExecutor } from '../../services/prisma-query-executor.js';

export const askPayrollBodySchema = z.object({
  companyId: z.string().uuid().optional(),
  question: z.string().min(1).max(500),
});

export const explainAnomalyBodySchema = z.object({
  anomalyId: z.string().uuid().optional(),
  anomaly: z
    .object({
      rule: z.string().min(1),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      summary: z.string().min(1),
      evidence: z.record(z.unknown()),
      fingerprint: z.string().default('manual-explain'),
      entityType: z.enum(['payroll_item', 'contractor', 'payroll_run']).default('payroll_item'),
      entityId: z.string().default('manual-entity'),
      companyId: z.string().default('manual-company'),
    })
    .optional(),
});

export const detectPayrollAnomaliesBodySchema = z.object({
  companyId: z.string().uuid(),
  payrollRunId: z.string().uuid(),
  persistToDb: z.boolean().default(true).optional(),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  const llm = createLLMProvider(process.env.LLM_PROVIDER ?? 'mock');
  const queryExecutor = new PrismaPayrollQueryExecutor(app.prisma ?? undefined);
  const askPayrollService = new AskPayrollService(llm, queryExecutor);
  const explainer = new AnomalyExplainer(llm);
  const detector = new PayrollAnomalyDetector();

  // POST /v1/ai/ask-payroll
  app.post(
    '/v1/ai/ask-payroll',
    {
      schema: {
        description:
          'Ask your payroll: natural language question translated into parameterized whitelisted queries with row citations',
        tags: ['AI & Anomaly Detection'],
      },
    },
    async (req, reply) => {
      const parsed = askPayrollBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { question } = parsed.data;
      const companyId = parsed.data.companyId ?? 'c0000000-0000-0000-0000-000000000001';

      const response = await askPayrollService.ask(companyId, question);
      return reply.status(200).send(response);
    },
  );

  // POST /v1/ai/explain-anomaly
  app.post(
    '/v1/ai/explain-anomaly',
    {
      schema: {
        description: 'Generates 1-2 sentence plain-English explanation + suggested action strictly grounded in evidence',
        tags: ['AI & Anomaly Detection'],
      },
    },
    async (req, reply) => {
      const parsed = explainAnomalyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      let anomalyData: DetectedAnomaly | null = null;

      if (parsed.data.anomalyId && app.prisma) {
        const stored = await app.prisma.anomaly.findUnique({
          where: { id: parsed.data.anomalyId },
        });

        if (stored) {
          anomalyData = {
            rule: stored.rule,
            severity: stored.severity.toLowerCase() as any,
            summary: stored.summary,
            evidence: (stored.details as Record<string, unknown>) ?? {},
            fingerprint: stored.id,
            entityType: (stored.entityType as any) ?? 'payroll_item',
            entityId: stored.entityId,
            companyId: stored.companyId,
          };
        }
      }

      if (!anomalyData && parsed.data.anomaly) {
        anomalyData = parsed.data.anomaly as DetectedAnomaly;
      }

      if (!anomalyData) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Anomaly not found. Please provide valid anomalyId or inline anomaly payload.',
        });
      }

      const explanation = await explainer.explain(anomalyData);
      return reply.status(200).send(explanation);
    },
  );

  // POST /v1/ai/detect-payroll-anomalies
  app.post(
    '/v1/ai/detect-payroll-anomalies',
    {
      schema: {
        description: 'Runs 6 rules-based anomaly checks on a payroll run and flags potential risks',
        tags: ['AI & Anomaly Detection'],
      },
    },
    async (req, reply) => {
      const parsed = detectPayrollAnomaliesBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { companyId, payrollRunId, persistToDb } = parsed.data;

      if (!app.prisma) {
        return reply.status(200).send({ detectedCount: 0, anomalies: [] });
      }

      // Gather current run items
      const payrollRun = await app.prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: {
          items: {
            include: { contractor: true },
          },
        },
      });

      if (!payrollRun) {
        return reply.status(404).send({ error: 'not_found', message: `Payroll run '${payrollRunId}' not found.` });
      }

      // Gather active contractors
      const activeContractors = await app.prisma.contractor.findMany({
        where: { companyId, deletedAt: null },
        include: {
          contracts: { where: { deletedAt: null }, take: 1 },
        },
      });

      // Gather historical payouts from past runs
      const pastItems = await app.prisma.payrollItem.findMany({
        where: {
          payrollRun: {
            companyId,
            id: { not: payrollRunId },
            deletedAt: null,
          },
          deletedAt: null,
        },
        include: {
          payrollRun: true,
        },
      });

      const detectedAnomalies = detector.detectAnomalies({
        companyId,
        payrollRunId,
        periodStart: payrollRun.periodStart,
        periodEnd: payrollRun.periodEnd,
        currency: payrollRun.currency,
        items: payrollRun.items.map((i) => ({
          id: i.id,
          contractorId: i.contractorId,
          contractorName: i.contractor.displayName ?? i.contractor.legalName,
          grossMinor: i.grossMinor,
          taxMinor: i.taxMinor,
          netMinor: i.netMinor,
          currency: i.currency,
        })),
        historicalPayouts: pastItems.map((p) => ({
          contractorId: p.contractorId,
          payrollRunId: p.payrollRunId,
          runDate: p.payrollRun.periodEnd,
          grossMinor: p.grossMinor,
          currency: p.currency,
        })),
        activeContractors: activeContractors.map((c) => ({
          id: c.id,
          name: c.displayName ?? c.legalName,
          currency: c.contracts[0]?.currency ?? 'USD',
          status: c.status,
          bankAccountUpdatedAt: c.updatedAt,
          isExpectedInPayroll: c.status === 'ACTIVE',
        })),
      });

      // Optionally persist to DB
      if (persistToDb && detectedAnomalies.length > 0) {
        for (const anom of detectedAnomalies) {
          await app.prisma.anomaly.create({
            data: {
              companyId: anom.companyId,
              entityType: anom.entityType,
              entityId: anom.entityId,
              rule: anom.rule,
              severity: anom.severity.toUpperCase() as any,
              detector: 'RULES',
              summary: anom.summary,
              details: JSON.parse(JSON.stringify(anom.evidence)),
              status: 'OPEN',
            },
          });
        }
      }

      return reply.status(200).send({
        payrollRunId,
        detectedCount: detectedAnomalies.length,
        anomalies: detectedAnomalies,
      });
    },
  );
}
