# AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc

> **Documento de referencia técnica para tesis**
> Versión: 3.0.0 | Fecha: Junio 2026
> Proyecto: Sistema de Registros Médicos Electrónicos con Arquitectura Multi-Clínica y PACS Descentralizado

---

## 1. Visión General del Producto Final

AROSPACS v3.0 es una **plataforma SaaS de registros médicos electrónicos** que permite a múltiples clínicas de radiología gestionar estudios de imágenes diagnósticas utilizando estándares médicos abiertos, mientras los pacientes pueden acceder a su historial médico universal desde cualquier lugar.

La plataforma se compone de **cinco sistemas independientes** que colaboran como un ecosistema cohesivo:

| # | Sistema | Descripción | Quién lo usa | Visibilidad |
|---|---|---|---|---|
| 1 | **AROS Core API (Django)** | Identity Provider y API Gateway central. Enruta peticiones federadas a las clínicas. No almacena datos médicos. | Ningún usuario final | Invisible |
| 2 | **Clinic Internal API** | Microservicio ligero desplegado dentro de la VPC aislada de CADA clínica. Gestiona su BD local y webhooks. | AROS Core API | Invisible |
| 3 | **Portal Paciente** | Aplicación web donde el paciente consulta su historial médico universal | Todos los pacientes | Visible |
| 4 | **Portal Clínica** | Aplicación web para el personal interno de la clínica | Administradores, Asistentes, Radiólogos | Visible |
| 5 | **Visor DICOM (OHIF)** | Plataforma de visualización de imágenes radiológicas en el navegador | Radiólogos y Pacientes | Visible |
| 6 | **Servidor PACS (Orthanc)** | Core de almacenamiento desplegado en cada clínica. Orquesta los flujos DICOM locales. | Ningún usuario final | **Invisible pero vital** |

> **Manifiesto Zero Clinical Data Retention**
> AROS Technologies opera bajo una política estricta de "Cero Retención de Datos Clínicos". La plataforma central en `aros-core` funciona puramente como un Identity Provider (IdP) y un API Gateway de interoperabilidad. Los archivos DICOM, solicitudes de estudio (StudyRequests), reportes y diagnósticos médicos son propiedad y responsabilidad exclusiva de cada clínica. Estos datos se procesan y persisten únicamente dentro de las cuentas de AWS aisladas de las clínicas (vía el Clinic Internal API y su RDS local) y nunca tocan el almacenamiento persistente central de AROS.

### ¿Qué puede hacer el producto final?

> **Manifiesto Zero Clinical Data Retention**
> AROS Technologies opera bajo una política estricta de "Cero Retención de Datos Clínicos". La plataforma central en `aros-core` funciona puramente como un Identity Provider (IdP) y un API Gateway de interoperabilidad. Los archivos DICOM, solicitudes de estudio (StudyRequests), reportes y diagnósticos médicos son propiedad y responsabilidad exclusiva de cada clínica. Estos datos se procesan y persisten únicamente dentro de las cuentas de AWS aisladas de las clínicas y nunca tocan el almacenamiento persistente de AROS.


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
- Redactar y firmar el reporte médico (hallazgos, conclusiones, recomendaciones), que se persiste en la base de datos aislada de la clínica (AWS Account independiente)

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

### 2.1 Paradigma: Federated APIs y Aislamiento Físico por Clínica

La arquitectura v3.0 adopta un modelo **AWS Organizations Multi-Account** combinado con el patrón de diseño **Federated APIs**. AROS Technologies (cuenta `aros-core`) opera la infraestructura central compartida (Identity Provider y Gateway). Cada clínica onboarded recibe su propia cuenta AWS completamente aislada, provisionada por AROS, que contiene su propio VPC, Orthanc ECS, S3 Bucket, un RDS local y el **Clinic Internal API**. 

