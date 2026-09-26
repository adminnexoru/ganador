# Contrato: API de la app del dueño

Base: `https://api.<dominio>/v1`. JSON. Autenticación con `Authorization: Bearer <accessToken>`
salvo en `/auth/*`. Errores con cuerpo `{ "error": { "code": "...", "message": "..." } }`,
donde `message` viene en el idioma del usuario (es-MX por defecto).

Permisos: **O** = solo el dueño (`role=owner`); **F** = dueño o familiar con acceso activo.
Un familiar que llama a un endpoint **O** recibe `403 forbidden` (FR-018).

## Autenticación (FR-001, FR-002, FR-003)

| Método y ruta | Cuerpo | Respuesta |
|---------------|--------|-----------|
| `POST /auth/otp` | `{ phone }` | `202`; envía código por WhatsApp o SMS. `429` al exceder límites |
| `POST /auth/verify` | `{ phone, code }` | `{ accessToken, refreshToken, user, needsConsent }` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST /auth/logout` | — | `204` |
| `GET /privacy-notice` | — | `{ version, url }` |
| `POST /me/consent` | `{ noticeVersion }` | `204` |
| `GET /me` / `PATCH /me` | `{ displayName?, whatsappAlertsEnabled? }` | usuario |
| `DELETE /me` | — | `202`; revoca consentimiento, borra datos en ≤ 24 h, desactiva placas |
| `POST /me/push-tokens` | `{ token, platform }` | `204` |

Mientras `needsConsent` sea verdadero, todo endpoint fuera de `/auth/*`, `/privacy-notice` y
`/me/consent` responde `403 consent_required`.

## Mascotas (FR-005)

| Método y ruta | Permiso | Notas |
|---------------|---------|-------|
| `GET /pets` | F | mascotas con acceso, incluye `role` y resumen de última ubicación |
| `POST /pets` | — | crea mascota; el creador queda como `owner` |
| `GET /pets/{id}` | F | |
| `PATCH /pets/{id}` | O | |
| `DELETE /pets/{id}` | O | desvincula dispositivo y placas |
| `PUT /pets/{id}/photo` | O | `multipart/form-data`, JPEG/PNG/HEIC ≤ 10 MB |

## Dispositivo y ubicación (FR-006 a FR-011)

| Método y ruta | Permiso | Notas |
|---------------|---------|-------|
| `POST /pets/{id}/device` | O | `{ externalId }` (IMEI); `409` si ya está vinculado a otra mascota |
| `DELETE /pets/{id}/device` | O | |
| `GET /pets/{id}/location` | F | ver abajo |
| `GET /pets/{id}/track?date=YYYY-MM-DD` | F | posiciones del día (zona horaria del usuario); `400` si la fecha tiene más de 7 días |

`GET /pets/{id}/location`:

```json
{
  "position": { "lat": 19.4326, "lng": -99.1332, "accuracyM": 12, "recordedAt": "2026-09-25T18:02:11Z" },
  "battery": { "levelPct": 64, "recordedAt": "2026-09-25T18:02:11Z" },
  "stale": false,
  "signalState": "ok"
}
```

`stale` es verdadero si `recordedAt` tiene más de 30 minutos (FR-009).

## Zonas seguras (FR-012)

| Método y ruta | Permiso | Cuerpo |
|---------------|---------|--------|
| `GET /pets/{id}/zones` | F | |
| `POST /pets/{id}/zones` | O | `{ name, centerLat, centerLng, radiusM }` (50–2,000) |
| `PATCH /zones/{zoneId}` | O | campos parciales, incluido `active` |
| `DELETE /zones/{zoneId}` | O | |

## Compartir (FR-017, FR-018)

| Método y ruta | Permiso | Notas |
|---------------|---------|-------|
| `GET /pets/{id}/access` | O | |
| `POST /pets/{id}/access` | O | `{ phone }`; envía invitación |
| `DELETE /pets/{id}/access/{accessId}` | O | revoca de inmediato |
| `GET /invitations` | — | invitaciones pendientes para el número del usuario |
| `POST /invitations/{accessId}/accept` | — | |

## Placa y página pública (FR-019, FR-021 a FR-023)

| Método y ruta | Permiso | Notas |
|---------------|---------|-------|
| `POST /pets/{id}/tags` | O | `{ code }`; `404` si no existe, `409` si ya está activa en otra mascota |
| `DELETE /tags/{tagId}` | O | la deshabilita |
| `GET /pets/{id}/public-profile` | O | configuración actual |
| `PUT /pets/{id}/public-profile` | O | `{ showOwnerName, showPhone, showWhatsapp, showConditions, showMedications }`; `422` si `showPhone` y `showWhatsapp` son ambos falsos |

## Notificaciones push (contenido)

Cada push lleva `data: { type, petId, eventId }`, con `type` en `zone_exit`, `zone_enter`,
`battery_low`, `signal_lost`, `tag_viewed`. Los textos se generan en el idioma del
destinatario.
