import { and, eq, lt, sql } from 'drizzle-orm';

import { batteryReadings, deviceEvents, petAccess, tagViews } from '../db/schema';
import type { Deps } from '../deps';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Retención diaria (FR-011, research R16): posiciones y datos de posición 7 días, consultas
 * de placa 90 días, invitaciones sin aceptar 30 días. Crea las particiones futuras.
 */
export async function runRetention(deps: Deps) {
  const now = deps.now().getTime();
  await deps.db.execute(sql`select ensure_position_partitions(2)`);
  await deps.db.execute(sql`select drop_old_position_partitions(7)`);
  await deps.db.delete(batteryReadings).where(lt(batteryReadings.recordedAt, new Date(now - 7 * DAY)));
  await deps.db
    .delete(deviceEvents)
    .where(and(sql`${deviceEvents.type} <> 'tag_viewed'`, lt(deviceEvents.occurredAt, new Date(now - 7 * DAY))));
  await deps.db
    .delete(deviceEvents)
    .where(and(eq(deviceEvents.type, 'tag_viewed'), lt(deviceEvents.occurredAt, new Date(now - 90 * DAY))));
  await deps.db.delete(tagViews).where(lt(tagViews.viewedAt, new Date(now - 90 * DAY)));
  await deps.db
    .delete(petAccess)
    .where(and(eq(petAccess.status, 'invited'), lt(petAccess.createdAt, new Date(now - 30 * DAY))));
  await purgeTraccarPositions(deps);
}

/** La base de Traccar no es fuente de verdad: se borran sus posiciones de más de 7 días. */
async function purgeTraccarPositions(deps: Deps) {
  const url = deps.config.DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/traccar$1');
  if (deps.config.NODE_ENV === 'test' || !url.startsWith('postgres')) return;
  const { default: postgres } = await import('postgres');
  const sqlTraccar = postgres(url, { max: 1 });
  try {
    await sqlTraccar`delete from tc_positions where fixtime < now() - interval '7 days'
      and id not in (select positionid from tc_devices where positionid is not null)`;
  } finally {
    await sqlTraccar.end();
  }
}
