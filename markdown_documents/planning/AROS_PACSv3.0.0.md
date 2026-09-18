# AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc

> **Documento de referencia técnica para tesis**
> Versión: 3.1.0 | Fecha: Julio 2026
> Proyecto: Sistema de Registros Médicos Electrónicos con Arquitectura Multi-Clínica y PACS Descentralizado
>
> **Changelog v3.1.0:** Incorpora revisión de arquitectura AWS senior (seguridad, resiliencia, performance). Correcciones: [SEC-01] email hashing, [SEC-02] S2S JWT, [SEC-03] JWKS + rotación RSA, [SEC-04] HMAC-SHA256 en webhooks, [SEC-05] blacklist de refresh tokens, [PERF-01] StreamingHttpResponse proxy WADO-RS, [PERF-02] Orthanc StorageCache, [PERF-03] RDS connection pooling, [PERF-04] ECS autoscaling, [PERF-05] índices de BD críticos.

---

## 1. Visión General del Producto Final

AROSPACS v3.0 es una **plataforma SaaS de registros médicos electrónicos** que permite a múltiples clínicas de radiología gestionar estudios de imágenes diagnósticas utilizando estándares médicos abiertos, mientras los pacientes pueden acceder a su historial médico universal desde cualquier lugar.

La plataforma se compone de **seis sistemas independientes** que colaboran como un ecosistema cohesivo:

| # | Sistema | Descripción | Quién lo usa | Visibilidad |
|---|---|---|---|---|
| 1 | **AROS Core API (Django)** | Identity Provider y API Gateway central. Enruta peticiones federadas a las clínicas. No almacena datos médicos ni demografía de pacientes. | Ningún usuario final | Invisible |
| 2 | **Clinic Internal API** | Microservicio ligero desplegado dentro de la VPC aislada de CADA clínica. Gestiona su BD local y webhooks. | AROS Core API | Invisible |
| 3 | **Portal Paciente** | Aplicación web donde el paciente consulta su historial médico universal | Todos los pacientes | Visible |
| 4 | **Portal Clínica** | Aplicación web para el personal interno de la clínica | Administradores, Asistentes, Radiólogos | Visible |
| 5 | **Visor DICOM (OHIF)** | Plataforma de visualización de imágenes radiológicas en el navegador | Radiólogos y Pacientes | Visible |
| 6 | **Servidor PACS (Orthanc)** | Core de almacenamiento desplegado en cada clínica. Orquesta los flujos DICOM locales. | Ningún usuario final | **Invisible pero vital** |

> **Manifiesto Zero Clinical Data Retention**
> AROS Technologies opera bajo una política estricta de "Cero Retención de Datos Clínicos". La plataforma central en `aros-core` funciona puramente como un Identity Provider (IdP) y un API Gateway de interoperabilidad. Los archivos DICOM, solicitudes de estudio (StudyRequests), reportes, diagnósticos médicos y **datos demográficos de los pacientes (PHI)** son propiedad y responsabilidad exclusiva de cada clínica. Estos datos se procesan y persisten únicamente dentro de las cuentas de AWS aisladas de las clínicas (vía el Clinic Internal API y su RDS local) y nunca tocan el almacenamiento persistente central de AROS.

### ¿Qué puede hacer el producto final?

**El Paciente puede:**
- Iniciar sesión con email y contraseña
- Ver el historial completo de todos sus estudios radiológicos, independientemente de cuántas clínicas lo hayan atendido
- Leer el reporte diagnóstico generado y firmado por el médico radiólogo
- Visualizar sus imágenes DICOM directamente en el navegador a través del visor OHIF, que las obtiene vía el protocolo DICOMweb desde Orthanc
- Descargar sus archivos DICOM originales
- Autorizar o revocar el acceso de clínicas específicas a sus registros (registrado en `ConsentRecord`)

**El Asistente de Clínica puede:**
- Iniciar sesión (el sistema lo redirige automáticamente al dashboard de asistente)
- Buscar y registrar pacientes en el sistema
- Crear solicitudes de estudio (StudyRequest) cuando llega un paciente
- Ver el listado y estado de los estudios del día
- Autorizar la creación de cuentas de médicos asociados.

**El Médico Radiólogo / Técnico Radiólogo puede:**
- Ver la cola de estudios pendientes de diagnóstico en el Portal Clínica
- Abrir el OHIF Viewer integrado para revisar las imágenes radiológicas; las imágenes llegan automáticamente al visor porque la **máquina de radiología las envió directamente a Orthanc** vía el protocolo DICOM C-STORE al concluir el estudio
- Redactar y firmar el reporte médico (hallazgos, conclusiones, recomendaciones), que se persiste en la base de datos aislada de la clínica (AWS Account independiente)

> [!NOTE]
> El técnico radiólogo **no sube manualmente ningún archivo**. La máquina de radiología (TAC, resonancia magnética, rayos X digital, etc.) tiene configurada la **dirección IP y el AET (Application Entity Title) de Orthanc** como destino de envío. Al concluir el estudio, la máquina lo transmite de forma automática y autónoma.

**El Administrador de Clínica puede:**
- Gestionar los usuarios de su clínica (invitar asistentes y radiólogos)
- Personalizar la identidad visual de su clínica (colores corporativos y logo) mediante el sistema de White-Labeling
- Consultar métricas generales de su clínica
- Agregar y eliminar médicos y asistentes de su clínica

**El Sistema:**
- Configurar la infraestructura de AWS de cada clínica
- Configurar las credenciales del bucket S3 propio de la clínica (BYOS — Bring Your Own Storage), que Orthanc usará para almacenar y recuperar las imágenes
- Estar empaquetado para ser "Plug & Play" para una clínica, es decir, todo el sistema debe estar listo para su instalación y configuración en una clínica con solo ejecutar un comando.

---

## 2. Arquitectura del Sistema

### 2.1 Paradigma: Federated APIs y Aislamiento Físico por Clínica

La arquitectura v3.0 adopta un modelo **AWS Organizations Multi-Account** combinado con el patrón de diseño **Federated APIs**. AROS Technologies (cuenta `aros-core`) opera la infraestructura central compartida (Identity Provider y Gateway). Cada clínica onboarded recibe su propia cuenta AWS completamente aislada, provisionada por AROS, que contiene su propio VPC, Orthanc ECS (Graviton ARM64), S3 Bucket, un RDS local (Graviton) y el **Clinic Internal API**.

> **🌟 Optimización Arquitectónica Definitiva:** El sistema utiliza **AWS VPC Peering** (reemplazando Transit Gateway) para interconexión a 0 saltos, **AWS Cloud Map** (reemplazando ALB interno) para Service Discovery, y procesadores **Graviton (ARM64)** para máximo rendimiento al menor costo. El tráfico DICOM pesado no pasa por proxies; OHIF lee directamente desde S3 mediante **Pre-signed URLs** efímeras.

