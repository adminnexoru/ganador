# Research: Rastreo y recuperación de mascotas (MVP)

**Fecha**: 2026-09-25 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Cada decisión incluye su justificación, alternativas y, cuando aplica, su costo mensual por
dispositivo activo (principio VI). Los precios son **valores de referencia** tomados del
conocimiento disponible a mediados de 2026; **deben verificarse con cada proveedor antes de
contratar** y actualizarse aquí con la fecha de consulta real.

---

## R1. Cliente: Expo (React Native) + Expo Router + TypeScript

- **Decision**: una sola app Expo (SDK estable más reciente) con Expo Router y TypeScript
  estricto para Android, iOS y web.
- **Rationale**: dado por el usuario; cumple el principio VIII (un solo código base). Expo
  Router da rutas por archivo compartidas entre plataformas y permite exportar la web como
  sitio estático.
- **Alternatives considered**: Flutter (otro lenguaje, peor soporte web ligero); apps nativas
  separadas (viola el principio VIII).

## R2. Alcance de la versión web

- **Decision**: la versión web del proyecto sirve **solo** la página pública de la placa
  (`/p/[codigo]`) y páginas legales (aviso de privacidad). Las pantallas del dueño en web
  muestran un mensaje para descargar la app.
- **Rationale**: la spec define la app del dueño como móvil y la web solo para quien encuentra
  a la mascota. El mapa nativo (`react-native-maps`) no funciona en web; soportarlo exigiría
  otra librería de mapas sin beneficio para el MVP.
- **Alternatives considered**: app del dueño completa en web con MapLibre GL JS (más trabajo y
  pruebas, fuera del alcance de la spec).

## R3. Página pública rápida en redes móviles (SC-003, < 5 s)

- **Decision**: exportación estática de Expo Router (`web.output: "static"`) con la ruta
  `/p/[codigo]` prerenderizada como esqueleto; los datos se obtienen con una sola petición a
  `GET /public/tags/{codigo}` (ver [contracts/public-api.md](contracts/public-api.md)).
  Presupuesto de rendimiento de la ruta:
  - JavaScript de la ruta ≤ 200 KB comprimido (gzip), sin mapas ni librerías de la app del dueño.
  - Foto de la mascota servida en tamaño reducido (≤ 60 KB, WebP/JPEG) desde la API.
  - Datos de contacto visibles en ≤ 5 s en Lighthouse con perfil "Slow 4G" en un Android de
    gama media emulado.
  - Un solo botón "Enviar WhatsApp" (`https://wa.me/<número>?text=...`) como enlace simple, sin
    JavaScript adicional; sin llamada ni número visible (FR-023).
- **Rationale**: mantiene la página dentro del mismo proyecto (principio VIII) y permite medir
  el presupuesto en CI.
- **Alternatives considered**: renderizado en servidor con Expo Router (`output: "server"`),
  que requiere hosting con funciones y agrega costo; página HTML aparte servida por la API
  (más rápida, pero rompe el principio VIII). **Plan de contingencia**: si el presupuesto no
  se cumple, se evalúa `output: "server"` antes que cualquier código fuera del proyecto.
- **Costo**: hosting estático en CDN con plan gratuito de uso comercial (p. ej. Cloudflare
  Pages): **US$0 / dispositivo / mes**.

## R4. NFC y QR sin app

- **Decision**: cada placa lleva grabada una URL `https://ganador.nexoru.ai/p/<codigo>` en un registro
  NDEF (NFC) y en el QR. El `codigo` es aleatorio, de 10 caracteres base32 sin caracteres
  ambiguos (≈ 50 bits), impreso también en la placa.
- **Dominios** (temporales, definidos el 2026-09-26): web y página pública en
  `ganador.nexoru.ai`, API en `api.ganador.nexoru.ai`, ingesta cifrada de rastreadores en
  `track.ganador.nexoru.ai`. **La URL grabada en NFC y QR no se puede cambiar**: aunque el
  producto se mude a un dominio definitivo, `ganador.nexoru.ai/p/*` debe seguir respondiendo
  (redirección 301 al dominio nuevo) mientras existan placas con esa URL. Conviene producir
  pocas placas con el dominio temporal.
