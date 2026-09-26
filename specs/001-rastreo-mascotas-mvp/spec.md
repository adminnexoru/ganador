# Feature Specification: Rastreo y recuperación de mascotas (MVP)

**Feature Branch**: `001-rastreo-mascotas-mvp`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Aplicación para que dueños de mascotas en México sepan dónde está su
mascota, reciban avisos si se sale de una zona segura y puedan recuperarla si se extravía. App
móvil para Android e iOS, más una página web pública para quien encuentre a una mascota
extraviada." (descripción completa en el historial de la solicitud)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver dónde está mi mascota (Priority: P1)

El dueño crea su cuenta, da de alta a su mascota, vincula un rastreador y, al abrir la app, ve
en un mapa la última ubicación conocida con la hora de actualización y el nivel de batería.

**Why this priority**: es la función central del producto (función crítica según la
constitución). Sin ella no hay rastreo.

**Independent Test**: registrar una cuenta, dar de alta una mascota, vincular un rastreador y
confirmar que la ubicación, la hora y la batería aparecen en el mapa.

**Acceptance Scenarios**:

1. **Given** un dueño sin cuenta, **When** se registra y acepta el aviso de privacidad,
   **Then** su cuenta queda creada y puede dar de alta mascotas.
2. **Given** un dueño con cuenta, **When** da de alta una mascota con foto, nombre, especie
   (perro o gato), raza, tamaño, enfermedades y medicamentos, **Then** la mascota aparece en su
   lista.
3. **Given** una mascota sin rastreador, **When** el dueño vincula un rastreador compatible,
   **Then** la mascota muestra su ubicación en cuanto el rastreador reporta.
4. **Given** una mascota con rastreador vinculado, **When** el dueño abre la app, **Then** ve en
   el mapa la última ubicación conocida, la hora de esa ubicación y el nivel de batería.
5. **Given** que la última ubicación tiene más de 30 minutos, **When** el dueño la consulta,
   **Then** la app indica claramente que la ubicación no está actualizada y desde cuándo.

---

### User Story 2 - Recuperación con la placa NFC/QR (Priority: P1)

Quien encuentra a una mascota extraviada acerca su celular a la placa o escanea el código QR,
ve una página con los datos que el dueño decidió mostrar y lo contacta con un solo toque. El
dueño recibe una notificación de cada consulta.

**Why this priority**: función crítica; funciona incluso sin rastreador o si el rastreador se
quedó sin batería.

**Independent Test**: vincular una placa a una mascota, escanearla desde un celular sin la app y
sin sesión, y confirmar que se muestran los datos autorizados y que llamar o enviar WhatsApp
funciona; confirmar que el dueño recibe la notificación.

**Acceptance Scenarios**:

1. **Given** una placa sin vincular, **When** el dueño la escanea desde la app, **Then** la placa
   queda vinculada a la mascota elegida.
2. **Given** una placa vinculada, **When** cualquier persona la acerca o escanea su QR, **Then**
   se abre en el navegador una página pública sin inicio de sesión ni instalación.
3. **Given** la página pública abierta, **Then** muestra la foto y el nombre de la mascota y solo
   los datos del dueño y de salud que el dueño autorizó; nunca la dirección del domicilio.
4. **Given** la página pública abierta, **When** la persona toca "Llamar" o "WhatsApp", **Then**
   se inicia la llamada o se abre una conversación de WhatsApp con el dueño y un mensaje
   prellenado que menciona a la mascota.
5. **Given** que alguien abre la página pública, **When** permite compartir su ubicación,
   **Then** el dueño recibe una notificación con la ubicación aproximada; si no lo permite,
   recibe la notificación sin ubicación.
6. **Given** una placa sin vincular o desvinculada, **When** alguien la escanea, **Then** ve un
   mensaje de que la placa no está activa, sin datos personales.

---

### User Story 3 - Alertas de zona segura y batería baja (Priority: P1)

El dueño define zonas seguras (por ejemplo, casa o parque) y recibe una notificación cuando la
mascota sale o entra de una zona, y cuando la batería del rastreador está baja.

**Why this priority**: la alerta de escape y la batería baja son funciones críticas; avisan
antes de que el dueño note la ausencia.

**Independent Test**: crear una zona, simular posiciones dentro y fuera de ella y posiciones con
batería baja; confirmar que llegan las notificaciones correctas, sin duplicados.

**Acceptance Scenarios**:

1. **Given** una mascota con rastreador, **When** el dueño dibuja una zona en el mapa y le pone
   nombre, **Then** la zona queda guardada y activa.
2. **Given** una mascota dentro de una zona, **When** el rastreador reporta una posición fuera de
   ella, **Then** el dueño recibe una alerta de salida en menos de 2 minutos desde ese reporte.
3. **Given** una mascota fuera de una zona, **When** vuelve a entrar, **Then** el dueño recibe
   una notificación de entrada.
4. **Given** posiciones imprecisas cerca del borde de la zona, **When** la mascota no se ha
   alejado realmente, **Then** no se envían alertas repetidas de salida y entrada.