La comunicación entre la cuenta central y las clínicas ocurre exclusivamente a través del **AWS VPC Peering**, enrutando peticiones JSON seguras hacia el Clinic Internal API usando resolución DNS privada. Cada llamada del Core API hacia un Clinic API incluye un **Service-to-Service (S2S) JWT** firmado con la llave privada del Core, implementando el patrón **Zero Trust Network** dentro de la red privada.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                               AWS ORGANIZATION (aros-mgmt)                                   │
│                                                                                              │
│  ┌─────────────────────────── OU: Core Services ─────────────────────────────────────────┐  │
│  │                     CUENTA: aros-core  (VPC: 10.0.0.0/16)                             │  │
│  │                                                                                       │  │
│  │  INTERNET (HTTPS)                                                                     │  │
│  │      │                                                                                │  │
│  │      ▼                                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────┐ │  │
│  │  │  ALB Público (api.arospacs.com)                                                 │ │  │
│  │  └──────────────────────────┬──────────────────────────────────────────────────────┘ │  │
│  │                             │                                                        │  │
│  │                             ▼                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐   │  │
│  │  │  ECS Fargate — AROS Core API (Django)                                        │   │  │
│  │  │  · Identity Provider: Autentica (JWT RS256 + JWKS endpoint)                  │   │  │
│  │  │  · API Gateway: Enruta con S2S JWT hacia Clinic Internal APIs                │   │  │
│  │  │  · Federated Query: Timeout + Circuit Breaker (httpx async)                  │   │  │
│  │  │  · Proxy WADO-RS: StreamingHttpResponse chunk-by-chunk (sin buffering RAM)   │   │  │
│  │  │  · CERO DATOS CLÍNICOS: No guarda estudios, reportes, imágenes ni PHI.      │   │  │
│  │  └──────────┬───────────────────────────────────────┬─────────────────────────┘   │  │
│  │             │                                           │                          │  │
│  │             ▼                                           ▼                          │  │
│  │  ┌─────────────────────────┐              ┌────────────────────────────────────┐  │  │
│  │  │  RDS PostgreSQL 16      │              │  AWS Transit Gateway (TGW)         │  │  │
│  │  │  (IdP & Registry)       │              │  · Owner: aros-core                │  │  │
│  │  │  · User (email_hash,    │              │  · Enruta Core API → ALB interno   │  │  │
│  │  │    email_encrypted,     │              │    de cada clínica vía S2S JWT     │  │  │
│  │  │    password_hash, uuid) │              └───────────────────┬────────────────┘  │  │
│  │  │  · FederationIDMap      │                                  │ TGW Attachments  │  │
│  │  │  · ClinicRegistry       │                                  │                  │  │
│  │  │  · Role/Permissions     │                                  │                  │  │
│  │  │  · ConsentRecord        │                                  │                  │  │
│  │  │  [SIN PatientProfile    │                                  │                  │  │
│  │  │   ni ningún dato PHI]   │                                  │                  │  │
│  │  └─────────────────────────┘                                  │                  │  │
│  │                                                               │                  │  │
│  │  Redis (Multi-AZ): Refresh Token Blacklist + WebSockets       │                  │  │
│  │  RDS Proxy: Connection pooling warm para Core RDS             │                  │  │
│  └───────────────────────────────────────────────────────────────┼───────────────────┘  │
│                                                                  │                      │
│  ┌─────────────────────────── OU: Clinic Workloads ──────────────┼────────────────────┐ │
│  │                                                               │                   │ │
│  │  ┌──────────────── CUENTA: clinic-san-jose ──────────────┐    │                   │ │
│  │  │  VPC: 10.1.0.0/16                                     │◄───┘                   │ │
│  │  │                                                       │                        │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │                        │ │
│  │  │  │  ALB Interno (solo accesible desde TGW)         │ │                        │ │
│  │  │  └──────────┬────────────────────────────┬─────────┘ │                        │ │
│  │  │             │ Proxy WADO-RS              │ API HTTP  │                        │ │
│  │  │             ▼                            ▼           │                        │ │
│  │  │  ┌──────────────────────┐ ┌─────────────────────────────────┐ │              │ │
│  │  │  │ ECS Orthanc PACS     │ │ ECS Clinic Internal API         │ │              │ │
│  │  │  │ (C-STORE 4242)       │ │ (Microservicio local)           │ │              │ │
│  │  │  │ StorageCache: 512MB  │ │ Verifica S2S JWT + HMAC webhook │ │              │ │
│  │  │  │ OnStable Webhook ────┼─► (iss: aros-core, aud: clinic-x) │ │              │ │
│  │  │  └──────────┬───────────┘ └──────────┬──────────────────────┘ │              │ │
│  │  │             │ S3/RDS                 │ RDS (+ RDS Proxy)     │              │ │
│  │  │             ▼                        ▼                       │              │ │
│  │  │  ┌────────────────────┐   ┌──────────────────────────────────────────────┐ │  │ │
│  │  │  │ S3 Bucket (DICOM)  │   │ RDS PostgreSQL Clínica                       │ │  │ │
│  │  │  │ KMS, Privado       │   │ - PatientProfile (PHI)                       │ │  │ │
│  │  │  └────────────────────┘   │ - StudyRequest, Study, Report, Orthanc DB    │ │  │ │
│  │  │                           └──────────────────────────────────────────────┘ │  │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  │                                                                                   │ │
│  │  ┌──────────────── CUENTA: clinic-radiologia-norte ──────┐                        │ │
│  │  │  VPC: 10.2.0.0/16  (estructura idéntica aprovisionada)│                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Datos: Zero Clinical Data Retention Estricto y Segregación de PHI

La base de datos central de AROS no es un monolito; el almacenamiento está rígidamente particionado. La **Información de Salud Protegida (PHI)** —nombres, fechas de nacimiento, género, historial médico— **nunca reside en el `aros-core`**.

**Base de Datos AROS Core (`aros-core` RDS):**
- **Contiene ÚNICAMENTE:** `User`, `FederationIDMap`, `ClinicRegistry`, `Role/Permissions` y `ConsentRecord`.
- **Propósito:** Gestión de identidades, autenticación JWT RS256 y configuración de enrutamiento (URLs internas del TGW).
- **Restricción CRÍTICA:** `PatientProfile` (nombre, apellido, fecha de nacimiento, sexo, CURP, etc.) se considera **PHI** y **no existe como tabla en esta base de datos**.

> [!IMPORTANT]
> **[SEC-01] Privacidad del email:** El email es PII. Para minimizar el riesgo de exposición en caso de breach del RDS central, el modelo `User` **no almacena el email en texto plano**. Usa `email_hash = SHA256(email.lower())` como índice único para el lookup de login, y `email_encrypted` (AES-256 con llave KMS) para comunicaciones salientes. El password se hashea con **Argon2** (sucesor de bcrypt, recomendado por OWASP 2024).
>
> ```python
> class User(AbstractBaseUser):
>     email_hash      = models.CharField(max_length=64, unique=True)  # SHA-256 normalizado
>     email_encrypted = models.BinaryField()                           # AES-256 KMS
>     password        = models.CharField(...)                          # Argon2 vía Django
>     uuid            = models.UUIDField(default=uuid4, primary_key=True)
> ```

> [!IMPORTANT]
> El `FederationIDMap` permite al Core API resolver, dado un UUID de usuario, cuál es el ID de paciente local en cada clínica registrada. El `ConsentRecord` registra las autorizaciones y revocaciones del paciente sobre qué clínicas pueden acceder a su historial, con timestamp de auditoría.

**Índices de Base de Datos Críticos (RDS Central):**

```sql
-- FederationIDMap: la query más frecuente del sistema (Federated Query)
CREATE UNIQUE INDEX idx_federation_user_clinic
  ON federation_id_map(user_uuid, clinic_id);

-- ConsentRecord: verificación de acceso por paciente y clínica
CREATE INDEX idx_consent_user_clinic
  ON consent_record(user_uuid, clinic_id, revoked_at);
```

**Base de Datos Clínica (RDS aprovisionado en cada cuenta AWS de clínica):**
- **Contiene:** `PatientProfile` (PHI — nombre, fecha de nacimiento, género, datos demográficos), `StudyRequest`, `Study`, `Report` y el esquema del plugin PostgreSQL de Orthanc.
- **Propósito:** Persistencia local y soberana de la PHI. La clínica es el único Data Controller.
- **Acceso:** Gestionado localmente por el **Clinic Internal API**, que responde a peticiones del Core Gateway autenticadas con S2S JWT.

**Índices de Base de Datos Críticos (RDS Clínica):**

```sql
-- StudyRequest: el webhook busca siempre por accession_number
CREATE UNIQUE INDEX idx_studyreq_accession
  ON study_request(accession_number);

-- Study: historial del paciente por fecha descendente
CREATE INDEX idx_study_patient_date
  ON study(patient_id, study_date DESC);

-- PatientProfile: búsqueda por ID local de la clínica
CREATE UNIQUE INDEX idx_patient_local_id
  ON patient_profile(local_patient_id);
```

### 2.3 White-Labeling del Portal Clínica

El Portal Clínica es una **sola aplicación Next.js desplegada una sola vez** que se adapta visualmente a cada clínica según su subdominio:

```
clinica-san-jose.arospacs.com → azul corporativo, logo San José
radiologia-norte.arospacs.com → verde institucional, logo Norte
clinica-xyz.arospacs.com → colores personalizados, logo XYZ
```

**Mecanismo técnico:**
1. El middleware de Next.js intercepta cada petición y extrae el subdominio
2. Consulta al backend `GET /api/v1/clinic/theme/?slug=clinica-san-jose`
3. Inyecta los valores como CSS Custom Properties (`--color-primary`, `--color-secondary`, etc.) en el HTML del lado del servidor antes de enviarlo al navegador
4. El administrador de cada clínica gestiona su branding desde la sección `/admin/branding` del portal

---

## 3. Stack Tecnológico Completo

### 3.1 Backend — Django REST API

| Tecnología | Versión | Rol |
|---|---|---|
| **Python** | 3.12+ | Lenguaje del backend |
| **Django** | **5.2 LTS** | Framework web base (LTS — soporte hasta abril 2028) |
| **Django REST Framework (DRF)** | 3.15 | Convierte Django en una API REST pura |
| **djangorestframework-simplejwt** | 5.3 | Autenticación stateless JWT RS256 con soporte de `kid` |
| **PyJWT / cryptography** | latest | Firmas asimétricas RS256 (RSA) y cifrado AES-256 KMS |
| **django-cors-headers** | 4.4 | Permite peticiones cross-origin desde los portales |
| **drf-spectacular** | 0.27 | Genera documentación Swagger/OpenAPI automáticamente |
| **Django Channels** | 4.x | WebSockets para notificaciones en tiempo real |
| **Daphne** | 4.x | Servidor ASGI para Django Channels (WebSockets únicamente) |
| **Gunicorn + uvicorn workers** | latest | Servidor ASGI para endpoints REST HTTP (separado de Daphne) |
| **boto3** | 1.42 | SDK AWS para Python (Secrets Manager, S3, KMS) |
| **django-storages** | 1.14 | Integración con S3 para archivos de media (logos, firmas) |
| **WeasyPrint** | 68 | Generación de PDFs de reportes médicos |
| **PostgreSQL** (psycopg) | 16 + 3.3 | Base de datos relacional en producción |
| **SQLite** | — | Base de datos local en desarrollo |
| **Redis** | 7 | Broker WebSockets + **Refresh Token Blacklist** (JTI blacklist) |
| **httpx** | 0.27 | Cliente HTTP async; `httpx.stream()` para proxy WADO-RS sin buffering RAM; Timeout + Circuit Breaker en Federated Queries |
| **pybreaker** | 1.x | Implementación de Circuit Breaker para llamadas a Clinic APIs |