- **Rationale**: Android y iPhone (XS o posterior) abren URLs NDEF de forma nativa y la cámara
  lee QR sin apps, cumpliendo FR-020. Un código aleatorio largo impide adivinar placas ajenas.
- **Vinculación desde la app**: el dueño escanea el QR con la cámara de la app (`expo-camera`,
  compatible con Expo Go) o escribe el código. No se lee NFC desde la app en el MVP (requeriría
  un módulo nativo fuera de Expo Go).
- **Alternatives considered**: IDs secuenciales (enumerables, riesgo de privacidad); NFC desde
  la app con `react-native-nfc-manager` (requiere development build).

## R5. Ingesta de dispositivos: Traccar + adaptadores

- **Decision**: Traccar (código abierto, soporta cientos de protocolos de rastreadores GPS) se
  usa **solo como capa de ingesta**. Traccar reenvía cada posición y evento a nuestro backend
  por HTTP (`forward.url` con JSON y `event.forward.url`). En el backend, la capa
  `adapters/` traduce el JSON de Traccar al modelo neutral (dispositivo, posición, evento,
  batería). Las diferencias por marca (por ejemplo, batería como porcentaje o como voltaje,
  nombres de atributos distintos) se resuelven en un **perfil por marca/modelo** dentro del
  adaptador. Cada perfil declara además el **intervalo de reporte en reposo** por defecto del
  modelo (p. ej. `generic-gt06`: 600 s; `traccar-client`: el configurado en la app, 60 s por
  defecto); si el rastreador informa su intervalo real, el adaptador usa ese valor.
- **Actividad sin posición**: muchos rastreadores envían solo *heartbeats* (latidos sin
  posición) cuando están quietos, y Traccar no los reenvía por `forward.url`. El adaptador
  consulta cada minuto `GET /api/devices` de Traccar y toma `lastUpdate` como última actividad
  del dispositivo (`lastSeenAt`), para no confundir reposo con falta de señal.
- **Rationale**: principio I. Las geocercas, las alertas y el almacenamiento usan solo el modelo
  neutral; Traccar podría reemplazarse o convivir con otro adaptador (por ejemplo, la nube de
  un fabricante) sin tocar el resto. No se usan las geocercas ni las notificaciones de Traccar,
  para que esa lógica sea nuestra y se pruebe antes de programarse (principio VII).
- **Cifrado en tránsito** (constitución v1.1.0, "Transporte desde el hardware"):
  - OsmAnd (Traccar Client y rastreadores compatibles) solo por HTTPS: Caddy recibe
    `https://track.ganador.nexoru.ai` y lo pasa a `traccar:5055`, que no se publica a internet.
  - Protocolos sin cifrado aceptados en el MVP: **GT06** (puerto 5023), porque la mayoría de los
    rastreadores económicos disponibles en México solo lo soportan. El rastreador envía solo
    IMEI, posición, batería y estado; el dueño solo existe en el servidor.
  - Traccar rechaza dispositivos no registrados en producción (`database.registerUnknown=false`;
    el alta ocurre al vincular, ver contracts/device-ingest.md).
  - **Filtro de plausibilidad** en la ingesta: se descarta una posición si la velocidad implícita
    desde la última posición válida supera 250 km/h o si su hora está más de 5 minutos en el
    futuro. Se registra el descarte para detectar suplantaciones.
  - Al elegir hardware se prefieren modelos con TLS o SIM con APN privada.
- **Retención en Traccar**: se configura para no ser la fuente de verdad; un trabajo diario
  borra en la base de Traccar las posiciones con más de 7 días (FR-011).
- **Alternatives considered**: implementar protocolos de rastreadores desde cero (enorme
  esfuerzo); depender de la nube de una sola marca (viola el principio I).
- **Costo**: Traccar corre en la misma máquina virtual del backend (ver R9).

## R6. Backend propio

