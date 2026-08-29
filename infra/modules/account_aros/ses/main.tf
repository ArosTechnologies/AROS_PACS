terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "sender_email" { type = string }

resource "aws_ses_email_identity" "sender" {
  email = var.sender_email
}
