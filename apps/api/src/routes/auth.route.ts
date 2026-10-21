import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';

export const requestMagicLinkSchema = z.object({
  email: z.string().email(),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(10),
});

export const linkSlackUserSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  slackUserId: z.string().min(1),
  slackTeamId: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance, options: { authService: AuthService }): Promise<void> {
  const { authService } = options;

  app.post(
    '/auth/magic-link/request',
    {
      schema: {
        description: 'Requests a one-time email magic link for secure login',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = requestMagicLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const result = await authService.requestMagicLink(parsed.data.email);
      return reply.status(200).send({
        success: true,
        message: 'Magic link sent. Check your email inbox.',
        token: result.token, // echo token in dev for zero-friction testing
        link: result.link,
      });
    },
  );

  app.post(
    '/auth/magic-link/verify',
    {
      schema: {
        description: 'Verifies a magic link token and issues a 7-day JWT access token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = verifyMagicLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      try {
        const { accessToken, user } = await authService.verifyMagicLink(parsed.data.token);
        return reply.status(200).send({
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
          },
        });
      } catch (err: any) {
        return reply.status(400).send({ error: 'verification_failed', message: err.message });
      }
    },
  );

  app.post(
    '/auth/slack/link',
    {
      schema: {
        description: 'Links an external Slack User ID to an internal PayPilot User account',
        tags: ['Authentication'],
      },
    },
    async (req, reply) => {
      const parsed = linkSlackUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const mapping = await authService.linkSlackUser(
        parsed.data.companyId,
        parsed.data.userId,
        parsed.data.slackUserId,
        parsed.data.slackTeamId,
      );
      return reply.status(200).send({ success: true, mapping });
    },
  );

  app.get(
    '/auth/slack/:slackUserId',
    {
      schema: {
        description: 'Resolves a Slack User ID to an internal PayPilot User account',
        tags: ['Authentication'],
      },
    },
    async (req, reply) => {
      const { slackUserId } = req.params as { slackUserId: string };
      const user = await authService.getUserBySlackId(slackUserId);
      if (!user) {
        return reply.status(404).send({ error: 'not_mapped', message: `Slack user '${slackUserId}' is not linked.` });
      }
      return reply.status(200).send({
        mapped: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
      });
    },
  );

  app.post(
    '/auth/slack/link-by-email',
    {
      schema: {
        description: 'Links an external Slack User ID by matching user email',
        tags: ['Authentication'],
      },
    },
    async (req, reply) => {
      const schema = z.object({
        email: z.string().email(),
        slackUserId: z.string().min(1),
        slackTeamId: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }
      try {
        const result = await authService.linkSlackUserByEmail(
          parsed.data.email,
          parsed.data.slackUserId,
          parsed.data.slackTeamId,
        );
        return reply.status(200).send({ success: true, ...result });
      } catch (err: any) {
        return reply.status(404).send({ error: 'user_not_found', message: err.message });
      }
    },
  );
}
