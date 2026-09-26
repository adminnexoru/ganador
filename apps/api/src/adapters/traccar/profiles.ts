/**
 * Perfiles de marca/modelo (research R5): cómo leer batería y precisión de los atributos de
 * cada protocolo y cuál es su intervalo de reporte en reposo por defecto.
 * Agregar un modelo = agregar un perfil y sus pruebas.
 */
export type Profile = {
  name: string;
  restIntervalS: number;
  battery(attrs: Record<string, unknown>): number | null;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clampPct = (v: number) => Math.round(Math.min(100, Math.max(0, v)));

/** Voltaje de batería Li-ion a porcentaje, lineal entre 3.4 V (vacía) y 4.1 V (llena). */
export function voltageToPct(volts: number) {
  return clampPct(((volts - 3.4) / (4.1 - 3.4)) * 100);
}

const fromLevelOrVoltage = (attrs: Record<string, unknown>) => {
  const level = num(attrs.batteryLevel);
  if (level !== null) return clampPct(level);
  const volts = num(attrs.battery);
  return volts !== null ? voltageToPct(volts) : null;
};

export const PROFILES: Record<string, Profile> = {
  'traccar-client': { name: 'traccar-client', restIntervalS: 60, battery: fromLevelOrVoltage },
  'generic-gt06': { name: 'generic-gt06', restIntervalS: 600, battery: fromLevelOrVoltage },
  generic: { name: 'generic', restIntervalS: 600, battery: fromLevelOrVoltage },
};

/** Perfil según el protocolo que reporta Traccar. */
export function profileForProtocol(protocol: string | undefined): Profile {
  switch (protocol) {
    case 'osmand':
      return PROFILES['traccar-client']!;
    case 'gt06':
      return PROFILES['generic-gt06']!;
    default:
      return PROFILES.generic!;
  }
}
