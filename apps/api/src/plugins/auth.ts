import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { owners, privacyConsents } from '../db/schema';
import { AppError } from '../errors';
import { isSessionActive, verifyAccess } from '../services/sessions';

export type AuthUser = typeof owners.$inferSelect & { sessionId: string };

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
  interface FastifyContextConfig {
    /** Rutas que se pueden usar antes de aceptar el aviso de privacidad. */
    skipConsent?: boolean;
  }
}

export async function hasCurrentConsent(app: FastifyInstance, ownerId: string) {
  const [row] = await app.deps.db
    .select({ id: privacyConsents.id })
    .from(privacyConsents)
    .where(
      and(
        eq(privacyConsents.ownerId, ownerId),
        eq(privacyConsents.noticeVersion, app.deps.config.PRIVACY_NOTICE_VERSION),
        isNull(privacyConsents.revokedAt),
      ),
    );
  return Boolean(row);
}

/**
 * preHandler de autenticación y guarda de consentimiento (FR-002): sin consentimiento
 * vigente, todo responde 403 consent_required salvo las rutas marcadas con skipConsent.
 */
export function authenticate(app: FastifyInstance) {
  return async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'unauthorized');
    const claims = await verifyAccess(app.deps, header.slice(7));
    if (!(await isSessionActive(app.deps, claims.sessionId))) throw new AppError(401, 'unauthorized');
    const [owner] = await app.deps.db
      .select()
      .from(owners)
      .where(and(eq(owners.id, claims.ownerId), isNull(owners.deletedAt)));
    if (!owner) throw new AppError(401, 'unauthorized');
    req.user = { ...owner, sessionId: claims.sessionId };
    if (!req.routeOptions.config.skipConsent && !(await hasCurrentConsent(app, owner.id))) {
      throw new AppError(403, 'consent_required');
    }
  };
}
