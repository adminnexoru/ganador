import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { devices } from './devices';
import { pets } from './pets';

export const zoneStateValue = pgEnum('zone_state_value', ['inside', 'outside', 'unknown']);

export const safeZones = pgTable(
  'safe_zones',
  {
    id: uuid().primaryKey().defaultRandom(),
    petId: uuid()
      .notNull()
      .references(() => pets.id, { onDelete: 'cascade' }),
    // "1–40"
    name: text().notNull(),
    centerLat: doublePrecision().notNull(),
    centerLng: doublePrecision().notNull(),
    // "50–2,000"
    radiusM: integer().notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [
    check('zones_name_len', sql`char_length(${t.name}) between 1 and 40`),
    check('zones_radius_range', sql`${t.radiusM} between 50 and 2000`),
  ],
);

export const zoneStates = pgTable(
  'zone_states',
  {
    zoneId: uuid()
      .notNull()
      .references(() => safeZones.id, { onDelete: 'cascade' }),
    deviceId: uuid()
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    state: zoneStateValue().notNull().default('unknown'),
    pendingState: zoneStateValue(),
    pendingCount: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.zoneId, t.deviceId] })],
);
