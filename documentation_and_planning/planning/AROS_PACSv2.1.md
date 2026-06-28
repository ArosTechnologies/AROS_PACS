# AROSPACS v2 — Arquitectura y Plan de Implementación con PACS Orthanc

> **Documento de referencia técnica para tesis**
> Versión: 2.0 | Fecha: Junio 2026
> Proyecto: Sistema de Registros Médicos Electrónicos con Arquitectura Multi-Clínica y PACS Descentralizado

---

## 1. Visión General del Producto Final

AROSPACS v2 es una **plataforma SaaS de registros médicos electrónicos** que permite a múltiples clínicas de radiología gestionar estudios de imágenes diagnósticas utilizando estándares médicos abiertos, mientras los pacientes pueden acceder a su historial médico universal desde cualquier lugar.

La plataforma se compone de **cinco sistemas independientes** que colaboran como un ecosistema cohesivo:

| # | Sistema | Descripción | Quién lo usa | Visibilidad |
|---|---|---|---|---|
| 1 | **API Backend (Django)** | Cerebro central: gestiona identidades, datos clínicos, seguridad y autorización | Ningún usuario final | Invisible |
| 2 | **Portal Paciente** | Aplicación web donde el paciente consulta su historial médico universal | Todos los pacientes | Visible |
| 3 | **Portal Clínica** | Aplicación web para el personal interno de la clínica | Administradores, Asistentes, Radiólogos | Visible |
| 4 | **Visor DICOM (OHIF)** | Plataforma de visualización de imágenes radiológicas en el navegador | Radiólogos y Pacientes | Visible |
| 5 | **Servidor PACS (Orthanc)** | Core de almacenamiento y comunicación médica; orquesta todos los flujos de imágenes DICOM mediante estándares DICOMweb | Ningún usuario final | **Invisible pero vital** |

> [!NOTE]
> Orthanc actúa como el **puente de infraestructura médica** entre el almacenamiento en la nube (buckets S3 propios de cada clínica) y los sistemas que consumen las imágenes (OHIF Viewer, Django API). Ningún usuario interactúa directamente con Orthanc; su trabajo ocurre de forma transparente en la capa de red interna.

### ¿Qué puede hacer el producto final?

**El Paciente puede:**
- Iniciar sesión con email y contraseña
- Ver el historial completo de todos sus estudios radiológicos, independientemente de cuántas clínicas lo hayan atendido
- Leer el reporte diagnóstico generado y firmado por el médico radiólogo
- Visualizar sus imágenes DICOM directamente en el navegador a través del visor OHIF, que las obtiene vía el protocolo DICOMweb desde Orthanc
- Descargar sus archivos DICOM originales
- Autorizar o revocar el acceso de doctores asociados específicos a sus registros

**El Asistente de Clínica puede:**
- Iniciar sesión (el sistema lo redirige automáticamente al dashboard de asistente)
- Buscar y registrar pacientes en el sistema
- Crear solicitudes de estudio (StudyRequest) cuando llega un paciente
- Ver el listado y estado de los estudios del día
- Autorizar la creación de cuentas de medicos asociados.

**El Médico Radiólogo / Técnico Radiólogo puede:**
- Ver la cola de estudios pendientes de diagnóstico en el Portal Clínica
- Abrir el OHIF Viewer integrado para revisar las imágenes radiológicas; las imágenes llegan automáticamente al visor porque la **máquina de radiología las envió directamente a Orthanc** vía el protocolo DICOM C-STORE al concluir el estudio
- Redactar y firmar el reporte médico (hallazgos, conclusiones, recomendaciones), que Django persiste en la base de datos relacional

> [!NOTE]
> El técnico radiólogo **no sube manualmente ningún archivo**. La máquina de radiología (TAC, resonancia magnética, rayos X digital, etc.) tiene configurada la **dirección IP y el AET (Application Entity Title) de Orthanc** como destino de envío. Al concluir el estudio, la máquina lo transmite de forma automática y autónoma.

**El Administrador de Clínica puede:**
- Gestionar los usuarios de su clínica (invitar asistentes y radiólogos)
- Personalizar la identidad visual de su clínica (colores corporativos y logo) mediante el sistema de White-Labeling
- Consultar métricas generales de su clínica
- Agregar y eliminar medicos y asistentes de su clínica

**El Sistema**
- Configurar la infraestructura de AWS de cada clínica
- Configurar las credenciales del bucket S3 propio de la clínica (BYOS — Bring Your Own Storage), que Orthanc usará para almacenar y recuperar las imágenes
- Estar empaquetado para ser "Plug & Play" para una clínica, es decir, todo el sistema debe estar listo para su instalación y configuración en una clínica con solo ejecutar un comando. (Pendiente de configurar los equipos de radiología para que envíen las imágenes a Orthanc).

---

## 2. Arquitectura del Sistema

### 2.1 Paradigma: Multi-Cuenta AWS Organizations — Un Silo por Clínica

La arquitectura v2 adopta un modelo **AWS Organizations Multi-Account** donde el aislamiento entre clínicas es físico, no lógico. AROS Technologies (cuenta `aros-core`) opera la infraestructura central compartida. Cada clínica onboarded recibe su propia cuenta AWS aislada dentro de la Unidad Organizacional `Clinic Workloads`, con su propio VPC, Orthanc ECS, S3 Bucket y CloudTrail. La comunicación entre cuentas ocurre exclusivamente a través del **AWS Transit Gateway (TGW)**, que actúa como el hub de red privado.

**Por qué Multi-Cuenta y no `for_each` en una sola cuenta:**
- El plugin S3 de Orthanc lee su bucket desde **variables de entorno estáticas en el arranque** — no existe soporte de switching dinámico en runtime. Un solo cluster de Orthanc no puede servir múltiples clínicas correctamente.
- Una cuenta AWS es el límite de seguridad más fuerte que ofrece AWS. Un IAM mal configurado en un modelo de cuenta única podría filtrar datos entre clínicas. Con cuentas separadas, eso es estructuralmente imposible.
- Cada clínica tiene su propio CloudTrail, su propio billing y su propia superficie de auditoría HIPAA.
- **OHIF Viewer nunca se comunica directamente con Orthanc.** Todo el tráfico WADO-RS pasa por Django, que valida el JWT, verifica permisos y hace proxy del stream hacia el Orthanc interno de la clínica correcta vía TGW.

