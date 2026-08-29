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

### 2.1 Paradigma: Despliegue en Silos y Separación AROS/Clínica

La arquitectura v2 consolida un modelo de separación física y lógica. **AROS Technologies** provee el **Portal Paciente** de manera centralizada. Por otro lado, la **Clínica** cuenta con su propia infraestructura (AWS Independiente) donde reside su propio Portal Clínica, su Visor DICOM (OHIF), su Django REST API, su servidor Orthanc y su Bucket S3 (garantizando cumplimiento HIPAA y aislamiento total).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            INTERNET (HTTPS/TLS)                              │
└──────┬────────────────────────────────────────────┬──────────────────────────┘
       │                                            │
       ▼                                            ▼
┌───────────────────────────┐    ┌─────────────────────────────────────────────┐
│     AROS TECHNOLOGIES     │    │         INFRAESTRUCTURA DE LA CLÍNICA       │
│      (Infra Central)      │    │              (AWS Independiente)            │
│                           │    │                                             │
│ ┌───────────────────────┐ │    │ ┌──────────────┐      ┌───────────────────┐ │
│ │    Portal Paciente    │ │    │ │Portal Clínica│      │ Visor DICOM (OHIF)│ │
│ │ (Multi-Clínica API)   │ │    │ │  (Next.js)   │      │ (Radiólogos)      │ │
│ └──────────┬────────────┘ │    │ └──────┬───────┘      └─────────┬─────────┘ │
│            │              │    │        │ API REST (JSON)        │           │
│ ┌──────────▼────────────┐ │    │        ▼                        │ WADO-RS   │
│ │   Visor DICOM (OHIF)  │ │    │  ┌───────────────┐              │           │
│ │   (Pacientes)         │ │    │  │Django REST API│◄─ Webhook ──┐│           │
│ └───────────────────────┘ │    │  │(DRF + JWT Auth)├─ API REST ─┼▼─────────┐ │
└────────────┬──────────────┘    │  └─┬───────────┬─┘             │  Orthanc │ │
             │ API REST          │ ┌──┤           │               │   PACS   │◄┼─┐
             ├───────────────────┼─┘  ▼           ▼               │          │ │ │ DICOM
             │ WADO-RS           │ ┌────────┐ ┌──────┐            └─────┬────┘ │ │ C-STORE
             └───────────────────┼─►Postgres│ │Redis │                  │      │ │ (LAN/VPN)
                                 │ └────────┘ └──────┘            ┌─────▼────┐ │ │
                                 │                                │ AWS S3   │ │ │
                                 │                                │ Bucket   │ │ │
                                 │                                └──────────┘ │ │
                                 └─────────────────────────────────────────────┘ │
                                                                                 │
                                              ┌──────────────────────┐           │
                                              │ Máquina Radiología   ├───────────┘
                                              │ (Modalidad en sitio) │
                                              └──────────────────────┘
