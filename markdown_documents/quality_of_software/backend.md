# Documentación y Aseguramiento de Calidad del Backend (AROS PACS)

Este documento centraliza la revisión, validación de calidad y documentación de cada módulo del backend. Su propósito es actuar como la "fuente de la verdad" técnica para garantizar que el software sea robusto, seguro y escalable, manteniendo los más altos estándares de calidad antes, durante y después del desarrollo de nuevas funcionalidades.

---

## 1. Módulos de Modelos de Datos (`models.py`)

La base de datos es la columna vertebral de la aplicación. Aquí validamos que los modelos estén optimizados, normalizados, cuenten con índices apropiados y manejen la seguridad correctamente (por ejemplo, enmascaramiento de PII/PHI).

### 1.1 Core API (`apps/core-api/identity/models.py`)

Estos modelos son responsables de la identidad global, orquestación, gestión de clínicas y federación de permisos. No almacenan datos de salud protegidos (PHI), garantizando la separación de preocupaciones y el cumplimiento normativo.

**Modelos:**

1.  **`User` (AbstractBaseUser, PermissionsMixin)**
    *   **Propósito:** Proveedor de Identidad Global AROS.
    *   **Seguridad:** Implementa la filosofía de Zero Trust. Utiliza Argon2 para el hasheo de contraseñas.
    *   **Privacidad:** El correo electrónico no se almacena en texto plano. Se guarda un hash determinista (`email_hash`) para búsquedas exactas (login) y una versión encriptada asimétricamente vía KMS (`email_encrypted`) que solo se desencripta cuando es estrictamente necesario enviar una comunicación.
    *   **PK:** Utiliza `UUIDField` como clave primaria para dificultar la enumeración.
    *   **Calidad:** Excelente separación de seguridad. Cumple con normativas de privacidad avanzadas.

2.  **`ClinicRegistry`**
    *   **Propósito:** Registro central de todas las clínicas autorizadas en la red AROS.
    *   **Campos Clave:**
        *   `slug`: Identificador único y PK.
        *   `public_key`: Almacena la llave pública de la clínica para validación de tokens S2S JWT.
        *   `webhook_secret`: Secreto compartido para validar webhooks mediante HMAC SHA-256.
        *   `api_url`: URL de la clínica para enrutamiento dinámico y seguro en peticiones federadas.
    *   **Calidad:** Diseño sólido para una arquitectura distribuida. Centraliza la criptografía (llaves y secretos) requerida para establecer confianza entre servicios.

3.  **`Roles`**
    *   **Propósito:** Definición de roles globales (RBAC).
    *   **Campos:** `name`, `description`.
    *   **Calidad:** Diseño simple y extensible para el control de acceso basado en roles.

4.  **`FederationIDMap`**
    *   **Propósito:** Mapea el ID de un usuario global (AROS) al ID de un paciente local en una clínica específica.
    *   **Relaciones:** FK a `User` y FK a `ClinicRegistry`.
    *   **Optimizaciones:** Implementa `unique_together = ('user', 'clinic')` para evitar duplicidad y define un índice `idx_federation_user_clinic` para acelerar los mapeos.
    *   **Calidad:** Crucial para la federación de datos. Las restricciones e índices están correctamente definidos.

5.  **`ConsentRecord`**
    *   **Propósito:** Registro de consentimiento HIPAA por clínica. Documenta si un usuario ha otorgado permiso para que se acceda a su PHI en una clínica dada.
    *   **Mecanismos:** Incluye un booleano `has_consent` y fechas `granted_at` y `revoked_at` para mantener un historial de auditoría claro sobre el estado del consentimiento.
    *   **Optimizaciones:** `unique_together` e índice sobre `user` y `clinic`.
    *   **Calidad:** Fundamental para el cumplimiento HIPAA y auditoría.

---

### 1.2 Clinic API (`apps/clinic-api/clinical_data/models.py`)

Estos modelos residen en las instancias locales de cada clínica (desplegadas y aisladas). Aquí es donde se almacena la información médica protegida (PHI).

**Modelos:**

