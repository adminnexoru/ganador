# Contrato: ingesta de dispositivos (adaptadores → modelo neutral)

Principio I: solo la capa `adapters/` conoce formatos externos. Todo lo demás recibe los tipos
neutrales definidos en `packages/domain`.

## Interfaz del adaptador (neutral)

```ts
// packages/domain/src/device/model.ts (forma, no implementación)
type DeviceRef = { source: 'traccar'; externalId: string };

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
  | { kind: 'online' | 'offline'; device: DeviceRef; at: Date };

interface DeviceAdapter<Raw> {
  source: DeviceRef['source'];
  parse(raw: Raw): NeutralDeviceEvent[];   // puro, sin E/S; lanza error tipado si el dato es inválido
}
```

Cada perfil de marca/modelo (p. ej. `generic-gt06`) define cómo obtener batería y precisión
de los atributos del protocolo. Agregar un modelo = agregar un perfil y sus pruebas.

## Traccar → backend

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
señal la calcula el backend por tiempo sin reportes (research R8). Los demás eventos de Traccar
(geocercas, alarmas) se ignoran.

## Pipeline tras el adaptador

1. Resolver `DeviceRef` → `Device` vinculado; si no existe o no está vinculado, descartar.
2. Guardar `Position` y `BatteryReading` (descarta duplicados por `(deviceId, recordedAt)`).
3. Evaluar reglas puras de `packages/domain` (zonas, batería) → `DeviceEvent[]`.
4. Encolar notificaciones (pg-boss) → push y, para `zone_exit`, WhatsApp.

Objetivo: pasos 1–4 en < 5 s por posición (p95), dejando margen para SC-002.
