import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { owners } from './accounts';

export const species = pgEnum('species', ['dog', 'cat']);
export const petSize = pgEnum('pet_size', ['small', 'medium', 'large']);
export const accessRole = pgEnum('access_role', ['owner', 'family']);
export const accessStatus = pgEnum('access_status', ['invited', 'active', 'revoked']);

export const pets = pgTable(
  'pets',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    // "1–40 caracteres, obligatorio"
    name: text().notNull(),
    species: species().notNull(),
    // "≤ 60"
    breed: text(),
    size: petSize(),
    photoKey: text(),
    // "≤ 500"
    conditions: text(),
    medications: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('pets_name_len', sql`char_length(${t.name}) between 1 and 40`),
    check('pets_breed_len', sql`${t.breed} is null or char_length(${t.breed}) <= 60`),
    check('pets_conditions_len', sql`${t.conditions} is null or char_length(${t.conditions}) <= 500`),
    check('pets_medications_len', sql`${t.medications} is null or char_length(${t.medications}) <= 500`),
  ],
);

export const petAccess = pgTable(
  'pet_access',
  {
    id: uuid().primaryKey().defaultRandom(),
    petId: uuid()
      .notNull()
      .references(() => pets.id, { onDelete: 'cascade' }),
    // Nulo mientras la invitación no se acepta.
    ownerId: uuid().references(() => owners.id, { onDelete: 'cascade' }),
    invitedPhoneE164: text(),
    role: accessRole().notNull(),
    status: accessStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "exactamente un `owner` activo por mascota"
    uniqueIndex('pet_access_one_owner')
      .on(t.petId)
      .where(sql`${t.role} = 'owner' and ${t.status} = 'active'`),
    index('pet_access_owner_idx').on(t.ownerId),
  ],
);
