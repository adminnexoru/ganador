// Medición anónima de tiempos (research R17). Se implementa por completo en T110.
const reported = new Set<string>();

export function reportTiming(metric: 'owner_map_visible' | 'public_contact_visible') {
  if (reported.has(metric)) return;
  reported.add(metric);
}
