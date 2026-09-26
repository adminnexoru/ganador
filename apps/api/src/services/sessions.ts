import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';

import { sessions } from '../db/schema';
import type { Deps } from '../deps';
import { AppError } from '../errors';

const ACCESS_TTL_S = 15 * 60; // 15 minutos (research R13)
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export type Tokens = { accessToken: string; refreshToken: string };
export type AccessClaims = { ownerId: string; sessionId: string };

function secret(deps: Deps) {
  return new TextEncoder().encode(deps.config.JWT_SECRET);
}

async function signAccess(deps: Deps, ownerId: string, sessionId: string) {
  const iat = Math.floor(deps.now().getTime() / 1000);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ownerId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_S)
    .sign(secret(deps));
}

export async function createSession(deps: Deps, ownerId: string): Promise<Tokens> {
  const refreshToken = randomBytes(32).toString('base64url');
  const [row] = await deps.db
    .insert(sessions)
    .values({
      ownerId,
      refreshTokenHash: hash(refreshToken),
      expiresAt: new Date(deps.now().getTime() + REFRESH_TTL_MS),
      createdAt: deps.now(),
    })
    .returning({ id: sessions.id });
  return { accessToken: await signAccess(deps, ownerId, row!.id), refreshToken };
}

/** Rota el token de renovación: el anterior deja de servir. */
export async function refreshSession(deps: Deps, refreshToken: string): Promise<Tokens> {
  const [row] = await deps.db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, hash(refreshToken)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, deps.now()),
      ),
    );
  if (!row) throw new AppError(401, 'invalid_refresh_token');
  await deps.db.update(sessions).set({ revokedAt: deps.now() }).where(eq(sessions.id, row.id));
  return createSession(deps, row.ownerId);
}

export async function revokeSession(deps: Deps, sessionId: string) {
  await deps.db.update(sessions).set({ revokedAt: deps.now() }).where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(deps: Deps, ownerId: string) {
  await deps.db
    .update(sessions)
    .set({ revokedAt: deps.now() })
    .where(and(eq(sessions.ownerId, ownerId), isNull(sessions.revokedAt)));
}

export async function verifyAccess(deps: Deps, token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret(deps), {
      currentDate: deps.now(),
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.sid !== 'string') throw new Error('claims');
    return { ownerId: payload.sub, sessionId: payload.sid };
  } catch {
    throw new AppError(401, 'unauthorized');
  }
}

export async function isSessionActive(deps: Deps, sessionId: string) {
  const [row] = await deps.db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt), gt(sessions.expiresAt, deps.now())));
  return Boolean(row);
}
