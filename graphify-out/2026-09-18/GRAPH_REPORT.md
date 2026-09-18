# Graph Report - AROS_PACS  (2026-09-16)

## Corpus Check
- 219 files · ~372,922 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1298 nodes · 1555 edges · 149 communities (105 shown, 44 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 125 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70f5b3f6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- User
- aws_utils.py
- compilerOptions
- compilerOptions
- clinic-portal/src/App.tsx
- compilerOptions
- patient-portal/src/App.tsx
- email_service.py
- notifications.py
- compilerOptions
- 8. Plan de Implementación — Tareas
- physician-portal/src/App.tsx
- scripts
- permissions/__init__.py
- compilerOptions
- tasks
- NotificationConsumer
- compilerOptions
- ClinicalStudiesView
- Command
- start.sh
- OrthancWebhookView
- eslint-config/package.json
- clinical_data/models.py
- StudyRequest
- dependencies
- dependencies
- clinic-portal/package.json
- patient-portal/package.json
- devDependencies
- react-phone-number-input
- devDependencies
- devDependencies
- @types/react-dom
- scripts
- clinical_data/urls.py
- serve-viewer.mjs
- EmailBackend
- ClinicalDataConfig
- AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc
- AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc
- compilerOptions
- @types/node
- @types/react
- typescript
- @vitejs/plugin-react
- CoreConfig
- UserManager
- typescript-config/package.json
- status.sh
- main
- compilerOptions
- @types/leaflet
- clinic-portal/tsconfig.json
- GatewayConfig
- IdentityConfig
- AROS Technologies — Modelo de Costos de Infraestructura y Pricing (Ultra-Optimizado)
- main
- patient-portal/tsconfig.json
- physician-portal/tsconfig.json
- ClinicNotificationConsumer
- clinic_api/settings.py
- clinic_api/wsgi.py
- clinical_data/migrations/0001_initial.py
- 0002_remove_study_idx_study_patient_date_and_more.py
- 0003_remove_studyrequest_patient_and_more.py
- arosPacs/wsgi.py
- core-api/entrypoint.sh
- identity/migrations/0001_initial.py
- 0002_clinicregistry_api_url_clinicregistry_webhook_secret_and_more.py
- 0003_user_role.py
- 0004_patientprofile.py
- 0005_clinicregistry_primary_color.py
- 0006_patientdoctorconsent.py
- 0007_clinicregistry_address_clinicregistry_email_and_more.py
- 0008_clinicregistry_total_reviews_and_more.py
- 0009_patientprofile_allergies_patientprofile_blood_type.py
- 0010_clinicregistry_report_layout.py
- 0011_remove_staffprofile_avatar_url_user_avatar.py
- orthanc/entrypoint.sh
- logs.sh
- stop.sh
- Documentación y Aseguramiento de Calidad del Backend (AROS PACS)
- Med Cloud
- Fases de Implementación
- gateway/urls.py
- react-library.json
- clinic_integration.py
- ClinicService
- Dashboard Models
- AROS Technologies — Propuesta de Valor y Argumento Comercial
- PhysicianPatientsView
- Tareas de Despliegue - AWS Terraform (Modo Dev)
- notify_clinic_new_study
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- Criterios de Éxito (TDD / Acceptance Criteria)
- DESIGN.md
- 2. Core Business Workflows
- federated.py
- Actualización de Landing Page: Sección de Precios y Propuesta de Valor
- webhooks.py
- AROS PACS - Backend Structure
- MAIN IDEA
- scripts
- React + TypeScript + Vite
- React + TypeScript + Vite
- React + TypeScript + Vite
- rules/graphify.md
- workflows/graphify.md
- vite
- vite
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `User` - 33 edges
2. `PatientProfile` - 31 edges
3. `Roles` - 29 edges
4. `ClinicRegistry` - 27 edges
5. `StaffProfile` - 24 edges
6. `compilerOptions` - 18 edges
7. `compilerOptions` - 18 edges
8. `compilerOptions` - 18 edges
9. `compilerOptions` - 15 edges
10. `ClinicService` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Meta` --uses--> `StudyRequest`  [INFERRED]
  apps/core-api/core/forms.py → apps/clinic-api/clinical_data/models.py
- `Command` --uses--> `StudyRequest`  [INFERRED]
  apps/core-api/core/management/commands/populate_db.py → apps/clinic-api/clinical_data/models.py
- `Command` --uses--> `Report`  [INFERRED]
  apps/core-api/core/management/commands/populate_db.py → apps/clinic-api/clinical_data/models.py
- `OrthancWebhookView` --uses--> `Study`  [INFERRED]
  apps/clinic-api/clinical_data/views/orthanc_webhook.py → apps/clinic-api/clinical_data/models.py
- `ClinicalStudiesView` --uses--> `Study`  [INFERRED]
  apps/clinic-api/clinical_data/views/studies.py → apps/clinic-api/clinical_data/models.py

## Import Cycles
- None detected.

## Communities (149 total, 44 thin omitted)

### Community 0 - "User"
Cohesion: 0.05
Nodes (64): AbstractBaseUser, action, Notifies an Associate Doctor that their registration was manually      approved, send_doctor_approved_email(), approve_physicians(), PatientProfileAdmin, StaffProfileAdmin, UserAdmin (+56 more)

### Community 1 - "aws_utils.py"
Cohesion: 0.14
Nodes (12): Django settings for arosPacs project.  Generated by 'django-admin startproject', _generate_local_keys(), get_active_rsa_keys(), kms_decrypt(), Returns the private key, public key, and kid (Key ID).     In a production envir, # TODO: Add AWS Secrets Manager logic here for production, # TODO: Implement boto3 KMS encryption, Decrypts text using AWS KMS. (Mocked for dev) (+4 more)

### Community 2 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 3 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 4 - "clinic-portal/src/App.tsx"
Cohesion: 0.06
Nodes (20): api, failedQueue, App(), ViewState, createImage(), getCroppedImg(), getRadianAngle(), DictationScreen() (+12 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, declaration, declarationMap, incremental, jsx, lib, module (+12 more)

### Community 6 - "patient-portal/src/App.tsx"
Cohesion: 0.08
Nodes (11): api, failedQueue, arosIcon, ViewState, createImage(), getCroppedImg(), getRadianAngle(), DateSelectorProps (+3 more)

### Community 7 - "email_service.py"
Cohesion: 0.13
Nodes (16): _make_verification_token(), Platform-wide Email Dispatch Service. Handles compiling HTML templates into emai, Creates a cryptographically signed, timestamped token containing the user's prim, Notifies a rejected Associate Doctor applicant that their medical      credentia, Validates a signed token to ensure it hasn't expired and hasn't been tampered wi, Compiles and dispatches an Account Verification email containing      the secure, Compiles and dispatches a branded Welcome email to the user      triggering imme, Notifies a Patient that their final medical report has been released.          C (+8 more)

### Community 8 - "notifications.py"
Cohesion: 0.11
Nodes (25): notify_consent_granted(), notify_consent_revoked(), notify_doctor_approved(), notify_doctor_denied(), notify_doctor_pending_approval(), notify_images_available(), notify_new_study(), notify_report_completed() (+17 more)

### Community 9 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 10 - "8. Plan de Implementación — Tareas"
Cohesion: 0.04
Nodes (44): 1. Visión General del Producto Final, 2.1 Paradigma: Despliegue en Silos y Separación AROS/Clínica, 2.2 Modelo de Datos: Arquitectura Híbrida con PACS Central, 2.3 White-Labeling del Portal Clínica, 2. Arquitectura del Sistema, 3.1 Backend — Django REST API, 3.2 Frontend — Portal Paciente y Portal Clínica, 3.3 Visor DICOM — OHIF Viewer (+36 more)

### Community 11 - "physician-portal/src/App.tsx"
Cohesion: 0.12
Nodes (8): api, failedQueue, ViewState, createImage(), getCroppedImg(), getRadianAngle(), ImageCropper(), ImageCropperProps

### Community 12 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, turbo, typescript, turbo, typescript, name, packageManager (+13 more)

### Community 13 - "permissions/__init__.py"
Cohesion: 0.13
Nodes (11): IsAssistantUser, BasePermission, Enforces authorization allowing ONLY administrative front-desk staff     who bel, IsAssociatedDoctor, IsReportingDoctor, BasePermission, Enforces authorization allowing ONLY referring Associate Doctors     who belong, Enforces authorization allowing ONLY internal Reporting Radiologists     who bel (+3 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, composite, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, inlineSources, isolatedModules (+10 more)

### Community 15 - "tasks"
Cohesion: 0.11
Nodes (18): ^build, dist/**, ^lint, .next/**, public/dist/**, ^typecheck, dependsOn, outputs (+10 more)

### Community 16 - "NotificationConsumer"
Cohesion: 0.13
Nodes (6): ASGI config for arosPacs project.  It exposes the ASGI callable as a module-leve, NotificationConsumer, JsonWebsocketConsumer, WebSocket consumer for real-time notifications.     Determines the user's role o, Handler for 'send_notification' type messages.         Forwards the notification, URL Routing for the Core engine. Maps fundamental routes, such as PDF generation

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 18 - "ClinicalStudiesView"
Cohesion: 0.19
Nodes (9): get_jwks_client(), Returns the singleton PyJWKClient, creating it on first use.     This lazy patte, Validates Machine-to-Machine JWTs sent by the core-api gateway.     It mathemati, S2SAuthentication, ClinicalStudiesView, APIView, Returns a JSON list of studies for a specific patient.     Protected by S2S JWT, BaseAuthentication (+1 more)

### Community 20 - "start.sh"
Cohesion: 0.28
Nodes (11): check_prerequisites(), ensure_docker_running(), monitor_processes(), print_banner(), register_pid(), setup_backends(), setup_frontends(), start.sh script (+3 more)

### Community 21 - "OrthancWebhookView"
Cohesion: 0.24
Nodes (8): URL configuration for clinic_api project.  The `urlpatterns` list routes URLs to, health_check(), Liveness probe — returns 200 if the process is running., Readiness probe — validates DB connection before accepting traffic., ready_check(), OrthancWebhookView, APIView, Receives webhooks from the local Orthanc instance when new studies arrive (OnSta

### Community 22 - "eslint-config/package.json"
Cohesion: 0.17
Nodes (11): eslint, eslint-config-next, eslint-config-prettier, dependencies, eslint, eslint-config-next, eslint-config-prettier, main (+3 more)

### Community 23 - "clinical_data/models.py"
Cohesion: 0.24
Nodes (6): Concrete DICOM study received from Orthanc., Report, Study, APIView, Create a Report with findings and conclusions., ReportView

### Community 24 - "StudyRequest"
Cohesion: 0.19
Nodes (10): Meta, Study request local to the clinic., StudyRequest, APIView, Create a StudyRequest linked to an AROS patient_id., StudyRequestView, notify_clinic_study_request(), Notify clinic assistants that a new study request was registered. (+2 more)

### Community 25 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, axios, leaflet, react, react-dom, react-easy-crop, react-leaflet, react-quill-new (+11 more)

### Community 26 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, axios, leaflet, react, react-dom, react-easy-crop, react-leaflet, react-phone-number-input (+7 more)

### Community 27 - "clinic-portal/package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 28 - "patient-portal/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 29 - "devDependencies"
Cohesion: 0.05
Nodes (39): dependencies, axios, react, react-dom, react-easy-crop, react-phone-number-input, devDependencies, oxlint (+31 more)

### Community 31 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, oxlint, postcss, tailwindcss, @tailwindcss/vite, @types/react, @vitejs/plugin-react (+7 more)

### Community 32 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, oxlint, postcss, tailwindcss, @tailwindcss/vite, @types/node, @types/react-dom (+9 more)

### Community 34 - "scripts"
Cohesion: 0.29
Nodes (6): name, private, scripts, build, dev, lint

### Community 35 - "clinical_data/urls.py"
Cohesion: 0.40
Nodes (3): OrthancWadoProxyView, APIView, Proxies WADO-RS requests to the internal Orthanc server.     Protected by S2S JW

### Community 36 - "serve-viewer.mjs"
Cohesion: 0.33
Nodes (5): __dirname, __filename, MIME_TYPES, ROOT_DIR, server

### Community 37 - "EmailBackend"
Cohesion: 0.40
Nodes (3): EmailBackend, Authenticates against settings.AUTH_USER_MODEL.     Recognizes the user by email, ModelBackend

### Community 39 - "AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc"
Cohesion: 0.05
Nodes (42): 1. Visión General del Producto Final, 2.1 Paradigma: Federated APIs y Aislamiento Físico por Clínica, 2.2 Modelo de Datos: Zero Clinical Data Retention Estricto y Segregación de PHI, 2.3 White-Labeling del Portal Clínica, 2. Arquitectura del Sistema, 3.1 Backend — Django REST API, 3.2 Frontend — Portal Paciente y Portal Clínica, 3.3 Visor DICOM — OHIF Viewer (+34 more)

### Community 40 - "AROSPACS v3.0 — Arquitectura y Plan de Implementación con PACS Orthanc"
Cohesion: 0.05
Nodes (40): 1. Visión General del Producto Final, 2.1 Paradigma: Federated APIs y Aislamiento Físico por Clínica, 2.2 Modelo de Datos: Zero Clinical Data Retention Estricto, 2.3 White-Labeling del Portal Clínica, 2. Arquitectura del Sistema, 3.1 Backend — Django REST API, 3.2 Frontend — Portal Paciente y Portal Clínica, 3.3 Visor DICOM — OHIF Viewer (+32 more)

### Community 41 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 48 - "typescript-config/package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 49 - "status.sh"
Cohesion: 0.83
Nodes (3): check_http(), check_port(), status.sh script

### Community 52 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 57 - "AROS Technologies — Modelo de Costos de Infraestructura y Pricing (Ultra-Optimizado)"
Cohesion: 0.11
Nodes (18): 1. Definición de Perfiles de Clínica, 2.1 Cómputo — ECS Fargate (AWS Graviton ARM64), 2.2 Base de Datos — Amazon RDS PostgreSQL 16 (AWS Graviton), 2.3 Red — VPC Peering, Cloud Map y NAT Gateway, 2.4 Almacenamiento DICOM — Amazon S3 (Intelligent-Tiering), 2.5 Seguridad y Gestión, 2. Infraestructura AWS por Clínica — Desglose Línea por Línea (Optimizada), 3. Resumen de Costos Fijos por Clínica (Sin S3) (+10 more)

### Community 61 - "ClinicNotificationConsumer"
Cohesion: 0.17
Nodes (5): ASGI config for clinic_api project.  It exposes the ASGI callable as a module-le, ClinicNotificationConsumer, JsonWebsocketConsumer, WebSocket consumer for real-time notifications in the clinic-api.     Authentica, Handler for 'send_notification' type messages.         Forwards the notification

### Community 113 - "Documentación y Aseguramiento de Calidad del Backend (AROS PACS)"
Cohesion: 0.12
Nodes (16): 1.1 Core API (`apps/core-api/identity/models.py`), 1.2 Clinic API (`apps/clinic-api/clinical_data/models.py`), 1. Módulos de Modelos de Datos (`models.py`), 2. Resumen de Calidad (Modelos), 3.1 Core API (Gateway Federated Routing), 3.2 Clinic API (Internal Endpoints), 3. Vistas y Controladores (`views.py`), 4.1 Autenticación Server-to-Server (S2S JWT) (+8 more)

### Community 114 - "Med Cloud"
Cohesion: 0.13
Nodes (14): Alcance, Autores y Contacto, Descripción del proyecto, Ejecución, Estructura del proyecto, Guía de uso e instalación, Instalación, Med Cloud (+6 more)

### Community 115 - "Fases de Implementación"
Cohesion: 0.15
Nodes (12): Arquitectura de Red Multi-Cuenta, Contexto y Decisiones de Diseño, Estructura de Terraform (Multi-Cuenta), Fase 1: Foundation y Multi-Cuenta (AWS Organizations), Fase 2: Almacenamiento y Base de Datos (Dev), Fase 3: Seguridad Base (WAF, Secrets & KMS), Fase 4: Servicios Base (Correo y Notificaciones), Fase 5: ECS y Load Balancers (+4 more)

### Community 116 - "gateway/urls.py"
Cohesion: 0.22
Nodes (6): Synchronous View to proxy DICOMWeb requests directly to Orthanc for local simula, WadoRsProxyView, APIView, StudyReportPDFView, StudyReportPreviewPDFView, View

### Community 117 - "react-library.json"
Cohesion: 0.15
Nodes (12): compilerOptions, jsx, lib, module, target, display, extends, ./base.json (+4 more)

### Community 118 - "clinic_integration.py"
Cohesion: 0.23
Nodes (7): get_clinic_breaker(), Returns the CircuitBreaker instance for a specific clinic.     Creates one if it, generate_s2s_jwt(), Generates a Server-to-Server (S2S) JWT used by the Gateway to authenticate, Executes an HTTP request to a single clinic via Circuit Breaker.         Uses cl, Executes an HTTP request to fetch a specific study via Circuit Breaker., CircuitBreaker

### Community 119 - "ClinicService"
Cohesion: 0.25
Nodes (7): health_check(), ready_check(), ClinicService, Service class for abstracting network calls and circuit breaker logic     to ext, ClinicWorklistProxyView, APIView, Proxies worklist requests from clinic-portal to the specific clinic-api.

### Community 120 - "Dashboard Models"
Cohesion: 0.20
Nodes (9): AROS PACS - Database Dictionary, `assistantDashboard.Assistant` & `StudyRequest`, `associateDoctorDashboard.AssociateDoctor`, Core Models (`core.models`), Dashboard Models, `doctorsDashboard.ReportingDoctor`, `patientsDashboard.Patient`, `Report` (+1 more)

### Community 121 - "AROS Technologies — Propuesta de Valor y Argumento Comercial"
Cohesion: 0.20
Nodes (9): 1. El Desafío Inicial: La "Trampa" del Bajo Volumen, 2. El Argumento Central: El modelo "Por Estudio" castiga el éxito, 3. Análisis de Crecimiento: El verdadero impacto financiero, 4. Pilares Adicionales de Venta (Más allá del precio), 5. Estrategia de Cierre Sugerida, AROS Technologies — Propuesta de Valor y Argumento Comercial, ¿Cómo presentar esta tabla en la negociación?, El Poder de la Escalabilidad Cloud-Native (+1 more)

### Community 122 - "PhysicianPatientsView"
Cohesion: 0.22
Nodes (7): PhysicianPatientsView, PhysicianStudiesView, PhysicianStudyDetailView, APIView, Returns all patients that have granted active consent to this physician.     Enf, Returns all studies and reports of patients who have granted active consent to t, Returns single study & diagnostic report details.     Enforces HIPAA check: Requ

### Community 123 - "Tareas de Despliegue - AWS Terraform (Modo Dev)"
Cohesion: 0.22
Nodes (8): Fase 1: Foundation y Multi-Cuenta (AWS Organizations), Fase 2: Almacenamiento y Base de Datos (Dev), Fase 3: Seguridad Base (WAF, Secrets & KMS), Fase 4: Servicios Base (Correo), Fase 5: ECS y Load Balancers, Fase 6: CDN y Frontends, Fase 7: Parametrización, Tareas de Despliegue - AWS Terraform (Modo Dev)

### Community 124 - "notify_clinic_new_study"
Cohesion: 0.28
Nodes (6): notify_clinic_new_study(), notify_clinic_report_completed(), Notify clinic staff that a new study is available., Notify clinic staff that a report has been created/completed., Send a notification to a channel group in clinic-api., send_clinic_notification()

### Community 125 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas de Estructura (Linting & Formatting), 2. Pruebas de Tipado Transversal, 3. Pruebas de Orquestación de Turborepo (Pipeline), 4. Pruebas de Integración Continua (Docker Build), Criterios de Éxito (TDD / Acceptance Criteria), Fase 0: Preparación del Monorepo (Turborepo), Objetivo de la Fase

### Community 126 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas Unitarias de Criptografía (Pytest / Django Test), 2. Pruebas de Endpoint JWKS (JSON Web Key Set), 3. Pruebas de Blacklist (Logout), 4. Pruebas de Refresh Token Rotation, Criterios de Éxito (TDD / Acceptance Criteria), Fase 1: Identity Provider y Seguridad RS256 (aros-core), Objetivo de la Fase

### Community 127 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas Unitarias de Service-to-Service JWT (S2S JWT), 2. Pruebas de Resolución Cloud Map, 3. Pruebas de Resiliencia (Circuit Breaker y Timeouts), 4. Pruebas de Pre-signed URL Broker (S3), Criterios de Éxito (TDD / Acceptance Criteria), Fase 2: Federated Queries y S2S JWT (aros-core), Objetivo de la Fase

### Community 128 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas de Middleware Zero Trust (Validación S2S), 2. Pruebas de Interceptación de Webhooks (HMAC-SHA256), 3. Pruebas de Desidentificación y Generación de Pre-signed URLs, 4. Pruebas de Optimización Graviton (Benchmark), Criterios de Éxito (TDD / Acceptance Criteria), Fase 3: Clinic Internal API (Microservicio de Clínica), Objetivo de la Fase

### Community 129 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas de Ingesta DICOM (C-STORE), 2. Pruebas de Delegación a S3 (AwsS3Storage), 3. Pruebas del Evento OnStableStudy, 4. Pruebas de Optimización de Memoria (StorageCache), Criterios de Éxito (TDD / Acceptance Criteria), Fase 4: Configuración de Orthanc PACS y StorageCache, Objetivo de la Fase

### Community 130 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas de Renderizado y Componentes (Jest / React Testing Library), 2. Pruebas de Integración con el Identity Provider, 3. Pruebas de Streaming y Visualización con OHIF, 4. Pruebas de Diseño Responsivo y Accesibilidad, Criterios de Éxito (TDD / Acceptance Criteria), Fase 5: Portales Frontend (Next.js) e Integración OHIF, Objetivo de la Fase

### Community 131 - "Criterios de Éxito (TDD / Acceptance Criteria)"
Cohesion: 0.25
Nodes (7): 1. Pruebas Estáticas de Infraestructura (tfsec / tflint), 2. Pruebas de Aislamiento de Red (VPC Peering), 3. Pruebas de Reproducibilidad (Despliegue y Destrucción Cero Errores), 4. Pruebas de Costos (Infracost), Criterios de Éxito (TDD / Acceptance Criteria), Fase 6: Aprovisionamiento de Infraestructura (Terraform), Objetivo de la Fase

### Community 132 - "DESIGN.md"
Cohesion: 0.25
Nodes (7): Brand & Style, Colors, Components, Elevation & Depth, Layout & Spacing, Shapes, Typography

### Community 133 - "2. Core Business Workflows"
Cohesion: 0.29
Nodes (6): 1. Request Lifecycle Overview, 2. Core Business Workflows, A. Study Creation Flow (The Assistant & Integration Pipeline), AROS PACS - Architecture and Data Flow, B. Diagnostic Reporting Flow (The Doctor Pipeline), C. Patient & Associate Doctor Access

### Community 134 - "federated.py"
Cohesion: 0.29
Nodes (5): FederatedStudiesView, APIView, Query multiple clinics concurrently for a user's studies.     Returns aggregated, ConsentRecord, HIPAA Consent record for accessing clinical data.     Supports granting and revo

### Community 135 - "Actualización de Landing Page: Sección de Precios y Propuesta de Valor"
Cohesion: 0.33
Nodes (5): 1. Encabezado y Propuesta de Valor (Copywriting), 2. Tabla Comparativa de Planes de Precios, 3. Gráfica Interactiva de Ahorro (Componente React), Actualización de Landing Page: Sección de Precios y Propuesta de Valor, Instrucciones de uso para la Landing Page:

### Community 136 - "webhooks.py"
Cohesion: 0.33
Nodes (4): ClinicWebhookReceiver, APIView, # NOTE: In a real environment, the clinic would send a global unique identifier, Receives and validates HMAC signed webhooks from Clinics.

### Community 137 - "AROS PACS - Backend Structure"
Cohesion: 0.40
Nodes (4): 1. Overview, 2. Project Layout, 3. Infrastructure & Deployment, AROS PACS - Backend Structure

### Community 138 - "MAIN IDEA"
Cohesion: 0.40
Nodes (4): Current architecture, General idea of the project, MAIN IDEA, Use of open-source technologies

### Community 139 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 140 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 141 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 142 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **540 isolated node(s):** `Migration`, `Migration`, `Migration`, `name`, `private` (+535 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PatientProfile` connect `User` to `notifications.py`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `webhooks.py`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `ClinicRegistry` connect `User` to `webhooks.py`, `gateway/urls.py`, `federated.py`, `ClinicService`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `User` (e.g. with `PatientProfileAdmin` and `StaffProfileAdmin`) actually correct?**
  _`User` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `PatientProfile` (e.g. with `PatientProfileAdmin` and `StaffProfileAdmin`) actually correct?**
  _`PatientProfile` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Roles` (e.g. with `PatientProfileAdmin` and `StaffProfileAdmin`) actually correct?**
  _`Roles` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `ClinicRegistry` (e.g. with `ClinicRateView` and `ClinicsView`) actually correct?**
  _`ClinicRegistry` has 15 INFERRED edges - model-reasoned connections that need verification._