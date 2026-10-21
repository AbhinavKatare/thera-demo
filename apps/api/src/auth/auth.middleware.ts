import { FastifyReply, FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { AuthService, MagicLinkPayload } from './auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: MagicLinkPayload;
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return {
    authenticate: async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Missing or invalid Authorization header',
        });
      }

      const token = authHeader.slice(7).trim();
      try {
        const payload = authService.verifyToken(token);
        req.user = payload;
      } catch {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid or expired access token',
        });
      }
    },

    requireRole: (allowedRoles: (UserRole | 'OWNER' | 'APPROVER' | 'VIEWER')[]) => {
      return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!req.user) {
          return reply.status(401).send({
            error: 'unauthorized',
            message: 'Authentication required',
          });
        }

        const userRole = req.user.role as UserRole;
        const normalizedAllowed = allowedRoles.map((r) => String(r).toUpperCase());

        if (!normalizedAllowed.includes(userRole)) {
          return reply.status(403).send({
            error: 'forbidden',
            message: `User role '${userRole}' is not permitted to perform this action. Required: [${allowedRoles.join(
              ', ',
            )}]`,
          });
        }
      };
    },
  };
}