> [!NOTE]
> **[PERF-03] RDS Connection Pooling:** Configurar `CONN_MAX_AGE = 60` en `settings.py` y usar **AWS RDS Proxy** en producción. RDS Proxy mantiene un pool de conexiones warm entre ECS y RDS, reduciendo la latencia de apertura de conexión TCP de ~50ms a ~2ms por request. Crítico cuando hay 20+ usuarios concurrentes.

### 3.2 Frontend — Portal Paciente y Portal Clínica

| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js** | 15 | Framework React con App Router (SSR + CSR) |
| **TypeScript** | 5.x | Tipado estático para todos los componentes y llamadas a API |
| **Tailwind CSS** | 4.x | Sistema de estilos utilitario |
| **shadcn/ui** | latest | Librería de componentes UI accesibles y modernos |
| **Zustand** | 5.x | Gestión de estado global ligero (autenticación, datos de sesión) |
| **TanStack Query** | 5.x | Cache, sincronización y revalidación automática de datos |
| **Axios** | 1.x | Cliente HTTP con interceptores para auto-refresh de JWT |
| **Turborepo** | 2.x | Orquestador de monorepo |
| **pnpm** | 9.x | Gestor de paquetes rápido y eficiente |

### 3.3 Visor DICOM — OHIF Viewer

| Tecnología | Versión | Rol |
|---|---|---|
| **OHIF Viewer** | 3.x | Plataforma completa de visualización de imágenes médicas (open-source, MIT) |
| **Cornerstone.js** | 3.x | Motor de renderizado DICOM con aceleración WebGL/GPU — base de OHIF |
| **DICOMweb (WADO-RS)** | Estándar DICOM | Protocolo de comunicación entre OHIF y Orthanc para obtener imágenes |
| **Nginx** | 1.25 | Sirve la SPA de OHIF dentro del contenedor Docker |
| **Docker** | 24+ | Empaquetamiento y despliegue del visor |

> **¿Por qué OHIF y no una alternativa?** OHIF es el estándar open-source de la industria en radiología digital, adoptado por el NIH, NHS y hospitales universitarios de referencia. Su integración nativa con DICOMweb lo hace el complemento ideal para Orthanc: OHIF consume directamente los endpoints WADO-RS que Orthanc expone, sin configuración adicional de parseo o conversión de formatos.

**[PERF] Configuración de prefetching de OHIF para radiología clínica:**

```javascript
// ohif-config.js — configuración en el contenedor
window.config = {
  dataSources: [{
    wadoUriRoot: "https://api.arospacs.com/api/v1/dicom-web",
    wadoRoot:    "https://api.arospacs.com/api/v1/dicom-web",
  }],
  maxNumRequests: {
    interaction: 1,   // Request que el usuario dispara al hacer click
    thumbnail:    3,  // Pre-carga miniaturas del stack
    prefetch:    10,  // Pre-carga 10 frames en background mientras el radiólogo diagnostica
  },
};
```

El prefetching reduce el tiempo efectivo de espera entre frames de ~200ms a prácticamente 0ms en la práctica, ya que el siguiente frame ya está en memoria cuando el radiólogo lo necesita.

### 3.4 Servidor PACS — Orthanc (Despliegue Per-Clínica, Configuración Estática)

Orthanc es un servidor PACS ligero, open-source, orientado al protocolo DICOM. En esta arquitectura **cada clínica tiene su propia instancia de Orthanc** desplegada en su cuenta AWS aislada. No existe un Orthanc compartido. Cada instancia arranca con **variables de entorno completamente estáticas** inyectadas por Terraform al momento del despliegue.

> [!IMPORTANT]
> El plugin S3 de Orthanc **no soporta switching dinámico de buckets en runtime**. Lee el nombre del bucket desde su configuración en el arranque y mantiene esa conexión durante toda su vida. Intentar un modelo multi-tenant con un solo Orthanc y múltiples buckets es arquitecturalmente incorrecto. Por esta razón, la arquitectura adopta el modelo **una cuenta → un Orthanc → un bucket**.

| Componente | Versión / Detalle | Rol |
|---|---|---|
| **Orthanc Core** | 1.12.11 (stable) | Servidor PACS dedicado por clínica; indexa y sirve estudios DICOM |
| **SCP DICOM C-STORE** | Puerto 4242 — integrado en el core | Recibe estudios de la máquina de radiología; Security Group solo permite la red/VPN de esa clínica |
| **Plugin DICOMweb** | Oficial Orthanc | Expone WADO-RS, QIDO-RS en el puerto 8042 — accesible únicamente desde el ALB interno de la cuenta |
| **Plugin PostgreSQL** | Oficial Orthanc | Indexa Studies/Series/Instances en el schema `orthanc_{slug}` del RDS local de la clínica |
| **Plugin AWS S3** | Oficial Orthanc | Persiste los `.dcm` en el bucket `orthanc-{slug}-{aws_account_id}-dicom`; el Account ID evita colisiones globales en AWS S3 |
| **StorageCache** | Nativo Orthanc 1.12.x | **[PERF-02]** Caché en disco local de 512MB para archivos `.dcm` recientes. Reduce latencia de frame de ~200ms (S3) a ~5ms (disco ECS). Configurable vía `orthanc.json` |
| **Webhook `OnStableStudy`** | Nativo Orthanc | Envía `POST` al `Clinic Internal API` con HMAC-SHA256 del payload en el header `X-Orthanc-Webhook-Signature`. El Clinic API verifica integridad antes de procesar |
| **API REST interna** | Nativo Orthanc (puerto 8042) | Django la usa para consultas post-webhook (metadatos, UIDs); solo accesible desde el TGW |
| **Health Check** | `GET /` en puerto 8042 | ECS task health check; confirma que Orthanc está vivo y los plugins cargados |

**Variables de entorno estáticas inyectadas por Terraform en el ECS Task Definition:**

| Variable | Valor (ejemplo clinic-san-jose) | Descripción |
|---|---|---|
| `ORTHANC__DICOMAET` | `ORTHANC_SAN_JOSE` | AET único por clínica; se configura en la máquina de radiología como destino |
| `ORTHANC__S3OBJECTSTORAGE__BUCKETNAME` | `orthanc-san-jose-123456789012-dicom` | Bucket S3 con Account ID; evita colisiones globales AWS S3; estático, nunca cambia |
| `ORTHANC__S3OBJECTSTORAGE__REGION` | `us-east-1` | Región del bucket — debe ser la misma del ECS task para minimizar latencia S3 |
| `ORTHANC__POSTGRESQL__HOST` | `rds.clinic-san-jose.internal` (via RDS Proxy local) | Host del RDS Proxy de la clínica |
| `ORTHANC__POSTGRESQL__DATABASE` | `clinic_db` | Base de datos en el RDS local de la clínica |
| `ORTHANC__POSTGRESQL__SCHEMA` | `orthanc_san_jose` | Schema aislado de esta clínica |
| `ORTHANC__STORAGECACHE__ENABLE` | `true` | **[PERF-02]** Activa caché local de archivos `.dcm` |
| `ORTHANC__STORAGECACHE__MAXIMUMSIZE` | `512` | 512 MB de caché en disco ECS para frames recientes |
| `ORTHANC__WEBHOOKS__URL` | `http://clinic-api.internal:8000/api/v1/webhooks/orthanc/study-stable/` | Endpoint del Clinic API dentro de la VPC |
| `ORTHANC__WEBHOOKS__HEADERS__X_ORTHANC_WEBHOOK_SECRET` | `<valor-desde-secrets-manager>` | Token secreto local para el header de autenticación del webhook |
| `ORTHANC__WEBHOOKS__SECRET` | `<valor-desde-secrets-manager>` | Secreto para HMAC-SHA256 del payload del webhook |

**Endpoints DICOMweb que Orthanc expone (consumidos exclusivamente por el proxy Django):**

