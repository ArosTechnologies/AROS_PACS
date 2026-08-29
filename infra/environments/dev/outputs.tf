# ------------------------------------------------------------------------------
# CORE ACCOUNT OUTPUTS
# ------------------------------------------------------------------------------
output "core_api_alb_url" {
  description = "Public URL for AROS Core API"
  value       = "http://${module.ecs_core.alb_dns_name}"
}

output "core_db_endpoint" {
  description = "RDS PostgreSQL Endpoint for AROS Core"
  value       = module.rds_core.db_endpoint
}

output "core_db_name" {
  value = module.rds_core.db_name
}

output "core_redis_endpoint" {
  description = "Redis Endpoint for AROS Core"
  value       = module.redis_core.redis_endpoint
}

output "core_media_bucket" {
  description = "S3 Bucket for Media (Core)"
  value       = module.s3_media.bucket_name
}

output "core_ses_sender" {
  description = "SES Verified Sender Email"
  value       = module.ses_core.sender_email_arn
}

output "core_cloudfront_domains" {
  description = "CloudFront Domains for SPAs"
  value       = module.cdn_frontends.cloudfront_domains
}

# ------------------------------------------------------------------------------
# CLINIC ACCOUNT OUTPUTS
# ------------------------------------------------------------------------------
output "clinic_api_internal_alb_url" {
  description = "Internal URL for AROS Clinic API (Private ALB)"
  value       = "http://${module.ecs_clinic.alb_dns_name}"
}

output "clinic_db_endpoint" {
  description = "RDS PostgreSQL Endpoint for AROS Clinic"
  value       = module.rds_clinic.db_endpoint
}

output "clinic_db_name" {
  value = module.rds_clinic.db_name
}
