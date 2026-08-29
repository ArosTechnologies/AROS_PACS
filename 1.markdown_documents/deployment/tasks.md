# Tareas de Despliegue - AWS Terraform (Modo Dev)

## Fase 1: Foundation y Multi-Cuenta (AWS Organizations)
- [ ] Validar credenciales de AWS (`aws sts get-caller-identity`).
- [ ] Habilitar/Validar AWS Organizations en la cuenta principal.
- [ ] Estructurar carpetas de Terraform (`infra/environments/dev/`, `infra/modules/`).
- [ ] Crear código Terraform para la cuenta AROS (Management) y la cuenta Clínica (Member).
- [x] Crear cuenta miembro en AWS Organizations para la Clínica (Email: `ivanvivasgar+clinic@gmail.com`)
- [x] Desplegar VPC de la Clínica X (`10.1.0.0/16`) (Pendiente de activación por parte de AWS)
- [x] Configurar VPC Peering entre AROS Core y Clínica X.
- [ ] Configurar VPC Peering inter-cuenta y tablas de ruteo.

## Fase 2: Almacenamiento y Base de Datos (Dev)
- [x] Crear módulo RDS (PostgreSQL) para AROS Core.
- [x] Crear módulo ElastiCache (Redis) para AROS Core.
- [x] Crear módulo S3 (Media DICOM) para AROS Core.
- [x] Crear módulo RDS (PostgreSQL) para AROS Clinic.
- [x] Instanciar módulos en `main.tf`.
- [x] Desplegar con `terraform apply`.

## Fase 3: Seguridad Base (WAF, Secrets & KMS)
- [x] Crear módulo KMS para AROS Core.
- [x] Crear módulo Secrets Manager para AROS Core (Almacenar credenciales RDS Core).
- [x] Crear módulo WAF para AROS Core.
- [x] Crear módulo Secrets Manager para AROS Clinic (Almacenar credenciales RDS Clinic).
- [x] Instanciar módulos en `main.tf`.
- [x] Desplegar con `terraform apply`.

## Fase 4: Servicios Base (Correo)
- `[x]` Crear módulo SES para AROS Core.
- `[x]` Configurar identidad de correo remitente (`ivivas@arostech.com`).
- `[x]` Instanciar módulo en `main.tf`.
- `[x]` Desplegar con `terraform apply`.

## Fase 5: ECS y Load Balancers
- `[x]` Crear módulo ECS Core (ALB Público, Cluster, core-api y sync_pacs) para AROS.
- `[x]` Crear módulo ECS Clinic (ALB Privado, Cluster, clinic-api) para Clínica.
- `[x]` Crear módulo Orthanc (ECS Service) para Clínica.
- `[x]` Instanciar módulos en `main.tf`.
- `[x]` Desplegar con `terraform apply`.

## Fase 6: CDN y Frontends
- `[x]` Crear módulo CDN Frontends en AROS Core.
- `[x]` Crear 3 Buckets S3 privados para portales (Patient, Physician, Clinic).
- `[x]` Crear Origin Access Control (OAC) y S3 Bucket Policies.
- `[x]` Crear 3 Distribuciones de CloudFront.
- `[x]` Instanciar módulo en `main.tf`.
- `[x]` Desplegar con `terraform apply`.

## Fase 7: Parametrización
- `[x]` Inyectar IPs internas y URLs públicas generadas a las variables de entorno de los contenedores y frontends.
- `[x]` Integración inicial (CI/CD) - OPCIONAL para setup inicial, o puede ser manual subiendo contenedores al ECR.