| Endpoint Orthanc (interno) | Endpoint público equivalente (Django proxy) | Protocolo |
|---|---|---|
| `GET /dicom-web/studies` | `GET /api/v1/dicom-web/{slug}/studies` | QIDO-RS |
| `GET /dicom-web/studies/{uid}/series` | `GET /api/v1/dicom-web/{slug}/studies/{uid}/series` | QIDO-RS |
| `GET /dicom-web/studies/{uid}/series/{s}/instances/{i}/frames/{f}` | `GET /api/v1/dicom-web/{slug}/studies/{uid}/...` | WADO-RS |

> [!IMPORTANT]
> **[PERF-01] Proxy WADO-RS debe usar streaming verdadero.** El proxy Django que reenvía archivos DICOM hacia el browser **NO debe cargar el archivo completo en RAM**. Un TAC de 500 frames × 500KB = 250MB por usuario; con 10 radiólogos concurrentes = 2.5GB de RAM consumidos solo en buffering. Se debe usar `StreamingHttpResponse` + `httpx.stream()` para reenviar chunk por chunk (~64KB). Ver implementación en Sección 5.3.

**Licenciamiento:**
- **Orthanc Core**: GPLv3+ — uso interno como componente de infraestructura: legal
- **Plugin DICOMweb, Plugin PostgreSQL, Plugin AWS S3**: AGPLv3+ — uso interno sin redistribución: legal en el contexto SaaS de AROS Technologies

> [!IMPORTANT]
> Todos los plugins de Orthanc se usan como componentes internos de infraestructura (no se redistribuyen ni modifican). Se recomienda consultar asesoría legal antes de redistribuir binarios de Orthanc con plugins modificados.

### 3.5 Infraestructura — AWS Organizations + Terraform

| Servicio AWS | Cuenta | Rol en la Arquitectura |
|---|---|---|
| **AWS Organizations** | `aros-mgmt` | Agrupa todas las cuentas; aplica SCPs; gestión centralizada de billing |
| **AWS Transit Gateway (TGW)** | `aros-core` (owner) | Hub de red privado; enruta tráfico entre `aros-core` y todas las cuentas de clínica sin salir a internet |
| **AWS RAM** | `aros-core` | Comparte el TGW con toda la OU `Clinic Workloads` automáticamente |
| **ECS Fargate** | `aros-core` | Django API (mínimo 2 tasks, autoscaling CPU > 60%) + OHIF Viewer |
| **ECS Fargate** | cada `clinic-{slug}` | Una instancia de Orthanc + una instancia de Clinic Internal API; mínimo 2 tasks |
| **RDS PostgreSQL 16** | `aros-core` | Datos de identidad (`User`, `FederationIDMap`, `ClinicRegistry`, `ConsentRecord`) — **sin PHI** |
| **RDS PostgreSQL 16** | cada `clinic-{slug}` | `PatientProfile` (PHI), `StudyRequest`, `Study`, `Report`, schema Orthanc |
| **AWS RDS Proxy** | `aros-core` + cada `clinic-{slug}` | **[PERF-03]** Pool de conexiones warm entre ECS y RDS; reduce latencia de conexión de ~50ms a ~2ms |
| **ElastiCache Redis** | `aros-core` | WebSockets (Django Channels) + **Refresh Token Blacklist** (JTI); **Multi-AZ + failover automático** |
| **ALB público** | `aros-core` | `api.arospacs.com` (Django), OHIF Viewer |
| **ALB interno** | cada `clinic-{slug}` | Recibe proxy WADO-RS de Django via TGW; Security Group: solo CIDR `10.0.0.0/16` |
| **AWS S3** | cada `clinic-{slug}` | Bucket `orthanc-{slug}-{aws_account_id}-dicom`; privado, KMS, versionado, misma región que ECS |
| **AWS Secrets Manager** | `aros-core` | `JWT_PRIVATE_KEY` (RS256), `JWT_PUBLIC_KEY`, `DATABASE_URL`, `EMAIL_KMS_KEY_ARN` |
| **AWS Secrets Manager** | cada `clinic-{slug}` | `CLINIC_DB_URL`, `JWT_PUBLIC_KEY` (RS256, solo verificación), `ORTHANC_WEBHOOK_SECRET`, `ORTHANC_WEBHOOK_HMAC_SECRET` |
| **AWS ECR** | `aros-core` | Registro Docker compartido: imágenes `django`, `orthanc-custom`, `ohif` |
| **AWS Amplify** | `aros-core` | Portal Paciente + Portal Clínica (Next.js, subdominios wildcard) |
| **AWS CloudWatch** | cada cuenta | Logs aislados por clínica; agrega via CloudWatch Cross-Account Observability |
| **AWS CloudTrail** | cada cuenta | Audit trail HIPAA aislado por clínica — incluye accesos a PHI |
| **AWS Security Hub** | `aros-security` | Agrega findings de todas las cuentas |
| **AWS Config** | `aros-security` | Reglas de cumplimiento (cifrado S3, MFA, acceso público bloqueado) |
| **AWS IAM — `TerraformDeployRole`** | cada `clinic-{slug}` | Rol pre-creado por SCP; el pipeline de CI/CD de `aros-core` lo asume para desplegar |
| **AWS Route 53** | `aros-core` | `api.arospacs.com`, `viewer.arospacs.com`, `*.arospacs.com` |
| **AWS ACM** | `aros-core` | Certificados TLS para todos los dominios públicos |
| **Terraform** | — | IaC: un root module por clínica; estado en S3 con clave `clinics/{slug}/terraform.tfstate` |

---

## 4. Requisitos del Sistema

### 4.1 Requisitos Funcionales

**Autenticación y Roles:**
- Los pacientes y el personal de las clínicas se autentican con email y contraseña mediante el Portal correspondiente
- El sistema distingue 4 tipos de usuarios: Paciente, Asistente, Radiólogo, Administrador de Clínica
- Al iniciar sesión, el usuario es redirigido automáticamente al dashboard correcto según su rol codificado en el JWT
- Las sesiones de acceso duran 15 minutos y se renuevan automáticamente en silencio durante 7 días
- El paciente puede revocar su sesión explícitamente (logout); el Refresh Token se agrega al blacklist de Redis inmediatamente

**Gestión de Estudios y Flujo de Adquisición:**
- El asistente crea una `StudyRequest` para un paciente; Django genera automáticamente un **Accession Number** único y lo persiste en la base de datos de la clínica
- El Accession Number se entrega al técnico radiólogo, quien lo ingresa en la máquina de radiología antes de realizar el estudio
- La máquina de radiología tiene configurada la **IP y el AET de Orthanc** como destino; al concluir el estudio, lo transmite automáticamente vía **DICOM C-STORE**
- Orthanc recibe el estudio como **SCP**, lo indexa (con StorageCache activo) y lo persiste en S3 vía el plugin AWS
- Cuando el estudio queda estable, Orthanc dispara **`OnStableStudy`** enviando un Webhook al `Clinic Internal API` con HMAC-SHA256 del payload
- El `Clinic Internal API` verifica la firma HMAC, localiza la `StudyRequest` por `accession_number` (índice único), crea el registro `Study` y lo vincula
- El médico radiólogo ve el estudio en su cola, abre OHIF (con prefetching de 10 frames activo) y redacta el reporte

**Consentimiento del Paciente:**
- El paciente autoriza o revoca el acceso de clínicas a su historial; cada acción se registra en `ConsentRecord` con timestamp
- El Core API verifica `ConsentRecord` antes de incluir una clínica en el Federated Query

**Almacenamiento y Archivos (BYOS con Orthanc):**
- Orthanc utiliza el plugin AWS S3 para escribir y leer archivos DICOM en el bucket de la clínica
- Ningún servidor de AROS procesa ni almacena bytes de imágenes DICOM en memoria de forma persistente

**Multi-Clínica:**
- El historial del paciente es universal: Django agrega estudios de todas las clínicas con consentimiento activo
- Si una o más clínicas no responden (timeout/Circuit Breaker), se retorna **historial parcial** con `partial_history: true`

### 4.2 Requisitos No Funcionales

**Seguridad:**
- JWT RS256 (15 min) + Refresh Token (7 días) en cookie HttpOnly + blacklist JTI en Redis
- Autenticación S2S JWT en cada llamada Core API → Clinic API (Zero Trust Network)
- Email almacenado hasheado (SHA-256) + cifrado (AES-256 KMS) en RDS central
- Webhook Orthanc autenticado con HMAC-SHA256 del payload
- JWKS endpoint público para distribución de llave pública RSA; rotación trimestral con `kid`
- CORS explícito solo para dominios de los portales; HTTPS + HSTS en producción

**Performance (SLOs):**
- Historial del paciente (3 clínicas): P95 < 200ms
- Primer frame DICOM (estudio reciente en StorageCache): P95 < 100ms
- Primer frame DICOM (estudio en S3 frío): P95 < 300ms
- Webhook processing (OnStableStudy → Study vinculado): < 50ms

**Disponibilidad:**
- ECS Fargate: mínimo 2 tasks en producción; autoscaling CPU target 60%; pre-scaling 8am y 2pm días hábiles
- Redis Multi-AZ con failover automático habilitado
- RDS Multi-AZ para RDS central y por clínica en producción

