import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { loadConfig } from '../config';
import { createDb } from './client';

const { db, close } = createDb(loadConfig().DATABASE_URL);
await migrate(db as never, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
await close();
console.log('Migraciones aplicadas');