```

**Puntos clave del diagrama:**
- La máquina de radiología envía el estudio DICOM **automáticamente** al terminar, sin ninguna acción manual del técnico o radiólogo
- El protocolo de transmisión es **DICOM C-STORE** (puerto 4242), el estándar de la industria para envío de imágenes médicas entre equipos
- Orthanc actúa como **SCP (Storage Service Class Provider)**: escucha en el puerto 4242 y acepta estudios entrantes
- El **Accession Number** (generado por Django al crear la `StudyRequest`) es el campo que vincula el estudio recibido por Orthanc con la solicitud clínica registrada en la base de datos
- OHIF Viewer consume imágenes exclusivamente vía DICOMweb (WADO-RS) desde Orthanc
- Orthanc persiste los archivos `.dcm` en el S3 de la clínica de forma completamente transparente
- El servidor PACS envia las imagenes a la bucket de S3 de la clínica de forma automatica. 

### 2.2 Modelo de Datos: Arquitectura Híbrida con PACS Central

La arquitectura separa lógicamente **tres capas de datos**:

**Capa 1 — Datos textuales y relacionales (PostgreSQL centralizado):**
- Perfiles de pacientes, clínicas, usuarios, solicitudes de estudio y reportes médicos
- Acceso en milisegundos; texto compacto, barato de alojar

**Capa 2 — Índice de imágenes DICOM (PostgreSQL de Orthanc):**
- Orthanc mantiene su propia base de datos de índice (puede ser la misma instancia de RDS o una dedicada)
- Registra cada Study, Series e Instance con sus UIDs y metadatos DICOM estándar
- Django guarda en `Study.orthanc_study_id` el identificador de Orthanc para referenciar las imágenes

**Capa 3 — Archivos binarios DICOM (S3 BYOS de cada Clínica):**
- Los archivos `.dcm` físicos residen en los buckets de cada clínica
- Orthanc los gestiona de forma transparente a través del plugin de AWS S3
- Ningún otro componente del sistema accede directamente a S3 para imágenes

```
┌─────────────────────────────────────────────────────────────────────┐
│        BASE DE DATOS CENTRAL (PostgreSQL — capa de texto)           │
│                                                                     │
│  StudyRequest {                        Study {                      │
│    id: 7,                                id: 42,                    │
│    patient: "Juan García",               study_request: FK→7,       │
│    clinic: "Clínica San José",           orthanc_study_id: "a3f",   │
│    accession_number: "ACC-2026-0042", ◄──accession_number: same,    │
│    modality: "RX",                       dicom_study_uid: "1.2."    │
│    status: "received"                    date: "2026-06-01"         │
│  }                                     }                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Webhook OnStableStudy (accession_number)
                            │ Django empareja StudyRequest → Study
                            │
                            │ Django consulta via API REST de Orthanc
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│          ORTHANC PACS (índice DICOM — capa de metadatos)            │
│                                                                     │
│  StudyInstanceUID: "1.2.840.10008..."                               │
│  AccessionNumber: "ACC-2026-0042" ◄── clave de emparejamiento        │
│  Series: [ { SeriesUID: "...", Instances: ["...", "..."] } ]        │
│  PatientID: "MRN-00042"                                             │
│  Origen: C-STORE desde Máquina RX (AET: XRAY_ROOM_1)                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Plugin AWS S3 (automático)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BUCKET S3 CLÍNICA (archivos binarios — capa de almacenamiento)     │
│                                                                     │
│  s3://clinica-san-jose-bucket/                                      │
│  └── orthanc/                                                       │
│      └── a3f2c1.../                                                 │
│          ├── instance_001.dcm (850 MB — imagen 1)                   │
│          └── instance_002.dcm (820 MB — imagen 2)                   │
│                                                                     │
│  Pagado por la Clínica San José, no por MedCloud                    │
└─────────────────────────────────────────────────────────────────────┘
```

**El Accession Number como clave de integración:**

El **Accession Number** (campo DICOM `0008,0050`) es el identificador que conecta el mundo clínico (la `StudyRequest` registrada por el asistente) con el mundo de imágenes (el estudio recibido por Orthanc). El flujo es:

1. El asistente crea la `StudyRequest` → Django genera y guarda `accession_number = "ACC-2026-0042"`
2. El técnico ingresa ese código en la máquina antes de tomar las imágenes (como si fuera un número de orden)
3. La máquina embebe el Accession Number en cada archivo `.dcm` del estudio
4. Orthanc recibe los archivos y los indexa con ese Accession Number
5. Webhook `OnStableStudy` → Django extrae el Accession Number → encuentra la `StudyRequest` → crea el `Study` vinculado

**Flujo de referencia BYOS con Orthanc:**
1. El Admin de la clínica configura sus credenciales S3 en el Portal Clínica
2. Django las envía a AWS Secrets Manager y guarda el ARN en la base de datos
3. Orthanc recupera las credenciales de Secrets Manager al inicializar su plugin S3
4. A partir de ese momento, Orthanc almacena y recupera los DICOMs del bucket de la clínica sin que ningún otro componente del sistema lo sepa

### 2.3 White-Labeling del Portal Clínica

El Portal Clínica es una **sola aplicación Next.js desplegada una sola vez** que se adapta visualmente a cada clínica según su subdominio:

```
clinica-san-jose.medcloud.com → azul corporativo, logo San José
radiologia-norte.medcloud.com → verde institucional, logo Norte
clinica-xyz.medcloud.com → colores personalizados, logo XYZ
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