La comunicación entre la cuenta central y las clínicas ocurre exclusivamente a través del **AWS Transit Gateway (TGW)**, enrutando peticiones seguras hacia el Clinic Internal API.

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
│  │  │  · Identity Provider: Autentica y autoriza requests (JWT)                    │   │  │
│  │  │  · API Gateway: Enruta peticiones a las Clinic Internal APIs                 │   │  │
│  │  │  · Federated Query: Consulta múltiples clínicas en paralelo                  │   │  │
│  │  │  · Proxy WADO-RS: Enruta tráfico DICOMweb hacia Orthanc                      │   │  │
│  │  │  · CERO DATOS CLÍNICOS: No guarda estudios, reportes ni imágenes.            │   │  │
│  │  └──────────┬───────────────────────────────────────────┬─────────────────────┘   │  │
│  │             │                                           │                          │  │
│  │             ▼                                           ▼                          │  │
│  │  ┌─────────────────────┐                  ┌────────────────────────────────────┐  │  │
│  │  │  RDS PostgreSQL 16  │                  │  AWS Transit Gateway (TGW)         │  │  │
│  │  │  (IdP & Registry)   │                  │  · Owner: aros-core                │  │  │
│  │  │  · User             │                  │  · Enruta peticiones desde el      │  │  │
│  │  │  · PatientProfile   │                  │    Core API hacia el ALB interno   │  │  │
│  │  │  · ClinicRegistry   │                  │    de cada clínica (Clinic API y   │  │  │
│  │  │  · Role/Permissions │                  │    Orthanc Proxy).                 │  │  │
│  │  └─────────────────────┘                  └───────────────────┬────────────────┘  │  │
│  │                                                               │ TGW Attachments  │  │
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
│  │  │  ┌────────────────────┐   ┌────────────────────────┐ │                        │ │
│  │  │  │ ECS Orthanc PACS   │   │ ECS Clinic Internal API│ │                        │ │
│  │  │  │ (C-STORE 4242)     │   │ (Microservicio local)  │ │                        │ │
│  │  │  │ OnStable Webhook ──┼───► Vincula estudios       │ │                        │ │
│  │  │  └──────────┬─────────┘   └──────────┬─────────────┘ │                        │ │
│  │  │             │ S3/RDS                 │ RDS           │                        │ │
│  │  │             ▼                        ▼               │                        │ │
│  │  │  ┌────────────────────┐   ┌────────────────────────┐ │                        │ │
│  │  │  │ S3 Bucket (DICOM)  │   │ RDS PostgreSQL Clínica │ │                        │ │
│  │  │  │ KMS, Privado       │   │ - StudyRequest, Study  │ │                        │ │
│  │  │  │                    │   │ - Report, Orthanc DB   │ │                        │ │
│  │  │  └────────────────────┘   └────────────────────────┘ │                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  │                                                                                   │ │
│  │  ┌──────────────── CUENTA: clinic-radiologia-norte ──────┐                        │ │
│  │  │  VPC: 10.2.0.0/16  (estructura idéntica aprovisionada)│                        │ │
│  │  └───────────────────────────────────────────────────────┘                        │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Datos: Zero Clinical Data Retention Estricto

La base de datos central de AROS no es un monolito; el almacenamiento está rígidamente particionado.

**Base de Datos AROS Core (`aros-core` RDS):**
- **Contiene ÚNICAMENTE:** `User`, `PatientProfile`, `ClinicRegistry` y `Role/Permissions`.
- **Propósito:** Gestión de identidades, autenticación JWT y configuración de enrutamiento (URLs internas del TGW).
- **Restricción:** Ninguna tabla de esta base de datos almacena diagnósticos, historiales, reportes o meta-datos DICOM.

**Base de Datos Clínica (RDS aprovisionado en cada cuenta AWS de clínica):**
- **Contiene:** `StudyRequest` (solicitudes médicas), `Study` (metadatos vinculados), `Report` (diagnósticos firmados) y el esquema del plugin PostgreSQL de Orthanc.
- **Propósito:** Persistencia local y soberana de la información médica protegida (PHI).
- **Acceso:** Gestionado localmente por el **Clinic Internal API**, el cual responde a peticiones del AROS Core Gateway a través del TGW.

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

El proyecto utiliza **Turborepo** para orquestar la arquitectura de APIs Federadas. El monolito ha sido descompuesto.

```text
ElectronicMedicalRecords_Project/
├── apps/
│   ├── core-api/ ← AROS Core API (Django IdP & Gateway)
│   │   ├── auth/ ← Gestión de JWT, usuarios
│   │   ├── gateway/ ← Ruteo federado vía httpx hacia las clínicas
│   │   └── models/ ← User, PatientProfile, ClinicRegistry, Roles
│   │
│   ├── clinic-api/ ← Clinic Internal API (Django/FastAPI)
│   │   ├── api/ ← Endpoints de gestión local (GET /studies/, POST /reports/)
│   │   ├── webhooks/ ← Recibe evento OnStableStudy desde Orthanc local
│   │   └── models/ ← StudyRequest, Study, Report (Guardados en RDS Clínica)
│   │
│   ├── patient-portal/ ← Next.js — Portal Paciente
│   ├── clinic-portal/ ← Next.js — Portal Clínica
│   └── dicom-viewer/ ← OHIF Viewer
├── packages/
│   ├── types/ ← Tipos TypeScript
│   ├── api-client/ ← Axios client
│   └── ui/ ← shadcn/ui componentes
└── infra/ ← Terraform Modules
```

