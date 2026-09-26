# Implementation Plan: Rastreo y recuperación de mascotas (MVP)

**Branch**: `001-rastreo-mascotas-mvp` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-rastreo-mascotas-mvp/spec.md`

## Summary

App para que dueños en México vean dónde está su mascota, reciban alertas de salida de zona y
de batería, y la recuperen con una placa NFC/QR. Se construye como **una sola app Expo (React
Native) con Expo Router y TypeScript** para Android, iOS y web; la web sirve la página pública
de la placa como una ruta de servidor de Expo que responde HTML ligero sin JavaScript. Un **backend propio en Node.js/TypeScript** recibe las
posiciones desde **Traccar** (solo ingesta), las traduce con **adaptadores por marca** a un
modelo neutral, evalúa geocercas y alertas con lógica pura probada primero, y notifica por
**Expo Notifications** y, para salidas de zona, por **WhatsApp**. Costo estimado:
**≈ US$0.14 por dispositivo activo al mes** a 5,000 dispositivos (precios consultados el 2026-09-26, con partidas pendientes de confirmar) (detalle en
[research.md](research.md#costo-mensual-por-dispositivo-activo-resumen)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) en todo el proyecto; Node.js 24 LTS en el
backend; Expo SDK estable más reciente.

**Primary Dependencies**: App: Expo, Expo Router, Expo Notifications, expo-camera,
expo-secure-store, expo-localization, react-native-maps, i18next/react-i18next. Backend:
Fastify, Zod, Drizzle ORM, pg-boss. Ingesta: Traccar. Mensajería: WhatsApp Cloud API y un
proveedor de SMS de respaldo.

**Storage**: PostgreSQL 17 + PostGIS (bases `ganador` y `traccar`); almacenamiento de objetos
compatible con S3 para fotos; `expo-secure-store` para tokens en el celular.

**Testing**: Vitest (dominio y API, incluidas pruebas de contrato e integración con PostgreSQL
en contenedor); Jest + jest-expo + React Native Testing Library (app); Lighthouse CI (página
pública).

**Target Platform**: Android 10+ e iOS 16+ (app del dueño); navegadores móviles actuales
(página pública); servidor Linux con Docker (backend y Traccar).

**Project Type**: app móvil + web desde un solo proyecto Expo, con API y servicio de ingesta.

**Performance Goals**: ubicación visible < 10 s al abrir la app (SC-001); alerta de salida
< 2 min desde el reporte (SC-002), con procesamiento de posición < 5 s p95; contacto visible
< 5 s tras escanear en "Slow 4G" (SC-003); ≈ 1.5 M posiciones/día.

**Constraints**: JavaScript de la ruta pública ≤ 200 KB gzip (medido: 0 KB, ruta de servidor); sin IP ni ubicación de quien
escanea (límite por origen solo en memoria, con HMAC rotativo); umbral de señal por
dispositivo (intervalo en reposo + tolerancia); posiciones retenidas 7 días; es-MX sin textos literales; rastreadores que reporten
≤ 60 s en movimiento; desarrollo con Expo Go salvo notificaciones push en Android.

**Scale/Scope**: hasta 5,000 rastreadores activos el primer año; ~15 pantallas del dueño y 1
página pública; 5 historias de usuario.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el diseño | Estado |
|-----------|---------------------------|--------|
| I. Independencia de hardware | Traccar solo como ingesta; `DeviceAdapter` + perfiles por marca traducen al modelo neutral (dispositivo, posición, evento, batería); geocercas y alertas propias, no de Traccar ([device-ingest.md](contracts/device-ingest.md)) | ✅ |
| II. Mascota primero | Las HU1–HU3 (ubicación, placa, alertas) son P1 y se implementan antes que historial y familia (P2) | ✅ |
| III. Privacidad (LFPDPPP) | Aviso y consentimiento versionados antes de guardar datos; configuración pública por mascota; sin dirección en el modelo; sin datos de quien escanea; retención de 7, 30 y 90 días; borrado de cuenta ≤ 24 h; fotos sin metadatos; WhatsApp con aceptación expresa; derechos ARCO (FR-003a); inventario de datos en la spec; OsmAnd por HTTPS y GT06 sin cifrado bajo las condiciones de la regla "Transporte desde el hardware" (v1.1.0), con filtro de plausibilidad ([research R5 y R16](research.md)) | ✅ |
| IV. Español primero | i18next con es-MX base; lint contra textos literales; formatos con `Intl` | ✅ |
| V. Móvil primero y placa ligera | App del dueño móvil; página pública como ruta de servidor de Expo, HTML sin JS ni sesión (LCP 0.9 s medido), con presupuesto verificado en CI | ✅ |
| VI. Costos visibles | Costo por dispositivo documentado por decisión y en tabla resumen | ✅ |
| VII. Pruebas primero en alertas y geocercas | Lógica pura en `packages/domain`; las pruebas (incluidos bordes, imprecisión, duplicados, desorden) se escriben y fallan antes de implementar | ✅ |
| VIII. Un solo código base | Android, iOS y web desde `apps/mobile`; sin código por plataforma salvo el aviso de "descarga la app" en web ([research R2](research.md)) | ✅ |

**Re-check post-diseño (Phase 1)**: sin violaciones. El backend y Traccar son servicios de
servidor, no clientes paralelos, por lo que no contradicen el principio VIII.

## Project Structure

### Documentation (this feature)

```text
specs/001-rastreo-mascotas-mvp/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones y costos
├── data-model.md        # Phase 1: entidades
├── quickstart.md        # Phase 1: guía de validación
├── contracts/
│   ├── app-api.md       # API de la app del dueño
│   ├── public-api.md    # Página pública de la placa
│   └── device-ingest.md # Adaptadores y reenvío desde Traccar
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/
├── mobile/                      # Expo + Expo Router: Android, iOS y web
│   ├── src/
│   │   ├── app/                 # rutas de Expo Router (convención del SDK 57)
│   │   │   ├── (auth)/          # celular, código, aviso de privacidad
│   │   │   ├── (owner)/         # mascotas, mapa, historial, zonas, familia, placa
│   │   │   └── p/[code]+api.ts  # página pública de la placa: ruta de servidor, HTML sin JS
│   │   ├── components/
│   │   ├── api/                 # cliente tipado de contracts/app-api.md
│   │   ├── i18n/                # es-MX (base), en (preparado)
│   │   └── notifications/
│   ├── scripts/                 # check-i18n
│   └── tests/
└── api/                         # Fastify
    ├── scripts/                 # check-adapter-boundary (principio I)
    ├── src/
    │   ├── adapters/traccar/    # DeviceAdapter, perfiles por marca (incl. traccar-client), sondeo de actividad
    │   ├── routes/              # auth, pets, zones, tags, public, ingest
    │   ├── services/            # ingesta, notificaciones, mensajería
    │   ├── jobs/                # pg-boss: señal perdida, limpieza, envíos
    │   ├── db/                  # esquema Drizzle y migraciones
    │   └── messaging/           # MessagingProvider: WhatsApp, SMS, falso
    └── tests/
        ├── contract/
        ├── integration/
        └── unit/