---

## 5. Arquitectura del Código (Monorepo)

### 5.1 Estructura del Repositorio

El proyecto utiliza **Turborepo** para orquestar la arquitectura de APIs Federadas. El monolito ha sido descompuesto.

```text
AROS_PACS/
├── apps/
│   ├── core-api/ ← AROS Core API (Django IdP & Gateway)
│   │   ├── auth/ ← JWT RS256, JWKS endpoint, refresh token blacklist
│   │   ├── gateway/ ← Ruteo federado: S2S JWT + httpx stream + Circuit Breaker
│   │   └── models/ ← User (email_hash, email_encrypted), FederationIDMap,
│   │                  ClinicRegistry, Roles, ConsentRecord
│   │                  [SIN PatientProfile — la PHI reside en cada clínica]
│   │
│   ├── clinic-api/ ← Clinic Internal API (Django/FastAPI)
│   │   ├── api/ ← Endpoints de gestión local (GET /studies/, POST /reports/)
│   │   │         Verifica S2S JWT en cada request entrante
│   │   ├── webhooks/ ← Recibe OnStableStudy; valida HMAC-SHA256 del payload
│   │   └── models/ ← PatientProfile (PHI), StudyRequest, Study, Report
│   │                  (Guardados en RDS Clínica — soberanía de la clínica)
│   │
│   ├── patient-portal/ ← Next.js — Portal Paciente
│   ├── clinic-portal/ ← Next.js — Portal Clínica
│   └── dicom-viewer/ ← OHIF Viewer (con prefetching configurado)
├── packages/
│   ├── types/ ← Tipos TypeScript
│   ├── api-client/ ← Axios client
│   └── ui/ ← shadcn/ui componentes
└── infra/ ← Terraform Modules
```

### 5.2 Flujo de Datos: Adquisición y Vinculación (APIs Federadas)

El AROS Core API actúa como pasarela autenticada con S2S JWT; las clínicas manejan sus propios datos.

```text
┌─ MOMENTO 1: REGISTRO DE LA ORDEN ────────────────────────────────────────────┐
│                                                                              │
│ ASISTENTE    PORTAL CLÍNICA   AROS CORE API         TGW    CLINIC API  CLINIC RDS
│    │               │               │                  │         │           │
│    │─ registrar ──►│               │                  │         │           │
│    │  solicitud    │─ POST /req/ ─►│                  │         │           │
│    │               │               │─ Enruta ─────────►│         │           │
│    │               │               │  [Authorization: Bearer {user_jwt}]    │
│    │               │               │  [X-Core-Service-Token: {s2s_jwt}] ──►│
│    │               │               │                  │── POST /req/ ──────►│
│    │               │               │                  │         │── INSERT ─►│
│    │               │               │                  │         │◄─{acc_num}─│
│    │               │               │◄─{acc_num}───────│◄────────│           │
│    │◄─{acc_num}────│               │                  │         │           │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 2: ADQUISICIÓN Y TRANSMISIÓN AUTOMÁTICA (Aislado en VPC local) ─────┐
│                                                                              │
│ TÉCNICO   MÁQUINA DICOM   ORTHANC PACS          CLINIC INTERNAL API  CLINIC RDS
│    │           │               │                        │                │
│    │─ realiza─►│               │                        │                │
│    │  estudio  │── C-STORE ───►│                        │                │
│    │           │               │ (StorageCache: indexa  │                │
│    │           │               │  en disco + persiste   │                │
│    │           │               │  en S3 en background)  │                │
│    │           │               │── Webhook ─────────────►│ (Verifica      │
│    │           │               │  OnStableStudy         │  HMAC-SHA256   │
│    │           │               │  + HMAC-SHA256 payload) │  del payload)  │
│    │           │               │                        │── UPDATE Study─►│
│                                                                              │
│ [El AROS Core API no interviene en este flujo. Todo ocurre en la VPC local.] │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 3: LECTURA Y DIAGNÓSTICO ───────────────────────────────────────────┐
│                                                                              │
│ RADIÓLOGO  PORTAL CLÍNICA  AROS CORE API    TGW     CLINIC API    CLINIC RDS
│    │             │               │           │           │              │
│    │─ ver cola ─►│               │           │           │              │
│    │             │─ GET /stud. ─►│           │           │              │
│    │             │               │─ [user_jwt│           │              │
│    │             │               │   s2s_jwt]►│── GET /stud/────────────►│
│    │             │               │           │           │◄─[estudios]──│
│    │             │               │◄─[datos]──│◄──────────│              │
│    │◄─ lista ────│               │           │           │              │
│    │             │               │           │           │              │
│    │── POST /rep/►│── POST /rep/─►│[s2s_jwt]─►│─ POST /rep/────────────►│
│    │             │               │           │           │─ INSERT Rep─►│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Flujo de Datos: El Paciente Ve su Radiografía (Federated Query con Resiliencia y Streaming)

#### Federated Query — Historial del Paciente

El Core API implementa los patrones de **Timeout**, **Circuit Breaker** y **respuesta de historial parcial**:

```python
# En core-api/gateway/federated_query.py (referencia de implementación)
import asyncio, httpx
from pybreaker import CircuitBreaker

breakers = {}  # Un Circuit Breaker por clínica

async def get_patient_history(user_uuid: str) -> dict:
    clinics = await get_authorized_clinics(user_uuid)  # 1 query con select_related()
    s2s_token = generate_s2s_jwt(audience="clinic-internal")

    async def fetch_clinic(clinic):
        breaker = breakers.setdefault(clinic.slug, CircuitBreaker(fail_max=5, reset_timeout=60))
        try:
            with breaker:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        clinic.internal_url + "/api/v1/studies/",
                        headers={
                            "Authorization": f"Bearer {user_jwt}",
                            "X-Core-Service-Token": s2s_token,
                        }
                    )
                    return {"clinic": clinic.slug, "studies": resp.json(), "ok": True}
        except Exception:
            return {"clinic": clinic.slug, "studies": [], "ok": False}

    results = await asyncio.gather(*[fetch_clinic(c) for c in clinics])
    failed  = [r["clinic"] for r in results if not r["ok"]]
    studies = [s for r in results for s in r["studies"]]

    return {
        "studies": studies,
        "partial_history": len(failed) > 0,
        "unavailable_sources": failed,
    }
```

#### Proxy WADO-RS — Streaming sin Buffering en RAM

> [!IMPORTANT]
> **[PERF-01]** El proxy WADO-RS **NUNCA** debe cargar el archivo DICOM completo en memoria. Con 10 radiólogos concurrentes y estudios de TAC de 250MB, el buffering completo en Django provocaría OOM Kill del ECS task. La implementación correcta usa `StreamingHttpResponse` + `httpx.stream()`:

```python
# En core-api/gateway/dicom_proxy.py (referencia de implementación)
from django.http import StreamingHttpResponse

async def wado_rs_proxy(request, slug, **kwargs):
    """
    Proxy WADO-RS con streaming chunk-by-chunk.
    Django nunca tiene el archivo completo en RAM.
    """
    orthanc_url = build_orthanc_url(slug, **kwargs)
    s2s_token   = generate_s2s_jwt(audience=f"clinic-{slug}")

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "GET", orthanc_url,
                headers={"X-Core-Service-Token": s2s_token},
                timeout=30.0
            ) as response:
                async for chunk in response.aiter_bytes(chunk_size=65_536):  # 64 KB chunks
                    yield chunk

    response = StreamingHttpResponse(
        stream_generator(),
        content_type=request.headers.get("Accept", "application/octet-stream"),
    )
    return response
```

**Estimación de latencia con optimizaciones aplicadas:**

| Métrica | Sin optimizaciones | Con StorageCache + Streaming |
|---|---|---|
| Primer frame (estudio reciente) | ~205ms P50, ~600ms P99 | ~45ms P50, ~120ms P99 |
| Historial paciente (3 clínicas) | ~155ms (con N+1 queries) | ~65ms (con `select_related()`) |
| Concurrencia 20 radiólogos | Riesgo OOM → reinicio ECS | Estable (streaming chunk-by-chunk) |

```text
PACIENTE      PORTAL PACIENTE    AROS CORE API              TGW      CLINIC API (A)  CLINIC API (B)
   │                │                  │                     │             │               │
   │─ver historial─►│                  │                     │             │               │
   │                │─ GET /history/ ─►│                     │             │               │
   │                │                  │─ [s2s_jwt+timeout]─►│─ req A ─────►              │
   │                │                  │─ [s2s_jwt+timeout]─►│─────────────────────────────►│ req B
   │                │                  │◄─ datos A ──────────│◄────────────│               │
   │                │                  │◄─ datos B ──────────│◄────────────────────────────│
   │                │                  │ (Circuit Breaker si  │             │               │
   │                │                  │  alguna falla)       │             │               │
   │◄─ unificado ───│◄─ {json} ────────│                     │             │               │
   │  (o parcial    │   partial=false  │                     │             │               │
   │   con banner)  │                  │                     │             │               │
