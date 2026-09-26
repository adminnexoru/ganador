import { and, count, desc, eq, gt, isNotNull, isNull, max } from 'drizzle-orm';

import { deviceEvents, tags, tagViews } from '../db/schema';
import type { Deps } from '../deps';
import { dispatchEvent } from '../services/notifications';

const GROUP_MS = 5 * 60 * 1000; // como máximo una notificación cada 5 minutos por placa

/**
 * Avisa al dueño de las consultas pendientes de una placa, agrupadas (FR-024, edge case de
 * muchas consultas seguidas). El aviso lleva el número de consultas y la hora de la última.
 */
export async function notifyTagViews(deps: Deps, tagId: string) {
  const now = deps.now();
  const [recent] = await deps.db
    .select({ id: tagViews.id })
    .from(tagViews)
    .where(and(eq(tagViews.tagId, tagId), isNotNull(tagViews.notifiedAt), gt(tagViews.notifiedAt, new Date(now.getTime() - GROUP_MS))))
    .limit(1);
  if (recent) return; // el barrido de cada minuto lo enviará al cumplirse los 5 minutos

  const [pending] = await deps.db
    .select({ n: count(), last: max(tagViews.viewedAt) })
    .from(tagViews)
    .where(and(eq(tagViews.tagId, tagId), isNull(tagViews.notifiedAt)));
  if (!pending || pending.n === 0) return;

  const [tag] = await deps.db.select().from(tags).where(eq(tags.id, tagId));
  if (!tag?.petId || tag.status !== 'active') return;

  await deps.db
    .update(tagViews)
    .set({ notifiedAt: now })
    .where(and(eq(tagViews.tagId, tagId), isNull(tagViews.notifiedAt)));
  const [event] = await deps.db
    .insert(deviceEvents)
    .values({ petId: tag.petId, type: 'tag_viewed', occurredAt: pending.last ?? now })
    .returning({ id: deviceEvents.id });
  await dispatchEvent(deps, event!.id, { count: pending.n });
}

/** Barrido de cada minuto: envía los grupos que quedaron pendientes. */
export async function sweepTagViews(deps: Deps) {
  const rows = await deps.db
    .selectDistinct({ tagId: tagViews.tagId })
    .from(tagViews)
    .where(isNull(tagViews.notifiedAt))
    .orderBy(desc(tagViews.tagId));
  for (const { tagId } of rows) await notifyTagViews(deps, tagId);
}
