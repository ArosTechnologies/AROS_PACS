# AROS Technologies — Modelo de Costos de Infraestructura y Pricing (Ultra-Optimizado)
## Versión 2.0 | Julio 2026 | CONFIDENCIAL

> **Región AWS:** us-east-1 (N. Virginia) | Precios vigentes Julio 2026
> **Arquitectura:** Ultra-optimizada (VPC Peering, S3 Pre-signed URLs, Cloud Map, Graviton ARM64)

---

## 1. Definición de Perfiles de Clínica

| | 🏥 Clínica Pequeña | 🏨 Clínica Mediana | 🏦 Clínica Grande |
|---|---|---|---|
| **Estudios/mes** | 150–220 → **185 ref.** | 500–1,500 → **900 ref.** | 2,000–5,000 → **3,000 ref.** |
| **Estudios/día promedio** | ~6/día | ~30/día | ~100/día |
| **Modalidades principales** | Rayos X (CR/DR) | Rayos X + TAC | TAC + RM + Mamografía |
| **Tamaño promedio/estudio** | 150 MB | 400 MB | 700 MB |
| **GB DICOM generados/mes** | 27.75 GB | 360 GB | 2,100 GB |

---

## 2. Infraestructura AWS por Clínica — Desglose Línea por Línea (Optimizada)

### 2.1 Cómputo — ECS Fargate (AWS Graviton ARM64)
*La arquitectura ARM64 ofrece ~20% de ahorro frente a x86 con mayor rendimiento.*

#### Orthanc PACS (ECS Fargate ARM64 — siempre activo)

| Especificación | Pequeña (0.5 vCPU, 1 GB) | Mediana (1.0 vCPU, 2 GB) | Grande (2.0 vCPU, 4 GB) |
|---|---|---|---|
| **Subtotal Orthanc** | **$14.22** | **$28.44** | **$56.87** |

#### Clinic Internal API (ECS Fargate ARM64 — siempre activo)

| Especificación | Pequeña (0.25 vCPU, 0.5 GB) | Mediana (0.5 vCPU, 1 GB) | Grande (1.0 vCPU, 2 GB) |
|---|---|---|---|
| **Subtotal Clinic API** | **$7.11** | **$14.22** | **$28.44** |

**Subtotal Cómputo:** $21.33 | $42.66 | $85.31

---

### 2.2 Base de Datos — Amazon RDS PostgreSQL 16 (AWS Graviton)

| Componente | Pequeña (`db.t4g.micro`) | Mediana (`db.t4g.small`) | Grande (`db.t4g.medium`) |
|---|---|---|---|
| Costo instancia/mes | $11.52 | $23.04 | $46.08 |
| Storage gp3 | 20 GB ($2.30) | 100 GB ($11.50) | 300 GB ($34.50) |
| I/O estimado | $1.00 | $3.00 | $5.00 |
| RDS Proxy (pool) | — | — | $21.60 |
| **SUBTOTAL RDS** | **$14.82** | **$37.54** | **$107.18** |

---

### 2.3 Red — VPC Peering, Cloud Map y NAT Gateway

*Nota: TGW y ALB interno han sido eliminados. Se usa VPC Peering para conectividad y AWS Cloud Map para Service Discovery DNS.*

| Componente | Pequeña | Mediana | Grande |
|---|---|---|---|
| AWS Cloud Map (Service Discovery) | $0.10 | $0.10 | $0.10 |
| VPC Peering (Datos JSON API) | ~1 GB = $0.01 | ~5 GB = $0.05 | ~20 GB = $0.20 |
| NAT Gateway (1 AZ, 1 AZ, 2 AZ) | $32.40 | $32.40 | $64.80 |
| NAT Gateway (Datos procesados) | $0.05 | $0.23 | $0.90 |
| **Subtotal Red** | **$32.56** | **$32.78** | **$66.00** |

---

### 2.4 Almacenamiento DICOM — Amazon S3 (Intelligent-Tiering)

*Nota: Con S3 Pre-signed URLs, el visor OHIF descarga las imágenes directamente desde S3 sin pasar por Fargate ni proxies de red, logrando 0 latencia de red intermedia.*

| Mes | **Pequeña (IT)** | **Mediana (IT)** | **Grande (IT)** | Ahorro vs Standard |
|---|---|---|---|---|
| Mes 1 | $0.64 | $8.28 | $48.30 | 0% |
| Mes 3 | $1.13 | $14.70 | $85.75 | ~40% |
| Mes 6 | $1.66 | $21.57 | $125.78 | ~57% |
| Mes 12 | $2.33 | $30.24 | $176.40 | ~70% |
| Mes 24 | $3.55 | $46.10 | $268.94 | ~77% |
| Mes 36 | $4.62 | $59.76 | $348.64 | ~80% |

#### Costos de requests S3