### 5.2 Flujo de Datos: Adquisición y Vinculación (APIs Federadas)

El AROS Core API actúa como pasarela; las clínicas manejan sus propios datos.

```text
┌─ MOMENTO 1: REGISTRO DE LA ORDEN ────────────────────────────────────────────┐
│                                                                              │
│ ASISTENTE       PORTAL CLÍNICA      AROS CORE API      TGW       CLINIC INTERNAL API     CLINIC RDS │
│    │                  │                   │             │                 │                   │ │
│    │── registrar ────►│                   │             │                 │                   │ │
│    │   solicitud      │── POST /req/ ────►│             │                 │                   │ │
│    │                  │                   │── Enruta ──►│── POST /req/ ──►│                   │ │
│    │                  │                   │             │                 │── INSERT StudyReq►│ │
│    │                  │                   │             │                 │◄── { acc_num } ───│ │
│    │                  │                   │◄─ { acc_num}│◄────────────────│                   │ │
│    │◄─ { acc_num } ───│                   │             │                 │                   │ │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 2: ADQUISICIÓN Y TRANSMISIÓN AUTOMÁTICA (Aislado) ──────────────────┐
│                                                                              │
│ TÉCNICO     MÁQUINA DICOM      ORTHANC PACS      CLINIC INTERNAL API     CLINIC RDS │
│    │             │                  │                    │                   │          │
│    │── realiza ─►│                  │                    │                   │          │
│    │   estudio   │── C-STORE ──────►│                    │                   │          │
│    │             │                  │── Webhook local ──►│                   │          │
│    │             │                  │  (OnStableStudy)   │── UPDATE Study ──►│          │
│                                                                              │
│ [El AROS Core API no interviene en este flujo. Todo ocurre en la VPC local.] │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ MOMENTO 3: LECTURA Y DIAGNÓSTICO ───────────────────────────────────────────┐
│                                                                              │
│ RADIÓLOGO       PORTAL CLÍNICA      AROS CORE API      TGW       CLINIC INTERNAL API     CLINIC RDS │
│    │                  │                   │             │                 │                   │ │
│    │── ve cola ──────►│                   │             │                 │                   │ │
│    │                  │── GET /studies/ ─►│             │                 │                   │ │
│    │                  │                   │── Enruta ──►│── GET /studies/►│                   │ │
│    │                  │                   │             │                 │◄── [ estudios ] ──│ │
│    │                  │                   │◄─ [ datos ] │◄────────────────│                   │ │
│    │◄─ lista estudios─│                   │             │                 │                   │ │
│    │                  │                   │             │                 │                   │ │
│    │── POST /reports/►│── POST /reports/ ─►             │                 │                   │ │
│    │                  │                   │── Enruta ──►│── POST /reports/►│                   │ │
│    │                  │                   │             │                 │── INSERT Report ─►│ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Flujo de Datos: El Paciente Ve su Radiografía (Federated Query)

Cuando un paciente consulta su historial, la AROS Core API realiza peticiones distribuidas en paralelo.

```text
PACIENTE          PORTAL PACIENTE       AROS CORE API       TGW          CLINIC API (A)   CLINIC API (B)
   │                     │                    │              │                 │                │
   │── ver historial ───►│                    │              │                 │                │
   │                     │── GET /history/ ──►│              │                 │                │
   │                     │                    │── httpx ────►│── req Clinic A ─►                │
   │                     │                    │── httpx ────►│─────────────────────────────────►│ req Clinic B
   │                     │                    │              │                 │                │
   │                     │                    │◄── datos A ──│◄────────────────│                │
   │                     │                    │◄── datos B ──│◄─────────────────────────────────│
   │                     │                    │ (Consolida)  │                 │                │
   │◄─ lista unificada ──│◄─ [ json ] ────────│ (Libera RAM) │                 │                │
