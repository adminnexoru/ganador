import { AdapterError } from '@ganador/domain';
import { describe, expect, it } from 'vitest';

import { TraccarAdapter, type TraccarForward } from '../../src/adapters/traccar/adapter';
import gt06 from '../fixtures/traccar/gt06-position.json';
import onlineEvent from '../fixtures/traccar/device-online-event.json';
import osmand from '../fixtures/traccar/osmand-position.json';

const adapter = new TraccarAdapter();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('TraccarAdapter.parse (contracts/device-ingest.md)', () => {
  it('traduce una posición OsmAnd al modelo neutral', () => {
    const [ev] = adapter.parse(osmand as TraccarForward);
    expect(ev).toEqual({
      kind: 'position',
      position: {
        device: { source: 'traccar', externalId: '123456' },
        recordedAt: new Date('2026-09-26T18:00:00.000Z'),
        lat: 19.4326,
        lng: -99.1332,
        accuracyM: 12.5,
        speedKmh: 2.7 * 1.852,
        valid: true,
      },
      battery: {
        device: { source: 'traccar', externalId: '123456' },
        recordedAt: new Date('2026-09-26T18:00:00.000Z'),
        levelPct: 87,
        charging: false,
      },
    });
  });

  it('precisión 0 significa desconocida (null)', () => {
    const [ev] = adapter.parse(gt06 as TraccarForward);
    expect(ev!.kind === 'position' && ev!.position.accuracyM).toBeNull();
  });

  it('convierte voltaje a porcentaje en el perfil generic-gt06', () => {
    const [ev] = adapter.parse(gt06 as TraccarForward);
    expect(ev!.kind === 'position' && ev!.battery).toMatchObject({ levelPct: 64, charging: true });
  });

  it('limita el porcentaje de batería a 0–100', () => {
    const raw = clone(gt06) as TraccarForward;
    raw.position!.attributes = { battery: 4.5 };
    const [ev] = adapter.parse(raw);
    expect(ev!.kind === 'position' && ev!.battery?.levelPct).toBe(100);
  });

  it('sin atributos de batería no hay lectura', () => {
    const raw = clone(osmand) as TraccarForward;
    raw.position!.attributes = {};
    const [ev] = adapter.parse(raw);
    expect(ev!.kind === 'position' && ev!.battery).toBeNull();
  });

  it('descarta la posición (0,0) y la reporta como latido', () => {
    const raw = clone(osmand) as TraccarForward;
    raw.position!.latitude = 0;
    raw.position!.longitude = 0;
    const events = adapter.parse(raw);
    expect(events).toEqual([
      { kind: 'heartbeat', device: { source: 'traccar', externalId: '123456' }, at: new Date('2026-09-26T18:00:00.000Z') },
    ]);
  });

  it('respeta valid=false', () => {
    const raw = clone(osmand) as TraccarForward;
    raw.position!.valid = false;
    const [ev] = adapter.parse(raw);
    expect(ev!.kind === 'position' && ev!.position.valid).toBe(false);
  });

  it('traduce deviceOnline y deviceOffline', () => {
    expect(adapter.parse(onlineEvent as TraccarForward)).toEqual([
      { kind: 'online', device: { source: 'traccar', externalId: '864895030000001' }, at: new Date('2026-09-26T18:10:00.000Z') },
    ]);
  });

  it('ignora otros eventos de Traccar (geocercas, alarmas)', () => {
    const raw = clone(onlineEvent) as TraccarForward;
    raw.event!.type = 'geofenceExit';
    expect(adapter.parse(raw)).toEqual([]);
  });

  it('lanza AdapterError con un cuerpo inválido', () => {
    expect(() => adapter.parse({} as TraccarForward)).toThrow(AdapterError);
    const raw = clone(osmand) as TraccarForward;
    raw.position!.latitude = 123;
    expect(() => adapter.parse(raw)).toThrow(AdapterError);
  });
});

describe('TraccarAdapter.describe', () => {
  it('Traccar Client usa el perfil traccar-client con 60 s en reposo', () => {
    expect(adapter.describe(osmand as TraccarForward)).toEqual({
      device: { source: 'traccar', externalId: '123456' },
      profile: 'traccar-client',
      restIntervalS: 60,
      lastSeenAt: new Date('2026-09-26T18:00:02.000Z'),
    });
  });

  it('GT06 usa el perfil generic-gt06 con 600 s en reposo', () => {
    expect(adapter.describe(gt06 as TraccarForward)).toMatchObject({ profile: 'generic-gt06', restIntervalS: 600 });
  });

  it('usa el intervalo real si el rastreador lo informa', () => {
    const raw = clone(gt06) as TraccarForward;
    raw.position!.attributes = { ...raw.position!.attributes, interval: 300 };
    expect(adapter.describe(raw).restIntervalS).toBe(300);
  });
});