5. **Given** un rastreador con batería por encima del umbral, **When** baja al 20 % o menos,
   **Then** el dueño recibe un solo aviso de batería baja hasta que el rastreador se recargue.
6. **Given** un rastreador que deja de reportar por más de 30 minutos, **Then** el dueño recibe
   un aviso de pérdida de señal.

---

### User Story 4 - Historial de recorridos (Priority: P2)

El dueño consulta los recorridos de su mascota de los últimos 7 días, día por día.

**Why this priority**: valor agregado útil para entender rutinas y buscar a una mascota, pero no
es indispensable para localizarla ahora.

**Independent Test**: con posiciones registradas en varios días, elegir un día y ver el
recorrido en orden cronológico.

**Acceptance Scenarios**:

1. **Given** posiciones de los últimos 7 días, **When** el dueño elige un día, **Then** ve el
   recorrido en el mapa con las horas de cada punto.
2. **Given** posiciones con más de 7 días, **Then** ya no están disponibles para el dueño.

---

### User Story 5 - Compartir la mascota con la familia (Priority: P2)

El dueño invita a otros miembros de la familia para que también vean la mascota y reciban sus
alertas.

**Why this priority**: valor agregado; aumenta las probabilidades de reaccionar a una alerta,
pero el producto funciona con un solo dueño.

**Independent Test**: invitar a otra persona, que acepte, confirmar que ve la mascota y recibe
alertas; revocar el acceso y confirmar que deja de verla.

**Acceptance Scenarios**:

1. **Given** un dueño, **When** invita a una persona por teléfono o correo, **Then** la persona
   recibe una invitación y, al aceptarla con su propia cuenta, ve la mascota.
2. **Given** un familiar con acceso, **Then** puede ver la ubicación y el historial y recibir las
   alertas, pero no puede editar la mascota, las zonas, la página pública, la placa ni los
   accesos.
3. **Given** un familiar con acceso, **When** el dueño revoca el acceso, **Then** el familiar deja
   de ver la mascota y de recibir alertas de inmediato.

---

### Edge Cases

- El rastreador no tiene señal o está apagado: la app muestra la última ubicación con su
  antigüedad y el aviso de pérdida de señal.
- El rastreador reporta posiciones duplicadas, fuera de orden o con mucha imprecisión: no
  generan alertas falsas ni recorridos erróneos.
- El celular del dueño no tiene conexión: la app muestra la última información descargada e
  indica que no está actualizada.
- Un rastreador que ya está vinculado a otra mascota: no puede vincularse a una segunda hasta
  desvincularse.
- Una placa perdida o robada: el dueño puede desvincularla y deja de mostrar datos.
- Muchas consultas seguidas a la misma página pública: se agrupan las notificaciones al dueño
  para no saturarlo, sin perder el registro de cada consulta.
- Quien encuentra a la mascota no tiene WhatsApp: el botón de llamada sigue disponible.
- El dueño oculta todos sus medios de contacto: la app le impide guardar esa configuración,
  porque la página pública debe mostrar al menos un medio de contacto.
- El dueño elimina su cuenta: se eliminan sus datos personales y sus placas quedan inactivas.

## Requirements *(mandatory)*

### Functional Requirements

**Cuenta y privacidad**

- **FR-001**: Los dueños DEBEN poder crear una cuenta verificando su correo o número de celular.
- **FR-002**: El sistema DEBE mostrar el aviso de privacidad y obtener consentimiento explícito
  antes de recolectar datos personales, y registrar la fecha y versión aceptada.
- **FR-003**: Los dueños DEBEN poder revocar su consentimiento y eliminar su cuenta y sus datos.
- **FR-004**: Toda la interfaz de la app y de la página pública DEBE estar en español de México.

**Mascotas y dispositivos**

- **FR-005**: Los dueños DEBEN poder dar de alta, editar y eliminar una o más mascotas con foto,
  nombre, especie (perro o gato), raza, tamaño, enfermedades y medicamentos.
- **FR-006**: Los dueños DEBEN poder vincular y desvincular un rastreador por mascota.
- **FR-007**: El sistema DEBE aceptar rastreadores de distintas marcas sin que las funciones de
  la app cambien según la marca.

**Ubicación e historial**

- **FR-008**: La app DEBE mostrar en un mapa la última ubicación conocida de cada mascota con su
  hora y el nivel de batería del rastreador.
- **FR-009**: La app DEBE indicar cuándo la ubicación mostrada tiene más de 30 minutos.
- **FR-010**: Los dueños DEBEN poder consultar el recorrido de cualquiera de los últimos 7 días.
- **FR-011**: El sistema DEBE eliminar las posiciones con más de 7 días.

**Zonas seguras y alertas**

- **FR-012**: Los dueños DEBEN poder crear, nombrar, editar y eliminar zonas seguras por mascota.
- **FR-013**: El sistema DEBE notificar la salida y la entrada de una mascota en una zona en
  menos de 2 minutos desde que el rastreador reporta la posición.
- **FR-014**: El sistema NO DEBE enviar alertas repetidas de salida y entrada causadas por la
  imprecisión de la posición cerca del borde de la zona.
