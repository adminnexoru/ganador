# Constitución de Ganador

## Core Principles

### I. Independencia de hardware

- Ninguna funcionalidad de la app PUEDE depender de una marca o modelo específico de tracker.
- Todo dispositivo DEBE integrarse mediante un adaptador que traduzca sus datos a un modelo
  interno neutral compuesto por: **dispositivo**, **posición**, **evento** y **batería**.
- La lógica de negocio, la interfaz y el almacenamiento DEBEN operar exclusivamente sobre el
  modelo neutral; los formatos, protocolos o identificadores propios del fabricante NO DEBEN
  salir del adaptador.
- Agregar o retirar un modelo de tracker DEBE requerir solo crear o eliminar su adaptador, sin
  cambios en el resto del sistema.

**Justificación**: evita quedar atados a un proveedor, permite cambiar de hardware por costo o
disponibilidad y mantiene la app estable cuando un fabricante cambia o desaparece.

### II. Mascota primero

- Las funciones críticas son: **ubicación actual**, **alerta de escape** (salida de geocerca),
  **alerta de batería baja** y **recuperación mediante la placa NFC/QR**.
- Las funciones críticas DEBEN tener prioridad en la planeación, el desarrollo, las pruebas y la
  atención de incidentes sobre cualquier función de valor agregado.
- Ninguna función de valor agregado PUEDE liberarse si degrada, bloquea o retrasa una función
  crítica.
- Cada especificación DEBE declarar si la funcionalidad es crítica o de valor agregado.

**Justificación**: el valor central del producto es encontrar a una mascota perdida; todo lo
demás es secundario.

### III. Privacidad por diseño (LFPDPPP)

- El sistema DEBE cumplir la Ley Federal de Protección de Datos Personales en Posesión de los
  Particulares (LFPDPPP).
- Los datos de ubicación y de contacto se tratan como datos personales del dueño.
- Antes de recolectar datos personales, el dueño DEBE recibir el aviso de privacidad y otorgar
  consentimiento explícito; el consentimiento DEBE registrarse y poder revocarse.
- El dueño decide qué datos se muestran en la página pública de su mascota; por defecto se
  muestra el mínimo necesario para contactarlo.
- La dirección del domicilio NUNCA se publica, bajo ninguna configuración.
- Cada especificación que maneje datos personales DEBE identificar qué datos usa, con qué
  finalidad y quién puede verlos.

**Justificación**: la ubicación de una mascota revela la ubicación y rutinas de su dueño; su
exposición implica riesgos reales de seguridad y obligaciones legales.

### IV. Español primero, bilingüe por diseño

- Toda la interfaz DEBE estar disponible en español de México (es-MX) como idioma principal.
- Ningún texto visible al usuario PUEDE escribirse directamente en el código; todo texto DEBE
  pasar por el sistema de internacionalización para permitir agregar inglés sin reescribir
  pantallas.
- Fechas, horas, números, unidades y moneda DEBEN formatearse según la configuración regional.

**Justificación**: el mercado inicial es México; preparar la internacionalización desde el
inicio evita un costoso retrabajo al expandirse.

### V. Móvil primero y placa pública ligera

- La experiencia principal del dueño es la app en el celular; los flujos DEBEN diseñarse
  primero para pantalla móvil.
- La página pública de la placa NFC/QR es crítica y DEBE:
  - abrir sin inicio de sesión ni instalación de apps;
  - cargar rápido en redes móviles lentas, con presupuesto de rendimiento definido y medido;
  - funcionar en los navegadores móviles comunes.

**Justificación**: quien encuentra a una mascota perdida no tiene la app ni tiempo; cualquier
fricción reduce la probabilidad de que contacte al dueño.

### VI. Costos operativos visibles

- Toda decisión técnica (servicios en la nube, conectividad, mapas, notificaciones, SMS,
  almacenamiento, proveedores de hardware) DEBE documentar su costo mensual estimado por
  dispositivo activo.
