# Data Model: Rastreo y recuperación de mascotas (MVP)

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Convenciones: identificadores UUID; fechas en UTC (`timestamptz`), mostradas en la zona horaria
del dueño; coordenadas WGS84. Ningún modelo contiene la dirección del domicilio (FR-022).

## Modelo neutral de dispositivos (principio I)

Estas cuatro entidades son el contrato interno entre los adaptadores y el resto del sistema.
Solo los adaptadores conocen formatos de Traccar o de un fabricante.

### Device (Dispositivo)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| source | enum `traccar` | origen del adaptador; se amplía al agregar adaptadores |
| externalId | text | identificador del dispositivo en su origen (p. ej. IMEI); único por `source` |
| profile | text | perfil de marca/modelo usado por el adaptador (p. ej. `generic-gt06`) |
| petId | uuid, nulo | mascota vinculada; un dispositivo solo puede estar en una mascota |
| status | enum | `unlinked`, `linked`, `retired` |
| restIntervalS | integer | intervalo de reporte en reposo en segundos (60–86,400); lo fija el adaptador desde el perfil o desde lo que informa el rastreador; el dueño no lo edita |
| lastSeenAt | timestamptz, nulo | última actividad: posición o latido sin posición |
| activity | enum | `moving`, `resting`, `no_signal` (FR-009) |
| activitySince | timestamptz, nulo | inicio del estado de actividad actual |
| createdAt | timestamptz | |

**Transiciones**: `unlinked → linked` (el dueño lo vincula); `linked → unlinked` (lo
desvincula); cualquiera `→ retired`. Vincular un dispositivo `linked` a otra mascota se
rechaza (edge case de la spec).

**Umbral de señal (derivado)**: `restIntervalS + max(300, restIntervalS / 2)` segundos
(FR-009a). **Actividad**: `moving ⇄ resting` según desplazamiento y velocidad;
`moving|resting → no_signal` al superar el umbral sin actividad (genera `signal_lost` una vez);
`no_signal → moving|resting` con el siguiente reporte (research R8).

### Position (Posición)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | bigint | |
| deviceId | uuid | |
| recordedAt | timestamptz | hora del GPS según el dispositivo |
| receivedAt | timestamptz | hora de llegada al backend |
| lat, lng | double | rango válido; `(0,0)` se descarta |
| accuracyM | real, nulo | precisión estimada en metros |
| speedKmh | real, nulo | |
| valid | boolean | falso si el dispositivo marca posición sin fix GPS |

**Reglas**: única por `(deviceId, recordedAt)` (descarta duplicados). Tabla particionada por
día; las particiones con más de 7 días se eliminan (FR-011).

### DeviceEvent (Evento)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| petId | uuid | |
| deviceId | uuid, nulo | nulo para eventos de placa |
| type | enum | `zone_exit`, `zone_enter`, `battery_low`, `signal_lost`, `tag_viewed` |
| zoneId | uuid, nulo | solo en eventos de zona |
| occurredAt | timestamptz | |
| positionId | bigint, nulo | posición que disparó el evento |

**Reglas**: cada evento genera cero o más `Notification`. Los eventos de posición se borran con
su posición (7 días); `tag_viewed` a los 90 días.

### BatteryReading (Batería)

| Campo | Tipo | Reglas |
|-------|------|--------|
| deviceId | uuid | |
| recordedAt | timestamptz | |
| levelPct | smallint | 0–100; el adaptador convierte voltaje a porcentaje según el perfil |
| charging | boolean, nulo | |

**Estado derivado** en `Device`: `batteryAlertArmed` (boolean). Se desarma al enviar la alerta
de ≤ 20 % y se rearma al superar 25 % (FR-015). `signalAlertArmed` (boolean): se desarma al
emitir `signal_lost` y se rearma con el siguiente reporte (FR-016).

## Cuentas, mascotas y acceso

### Owner (Dueño / usuario)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| phoneE164 | text | único; verificado por código (FR-001) |
| displayName | text | 1–60 caracteres |
| whatsappAlertsEnabled | boolean | por defecto `false`; solo se activa con aceptación expresa (FR-013a) |
| whatsappOptInAt | timestamptz, nulo | fecha de la aceptación; se limpia al desactivarlas |
| whatsappConfirmed | boolean | `true` si el código de acceso llegó por WhatsApp o si el dueño confirma que su número tiene WhatsApp; requerido para activar una placa (FR-023) |
| locale | text | `es-MX` por defecto |
| deletedAt | timestamptz, nulo | al eliminar la cuenta se borran datos personales en ≤ 24 h |

Todo usuario es un `Owner`; ser dueño o familiar depende de `PetAccess`.

### PrivacyConsent (Consentimiento)

| Campo | Tipo | Reglas |
|-------|------|--------|
| ownerId | uuid | |
| noticeVersion | text | versión del aviso de privacidad aceptada |
| acceptedAt | timestamptz | |
| revokedAt | timestamptz, nulo | revocar implica eliminar la cuenta (FR-003) |