- **FR-015**: El sistema DEBE avisar una vez cuando la batería llegue al 20 % o menos, y no
  volver a avisar hasta que se recargue por encima de ese nivel.
- **FR-016**: El sistema DEBE avisar cuando un rastreador deje de reportar por más de 30 minutos.

**Compartir con la familia**

- **FR-017**: Los dueños DEBEN poder invitar a otras personas a una mascota y revocar su acceso.
- **FR-018**: Los familiares con acceso DEBEN poder ver la ubicación y el historial y recibir las
  alertas de la mascota, y NO DEBEN poder editar la mascota, las zonas seguras, la página
  pública, la placa ni los accesos; esas acciones son exclusivas del dueño.

**Placa NFC/QR y página pública**

- **FR-019**: Los dueños DEBEN poder vincular a cada mascota una placa con NFC y QR, y
  desvincularla.
- **FR-020**: Leer la placa por NFC o QR DEBE abrir la página pública en el navegador sin inicio
  de sesión ni instalación.
- **FR-021**: La página pública DEBE mostrar la foto y el nombre de la mascota, y los datos que
  el dueño autorizó entre: nombre del dueño, teléfono, enfermedades y medicamentos.
- **FR-022**: La página pública NUNCA DEBE mostrar la dirección del domicilio.
- **FR-023**: La página pública DEBE mostrar al menos un medio de contacto y ofrecer llamar o
  enviar WhatsApp al dueño con un solo toque.
- **FR-024**: El sistema DEBE notificar al dueño cada consulta a la página pública, con la
  ubicación aproximada solo si quien consulta da permiso.
- **FR-025**: La página pública DEBE estar disponible siempre que la placa esté vinculada,
  mostrando los datos autorizados por el dueño, sin requerir que la mascota se marque como
  extraviada.
- **FR-026**: Una placa sin vincular DEBE mostrar un mensaje de placa inactiva sin datos
  personales.

### Key Entities *(include if feature involves data)*

- **Dueño**: persona con cuenta; datos de contacto, consentimiento de privacidad.
- **Mascota**: foto, nombre, especie, raza, tamaño, enfermedades, medicamentos; pertenece a un
  dueño y puede compartirse con familiares.
- **Acceso compartido**: relación entre una mascota y un familiar invitado, con estado
  (invitado, activo, revocado).
- **Dispositivo**: rastreador vinculado a una mascota, independiente de la marca.
- **Posición**: ubicación reportada por un dispositivo, con hora y precisión; se conserva 7 días.
- **Evento**: suceso relevante (salida o entrada de zona, batería baja, pérdida de señal,
  consulta de la placa) que puede generar una notificación.
- **Batería**: nivel reportado por el dispositivo y su hora.
- **Zona segura**: área con nombre asociada a una mascota.
- **Placa**: identificador único con NFC y QR, vinculable a una mascota.
- **Configuración de página pública**: qué datos autorizó mostrar el dueño.
- **Consulta de placa**: registro de cada apertura de la página pública, con hora y ubicación
  aproximada opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño ve la ubicación de su mascota en menos de 10 segundos desde que abre la
  app, en el 95 % de los casos con conexión móvil.
- **SC-002**: El 95 % de las alertas de salida de zona llegan al dueño en menos de 2 minutos
  desde que el rastreador reporta la posición.
- **SC-003**: Quien escanea la placa ve los datos de contacto en menos de 5 segundos en una
  conexión móvil típica, en el 95 % de los casos.
- **SC-004**: Menos del 5 % de las alertas de zona son falsas (la mascota no salió realmente).
- **SC-005**: El 90 % de los dueños nuevos completan registro, alta de mascota y vinculación de
  rastreador en menos de 10 minutos sin ayuda.
- **SC-006**: Ninguna página pública muestra datos no autorizados por el dueño ni la dirección
  del domicilio.

## Clarifications

### Session 2026-09-25

- Q: ¿Qué puede hacer un familiar invitado? → A: Solo ver ubicación, historial y recibir
  alertas; editar es exclusivo del dueño.
- Q: ¿Cuándo está activa la página pública? → A: Siempre, mientras la placa esté vinculada.

## Assumptions

- La app para dueños se usa en celulares Android e iOS; la página pública abre en cualquier
  navegador móvil actual.
- Los rastreadores y las placas se adquieren por fuera de la app (la tienda está fuera de
  alcance); en el MVP se integra al menos un modelo de rastreador.
- El rastreador reporta su posición con la frecuencia necesaria para cumplir la alerta de 2
  minutos; la frecuencia exacta depende del dispositivo.
- Las placas vienen con un identificador único de fábrica que el dueño activa desde la app.
- Umbrales por defecto: batería baja al 20 %, ubicación desactualizada y pérdida de señal a los
  30 minutos.
- El inglés no se habilita en el MVP, pero la interfaz queda preparada para agregarlo.
- Fuera de alcance: pagos y suscripciones, monitoreo de salud, tienda de dispositivos.
- Las enfermedades y medicamentos son de la mascota, no del dueño, pero solo se muestran si el
  dueño lo autoriza.
