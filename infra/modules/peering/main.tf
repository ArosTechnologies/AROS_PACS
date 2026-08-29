terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      configuration_aliases = [aws.aros_core, aws.clinic]
    }
  }
}

variable "core_vpc_id" { type = string }
variable "clinic_vpc_id" { type = string }
variable "core_route_table_ids" { type = list(string) }
variable "clinic_route_table_ids" { type = list(string) }
variable "core_cidr" { type = string }
variable "clinic_cidr" { type = string }
variable "clinic_account_id" { type = string }

# Requester's VPC Peering Connection
resource "aws_vpc_peering_connection" "core_to_clinic" {
  provider    = aws.aros_core
  vpc_id      = var.core_vpc_id
  peer_vpc_id = var.clinic_vpc_id
  peer_owner_id = var.clinic_account_id
  
  # Auto accept requires both VPCs to be in the same account unless the accepter side is configured
  # Since they are in different accounts within the same organization, we need to explicitly accept it
  auto_accept = false

  tags = {
    Name = "Peering-Core-to-Clinic"
  }
}

# Accepter's VPC Peering Connection Accepter
resource "aws_vpc_peering_connection_accepter" "clinic_accept" {
  provider                  = aws.clinic
  vpc_peering_connection_id = aws_vpc_peering_connection.core_to_clinic.id
  auto_accept               = true

  tags = {
    Name = "Peering-Clinic-Accept"
  }
}

# Routes in Core Route Tables pointing to Clinic CIDR
resource "aws_route" "core_to_clinic" {
  provider                  = aws.aros_core
  count                     = length(var.core_route_table_ids)
  route_table_id            = var.core_route_table_ids[count.index]
  destination_cidr_block    = var.clinic_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.core_to_clinic.id
}

# Routes in Clinic Route Tables pointing to Core CIDR
resource "aws_route" "clinic_to_core" {
  provider                  = aws.clinic
  count                     = length(var.clinic_route_table_ids)
  route_table_id            = var.clinic_route_table_ids[count.index]
  destination_cidr_block    = var.core_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.core_to_clinic.id
}
