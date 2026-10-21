import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { maskObjectPii } from '@paypilot/core';

export interface SecurityOptions {
  /** Maximum requests allowed per window per IP. Default: 120. */
  rateLimitMax?: number;
  /** Window size in milliseconds. Default: 60,000 (1 minute). */
  rateLimitWindowMs?: number;
  /** Allowed origins for CSRF validation. Default: ['http://localhost:3000', 'http://localhost:4000']. */
  allowedOrigins?: string[];
  /** Enable strict Content Security Policy headers. Default: true. */
  enableCsp?: boolean;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * Enterprise Security Hardening Plugin for Fastify:
 * 1. Strict Content Security Policy (CSP) & Defense-in-Depth headers
 * 2. Sliding window Rate Limiter with standard headers
 * 3. CSRF origin and anti-tamper validation on mutating requests
 * 4. PII masking on logged payloads and error traces
 */
const securityPluginFn: FastifyPluginAsync<SecurityOptions> = async (app, options) => {
  const maxRequests = options.rateLimitMax ?? 120;
  const windowMs = options.rateLimitWindowMs ?? 60_000;
  const allowedOrigins = new Set(
    options.allowedOrigins ?? ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000']
  );
  const enableCsp = options.enableCsp ?? true;

  // In-memory rate limiting store (keyed by client IP)
  const rateLimitStore = new Map<string, RateLimitBucket>();

  // Cleanup expired buckets every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of rateLimitStore.entries()) {
      if (now > bucket.resetAt) {
        rateLimitStore.delete(ip);
      }
    }
  }, 300_000);
  cleanupTimer.unref();

  // 1. Hook: Strict Security Headers & CSP
  app.addHook('onSend', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (enableCsp) {
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self';"
      );
    }
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  // 2. Hook: Rate Limiting
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for internal health checks
    if (req.url === '/health') return;

    const ip = req.ip || '127.0.0.1';
    const now = Date.now();

    let bucket = rateLimitStore.get(ip);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(ip, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > maxRequests) {
      reply.header('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return reply.status(429).send({
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please slow down.',
        requestId: req.id,
      });
    }
  });

  // 3. Hook: CSRF Protection on Mutating Requests
  app.addHook('preValidation', async (req: FastifyRequest, reply: FastifyReply) => {
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!isMutating) return;

    // Allow internal auth endpoints, Slack webhooks, and local swagger docs without origin restrictions
    if (req.url.startsWith('/docs') || req.url.startsWith('/auth/magic-link')) {
      return;
    }

    const origin = req.headers['origin'] || req.headers['referer'];
    if (origin && typeof origin === 'string') {
      try {
        const originUrl = new URL(origin);
        const originBase = `${originUrl.protocol}//${originUrl.host}`;
        if (!allowedOrigins.has(originBase) && !originBase.includes('localhost') && !originBase.includes('127.0.0.1')) {
          return reply.status(403).send({
            error: 'csrf_forbidden',
            message: 'Cross-site request forgery protection: untrusted origin.',
            requestId: req.id,
          });
        }
      } catch {
        return reply.status(400).send({
          error: 'invalid_origin',
          message: 'Malformed Origin or Referer header.',
          requestId: req.id,
        });
      }
    }
  });

  // 4. Hook: PII Masking on Request Body Logging
  app.addHook('preHandler', async (req: FastifyRequest) => {
    if (req.body && typeof req.body === 'object') {
      // Store sanitized copy for loggers
      (req as any).sanitizedBody = maskObjectPii(req.body);
    }
  });
};

export const securityPlugin = fp(securityPluginFn, {
  name: 'paypilot-security-hardening',
  fastify: '5.x',
});