- **Decision**: API en **Node.js 24 LTS + TypeScript** con **Fastify**, validación con **Zod**,
  acceso a datos con **Drizzle ORM**, y trabajos en segundo plano con **pg-boss** (colas sobre
  PostgreSQL, sin infraestructura adicional).
- **Rationale**: el mismo lenguaje que la app permite compartir el paquete `domain` (modelo
  neutral, reglas de geocercas y alertas) con pruebas únicas. pg-boss evita pagar un servicio
  de colas a esta escala.
- **Alternatives considered**: funciones serverless (no sirven para Traccar, que necesita puertos
  TCP abiertos permanentemente; separar ambos aumenta costos y latencia); NestJS (más pesado
  para un equipo pequeño).

## R7. Almacenamiento

- **Decision**: **PostgreSQL 16 + PostGIS**, una base `ganador` para el backend y otra `traccar`
  para Traccar, en el mismo servidor. Fotos en almacenamiento de objetos compatible con S3.
- **Volumen estimado**: 5,000 dispositivos × ~300 posiciones/día (cada 60 s en movimiento,
  cada 10–30 min en reposo) ≈ 1.5 M posiciones/día; con retención de 7 días ≈ 10.5 M filas
  (≈ 3–4 GB con índices). Manejable en un solo servidor; la tabla de posiciones se particiona
  por día para borrar particiones completas.
- **Alternatives considered**: base de datos administrada (US$15–60/mes adicionales, se evalúa
  al superar la escala del primer año); TimescaleDB (innecesario a este volumen).
- **Costo**: fotos ≈ 2 fotos × 300 KB por mascota → < 5 GB total: **< US$0.001 / dispositivo /
  mes**.

## R8. Geocercas y alertas (principio VII)

- **Decision**: lógica pura en `packages/domain`, sin E/S, desarrollada con pruebas primero:
  - Zonas como círculos (centro + radio de 50 a 2,000 m) en el MVP; polígonos después.
  - **Histéresis**: salida solo cuando la distancia al borde supera `max(30 m, precisión
    reportada)` fuera de la zona en **2 posiciones consecutivas**, o en 1 si está a más de
    150 m; entrada con la regla simétrica. Evita alertas repetidas en el borde (FR-014).
  - Posiciones con precisión peor que 100 m, duplicadas o más antiguas que la última procesada
    no cambian el estado de la zona.
  - Batería baja: una alerta al cruzar ≤ 20 %; se rearma al superar 25 % (FR-015).
  - **Umbral de señal por dispositivo** (FR-009a): `umbral = intervaloReposo +
    max(5 min, intervaloReposo / 2)`. Ejemplos: 60 s → 6 min; 10 min → 15 min; 30 min → 45 min.
  - **Estado de actividad** (FR-009), calculado en `packages/domain`:
    - `no_signal` si `ahora − lastSeenAt > umbral`;
    - `moving` si la última posición válida tiene velocidad > 1 km/h o se desplazó más de
      `max(30 m, precisión)` respecto de la anterior;
    - `resting` en otro caso (reporta dentro del umbral sin desplazarse).
    - `since` = hora del primer reporte en el estado actual.
  - Pérdida de señal: trabajo cada minuto que marca `no_signal` a los dispositivos que superan
    su umbral; una alerta por episodio, rearmada con el siguiente reporte (FR-016). El estado
    `resting` nunca genera alerta.
- **Rationale**: cumplir < 2 min (SC-002) exige evaluar al recibir cada posición; con reporte
  cada 60 s en movimiento y confirmación en 2 posiciones, el peor caso ≈ 2 min + entrega.
- **Supuesto de hardware**: el rastreador debe reportar al menos cada 60 s en movimiento.
  Rastreadores más lentos no cumplen SC-002 y se marcan como "compatibilidad limitada".

## R9. Infraestructura y hosting

- **Decision**: una máquina virtual (4 vCPU, 8 GB RAM, en un proveedor con región en EE. UU.
  cercana a México) con Docker Compose: Traccar, API, PostgreSQL/PostGIS y Caddy (HTTPS).
  Respaldo diario de PostgreSQL a almacenamiento de objetos. La web estática va en un CDN.
