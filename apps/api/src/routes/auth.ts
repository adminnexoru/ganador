import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../errors';
import { authenticate, hasCurrentConsent } from '../plugins/auth';
import { requestOtp, verifyOtp } from '../services/auth';
import { refreshSession, revokeSession } from '../services/sessions';
import { loadUser, serializeUser } from './me';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/otp', async (req, reply) => {
    const { phone } = z.object({ phone: z.string().max(20) }).parse(req.body);
    await requestOtp(app.deps, phone);
    return reply.status(202).send();
  });

  app.post('/auth/verify', async (req) => {
    const body = z.object({ phone: z.string().max(20), code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!body.success) throw new AppError(400, 'invalid_code');
    const result = await verifyOtp(app.deps, body.data.phone, body.data.code);
    const user = await loadUser(app, result.ownerId);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: serializeUser(user),
      needsConsent: !(await hasCurrentConsent(app, result.ownerId)),
    };
  });

  app.post('/auth/refresh', async (req) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    return refreshSession(app.deps, refreshToken);
  });

  app.post(
    '/auth/logout',
    { preHandler: authenticate(app), config: { skipConsent: true } },
    async (req, reply) => {
      await revokeSession(app.deps, req.user.sessionId);
      return reply.status(204).send();
    },
  );
}