```

## 6. Infraestructura Cloud (AWS Organizations)



### 6.1 Diagrama de Infraestructura Multi-Cuenta

```text
┌────────────────────────────────────────── AWS ORGANIZATION (aros-mgmt) ───────────────────────────────────────┐
│                                                                                                               │
│  ┌───────────────────────────────────── OU: Core Services ─────────────────────────────────────────────────┐  │
│  │  CUENTA: aros-core  (VPC: 10.0.0.0/16)                                                                  │  │
│  │                                                                                                         │  │
│  │  Route 53:  api.arospacs.com  ──► ALB Público AROS Core                                                 │  │
│  │             *.arospacs.com    ──► AWS Amplify (portales Next.js)                                        │  │
│  │                                                                                                         │  │
│  │  ┌─── Subnets Públicas ──────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ALB Público → ECS AROS Core API (Django/FastAPI)                                                 │  │  │
│  │  │  ALB Público → ECS OHIF Viewer                                                                    │  │  │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─── Subnets Privadas ──────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                                                                                   │  │  │
│  │  │  ECS Core API ──httpx.stream()──► TGW ──► ALB Interno Clínica ──► Orthanc Proxy (cross-account)   │  │  │
│  │  │  ECS Core API ──httpx.async()───► TGW ──► ALB Interno Clínica ──► Clinic API (cross-account)      │  │  │
│  │  │                                                                                                   │  │  │
│  │  │  RDS PostgreSQL 16 (AROS Core)                                                                    │  │  │
│  │  │    · Schema público: Identity Provider, Roles, ClinicRegistry (CERO datos clínicos)               │  │  │
│  │  │                                                                                                   │  │  │
│  │  │  ElastiCache Redis (WebSockets / Celery)                                                          │  │  │
│  │  │  ECR (imágenes Docker: core-api, clinic-api, orthanc-custom, ohif)                                │  │  │
│  │  │  Secrets Manager (Base de datos, JWT Secrets)                                                     │  │  │
│  │  │                                                                                                   │  │  │
│  │  │  ┌─── AWS Transit Gateway (TGW) ───────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │  Owner: aros-core · Compartido via RAM a toda la OU Clinic Workloads                        │  │  │  │
│  │  │  │  TGW Route Table:                                                                           │  │  │  │
│  │  │  │    10.0.0.0/16 → Core VPC (aros-core)                                                       │  │  │  │
│  │  │  │    10.1.0.0/16 → Attachment VPC clinic-san-jose                                             │  │  │  │
│  │  │  │    10.2.0.0/16 → Attachment VPC clinic-radiologia-norte                                     │  │  │  │
│  │  │  │    10.N.0.0/16 → Attachment VPC clinic-{N} (se agrega al provisionar)                       │  │  │  │
│  │  │  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                               │
│  ┌───────────────────────────────────── OU: Clinic Workloads ──────────────────────────────────────────────┐  │
│  │                                                                                                         │  │
│  │  ┌──── CUENTA: clinic-san-jose (VPC: 10.1.0.0/16) ──────────────────────────────────────────────────┐ │    │
│  │  │                                                                                                  │ │    │
│  │  │  TGW Attachment ◄──── TGW (aros-core) [Tráfico enrutado a ALB Interno]                           │ │    │
│  │  │       │                                                                                          │ │    │
│  │  │       ▼                                                                                          │ │    │
│  │  │  ALB Interno — Security Group: solo acepta tráfico desde 10.0.0.0/16 (Core VPC)                  │ │    │
│  │  │       │                                                                                          │ │  │
│  │  │       ├─────────► ECS Fargate (Clinic Internal API)                                              │ │  │
│  │  │       │             · Gestiona /studies/ y /reports/ localmente                                  │ │  │
│  │  │       │             · Recibe Webhook OnStableStudy de Orthanc (localhost/VPC)                    │ │  │
│  │  │       │             │                                                                            │ │  │
│  │  │       │             └────► RDS PostgreSQL (Clinic DB: StudyRequest, Study, Report)               │ │  │
│  │  │       │                                                                                          │ │  │
│  │  │       └─────────► ECS Fargate (Orthanc PACS)                                                     │ │  │
│  │  │                     · DICOM C-STORE: Recibe de Modalidades (Puerto 4242)                         │ │  │
│  │  │                     · Plugin S3 ────► S3 Bucket: orthanc-san-jose-dicom                          │ │  │
│  │  │                                      (Privado · KMS · Versionado · Sin acceso público)           │ │  │
│  │  │                     · Plugin PostgreSQL → RDS PostgreSQL (Clinic DB, esquema orthanc)            │ │  │
│  │  │                                                                                                  │ │  │
│  │  │  CloudTrail: audit trail HIPAA de esta cuenta (Propiedad de la clínica)                          │ │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                                                         │  │
│  │  ┌──── CUENTA: clinic-radiologia-norte (VPC: 10.2.0.0/16) ──────────────────────────────────────────┐ │  │
│  │  │  (Idéntica estructura de red, ECS y S3, totalmente aislada)                                      │ │  │
│  │  │  · Clinic DB: RDS Local (Aislado)                                                                │ │  │
│  │  │  · S3: orthanc-radiologia-norte-dicom                                                            │ │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                                                         │  │
│  │  ┌──── CUENTA: clinic-{N} (VPC: 10.N.0.0/16) ─────────────────────────────────────────────────────┐ │  │
│  │  │  (Provisionada automáticamente por Terraform Pipeline al onboardear clínica)                     │ │  │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                                 │
│  ┌──────────────────────── OU: Security & Logging ────────────────────────────────────────────────────────┐  │
│  │  CUENTA: aros-security                                                                                 │  │
│  │  · AWS Security Hub: agrega findings de todas las cuentas                                              │  │
│  │  · AWS Config: reglas de cumplimiento HIPAA (cifrado S3, MFA, no public access)                        │  │
│  │  · CloudTrail Lake: logs centralizados de todas las cuentas                                            │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
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

