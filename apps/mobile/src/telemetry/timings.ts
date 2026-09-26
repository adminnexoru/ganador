import { Platform } from 'react-native';

import { API_URL } from '@/api/config';

// Medición anónima de tiempos (research R17): sin identificadores de usuario ni de mascota.
// El módulo se importa primero en el layout raíz para registrar el inicio de la app.
const APP_START = Date.now();
const reported = new Set<string>();

export function reportTiming(metric: 'owner_map_visible') {
  if (reported.has(metric)) return;
  reported.add(metric);
  const ms = Date.now() - APP_START;
  void fetch(`${API_URL}/v1/telemetry/timings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric, ms: Math.min(ms, 120_000), platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
  }).catch(() => undefined);
}
