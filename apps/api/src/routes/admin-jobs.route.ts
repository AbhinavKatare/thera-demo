import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { JobManager } from '../jobs/job-manager.js';

export const triggerJobSchema = z.object({
  queueName: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export async function adminJobsRoutes(app: FastifyInstance, options: { jobManager: JobManager }): Promise<void> {
  const { jobManager } = options;

  app.get(
    '/admin/jobs',
    {
      schema: {
        description: 'Returns status and configuration of all background pg-boss job queues',
        tags: ['Admin Jobs'],
      },
    },
    async () => {
      return jobManager.getStatus();
    },
  );

  app.post(
    '/admin/jobs/trigger',
    {
      schema: {
        description: 'Manually enqueues and triggers a background job by queue name',
        tags: ['Admin Jobs'],
      },
    },
    async (req, reply) => {
      const parsed = triggerJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const result = await jobManager.triggerJob(parsed.data.queueName, parsed.data.payload);
      return reply.status(202).send(result);
    },
  );

  app.get(
    '/admin/jobs/dead-letter',
    {
      schema: {
        description: 'Returns failed jobs collected in the dead-letter queue (DLQ)',
        tags: ['Admin Jobs'],
      },
    },
    async () => {
      const deadLetters = await jobManager.getDeadLetterJobs();
      return { deadLetters, total: deadLetters.length };
    },
  );
}
