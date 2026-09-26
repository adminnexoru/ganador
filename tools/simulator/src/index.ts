// Simulador de rastreador: envía posiciones a Traccar con el protocolo OsmAnd (el mismo de
// Traccar Client, puerto 5055). Uso:
//   pnpm sim --imei 123456 --route salida [--battery 25,19,18] [--interval 60]
//            [--server http://localhost:5055] [--fast]
// --fast envía todo de inmediato con horas escalonadas hacia atrás (sin esperar).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    imei: { type: 'string' },
    route: { type: 'string', default: 'casa' },
    battery: { type: 'string' },
    interval: { type: 'string', default: '60' },
    server: { type: 'string', default: 'http://localhost:5055' },
    fast: { type: 'boolean', default: false },
  },
});

if (!values.imei) {
  console.error('Falta --imei <identificador>');
  process.exit(1);
}

const route = JSON.parse(
  readFileSync(new URL(`../routes/${values.route}.json`, import.meta.url), 'utf8'),
) as { description: string; points: [number, number][] };
const intervalS = Number(values.interval);
const batteries = values.battery?.split(',').map(Number) ?? [];
const KMH_TO_KNOTS = 1 / 1.852;

function speedKnots(i: number) {
  if (i === 0) return 0;
  const [a, b] = [route.points[i - 1]!, route.points[i]!];
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(toRad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(toRad(b[1] - a[1]) / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(h));
  return ((meters / intervalS) * 3.6) * KMH_TO_KNOTS;
}

async function send(i: number, timestamp: number) {
  const [lat, lon] = route.points[i]!;
  const params = new URLSearchParams({
    id: values.imei!,
    lat: String(lat),
    lon: String(lon),
    timestamp: String(Math.floor(timestamp / 1000)),
    speed: speedKnots(i).toFixed(2),
    accuracy: '10',
  });
  const batt = batteries[Math.min(i, batteries.length - 1)];
  if (batt !== undefined) params.set('batt', String(batt));
  const res = await fetch(`${values.server}/?${params}`, { method: 'POST' });
  console.log(`${new Date(timestamp).toISOString()} ${lat},${lon}${batt !== undefined ? ` batería ${batt}%` : ''} → ${res.status}`);
}

console.log(`Ruta "${values.route}": ${route.description} (${route.points.length} puntos cada ${intervalS} s)`);
const n = route.points.length;
for (let i = 0; i < n; i++) {
  if (values.fast) {
    await send(i, Date.now() - (n - 1 - i) * intervalS * 1000);
  } else {
    await send(i, Date.now());
    if (i < n - 1) await new Promise((r) => setTimeout(r, intervalS * 1000));
  }
}