1.  **`PatientProfile`**
    *   **Propósito:** Almacena los datos PHI del paciente a nivel local.
    *   **Campos Clave:** `first_name`, `last_name`, `dob`, `gender`, `address`, `phone`.
    *   **Federación:** Define `patient_id` como un identificador externo para la federación entre clínicas (ej. CURP, MRN), garantizando que las búsquedas federadas utilicen un ID estándar sin exponer la PK local (`id_patient`).
    *   **Calidad:** Atributos estándar cubiertos. La adición de `patient_id` asegura una integración limpia con la `FederationIDMap` del Core API.

2.  **`StudyRequest`**
    *   **Propósito:** Registro de una orden/solicitud de estudio generada localmente.
    *   **Relaciones:** FK a `PatientProfile`.
    *   **Optimizaciones:** Índice definido en `accession_number` (`idx_studyreq_accession`), lo cual es una mejor práctica en sistemas PACS ya que el accession number se usa intensamente para búsquedas y cruce de datos con HL7/DICOM.
    *   **Calidad:** Diseño eficiente y correctamente indexado.

3.  **`Report`**
    *   **Propósito:** Almacena los informes radiológicos.
    *   **Campos:** `status`, `findings`, `conclusions`, `date`.
    *   **Calidad:** Modelo directo y necesario para la interpretación clínica.

4.  **`Study`**
    *   **Propósito:** Representa un estudio DICOM concreto recibido del nodo Orthanc local.
    *   **Campos Clave:** `study_uid` (DICOM StudyInstanceUID), `pacs_url`, `study_description`, `modality`.
    *   **Relaciones:** FKs a `PatientProfile`, `StudyRequest` y `Report`.
    *   **Optimizaciones:** Índice compuesto `idx_study_patient_date` (`patient`, `study_date`). Este es un índice altamente optimizado, ideal para la vista principal del portal del paciente/médico, donde típicamente se consultan estudios por paciente ordenados por fecha.
    *   **Calidad:** Excelente alineación con los estándares DICOM. Las foreign keys y el índice garantizan tiempos de respuesta rápidos en consultas comunes.

---

## 2. Resumen de Calidad (Modelos)

*   **Aislamiento y Privacidad:** Aprobado. La separación entre el `Core API` (sin PHI) y el `Clinic API` (con PHI) es estricta y se respeta en los modelos.
*   **Integridad Referencial y Restricciones:** Aprobado. Uso extensivo de FKs, `unique_together` y atributos `unique=True` previene inconsistencias.
*   **Rendimiento (Índices):** Aprobado. Las consultas críticas (búsquedas por ID federado, búsquedas de estudios por paciente/fecha, y búsquedas por accession number) tienen índices dedicados.
*   **Seguridad y Auditoría:** Aprobado. El manejo de emails (Zero Trust con Argon2 y KMS) y los registros de revocación de consentimiento (`revoked_at`) demuestran una madurez técnica y alineación con HIPAA.

---

## 3. Vistas y Controladores (`views.py`)

Las vistas actúan como el puente entre la base de datos y la red. Aquí verificamos el manejo de concurrencia, uso eficiente de memoria RAM y control de acceso federado.

### 3.1 Core API (Gateway Federated Routing)

1.  **`FederatedStudiesView` (`gateway/views/federated.py`)**
    *   **Propósito:** Interroga de forma simultánea a múltiples clínicas (fan-out) para consolidar los estudios de un paciente.
    *   **Concurrencia:** Utiliza `asyncio.gather` para lanzar las peticiones HTTP concurrentemente. Las lecturas a la base de datos (ORM) se envuelven correctamente en `sync_to_async` para no bloquear el Event Loop.
    *   **Resiliencia:** Cada llamada a una clínica local está protegida por un **Circuit Breaker** (`pybreaker`). Esto garantiza que si una clínica está fuera de línea, el Core API cortocircuita las llamadas y no agota sus hilos por culpa de Timeouts (previniendo caídas en cascada).
    *   **Validación:** Cruza los datos de `FederationIDMap` verificando estrictamente que exista un `ConsentRecord` con `has_consent=True` antes de consultar cualquier clínica.
    *   **Historial Parcial:** Si una clínica falla, no se devuelve un Error 500. La vista captura el error y responde con un `HTTP 206 Partial Content`, indicando `partial_history: true` y listando las fuentes inalcanzables.
    *   **Calidad:** Altamente resiliente. Implementación magistral del patrón arquitectónico *Scatter-Gather / API Gateway*.

