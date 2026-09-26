// Prueba de carga de la ingesta (SC-002, SC-007): 5,000 rastreadores reportando cada 60 s
// contra POST /ingest/traccar/positions, y consultas de ubicación de la app (SC-001).
//
//   k6 run -e API=http://localhost:3000 -e SECRET=<INGEST_SECRET> \
//          -e TOKEN=<accessToken de un dueño> -e PET=<petId> tools/loadtest/ingest.k6.js
//
// Antes, vincular los dispositivos "load-00000" … "load-04999" (script en la guía de
// quickstart o con SQL). Umbrales: ingesta p95 < 5 s, ubicación p95 < 1 s, errores < 1 %.
import http from 'k6/http';
import { check } from 'k6';

const DEVICES = Number(__ENV.DEVICES ?? 5000);
const API = __ENV.API ?? 'http://localhost:3000';

export const options = {
  scenarios: {
    // 5,000 posiciones por minuto ≈ 83.3 por segundo.
    ingest: {
      executor: 'constant-arrival-rate',
      rate: Math.ceil(DEVICES / 60),
      timeUnit: '1s',
      duration: __ENV.DURATION ?? '10m',
      preAllocatedVUs: 50,
      maxVUs: 400,
      exec: 'ingest',
    },
    // Dueños abriendo la app: 20 consultas de ubicación por segundo.
    location: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: __ENV.DURATION ?? '10m',
      preAllocatedVUs: 10,
      maxVUs: 100,
      exec: 'location',
    },
  },
  thresholds: {
    'http_req_duration{scenario:ingest}': ['p(95)<5000'],
    'http_req_duration{scenario:location}': ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

let tick = 0;

export function ingest() {
  const n = (tick++ * 7919 + __VU * 104729) % DEVICES;
  const id = `load-${String(n).padStart(5, '0')}`;
  const now = new Date().toISOString();
  const body = JSON.stringify({
    position: {
      protocol: 'osmand',
      fixTime: now,
      deviceTime: now,
      valid: true,
      latitude: 19.4194 + (Math.random() - 0.5) * 0.01,
      longitude: -99.1614 + (Math.random() - 0.5) * 0.01,
      speed: Math.random() * 3,
      accuracy: 10,
      attributes: { batteryLevel: 50 + Math.floor(Math.random() * 50) },
    },
    device: { uniqueId: id, lastUpdate: now },
  });
  const res = http.post(`${API}/ingest/traccar/positions`, body, {
    headers: { 'Content-Type': 'application/json', 'X-Ingest-Secret': __ENV.SECRET },
  });
  check(res, { 'ingesta 200': (r) => r.status === 200 });
}

export function location() {
  const res = http.get(`${API}/v1/pets/${__ENV.PET}/location`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
  check(res, { 'ubicación 200': (r) => r.status === 200 });
}
