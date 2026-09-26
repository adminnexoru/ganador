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
| 3 | Ubicación desactualizada | Detener el simulador 31 min (o adelantar el reloj de pruebas) | Aviso de ubicación no actualizada y alerta de pérdida de señal |
| 4 | Salida de zona (HU3, SC-002) | Crear zona "Casa" de 100 m; simular ruta que sale de la zona | Push y WhatsApp de salida en < 2 min; una sola alerta |
| 5 | Borde de zona (FR-014) | Simular posiciones que oscilan ±20 m en el borde | Ninguna alerta repetida |
| 6 | Batería baja (FR-015) | Simular batería 25 → 19 → 18 → 30 → 19 % | Dos alertas: al llegar a 19 % y otra vez tras recargar |
| 7 | Página pública (HU2, SC-003) | Vincular placa, abrir `/p/<codigo>` en Simple Browser y en el celular sin sesión | Foto, nombre y datos autorizados; nunca dirección; "Llamar" y "WhatsApp" funcionan |
| 8 | Privacidad de quien escanea (FR-024a) | Abrir la página pública e inspeccionar la red y los registros | No se pide ubicación; no se guarda IP; el dueño recibe push solo con la hora |
| 9 | Configuración pública (FR-023) | Intentar ocultar teléfono y WhatsApp | La app lo impide con un mensaje |
| 10 | Placa inactiva (FR-026) | Abrir `/p/<codigo-sin-vincular>` | "Placa no activa", sin datos personales |
| 11 | Familia (HU5) | Invitar un segundo número, aceptar; intentar editar una zona como familiar; revocar | El familiar ve ubicación y alertas; recibe `403` al editar; al revocar deja de ver la mascota |
| 12 | Historial (HU4) | Consultar el día de ayer y uno de hace 8 días | Recorrido de ayer visible; el de hace 8 días no disponible |
| 13 | Eliminación de cuenta | Eliminar la cuenta y escanear su placa | Datos borrados; placa muestra "no activa" |
| 14 | Español | Revisar todas las pantallas | Todo en es-MX; el lint no reporta textos literales |
