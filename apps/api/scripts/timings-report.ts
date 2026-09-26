// Percentil 95 de los tiempos reales por métrica y día (research R17, SC-001, SC-003).
//   DATABASE_URL=... pnpm --filter @ganador/api timings-report [--days 7]
import { parseArgs } from 'node:util';

import { and, gte } from 'drizzle-orm';

import { createDb } from '../src/db/client';
import { telemetryTimings } from '../src/db/schema';
import { percentileFromHistogram } from '../src/services/timings';

const { values } = parseArgs({ options: { days: { type: 'string', default: '7' } } });
const since = new Date(Date.now() - Number(values.days) * 24 * 3600_000).toISOString().slice(0, 10);
const { db, close } = createDb(process.env.DATABASE_URL ?? '');
const rows = await db.select().from(telemetryTimings).where(and(gte(telemetryTimings.day, since)));
await close();

const goals: Record<string, number> = { owner_map_visible: 10_000, public_contact_visible: 5_000 };
const groups = new Map<string, typeof rows>();
for (const r of rows) {
  const key = `${r.day} ${r.metric} ${r.platform}`;
  groups.set(key, [...(groups.get(key) ?? []), r]);
}
for (const [key, list] of [...groups].sort()) {
  const p95 = percentileFromHistogram(list, 0.95);
  const n = list.reduce((s, r) => s + r.count, 0);
  const metric = key.split(' ')[1]!;
  const ok = p95 !== null && p95 <= goals[metric]!;
  console.log(`${key}: p95 ≤ ${p95} ms (n=${n}) ${ok ? 'cumple' : 'NO cumple'} la meta de ${goals[metric]} ms`);
}
