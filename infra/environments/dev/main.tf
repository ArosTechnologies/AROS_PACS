terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "aws" {
  region = "us-east-1"
  alias  = "aros_core"
}

# 1. AWS Organization (Creada manualmente en la consola)
# No es necesario gestionarla con Terraform en este punto.

# 2. Member Account para Clínica X
resource "aws_organizations_account" "clinic" {
  name  = "AROS Clinic"
  email = "ivanvivasgar+clinic@gmail.com"
  
  role_name  = "OrganizationAccountAccessRole"
}

# 3. Provider for the Clinic Account
provider "aws" {
  alias  = "clinic"
  region = "us-east-1"
  assume_role {
    role_arn = "arn:aws:iam::${aws_organizations_account.clinic.id}:role/OrganizationAccountAccessRole"
  }
}

# 4. Networking Core (AROS)
module "networking_core" {
  source = "../../modules/account_aros/networking"
  
  providers = {
    aws = aws.aros_core
  }
  
  vpc_cidr = "10.0.0.0/16"
}

# 5. Networking Clinic
module "networking_clinic" {
  source = "../../modules/account_clinic/networking"
  
  providers = {
    aws = aws.clinic
  }
  
  vpc_cidr = "10.1.0.0/16"
  depends_on = [aws_organizations_account.clinic]
}

# 6. VPC Peering
module "vpc_peering" {
  source = "../../modules/peering"
  
  providers = {
    aws.aros_core = aws.aros_core
    aws.clinic    = aws.clinic
  }
  
  core_vpc_id         = module.networking_core.vpc_id
  core_route_table_ids = module.networking_core.route_table_ids
  
  clinic_vpc_id         = module.networking_clinic.vpc_id
  clinic_route_table_ids = module.networking_clinic.route_table_ids
  clinic_account_id     = aws_organizations_account.clinic.id
  
  core_cidr   = "10.0.0.0/16"
  clinic_cidr = "10.1.0.0/16"
}

# ---------------------------------------------------------
# PHASE 2: Almacenamiento y Base de Datos (Dev)
# ---------------------------------------------------------

# 7. RDS PostgreSQL (AROS Core)
module "rds_core" {
  source = "../../modules/account_aros/rds_core"
  
  providers = {
    aws = aws.aros_core
  }

  vpc_id             = module.networking_core.vpc_id
  private_subnet_ids = module.networking_core.private_subnet_ids
}

# 8. ElastiCache Redis (AROS Core)
module "redis_core" {
  source = "../../modules/account_aros/redis_core"
  
  providers = {
    aws = aws.aros_core
  }

  vpc_id             = module.networking_core.vpc_id
  private_subnet_ids = module.networking_core.private_subnet_ids
}

# 9. S3 Media (AROS Core)
module "s3_media" {
  source = "../../modules/account_aros/s3_media"
  
  providers = {
    aws = aws.aros_core
  }
}

# 10. RDS PostgreSQL (AROS Clinic)
module "rds_clinic" {
  source = "../../modules/account_clinic/rds_clinic"
  
  providers = {
    aws = aws.clinic
  }

  vpc_id             = module.networking_clinic.vpc_id
  private_subnet_ids = module.networking_clinic.private_subnet_ids
}

# ---------------------------------------------------------
# PHASE 3: Seguridad Base (WAF, Secrets & KMS)
# ---------------------------------------------------------

# 11. KMS (AROS Core)
module "kms_core" {
  source = "../../modules/account_aros/kms"
  
  providers = {
    aws = aws.aros_core
  }
}

# 12. Secrets Manager (AROS Core)
module "secrets_core" {
  source = "../../modules/account_aros/secrets"
  
  providers = {
    aws = aws.aros_core
  }

  kms_key_id  = module.kms_core.key_id
  db_endpoint = module.rds_core.db_endpoint
  db_name     = module.rds_core.db_name
  db_username = module.rds_core.db_username
  db_password = module.rds_core.db_password
}

# 13. WAF (AROS Core)
module "waf_core" {
  source = "../../modules/account_aros/waf"
  
  providers = {
    aws = aws.aros_core
  }
}

# 14. Secrets Manager (AROS Clinic)
module "secrets_clinic" {
  source = "../../modules/account_clinic/secrets"
  
  providers = {
    aws = aws.clinic
  }

  db_endpoint = module.rds_clinic.db_endpoint
  db_name     = module.rds_clinic.db_name
  db_username = module.rds_clinic.db_username
  db_password = module.rds_clinic.db_password
}

# ---------------------------------------------------------
# PHASE 4: Servicios Base (Correo)
# ---------------------------------------------------------

# 15. Amazon SES (AROS Core)
module "ses_core" {
  source = "../../modules/account_aros/ses"
  
  providers = {
    aws = aws.aros_core
  }

  sender_email = "ivivas@arostech.com.mx"
}

# ---------------------------------------------------------
# PHASE 5: ECS y Load Balancers
# ---------------------------------------------------------

# 16. ECS Core (AROS Core)
module "ecs_core" {
  source = "../../modules/account_aros/ecs_core"
  
  providers = {
    aws = aws.aros_core
  }

  vpc_id             = module.networking_core.vpc_id
  public_subnet_ids  = module.networking_core.public_subnet_ids
  private_subnet_ids = module.networking_core.private_subnet_ids
  waf_arn            = module.waf_core.waf_arn
}

# 17. ECS Clinic (AROS Clinic)
module "ecs_clinic" {
  source = "../../modules/account_clinic/ecs_clinic"
  
  providers = {
    aws = aws.clinic
  }

  vpc_id             = module.networking_clinic.vpc_id
  private_subnet_ids = module.networking_clinic.private_subnet_ids
}

# ---------------------------------------------------------
# PHASE 6: CDN y Frontends
# ---------------------------------------------------------

# 18. CDN y Frontends S3 (AROS Core)
module "cdn_frontends" {
  source = "../../modules/account_aros/cdn_frontends"
  
  providers = {
    aws = aws.aros_core
  }
}
