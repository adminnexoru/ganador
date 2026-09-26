# Quickstart: validar el MVP de punta a punta

Guía para levantar el entorno local y comprobar que la funcionalidad cumple la spec. Los
contratos están en [contracts/](contracts/) y las entidades en [data-model.md](data-model.md).

## Requisitos previos

- Node.js 24 LTS y pnpm.
- Docker y Docker Compose.
- VS Code (vista previa web con Simple Browser).
- Un celular Android o iPhone con **Expo Go** para las pantallas, y una **development build**
  (EAS Build) para probar notificaciones push en Android (research R10).
- Opcional: un rastreador GPS compatible con Traccar, o el simulador de posiciones del repo.
- Credenciales de prueba de WhatsApp Cloud API y del proveedor de SMS (sin ellas, el backend
  usa un proveedor de mensajes falso que escribe los códigos en el registro).

## Arranque

```bash
pnpm install
cp .env.example .env                    # completar secretos locales
docker compose -f infra/docker-compose.yml up -d   # PostgreSQL/PostGIS + Traccar
pnpm --filter api db:migrate
pnpm --filter api dev                   # API en http://localhost:3000
pnpm --filter mobile start              # Expo: "w" abre la web; QR para Expo Go
```

Vista previa web en VS Code: `Ctrl+Shift+P` → "Simple Browser: Show" →
`http://localhost:8081/p/<codigo>`.

## Pruebas automáticas

```bash
pnpm --filter domain test               # geocercas y alertas (se escriben antes del código)
pnpm --filter api test                  # contrato e integración (PostgreSQL en contenedor)
pnpm --filter mobile test               # componentes y textos i18n
pnpm --filter mobile lighthouse         # presupuesto de la página pública (research R3)
```

## Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|--------------------|
| 1 | Registro (HU1) | Abrir la app, ingresar celular, código del registro de la API, aceptar aviso | Cuenta creada; sin aceptar el aviso no se pueden crear mascotas |
| 2 | Ubicación (HU1, SC-001) | Crear mascota, vincular IMEI, correr `pnpm sim --imei <IMEI> --route casa` | El mapa muestra ubicación, hora y batería en < 10 s al abrir la app |
| 3 | Reposo vs. sin señal (FR-009, FR-009a, FR-016) | Con perfil de 10 min en reposo: simular posiciones quietas cada 10 min; luego detener el simulador más de 15 min (o adelantar el reloj de pruebas) | Primero "en reposo" sin alertas; al pasar el umbral (10 + 5 min), "sin señal", ubicación marcada como no actualizada y una sola alerta de pérdida de señal |
| 4 | Salida de zona (HU3, SC-002) | Crear zona "Casa" de 100 m; simular ruta que sale de la zona | Push y WhatsApp de salida en < 2 min; una sola alerta |
| 5 | Borde de zona (FR-014) | Simular posiciones que oscilan ±20 m en el borde | Ninguna alerta repetida |
| 6 | Batería baja (FR-015) | Simular batería 25 → 19 → 18 → 30 → 19 % | Dos alertas: al llegar a 19 % y otra vez tras recargar |
| 7 | Página pública (HU2, SC-003) | Vincular placa, abrir `/p/<codigo>` en Simple Browser y en el celular sin sesión | Foto, nombre y datos autorizados; nunca dirección; solo el botón "Enviar WhatsApp", que abre la conversación con mensaje prellenado; sin llamada ni número visible |
| 8 | Privacidad de quien escanea (FR-024a) | Abrir la página pública e inspeccionar la red y los registros; luego enviar más de 60 peticiones en un minuto desde el mismo origen a códigos distintos | No se pide ubicación; no se guarda IP; el dueño recibe push solo con la hora; el exceso recibe `429` y la IP no aparece en base de datos ni registros |
| 9 | Configuración pública (FR-021, FR-023) | Ocultar nombre del dueño y datos de salud; activar una placa con una cuenta que recibió el código por SMS | La página refleja los cambios y el botón de WhatsApp siempre aparece; la app avisa del uso del número y pide confirmar que tiene WhatsApp |
| 10 | Placa inactiva (FR-026) | Abrir `/p/<codigo-sin-vincular>` | "Placa no activa", sin datos personales |
| 11 | Familia (HU5) | Invitar un segundo número, aceptar; intentar editar una zona como familiar; revocar | El familiar ve ubicación y alertas; recibe `403` al editar; al revocar deja de ver la mascota |
| 12 | Historial (HU4) | Consultar el día de ayer y uno de hace 8 días | Recorrido de ayer visible; el de hace 8 días no disponible |
| 13 | Eliminación de cuenta | Eliminar la cuenta y escanear su placa | Datos borrados; placa muestra "no activa" |
| 14 | Español | Revisar todas las pantallas | Todo en es-MX; el lint no reporta textos literales |
| 15 | Flujo completo con un celular como rastreador | Ver "Celular como rastreador con Traccar Client" abajo | Ubicación, zonas, reposo, sin señal y batería funcionan de punta a punta sin hardware dedicado |
| 16 | Derecho de acceso (FR-003a) | En ajustes, "Descargar mis datos" | Archivo con cuenta, consentimientos, mascotas, zonas, dispositivos, accesos y posiciones de 7 días; nada de otros usuarios |
| 17 | Aceptación de WhatsApp (FR-013a) | Con WhatsApp sin aceptar, simular una salida; aceptarlo en ajustes y repetir | Primero solo push; después push y WhatsApp |
| 18 | Fotos sin metadatos (H1) | Subir una foto con ubicación GPS en EXIF y descargar la versión pública | La imagen no contiene metadatos |

