terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }

resource "aws_security_group" "rds" {
  name        = "aros-clinic-rds-sg"
  description = "Security group for AROS Clinic RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    # Allow from within the Clinic VPC (ECS tasks)
    cidr_blocks = ["10.1.0.0/16"] 
  }
  
  # Allow from Core VPC (if core needs to sync directly, though usually clinic pushes via API)
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "aros-clinic-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "AROS-Clinic-RDS-Subnets"
  }
}

resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_instance" "clinic_db" {
  identifier           = "aros-clinic-db"
  allocated_storage    = 20
  storage_type         = "gp3"
  engine               = "postgres"
  engine_version       = "15" # Orthanc recommended DB
  instance_class       = "db.t3.micro"
  username             = "postgres"
  password             = random_password.db_password.result
  
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true
  publicly_accessible = false
}
