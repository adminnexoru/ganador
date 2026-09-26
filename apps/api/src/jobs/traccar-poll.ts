import { heartbeatsFromDevices } from '../adapters/traccar/adapter';
import type { Deps } from '../deps';
import { ingest } from '../services/ingest';

/**
 * Traccar no reenvía latidos sin posición: cada minuto se consulta la última actividad de
 * cada dispositivo y el adaptador la convierte en eventos neutrales `heartbeat`
 * (contracts/device-ingest.md).
 */
export async function pollTraccarActivity(deps: Deps) {
  await ingest(deps, heartbeatsFromDevices(await deps.traccar.listDevices()));
}
