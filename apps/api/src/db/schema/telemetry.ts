import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

// Conteos diarios por rango de tiempo (research R17). Sin identificadores de nadie.
export const telemetryTimings = pgTable(
  'telemetry_timings',
  {
    day: date().notNull(),
    metric: text().notNull(),
    platform: text().notNull(),
    /** Límite superior del rango en ms (el último rango usa 2147483647). */
    bucketMs: integer().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric, t.platform, t.bucketMs] })],
);
