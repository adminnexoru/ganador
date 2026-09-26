import {
  AdapterError,
  type DeviceAdapter,
  type DeviceRef,
  type NeutralDevice,
  type NeutralDeviceEvent,
} from '@ganador/domain';
import { z } from 'zod';

import { profileForProtocol } from './profiles';

// Formato JSON del reenvío de Traccar (forward.json y event.forward). Solo existe aquí.
const TraccarDeviceSchema = z.object({
  uniqueId: z.string().min(1),
  lastUpdate: z.string().nullish(),
});
const TraccarPositionSchema = z.object({
  protocol: z.string().optional(),
  fixTime: z.string(),
  valid: z.boolean(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().nullish(),
  accuracy: z.number().nullish(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
const TraccarEventSchema = z.object({ type: z.string(), eventTime: z.string() });

const ForwardSchema = z.union([
  z.object({ position: TraccarPositionSchema, device: TraccarDeviceSchema }),
  z.object({ event: TraccarEventSchema, device: TraccarDeviceSchema }),
]);

export type TraccarForward = {
  position?: z.input<typeof TraccarPositionSchema> & Record<string, unknown>;
  event?: z.input<typeof TraccarEventSchema> & Record<string, unknown>;
  device: z.input<typeof TraccarDeviceSchema> & Record<string, unknown>;
};

const KNOTS_TO_KMH = 1.852;

function parseForward(raw: TraccarForward) {
  const parsed = ForwardSchema.safeParse(raw);
  if (!parsed.success) throw new AdapterError('Cuerpo de Traccar inválido');
  return parsed.data;
}

const date = (s: string) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new AdapterError('Fecha inválida');
  return d;
};

/** Adaptador de Traccar al modelo neutral (principio I, contracts/device-ingest.md). */
export class TraccarAdapter implements DeviceAdapter<TraccarForward> {
  readonly source = 'traccar' as const;

  parse(raw: TraccarForward): NeutralDeviceEvent[] {
    const data = parseForward(raw);
    const device: DeviceRef = { source: 'traccar', externalId: data.device.uniqueId };

    if ('event' in data) {
      const at = date(data.event.eventTime);
      if (data.event.type === 'deviceOnline') return [{ kind: 'online', device, at }];
      if (data.event.type === 'deviceOffline') return [{ kind: 'offline', device, at }];
      return [];
    }

    const p = data.position;
    const recordedAt = date(p.fixTime);
    // (0,0) es la posición que envían muchos rastreadores sin fix: cuenta como latido.
    if (p.latitude === 0 && p.longitude === 0) return [{ kind: 'heartbeat', device, at: recordedAt }];

    const profile = profileForProtocol(p.protocol);
    const level = profile.battery(p.attributes);
    const charge = p.attributes.charge;
    return [
      {
        kind: 'position',
        position: {
          device,
          recordedAt,
          lat: p.latitude,
          lng: p.longitude,
          accuracyM: p.accuracy ? p.accuracy : null,
          speedKmh: p.speed != null ? p.speed * KNOTS_TO_KMH : null,
          valid: p.valid,
        },
        battery:
          level === null
            ? null
            : { device, recordedAt, levelPct: level, charging: typeof charge === 'boolean' ? charge : null },
      },
    ];
  }

  describe(raw: TraccarForward): NeutralDevice {
    const data = parseForward(raw);
    const protocol = 'position' in data ? data.position.protocol : undefined;
    const profile = profileForProtocol(protocol);
    const reported = 'position' in data ? data.position.attributes.interval : undefined;
    const interval =
      typeof reported === 'number' && reported >= 60 && reported <= 86_400 ? Math.round(reported) : profile.restIntervalS;
    return {
      device: { source: 'traccar', externalId: data.device.uniqueId },
      profile: profile.name,
      restIntervalS: interval,
      lastSeenAt: data.device.lastUpdate ? date(data.device.lastUpdate) : null,
    };
  }
}
