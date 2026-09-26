import { sql } from 'drizzle-orm';
import { boolean, check, pgEnum, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const otpChannel = pgEnum('otp_channel', ['whatsapp', 'sms']);
export const pushPlatform = pgEnum('push_platform', ['ios', 'android']);

export const owners = pgTable(
  'owners',
  {
    id: uuid().primaryKey().defaultRandom(),
    phoneE164: text().notNull().unique(),
    // "1–60 caracteres"; vacío hasta que el dueño lo captura.
    displayName: text().notNull().default(''),
    // "por defecto `false`; solo se activa con aceptación expresa" (FR-013a)
    whatsappAlertsEnabled: boolean().notNull().default(false),
    whatsappOptInAt: timestamp({ withTimezone: true }),
    // `true` al verificar por WhatsApp o si el dueño confirma que su número tiene WhatsApp.
    whatsappConfirmed: boolean().notNull().default(false),
    // "`es-MX` por defecto"
    locale: text().notNull().default('es-MX'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [check('owners_display_name_len', sql`char_length(${t.displayName}) <= 60`)],
);

export const privacyConsents = pgTable('privacy_consents', {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: uuid()
    .notNull()
    .references(() => owners.id, { onDelete: 'cascade' }),
  noticeVersion: text().notNull(),
  acceptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp({ withTimezone: true }),
});

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid().primaryKey().defaultRandom(),
    phoneE164: text().notNull(),
    codeHash: text().notNull(),
    channel: otpChannel().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // "10 minutos"
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    // "máximo 5"
    attempts: smallint().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
  },
  (t) => [check('otp_attempts_max', sql`${t.attempts} <= 5`)],
);

export const sessions = pgTable('sessions', {
  id: uuid().primaryKey().defaultRandom(),
  ownerId: uuid()
    .notNull()
    .references(() => owners.id, { onDelete: 'cascade' }),
  refreshTokenHash: text().notNull().unique(),
  // "90 días"
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const pushTokens = pgTable('push_tokens', {
  token: text().primaryKey(),
  ownerId: uuid()
    .notNull()
    .references(() => owners.id, { onDelete: 'cascade' }),
  platform: pushPlatform().notNull(),
  lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