2.  **`WadoRsProxyView` (`gateway/views/proxy.py`)**
    *   **Propósito:** Actúa como Reverse Proxy autenticado para transferir archivos DICOM muy pesados (gigabytes) desde Orthanc hasta el frontend OHIF Viewer.
    *   **Manejo de Memoria:** Utiliza `httpx.stream()` combinado con `StreamingHttpResponse` de Django para procesar los datos en "chunks" de 64KB. **Tiene Cero Buffering en memoria RAM**.
    *   **Seguridad:** Verifica mapeo en `FederationIDMap` antes de iniciar el streaming. Genera un token JWT S2S al vuelo, resuelto dinámicamente con `clinic.api_url`.
    *   **Calidad:** Crítico para evitar caídas de servidor por OOM (Out Of Memory) durante la visualización de Tomografías/Resonancias.

### 3.2 Clinic API (Internal Endpoints)

1.  **`ClinicalStudiesView` (`clinical_data/views/studies.py`)**
    *   **Propósito:** Expone el catálogo local de estudios de un paciente a las consultas federadas del Core.
    *   **Seguridad:** Restringido por la clase `IsAuthenticated`, que mediante el `S2SAuthentication` exige un JWT válido firmado por la llave privada del Core API.
    *   **Privacidad:** Filtra los registros utilizando exclusivamente el campo externo `patient__patient_id` (CURP/MRN), evitando exponer el ID Autonumérico real de la base local.
    *   **Optimizaciones:** Implementa el método `.values()` del QuerySet para devolver un diccionario de datos plano, evitando instanciar los costosos objetos completos del ORM de Django cuando solo se requiere enviar un JSON.
    *   **Calidad:** Vista ligera, extremadamente rápida y segura.

---

## 4. Seguridad y Autenticación

El diseño de seguridad de AROS PACS implementa el paradigma **Zero Trust** (Confianza Cero). Ningún servicio confía ciegamente en otro; cada petición debe probar criptográficamente su origen e integridad.

### 4.1 Autenticación Server-to-Server (S2S JWT)

1.  **`S2SAuthentication` (`clinical_data/authentication.py`)**
    *   **Propósito:** Interceptar todas las llamadas que entran a la Clinic API (desde el Core API) y validar su autenticidad.
    *   **Implementación Lazy:** Utiliza un Singleton con instanciación diferida (Lazy Loading) del cliente JWKS (`_jwks_client`). Esto es **crítico para la estabilidad**: asegura que si el Core API (quien sirve las llaves) está temporalmente caído durante el reinicio de una clínica, el servicio de la clínica no haga un "crash loop" al arrancar.
    *   **Validación Estricta:** Revisa matemáticamente que el JWT:
        *   Tenga la firma RS256 válida (descargada del JWKS).
        *   Tenga `issuer="aros-core"`.
        *   Tenga `audience="clinic-{slug}"` (evita ataques donde un token robado de la clínica A se use en la clínica B).
        *   Tenga `type="s2s"` (previene que un JWT de sesión normal de un usuario se intente usar como token de servidor).

2.  **`generate_s2s_jwt` (`gateway/s2s_auth.py`)**
    *   **Propósito:** Firmar peticiones salientes desde el Core API.
    *   **Seguridad:** El token emitido tiene una caducidad ultracorta (5 minutos), reduciendo drásticamente la ventana de oportunidad en caso de que alguien intercepte la petición.

### 4.2 Webhooks y Validaciones HMAC (Orthanc)

1.  **`OrthancWebhookView` (`clinical_data/views/orthanc_webhook.py`)**
    *   **Propósito:** Escuchar eventos `OnStableStudy` emitidos por el servidor DICOM (Orthanc) en la red local de la clínica cuando ingresa un nuevo estudio médico.
    *   **Seguridad Anti-Spoofing:** Dado que Orthanc no emite JWTs nativamente, la seguridad se blinda mediante una firma **HMAC SHA-256** inyectada en el header `X-Orthanc-Webhook-Signature`.
    *   **Prevención de Timing Attacks:** La comparación de la firma HMAC entrante contra la firma calculada se realiza usando `hmac.compare_digest()`, protegiendo el endpoint contra ataques de temporización de canal lateral.
    *   **Calidad:** Altamente robusto. Rechaza instantáneamente peticiones maliciosas (HTTP 401) antes siquiera de parsear el body.

