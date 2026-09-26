import type { NeutralDeviceEvent } from '@ganador/domain';

import type { Deps } from '../deps';
import { ingest } from '../services/ingest';

/**
 * Traccar no reenvía latidos sin posición: cada minuto se consulta la última actividad de
 * cada dispositivo y se convierte en un evento neutral `heartbeat` (contracts/device-ingest.md).
 */
export async function pollTraccarActivity(deps: Deps) {
  const list = await deps.traccar.listDevices();
  const events: NeutralDeviceEvent[] = list
    .filter((d) => d.lastUpdate)
    .map((d) => ({
      kind: 'heartbeat',
      device: { source: 'traccar', externalId: d.uniqueId },
      at: new Date(d.lastUpdate!),
    }));
  await ingest(deps, events);
}
