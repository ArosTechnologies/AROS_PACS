terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_kms_key" "aros_key" {
  description             = "AROS Master Key for encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

resource "aws_kms_alias" "aros_key_alias" {
  name          = "alias/aros-master-key"
  target_key_id = aws_kms_key.aros_key.key_id
}
