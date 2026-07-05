# Fase 6: Aprovisionamiento de Infraestructura (Terraform)

## Objetivo de la Fase
Automatizar mediante Código (Infrastructure as Code - IaC) la creación de cuentas de clínicas en AWS Organizations. Terraform debe ser capaz de aprovisionar un VPC Peering, ECS Fargate ARM64, RDS Graviton, S3, KMS y Cloud Map en menos de 10 minutos con un solo comando.

## Criterios de Éxito (TDD / Acceptance Criteria)

### 1. Pruebas Estáticas de Infraestructura (tfsec / tflint)
- **Prueba:** Ejecutar `tfsec` sobre los módulos de Terraform de la clínica.
- **Éxito:** Pasa las pruebas de seguridad en la nube sin advertencias críticas: El bucket S3 debe forzar cifrado (AES256/KMS) y negar acceso público; la base de datos RDS debe estar en una subred privada y no ser públicamente accesible.

### 2. Pruebas de Aislamiento de Red (VPC Peering)
- **Prueba:** Después de hacer `terraform apply`, intentar hacer PING o CURL al ECS Orthanc de una clínica desde una máquina en Internet, y luego desde un servidor en la cuenta `aros-core`.
- **Éxito:** Internet debe recibir *Time Out* absoluto (bloqueado por Security Groups y VPC privada). El `aros-core` debe lograr conexión HTTP exitosa, probando que las tablas de ruteo del Peering funcionan.

### 3. Pruebas de Reproducibilidad (Despliegue y Destrucción Cero Errores)
- **Prueba:** Ejecutar `terraform apply -auto-approve` para crear una clínica de prueba (ej. `clinic-test-01`). Luego ejecutar `terraform destroy -auto-approve`.
- **Éxito:** La infraestructura se construye completamente funcional en AWS. La destrucción elimina todos los recursos excepto los retenidos por políticas de seguridad de datos legales (si aplica), probando que no hay dependencias circulares ni recursos "huérfanos".

### 4. Pruebas de Costos (Infracost)
- **Prueba:** Ejecutar la herramienta `infracost diff` en el Pipeline.
- **Éxito:** La herramienta de estimación arroja que la infraestructura creada ronda los ~$75 USD para una clínica pequeña, validando nuestro modelo de Pricing documentado.
