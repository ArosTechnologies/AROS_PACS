# Fase 2: Federated Queries y S2S JWT (aros-core)

## Objetivo de la Fase
Hacer que el `aros-core` funcione como un "API Gateway". Como no almacena datos de pacientes, cuando el frontend pide la lista de estudios de la clínica "San José", el Core debe generar un token temporal, inyectarlo en la petición y hacer un proxy reverso hacia el VPC Peering de la clínica.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas Unitarias de Service-to-Service JWT (S2S JWT)
- **Prueba:** Un request entrante de paciente busca ver su estudio. El Core crea un S2S JWT.
- **Éxito:** El token generado por el Core para hablar con la clínica contiene `iss: aros-core`, `aud: clinic-slug` y expiración muy corta (`exp: 30 segundos`).

### 2. Pruebas de Resolución Cloud Map
- **Prueba:** Enviar un *mock* de petición HTTP desde el Core hacia `http://clinic-sanjose.internal:8000/api/studies/`.
- **Éxito:** AWS Cloud Map debe resolver el DNS a la IP privada correcta de ECS dentro del VPC de la clínica. (En local se simula con un mock de httpx interceptando dominios `.internal`).

### 3. Pruebas de Resiliencia (Circuit Breaker y Timeouts)
- **Prueba:** Simular que la API interna de la clínica está caída o tarda más de 5 segundos en responder usando el cliente `httpx.AsyncClient`.
- **Éxito:** El Core API aborta la petición a los 3 segundos (Timeout) o entra en modo Circuit Breaker, regresando al frontend un HTTP 503 (Service Unavailable) estructurado sin bloquear la carga principal del sistema.

### 4. Pruebas de Pre-signed URL Broker (S3)
- **Prueba:** El Frontend pide ver un DICOM. El Core le pide a la Clínica que genere el enlace S3.
- **Éxito:** El Core regresa un payload JSON con un URL seguro de AWS S3 (`s3.amazonaws.com/...&X-Amz-Signature=...`) que es 100% resoluble desde el navegador sin pasar por el backend.