## Celular como rastreador con Traccar Client

Permite validar todo el flujo (ingesta → adaptador → alertas → app) antes de tener un
rastreador. Se necesita un **segundo celular** (o el mismo, si la app del dueño corre en otro
dispositivo o en la web) en la misma red que la máquina de desarrollo.

1. Confirmar que `infra/docker-compose.yml` expone el puerto **5055** de Traccar (protocolo
   OsmAnd, el que usa Traccar Client) y que en desarrollo `infra/traccar/traccar.xml` tiene
   `database.registerUnknown=true` para aceptar dispositivos nuevos.
2. Instalar **Traccar Client** (Android o iOS) en el celular que hará de rastreador.
3. En la app Traccar Client:
   - Anotar el **identificador del dispositivo** que muestra.
   - **URL del servidor**: `http://<IP-de-la-máquina-en-la-LAN>:5055` (solo en desarrollo; en
     producción es `https://track.ganador.nexoru.ai`, porque OsmAnd siempre va cifrado).
   - **Precisión**: alta. **Frecuencia**: 60 s.
   - Activar el servicio y conceder permiso de ubicación "siempre".
4. En la app del dueño: crear una mascota y vincular el dispositivo usando ese identificador
   como `externalId`. El adaptador lo asocia al perfil `traccar-client` (intervalo en reposo =
   frecuencia configurada, 60 s → umbral de señal de 6 min).
5. Validar:

| Paso | Acción con el celular rastreador | Resultado esperado |
|------|----------------------------------|--------------------|
| a | Dejarlo quieto 3 minutos | Mapa con su ubicación, hora y batería; estado "en reposo" |
| b | Crear una zona "Casa" de 50 m donde está; caminar más de 150 m | Estado "en movimiento"; push y WhatsApp de salida en < 2 min |
| c | Regresar a la zona | Notificación de entrada |
| d | Caminar ida y vuelta junto al borde de la zona | Sin alertas repetidas |
| e | Detener el servicio en Traccar Client más de 6 min | Estado "sin señal", ubicación no actualizada y una alerta de pérdida de señal |
| f | Reactivar el servicio | Vuelve a "en reposo" o "en movimiento" sin nueva alerta |
| g | Consultar el historial del día | Recorrido de la caminata en orden |

Limitaciones: la batería reportada es la del celular, y el sistema operativo puede espaciar
los reportes con la pantalla apagada o en ahorro de energía; para medir SC-002 con precisión
se usa el simulador o hardware real.
