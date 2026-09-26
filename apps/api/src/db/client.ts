import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Schema = typeof schema;
/** Base de datos independiente del driver (postgres-js en servidor, PGlite en pruebas). */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema, casing: 'snake_case' }) as unknown as Db;
  return { db, close: () => sql.end() };
}

export { schema };