packages/
└── domain/                      # TS puro, compartido
    ├── src/device/              # modelo neutral
    ├── src/geofence/            # zonas + histéresis
    ├── src/alerts/              # batería, actividad (movimiento/reposo/sin señal), notificaciones
    └── tests/
infra/
├── docker-compose.yml           # PostgreSQL/PostGIS, Traccar, API, Caddy
└── traccar/traccar.xml          # reenvío a /ingest/traccar/*; puerto 5055 para Traccar Client
tools/
├── simulator/                   # envía posiciones de prueba a Traccar
├── tags/                        # genera lotes de placas (CSV para NFC y QR)
└── loadtest/                    # prueba de carga de ingesta (k6)
```

**Structure Decision**: monorepo con pnpm workspaces. `apps/mobile` es el único cliente
(principio VIII). `packages/domain` concentra el modelo neutral y las reglas de alertas para
probarlas de forma aislada y primero (principios I y VII). `apps/api` e `infra/` contienen el
servidor y Traccar.

## Complexity Tracking

Sin violaciones de la constitución que justificar.

## Riesgos abiertos

- **Presupuesto de la página pública**: resuelto con la ruta de servidor de Expo (research R3);
  la web ahora requiere el servidor de Expo en la VM en lugar de un CDN estático.
- **Plantillas de WhatsApp**: requieren aprobación de Meta y una cuenta de negocio verificada;
  tramitar al inicio, porque bloquean FR-001 y FR-013a en producción.
- **Frecuencia de reporte del rastreador**: SC-002 depende de reportes ≤ 60 s; validar con el
  primer modelo de hardware.
- **Dominio temporal**: `ganador.nexoru.ai` queda grabado en las placas; si cambia el dominio,
  el temporal debe mantenerse con redirección mientras existan placas (research R4).
- **Precios**: todos los costos son de referencia y deben verificarse con los proveedores.