Sin consentimiento vigente no se crean mascotas ni se guardan datos (FR-002).

### Pet (Mascota)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| ownerId | uuid | dueño principal |
| name | text | 1–40 caracteres, obligatorio |
| species | enum | `dog`, `cat` |
| breed | text, nulo | ≤ 60 |
| size | enum, nulo | `small`, `medium`, `large` |
| photoKey | text, nulo | clave en almacenamiento de objetos; la imagen se guarda sin metadatos (EXIF/XMP/IPTC, incluida la ubicación GPS); se guarda una versión reducida para la página pública |
| conditions | text, nulo | enfermedades, ≤ 500 |
| medications | text, nulo | ≤ 500 |
| createdAt | timestamptz | |

### PetAccess (Acceso compartido)

| Campo | Tipo | Reglas |
|-------|------|--------|
| petId | uuid | |
| ownerId | uuid, nulo | nulo mientras la invitación no se acepta |
| invitedPhoneE164 | text | |
| role | enum | `owner`, `family` |
| status | enum | `invited`, `active`, `revoked` |
| createdAt, updatedAt | timestamptz | |

**Reglas**: exactamente un `owner` activo por mascota. `family` solo lee ubicación e historial
y recibe alertas; no edita mascota, zonas, página pública, placa ni accesos (FR-018).
**Transiciones**: `invited → active` (acepta), `invited|active → revoked` (el dueño revoca;
efecto inmediato). Las invitaciones `invited` con más de 30 días se eliminan, junto con el
número invitado.

### SafeZone (Zona segura)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| petId | uuid | |
| name | text | 1–40, p. ej. "Casa" |
| centerLat, centerLng | double | |
| radiusM | integer | 50–2,000 |
| active | boolean | |

**Estado por zona y dispositivo** (`ZoneState`): `inside`, `outside`, `unknown`, más el
contador de posiciones consecutivas que confirman el cambio (histéresis, research R8).
Nota: la zona "Casa" guarda un círculo, no una dirección; nunca se expone en la página pública.

### Tag (Placa NFC/QR)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| code | text | 10 caracteres base32, único, aleatorio (research R4) |
| petId | uuid, nulo | |
| status | enum | `inactive`, `active`, `disabled` |
| activatedAt | timestamptz, nulo | |

**Transiciones**: `inactive → active` (el dueño la vincula); `active → disabled` (la
desvincula o la reporta perdida); `disabled → active` (la vuelve a vincular). Una placa que no
está `active` muestra "placa no activa" (FR-026).

### PublicProfileSettings (Configuración de página pública)

| Campo | Tipo | Por defecto |
|-------|------|-------------|
| petId | uuid | |
| showOwnerName | boolean | `true` |
| showConditions | boolean | `false` |
| showMedications | boolean | `false` |

**Regla**: foto y nombre de la mascota y el botón de WhatsApp del dueño siempre se muestran
(FR-021, FR-023); el número no se muestra como texto y no hay opción de llamada.

### TagView (Consulta de placa)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| tagId | uuid | |
| viewedAt | timestamptz | |

Sin IP, agente de usuario ni ubicación (FR-024a). Genera un `DeviceEvent` `tag_viewed`.
Notificaciones agrupadas: como máximo una cada 5 minutos por placa, con el conteo de consultas.

## Notificaciones

### PushToken

| Campo | Tipo | Reglas |
|-------|------|--------|
| ownerId | uuid | |
| token | text | token de Expo; único |
| platform | enum | `ios`, `android` |
| lastUsedAt | timestamptz | se elimina si Expo lo reporta inválido |

### Notification

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| eventId | uuid | |
| recipientId | uuid | dueño o familiar con acceso activo |
| channel | enum | `push`, `whatsapp` |
| status | enum | `pending`, `sent`, `failed` |
| sentAt | timestamptz, nulo | |

**Reglas**: todo evento notifica por `push` al dueño y a los familiares con acceso activo, salvo
`tag_viewed`, que solo se notifica al dueño (FR-024); `zone_exit` además por `whatsapp` a
quienes lo tengan activado. Una falla de WhatsApp no afecta al envío push
(FR-013a).

## Autenticación

### OtpChallenge

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| phoneE164 | text | |
| codeHash | text | nunca se guarda el código en claro |
| channel | enum | `whatsapp`, `sms` |
| expiresAt | timestamptz | 10 minutos |
| attempts | smallint | máximo 5 |

### Session

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | |
| ownerId | uuid | |
| refreshTokenHash | text | |
| expiresAt | timestamptz | 90 días |
| revokedAt | timestamptz, nulo | |

## Relaciones

```text
Owner 1─* PetAccess *─1 Pet
Pet 1─0..1 Device (activo)      Device 1─* Position, BatteryReading
Pet 1─* SafeZone                Pet 1─* Tag
Pet 1─1 PublicProfileSettings   Tag 1─* TagView
Pet 1─* DeviceEvent 1─* Notification *─1 Owner
Owner 1─* PushToken, Session, PrivacyConsent
```