```
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
│  │  │  ECS Fargate — Django REST API (DRF + JWT)                                   │   │  │
│  │  │                                                                              │   │  │
│  │  │  · Autentica y autoriza todos los requests (JWT)                             │   │  │
│  │  │  · Recibe Webhooks OnStableStudy de Orthanc (cross-account via TGW)         │   │  │
│  │  │  · Proxy WADO-RS: valida JWT → resuelve orthanc_internal_url del Clinic     │   │  │
│  │  │    model → httpx.stream() hacia ALB interno de la clínica (a través de TGW) │   │  │
│  │  │  · Nunca toca archivos .dcm directamente                                    │   │  │
│  │  └──────────┬───────────────────────────────────────────┬─────────────────────┘   │  │
│  │             │                                           │                          │  │
│  │             ▼                                           ▼                          │  │
│  │  ┌─────────────────────┐                  ┌────────────────────────────────────┐  │  │
│  │  │  RDS PostgreSQL 16  │                  │  AWS Transit Gateway (TGW)         │  │  │
│  │  │  (datos clínicos)   │                  │  · Owner: aros-core                │  │  │
│  │  │  · StudyRequest      │                  │  · Compartido via AWS RAM a toda   │  │  │
│  │  │  · Study             │                  │    la OU Clinic Workloads          │  │  │
│  │  │  · Report            │                  │  · Enruta tráfico privado          │  │  │
│  │  │  · Clinic            │                  │    Django → Clinic ALB (port 8042) │  │  │
│  │  │    (orthanc_internal_│                  │  · Enruta Webhooks                 │  │  │
│  │  │     url, aws_account_│                  │    Orthanc → Django (port 8000)    │  │  │
│  │  │     id, vpc_cidr)    │                  └───────────────────┬────────────────┘  │  │
│  │  └─────────────────────┘                                      │                   │  │
│  │                                                               │ TGW Attachments   │  │
│  └───────────────────────────────────────────────────────────────┼───────────────────┘  │
│                                                                  │                      │
│  ┌─────────────────────────── OU: Clinic Workloads ──────────────┼────────────────────┐ │
│  │                                                               │                   │ │
│  │  ┌──────────────── CUENTA: clinic-san-jose ──────────────┐    │                   │ │
│  │  │  VPC: 10.1.0.0/16                                     │◄───┘                   │ │
│  │  │                                                       │                        │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │                        │ │
│  │  │  │  ALB Interno (port 8042 — solo desde TGW)       │ │                        │ │
│  │  │  └─────────────────────────┬───────────────────────┘ │                        │ │
│  │  │                            ▼                         │                        │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │                        │ │
│  │  │  │  ECS Fargate — Orthanc PACS (Core 1.12.11)      │ │                        │ │
│  │  │  │  AET: ORTHANC_SAN_JOSE                          │◄┼── DICOM C-STORE (4242)│ │
│  │  │  │  ENV: S3_BUCKET=orthanc-san-jose-dicom (static) │ │   Máquina Radiología  │ │
│  │  │  │  ENV: DB_SCHEMA=orthanc_san_jose        (static) │ │   (LAN/VPN clínica)   │ │
│  │  │  │  Webhook OnStableStudy → Django (via TGW)        │ │                        │ │
│  │  │  └──────────────────────┬──────────────────────────┘ │                        │ │
│  │  │                         │ Plugin S3                  │                        │ │
│  │  │                         ▼                            │                        │ │
│  │  │  ┌─────────────────────────────────────────────────┐ │                        │ │
│  │  │  │  S3 Bucket: orthanc-san-jose-dicom               │ │                        │ │
│  │  │  │  (privado, cifrado KMS, versionado)              │ │                        │ │
│  │  │  └─────────────────────────────────────────────────┘ │                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  │                                                                                   │ │
│  │  ┌──────────────── CUENTA: clinic-radiologia-norte ──────┐                        │ │
│  │  │  VPC: 10.2.0.0/16  (estructura idéntica a san-jose)  │                        │ │
│  │  │  · Orthanc AET: ORTHANC_RADIOLOGIA_NORTE             │                        │ │
│  │  │  · S3: orthanc-radiologia-norte-dicom                │                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  │                                                                                   │ │
│  │  ┌──────────────── CUENTA: clinic-N ─────────────────────┐                        │ │
│  │  │  VPC: 10.N.0.0/16  (provisionada por pipeline al      │                        │ │
│  │  │  onboardear una nueva clínica)                        │                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│  ┌──────────────────────── OU: Security & Logging ───────────────────────────────────┐ │
│  │  CUENTA: aros-security                                                            │ │
│  │  · AWS Security Hub (agrega hallazgos de todas las cuentas)                       │ │
│  │  · AWS Config (reglas de cumplimiento HIPAA: cifrado, acceso público bloqueado)   │ │
│  │  · CloudTrail Lake centralizado (logs de todas las cuentas)                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Flujo WADO-RS (visualización de imágenes):
  OHIF Viewer → HTTPS → api.arospacs.com/api/v1/dicom-web/{clinic_slug}/{path}
              → Django valida JWT + verifica membresía de clínica
              → httpx.stream() → TGW → ALB interno clínica → Orthanc (port 8042)
              → Orthanc lee .dcm de S3 → stream chunk a chunk de vuelta al navegador
              [Django nunca carga el archivo completo en RAM]
```

**Puntos clave del diagrama:**
- Cada clínica es una **cuenta AWS separada**: el límite de seguridad más fuerte de AWS — una política IAM mal configurada nunca puede filtrar datos entre clínicas
- Orthanc arranca con **variables de entorno estáticas**: `S3_BUCKET` y `DB_SCHEMA` se definen en el ECS Task Definition al momento del despliegue y nunca cambian en runtime
- El **AET DICOM es único por clínica** (`ORTHANC_SAN_JOSE`, `ORTHANC_RADIOLOGIA_NORTE`): las máquinas de radiología se configuran con el AET y el IP/puerto del Orthanc específico de su clínica
- **OHIF nunca se conecta directamente a Orthanc**: el WADO-RS pasa siempre por Django, que actúa como proxy autenticado y autorizado. Orthanc no tiene ruta pública
- El **Transit Gateway** es el único canal de red entre cuentas: el tráfico Django → Orthanc y Orthanc → Django (Webhook) nunca sale a internet

### 2.2 Modelo de Datos: Multi-Cuenta con Capas Aisladas por Clínica

La arquitectura separa los datos en **cuatro capas**, donde las capas 2, 3 y 4 son físicamente aisladas por clínica.

**Capa 1 — Datos textuales y relacionales (RDS centralizado en `aros-core`):**
- Perfiles de pacientes, clínicas, usuarios, solicitudes de estudio y reportes médicos
- El modelo `Clinic` almacena los campos de infraestructura que el pipeline de despliegue escribe al provisionar cada cuenta:
  - `orthanc_internal_url`: DNS del ALB interno de Orthanc (ej: `http://internal-orthanc-san-jose-123.elb.amazonaws.com:8042`) — lo usa Django para el proxy WADO-RS
  - `aws_account_id`: ID de la cuenta AWS de la clínica (ej: `123456789012`) — lo usa el pipeline de despliegue
  - `vpc_cidr`: bloque CIDR asignado a la cuenta (ej: `10.1.0.0/16`) — debe ser único y no solaparse con otras clínicas para que el TGW pueda enrutar correctamente
  - `orthanc_db_schema`: nombre del schema PostgreSQL que usa el plugin de Orthanc (ej: `orthanc_san_jose`)

**Capa 2 — Índice de imágenes DICOM (RDS PostgreSQL — schema aislado por clínica):**
- El plugin PostgreSQL de Orthanc indexa cada Study, Series e Instance con sus UIDs y metadatos DICOM
- Cada instancia de Orthanc escribe en su propio schema (ej: `orthanc_san_jose`), definido en la variable de entorno `ORTHANC__POSTGRESQL__SCHEMA` al momento del despliegue
- El schema se crea al momento de provisionar la cuenta de la clínica; nunca comparte tablas con otro schema de otra clínica
- Django guarda en `Study.orthanc_study_id` el UUID interno de Orthanc y en `Study.dicom_study_uid` el `StudyInstanceUID` DICOM estándar

**Capa 3 — Archivos binarios DICOM (S3 privado en la cuenta de la clínica):**
- Cada cuenta de clínica tiene su propio bucket S3 (`orthanc-{slug}-dicom`), creado y gestionado por Terraform al provisionar la cuenta
- El bucket es privado, con cifrado AES-256/KMS, versionado habilitado y bloqueo de acceso público total
- El plugin S3 de Orthanc usa el nombre del bucket desde la variable de entorno `ORTHANC__S3OBJECTSTORAGE__BUCKETNAME` — valor estático, nunca cambia en runtime
- Ningún componente externo a la cuenta de la clínica puede acceder al bucket