```

> [!NOTE]
> Si la Clínica A falla, el Core API devuelve `{ "studies": [...datos_B...], "partial_history": true, "unavailable_sources": ["clinic-san-jose"] }`. El Portal Paciente muestra un banner informativo. El sistema nunca queda bloqueado.

---

## 6. Infraestructura Cloud (AWS Organizations)

### 6.1 Diagrama de Infraestructura Multi-Cuenta

```text
┌──────────────────────────── AWS ORGANIZATION (aros-mgmt) ──────────────────────────────────┐
│                                                                                            │
│  ┌──────────────────────── OU: Core Services ─────────────────────────────────────────┐   │
│  │  CUENTA: aros-core  (VPC: 10.0.0.0/16)                                             │   │
│  │                                                                                     │   │
│  │  Route 53:  api.arospacs.com  ──► ALB Público AROS Core                             │   │
│  │             *.arospacs.com    ──► AWS Amplify (portales Next.js)                    │   │
│  │                                                                                     │   │
│  │  Subnets Públicas:                                                                  │   │
│  │    ALB Público → ECS AROS Core API (Django 5.2 LTS)                                 │   │
│  │      [min 2 tasks, autoscale CPU>60%, pre-scale 8am/2pm días hábiles]               │   │
│  │    ALB Público → ECS OHIF Viewer                                                    │   │
│  │                                                                                     │   │
│  │  Subnets Privadas:                                                                  │   │
│  │    ECS Core API ─ httpx.stream() ──► TGW ──► Orthanc (WADO-RS streaming)           │   │
│  │    ECS Core API ─ httpx+S2SJWT+CB ─► TGW ──► Clinic API (Federated Query)         │   │
│  │                                                                                     │   │
│  │  RDS PostgreSQL 16 — SOLO IDENTIDAD, SIN PHI                                        │   │
│  │    ↑ AWS RDS Proxy (connection pooling warm — latencia 2ms vs 50ms)                 │   │
│  │    · User(email_hash, email_encrypted), FederationIDMap, ClinicRegistry             │   │
│  │    · ConsentRecord, Roles                                                           │   │
│  │                                                                                     │   │
│  │  ElastiCache Redis 7 (Multi-AZ, failover automático)                                │   │
│  │    · WebSockets channel layer                                                       │   │
│  │    · Refresh Token JTI Blacklist (TTL = 7 días)                                     │   │
│  │                                                                                     │   │
│  │  Secrets Manager: JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, EMAIL_KMS_KEY, DB_URL            │   │
│  │                                                                                     │   │
│  │  Transit Gateway (TGW) — compartido via RAM a OU Clinic Workloads                   │   │
│  │    10.0.0.0/16 → Core VPC · 10.1.0.0/16 → clinic-san-jose                          │   │
│  │    10.2.0.0/16 → clinic-radiologia-norte · 10.N.0.0/16 → clinic-{N}                │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                            │
│  ┌──────────────────────── OU: Clinic Workloads ──────────────────────────────────────┐   │
│  │                                                                                     │   │
│  │  ┌── CUENTA: clinic-san-jose (VPC: 10.1.0.0/16) ──────────────────────────────┐   │   │
│  │  │  TGW Attachment ◄── TGW (aros-core)                                         │   │   │
│  │  │  ALB Interno (Security Group: solo acepta CIDR 10.0.0.0/16)                 │   │   │
│  │  │       │                                                                     │   │   │
│  │  │       ├── ECS Fargate (Clinic Internal API) [min 2 tasks]                   │   │   │
│  │  │       │     · Verifica S2S JWT (iss: aros-core, aud: clinic-san-jose)       │   │   │
│  │  │       │     · Valida HMAC-SHA256 del payload de webhook Orthanc             │   │   │
│  │  │       │     · Health: GET /health/ y GET /ready/                            │   │   │
│  │  │       │     └── RDS PostgreSQL (via RDS Proxy): PatientProfile PHI          │   │   │
│  │  │       │                         StudyRequest, Study, Report                 │   │   │
│  │  │       │                                                                     │   │   │
│  │  │       └── ECS Fargate (Orthanc PACS)                                        │   │   │
│  │  │             · DICOM C-STORE Puerto 4242                                     │   │   │
│  │  │             · StorageCache 512MB (latencia frame: ~5ms vs ~150ms S3)        │   │   │
│  │  │             · Plugin S3 → orthanc-san-jose-123456789012-dicom               │   │   │
│  │  │             · Webhook → Clinic API con HMAC-SHA256 del payload              │   │   │
│  │  │             · Health: GET / en puerto 8042                                  │   │   │
│  │  │                                                                             │   │   │
│  │  │  Secrets Manager local: CLINIC_DB_URL, JWT_PUBLIC_KEY,                      │   │   │
│  │  │    ORTHANC_WEBHOOK_SECRET, ORTHANC_WEBHOOK_HMAC_SECRET                      │   │   │
│  │  │  CloudTrail: audit trail HIPAA (propiedad de la clínica)                    │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                     │   │
│  │  ┌── CUENTA: clinic-radiologia-norte (VPC: 10.2.0.0/16) ──────────────────────┐   │   │
│  │  │  (Estructura idéntica — completamente aislada)                              │   │   │
│  │  │  · S3: orthanc-radiologia-norte-{aws_account_id}-dicom                     │   │   │
│  │  └─────────────────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                            │
│  ┌──────────────────────── OU: Security & Logging ────────────────────────────────────┐   │
│  │  CUENTA: aros-security                                                              │   │
│  │  · AWS Security Hub · AWS Config (HIPAA rules) · CloudTrail Lake                   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Estrategia Terraform: Estado Desacoplado

*   **`infra/accounts/core/`**: Despliega infraestructura compartida (Django, TGW, RDS Core, RDS Proxy, Redis Multi-AZ).
*   **`infra/accounts/clinic-template/`**: Clonado por clínica. El pipeline inicializa con `backend-config` apuntando a `s3://aros-tf-state/clinics/{slug}/terraform.tfstate`.

**ECS Autoscaling y Pre-scaling (Terraform):**

```hcl
# infra/accounts/core/ecs_autoscaling.tf
resource "aws_appautoscaling_policy" "core_api_cpu" {
  policy_type = "TargetTrackingScaling"
  target_tracking_scaling_policy_configuration {
    target_value = 60.0  # Escalar antes de saturar (no esperar al 80%)
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Pre-scaling antes de los picos conocidos de radiología
resource "aws_appautoscaling_scheduled_action" "morning_scaleup" {
  schedule    = "cron(0 14 ? * MON-FRI *)"  # 8am CST = 14:00 UTC
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
  scalable_target_action {
    min_capacity = 4
    max_capacity = 10
  }
}
```

### 6.3 Modelo de Costos

*(Pendiente de elaborar según demanda de clínicas onboarded.)*

---

## 7. Seguridad

### 7.1 Autenticación — JWT RS256, JWKS y Doble Token

| Token | Duración | Dónde se guarda | Accesible por JS |
|---|---|---|---|
| **Access Token** | 15 minutos | En memoria RAM del navegador (Zustand store) | Sí (intencional, en memoria) |
| **Refresh Token** | 7 días | Cookie HttpOnly + Secure + SameSite=Strict | **No** — inmune a XSS |

**Esquema de firma RS256 — Criptografía Asimétrica:**

El sistema utiliza **RS256 (RSA + SHA-256)** con separación de responsabilidades crítica para el ecosistema multi-clínica:

| Actor | Clave que posee | Operación permitida |
|---|---|---|
| **AROS Core API** | 🔑 **Llave Privada RSA** — solo en Secrets Manager de `aros-core` | **Firma** JWT de usuarios + **firma** S2S JWT de servicio |
| **Clinic Internal APIs** | 🔓 **Llave Pública RSA** — distribuida vía Terraform | **Verifica** firma de JWT de usuarios y S2S JWT. No puede emitir tokens. |

> [!IMPORTANT]
> **[SEC-03] JWKS Endpoint y Rotación de Llaves:** El Core API publica un endpoint estándar para distribución dinámica de llaves públicas:
>
> ```
> GET https://api.arospacs.com/api/v1/.well-known/jwks.json
> → { "keys": [ { "kid": "2026-Q3", "kty": "RSA", "alg": "RS256", "n": "...", "e": "AQAB" } ] }
> ```
>
> Todos los JWT incluyen el claim `kid` (Key ID) en el header. Las Clinic APIs cachean el JWKS con TTL de 1 hora. La **rotación trimestral** de la llave RSA se automatiza con AWS Secrets Manager rotation + Lambda. El periodo de gracia permite dos llaves activas simultáneamente durante la transición.

