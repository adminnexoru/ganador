// Modelo neutral de dispositivos (principio I, contracts/device-ingest.md).
// Solo los adaptadores conocen formatos externos; todo lo demás usa estos tipos.

export type DeviceSource = 'traccar';

export type DeviceRef = { source: DeviceSource; externalId: string };

export type NeutralDevice = {
  device: DeviceRef;
  /** Perfil de marca/modelo, p. ej. 'generic-gt06', 'traccar-client'. */
  profile: string;
  /** Intervalo de reporte en reposo, en segundos; base del umbral de señal (FR-009a). */
  restIntervalS: number;
  /** Última actividad, con o sin posición. */
  lastSeenAt: Date | null;
};

export type NeutralPosition = {
  device: DeviceRef;
  recordedAt: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedKmh: number | null;
  valid: boolean;
};

export type NeutralBattery = {
  device: DeviceRef;
  recordedAt: Date;
  /** 0–100, ya convertido según el perfil de marca. */
  levelPct: number;
  charging: boolean | null;
};

export type NeutralDeviceEvent =
  | { kind: 'position'; position: NeutralPosition; battery: NeutralBattery | null }
  | { kind: 'online' | 'offline'; device: DeviceRef; at: Date }
  | { kind: 'heartbeat'; device: DeviceRef; at: Date };

export interface DeviceAdapter<Raw> {
  source: DeviceSource;
  /** Puro, sin E/S; lanza AdapterError si el dato es inválido. */
  parse(raw: Raw): NeutralDeviceEvent[];
  /** Perfil e intervalo en reposo del dispositivo. */
  describe(raw: Raw): NeutralDevice;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_payload' | 'invalid_position' = 'invalid_payload',
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export type Activity = 'moving' | 'resting' | 'no_signal';