### 7.5 Beneficios de Cumplimiento de la Arquitectura "Zero-Data"
La adopción estricta de una arquitectura "Zero Clinical Data Retention" en la plataforma central simplifica radicalmente la auditoría y el cumplimiento de normativas de salud como HIPAA. Al delegar el almacenamiento de la información médica protegida (PHI) hacia las cuentas aisladas de cada clínica y operar AROS únicamente como un Identity Provider y Gateway de enrutamiento en tiempo real, se descentraliza la responsabilidad legal. Un hipotético compromiso de seguridad en la cuenta central de AROS no expondría historiales clínicos, imágenes ni diagnósticos, ya que estos datos nunca residen en los discos o bases de datos de `aros-core`.

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

### Fase 1 — Arquitectura del Monorepo *(Semana 1)*
- [ ] Eliminar la antigua carpeta `apps/backend/`.
- [ ] Crear la estructura `apps/core-api/` (Identity Provider & Gateway).
- [ ] Crear la estructura `apps/clinic-api/` (Microservicio de la clínica).
- [ ] Definir modelos `User`, `PatientProfile`, `ClinicRegistry`, `Roles` en `core-api`.
- [ ] Definir modelos `StudyRequest`, `Study`, `Report` en `clinic-api`.

### Fase 2 — Autenticación en AROS Core API *(Semana 2)*
- [ ] Implementar JWT en `core-api` con roles y claims.
- [ ] Configurar middleware de seguridad y CORS.

### Fase 3 — Federated Query en AROS Core API *(Semana 2-3)*
- [ ] Implementar cliente HTTP asíncrono (`httpx`) en `core-api`.
- [ ] Implementar patrón Federated Query: `GET /patient/history/` dispara peticiones concurrentes a las URLs internas de las clínicas registradas para el paciente.
- [ ] Configurar proxy WADO-RS transparente en `core-api` hacia los ALBs internos de las clínicas.

### Fase 4 — Clinic Internal API y Webhooks Locales *(Semana 3-4)*
- [ ] Implementar endpoints en `clinic-api` para gestionar `StudyRequest` y `Report`.
- [ ] Implementar receptor local de Webhooks en `clinic-api` para vincular estudios.
- [ ] Dockerizar el `clinic-api`.

### Fase 5 — Configuración de Orthanc PACS *(Semana 4)*
- [ ] Configurar el archivo `orthanc.json`.
- [ ] Configurar Orthanc para enviar el Webhook `OnStableStudy` hacia la URL local del `clinic-api` (dentro de la misma VPC, sin salir a internet).

### Fase 6 — Portales Frontend *(Semana 5-7)*
- [ ] Conectar Portal Clínica y Portal Paciente al AROS Core API.
- [ ] Renderizar visor OHIF utilizando la ruta proxy WADO-RS del Core API.

### Fase 7 — Terraform: Aprovisionamiento Automatizado *(Semana 8-9)*
- [ ] Módulo central `aros-core`: ECS Core API, RDS Central, Transit Gateway.
- [ ] Módulo de aprovisionamiento de Clínica ("Plug & Play"):
  - [ ] ALB Interno.
  - [ ] ECS Fargate para **Orthanc PACS**.
  - [ ] ECS Fargate para **Clinic Internal API**.
  - [ ] RDS PostgreSQL local.
  - [ ] S3 Bucket (DICOM).
- [ ] Probar el despliegue automático de una clínica nueva y la interconexión por TGW.

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