> [!IMPORTANT]
> **[SEC-02] S2S JWT — Zero Trust Network entre Core y Clinic APIs:** Cada llamada del Core API hacia un Clinic API incluye el header `X-Core-Service-Token` con un JWT de corta duración (5 min) firmado con la llave privada del Core, con claims `iss: aros-core`, `aud: clinic-{slug}`. Esto garantiza que incluso dentro de la red privada del TGW, cada request está autenticado. Si un recurso interno de `aros-core` fuera comprometido, no podría emitir S2S tokens válidos sin acceso a la llave privada.

**[SEC-05] Revocación de Refresh Tokens con Redis Blacklist:**

```python
# En core-api/auth/views.py
def logout(request):
    payload = decode_jwt(request.COOKIES.get("refresh_token"))
    jti = payload["jti"]   # UUID único generado en emisión del token
    ttl = 7 * 24 * 3600    # Expirar la entrada del blacklist al mismo tiempo que el token
    redis_client.setex(f"blacklist:jti:{jti}", ttl, "1")
    response.delete_cookie("refresh_token")
    return response

# En el middleware de verificación de refresh token
def verify_refresh_token(token: str):
    payload = decode_jwt_rs256(token)
    if redis_client.get(f"blacklist:jti:{payload['jti']}"):
        raise TokenRevoked("Token ha sido revocado")
```

El Refresh Token queda revocado en O(1) instantáneamente al logout, sin esperar su expiración natural de 7 días. Crítico cuando un empleado es dado de baja o un paciente reporta pérdida de dispositivo.

### 7.2 Seguridad de Orthanc y Autenticación HMAC de Webhooks

- La API REST y los endpoints DICOMweb de Orthanc **no están expuestos a internet**
- El ALB de Orthanc es **interno** (accesible únicamente dentro de la VPC privada)
- Las credenciales de admin de Orthanc se guardan en AWS Secrets Manager
- **[SEC-04] Webhook autenticado con HMAC-SHA256:** El webhook `OnStableStudy` incluye el header `X-Orthanc-Webhook-Signature: sha256={HMAC}` donde el HMAC se calcula sobre el payload completo con el secreto local. El `Clinic Internal API` verifica la firma antes de procesar. Esto previene replay attacks y garantiza la integridad del payload, incluso si el tráfico de VPC fuera interceptado.

```python
# En clinic-api/webhooks/views.py
import hmac, hashlib

def validate_orthanc_webhook(request) -> None:
    secret   = settings.ORTHANC_WEBHOOK_HMAC_SECRET.encode()
    body     = request.body
    received = request.headers.get("X-Orthanc-Webhook-Signature", "")

    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(received, expected):
        raise PermissionDenied("Webhook signature inválida")
```

### 7.3 Autorización — Permisos en Capas

Cada petición pasa por 4 capas de verificación:

1. **JWT RS256 válido** — verificado con llave pública RSA, `kid` resuelto vía JWKS
2. **S2S JWT válido** (solo para requests Core→Clinic) — `iss: aros-core`, `aud: clinic-{slug}`
3. **Rol correcto** — claim `role` del JWT del usuario coincide con el permiso requerido
4. **Queryset filtrado + verificación de objeto** — solo registros del usuario/clínica autenticados

### 7.4 Protección contra Ataques Comunes

| Vector de Ataque | Mitigación implementada |
|---|---|
| **XSS** | Refresh Token en cookie HttpOnly; Access Token en memoria RAM (no localStorage) |
| **CSRF** | JWT en headers + `SameSite=Strict` en cookie de Refresh Token |
| **Brute Force (login)** | Throttle: 10 intentos/hora por IP en `/auth/login/` |
| **Scraping / DDoS** | Throttle global: 50 req/hora (anónimos), 500 req/hora (autenticados) |
| **Man-in-the-Middle** | HTTPS obligatorio + HSTS de 1 año |
| **Clickjacking** | `X-Frame-Options: DENY` |
| **MIME Sniffing** | `X-Content-Type-Options: nosniff` |
| **Exposición de credenciales** | AWS Secrets Manager; email hasheado + cifrado en RDS central |
| **Endpoint abierto accidental** | `IsAuthenticated` como permiso global por defecto en DRF |
| **Acceso no autorizado a Orthanc** | ALB de Orthanc es interno; sin ruta pública directa |
| **Falsificación de tokens (compromiso de clínica)** | RS256 asimétrico: llave privada solo en `aros-core`; clínicas solo verifican |
| **Movimiento lateral dentro de VPC** | S2S JWT requerido en cada llamada Core→Clinic (Zero Trust Network) |
| **Webhook forjado o manipulado** | HMAC-SHA256 del payload; `compare_digest` para evitar timing attacks |
| **Session hijacking post-logout** | Refresh Token JTI en blacklist Redis; revocación instantánea |
| **Exposición de PHI en sistema central** | `PatientProfile` y toda PHI solo en RDS de cada clínica |
| **Correlación de identidad en breach de RDS central** | Email almacenado como `email_hash` (SHA-256) + `email_encrypted` (AES-256 KMS) |
| **Colisión de nombres de bucket S3** | Naming convention `orthanc-{slug}-{aws_account_id}-dicom` garantiza unicidad global |

---

### 7.5 Beneficios de Cumplimiento — Arquitectura "Zero-Data" y HIPAA

| Salvaguarda HIPAA | Estado en v3.1.0 |
|---|---|
| **§164.312(a)(1)** — Control de acceso | ✅ JWT RS256 + S2S JWT + Roles + Object-level permissions + ConsentRecord |
| **§164.312(a)(2)(iv)** — Cifrado en reposo | ✅ S3 KMS + RDS encryption + email_encrypted AES-256 |
| **§164.312(c)(1)** — Integridad | ✅ HMAC-SHA256 en webhooks + JWT signature |
| **§164.312(d)** — Autenticación de entidad | ✅ RS256 JWT + S2S JWT + Refresh Token blacklist |
| **§164.312(e)(1)** — Control de transmisión | ✅ HTTPS + HSTS + TGW privado |
| **§164.308(a)(5)(ii)(D)** — Log de actividad | ✅ CloudTrail + audit log de acceso a PHI en aplicación |
| **§164.308(a)(7)** — Contingency Plan | ⚠️ RTO/RPO pendiente de definir formalmente |

La adopción estricta de "Zero Clinical Data Retention" en `aros-core` descentraliza la responsabilidad legal. Un compromiso del sistema central no expone historiales clínicos, imágenes, diagnósticos ni datos demográficos — ya que estos nunca residen en `aros-core`.

---

## 8. Plan de Implementación — Tareas

### Fase 0 — Preparación del Monorepo y Turborepo *(Día 1-2)*

- [x] Inicializar Turborepo en la raíz del repositorio con `npx create-turbo@latest`
- [x] Configurar pnpm workspaces en el `package.json` raíz
- [x] Crear la estructura base de `apps/`: `core-api/`, `clinic-api/`, `patient-portal/`, `clinic-portal/`, `dicom-viewer/`
- [x] Crear la estructura base de `packages/`: `types/`, `api-client/`, `ui/`
- [x] Crear `turbo.json` con pipeline de tareas (dev, build, lint, type-check)
- [x] Configurar el `tsconfig.json` base compartido en `packages/`
- [x] Validar que `turbo run dev` levanta todos los workspaces correctamente

### Fase 1 — Arquitectura del Monorepo *(Semana 1)*

- [x] Crear la estructura `apps/core-api/` (Identity Provider & Gateway) con Django 5.2 LTS.
- [x] Crear la estructura `apps/clinic-api/` (Microservicio de la clínica).
- [x] Definir modelos en `core-api`: `User` (con `email_hash`, `email_encrypted`, `password` Argon2, `uuid`), `FederationIDMap`, `ClinicRegistry`, `Roles`, `ConsentRecord`.
- [x] Definir modelos en `clinic-api`: `PatientProfile` (PHI), `StudyRequest`, `Study`, `Report`.
- [x] Crear migraciones y aplicar **índices críticos** de BD en ambos RDS:
  - `idx_federation_user_clinic` en `FederationIDMap`
  - `idx_studyreq_accession` (UNIQUE) en `StudyRequest`
  - `idx_study_patient_date` en `Study`
  - `idx_consent_user_clinic` en `ConsentRecord`
- [x] Definir health check endpoints: `GET /health/` y `GET /ready/` en `core-api` y `clinic-api`.

### Fase 2 — Autenticación RS256, JWKS y Blacklist en AROS Core API *(Semana 2)*

- [x] Generar par de llaves RSA (privada/pública) y almacenar en Secrets Manager de `aros-core`.
- [x] Configurar `djangorestframework-simplejwt` con RS256 y claim `kid` en el header de cada JWT.
- [x] Implementar endpoint **`GET /api/v1/.well-known/jwks.json`** que publica la llave pública activa.
- [x] Configurar rotación automática de llave RSA en Secrets Manager (Lambda rotation, período 90 días).
- [x] Implementar lógica de **soporte para múltiples llaves activas** durante periodos de transición.
- [x] Implementar **Refresh Token Blacklist** en Redis: guardar JTI en `setex` al logout; verificar en cada uso del refresh endpoint.
- [x] Configurar `CONN_MAX_AGE = 60` en `settings.py` para connection pooling básico.
- [x] Implementar cifrado del email con KMS (`email_hash` + `email_encrypted`) en el flujo de registro.
- [x] Configurar middleware de seguridad y CORS.

