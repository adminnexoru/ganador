import { index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { owners } from './accounts';
import { deviceEvents } from './devices';

export const notificationChannel = pgEnum('notification_channel', ['push', 'whatsapp']);
export const notificationStatus = pgEnum('notification_status', ['pending', 'sent', 'failed']);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    eventId: uuid()
      .notNull()
      .references(() => deviceEvents.id, { onDelete: 'cascade' }),
    recipientId: uuid()
      .notNull()
      .references(() => owners.id, { onDelete: 'cascade' }),
    channel: notificationChannel().notNull(),
    status: notificationStatus().notNull().default('pending'),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('notifications_event_idx').on(t.eventId)],
);
