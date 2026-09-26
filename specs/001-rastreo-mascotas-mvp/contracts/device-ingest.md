# Contrato: ingesta de dispositivos (adaptadores → modelo neutral)

Principio I: solo la capa `adapters/` conoce formatos externos. Todo lo demás recibe los tipos
neutrales definidos en `packages/domain`.

## Interfaz del adaptador (neutral)

```ts
// packages/domain/src/device/model.ts (forma, no implementación)
type DeviceRef = { source: 'traccar'; externalId: string };

type NeutralDevice = {
  device: DeviceRef;
  profile: string;           // perfil de marca/modelo, p. ej. 'generic-gt06', 'traccar-client'
  restIntervalS: number;     // intervalo de reporte en reposo; base del umbral de señal
  lastSeenAt: Date | null;   // última actividad, con o sin posición
};

type NeutralPosition = {
  device: DeviceRef;
  recordedAt: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedKmh: number | null;
  valid: boolean;
};

type NeutralBattery = {
  device: DeviceRef;
  recordedAt: Date;
  levelPct: number;          // 0–100, ya convertido según el perfil de marca
  charging: boolean | null;
};

type NeutralDeviceEvent =
  | { kind: 'position'; position: NeutralPosition; battery: NeutralBattery | null }
  | { kind: 'online' | 'offline'; device: DeviceRef; at: Date }
  | { kind: 'heartbeat'; device: DeviceRef; at: Date };   // actividad sin posición

interface DeviceAdapter<Raw> {
  source: DeviceRef['source'];
  parse(raw: Raw): NeutralDeviceEvent[];   // puro, sin E/S; lanza error tipado si el dato es inválido
  describe(raw: Raw): NeutralDevice;       // perfil e intervalo en reposo del dispositivo
}
```

Cada perfil de marca/modelo (p. ej. `generic-gt06`, `traccar-client`) define cómo obtener
batería y precisión de los atributos del protocolo y su `restIntervalS` por defecto; si el
rastreador informa su intervalo real, el adaptador usa ese valor. Agregar un modelo = agregar
un perfil y sus pruebas.

## Traccar → backend

Puertos de entrada: OsmAnd solo por HTTPS en `https://track.ganador.nexoru.ai` (Caddy → `traccar:5055`);
GT06 en el puerto 5023 sin cifrado, aceptado bajo la regla "Transporte desde el hardware" de la
constitución v1.1.0.

Traccar se configura para reenviar posiciones y eventos por HTTP al backend (red interna de
Docker, no expuesta a internet):

- `forward.enable=true`, `forward.json=true`, `forward.url=http://api:3000/ingest/traccar/positions`
- `event.forward.enable=true`, `event.forward.url=http://api:3000/ingest/traccar/events`

### POST /ingest/traccar/positions

Cuerpo JSON de Traccar con `device` (incluye `uniqueId` = IMEI) y `position` (incluye
`fixTime`, `latitude`, `longitude`, `accuracy`, `speed` en nudos, `valid`, `attributes` con
`batteryLevel` o `battery`/`power` según el protocolo).

Mapeo al modelo neutral:

| Traccar | Neutral |
|---------|---------|
| `device.uniqueId` | `device.externalId` |
| `position.fixTime` | `recordedAt` |
| `position.latitude/longitude` | `lat/lng` |
| `position.accuracy` (0 = desconocida) | `accuracyM` (`null` si 0) |
| `position.speed` (nudos) | `speedKmh` = nudos × 1.852 |
| `position.valid` | `valid` |
| `attributes.batteryLevel` o voltaje según perfil | `levelPct` |
| `attributes.charge` | `charging` |

Respuestas: `200` procesado (también para duplicados y dispositivos desconocidos, para que
Traccar no reintente); `400` si el cuerpo no es JSON válido. Autenticación con un secreto
compartido en el encabezado `X-Ingest-Secret`.

### POST /ingest/traccar/events

Solo se usan `deviceOnline` y `deviceOffline` como señal auxiliar; la alerta de pérdida de
señal la calcula el backend con el umbral por dispositivo (research R8). Los demás eventos de
Traccar (geocercas, alarmas) se ignoran.

### Sondeo de actividad: GET /api/devices (Traccar)

Traccar no reenvía los latidos sin posición. Cada minuto el adaptador consulta la API REST de
Traccar (usuario de servicio de solo lectura) y convierte cada `lastUpdate` más reciente que
`lastSeenAt` en un evento neutral `heartbeat`. Así un rastreador quieto que sigue latiendo
queda `resting` y no `no_signal`.

### Alta en Traccar al vincular

En producción Traccar no acepta dispositivos desconocidos. Cuando el dueño vincula un
dispositivo (`POST /pets/{id}/device`), el adaptador lo registra en Traccar con
`POST /api/devices` usando `externalId` como `uniqueId`. En desarrollo se permite
`database.registerUnknown=true` (quickstart, Traccar Client).

## Pipeline tras el adaptador

1. Resolver `DeviceRef` → `Device` vinculado; si no existe o no está vinculado, descartar.
2. Filtro de plausibilidad: descartar la posición si la velocidad implícita desde la última
   posición válida supera 250 km/h o si `recordedAt` está más de 5 minutos en el futuro
   (constitución v1.1.0, "Transporte desde el hardware"); registrar el descarte.
3. Guardar `Position` y `BatteryReading` (descarta duplicados por `(deviceId, recordedAt)`).
4. Actualizar `lastSeenAt` y `activity`; evaluar reglas puras de `packages/domain` (zonas,
   batería, actividad) → `DeviceEvent[]`.
5. Encolar notificaciones (pg-boss) → push y, para `zone_exit`, WhatsApp.

Objetivo: pasos 1–5 en < 5 s por posición (p95), dejando margen para SC-002.