### Fase 3 — Federated Query, S2S JWT y Proxy WADO-RS *(Semana 2-3)*

- [x] Implementar generador de **S2S JWT** (`iss: aros-core`, `aud: clinic-{slug}`, `exp: +5min`) firmado con la llave privada RSA.
- [x] Integrar `S2S JWT` como header `X-Core-Service-Token` en todas las llamadas httpx del gateway hacia Clinic APIs.
- [x] Implementar Federated Query con `asyncio.gather()` + `select_related()` en la query de `FederationIDMap` (evitar N+1).
- [x] Implementar **Timeout** configurable (5s por defecto) en cada llamada httpx a Clinic API.
- [x] Implementar **Circuit Breaker** con `pybreaker` (un breaker por clínica, `fail_max=5`, `reset_timeout=60`).
- [x] Implementar lógica de **historial parcial**: retornar `partial_history: true` y `unavailable_sources` cuando alguna clínica falla.
- [x] Verificar `ConsentRecord` antes de incluir cada clínica en el Federated Query.
- [x] Implementar proxy WADO-RS con **`StreamingHttpResponse` + `httpx.stream()`** (chunk de 64KB, sin buffering RAM).
- [x] Configurar proxy WADO-RS hacia los ALBs/Peer2Peer internos de las clínicas.

### Fase 4 — Clinic Internal API: S2S JWT, HMAC y Webhooks *(Semana 3-4)*

- [x] Configurar `clinic-api` para verificar **S2S JWT** en cada request entrante (usando llave pública distribuida por Terraform).
- [x] Implementar endpoints en `clinic-api` para gestionar `PatientProfile`, `StudyRequest` y `Report`.
- [x] Implementar receptor de Webhooks en `clinic-api` con validación **HMAC-SHA256** del payload usando `hmac.compare_digest`.
- [x] Retornar `HTTP 401` si el header `X-Orthanc-Webhook-Signature` falta o es inválido.
- [x] Dockerizar el `clinic-api` con health checks configurados en Dockerfile.

### Fase 5 — Configuración de Orthanc PACS con StorageCache *(Semana 4)*

- [x] Configurar `orthanc.json` con bucket `orthanc-{slug}-{aws_account_id}-dicom`.
- [x] Activar **`StorageCache`** con 512MB en la configuración de Orthanc para minimizar lecturas de S3.
- [x] Configurar webhook `OnStableStudy` con el header `X-Orthanc-Webhook-Secret` y el campo `Secret` para HMAC-SHA256 del payload.
- [x] Verificar que el Clinic API rechaza con `HTTP 401` webhooks con firma HMAC inválida.
- [x] Verificar health check: `GET /` en puerto 8042 responde en < 200ms con plugins cargados.
- [x] Confirmar que el bucket S3 está en la **misma región AWS** que el ECS task de Orthanc (latencia mínima S3).

### Fase 6 — Portales Frontend *(Semana 5-7)*

- [x] Conectar Portal Clínica y Portal Paciente al AROS Core API.
- [x] Implementar banner de **"historial parcial"** en el Portal Paciente cuando `partial_history: true`.
- [x] Configurar OHIF con prefetching de 10 frames (`maxNumRequests.prefetch = 10`).
- [x] Renderizar visor OHIF utilizando la ruta proxy WADO-RS del Core API (con streaming).
- [x] Implementar flujo de UI para gestión de `ConsentRecord` (autorizar/revocar clínicas).

### Fase 7 — Terraform: Aprovisionamiento Automatizado *(Semana 8-9)*

- [ ] Módulo central `aros-core`: ECS Core API (mín 2 tasks), RDS Central (sin PHI), TGW, **RDS Proxy**, **Redis Multi-AZ**.
- [ ] Configurar **ECS Autoscaling**: CPU target 60%; `min_capacity = 2`; pre-scaling 8am y 2pm días hábiles (cron).
- [ ] Módulo de aprovisionamiento de Clínica ("Plug & Play"):
  - [ ] ALB Interno (Security Group CIDR `10.0.0.0/16` únicamente).
  - [ ] ECS Fargate para **Orthanc PACS** con `StorageCache`, bucket `orthanc-{slug}-{aws_account_id}-dicom`, misma región S3.
  - [ ] ECS Fargate para **Clinic Internal API** (mín 2 tasks) con `JWT_PUBLIC_KEY` y secretos HMAC.
  - [ ] RDS PostgreSQL local con **RDS Proxy** (PatientProfile PHI, Studies, Reports, schema Orthanc).
  - [ ] S3 Bucket con naming `orthanc-{slug}-{aws_account_id}-dicom`; KMS, versionado, sin acceso público.
  - [ ] Secrets Manager local: `ORTHANC_WEBHOOK_SECRET`, `ORTHANC_WEBHOOK_HMAC_SECRET` (generados con `random_password`), `JWT_PUBLIC_KEY`.
  - [ ] Configurar **RDS encryption at rest** habilitado (`storage_encrypted = true`) en Terraform.
- [ ] Probar el despliegue automático de una clínica nueva y la interconexión por TGW.
- [ ] Verificar que el Circuit Breaker se activa correctamente al simular un Clinic API caído.

---

## 9. Resumen de Tecnologías

```
Backend (Django) ────────────────────────────────────────────────────
Python 3.12 · Django 5.2 LTS · Django REST Framework 3.15
SimpleJWT (RS256 + JWKS + kid) · PyJWT/cryptography · Argon2 password hashing
Django Channels 4 · Daphne (WebSockets) · Gunicorn+uvicorn (REST HTTP)
boto3 · httpx 0.27 (stream() + Timeout + Circuit Breaker) · pybreaker
WeasyPrint · PostgreSQL 16 · Redis 7 (Multi-AZ: WebSockets + JTI Blacklist)
AWS RDS Proxy (connection pooling) · CONN_MAX_AGE=60

PACS / Imaging ──────────────────────────────────────────────────────
Orthanc Core 1.12.11 (GPLv3+) · StorageCache 512MB (latencia frame: ~5ms)
Plugin DICOMweb (AGPLv3+) · Protocolo: WADO-RS / STOW-RS / QIDO-RS
Plugin PostgreSQL (AGPLv3+) · Plugin AWS S3 Object Storage (AGPLv3+)

Visor DICOM ─────────────────────────────────────────────────────────
OHIF Viewer v3 (MIT) · Cornerstone.js 3 · Nginx 1.25
Prefetching: 10 frames en background

Frontend ────────────────────────────────────────────────────────────
TypeScript 5 · Next.js 15 (App Router) · React 19
Tailwind CSS 4 · shadcn/ui · Radix UI
Zustand 5 · TanStack Query 5 · Axios 1

Monorepo ────────────────────────────────────────────────────────────
Turborepo 2 · pnpm 9

Cloud (AWS) ─────────────────────────────────────────────────────────
ECS Fargate (min 2 tasks, CPU autoscale 60%, pre-scale 8am/2pm)
RDS PostgreSQL 16 Core (sin PHI) + RDS por clínica (PHI soberana)
AWS RDS Proxy · ElastiCache Redis 7 (Multi-AZ)
2 ALBs en aros-core (Django, OHIF) + 1 ALB interno por clínica
AWS Amplify · S3 orthanc-{slug}-{aws_account_id}-dicom (KMS, versionado)
Secrets Manager · ECR · Route 53 · ACM · IAM · CloudWatch · CloudTrail

Security ────────────────────────────────────────────────────────────
JWT RS256 + JWKS endpoint + kid + rotación trimestral
S2S JWT (Zero Trust Network Core→Clinic)
Refresh Token JTI Blacklist (Redis, O(1))
HMAC-SHA256 en webhooks Orthanc→Clinic API
email_hash (SHA-256) + email_encrypted (AES-256 KMS)
ConsentRecord (autorización paciente por clínica)

Infrastructure as Code ──────────────────────────────────────────────
Terraform 1.6+ (HCL) · S3 Backend + DynamoDB Lock
ECS Autoscaling + Scheduled Pre-scaling

Contenedores ────────────────────────────────────────────────────────
Docker · Dockerfile (Django · Orthanc personalizado · OHIF)
Health checks: GET /health/, GET /ready/, GET / (Orthanc)
```

---

*Documento de referencia técnica elaborado para los anexos de la tesis de Ingeniería en Sistemas Computacionales.*
*La arquitectura presentada implementa los estándares médicos abiertos DICOM 3.0 y DICOMweb, principios SOLID, arquitectura limpia orientada a sistemas de grado empresarial, AWS Well-Architected Framework (Security + Performance Efficiency Pillars) y salvaguardas HIPAA §164.312.*
