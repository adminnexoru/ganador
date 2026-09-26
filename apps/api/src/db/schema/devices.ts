import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { pets } from './pets';

export const deviceSource = pgEnum('device_source', ['traccar']);
export const deviceStatus = pgEnum('device_status', ['unlinked', 'linked', 'retired']);
export const deviceActivity = pgEnum('device_activity', ['moving', 'resting', 'no_signal']);
export const deviceEventType = pgEnum('device_event_type', [
  'zone_exit',
  'zone_enter',
  'battery_low',
  'signal_lost',
  'tag_viewed',
]);

export const devices = pgTable(
  'devices',
  {
    id: uuid().primaryKey().defaultRandom(),
    source: deviceSource().notNull(),
    // "único por `source`"
    externalId: text().notNull(),
    profile: text().notNull(),
    petId: uuid().references(() => pets.id, { onDelete: 'set null' }),
    status: deviceStatus().notNull().default('unlinked'),
    // "60–86,400"
    restIntervalS: integer().notNull(),
    lastSeenAt: timestamp({ withTimezone: true }),
    activity: deviceActivity(),
    activitySince: timestamp({ withTimezone: true }),
    batteryAlertArmed: boolean().notNull().default(true),
    signalAlertArmed: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('devices_source_external_id').on(t.source, t.externalId),
    // Un dispositivo solo puede estar en una mascota y una mascota tiene un dispositivo.
    uniqueIndex('devices_pet_unique').on(t.petId).where(sql`${t.petId} is not null`),
    check('devices_rest_interval', sql`${t.restIntervalS} between 60 and 86400`),
  ],
);

// Particionada por día en la migración (research R7); las particiones con más de 7 días
// se eliminan (FR-011).
export const positions = pgTable(
  'positions',
  {
    id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity(),
    deviceId: uuid().notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    accuracyM: real(),
    speedKmh: real(),
    valid: boolean().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.recordedAt] }),
    unique('positions_device_recorded').on(t.deviceId, t.recordedAt),
  ],
);

export const batteryReadings = pgTable(
  'battery_readings',
  {
    id: uuid().primaryKey().defaultRandom(),
    deviceId: uuid()
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    recordedAt: timestamp({ withTimezone: true }).notNull(),
    // "0–100"
    levelPct: smallint().notNull(),
    charging: boolean(),
  },
  (t) => [
    check('battery_level_range', sql`${t.levelPct} between 0 and 100`),
    index('battery_device_recorded').on(t.deviceId, t.recordedAt),
  ],
);

export const deviceEvents = pgTable(
  'device_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    petId: uuid()
      .notNull()
      .references(() => pets.id, { onDelete: 'cascade' }),
    deviceId: uuid().references(() => devices.id, { onDelete: 'cascade' }),
    type: deviceEventType().notNull(),
    zoneId: uuid(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    positionId: bigint({ mode: 'number' }),
  },
  (t) => [index('device_events_pet_idx').on(t.petId, t.occurredAt)],
);