---

## 5. Eventos y Asincronismo (`signals.py`)

La arquitectura exige que la clínica informe al Core API sobre nuevos pacientes sin afectar el tiempo de respuesta del médico o asistente que está operando el sistema de forma local.

### 5.1 Webhook Dispatching (Clinic a Core)

1.  **`patient_saved_webhook` (`clinical_data/signals.py`)**
    *   **Propósito:** Notificar al Core API cuando se crea o actualiza un `PatientProfile` en la clínica, para que el Core pueda actualizar su mapeo global `FederationIDMap`.
    *   **Desacoplamiento de Datos (Privacidad):** En el payload del webhook **nunca se envían datos clínicos**. Solo se envía `local_patient_id`, `first_name` y `last_name`. Toda la PHI (Personal Health Information) permanece encerrada en la red local/VPC de la clínica.
    *   **Asincronismo Real (Non-blocking):** Escucha la señal nativa de Django `post_save`, pero la llamada de red hacia internet (`httpx.post`) se encapsula y transfiere inmediatamente a un **Daemon Thread** (`threading.Thread`).
        *   **Ventaja:** El asistente de la clínica que guarda al paciente recibe su respuesta HTTP 200 al instante. El sistema no se congela por 5 segundos esperando que el Core API conteste por internet.
    *   **Seguridad Inyectada:** Encripta el payload usando HMAC SHA-256 (con `WEBHOOK_SECRET`) y lo envía en el header `X-Clinic-Signature`.
    *   **Calidad:** Excelente patrón de *fire-and-forget*. Evita cuellos de botella de red y garantiza una experiencia de usuario rápida localmente, mientras mantiene eventual consistencia con el servidor central.

---

## 6. Configuración Base e Infraestructura (`settings.py` y `Dockerfile`)

La robustez del código Python en Django debe ser acompañada por un entorno de ejecución e infraestructura de red seguros e inquebrantables. Esta sección valida la parametrización de despliegue.

### 6.1 Performance y Red (`settings.py`)

1.  **Connection Pooling (`CONN_MAX_AGE`)**
    *   **Configuración:** Implementación estricta de `CONN_MAX_AGE` (ej. 60 segundos).
    *   **Calidad:** Al mantener las conexiones a la base de datos PostgreSQL vivas y reutilizables, se elimina la enorme latencia (TCP Handshake + Auth) que sufriría el sistema si Django abriera y cerrara una conexión por cada *HTTP request*. Esto es fundamental para la escalabilidad vertical bajo alta concurrencia.

2.  **Seguridad Perimetral HTTP (Load Balancers)**
    *   **Configuración:** `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`
    *   **Calidad:** Crítico. Permite a Django entender con total seguridad cuándo está siendo orquestado detrás de un Load Balancer (como AWS ALB) que termina el certificado SSL. Esto evita los catastróficos bucles infinitos de redirección HTTPS y garantiza que las cookies con la flag `Secure` funcionen correctamente en producción.

3.  **Aislamiento de Entornos (12-Factor App)**
    *   **Configuración:** Inyección total vía variables de entorno mediante `django-environ`.
    *   **Calidad:** No existe ni una sola credencial, URL o base de datos *"hardcodeada"* en el código. El sistema es 100% agnóstico del ambiente (dev, staging, prod), cumpliendo la estricta metodología de desarrollo *12-Factor App*.

### 6.2 Resiliencia de Contenedores (`Dockerfile`)

1.  **Sondas Liveness y Readiness**
    *   **Configuración:** Implementación de vistas ultraligeras (`/health/` y `/ready/`) en las URLs principales, invocadas desde la directiva `HEALTHCHECK` del Dockerfile y posteriormente por el orquestador AWS ECS.
    *   *Liveness (`/health/`):* Comprueba que el proceso base de Python no está "colgado" ni en *deadlock*.
    *   *Readiness (`/ready/`):* Obliga activamente a ejecutar un `connection.ensure_connection()`.
    *   **Calidad:** Los orquestadores modernos (ECS Fargate) **nunca** enviarán tráfico de red a un contenedor cuya base de datos local esté caída o en pleno reinicio, garantizando despliegues invisibles (Zero Downtime Deployments).