- Los planes de implementación DEBEN incluir este costo y sus supuestos (volumen, frecuencia de
  reportes, precios de referencia y fecha de consulta).
- Una decisión que aumente el costo por dispositivo activo DEBE justificar el beneficio frente a
  la alternativa más económica.

**Justificación**: el modelo de negocio depende del margen por dispositivo; los costos que no se
miden crecen sin control.

### VII. Pruebas antes de código en alertas y geocercas (NO NEGOCIABLE)

- Toda lógica de alertas (escape, batería baja, pérdida de señal y similares) y de geocercas
  DEBE desarrollarse con pruebas primero: se escriben las pruebas, se confirma que fallan y
  después se implementa.
- Las pruebas DEBEN cubrir casos límite: posiciones en el borde de la geocerca, imprecisión del
  GPS, datos tardíos o duplicados, pérdida de conexión y alertas repetidas.
- No se integra ningún cambio a esta lógica sin pruebas que lo cubran.

**Justificación**: un falso negativo significa una mascota perdida sin aviso; un exceso de
falsos positivos hace que el dueño ignore las alertas.

### VIII. Un solo código base

- Android, iOS y web DEBEN construirse desde el mismo proyecto y código base.
- No se permiten desarrollos paralelos por plataforma, salvo que una función nativa lo exija.
- Toda excepción DEBE quedar justificada por escrito en el plan de la funcionalidad,
  aislada detrás de una interfaz común y limitada al mínimo código específico de plataforma.

**Justificación**: un equipo pequeño no puede mantener tres implementaciones; un solo código
base mantiene paridad de funciones y reduce costos.

## Restricciones técnicas y de cumplimiento

- **Modelo neutral**: las entidades dispositivo, posición, evento y batería son el contrato
  interno del sistema; cambios a ese contrato requieren revisión explícita.
- **Datos personales**: todo almacenamiento o transmisión de ubicación y contacto DEBE estar
  protegido en tránsito y en reposo, con acceso limitado al dueño y a los procesos que lo
  requieran.
- **Página pública**: solo muestra los campos que el dueño autorizó; la dirección del domicilio
  está excluida del modelo de datos público.
- **Internacionalización**: es-MX obligatorio; inglés preparado estructuralmente.
- **Costos**: cada dependencia externa registra su costo por dispositivo activo.

## Flujo de desarrollo y compuertas de calidad

- Toda especificación DEBE indicar: si la funcionalidad es crítica o de valor agregado, qué
  datos personales maneja y si toca la integración con hardware.
- Todo plan de implementación DEBE incluir una verificación de cumplimiento con esta
  constitución, la estimación de costo mensual por dispositivo activo y, si aplica, la
  justificación de código específico de plataforma.
- Toda revisión de código DEBE verificar:
  - que no haya dependencias de un tracker fuera de su adaptador;
  - que no haya textos de interfaz fuera del sistema de internacionalización;
  - que la lógica de alertas y geocercas tenga pruebas escritas antes de la implementación;
  - que no se exponga la dirección del domicilio ni datos no autorizados por el dueño.
- Los cambios a la página pública de la placa DEBEN verificar su presupuesto de rendimiento en
  condiciones de red móvil.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o guía del proyecto.
- Las enmiendas DEBEN documentarse, incluir su justificación y un plan de migración cuando
  afecten trabajo existente.
- Versionado semántico:
  - **MAJOR**: eliminación o redefinición incompatible de un principio o regla de gobernanza.
  - **MINOR**: nuevo principio o sección, o ampliación material de una guía existente.
  - **PATCH**: aclaraciones, redacción o correcciones sin cambio de significado.
- Toda especificación, plan y revisión DEBE verificar el cumplimiento; cualquier desviación DEBE
  justificarse por escrito y aprobarse antes de integrarse.
- El cumplimiento se revisa al menos en cada nueva funcionalidad y al cambiar de proveedor de
  hardware o de infraestructura.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
