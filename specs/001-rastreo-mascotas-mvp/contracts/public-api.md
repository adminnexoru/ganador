# Contrato: página pública de la placa

Consumido por la ruta web `/p/[codigo]` sin inicio de sesión (FR-020). Base: `https://api.ganador.nexoru.ai`.

## GET /public/tags/{code}

Sin autenticación. Respuesta con `Cache-Control: no-store` (el dueño puede cambiar sus datos
en cualquier momento). El servidor **no** registra IP ni agente de usuario para esta ruta y no
pide ni recibe ubicación (FR-024a). Cada respuesta 200 registra un `TagView` y dispara el
evento `tag_viewed`, que se notifica solo al dueño (FR-024).

Límites (respuesta `429` con `Retry-After`):

- **Por código**: 30 peticiones por minuto, para evitar abuso de notificaciones al dueño.
- **Por origen**: 60 peticiones por minuto, para frenar el recorrido masivo de códigos. Se
  aplica solo en memoria temporal: la clave es un HMAC de la IP con un secreto que vive solo en
  memoria y rota cada 24 h, y el contador expira al minuto. Ni la IP ni su HMAC se guardan en
  base de datos, registros o respaldos, cumpliendo FR-024a (research R16).

### 200 — placa activa

```json
{
  "status": "active",
  "pet": {
    "name": "Firulais",
    "species": "dog",
    "photoUrl": "https://.../pets/123/public.webp"
  },
  "owner": {
    "name": "Ana",
    "whatsappUrl": "https://wa.me/525512345678?text=Hola%2C%20encontr%C3%A9%20a%20Firulais"
  },
  "health": {
    "conditions": "Epilepsia",
    "medications": "Fenobarbital 2 veces al día"
  }
}
```

Reglas:

- `pet.name` y `pet.photoUrl` siempre presentes (`photoUrl` puede ser `null` si no hay foto).
- `owner.whatsappUrl` siempre está presente: enlace `wa.me` con el número del dueño y un mensaje
  prellenado en es-MX que menciona a la mascota (FR-023). No se envía el número como campo
  aparte ni hay opción de llamada.
- `owner.name`, `health.conditions`, `health.medications` aparecen solo si el dueño los
  autorizó; si no, se **omiten** (no se envían como `null`).
- La respuesta nunca incluye dirección, zonas, ubicación del rastreador ni identificadores
  internos (FR-022).

### 200 — placa no activa

```json
{ "status": "inactive" }
```

Para placas sin vincular o deshabilitadas (FR-026). No registra `TagView`.

### 404

Código inexistente. Mismo cuerpo visual que "placa no activa" en la web.

## Ruta web `/p/[codigo]`

Ruta de servidor de Expo Router (`apps/mobile/src/app/p/[code]+api.ts`) que consulta
`GET /public/tags/{code}` y responde HTML ya armado, sin JavaScript (research R3):

- `200` con foto, nombre y los datos autorizados; `404` si el código no existe; `503` si la API
  no responde. Placa inactiva: `200` con "Placa no activa".
- Un solo botón "Enviar WhatsApp" que abre `owner.whatsappUrl`; sin botón de llamada ni número
  visible como texto.
- `Cache-Control: no-store` y `Referrer-Policy: no-referrer`.
- Reenvía `X-Forwarded-For` a la API solo para el límite por origen en memoria; la API confía
  en ese encabezado únicamente desde proxies de la red privada.
- Presupuesto de rendimiento: ver research R3 (medición automática con
  `pnpm --filter @ganador/mobile lighthouse`).