### 3.4 Servidor PACS — Orthanc

Orthanc es un servidor PACS (Picture Archiving and Communication System) ligero, open-source y orientado al protocolo estándar DICOM. Actúa como el **intermediario médico central** de la arquitectura, eliminando la necesidad de que Django o los frontends manejen archivos DICOM directamente.

| Componente | Versión / Detalle | Rol |
|---|---|---|
| **Orthanc Core** | 1.12.11 (stable) | Servidor PACS central; indexa y sirve estudios DICOM |
| **SCP DICOM C-STORE** | Integrado en el core | Escucha en el **puerto 4242**: recibe estudios enviados automáticamente por las máquinas de radiología (modalidades); ningún usuario interviene |
| **Plugin DICOMweb** | Oficial Orthanc | Expone los endpoints WADO-RS, STOW-RS y QIDO-RS que OHIF consume |
| **Plugin PostgreSQL** | Oficial Orthanc | Almacena el índice de estudios/series/instancias en PostgreSQL (mismo RDS) |
| **Plugin AWS S3** | Oficial Orthanc | Persiste los archivos `.dcm` en los buckets S3 de cada clínica (BYOS) |
| **Webhooks `OnStableStudy`** | Función nativa de Orthanc | Notifica a Django cuando un estudio ha terminado de recibir instancias; el payload incluye `AccessionNumber` para emparejar con `StudyRequest` |
| **API REST** | Nativa de Orthanc | Permite a Django consultar estudios, series e instancias por UID |

**Endpoints DICOMweb que Orthanc expone (consumidos por OHIF):**

| Endpoint | Protocolo | Descripción |
|---|---|---|
| `GET /dicom-web/studies` | QIDO-RS | Buscar estudios por atributos DICOM |
| `GET /dicom-web/studies/{uid}/series` | QIDO-RS | Listar series de un estudio |
| `GET /dicom-web/studies/{uid}/series/{s}/instances/{i}/frames/{f}` | WADO-RS | Obtener un frame de imagen específico |
| `POST /dicom-web/studies` | STOW-RS | Recibir y almacenar un nuevo estudio DICOM |

**Licenciamiento:**
- **Orthanc Core**: GPLv3+ — libre de usar, modificar y distribuir; cualquier distribución del binario modificado debe liberar el código fuente
- **Plugin DICOMweb**: AGPLv3+ — aplica el copyleft también a usos en red (SaaS); para uso interno en MedCloud (sin redistribución del plugin), el uso es legal
- **Plugin PostgreSQL y Plugin AWS S3**: AGPLv3+ — mismo alcance que el plugin DICOMweb

> [!IMPORTANT]
> En el contexto de MedCloud, todos los plugins de Orthanc se usan como componentes internos de infraestructura (no se redistribuyen ni modifican). El modelo SaaS de MedCloud es compatible con las licencias GPLv3/AGPLv3 para uso interno. Se recomienda consultar asesoría legal antes de redistribuir los binarios de Orthanc con plugins modificados.

### 3.5 Infraestructura — AWS con Terraform

| Servicio AWS | Rol en la Arquitectura |
|---|---|
| **ECS Fargate** | Correr los contenedores de Django, Orthanc y OHIF sin gestionar servidores |
| **RDS PostgreSQL 16** | Base de datos relacional administrada compartida entre Django y el plugin PostgreSQL de Orthanc |
| **ElastiCache Redis** | Broker de mensajes para los WebSockets de Django Channels |
| **ALB (×3)** | Un Load Balancer dedicado por servicio: Backend Django, OHIF Viewer, Orthanc PACS |
| **AWS Amplify** | CI/CD y hosting de los dos portales Next.js |
| **AWS S3** | Buckets BYOS en las cuentas de las clínicas; Orthanc escribe y lee via el plugin AWS |
| **AWS Secrets Manager** | Credenciales S3 de cada clínica (las recupera Orthanc al iniciar, nunca están en la BD) |
| **AWS ECR** | Registro de imágenes Docker (Django, Orthanc personalizado, OHIF) |
| **AWS CloudWatch** | Logs centralizados de todos los servicios |
| **AWS IAM** | Roles y políticas de permisos entre servicios |
| **AWS Route 53** | DNS: `api.medcloud.com`, `viewer.medcloud.com`, `pacs.medcloud.com`, `*.medcloud.com` |
| **AWS ACM** | Certificados SSL/TLS para HTTPS en todos los dominios |
| **Terraform** | Infrastructure as Code — toda la infraestructura definida en archivos `.tf` versionables |

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

