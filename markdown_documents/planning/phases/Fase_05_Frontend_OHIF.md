# Fase 5: Portales Frontend (Next.js) e Integración OHIF

## Objetivo de la Fase
Construir los portales de usuario final (Pacientes, Doctores y Clínicas) usando React y Next.js. El frontend debe ser capaz de autenticarse con el `aros-core`, renderizar interfaces con un diseño "Pro Max", e incrustar el visor médico OHIF de forma segura sin revelar la arquitectura interna.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas de Renderizado y Componentes (Jest / React Testing Library)
- **Prueba:** Renderizar el componente `<PatientDashboard />` sin datos iniciales de la API.
- **Éxito:** El frontend muestra *Skeletons* de carga fluidos y elegantes sin romperse, demostrando tolerancia a la latencia de red.

### 2. Pruebas de Integración con el Identity Provider
- **Prueba:** Intentar acceder a rutas protegidas `/doctor/dashboard` sin token, y luego con token expirado.
- **Éxito:** Next.js Middleware redirige al login o intenta usar el Refresh Token con credenciales HTTP-Only (sin exponer nada a ataques XSS).

### 3. Pruebas de Streaming y Visualización con OHIF
- **Prueba:** Cargar la ruta dinámica `/viewer/[study-id]`. El frontend obtiene el *Pre-signed URL* de S3 del backend.
- **Éxito:** OHIF (incrustado vía iFrame o componente React) intercepta el URL, y carga las imágenes DICOM cuadro a cuadro (streaming multipart) a la máxima velocidad posible de la red, sin retrasos por procesamiento intermedio.

### 4. Pruebas de Diseño Responsivo y Accesibilidad
- **Prueba:** Auditar los portales con Lighthouse y simulación en dispositivos móviles.
- **Éxito:** Lighthouse arroja un score de >90 en Accesibilidad y Performance. El UI se adapta perfectamente a tablets (el iPad es crítico para los médicos radiólogos).