- **Rationale**: Traccar requiere puertos TCP abiertos y procesos permanentes. Una sola máquina
  es suficiente para 5,000 dispositivos y es la opción más económica.
- **Disponibilidad**: objetivo 99.5 % mensual para la API. Monitoreo externo de salud cada
  minuto y alerta al equipo; registros estructurados (JSON) de la API.
- **Alternatives considered**: Kubernetes (excesivo); servidor en México (más caro, latencia
  similar).
- **Costo** (referencia): VM ≈ US$25/mes + respaldos y objetos ≈ US$5/mes = **US$30/mes fijos**
  → **US$0.006 / dispositivo / mes** a 5,000 dispositivos (US$0.06 a 500).

## R10. Notificaciones push

- **Decision**: **Expo Notifications** con el servicio push de Expo (que entrega vía FCM y
  APNs). Se guarda el token de cada dispositivo móvil del usuario.
- **Importante**: desde Expo SDK 53, las notificaciones remotas en Android **no funcionan en
  Expo Go**; se prueban con una *development build* (EAS Build). La vista previa web y Expo Go
  sirven para el resto de las pantallas.
- **Costo**: servicio push de Expo sin costo por mensaje: **US$0 / dispositivo / mes**.

## R11. WhatsApp: alertas de salida y códigos de acceso

- **Decision**: **WhatsApp Business Platform (Cloud API de Meta)** con plantillas aprobadas:
  una de categoría *utilidad* para la alerta de salida de zona y una de *autenticación* para
  el código de acceso. Respaldo de SMS para códigos con un proveedor de SMS (p. ej. Twilio).
  Se accede a través de un puerto `MessagingProvider` para poder cambiar de proveedor.
- **Rationale**: WhatsApp es el canal más usado en México y cuesta menos que el SMS.
- **Consentimiento**: las alertas por WhatsApp se envían solo con aceptación expresa del usuario
  (política de Meta y principio III); se guarda la fecha de aceptación. El código de acceso no
  la requiere porque lo solicita el propio usuario.
- **Costo** (referencia; Meta cobra por mensaje de plantilla entregado según país):
  - Alerta de salida: supuesto de 10 salidas/mes × 1.5 destinatarios × 60 % que aceptan
    WhatsApp × ≈ US$0.01 = **≈ US$0.09 / dispositivo / mes** (techo con 100 % de aceptación:
    US$0.15). Es el costo variable más grande; si crece, se puede
    limitar a una alerta de WhatsApp por episodio de escape.
  - Códigos de acceso: ≈ 1.5 códigos/mes por mascota × ≈ US$0.015 = **≈ US$0.02**; con 10 %
    de respaldo por SMS a ≈ US$0.08 → **+ ≈ US$0.01**. Las sesiones duran 90 días para
    reducir códigos.

## R12. Mapas

- **Decision**: `react-native-maps` (incluido en Expo Go): Google Maps en Android y Apple Maps
  en iOS.
- **Costo**: los SDK de mapas móviles de Google y Apple no cobran por carga de mapa:
  **US$0 / dispositivo / mes**. Requiere clave de API de Google para Android.
- **Alternatives considered**: MapLibre (requiere development build y servidor de teselas).

## R13. Autenticación

- **Decision**: registro e inicio de sesión con número de celular + código de 6 dígitos (R11).
  La API emite un token de acceso corto (15 min) y un token de renovación de 90 días, guardado
  en `expo-secure-store`. Límite de 5 códigos por número por hora y 5 intentos por código.
- **Rationale**: FR-001 y la aclaración de la spec.

## R14. Internacionalización (principio IV)

- **Decision**: `i18next` + `react-i18next` + `expo-localization`, con `es-MX` como idioma
  base y archivos de traducción por idioma. Una regla de lint prohíbe textos literales en JSX.
  Fechas y números con `Intl` en la configuración regional.

## R15. Pruebas