## 6. Infraestructura Cloud (AWS)

### 6.1 Diagrama de Infraestructura

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           CUENTA AWS MEDCLOUD                             │
│                                                                           │
│   Route 53 (DNS)                                                          │
│     api.medcloud.com    ──► ALB Backend (Django)                          │
│     viewer.medcloud.com ──► ALB OHIF (público)                            │
│     pacs.medcloud.com   ──► ALB Orthanc (interno, acceso restringido)     │
│     *.medcloud.com      ──► AWS Amplify (portales Next.js)                │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────┐           │
│   │                    VPC (Red Privada)                      │           │
│   │                                                           │           │
│   │   Subnets Públicas (ALBs):     Subnets Privadas (Fargate):│           │
│   │                                                           │           │
│   │   ┌─────────────┐  ────────►   ┌──────────────────────┐   │           │
│   │   │ ALB Django  │              │   ECS: Django API    │   │           │
│   │   │  (público)  │              │     (DRF + JWT)      │   │           │
│   │   └─────────────┘              └────────────┬─────────┘   │           │
│   │                                             │             │           │
│   │                                     httpx   ▼             │           │
│   │   ┌─────────────┐  ────────►   ┌──────────────────────┐   │           │
│   │   │ ALB Orthanc │              │  ECS: Orthanc PACS   │   │           │
│   │   │  (interno)  │              │    (Core 1.12.11)    │   │           │
│   │   └─────────────┘              │   · Plugin DICOMweb  │   │           │
│   │                                │   · Plugin Postgres  │   │           │
│   │   ┌─────────────┐  ────────►   │   · Plugin AWS S3    │   │           │
│   │   │  ALB OHIF   │              └──────────────────────┘   │           │
│   │   │  (público)  │                                         │           │
│   │   └─────────────┘  ────────►   ┌──────────────────────┐   │           │
│   │                                │   ECS: OHIF Viewer   │   │           │
│   │                                │  (Nginx + OHIF v3)   │   │           │
│   │                                └──────────────────────┘   │           │
│   │                                                           │           │
│   │   ┌──────────────────┐         ┌──────────────────────────┐           │
│   │   │  RDS PostgreSQL  │         │    ElastiCache Redis     │           │
│   │   │ (Django + Orth.) │         │  (Channels WebSockets)   │           │
│   │   └──────────────────┘         └──────────────────────────┘           │
│   └───────────────────────────────────────────────────────────┘           │
│                                                                           │
│   Servicios Globales:                                                     │
│   ┌──────────────────┐  ┌───────────┐  ┌────────────────────────────────┐ │
│   │ Secrets Manager  │  │    ECR    │  │          AWS Amplify           │ │
│   │ · medcloud/rds   │  │ · django  │  │      patient.medcloud.com      │ │
│   │ · medcloud/django│  │ · orthanc │  │   *.medcloud.com (clínicas)    │ │
│   │ · medcloud/clinic│  │ · ohif    │  │                                │ │
│   │   /{slug}/s3     │  └───────────┘  └────────────────────────────────┘ │
│   └──────────────────┘                                                    │
└───────────────────────────────────────────────────────────────────────────┘

