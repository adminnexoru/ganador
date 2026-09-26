import { applyTick } from '@ganador/domain';
import { and, eq, isNotNull, ne, or, isNull } from 'drizzle-orm';

import { devices } from '../db/schema';
import type { Deps } from '../deps';

type DeviceRow = typeof devices.$inferSelect;

/** Se llama cuando un dispositivo pasa a no_signal (la alerta llega en US3). */
let onSignalLost: (deps: Deps, device: DeviceRow) => Promise<void> = async () => {};
export function setSignalLostHook(fn: typeof onSignalLost) {
  onSignalLost = fn;
}

/** Cada minuto marca no_signal a los dispositivos que superan su umbral (FR-009, FR-016). */
export async function sweepActivity(deps: Deps) {
  const candidates = await deps.db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.status, 'linked'),
        isNotNull(devices.lastSeenAt),
        or(isNull(devices.activity), ne(devices.activity, 'no_signal')),
      ),
    );
  const now = deps.now();
  for (const d of candidates) {
    const state = { activity: d.activity, since: d.activitySince, lastSeenAt: d.lastSeenAt, lastFix: null };
    const next = applyTick(state, now, d.restIntervalS);
    if (next === state) continue;
    const [updated] = await deps.db
      .update(devices)
      .set({ activity: next.activity, activitySince: next.since })
      .where(eq(devices.id, d.id))
      .returning();
    await onSignalLost(deps, updated!);
  }
}
