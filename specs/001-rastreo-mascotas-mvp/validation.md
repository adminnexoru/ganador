# Validación del quickstart (T110)

**Fecha**: 2026-09-26 · **Entorno**: máquina de desarrollo sin Docker ni celular conectado.

Las pruebas automáticas corren la API real (Fastify) sobre PostgreSQL en proceso (PGlite),
con proveedores falsos de WhatsApp, SMS, push y Traccar. Lo que exige Traccar, Expo Go, una
development build o un rastreador queda **pendiente de validación manual**.

## Resultado de las pruebas automáticas

| Paquete | Resultado |
|---------|-----------|
| `packages/domain` (actividad, geocercas, batería, señal) | 28 / 28 |
| `apps/api` (contrato, integración y unitarias) | 100 / 100 |
| `apps/mobile` (página pública) | 6 / 6 |
| Tipos (`pnpm typecheck`), lint, i18n y frontera del adaptador | Sin errores |
| Presupuesto de la página pública (Lighthouse móvil, Slow 4G) | JS 0 KB · total 16.7 KB · LCP 0.99 s |

## Escenarios

| # | Escenario | Cobertura automática | Estado |
|---|-----------|----------------------|--------|
| 1 | Registro | `auth.test.ts`, `me.test.ts` | ✅ API · ⏳ pantallas en celular |
| 2 | Ubicación (SC-001) | `pets-location.test.ts`, `ingest.test.ts` | ✅ API · ⏳ < 10 s en celular |
| 3 | Reposo vs. sin señal | `activity.test.ts`, `ingest.test.ts`, `zone-exit-flow.test.ts` | ✅ |
| 4 | Salida de zona (SC-002) | `zone-exit-flow.test.ts` (ingesta → alerta en < 5 s) | ✅ API · ⏳ entrega real de push y WhatsApp |
| 5 | Borde de zona | `geofence.test.ts`, `zone-exit-flow.test.ts` | ✅ |
| 6 | Batería baja | `battery.test.ts`, `zone-exit-flow.test.ts` | ✅ |
| 7 | Página pública (SC-003) | `public-tags.test.ts`, `public-page.test.ts`, Lighthouse | ✅ · ⏳ NFC y QR físicos |
| 8 | Privacidad de quien escanea | `public-tags.test.ts` (sin IP en BD ni registros, `429`) | ✅ |
| 9 | Configuración pública | `tags.test.ts` (incl. `whatsapp_not_confirmed`) | ✅ API · ⏳ pantalla |
| 10 | Placa inactiva | `public-tags.test.ts`, `public-page.test.ts` | ✅ |
| 11 | Familia | `access.test.ts` | ✅ API · ⏳ pantallas |
| 12 | Historial | `track.test.ts` | ✅ API · ⏳ mapa del recorrido |
| 13 | Eliminación de cuenta | `me.test.ts` | ✅ |
| 14 | Español | `check:i18n`, regla `i18next/no-literal-string` | ✅ |
| 15 | Celular con Traccar Client | — | ⏳ requiere Docker (Traccar) y un segundo celular |
| 16 | Derecho de acceso | `me.test.ts` | ✅ API · ⏳ compartir archivo en celular |
| 17 | Aceptación de WhatsApp | `me.test.ts`, `notifications.test.ts` | ✅ |
| 18 | Fotos sin metadatos | `pets-location.test.ts` (EXIF con GPS eliminado) | ✅ |

## Pendiente de validación manual

1. Levantar `infra/docker-compose.yml` (PostgreSQL + Traccar) y correr el escenario 15 con
   Traccar Client.
2. Probar las pantallas en Expo Go y las notificaciones push en una development build de
   Android (research R10).
3. Grabar una placa NFC y un QR de prueba con una URL de `tools/tags` y escanearlos.
4. Correr `tools/loadtest/ingest.k6.js` contra un servidor con PostgreSQL real (SC-007).