Cuentas AWS separadas de cada Clínica (BYOS):
┌──────────────────────────────────────────────────────┐
│          AWS S3 Bucket — Clínica San José            │
│          s3://clinica-san-jose/orthanc/...           │
│          (Orthanc escribe y lee via S3)              │
│     (Pagado por la Clínica, no por MedCloud)         │
└──────────────────────────────────────────────────────┘
```

### 6.2 Recursos Terraform por Módulo

| Módulo Terraform | Recursos AWS incluidos |
|---|---|
| **`networking`** | VPC, 2 subnets públicas, 2 subnets privadas, Internet Gateway, NAT Gateway, Route Tables, Security Groups (uno por servicio) |
| **`backend`** | ECS Cluster, Task Definition (Django), ECS Service Fargate, ALB público, Target Group, CloudWatch Log Group, ECR Repository (Django), IAM Role Execution + Task, Secrets Manager (DATABASE_URL, SECRET_KEY, ORTHANC_URL) |
| **`orthanc`** | ECS Task Definition (Orthanc), ECS Service Fargate, ALB **interno** para DICOMweb (puerto 8042, sin acceso desde internet), Target Group, ECR Repository (Orthanc custom), CloudWatch Log Group, IAM Policy para leer Secrets Manager, Security Group con dos reglas: (1) puerto 8042 solo desde Django y OHIF dentro de la VPC; (2) **puerto 4242 (DICOM C-STORE) accesible desde la red privada o VPN de las clínicas** |
| **`dicom-viewer`** | ECS Task Definition (OHIF), ECS Service Fargate, ALB público, ECR Repository (OHIF), CloudWatch Log Group |
| **`patient-portal`** | Amplify App, Amplify Branch (main), Variables de entorno |
| **`clinic-portal`** | Amplify App, Amplify Branch (main), Custom Rules para subdominios wildcard `*.medcloud.com` |
| **`database`** (compartido) | RDS PostgreSQL Instance, RDS Subnet Group, RDS Parameter Group, Secrets Manager (credenciales RDS), Security Group (acepta tráfico de Django y Orthanc) |
| **`cache`** | ElastiCache Redis Cluster, ElastiCache Subnet Group, Security Group |

### 6.3 Modelo de Costos

| Componente | Servicio AWS | Pagador |
|---|---|---|
| Django API | ECS Fargate | **MedCloud** |
| Orthanc PACS | ECS Fargate | **MedCloud** |
| OHIF Viewer | ECS Fargate | **MedCloud** |
| Base de datos central | RDS PostgreSQL | **MedCloud** |
| Redis | ElastiCache | **MedCloud** |
| Portal Paciente | AWS Amplify | **MedCloud** |
| Portal Clínica | AWS Amplify | **MedCloud** |
| **Almacenamiento DICOM** | S3 (bucket propio) | **Cada Clínica** |
| **Ancho de banda DICOM** | S3 Data Transfer (vía Orthanc) | **Cada Clínica** |

---

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
- OHIF Viewer se comunica con Orthanc vía la URL `https://pacs.medcloud.com` (ALB interno expuesto con restricción de IP a los rangos de la VPC)
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
- [ ] Configurar CORS en Orthanc para aceptar peticiones de OHIF (`viewer.medcloud.com`)

### Fase 6 — BYOS S3 + AWS Secrets Manager *(Semana 4)*
- [ ] Implementar `get_s3_credentials()` en el modelo `Clinic` (llama a Secrets Manager)
- [ ] Implementar `POST /clinic/settings/s3/` — guarda credenciales en Secrets Manager, devuelve solo el ARN; el ARN se almacena en la BD para que Orthanc lo use al inicializar el plugin
- [ ] Implementar el mecanismo para que Orthanc recargue la configuración del plugin S3 cuando cambia la clínica activa (gestión multi-tenant del plugin)
- [ ] Implementar `GET /studies/{id}/viewer-url/` — construye la URL completa de OHIF con el `StudyInstanceUID` de Orthanc

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
- `wadoUriRoot`: `https://pacs.medcloud.com/dicom-web`
- `qidoRoot`: `https://pacs.medcloud.com/dicom-web`
- `wadoRoot`: `https://pacs.medcloud.com/dicom-web`
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
- [ ] Verificar conectividad OHIF → Orthanc DICOMweb

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
ALB (×3: Django, Orthanc interno, OHIF) · AWS Amplify
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