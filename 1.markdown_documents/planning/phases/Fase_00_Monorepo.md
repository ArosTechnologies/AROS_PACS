# Fase 0: Preparación del Monorepo (Turborepo)

## Objetivo de la Fase
Migrar la estructura actual fragmentada hacia un Monorepo manejado por Turborepo y pnpm. Esto centralizará los *packages* compartidos (como configuraciones de ESLint, Prettier, dependencias de React y tipos de TypeScript) y las *apps* (backend y frontend).

## Criterios de Éxito (TDD / Acceptance Criteria)
Para que esta fase se considere 100% exitosa, el sistema debe pasar las siguientes pruebas automatizadas y manuales:

### 1. Pruebas de Estructura (Linting & Formatting)
- **Prueba:** Ejecutar `pnpm lint` en la raíz del proyecto.
- **Éxito:** Turborepo debe ejecutar el linter en caché para todas las aplicaciones (`aros-core`, `clinic-api`, `frontend`) sin arrojar errores. Se valida que el paquete compartido `@repo/eslint-config` se inyecta correctamente.

### 2. Pruebas de Tipado Transversal
- **Prueba:** Ejecutar `pnpm typecheck`.
- **Éxito:** Cero errores de TypeScript en todos los sub-proyectos, validando que `@repo/typescript-config` está funcionando como *Base TSConfig*.

### 3. Pruebas de Orquestación de Turborepo (Pipeline)
- **Prueba:** Ejecutar `pnpm build`. Modificar un archivo en el frontend y volver a ejecutar `pnpm build`.
- **Éxito:** La primera compilación toma tiempo (100% execution). La segunda compilación debe arrojar `FULL TURBO` en los servicios no modificados (backend) y solo recompilar el frontend, comprobando que el Remote Caching funciona.

### 4. Pruebas de Integración Continua (Docker Build)
- **Prueba:** Ejecutar `docker build` en la raíz usando `turbo prune`.
- **Éxito:** Docker genera una imagen aislada solo con las dependencias necesarias de un proyecto específico (ej. `aros-core`), reduciendo drásticamente el peso de la imagen final.
