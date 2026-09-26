import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { otpChallenges, owners } from '../db/schema';
import type { Deps } from '../deps';
import { AppError } from '../errors';
import type { OtpChannel } from '../messaging/provider';
import { createSession, type Tokens } from './sessions';

const CODE_TTL_MS = 10 * 60 * 1000; // vence en 10 minutos
const MAX_ATTEMPTS = 5; // máximo 5 intentos por código
const MAX_CODES_PER_HOUR = 5; // máximo 5 códigos por número por hora

/** Normaliza a E.164 de México: acepta "5512345678", "+525512345678" o "52 55 1234 5678". */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  const national = digits.length === 12 && digits.startsWith('52') ? digits.slice(2) : digits;
  if (!/^\d{10}$/.test(national)) throw new AppError(400, 'invalid_phone');
  return `+52${national}`;
}

function hashCode(deps: Deps, phone: string, code: string) {
  return createHmac('sha256', deps.config.JWT_SECRET).update(`${phone}:${code}`).digest('hex');
}

/** Envía un código de 6 dígitos por WhatsApp y, si falla, por SMS (FR-001). */
export async function requestOtp(deps: Deps, rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const now = deps.now();
  const [recent] = await deps.db
    .select({ n: count() })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.phoneE164, phone),
        gt(otpChallenges.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    );
  if ((recent?.n ?? 0) >= MAX_CODES_PER_HOUR) {
    throw new AppError(429, 'too_many_codes', {}, { 'Retry-After': '3600' });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  let channel: OtpChannel = 'whatsapp';
  try {
    await deps.messaging.sendOtp(phone, code, 'whatsapp');
  } catch {
    channel = 'sms';
    await deps.messaging.sendOtp(phone, code, 'sms');
  }

  // Un código nuevo invalida los anteriores del mismo número.
  await deps.db
    .update(otpChallenges)
    .set({ consumedAt: now })
    .where(and(eq(otpChallenges.phoneE164, phone), isNull(otpChallenges.consumedAt)));
  await deps.db.insert(otpChallenges).values({
    phoneE164: phone,
    codeHash: hashCode(deps, phone, code),
    channel,
    createdAt: now,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
  });
}

export type VerifyResult = Tokens & { ownerId: string };

/** Verifica el código; crea la cuenta si el número es nuevo. */
export async function verifyOtp(deps: Deps, rawPhone: string, code: string): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);
  const now = deps.now();
  const [challenge] = await deps.db
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.phoneE164, phone),
        isNull(otpChallenges.consumedAt),
        gt(otpChallenges.expiresAt, now),
      ),
    )
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) throw new AppError(400, 'invalid_code');

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashCode(deps, phone, String(code)), 'hex');
  if (!timingSafeEqual(expected, actual)) {
    const attempts = challenge.attempts + 1;
    await deps.db
      .update(otpChallenges)
      .set({ attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: now } : {}) })
      .where(eq(otpChallenges.id, challenge.id));
    throw new AppError(400, 'invalid_code');
  }
  await deps.db.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));

  const viaWhatsapp = challenge.channel === 'whatsapp';
  let [owner] = await deps.db.select().from(owners).where(eq(owners.phoneE164, phone));
  if (!owner) {
    [owner] = await deps.db
      .insert(owners)
      .values({ phoneE164: phone, whatsappConfirmed: viaWhatsapp, createdAt: now })
      .returning();
  } else if (viaWhatsapp && !owner.whatsappConfirmed) {
    await deps.db.update(owners).set({ whatsappConfirmed: true }).where(eq(owners.id, owner.id));
  }
  const tokens = await createSession(deps, owner!.id);
  return { ...tokens, ownerId: owner!.id };
}