- **Decision**: **Vitest** para `packages/domain` y la API (unitarias, de contrato e
  integración con PostgreSQL en contenedor); **Jest + jest-expo + React Native Testing
  Library** para la app; **Lighthouse CI** para el presupuesto de la página pública.
- **Rationale**: principio VII (pruebas primero en alertas y geocercas) y principio V
  (presupuesto de rendimiento medido).

## R16. Datos personales y retención (principio III)

- **Decision**:
  - Aviso de privacidad versionado; se guarda la versión aceptada y la fecha (FR-002).
  - Posiciones: se borran a los 7 días (FR-011).
  - Consultas de placa: solo placa y hora, sin IP ni ubicación (FR-024a); se borran a los 90
    días. Los registros del servidor web no guardan la IP en la ruta `/public/*`.
  - **Límite por origen en la página pública**: además del límite por código, 60 peticiones
    por minuto por origen. La clave es un HMAC de la IP con un secreto aleatorio que se genera
    al arrancar el proceso y se rota cada 24 h, **solo en memoria**; los contadores viven en
    memoria con expiración de 1 minuto. La IP ni su HMAC se escriben en base de datos, registros
    ni respaldos. Con varias instancias el límite es por instancia, aceptable a esta escala.
  - Eliminación de cuenta: borrado de datos personales en ≤ 24 h, placas quedan inactivas.
  - Cifrado en tránsito (HTTPS/TLS) y en reposo (disco cifrado y respaldos cifrados); desde
    el hardware, según R5.
  - Fotos: se eliminan los metadatos (EXIF, XMP, IPTC, incluida la ubicación GPS) al subirlas.
  - Invitaciones sin aceptar: se borran a los 30 días con el número invitado.
  - Aviso de privacidad integral versionado en `apps/api/src/privacy/notices/`, con revisión de
    un asesor legal antes de producción; derechos ARCO desde la app (exportar datos, editar,
    eliminar cuenta, oponerse) y por correo para lo demás (FR-003a).
  - La dirección del domicilio no existe en el modelo de datos.

## R17. Medición de tiempos en producción (SC-001, SC-003)

- **Decision**: la app envía el tiempo desde que se abre hasta que el mapa muestra la ubicación
  (`owner_map_visible`) y la página pública el tiempo hasta que el botón de WhatsApp es visible
  (`public_contact_visible`) a `POST /telemetry/timings`. Solo métrica, milisegundos y
  plataforma; se guardan conteos diarios por rango para calcular el percentil 95.
- **Rationale**: SC-001 y SC-003 hablan del 95 % de los casos reales; Lighthouse y la prueba de
  carga solo cubren el laboratorio. Sin identificadores ni IP, respeta FR-024a y el principio III.
- **Alternatives considered**: servicios de analítica de terceros (envían datos del visitante a
  otra empresa y agregan costo).

---

## Costo mensual por dispositivo activo (resumen)

Escala de referencia: 5,000 rastreadores activos. Precios de referencia por verificar.

| Concepto | Costo / dispositivo / mes |
|----------|---------------------------|
| Servidor (Traccar + API + BD) y respaldos | US$0.006 |
| Web estática (CDN) | US$0.000 |
| Notificaciones push (Expo) | US$0.000 |
| Mapas móviles | US$0.000 |
| Fotos | < US$0.001 |
| WhatsApp: alertas de salida de zona (60 % de aceptación) | ≈ US$0.090 |
| WhatsApp/SMS: códigos de acceso | ≈ US$0.030 |
| Medición de tiempos | US$0.000 (mismo servidor) |
| **Total** | **≈ US$0.13** (techo ≈ US$0.19) |

**Costos fijos fuera de la tabla**: cuenta de Apple Developer (US$99/año), Google Play
(US$25 una vez), dominio (≈ US$15/año), EAS Build en plan gratuito.

**No incluido**: el plan de datos (SIM) del rastreador lo paga el dueño en el MVP. Si en el
futuro la plataforma lo incluye, sería el costo dominante (típicamente US$1–3 por SIM IoT al
mes) y debe agregarse a esta tabla.