| Concepto | Pequeña | Mediana | Grande |
|---|---|---|---|
| PUT / GET requests | $0.02 | $0.10 | $0.75 |

---

### 2.5 Seguridad y Gestión

| Componente | Pequeña | Mediana | Grande |
|---|---|---|---|
| AWS Secrets Manager | $2.00 | $2.00 | $2.00 |
| AWS KMS | $2.00 | $2.00 | $2.00 |
| CloudWatch Logs | $1.58 | $3.98 | $10.07 |
| **Subtotal Seguridad** | **$5.58** | **$8.08** | **$14.07** |

---

## 3. Resumen de Costos Fijos por Clínica (Sin S3)

| Categoría | 🏥 Pequeña | 🏨 Mediana | 🏦 Grande |
|---|---|---|---|
| Cómputo (Fargate ARM64) | $21.33 | $42.66 | $85.31 |
| Base de Datos (RDS ARM64) | $14.82 | $37.54 | $107.18 |
| **Red (Peering + Cloud Map)** | **$32.56** | **$32.78** | **$66.00** |
| Seguridad y Gestión | $5.58 | $8.08 | $14.07 |
| **TOTAL INFRAESTRUCTURA FIJA** | **$74.29** | **$121.06** | **$272.56** |

> **Logro Arquitectónico:** El costo fijo de una clínica pequeña bajó de **$138.23 a $74.29 (-46%)** eliminando TGW y ALB, y migrando a procesadores Graviton.

---

## 4. Costo Total por Clínica — Fijo + S3 Intelligent-Tiering

| Mes | 🏥 Pequeña | 🏨 Mediana | 🏦 Grande |
|---|---|---|---|
| **Mes 1** | $74.29 + $0.64 = **$74.93** | $121.06 + $8.28 = **$129.34** | $272.56 + $48.30 = **$320.86** |
| **Mes 12** | $74.29 + $2.33 = **$76.62** | $121.06 + $30.24 = **$151.30** | $272.56 + $176.40 = **$448.96** |
| **Mes 24** | $74.29 + $3.55 = **$77.84** | $121.06 + $46.10 = **$167.16** | $272.56 + $268.94 = **$541.50** |
| **Mes 36** | $74.29 + $4.62 = **$78.91** | $121.06 + $59.76 = **$180.82** | $272.56 + $348.64 = **$621.20** |

---

## 5. Infraestructura AROS Core — Compartida y Prorrateada

| Componente | Especificación | USD/mes |
|---|---|---|
| ECS Fargate Core API (Graviton) | 2 tasks | $28.44 |
| ECS Fargate OHIF (Graviton) | 1 task | $14.22 |
| RDS Central `db.t4g.medium` | DB | $46.08 |
| RDS Storage + Proxy | | $27.35 |
| ElastiCache Redis `cache.t4g.small` | | $23.04 |
| ALBs, Amplify, Route53, Seguridad | | $70.10 |
| **TOTAL AROS CORE** | | **$209.23/mes** |

### Prorrateo por número de clínicas activas
- **10 clínicas activas** = **$20.92/clínica/mes**

---

## 6. Análisis Competitivo Definitivo — Modelo de Suscripción AROS

Se aplica un modelo de **Suscripción Fija AROS + Costo de Infra AWS propia**.

| Tipo Clínica | Pago AROS | Pago AWS (Mes 1) | **Costo Total Clínica** | Precio Competencia | Ahorro Cliente |
|---|---|---|---|---|---|
| 🏥 Pequeña (185 est) | $115.00 | $74.93 | **$189.93/mes** | $338.55/mes | **44% más barato** |
| 🏨 Mediana (900 est) | $250.00 | $129.34 | **$379.34/mes** | $1,647.00/mes | **77% más barato** |
| 🏦 Grande (3,000 est)| $600.00 | $320.86 | **$920.86/mes** | $5,490.00/mes | **83% más barato** |

> **Margen AROS (con 10 clínicas en red):**
> Para la clínica pequeña: AROS cobra $115. El costo prorrateado del Core es $20.92. **Utilidad Neta AROS = $94.08 por clínica (81% de margen bruto).**

---

## 7. Conclusiones Arquitectónicas

1. **VPC Peering vs TGW:** Reemplazar el TGW por VPC Peering es el hack de rentabilidad más grande para un SaaS B2B en AWS con topología Hub-and-Spoke.
2. **S3 Pre-signed URLs:** Eliminar el tráfico DICOM a través de proxies internos reduce la latencia a 0 saltos intermedios y corta los costos de Data Transfer.
3. **AWS Cloud Map:** Reemplazar el ALB interno de las clínicas ($21.96) usando Service Discovery privado y seguro por DNS.
4. **AWS Graviton (ARM64):** Reduce todos los costos de cómputo y base de datos en ~20% sin requerir refactorización de código.

---
*AROS Technologies | Pricing Model v2.0 Ultra-Optimized | Julio 2026 | CONFIDENCIAL*