**Capa 4 — Tráfico de imágenes en tiempo real (stream cross-account via TGW):**
- Cuando OHIF solicita un frame DICOM, el request va a `api.arospacs.com/api/v1/dicom-web/{clinic_slug}/{path}` (Django)
- Django resuelve `Clinic.orthanc_internal_url`, verifica permisos y hace `httpx.stream()` hacia el ALB interno de la clínica a través del TGW
- Los bytes del `.dcm` se streaman en chunks de 64KB directamente al navegador — Django nunca carga el archivo en RAM

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│          RDS CENTRAL — aros-core  (Capa 1: datos relacionales)                          │
│                                                                                         │
│  Clinic {                              StudyRequest {      Study {                      │
│    slug: "san-jose",                     id: 7,              id: 42,                    │
│    aws_account_id: "123456789012",       patient: FK,        study_request: OneToOne→7, │
│    vpc_cidr: "10.1.0.0/16",             clinic: FK,         orthanc_study_id: "a3f",   │
│    orthanc_internal_url:                accession_number:   dicom_study_uid: "1.2.840"  │
│      "http://internal-orthanc-          "ACC-2026-0042",    clinic: FK                  │
│       san-jose.elb.amazonaws.com:8042" status: "received"  }                            │
│    orthanc_db_schema: "orthanc_san_jose"}                                               │
│  }                                                                                      │
└──────────────────────────────┬──────────────────────────────────────────────────────────┘
                               │
     ┌─────────────────────────┼───────────────────────────────────────────────────┐
     │ aros-core ← TGW ─────────────────────────────────────────────────── TGW    │
     │                         │                                                   │
     ▼                         ▼                                                   ▼
┌──────────────────┐  ┌─────────────────────────────────────────────────────────────────┐
│  Django proxy    │  │  CUENTA: clinic-san-jose                                        │
│  (Capa 4)        │  │                                                                 │
│  httpx.stream()  │  │  Orthanc PostgreSQL Schema: orthanc_san_jose  (Capa 2)          │
│  → TGW →         │  │  ┌──────────────────────────────────────────────────────────┐  │
│  ALB interno →   │  │  │ StudyInstanceUID, AccessionNumber, Series, Instances...   │  │
│  Orthanc :8042   │  │  └───────────────────────────────────┬──────────────────────┘  │
└──────────────────┘  │                                      │ Plugin S3               │
                      │                                      ▼                         │
                      │  S3 Bucket: orthanc-san-jose-dicom  (Capa 3)                   │
                      │  ┌──────────────────────────────────────────────────────────┐  │
                      │  │  s3://orthanc-san-jose-dicom/                            │  │
                      │  │  └── a3f2c1.../                                           │  │
                      │  │      ├── instance_001.dcm (850 MB)                       │  │
                      │  │      └── instance_002.dcm (820 MB)                       │  │
                      │  │  [privado · KMS · versionado · sin acceso público]       │  │
                      │  └──────────────────────────────────────────────────────────┘  │
                      └─────────────────────────────────────────────────────────────────┘
```

**El Accession Number como clave de integración cross-account:**

El **Accession Number** (campo DICOM `0008,0050`) conecta el mundo clínico con el mundo PACS a través de los límites de cuenta:

1. El asistente crea la `StudyRequest` → Django genera `accession_number = "ACC-2026-0042"` y lo guarda en el RDS central
2. El técnico ingresa ese código en la máquina de radiología antes de realizar el estudio
3. La máquina embebe el Accession Number en cada archivo `.dcm` y lo envía vía DICOM C-STORE al Orthanc de **su clínica específica** (usando el AET y el puerto 4242 configurados en la máquina)
4. Orthanc (en la cuenta `clinic-san-jose`) indexa el estudio en su schema `orthanc_san_jose`
5. Orthanc dispara el Webhook `OnStableStudy` → el request cruza el TGW → llega a Django en `aros-core`
6. Django extrae el Accession Number del payload, localiza la `StudyRequest`, crea el `Study` vinculado y actualiza el status a `"received"`

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
| **Django** | 6.0 | Framework web base |
| **Django REST Framework (DRF)** | 3.15 | Convierte Django en una API REST pura |
| **djangorestframework-simplejwt** | 5.3 | Autenticación stateless por tokens JWT |
| **django-cors-headers** | 4.4 | Permite peticiones cross-origin desde los portales |
| **drf-spectacular** | 0.27 | Genera documentación Swagger/OpenAPI automáticamente |
| **Django Channels** | 4.x | WebSockets para notificaciones en tiempo real |
| **Daphne** | 4.x | Servidor ASGI para Django Channels |
| **boto3** | 1.42 | SDK AWS para Python (Secrets Manager, S3) |
| **django-storages** | 1.14 | Integración con S3 para archivos de media (logos, firmas) |
| **WeasyPrint** | 68 | Generación de PDFs de reportes médicos |
| **PostgreSQL** (psycopg) | 16 + 3.3 | Base de datos relacional en producción |
| **SQLite** | — | Base de datos local en desarrollo |
| **Redis** | 7 | Broker de mensajes para WebSockets |
| **httpx** | 0.27 | Cliente HTTP async para llamadas internas a la API REST de Orthanc |

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

### 3.4 Servidor PACS — Orthanc (Despliegue Per-Clínica, Configuración Estática)

Orthanc es un servidor PACS ligero, open-source, orientado al protocolo DICOM. En esta arquitectura **cada clínica tiene su propia instancia de Orthanc** desplegada en su cuenta AWS aislada. No existe un Orthanc compartido. Cada instancia arranca con **variables de entorno completamente estáticas** inyectadas por Terraform al momento del despliegue.

> [!IMPORTANT]
> El plugin S3 de Orthanc **no soporta switching dinámico de buckets en runtime**. Lee el nombre del bucket desde su configuración en el arranque y mantiene esa conexión durante toda su vida. Intentar un modelo multi-tenant con un solo Orthanc y múltiples buckets es arquitecturalmente incorrecto. Por esta razón, la arquitectura adopta el modelo **una cuenta → un Orthanc → un bucket**.

| Componente | Versión / Detalle | Rol |
|---|---|---|
| **Orthanc Core** | 1.12.11 (stable) | Servidor PACS dedicado por clínica; indexa y sirve estudios DICOM |
| **SCP DICOM C-STORE** | Puerto 4242 — integrado en el core | Recibe estudios de la máquina de radiología de la clínica; el Security Group solo permite tráfico desde la red/VPN de esa clínica específica |
| **Plugin DICOMweb** | Oficial Orthanc | Expone WADO-RS, QIDO-RS en el puerto 8042 — accesible únicamente desde el ALB interno de la cuenta. **Django es el único consumidor autorizado** |
| **Plugin PostgreSQL** | Oficial Orthanc | Indexa Studies/Series/Instances en el schema `orthanc_{slug}` del RDS central, aislado de los schemas de otras clínicas |
| **Plugin AWS S3** | Oficial Orthanc | Persiste los `.dcm` en el bucket `orthanc-{slug}-dicom` de **la misma cuenta AWS**; el nombre del bucket es una variable de entorno estática |
| **Webhook `OnStableStudy`** | Nativo Orthanc | Envía `POST` a Django cuando un estudio queda estable; el request cruza el TGW desde la cuenta de la clínica hacia `aros-core`; payload incluye `AccessionNumber` |
| **API REST interna** | Nativo Orthanc (puerto 8042) | Django la usa para consultas post-webhook (metadatos, UIDs); solo accesible desde el TGW |

**Variables de entorno estáticas inyectadas por Terraform en el ECS Task Definition:**

| Variable | Valor (ejemplo clinic-san-jose) | Descripción |
|---|---|---|
| `ORTHANC__DICOMAET` | `ORTHANC_SAN_JOSE` | AET único por clínica; se configura en la máquina de radiología como destino |
| `ORTHANC__S3OBJECTSTORAGE__BUCKETNAME` | `orthanc-san-jose-dicom` | Bucket S3 exclusivo; estático, nunca cambia |
| `ORTHANC__S3OBJECTSTORAGE__REGION` | `us-east-1` | Región del bucket |
| `ORTHANC__POSTGRESQL__HOST` | `rds.core.internal` (via TGW) | Host del RDS central en `aros-core` |
| `ORTHANC__POSTGRESQL__DATABASE` | `orthanc` | Base de datos en el RDS |
| `ORTHANC__POSTGRESQL__SCHEMA` | `orthanc_san_jose` | Schema aislado de esta clínica |
| `ORTHANC__WEBHOOKS__URL` | `http://django.core.internal:8000/api/v1/webhooks/orthanc/study-stable/` | Endpoint Django via TGW |

**Endpoints DICOMweb que Orthanc expone (consumidos exclusivamente por el proxy Django):**

| Endpoint Orthanc (interno) | Endpoint público equivalente (Django proxy) | Protocolo |
|---|---|---|
| `GET /dicom-web/studies` | `GET /api/v1/dicom-web/{slug}/studies` | QIDO-RS |
| `GET /dicom-web/studies/{uid}/series` | `GET /api/v1/dicom-web/{slug}/studies/{uid}/series` | QIDO-RS |
| `GET /dicom-web/studies/{uid}/series/{s}/instances/{i}/frames/{f}` | `GET /api/v1/dicom-web/{slug}/studies/{uid}/...` | WADO-RS |

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
| **ECS Fargate** | `aros-core` | Django API + OHIF Viewer |
| **ECS Fargate** | cada `clinic-{slug}` | Una instancia de Orthanc por clínica; configuración estática |
| **RDS PostgreSQL 16** | `aros-core` | Datos relacionales de Django + schemas de índice Orthanc por clínica |
| **ElastiCache Redis** | `aros-core` | Broker WebSockets (Django Channels) |
| **ALB público** | `aros-core` | `api.arospacs.com` (Django), OHIF Viewer |
| **ALB interno** | cada `clinic-{slug}` | Recibe el proxy WADO-RS de Django via TGW; solo accesible desde el TGW |
| **AWS S3** | cada `clinic-{slug}` | Bucket `orthanc-{slug}-dicom`; privado, KMS, versionado |
| **AWS Secrets Manager** | `aros-core` | `DATABASE_URL`, `SECRET_KEY`, `ORTHANC_WEBHOOK_SECRET` para Django |
| **AWS ECR** | `aros-core` | Registro Docker compartido: imágenes `django`, `orthanc-custom`, `ohif` |
| **AWS Amplify** | `aros-core` | Portal Paciente + Portal Clínica (Next.js, subdominios wildcard) |
| **AWS CloudWatch** | cada cuenta | Logs aislados por clínica; agrega via CloudWatch Cross-Account Observability |
| **AWS CloudTrail** | cada cuenta | Audit trail HIPAA aislado por clínica |
| **AWS Security Hub** | `aros-security` | Agrega findings de todas las cuentas |
| **AWS Config** | `aros-security` | Reglas de cumplimiento (cifrado S3, MFA, acceso público bloqueado) |
| **AWS IAM — `TerraformDeployRole`** | cada `clinic-{slug}` | Rol pre-creado por SCP; el pipeline de CI/CD de `aros-core` lo asume para desplegar infraestructura de clínica |
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

**Gestión de Estudios y Flujo de Adquisición:**
- El asistente crea una `StudyRequest` para un paciente; Django genera automáticamente un **Accession Number** único y lo persiste en la base de datos
- El Accession Number se entrega al técnico radiólogo, quien lo ingresa en la máquina de radiología (TAC, rayos X, resonancia) antes de realizar el estudio
- La máquina de radiología tiene configurada la **IP y el AET (Application Entity Title) de Orthanc** como destino de envío DICOM; al concluir el estudio, lo transmite automáticamente a Orthanc mediante el protocolo **DICOM C-STORE** sin ninguna acción manual adicional
- Orthanc recibe el estudio como **SCP** (Storage Service Class Provider), lo indexa y lo persiste en el S3 de la clínica vía el plugin de AWS
- Cuando el estudio queda estable (deja de recibir nuevas instancias), Orthanc dispara el evento **`OnStableStudy`** y envía un Webhook a Django con el `AccessionNumber` y el `StudyInstanceUID`
- Django recibe el Webhook, localiza la `StudyRequest` correspondiente por `accession_number`, crea o actualiza el registro `Study` y lo vincula al `StudyRequest`
- El médico radiólogo ve el nuevo estudio en su cola del Portal Clínica, abre el OHIF Viewer (que obtiene las imágenes de Orthanc vía WADO-RS) y redacta el reporte médico
- El paciente puede ver el reporte y acceder a las imágenes desde el Portal Paciente

**Almacenamiento y Archivos (BYOS con Orthanc):**
- Cada clínica configura sus credenciales de bucket S3 propio desde el panel de administración
- Orthanc utiliza el plugin de AWS S3 para escribir y leer los archivos DICOM en el bucket de la clínica
- Ningún servidor de MedCloud (Django, OHIF, Next.js) procesa ni almacena bytes de imágenes DICOM
- El ancho de banda y el costo de almacenamiento es absorbido directamente por la clínica

**Visualización:**
- El paciente y el radiólogo abren el OHIF Viewer, que se configura con la URL de Orthanc como fuente DICOMweb
- OHIF solicita los frames de imagen al Orthanc vía WADO-RS; Orthanc los recupera del S3 de la clínica y los sirve en tiempo real
- El visor soporta: ajuste de ventana (windowing), zoom, pan, rotación, herramientas de medición y anotación

**Multi-Clínica:**
- El sistema soporta múltiples clínicas; cada una con su propio bucket S3 gestionado por Orthanc
- El historial del paciente es universal: Django agrega estudios de todas las clínicas en una sola respuesta de API
- El paciente puede autorizar o revocar el acceso de una clínica específica a sus registros

**White-Labeling:**
- Cada clínica personaliza el portal con sus colores y logo desde el panel de administración
- Una sola app Next.js sirve a todas las clínicas con identidad visual diferente según el subdominio

### 4.2 Requisitos No Funcionales

**Seguridad:**
- Autenticación con JWT de corta duración (15 min) + refresh token en cookie HttpOnly
- El refresh token es inaccesible por JavaScript (protección contra XSS)
- CORS configurado explícitamente solo para los dominios de los portales
- Todos los endpoints de Django requieren autenticación por defecto
- Límite de 10 intentos de login por hora por IP (anti-brute-force)
- Las credenciales S3 de las clínicas se almacenan en AWS Secrets Manager (nunca en la BD)
- La API REST de Orthanc solo es accesible desde la red privada VPC (no está expuesta a internet)
- Comunicación HTTPS en todos los endpoints públicos; HSTS activado en producción

**Interoperabilidad:**
- Todos los flujos de imágenes cumplen el estándar DICOM 3.0 y DICOMweb (WADO-RS, STOW-RS, QIDO-RS)
- Orthanc puede interoperar con equipos de radiología (modalidades) que envíen estudios por DICOM C-STORE
- OHIF Viewer puede conectarse a cualquier servidor DICOMweb estándar, no solo a Orthanc

**Escalabilidad:**
- Django y Orthanc corren en contenedores sin estado en ECS Fargate (escalables horizontalmente)
- El almacenamiento en S3 escala infinitamente
- La base de datos RDS puede escalarse verticalmente sin afectar la aplicación

**Disponibilidad:**
- Infraestructura definida como código (Terraform): reproducible en minutos
- CI/CD automático para los portales Next.js desde el repositorio Git
- Logs centralizados en CloudWatch; alertas configurables por umbrales

---

## 5. Arquitectura del Código (Monorepo)

### 5.1 Estructura del Repositorio

El proyecto usa **Turborepo** como orquestador de monorepo, permitiendo múltiples aplicaciones en un solo repositorio Git con código compartido.

```
ElectronicMedicalRecords_Project/
│
├── apps/
│ │
│ ├── backend/ ← Django REST API
│ │ ├── core/ ← Modelos Study y Report
│ │ ├── clinicDashboard/ ← Modelos Clinic, ClinicUser, PatientClinicLink
│ │ ├── patientsDashboard/ ← Modelo Patient
│ │ ├── doctorsDashboard/ ← Modelo ReportingDoctor (legacy → ClinicUser)
│ │ ├── assistantDashboard/ ← Modelos Assistant y StudyRequest
│ │ ├── associateDoctorDashboard/ ← Modelo AssociateDoctor
│ │ ├── api/ ← App centralizada REST API
│ │ │ ├── views/
│ │ │ │ ├── auth_views.py ← Login / Refresh / Logout JWT
│ │ │ │ ├── patient_views.py ← Endpoints del Portal Paciente
│ │ │ │ ├── clinic_views.py ← Endpoints del Portal Clínica
│ │ │ │ └── webhook_views.py ← Receptor de Webhooks de Orthanc (NUEVO)
│ │ │ ├── serializers.py
│ │ │ ├── permissions.py ← IsPatient, IsAssistant, IsReportingDoctor, IsClinicAdmin
│ │ │ ├── authentication.py ← JWT con roles en el payload
│ │ │ ├── throttles.py
│ │ │ ├── orthanc_client.py ← Cliente HTTP para la API REST de Orthanc (NUEVO)
│ │ │ └── urls.py
│ │ └── medCloud/
│ │ └── settings.py
│ │
│ ├── patient-portal/ ← Next.js — Portal Paciente
│ │ └── src/
│ │ ├── app/
│ │ │ ├── login/
│ │ │ ├── dashboard/ ← Historial de estudios
│ │ │ ├── studies/[id]/ ← Detalle: reporte + botón OHIF Viewer
│ │ │ └── clinics/ ← Gestión de clínicas autorizadas
│ │ ├── components/
│ │ └── stores/
│ │
│ ├── clinic-portal/ ← Next.js — Portal Clínica (white-labeling)
│ │ └── src/
│ │ ├── middleware.ts ← Subdominio → tema CSS
│ │ ├── app/
│ │ │ ├── login/
│ │ │ ├── assistant/ ← Dashboard: solicitudes del día
│ │ │ ├── doctor/ ← Dashboard: cola de estudios + visor OHIF
│ │ │ └── admin/ ← Dashboard: usuarios, S3 BYOS, branding
│ │ └── components/
│ │
│ └── dicom-viewer/ ← OHIF Viewer configurado
│ ├── config/
│ │ └── default.js ← Fuente de datos: Orthanc DICOMweb URL
│ ├── Dockerfile
│ └── nginx.conf
│
├── packages/
│ ├── types/ ← Tipos TypeScript compartidos
│ │ └── src/index.ts ← Patient, Study, Report, Clinic, JWTPayload...
│ ├── api-client/ ← Cliente HTTP compartido
│ │ └── src/client.ts ← Axios con auto-refresh JWT
│ └── ui/ ← Componentes visuales compartidos
│ └── src/ ← Button, Card, Badge, Table, etc.
│
├── infra/ ← Terraform (IaC)
│ ├── main.tf
│ ├── variables.tf
│ ├── outputs.tf
│ └── modules/
│ ├── networking/ ← VPC, subnets, security groups
│ ├── backend/ ← ECS (Django) + RDS + Redis + ALB
│ ├── orthanc/ ← ECS (Orthanc) + ALB interno (NUEVO)
│ ├── patient-portal/ ← AWS Amplify
│ ├── clinic-portal/ ← AWS Amplify + subdominios wildcard
│ └── dicom-viewer/ ← ECS (OHIF) + ALB público
│
└── thesis_material/
```

---

### 5.2 Flujo de Datos: Adquisición y Vinculación de un Estudio DICOM

Este es el flujo central de la arquitectura. Se divide en **tres momentos diferenciados** que ocurren en distintos instantes de tiempo:

**Momento 1 — El asistente registra la orden (antes del estudio)**
**Momento 2 — La máquina toma y envía las imágenes (durante el estudio, automatizado)**
**Momento 3 — El radiólogo lee las imágenes y emite el diagnóstico (después del estudio)**

```
┌─ MOMENTO 1: REGISTRO DE LA ORDEN ────────────────────────────────────────────┐
│                                                                              │
│  ASISTENTE             PORTAL CLÍNICA         DJANGO (API)        PostgreSQL │
│      │                       │                     │                   │     │
│      │── nuevo pte ────────► │                     │                   │     │
│      │   + solicitud         │── POST /api/v1/study-requests/ ────────►│     │
│      │                       │                     │── INSERT SR ─────►│     │
│      │                       │                     │   (AccNum gen.)   │     │
│      │                       │                     │── INSERT Study ──►│     │
│      │                       │                     │   (pending)       │     │
│      │◄─ { accession_number: "ACC-2026-0042" } ────│                   │     │
│      │                                                                       │
│  El asistente entrega el Accession Number al técnico radiólogo               │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 2: ADQUISICIÓN Y TRANSMISIÓN AUTOMÁTICA ────────────────────────────┐
│                                                                              │
│  TÉCNICO     MÁQUINA DICOM      ORTHANC PACS                  AWS S3         │
│    │        (TAC/RX/MRI)     (Port 4242/8042)             (S3 Clínica)       │
│    │             │                   │                          │            │
│    │─ ingresa Acc│                   │                          │            │
│    │  "ACC-2026-0042"                │                          │            │
│    │─ realiza est│                   │                          │            │
│    │             │── C-STORE ───────►│                          │            │
│    │             │   (automático)    │── Plugin S3 (escribe) ──►│            │
│    │             │                   │◄─────────────────────────│            │
│    │             │                   │                                       │
│    │             │                   │ [Estable: OnStableStudy]              │
│    │             │                   │── Webhook ───────────────► Django     │
│    │                                                             (API)       │
│                                                                    │         │
│                                  PostgreSQL                        │         │
│                                      │                             │         │
│                                      │◄── Busca StudyRequest ──────│         │
│                                      │◄── UPDATE Study (received) ─│         │
│                                                                              │
│  [Notificación WebSocket al Portal Clínica: "Nuevo estudio disponible"]      │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 3: LECTURA Y DIAGNÓSTICO ───────────────────────────────────────────┐
│                                                                              │
│  RADIÓLOGO             PORTAL CLÍNICA         DJANGO (API)      ORTHANC PACS │
│      │                       │                     │           (DICOMweb)    │
│      │                       │                     │               │         │
│      │─ ve cola ───────────► │                     │               │         │
│      │                       │── GET /studies/ ───►│               │         │
│      │◄─ lista con study 42 ─│                     │               │         │
│      │                       │                     │               │         │
│      │─ clic "Ver" ────────► │                     │               │         │
│      │                       │── GET /viewer-url/ ─►               │         │
│      │◄─ { viewer_url } ─────│                     │               │         │
│      │                       │                                     │         │
│      │─ abre OHIF ───────────┼────────────────────────────────────►│         │
│      │                       │◄── WADO-RS (sirve frames) ──────────│         │
│      │                       │                                               │
│      │─ POST /reports/ ─────►│                                               │
│      │  (hallazgos, firma)   │── INSERT Report ──► PostgreSQL                │
│      │◄─ { report_id: 99 } ──│                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Flujo de Datos: El Paciente Ve su Radiografía

El paciente nunca interactúa con S3 ni con Orthanc directamente. Django le entrega una URL autenticada que apunta al OHIF Viewer preconfigurado con Orthanc como fuente DICOMweb. OHIF descarga los frames de imagen directamente de Orthanc, que a su vez los recupera del S3 de la clínica de forma transparente.

```
PACIENTE            PORTAL PACIENTE         DJANGO (API)       ORTHANC (PACS)    S3 (Clínica)
   │                       │                     │                    │                │
   │─ login ─────────────► │                     │                    │                │
   │                       │─ POST /login/ ─────►│                    │                │
   │◄─ dashboard ──────────│                     │                    │                │
   │                       │                     │                    │                │
   │─ ver historial ──────►│                     │                    │                │
   │                       │─ GET /studies/ ────►│                    │                │
   │                       │                     │─ SELECT Studies ──►│                │
   │◄─ lista estudios ─────│                     │                    │                │
   │                       │                     │                    │                │
   │─ clic "Ver" ─────────►│                     │                    │                │
   │                       │─ GET /viewer-url/ ─►│                    │                │
   │                       │                     │─ IsStudyOwner?     │                │
   │◄─ { viewer_url } ─────│                     │                    │                │
   │                       │                                          │                │
   │─ abre viewer_url ─────┼─────────────────────────────────────────►│                │
   │                       │◄─ GET /dicom-web/studies/{uid} ──────────│                │
   │                       │                                          │─ lee .dcm ────►│
   │                       │◄─ frames DICOM (renderizados) ───────────│                │
```

---

## 6. Infraestructura Cloud (AWS Organizations)

### 6.1 Diagrama de Infraestructura Multi-Cuenta

```
┌────────────────────────────────────────── AWS ORGANIZATION (aros-mgmt) ─────────────────────────────────────────┐
│                                                                                                                  │
│  ┌───────────────────────────────────── OU: Core Services ─────────────────────────────────────────────────┐   │
│  │  CUENTA: aros-core  (VPC: 10.0.0.0/16)                                                                  │   │
│  │                                                                                                          │   │
│  │  Route 53:  api.arospacs.com  ──► ALB Público Django                                                     │   │
│  │             *.arospacs.com    ──► AWS Amplify (portales Next.js)                                         │   │
│  │                                                                                                          │   │
│  │  ┌─── Subnets Públicas ──────────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │  ALB Público → ECS Django (DRF + JWT)                                                             │  │   │
│  │  │  ALB Público → ECS OHIF Viewer                                                                    │  │   │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌─── Subnets Privadas ──────────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                                                                                                    │  │   │
│  │  │  ECS Django  ──httpx.stream()──► TGW ──► ALB Interno Clínica ──► Orthanc :8042 (cross-account)   │  │   │
│  │  │  ECS Django  ◄── Webhook OnStableStudy ─── TGW ◄── Orthanc (cross-account)                       │  │   │
│  │  │                                                                                                    │  │   │
│  │  │  RDS PostgreSQL 16                                                                                 │  │   │
│  │  │    · Schema público: datos Django (Clinic, Study, Patient, Report...)                              │  │   │
│  │  │    · Schema orthanc_san_jose: índice DICOM clínica San José                                       │  │   │
│  │  │    · Schema orthanc_radiologia_norte: índice DICOM Radiología Norte                               │  │   │
│  │  │    · Schema orthanc_{slug}: un schema por clínica, creado al provisionar                          │  │   │
│  │  │                                                                                                    │  │   │
│  │  │  ElastiCache Redis (WebSockets)                                                                    │  │   │
│  │  │  ECR (imágenes Docker: django, orthanc-custom, ohif)                                              │  │   │
│  │  │  Secrets Manager (DATABASE_URL, SECRET_KEY, WEBHOOK_SECRET)                                       │  │   │
│  │  │  AWS Amplify (Portal Paciente + Portal Clínica)                                                   │  │   │
│  │  │                                                                                                    │  │   │
│  │  │  ┌─── AWS Transit Gateway (TGW) ───────────────────────────────────────────────────────────────┐  │  │   │
│  │  │  │  Owner: aros-core · Compartido via RAM a toda la OU Clinic Workloads                        │  │  │   │
│  │  │  │  TGW Route Table:                                                                           │  │  │   │
│  │  │  │    10.0.0.0/16 → Core VPC (aros-core)                                                      │  │  │   │
│  │  │  │    10.1.0.0/16 → Attachment VPC clinic-san-jose                                            │  │  │   │
│  │  │  │    10.2.0.0/16 → Attachment VPC clinic-radiologia-norte                                    │  │  │   │
│  │  │  │    10.N.0.0/16 → Attachment VPC clinic-{N} (se agrega al provisionar)                     │  │  │   │
│  │  │  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                  │
│  ┌───────────────────────────────────── OU: Clinic Workloads ──────────────────────────────────────────────┐   │
│  │                                                                                                          │   │
│  │  ┌──── CUENTA: clinic-san-jose (VPC: 10.1.0.0/16) ──────────────────────────────────────────────────┐  │   │
│  │  │                                                                                                    │  │   │
│  │  │  TGW Attachment ◄──── TGW (aros-core) [tráfico solo por puertos 8042 y 8000]                     │  │   │
│  │  │       │                                                                                           │  │   │
│  │  │       ▼                                                                                           │  │   │
│  │  │  ALB Interno (:8042) — Security Group: solo acepta tráfico desde 10.0.0.0/16 (Core VPC)          │  │   │
│  │  │       │                                                                                           │  │   │
│  │  │       ▼                                                                                           │  │   │
│  │  │  ECS Fargate (Orthanc PACS)                                                                       │  │   │
│  │  │    · AET: ORTHANC_SAN_JOSE                                                                        │  │   │
│  │  │    · ENV: ORTHANC__S3OBJECTSTORAGE__BUCKETNAME=orthanc-san-jose-dicom  (Estático)                 │  │   │
│  │  │    · ENV: ORTHANC__POSTGRESQL__SCHEMA=orthanc_san_jose                 (Estático)                 │  │   │
│  │  │    · Webhook OnStableStudy → Django via TGW                                                       │  │   │
│  │  │       │                                                                                           │  │   │
│  │  │       ├──── Plugin S3 ────► S3 Bucket: orthanc-san-jose-dicom                                    │  │   │
│  │  │       │                    (Privado · KMS · Versionado · Sin acceso público)                      │  │   │
│  │  │       │                                                                                           │  │   │
│  │  │       └──── Plugin PostgreSQL → RDS aros-core (schema: orthanc_san_jose) via TGW                 │  │   │
│  │  │                                                                                                   │  │   │
│  │  │  IAM Task Role: acceso exclusivo a orthanc-san-jose-dicom (bucket policy)                        │  │   │
│  │  │  CloudTrail: audit trail HIPAA de esta cuenta                                                    │  │   │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                                                          │   │
│  │  ┌──── CUENTA: clinic-radiologia-norte (VPC: 10.2.0.0/16) ──────────────────────────────────────────┐  │   │
│  │  │  (Idéntica estructura de red, ECS y S3, totalmente aislada)                                       │  │   │
│  │  │  · AET: ORTHANC_RADIOLOGIA_NORTE                                                                  │  │   │
│  │  │  · S3: orthanc-radiologia-norte-dicom                                                             │  │   │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                                                          │   │
│  │  ┌──── CUENTA: clinic-{N} (VPC: 10.N.0.0/16) ─────────────────────────────────────────────────────┐  │   │
│  │  │  (Provisionada automáticamente por el pipeline al onboardear una nueva clínica)                  │  │   │
│  │  │  VPC CIDR asignado secuencialmente — registrado en Clinic.vpc_cidr en la BD central             │  │   │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                  │
│  ┌──────────────────────── OU: Security & Logging ────────────────────────────────────────────────────────┐   │
│  │  CUENTA: aros-security                                                                                  │   │
│  │  · AWS Security Hub: agrega findings de todas las cuentas                                               │   │
│  │  · AWS Config: reglas de cumplimiento HIPAA (cifrado S3, MFA, no public access)                        │   │
│  │  · CloudTrail Lake: logs centralizados de todas las cuentas                                             │   │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Estrategia Terraform: Estado Desacoplado

Se utiliza un backend de Terraform para cada cuenta para garantizar aislamiento total.

*   **`infra/accounts/core/`**: Despliega la infraestructura compartida (Django, TGW, RDS).
*   **`infra/accounts/clinic-template/`**: Se clona para cada nueva clínica. El pipeline de CI/CD inicializa este directorio con un `backend-config` que apunta a `s3://aros-tf-state/clinics/{slug}/terraform.tfstate`.

### 6.3 Modelo de Costos

## 7. Seguridad

### 7.1 Autenticación — JWT con Doble Token

| Token | Duración | Dónde se guarda | Accesible por JS |
|---|---|---|---|
| **Access Token** | 15 minutos | En memoria RAM del navegador (Zustand store) | Sí (intencional, en memoria) |
| **Refresh Token** | 7 días | Cookie HttpOnly + Secure + SameSite=Strict | **No** — inmune a XSS |

El Refresh Token en una cookie HttpOnly significa que ningún script puede leerlo ni exfiltrarlo. Al recargar la página, el navegador envía la cookie automáticamente al endpoint de refresh para obtener un nuevo Access Token sin intervención del usuario.

### 7.2 Seguridad de Orthanc

- La API REST y los endpoints DICOMweb de Orthanc **no están expuestos a internet**
- El ALB de Orthanc es **interno** (accesible únicamente dentro de la VPC privada)
- Django se comunica con Orthanc vía `http://orthanc.internal:8042` (nombre DNS interno de ECS)
- OHIF Viewer se comunica con Orthanc vía la URL `https://pacs.arospacs.com` (ALB interno expuesto con restricción de IP a los rangos de la VPC)
- Las credenciales de admin de Orthanc se guardan en AWS Secrets Manager y se inyectan como variables de entorno en el contenedor ECS

### 7.3 Autorización — Permisos en Capas

Cada petición a Django pasa por 4 capas de verificación antes de ejecutarse:

1. **JWT válido** — El token no ha expirado y su firma es criptográficamente correcta
2. **Rol correcto** — El claim `role` del JWT coincide con el permiso requerido (`IsPatient`, `IsAssistant`, `IsReportingDoctor`, `IsClinicAdmin`)
3. **Queryset filtrado** — La consulta a la base de datos solo devuelve registros del usuario/clínica autenticados
4. **Verificación de objeto** — Se valida que el registro específico solicitado pertenece al usuario autenticado (`IsStudyOwner`)

### 7.4 Protección contra Ataques Comunes

| Vector de Ataque | Mitigación implementada |
|---|---|
| **XSS** | Refresh Token en cookie HttpOnly (JavaScript no puede leerlo) |
| **CSRF** | JWT en headers de autorización + `SameSite=Strict` en la cookie del Refresh Token |
| **Brute Force (login)** | Throttle de 10 intentos por hora por IP en `/auth/login/` |
| **Scraping / DDoS** | Throttle global: 50 req/hora (anónimos), 500 req/hora (autenticados) |
| **Man-in-the-Middle** | HTTPS obligatorio en producción + HSTS de 1 año |
| **Clickjacking** | `X-Frame-Options: DENY` |
| **MIME Sniffing** | `X-Content-Type-Options: nosniff` |
| **Exposición de credenciales** | AWS Secrets Manager para credenciales S3 y contraseñas de Orthanc |
| **Endpoint abierto accidental** | `IsAuthenticated` como permiso global por defecto en DRF |
| **Acceso no autorizado a Orthanc** | ALB de Orthanc es interno; sin ruta pública directa |

---

## 8. Plan de Implementación — Tareas

### Fase 0 — Limpieza de Dependencias Legacy y Preparación del Monorepo *(Día 1-2)*
- [ ] Eliminar cliente API de Raditech (`raditech_client.py`) y mapping de datos (`raditech_mapping.py`)
- [ ] Eliminar comandos de sincronización (`sync_pacs_images.py`, `fetch_raditech_catalog.py`)
- [ ] Remover variables de entorno y settings de Raditech (`RADITECH_API_URL`, `RADITECH_KEY`, etc.)
- [ ] Limpiar referencias a Raditech en modelos de base de datos (`raditech_visit_id`, `raditech_patient_id`)
- [ ] Generar migraciones para eliminar los campos deprecados en BD
- [ ] Inicializar Turborepo en la raíz del repositorio con `npx create-turbo@latest`
- [ ] Configurar pnpm workspaces en el `package.json` raíz
- [ ] Mover `medCloud/` a `apps/backend/`
- [ ] Crear carpetas vacías: `apps/patient-portal`, `apps/clinic-portal`, `apps/dicom-viewer`
- [ ] Crear carpetas vacías: `packages/types`, `packages/api-client`, `packages/ui`
- [ ] Crear `turbo.json` con pipeline de tareas (dev, build, lint, type-check)

### Fase 1 — Refactorizar Modelos Django *(Semana 1)*
- [ ] Eliminar todas las carpetas `templates/` del backend (corte total sin migración gradual)
- [ ] Eliminar todas las carpetas `static/` del backend
- [ ] Eliminar todos los archivos `forms.py` del backend
- [ ] Crear la app `clinicDashboard` con los modelos `Clinic`, `ClinicUser`, `PatientClinicLink`
- [ ] Agregar campos de white-labeling al modelo `Clinic` (`primary_color`, `secondary_color`, `accent_color`, `logo`, `favicon`)
- [ ] Agregar campo `accession_number` al modelo `StudyRequest` — campo único auto-generado al crear la solicitud (formato `ACC-{año}-{id:04d}`)
- [ ] Agregar campo `orthanc_study_id` al modelo `Study` (string, nullable hasta que Orthanc lo llene vía Webhook)
- [ ] Agregar campo `dicom_study_uid` al modelo `Study` (el `StudyInstanceUID` DICOM estándar que retorna Orthanc)
- [ ] Agregar FK `study_request` al modelo `Study` (OneToOne, se llena en el Webhook)
- [ ] Agregar FK `clinic` al modelo `Study`
- [ ] Crear y ejecutar las migraciones de base de datos

### Fase 2 — Instalar y Configurar DRF *(Semana 1-2)*
- [ ] Agregar `djangorestframework`, `simplejwt`, `django-cors-headers`, `drf-spectacular`, `httpx` a `requirements.txt`
- [ ] Registrar las nuevas apps en `INSTALLED_APPS` en `settings.py`
- [ ] Configurar el middleware de CORS

### Fase 3 — Configuración de Seguridad *(Semana 2)*
- [ ] Configurar `REST_FRAMEWORK` con `IsAuthenticated` global por defecto y Throttling activado
- [ ] Configurar `SIMPLE_JWT` (15 min access, 7 días refresh, rotación, blacklist)
- [ ] Configurar CORS con lista explícita de orígenes permitidos desde variable de entorno
- [ ] Configurar headers de seguridad HTTP para producción (HSTS, HTTPS redirect, nosniff, etc.)
- [ ] Crear `api/throttles.py` con throttle de login (10/hora)
- [ ] Crear `api/permissions.py` con `IsPatient`, `IsAssistant`, `IsReportingDoctor`, `IsClinicAdmin`, `IsStudyOwner`
- [ ] Implementar vista de login con cookie HttpOnly para el Refresh Token
- [ ] Implementar vista de refresh que lee desde la cookie
- [ ] Implementar vista de logout con blacklist y borrado de cookie

### Fase 4 — Endpoints de la API Django *(Semana 2-3)*
- [ ] Crear app `api/` con estructura de vistas (auth, patient, clinic, webhook)
- [ ] Crear `api/orthanc_client.py` — cliente `httpx` para la API REST interna de Orthanc
- [ ] Crear `api/serializers.py` con serializers para StudyRequest (con `accession_number`), Study, Report, Patient, Clinic
- [ ] Implementar la lógica de auto-generación de `accession_number` al crear una `StudyRequest` (señal `post_save` o método `save()` sobreescrito)
- [ ] Implementar `api/views/webhook_views.py` — receptor del Webhook `OnStableStudy` de Orthanc:
- Extraer `accession_number` del payload
- Buscar la `StudyRequest` correspondiente (`WHERE accession_number = ?`)
- Crear el `Study` vinculado con `orthanc_study_id` y `dicom_study_uid`
- Actualizar `StudyRequest.status` a `"received"`
- Emitir evento WebSocket al Portal Clínica ("Nuevo estudio en cola")
- [ ] Implementar todos los endpoints del Portal Paciente, incluyendo `GET /studies/{id}/viewer-url/` (construye URL OHIF con `dicom_study_uid`)
- [ ] Implementar todos los endpoints del Portal Clínica (Asistente, Radiólogo, Admin)
- [ ] Implementar endpoint `GET /clinic/study-requests/{id}/accession-number/` — para mostrar el número al asistente después de crear la solicitud
- [ ] Implementar endpoint de tema para white-labeling (`AllowAny`)
- [ ] Configurar el router DRF y las URLs bajo `/api/v1/`
- [ ] Verificar que la documentación Swagger/OpenAPI se genera correctamente

### Fase 5 — Orthanc PACS: Dockerización y Configuración *(Semana 3-4)*
- [ ] Crear `apps/orthanc/` con el `Dockerfile` personalizado de Orthanc
- [ ] Instalar los plugins oficiales dentro del Dockerfile: `liborthanc-dicomweb-plugin`, `liborthanc-postgresql-plugin`, `liborthanc-object-storage-plugin` (AWS S3)
- [ ] Crear el archivo `orthanc.json` con la configuración base:
- Habilitar la API REST en el puerto **8042**
- Habilitar el SCP DICOM (C-STORE) en el puerto **4242**
- Configurar el `DicomAet` (AET) de Orthanc: `"MEDCLOUD_ORTHANC"` — este es el nombre que se configura en la máquina de radiología como destino
- Configurar `KnownAETities` con los AETs de las máquinas de radiología autorizadas por clínica (lista blanca de modalidades)
- Configurar el plugin DICOMweb en el path `/dicom-web`
- Configurar el plugin PostgreSQL apuntando al RDS (credenciales desde variables de entorno)
- Configurar el plugin AWS S3 para leer las credenciales desde AWS Secrets Manager
- Configurar los Webhooks: `OnStableStudy` → `POST http://django.internal:8000/api/v1/webhooks/orthanc/study-stable/` con payload incluyendo `AccessionNumber`
- [ ] Abrir el puerto 4242 (DICOM C-STORE) en el Security Group de Orthanc (solo accesible desde la red privada/VPN de las clínicas)
- [ ] Probar la recepción de un estudio via C-STORE usando `storescu` (herramienta DCMTK) desde la red local simulando una modalidad
- [ ] Verificar que Orthanc indexa correctamente el Accession Number del estudio recibido
- [ ] Probar que Orthanc persiste el archivo en el bucket S3 de prueba
- [ ] Probar que el Webhook `OnStableStudy` llega a Django con el `accession_number` correcto y que Django crea el `Study` vinculado a la `StudyRequest`

### Fase 6 — BYOS S3 + AWS Secrets Manager *(Semana 4)*
- [ ] Implementar `get_s3_credentials()` en el modelo `Clinic` (llama a Secrets Manager)
- [ ] Implementar `POST /clinic/settings/s3/` — guarda credenciales en Secrets Manager, devuelve solo el ARN; el ARN se almacena en la BD para que Orthanc lo use al inicializar el plugin
- [ ] Implementar `GET /studies/{id}/viewer-url/` — construye la URL completa de OHIF con el `StudyInstanceUID` de Orthanc, apuntando al proxy Django (`/api/v1/dicom-web/{clinic_slug}/`)

### Fase 7 — JWT con Roles *(Semana 4)*
- [ ] Crear `MedCloudTokenSerializer` con payload enriquecido (`email`, `full_name`, `role`, `clinic_id`, `clinic_slug`)
- [ ] Registrar el serializer en la configuración de SimpleJWT

### Fase 8 — Packages TypeScript Compartidos *(Semana 4-5)*
- [ ] Definir todos los tipos en `packages/types/src/index.ts` (incluyendo `orthanc_study_id` en `Study`)
- [ ] Implementar el cliente Axios con interceptor JWT en `packages/api-client/src/client.ts`
- [ ] Configurar los componentes base en `packages/ui/`

### Fase 9 — Portal Paciente *(Semana 5-6)*
- [ ] Inicializar proyecto Next.js 15 con TypeScript y Tailwind CSS
- [ ] Configurar shadcn/ui
- [ ] Implementar el store de autenticación con Zustand
- [ ] Implementar la página de login con manejo de JWT
- [ ] Implementar el dashboard con historial de estudios via TanStack Query
- [ ] Implementar la página de detalle del estudio con reporte médico
- [ ] Implementar el botón "Ver en Visor" — llama a `GET /studies/{id}/viewer-url/` y abre la URL de OHIF (que apunta a Orthanc DICOMweb)
- [ ] Implementar la gestión de clínicas autorizadas

### Fase 10 — Portal Clínica *(Semana 6-7)*
- [ ] Inicializar proyecto Next.js 15
- [ ] Implementar el middleware de white-labeling (subdominio → CSS Variables)
- [ ] Implementar el layout raíz con inyección de tema
- [ ] Implementar la lógica de redirección por rol en el middleware
- [ ] Implementar el dashboard del Asistente (lista de solicitudes, búsqueda de pacientes, nueva solicitud)
- [ ] Implementar el dashboard del Radiólogo:
- Cola de estudios en estado `"received"` (llegaron automáticamente desde las máquinas vía C-STORE)
- Indicador visual de nuevos estudios (WebSocket, actualización en tiempo real)
- Botón "Ver imágenes" — llama a `GET /studies/{id}/viewer-url/` y abre OHIF apuntando a Orthanc con el `dicom_study_uid`
- **No hay formulario de upload manual** — las imágenes llegan solas desde la máquina
- Formulario de redacción y firma del reporte médico (hallazgos, conclusiones, recomendaciones)
- [ ] Implementar el dashboard del Administrador (usuarios, configuración S3/BYOS, branding)

### Fase 11 — OHIF Viewer: Configuración y Dockerización *(Semana 7)*
- [ ] Clonar el repositorio de OHIF Viewer v3
- [ ] Configurar `apps/dicom-viewer/config/default.js` para apuntar a Orthanc como fuente DICOMweb
- `wadoUriRoot`: `https://api.arospacs.com/api/v1/dicom-web/{clinic_slug}`
- `qidoRoot`: `https://api.arospacs.com/api/v1/dicom-web/{clinic_slug}`
- `wadoRoot`: `https://api.arospacs.com/api/v1/dicom-web/{clinic_slug}`
- [ ] Crear el `Dockerfile` de OHIF (build con Node.js, serve con Nginx)
- [ ] Crear `nginx.conf` con CORS habilitado para los dominios de los portales
- [ ] Probar el flujo completo: OHIF → Orthanc (WADO-RS) → S3 → imagen en pantalla

### Fase 12 — Terraform: Infraestructura en AWS *(Semana 8-9)*
- [ ] Crear el bucket S3 para el estado remoto de Terraform y la tabla DynamoDB para bloqueo de estado
- [ ] Implementar el módulo `networking` (VPC, subnets, gateways, security groups)
- [ ] Implementar el módulo `database` (RDS PostgreSQL compartido entre Django y Orthanc)
- [ ] Implementar el módulo `cache` (ElastiCache Redis)
- [ ] Implementar el módulo `backend` (ECS Fargate Django + ALB público)
- [ ] Implementar el módulo `orthanc` (ECS Fargate Orthanc + **ALB interno** + Security Group restrictivo)
- [ ] Implementar el módulo `dicom-viewer` (ECS Fargate OHIF + ALB público)
- [ ] Implementar el módulo `patient-portal` (Amplify)
- [ ] Implementar el módulo `clinic-portal` (Amplify + subdominios wildcard)
- [ ] Ejecutar `terraform plan` para verificar el plan sin efectos secundarios
- [ ] Ejecutar `terraform apply` para desplegar toda la infraestructura
- [ ] Verificar conectividad entre Django ↔ Orthanc dentro de la VPC
- [ ] Verificar conectividad OHIF → Django Proxy y luego Django Proxy → Orthanc (flujo Transit Gateway)

---

## 9. Resumen de Tecnologías

```
Backend (Django) ────────────────────────────────────────────────────
Python 3.12 · Django 6.0 · Django REST Framework 3.15 · SimpleJWT
Django Channels 4 · Daphne · boto3 · httpx · WeasyPrint
PostgreSQL 16 · Redis 7 · SQLite (solo desarrollo)

PACS / Imaging ──────────────────────────────────────────────────────
Orthanc Core 1.12.11 (GPLv3+)
Plugin DICOMweb (AGPLv3+) · Protocolo: WADO-RS / STOW-RS / QIDO-RS
Plugin PostgreSQL (AGPLv3+)
Plugin AWS S3 Object Storage (AGPLv3+)

Visor DICOM ─────────────────────────────────────────────────────────
OHIF Viewer v3 (MIT) · Cornerstone.js 3 · Nginx 1.25

Frontend ────────────────────────────────────────────────────────────
TypeScript 5 · Next.js 15 (App Router) · React 19
Tailwind CSS 4 · shadcn/ui · Radix UI
Zustand 5 · TanStack Query 5 · Axios 1

Monorepo ────────────────────────────────────────────────────────────
Turborepo 2 · pnpm 9

Cloud (AWS) ─────────────────────────────────────────────────────────
ECS Fargate · RDS PostgreSQL 16 · ElastiCache Redis
2 ALBs en la cuenta core (Django, OHIF) más 1 ALB interno por cuenta de clínica · AWS Amplify
S3 (BYOS por clínica) · Secrets Manager · ECR
Route 53 · ACM · IAM · CloudWatch

Infrastructure as Code ──────────────────────────────────────────────
Terraform 1.6+ (HCL) · S3 Backend + DynamoDB Lock

Contenedores ────────────────────────────────────────────────────────
Docker · Dockerfile (Django · Orthanc personalizado · OHIF)
```

---

*Documento de referencia técnica elaborado para los anexos de la tesis de Ingeniería en Sistemas Computacionales.*
*La arquitectura presentada implementa los estándares médicos abiertos DICOM 3.0 y DICOMweb, y sigue los principios de diseño de sistemas distribuidos escalables.*