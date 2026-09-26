---

description: "Lista de tareas para el MVP de rastreo y recuperación de mascotas"
---

# Tasks: Rastreo y recuperación de mascotas (MVP)

**Input**: Design documents from `/specs/001-rastreo-mascotas-mvp/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Incluidas. El principio VII de la constitución (NO NEGOCIABLE) exige pruebas antes
de código en la lógica de alertas, geocercas y actividad; también se incluyen pruebas de
contrato en los puntos donde la spec impone reglas de privacidad o permisos. Toda tarea de
prueba DEBE escribirse y fallar antes de su tarea de implementación.

**Organization**: tareas agrupadas por historia de usuario para implementar y probar cada una
por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1–US5, ver [spec.md](spec.md))
- Rutas relativas a la raíz del repositorio, según la estructura de [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: monorepo, herramientas e infraestructura local

- [X] T001 Crear el monorepo pnpm: `package.json` raíz con scripts `lint`, `typecheck`, `test`; `pnpm-workspace.yaml` con `apps/*`, `packages/*`, `tools/*`; `tsconfig.base.json` con `strict: true`; `.gitignore` (node_modules, .env, .expo, dist)
- [X] T002 [P] Configurar ESLint (flat config) y Prettier en `eslint.config.mjs` y `.prettierrc`, incluyendo la regla `i18next/no-literal-string` activa para `apps/mobile/src/app/**` y `apps/mobile/src/components/**` (principio IV)
- [X] T003 [P] Inicializar `packages/domain` como paquete TypeScript puro sin dependencias de E/S, con Vitest: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts`, `packages/domain/src/index.ts`
- [X] T004 [P] Inicializar `apps/api` con Node.js 24, Fastify, Zod, Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `postgres`), pg-boss, pino y Vitest: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/server.ts` (arranque mínimo en el puerto 3000)
- [X] T005 [P] Crear la app Expo con Expo Router y TypeScript en `apps/mobile` (plantilla `tabs` limpia); en `apps/mobile/app.json` configurar `scheme: "ganador"`, `web.bundler: "metro"`, `web.output: "static"`, y los plugins `expo-router`, `expo-notifications`, `expo-camera`, `expo-secure-store`, `expo-localization`; instalar `react-native-maps`
- [X] T006 [P] Configurar Jest con `jest-expo` y React Native Testing Library en `apps/mobile/jest.config.js` y `apps/mobile/package.json`
- [X] T007 [P] Crear `infra/docker-compose.yml` con servicios `db` (imagen `postgis/postgis:17`, bases `ganador` y `traccar`, volumen persistente), `traccar` (imagen oficial `traccar/traccar`, puerto 5023 (GT06) publicado; puerto 5055 (OsmAnd) solo en red interna, expuesto por Caddy en `https://track.ganador.nexoru.ai`; en desarrollo, 5055 publicado solo en la LAN, puerto web 8082 solo en red interna), `api` y `caddy`; script `infra/db/init.sql` que crea ambas bases y la extensión `postgis` en `ganador`
- [X] T008 [P] Crear `infra/traccar/traccar.xml`: base de datos PostgreSQL `traccar`; `forward.enable=true`, `forward.json=true`, `forward.url=http://api:3000/ingest/traccar/positions`; `event.forward.enable=true`, `event.forward.url=http://api:3000/ingest/traccar/events`; encabezado `X-Ingest-Secret` en ambos reenvíos; `database.registerUnknown` controlado por variable de entorno (true solo en desarrollo; false en producción, requisito de la constitución v1.1.0)
- [X] T009 [P] Crear `.env.example` en la raíz con todas las variables: `DATABASE_URL`, `INGEST_SECRET`, `JWT_SECRET`, `TRACCAR_URL`, `TRACCAR_USER`, `TRACCAR_PASSWORD`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE_OTP`, `WHATSAPP_TEMPLATE_ZONE_EXIT`, `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `PUBLIC_WEB_URL` (`https://ganador.nexoru.ai`), `MESSAGING_PROVIDER` (`fake` por defecto), `EXPO_PUBLIC_API_URL` (`https://api.ganador.nexoru.ai` en producción), `GOOGLE_MAPS_ANDROID_KEY`
- [X] T010 [P] Configurar la internacionalización en `apps/mobile/src/i18n/index.ts` con i18next, react-i18next y expo-localization; `es-MX` como idioma base y de respaldo; archivos `apps/mobile/src/i18n/locales/es-MX.json` y `apps/mobile/src/i18n/locales/en.json` (en vacío, preparado); helpers de fecha, hora y número con `Intl` en `apps/mobile/src/i18n/format.ts`
- [X] T011 [P] Crear el flujo de CI en `.github/workflows/ci.yml`: instalar con pnpm, `lint`, `typecheck` y `test` de los tres paquetes, con un servicio PostgreSQL/PostGIS para las pruebas de integración de la API
- [X] T012 [P] Configurar EAS con perfiles `development` (development build para push en Android, research R10), `preview` y `production` en `apps/mobile/eas.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base de datos, modelo neutral, autenticación, consentimiento, permisos y notificaciones que usan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta terminar esta fase

### Datos y modelo neutral

- [X] T013 Configurar la conexión y Drizzle en `apps/api/src/db/client.ts` y `apps/api/drizzle.config.ts`; cargador de configuración validado con Zod en `apps/api/src/config.ts` (falla al arrancar si falta una variable requerida)
- [X] T014 [P] Definir el esquema de cuentas en `apps/api/src/db/schema/accounts.ts`: `owners` (`phoneE164` único; `displayName` "1–60 caracteres"; `whatsappAlertsEnabled` "por defecto `false`; solo se activa con aceptación expresa"; `whatsappOptInAt` timestamptz nulo; `whatsappConfirmed` boolean, `true` al verificar por WhatsApp; `locale` "`es-MX` por defecto"; `deletedAt` nulo), `privacy_consents` (`noticeVersion`, `acceptedAt`, `revokedAt` nulo), `otp_challenges` (`codeHash`, `channel` enum `whatsapp|sms`, `expiresAt` "10 minutos", `attempts` "máximo 5"), `sessions` (`refreshTokenHash`, `expiresAt` "90 días", `revokedAt`), `push_tokens` (`token` único, `platform` enum `ios|android`, `lastUsedAt`)
- [X] T015 [P] Definir el esquema de mascotas en `apps/api/src/db/schema/pets.ts`: `pets` (`name` "1–40 caracteres, obligatorio"; `species` enum `dog|cat`; `breed` "≤ 60", nulo; `size` enum `small|medium|large`, nulo; `photoKey` nulo; `conditions` "≤ 500"; `medications` "≤ 500") y `pet_access` (`ownerId` nulo mientras no se acepta; `invitedPhoneE164`; `role` enum `owner|family`; `status` enum `invited|active|revoked`; índice único parcial que garantiza "exactamente un `owner` activo por mascota")
- [X] T016 [P] Definir el esquema de dispositivos en `apps/api/src/db/schema/devices.ts`: `devices` (`source` enum `traccar`; `externalId` "único por `source`"; `profile`; `petId` nulo, único cuando no es nulo; `status` enum `unlinked|linked|retired`; `restIntervalS` "60–86,400"; `lastSeenAt`; `activity` enum `moving|resting|no_signal`; `activitySince`; `batteryAlertArmed` boolean por defecto `true`; `signalAlertArmed` boolean por defecto `true`), `positions` (`recordedAt`, `receivedAt`, `lat`, `lng`, `accuracyM` nulo, `speedKmh` nulo, `valid`; único por `(deviceId, recordedAt)`), `battery_readings` (`levelPct` "0–100", `charging` nulo) y `device_events` (`type` enum `zone_exit|zone_enter|battery_low|signal_lost|tag_viewed`, `zoneId` nulo, `positionId` nulo)
- [X] T017 [P] Definir el esquema de zonas en `apps/api/src/db/schema/zones.ts`: `safe_zones` (`name` "1–40"; `centerLat`, `centerLng`; `radiusM` "50–2,000" con CHECK; `active`) y `zone_states` (`zoneId`, `deviceId`, `state` enum `inside|outside|unknown`, `pendingState`, `pendingCount`)
- [X] T018 [P] Definir el esquema de placas en `apps/api/src/db/schema/tags.ts`: `tags` (`code` "10 caracteres base32, único, aleatorio"; `petId` nulo; `status` enum `inactive|active|disabled`; `activatedAt`), `public_profile_settings` (`showOwnerName` por defecto `true`, `showConditions` `false`, `showMedications` `false`; sin campos de teléfono ni WhatsApp, porque el botón de WhatsApp siempre se muestra) y `tag_views` (`tagId`, `viewedAt`; **sin** columnas de IP, agente de usuario ni ubicación)
- [X] T019 [P] Definir el esquema de notificaciones en `apps/api/src/db/schema/notifications.ts`: `notifications` (`eventId`, `recipientId`, `channel` enum `push|whatsapp`, `status` enum `pending|sent|failed`, `sentAt`)
- [X] T020 Generar la migración inicial en `apps/api/drizzle/0000_init.sql` y agregar a mano la creación de `positions` como tabla particionada por día (`PARTITION BY RANGE (recorded_at)`) con una función `ensure_position_partitions(days_ahead int)`; script `pnpm --filter api db:migrate`
- [X] T021 Implementar los tipos del modelo neutral en `packages/domain/src/device/model.ts` exactamente como en [contracts/device-ingest.md](contracts/device-ingest.md): `DeviceRef`, `NeutralDevice` (con `restIntervalS`), `NeutralPosition`, `NeutralBattery`, `NeutralDeviceEvent` (`position`, `online`, `offline`, `heartbeat`) e interfaz `DeviceAdapter` con `parse()` y `describe()`; exportarlos desde `packages/domain/src/index.ts`

### Servidor base

- [X] T022 Crear la app Fastify en `apps/api/src/app.ts` con: manejador de errores que responde `{ "error": { "code", "message" } }` con `message` en el idioma del usuario (`apps/api/src/plugins/errors.ts`, mensajes en `apps/api/src/i18n/es-MX.json`); logger pino en JSON (`apps/api/src/plugins/logging.ts`) que **no** registra IP ni agente de usuario en rutas `/public/*` ni `/ingest/*`
- [X] T023 [P] Definir el puerto `MessagingProvider` (`sendOtp(phone, code)`, `sendZoneExitAlert(phone, params)`) y un proveedor falso que escribe los mensajes en el registro, en `apps/api/src/messaging/provider.ts` y `apps/api/src/messaging/fake.ts`
- [X] T024 [P] Implementar el proveedor de WhatsApp Cloud API con las plantillas `WHATSAPP_TEMPLATE_OTP` (autenticación) y `WHATSAPP_TEMPLATE_ZONE_EXIT` (utilidad) en `apps/api/src/messaging/whatsapp.ts`
- [X] T025 [P] Implementar el proveedor de SMS de respaldo para códigos en `apps/api/src/messaging/sms.ts`
- [X] T026 Configurar pg-boss (arranque, registro de trabajos, trabajos programados) en `apps/api/src/jobs/queue.ts`

### Autenticación, consentimiento y permisos (FR-001 a FR-004)

- [X] T027 [P] Escribir pruebas de contrato de autenticación en `apps/api/tests/contract/auth.test.ts`: `POST /auth/otp` → `202`; `429` al pedir un sexto código en una hora; `POST /auth/verify` con código correcto → tokens y `needsConsent: true` para usuario nuevo; sexto intento fallido → código invalidado; `POST /auth/refresh` rota el token; `POST /auth/logout` → `204`
- [X] T028 [P] Escribir pruebas de contrato de consentimiento y cuenta en `apps/api/tests/contract/me.test.ts`: sin consentimiento todo endpoint fuera de `/auth/*`, `/privacy-notice` y `/me/consent` → `403 consent_required`; `POST /me/consent` guarda versión y fecha; `DELETE /me` → `202` y programa el borrado; `GET /me/export` devuelve solo datos del usuario y de sus mascotas (un familiar no recibe datos del dueño); `PATCH /me` con `whatsappAlertsEnabled: true` registra `whatsappOptInAt` y con `false` lo limpia
- [X] T029 Implementar el servicio OTP en `apps/api/src/services/auth.ts`: código de 6 dígitos guardado solo como hash, vence en 10 minutos, máximo 5 intentos, máximo 5 códigos por número por hora; envío por WhatsApp y, si falla, por SMS; crea el `owner` al verificar un número nuevo; si el código se entrega por WhatsApp, marca `whatsappConfirmed = true`
- [X] T030 Implementar sesiones en `apps/api/src/services/sessions.ts`: token de acceso JWT de 15 minutos y token de renovación de 90 días guardado como hash, con rotación en cada renovación
- [X] T031 Implementar las rutas `/auth/otp`, `/auth/verify`, `/auth/refresh`, `/auth/logout` en `apps/api/src/routes/auth.ts`
- [X] T032 Implementar el plugin de autenticación y la guarda de consentimiento (`403 consent_required`) en `apps/api/src/plugins/auth.ts`
- [X] T033 Implementar el helper de permisos por mascota en `apps/api/src/plugins/pet-access.ts`: `requirePetRole(petId, 'owner' | 'any')`; los endpoints marcados **O** en [contracts/app-api.md](contracts/app-api.md) responden `403 forbidden` a un familiar (FR-018)
- [X] T034 Redactar el aviso de privacidad integral v1 en `apps/api/src/privacy/notices/es-MX/v1.md`: responsable y domicilio para notificaciones; datos y finalidades según la tabla "Clasificación y datos personales" de la spec (sin finalidades secundarias en el MVP); consentimiento de WhatsApp por separado; encargados y transferencias (Meta/WhatsApp, proveedor de SMS, Expo, Google y Apple para notificaciones, hosting y almacenamiento); plazos de conservación; medios para ejercer derechos ARCO y revocar el consentimiento (FR-003a); aviso de que la página pública no recopila datos de quien la consulta; procedimiento para comunicar cambios. **Revisión por un asesor legal antes de producción**
- [X] T035 Implementar `GET /privacy-notice`, `POST /me/consent`, `GET /me`, `PATCH /me` (`displayName`, `whatsappAlertsEnabled`, `whatsappConfirmed`), `DELETE /me`, `GET /me/export` (derecho de acceso, FR-003a) y `POST /me/push-tokens` en `apps/api/src/routes/me.ts`; `GET /privacy-notice` sirve la versión vigente desde `apps/api/src/privacy/notices/`; `PATCH /me` con `whatsappAlertsEnabled: true` registra `whatsappOptInAt` y con `false` lo limpia
- [X] T036 Implementar el trabajo de borrado de cuenta en `apps/api/src/jobs/delete-account.ts`: en ≤ 24 h borra datos personales, fotos, sesiones y tokens; revoca accesos; pasa las placas de sus mascotas a `disabled`; registra la revocación del consentimiento (FR-003)

### Notificaciones

- [X] T037 Implementar el envío push con el servicio de Expo en `apps/api/src/services/push.ts`, eliminando tokens que Expo reporte inválidos; textos en el idioma del destinatario con `data: { type, petId, eventId }`
- [X] T038 Escribir pruebas unitarias del despachador en `apps/api/tests/unit/notifications.test.ts`: cada evento notifica por push al dueño y a familiares `active`; solo `zone_exit` además por WhatsApp a quienes tengan `whatsappAlertsEnabled`; una falla de WhatsApp no impide el push (FR-013a); sin `whatsappOptInAt` no se envía WhatsApp; `tag_viewed` se notifica solo al dueño, nunca a familiares (FR-024)
- [X] T039 Implementar el despachador en `apps/api/src/services/notifications.ts`: recibe un `DeviceEvent`, resuelve destinatarios, crea filas en `notifications` y encola los envíos en pg-boss por canal, de forma independiente

### App móvil base

- [X] T040 [P] Implementar el cliente de API tipado en `apps/mobile/src/api/client.ts` con tokens en `expo-secure-store`, renovación automática ante `401` y encabezado `Accept-Language`
- [X] T041 Implementar las pantallas de acceso en `apps/mobile/src/app/(auth)/phone.tsx` (número con lada +52), `apps/mobile/src/app/(auth)/code.tsx` (6 dígitos, reenvío) y `apps/mobile/src/app/(auth)/privacy.tsx` (muestra el aviso y registra el consentimiento); todos los textos desde `es-MX.json`; después del aviso, pantalla opcional `apps/mobile/src/app/(auth)/whatsapp.tsx` que explica las alertas por WhatsApp y pide aceptación expresa (se puede omitir)
- [X] T042 Implementar el layout raíz y la guarda de sesión en `apps/mobile/src/app/_layout.tsx` y `apps/mobile/src/app/(owner)/_layout.tsx`; en web, las rutas `(owner)` muestran un mensaje para descargar la app (research R2)
- [X] T043 [P] Implementar el registro de push en `apps/mobile/src/notifications/register.ts` (permiso, token de Expo, `POST /me/push-tokens`)
- [X] T044 [P] Crear la página web del aviso de privacidad en `apps/mobile/src/app/aviso-de-privacidad.tsx`; muestra el texto de la versión vigente

**Checkpoint**: base lista; las historias pueden empezar

---

## Phase 3: User Story 1 - Ver dónde está mi mascota (Priority: P1) 🎯 MVP

**Goal**: el dueño da de alta una mascota, vincula un rastreador y ve en el mapa la última ubicación, la hora, la batería y el estado (en movimiento, en reposo o sin señal).

**Independent Test**: escenarios 1, 2, 3 y 15 (pasos a, e, f) de [quickstart.md](quickstart.md).

### Tests for User Story 1 ⚠️ (escribir primero y confirmar que fallan)

- [X] T045 [P] [US1] Escribir pruebas del umbral y del estado de actividad en `packages/domain/tests/activity.test.ts`: umbral = `restIntervalS + max(300, restIntervalS / 2)` (60 s → 360 s, 600 s → 900 s, 1,800 s → 2,700 s); `moving` si velocidad > 1 km/h o desplazamiento > `max(30 m, precisión)`; `resting` si reporta dentro del umbral sin desplazarse; `no_signal` al superar el umbral; `since` = primer reporte en el estado actual; posiciones duplicadas o más antiguas que la última no cambian el estado; un `heartbeat` mantiene `resting`
- [X] T046 [P] [US1] Escribir pruebas del adaptador de Traccar en `apps/api/tests/unit/traccar-adapter.test.ts` con JSON reales de ejemplo en `apps/api/tests/fixtures/traccar/`: mapeo de la tabla de [contracts/device-ingest.md](contracts/device-ingest.md) (`uniqueId` → `externalId`, `fixTime` → `recordedAt`, `accuracy` 0 → `null`, nudos × 1.852 → km/h, `valid`), posición `(0,0)` descartada, batería por porcentaje (`batteryLevel`) y por voltaje según perfil, `describe()` devuelve `restIntervalS` del perfil
- [X] T047 [P] [US1] Escribir pruebas de contrato en `apps/api/tests/contract/pets-location.test.ts`: CRUD de mascotas con validaciones ("1–40 caracteres", enum de especie); `POST /pets/{id}/device` → `409` si el dispositivo está vinculado a otra mascota; `GET /pets/{id}/location` devuelve `activity`, `activitySince` y `stale` (verdadero solo en `no_signal`); familiar → `403` en `PATCH /pets/{id}`; subir una foto con coordenadas GPS en EXIF y comprobar que ni la versión guardada ni la pública contienen metadatos
- [X] T048 [P] [US1] Escribir la prueba de integración de ingesta en `apps/api/tests/integration/ingest.test.ts`: `POST /ingest/traccar/positions` sin `X-Ingest-Secret` → `401`; con secreto guarda posición y batería, descarta duplicados con `200`, ignora dispositivos desconocidos con `200`, actualiza `lastSeenAt` y `activity`; procesamiento < 5 s; una posición con velocidad implícita > 250 km/h desde la anterior o con hora > 5 min en el futuro se descarta y queda registrada

### Implementation for User Story 1

- [X] T049 [US1] Implementar `computeSignalThreshold()` y `nextActivity()` en `packages/domain/src/alerts/activity.ts` hasta pasar `packages/domain/tests/activity.test.ts`
- [X] T050 [P] [US1] Implementar los perfiles de marca en `apps/api/src/adapters/traccar/profiles.ts`: `generic-gt06` (`restIntervalS` 600, batería por `batteryLevel` o conversión de voltaje), `traccar-client` (`restIntervalS` 60, batería por `batteryLevel`); selección de perfil por protocolo de Traccar y posibilidad de usar el intervalo real si el rastreador lo informa
- [X] T051 [US1] Implementar `TraccarAdapter` (`parse()` y `describe()`) en `apps/api/src/adapters/traccar/adapter.ts` hasta pasar `apps/api/tests/unit/traccar-adapter.test.ts`; ningún tipo de Traccar sale de `apps/api/src/adapters/` (principio I)
- [X] T052 [P] [US1] Implementar el cliente REST de Traccar en `apps/api/src/adapters/traccar/api-client.ts`: `createDevice(uniqueId, name)` (`POST /api/devices`) y `listDevices()` (`GET /api/devices`) con el usuario de servicio
- [X] T053 [US1] Implementar el servicio de ingesta en `apps/api/src/services/ingest.ts` según el pipeline de [contracts/device-ingest.md](contracts/device-ingest.md): resolver `Device` vinculado, aplicar el filtro de plausibilidad (descarta velocidad implícita > 250 km/h o hora > 5 min en el futuro, y registra el descarte), guardar `Position` y `BatteryReading` (sin duplicados), actualizar `lastSeenAt` y `activity`, y exponer un punto de extensión `evaluateRules(device, position, battery)` que en esta fase devuelve `[]`
- [X] T054 [US1] Implementar `POST /ingest/traccar/positions` y `POST /ingest/traccar/events` (solo `deviceOnline`/`deviceOffline`; el resto se ignora) con validación de `X-Ingest-Secret` en `apps/api/src/routes/ingest.ts`
- [X] T055 [US1] Implementar el sondeo de actividad cada minuto en `apps/api/src/jobs/traccar-poll.ts`: `listDevices()` y cada `lastUpdate` más reciente que `lastSeenAt` → evento neutral `heartbeat` al servicio de ingesta
- [X] T056 [US1] Implementar el barrido de actividad cada minuto en `apps/api/src/jobs/activity-sweep.ts`: marca `no_signal` a los dispositivos que superan su umbral (sin emitir alertas todavía; la alerta llega en US3)
- [X] T057 [US1] Implementar el trabajo de retención diario en `apps/api/src/jobs/retention.ts`: crea particiones futuras de `positions`, elimina particiones con más de 7 días, borra `battery_readings` y `device_events` de posición con más de 7 días, `tag_views` y eventos `tag_viewed` con más de 90 días, invitaciones `invited` con más de 30 días, y posiciones de más de 7 días en la base `traccar` (FR-011, research R16)
- [X] T058 [P] [US1] Implementar el servicio de fotos en `apps/api/src/services/photos.ts`: acepta JPEG/PNG/HEIC ≤ 10 MB; **elimina todos los metadatos (EXIF, XMP, IPTC, incluida la ubicación GPS) antes de guardar**; guarda el original reducido y una versión pública WebP ≤ 60 KB en almacenamiento S3
- [X] T059 [US1] Implementar las rutas de mascotas en `apps/api/src/routes/pets.ts`: `GET /pets` (con `role` y resumen de ubicación), `POST /pets` (crea `pet_access` con `role=owner` y `public_profile_settings` por defecto), `GET/PATCH/DELETE /pets/{id}`, `PUT /pets/{id}/photo`; permisos según [contracts/app-api.md](contracts/app-api.md)
- [X] T060 [US1] Implementar `POST /pets/{id}/device` y `DELETE /pets/{id}/device` en `apps/api/src/routes/devices.ts`: `409` si el dispositivo ya está `linked` a otra mascota; al vincular, registra el dispositivo en Traccar con `createDevice()` y fija `profile` y `restIntervalS`
- [X] T061 [US1] Implementar `GET /pets/{id}/location` en `apps/api/src/routes/location.ts` con `position`, `battery`, `activity`, `activitySince` y `stale` (verdadero solo si `activity = no_signal`)
- [X] T062 [P] [US1] Implementar la lista de mascotas y el formulario de alta/edición en `apps/mobile/src/app/(owner)/index.tsx`, `apps/mobile/src/app/(owner)/pets/new.tsx` y `apps/mobile/src/app/(owner)/pets/[id]/edit.tsx` (foto con `expo-image-picker`, especie perro/gato, tamaño, enfermedades, medicamentos)
- [X] T063 [P] [US1] Implementar la pantalla para vincular el rastreador en `apps/mobile/src/app/(owner)/pets/[id]/device.tsx` (captura del IMEI o identificador de Traccar Client)
- [X] T064 [US1] Implementar la pantalla del mapa en `apps/mobile/src/app/(owner)/pets/[id]/index.tsx` con `react-native-maps`: marcador en la última ubicación, hora, batería y un indicador de estado ("En movimiento", "En reposo desde HH:MM", "Sin señal desde HH:MM" con aviso de ubicación no actualizada); actualización cada 30 s mientras la pantalla está abierta; guarda en el celular la última respuesta (AsyncStorage) y, sin conexión, la muestra con la marca "Sin conexión, datos de HH:MM"; la pantalla inicial abre directo al mapa si hay una sola mascota (SC-001)
- [X] T065 [P] [US1] Implementar el simulador de posiciones en `tools/simulator/src/index.ts` (comando `pnpm sim --imei <id> --route <nombre> [--battery 25,19,18] [--interval 60]`) que envía posiciones por el protocolo OsmAnd al puerto 5055, con rutas de ejemplo en `tools/simulator/routes/`

**Checkpoint**: US1 funciona sola (escenarios 1–3 del quickstart y Traccar Client pasos a, e, f)

---

## Phase 4: User Story 2 - Recuperación con la placa NFC/QR (Priority: P1)

**Goal**: quien encuentra a la mascota abre la página pública sin sesión, ve los datos autorizados y contacta al dueño con un toque; el dueño recibe aviso de cada consulta.

**Independent Test**: escenarios 7, 8, 9 y 10 de [quickstart.md](quickstart.md).

### Tests for User Story 2 ⚠️

- [ ] T066 [P] [US2] Escribir pruebas de contrato de la página pública en `apps/api/tests/contract/public-tags.test.ts`: placa activa devuelve foto, nombre y `owner.whatsappUrl` siempre (sin número como campo aparte ni opción de llamada), y solo los campos autorizados (los no autorizados se omiten, no van como `null`); nunca dirección, zonas, ubicación del rastreador ni IDs internos; placa `inactive`/`disabled` → `{ "status": "inactive" }` sin `TagView`; código inexistente → `404`; 31 peticiones al mismo código en un minuto → `429`; 61 peticiones del mismo origen a códigos distintos → `429` con `Retry-After`; después de las peticiones, ni la IP ni su HMAC aparecen en la base de datos ni en los registros capturados
- [ ] T067 [P] [US2] Escribir pruebas unitarias del limitador por origen en `apps/api/tests/unit/origin-limiter.test.ts`: la clave es HMAC de la IP con secreto en memoria; el secreto rota cada 24 h; los contadores expiran al minuto; la estructura no expone la IP
- [ ] T068 [P] [US2] Escribir pruebas de contrato de placas y configuración pública en `apps/api/tests/contract/tags.test.ts`: `POST /pets/{id}/tags` → `404` código inexistente, `409` activa en otra mascota; `POST /pets/{id}/tags` → `409 whatsapp_not_confirmed` si el dueño no tiene `whatsappConfirmed`; `PUT /pets/{id}/public-profile` solo acepta `showOwnerName`, `showConditions` y `showMedications`; familiar → `403`

### Implementation for User Story 2

- [ ] T069 [P] [US2] Implementar el generador de códigos en `apps/api/src/services/tag-codes.ts` (10 caracteres base32 sin caracteres ambiguos, aleatorio criptográfico) y el script de lotes `tools/tags/generate.ts` que crea placas `inactive` y exporta un CSV con código y URL `https://ganador.nexoru.ai/p/<codigo>` para grabar NFC e imprimir QR; **prerrequisito**: el dominio de las placas es `ganador.nexoru.ai` (temporal; ver research R4 antes de producir lotes grandes)
- [ ] T070 [US2] Implementar `POST /pets/{id}/tags` y `DELETE /tags/{tagId}` en `apps/api/src/routes/tags.ts` con las transiciones `inactive → active`, `active → disabled`, `disabled → active` de [data-model.md](data-model.md); rechaza la activación con `409 whatsapp_not_confirmed` si el dueño no tiene `whatsappConfirmed`
- [ ] T071 [US2] Implementar `GET /pets/{id}/public-profile` y `PUT /pets/{id}/public-profile` en `apps/api/src/routes/public-profile.ts` (solo `showOwnerName`, `showConditions`, `showMedications`)
- [ ] T072 [US2] Implementar los límites de la página pública en `apps/api/src/plugins/public-rate-limit.ts`: 30/min por código y 60/min por origen con clave HMAC de la IP y secreto aleatorio solo en memoria, rotado cada 24 h, contadores en memoria con expiración de 1 minuto; respuesta `429` con `Retry-After`; nada se persiste ni se registra
- [ ] T073 [US2] Implementar `GET /public/tags/{code}` en `apps/api/src/routes/public.ts` según [contracts/public-api.md](contracts/public-api.md): `Cache-Control: no-store`, registra `TagView` (solo placa y hora) y un `DeviceEvent` `tag_viewed`; no lee ni registra IP, agente de usuario ni ubicación (FR-024a)
- [ ] T074 [US2] Implementar el aviso de consultas agrupado en `apps/api/src/jobs/tag-view-notify.ts`: como máximo una notificación cada 5 minutos por placa con el número de consultas y la hora, por push solo al dueño (FR-024)
- [ ] T075 [P] [US2] Implementar la pantalla para vincular la placa en `apps/mobile/src/app/(owner)/pets/[id]/tag.tsx`: escaneo del QR con `expo-camera` (extrae el código de la URL) o captura manual; desvincular placa; antes de activar, informa que el número del dueño se usa en el botón de WhatsApp de la página pública y, si `whatsappConfirmed` es falso, pide confirmar que el número tiene WhatsApp (`PATCH /me`)
- [ ] T076 [P] [US2] Implementar la pantalla de configuración de la página pública en `apps/mobile/src/app/(owner)/pets/[id]/public-profile.tsx`: interruptores por dato, vista previa (nombre del dueño, enfermedades, medicamentos) y vista previa que muestra el botón de WhatsApp como fijo (FR-023)
- [ ] T077 [US2] Implementar la página pública en `apps/mobile/src/app/p/[code].tsx`: una sola petición a `GET /public/tags/{code}`, foto y nombre, datos autorizados, un solo botón "Enviar WhatsApp" que abre `owner.whatsappUrl` (sin llamada ni número visible), estado "Placa no activa"; sin importar mapas, cliente autenticado ni librerías de la app del dueño; textos desde `es-MX.json`; pie con enlace al aviso de privacidad
- [ ] T078 [US2] Configurar Lighthouse CI en `apps/mobile/lighthouserc.json` y el script `lighthouse` en `apps/mobile/package.json`: perfil "Slow 4G" móvil sobre la exportación estática; falla si el JavaScript de `/p/[code]` supera 200 KB gzip o si el contenido principal tarda más de 5 s (research R3, SC-003); agregarlo a `.github/workflows/ci.yml`

**Checkpoint**: US1 y US2 funcionan por separado

---

## Phase 5: User Story 3 - Alertas de zona segura y batería baja (Priority: P1)

**Goal**: el dueño define zonas y recibe alertas de salida/entrada, batería baja y pérdida de señal, sin alertas repetidas.

**Independent Test**: escenarios 3, 4, 5 y 6 de [quickstart.md](quickstart.md) y pasos b, c, d y e de Traccar Client.

### Tests for User Story 3 ⚠️ (principio VII: escribir primero y confirmar que fallan)

- [ ] T079 [P] [US3] Escribir pruebas de geocercas en `packages/domain/tests/geofence.test.ts`: círculo con radio 50–2,000 m; salida solo si la distancia fuera del borde supera `max(30 m, precisión)` en 2 posiciones consecutivas, o en 1 si está a más de 150 m; entrada simétrica; posiciones que oscilan ±20 m en el borde no generan eventos; precisión peor que 100 m, duplicadas o fuera de orden no cambian el estado; estado inicial `unknown` no genera alerta
- [ ] T080 [P] [US3] Escribir pruebas de batería en `packages/domain/tests/battery.test.ts`: una alerta al cruzar ≤ 20 %; se rearma al superar 25 %; la secuencia 25 → 19 → 18 → 30 → 19 produce exactamente 2 alertas
- [ ] T081 [P] [US3] Escribir pruebas de alerta de señal en `packages/domain/tests/signal-alert.test.ts`: una alerta `signal_lost` por episodio al pasar a `no_signal`; se rearma con el siguiente reporte; `resting` nunca genera alerta
- [ ] T082 [P] [US3] Escribir pruebas de contrato de zonas en `apps/api/tests/contract/zones.test.ts`: crear, editar, desactivar y borrar; `radiusM` fuera de 50–2,000 → `400`; familiar → `403` al crear o editar y `200` al listar
- [ ] T083 [P] [US3] Escribir la prueba de integración del flujo de salida en `apps/api/tests/integration/zone-exit-flow.test.ts`: posiciones por `/ingest/traccar/positions` que salen de una zona → un `zone_exit`, push al dueño y al familiar, WhatsApp a quien lo tenga activado; si el proveedor de WhatsApp falla, el push se envía igual; tiempo desde la ingesta hasta el encolado < 5 s

### Implementation for User Story 3

- [ ] T084 [US3] Implementar `evaluateZone()` en `packages/domain/src/geofence/evaluate.ts` (distancia haversine, histéresis y descarte de posiciones) hasta pasar `packages/domain/tests/geofence.test.ts`
- [ ] T085 [US3] Implementar `evaluateBattery()` en `packages/domain/src/alerts/battery.ts` hasta pasar `packages/domain/tests/battery.test.ts`
- [ ] T086 [US3] Implementar `evaluateSignal()` en `packages/domain/src/alerts/signal.ts` hasta pasar `packages/domain/tests/signal-alert.test.ts`
- [ ] T087 [US3] Conectar las reglas en `apps/api/src/services/ingest.ts`: `evaluateRules()` carga zonas activas y `zone_states`, aplica `evaluateZone()` y `evaluateBattery()`, guarda estados y `DeviceEvent`, y llama al despachador de notificaciones
- [ ] T088 [US3] Conectar `evaluateSignal()` en `apps/api/src/jobs/activity-sweep.ts` para emitir `signal_lost` una vez por episodio y en `apps/api/src/services/ingest.ts` para rearmarla con el siguiente reporte
- [ ] T089 [US3] Implementar las rutas de zonas en `apps/api/src/routes/zones.ts`: `GET /pets/{id}/zones` (F), `POST /pets/{id}/zones`, `PATCH /zones/{zoneId}`, `DELETE /zones/{zoneId}` (O)
- [ ] T090 [P] [US3] Implementar la pantalla de zonas en `apps/mobile/src/app/(owner)/pets/[id]/zones.tsx`: lista, crear tocando el mapa, ajustar radio de 50 a 2,000 m, nombre, activar/desactivar; controles de edición ocultos para familiares
- [ ] T091 [P] [US3] Implementar el manejo de notificaciones en `apps/mobile/src/notifications/handlers.ts`: al tocar una alerta abre el mapa de la mascota del `petId`
- [ ] T092 [P] [US3] Implementar la pantalla de ajustes en `apps/mobile/src/app/(owner)/settings.tsx` con el interruptor de alertas por WhatsApp (`PATCH /me`) que muestra el texto de consentimiento antes de activar, el botón "Descargar mis datos" (`GET /me/export`, compartido con el menú del sistema) y la opción de eliminar la cuenta

**Checkpoint**: las tres historias P1 funcionan; el MVP crítico está completo

---

## Phase 6: User Story 4 - Historial de recorridos (Priority: P2)

**Goal**: el dueño consulta el recorrido de cualquiera de los últimos 7 días.

**Independent Test**: escenario 12 de [quickstart.md](quickstart.md) y paso g de Traccar Client.

### Tests for User Story 4

- [ ] T093 [P] [US4] Escribir pruebas de contrato en `apps/api/tests/contract/track.test.ts`: `GET /pets/{id}/track?date=` devuelve posiciones válidas del día en la zona horaria del usuario, en orden cronológico; fecha con más de 7 días → `400`; familiar → `200`

### Implementation for User Story 4

- [ ] T094 [US4] Implementar `GET /pets/{id}/track` en `apps/api/src/routes/track.ts`
- [ ] T095 [US4] Implementar la pantalla de historial en `apps/mobile/src/app/(owner)/pets/[id]/history.tsx`: selector de los últimos 7 días, polilínea del recorrido y hora de cada punto al tocarlo

**Checkpoint**: US4 funciona sin depender de US3 ni US5

---

## Phase 7: User Story 5 - Compartir la mascota con la familia (Priority: P2)

**Goal**: el dueño invita familiares que ven ubicación e historial y reciben alertas, sin poder editar.

**Independent Test**: escenario 11 de [quickstart.md](quickstart.md).

### Tests for User Story 5

- [ ] T096 [P] [US5] Escribir pruebas de contrato en `apps/api/tests/contract/access.test.ts`: `POST /pets/{id}/access` crea invitación `invited`; `POST /invitations/{accessId}/accept` solo para el número invitado → `active`; el familiar recibe `403` en todos los endpoints **O** (mascota, zonas, página pública, placa, dispositivo, accesos) y `200` en ubicación, historial y zonas; tras `DELETE /pets/{id}/access/{accessId}` el familiar recibe `404`/`403` de inmediato y deja de recibir notificaciones

### Implementation for User Story 5

- [ ] T097 [US5] Implementar las rutas de acceso en `apps/api/src/routes/access.ts`: `GET/POST /pets/{id}/access`, `DELETE /pets/{id}/access/{accessId}`, `GET /invitations`, `POST /invitations/{accessId}/accept`; si el número invitado ya tiene cuenta, recibe un push de invitación
- [ ] T098 [P] [US5] Implementar el hook `usePetRole()` en `apps/mobile/src/hooks/usePetRole.ts` y usarlo para ocultar controles de edición a familiares en las pantallas de mascota, zonas, placa, página pública y dispositivo
- [ ] T099 [P] [US5] Implementar la pantalla de familia en `apps/mobile/src/app/(owner)/pets/[id]/family.tsx`: invitar por número de celular, lista con estado y revocar
- [ ] T100 [P] [US5] Implementar la pantalla de invitaciones en `apps/mobile/src/app/(owner)/invitations.tsx`: aceptar invitaciones pendientes

**Checkpoint**: todas las historias funcionan por separado

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: operación, rendimiento, privacidad y costos

- [ ] T101 [P] Configurar Caddy en `infra/Caddyfile`: HTTPS automático, proxy a la API y formato de registro que omite la IP en `/public/*`; sitio `track.ganador.nexoru.ai` con TLS que redirige a `traccar:5055`
- [ ] T102 [P] Implementar `GET /health` (API, base de datos y Traccar) en `apps/api/src/routes/health.ts` y documentar el monitoreo externo cada minuto y el objetivo de 99.5 % en `infra/README.md`
- [ ] T103 [P] Implementar el respaldo diario cifrado de PostgreSQL a almacenamiento S3 en `infra/backup/backup.sh` con su programación en `infra/docker-compose.yml`
- [ ] T104 [P] Crear el script `apps/mobile/scripts/check-i18n.ts` que falla si `en.json` tiene claves que no existen en `es-MX.json` o si hay claves sin uso, y agregarlo a CI
- [ ] T105 Crear la prueba de carga en `tools/loadtest/ingest.k6.js`: 5,000 dispositivos reportando cada 60 s contra `/ingest/traccar/positions`; verificar procesamiento < 5 s p95 y `GET /pets/{id}/location` rápido para SC-001 y SC-007
- [ ] T106 Verificar los precios con cada proveedor (servidor, WhatsApp, SMS, almacenamiento) y actualizar la tabla de costo por dispositivo con la fecha real de consulta en `specs/001-rastreo-mascotas-mvp/research.md` (principio VI)
- [ ] T107 Revisar que ningún archivo fuera de `apps/api/src/adapters/` importe tipos o nombres de Traccar (script `apps/api/scripts/check-adapter-boundary.ts` en CI, principio I)
- [ ] T108 Implementar `POST /telemetry/timings` en `apps/api/src/routes/telemetry.ts` según [contracts/app-api.md](contracts/app-api.md): sin autenticación ni identificadores, sin registrar IP ni agente de usuario, límite de 60/min por origen en memoria, y guardado como conteos diarios por rango en `apps/api/src/db/schema/telemetry.ts`; consulta del percentil 95 por métrica con el script `apps/api/scripts/timings-report.ts`; prueba de contrato en `apps/api/tests/contract/telemetry.test.ts` (research R17)
- [ ] T109 Enviar las métricas de tiempo desde `apps/mobile/src/telemetry/timings.ts`: `owner_map_visible` desde la apertura de la app hasta que el mapa muestra la ubicación (`apps/mobile/src/app/(owner)/pets/[id]/index.tsx`) y `public_contact_visible` hasta que el botón de WhatsApp es visible (`apps/mobile/src/app/p/[code].tsx`), sin identificadores; en la página pública, con `navigator.sendBeacon` sin afectar el presupuesto de 200 KB
- [ ] T110 Ejecutar todos los escenarios de `specs/001-rastreo-mascotas-mvp/quickstart.md` (1–18) y registrar resultados

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de Foundational y de las rutas de mascotas de US1 (`apps/api/src/routes/pets.ts`); no necesita rastreador, ingesta ni mapa
- **US3 (Phase 5)**: depende de US1 (ingesta, actividad y dispositivos)
- **US4 (Phase 6)**: depende de US1 (posiciones)
- **US5 (Phase 7)**: depende de Foundational y de las rutas de mascotas de US1
- **Polish (Phase 8)**: después de las historias deseadas

### User Story Dependencies

```text
Setup → Foundational → US1 ─┬─→ US3
                            ├─→ US4
                            ├─→ US5
                            └─→ US2 (solo rutas de mascotas)
```

### Within Each User Story

- Pruebas primero y fallando (obligatorio en `packages/domain` por el principio VII)
- Dominio puro → adaptadores/servicios → rutas → pantallas
- Commit al terminar cada tarea o grupo lógico

### Parallel Opportunities

- Setup: todas las tareas [P] a la vez tras crear el monorepo
- Foundational: los seis esquemas de base de datos en paralelo; proveedores de mensajería en paralelo
- Tras US1, las historias US2, US3, US4 y US5 pueden avanzar en paralelo con personas distintas

---

## Parallel Example: User Story 1

```bash
# Pruebas primero, en paralelo:
Task: "Pruebas de actividad en packages/domain/tests/activity.test.ts"
Task: "Pruebas del adaptador en apps/api/tests/unit/traccar-adapter.test.ts"
Task: "Contrato de mascotas y ubicación en apps/api/tests/contract/pets-location.test.ts"
Task: "Integración de ingesta en apps/api/tests/integration/ingest.test.ts"

# Después, en paralelo:
Task: "Perfiles en apps/api/src/adapters/traccar/profiles.ts"
Task: "Cliente REST de Traccar en apps/api/src/adapters/traccar/api-client.ts"
Task: "Servicio de fotos en apps/api/src/services/photos.ts"
Task: "Simulador en tools/simulator/src/index.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Pruebas de geocercas en packages/domain/tests/geofence.test.ts"
Task: "Pruebas de batería en packages/domain/tests/battery.test.ts"
Task: "Pruebas de señal en packages/domain/tests/signal-alert.test.ts"
Task: "Contrato de zonas en apps/api/tests/contract/zones.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 y Phase 2.
2. Phase 3 (US1) → **validar**: con el simulador o Traccar Client el dueño ve ubicación, batería y estado.
3. Phase 4 (US2) y Phase 5 (US3) → **validar**: las tres funciones críticas (principio II) completas. Este es el MVP que se puede lanzar.

### Incremental Delivery

1. US1 → demo interna con Traccar Client.
2. US2 → placas físicas de prueba.
3. US3 → piloto con primeros rastreadores reales.
4. US4 y US5 → valor agregado.
5. Polish → preparación para producción (respaldos, carga, costos verificados).

### Notas

- Iniciar el trámite de la cuenta de WhatsApp Business y la aprobación de plantillas desde el
  día 1: bloquea FR-001 y FR-013a en producción (en desarrollo se usa el proveedor falso).
- Las notificaciones push en Android se prueban con la development build, no con Expo Go.
