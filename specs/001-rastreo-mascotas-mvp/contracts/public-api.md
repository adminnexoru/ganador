# Contrato: página pública de la placa

Consumido por la ruta web `/p/[codigo]` sin inicio de sesión (FR-020). Base: `https://api.ganador.nexoru.ai`.

## GET /public/tags/{code}

Sin autenticación. Respuesta con `Cache-Control: no-store` (el dueño puede cambiar sus datos
en cualquier momento). El servidor **no** registra IP ni agente de usuario para esta ruta y no
pide ni recibe ubicación (FR-024a). Cada respuesta 200 registra un `TagView` y dispara el
evento `tag_viewed`.

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
    "phone": "+525512345678",
    "whatsapp": "+525512345678"
  },
  "health": {
    "conditions": "Epilepsia",
    "medications": "Fenobarbital 2 veces al día"
  }
}
```

Reglas:

- `pet.name` y `pet.photoUrl` siempre presentes (`photoUrl` puede ser `null` si no hay foto).
- `owner.name`, `owner.phone`, `owner.whatsapp`, `health.conditions`, `health.medications`
  aparecen solo si el dueño los autorizó; si no, se **omiten** (no se envían como `null`).
- Al menos uno de `owner.phone` u `owner.whatsapp` siempre está presente (FR-023).
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

- Muestra foto, nombre y los datos autorizados.
- Botón "Llamar": `tel:+52...`.
- Botón "WhatsApp": `https://wa.me/52...?text=<mensaje prellenado en es-MX con el nombre de la
  mascota>`.
- Presupuesto de rendimiento: ver research R3.
