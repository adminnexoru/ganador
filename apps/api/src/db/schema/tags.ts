import { sql } from 'drizzle-orm';
import { boolean, check, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { pets } from './pets';

export const tagStatus = pgEnum('tag_status', ['inactive', 'active', 'disabled']);

export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    // "10 caracteres base32, único, aleatorio"
    code: text().notNull().unique(),
    petId: uuid().references(() => pets.id, { onDelete: 'set null' }),
    status: tagStatus().notNull().default('inactive'),
    activatedAt: timestamp({ withTimezone: true }),
  },
  (t) => [check('tags_code_len', sql`char_length(${t.code}) = 10`)],
);

// El botón de WhatsApp siempre se muestra (FR-023), por eso no hay campos de teléfono.
export const publicProfileSettings = pgTable('public_profile_settings', {
  petId: uuid()
    .primaryKey()
    .references(() => pets.id, { onDelete: 'cascade' }),
  showOwnerName: boolean().notNull().default(true),
  showConditions: boolean().notNull().default(false),
  showMedications: boolean().notNull().default(false),
});

// Sin IP, agente de usuario ni ubicación de quien consulta (FR-024a).
export const tagViews = pgTable(
  'tag_views',
  {
    id: uuid().primaryKey().defaultRandom(),
    tagId: uuid()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('tag_views_tag_idx').on(t.tagId, t.viewedAt)],
);
