terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "kms_key_id" { type = string }
variable "db_endpoint" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" { type = string }

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "dev/aros-core/db-credentials"
  description = "Database credentials for AROS Core"
  kms_key_id  = var.kms_key_id
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = split(":", var.db_endpoint)[0]
    port     = split(":", var.db_endpoint)[1]
    dbname   = var.db_name
    username = var.db_username
    password = var.db_password
  })
}
