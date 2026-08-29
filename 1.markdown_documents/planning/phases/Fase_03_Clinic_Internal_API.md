# Fase 3: Clinic Internal API (Microservicio de Clínica)

## Objetivo de la Fase
Desarrollar el backend aislado que correrá en cada clínica. Este backend gestiona los pacientes físicos (PHI), genera estudios en su RDS local, y actúa de puente de seguridad entre el AROS Core y el servidor Orthanc PACS.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas de Middleware Zero Trust (Validación S2S)
- **Prueba:** Enviar una petición a la Clinic API sin token, con un JWT de usuario normal, y con un S2S JWT válido del Core.
- **Éxito:** Las dos primeras fallan con HTTP 403 (Forbidden). Solo la petición firmada por la llave pública del Core con la audiencia (`aud`) apuntando a esta clínica específica es aceptada. Esto asegura que nadie (ni otra clínica) puede acceder a la red.

### 2. Pruebas de Interceptación de Webhooks (HMAC-SHA256)
- **Prueba:** Simular un Webhook desde Orthanc informando que llegó una nueva imagen DICOM (OnStableStudy). El payload se envía con un hash HMAC falso, y luego con uno real.
- **Éxito:** El endpoint `/api/orthanc-webhook/` descarta silenciosamente el hash falso, pero acepta el real, comprobando que solo el Orthanc local puede disparar sincronizaciones, evitando inyecciones de red.

### 3. Pruebas de Desidentificación y Generación de Pre-signed URLs
- **Prueba:** La Clinic API recibe orden de exponer un archivo DICOM almacenado en su bucket S3.
- **Éxito:** Se ejecuta el SDK `boto3.generate_presigned_url`. Se verifica matemáticamente que el URL generado expirará exactamente en N minutos y está encriptado con los permisos KMS correspondientes.

### 4. Pruebas de Optimización Graviton (Benchmark)
- **Prueba:** Correr pruebas de carga simulada (Locust/JMeter) sobre las lecturas a la base de datos local usando la imagen base ARM64 de Docker.
- **Éxito:** La serialización de JSON con Django responde de manera asíncrona a 0 latencia dentro de la topología local (RDS Postgres en la misma Subnet privada).
