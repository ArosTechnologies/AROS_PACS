# Fase 1: Identity Provider y Seguridad RS256 (aros-core)

## Objetivo de la Fase
Implementar el motor de autenticación central (Identity Provider) en `aros-core`. Toda la criptografía del sistema usará RS256 (Llaves asimétricas Público/Privada). Aquí se manejan los inicios de sesión de Doctores, Pacientes y Administradores, y se generan los tokens JWT globales.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas Unitarias de Criptografía (Pytest / Django Test)
- **Prueba:** Generar un token de sesión (Access Token) pasando credenciales válidas y validarlo con la llave pública.
- **Éxito:** El algoritmo RS256 de `PyJWT` firma correctamente el token. El header del JWT debe contener `"alg": "RS256"` y `"kid"` (Key ID).
- **Prueba Negativa:** Intentar firmar un token con una llave alterada o HS256.
- **Éxito:** El validador rechaza estrictamente el token con error `InvalidSignatureError`.

### 2. Pruebas de Endpoint JWKS (JSON Web Key Set)
- **Prueba:** Realizar petición HTTP GET a `api.arospacs.com/.well-known/jwks.json`.
- **Éxito:** El endpoint retorna HTTP 200 con un arreglo de llaves públicas con formato JWK estándar. Ninguna llave privada debe filtrarse en la respuesta.

### 3. Pruebas de Blacklist (Logout)
- **Prueba:** El usuario hace logout y su Access Token se añade a Redis (Blacklist). Segundos después, se intenta usar el mismo Access Token para ver un perfil.
- **Éxito:** El middleware rechaza la petición con HTTP 401 (Unauthorized), verificando que Redis bloquea tokens efímeros comprometidos de forma instantánea.

### 4. Pruebas de Refresh Token Rotation
- **Prueba:** Se intenta usar un Refresh Token para generar un nuevo Access Token por segunda vez (Re-uso de token).
- **Éxito:** El sistema detecta el robo de sesión, invalida la familia completa de tokens de ese usuario en Redis y obliga al usuario a iniciar sesión nuevamente (HTTP 401).
