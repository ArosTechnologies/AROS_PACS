terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  portals = {
    patient   = "aros-pacs-dev-patient-portal"
    physician = "aros-pacs-dev-physician-portal"
    clinic    = "aros-pacs-dev-clinic-portal"
  }
}

# ------------------------------------------------------------------------------
# S3 Buckets
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "portals" {
  for_each = local.portals

  bucket = each.value
}

resource "aws_s3_bucket_public_access_block" "portals" {
  for_each = aws_s3_bucket.portals

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# Origin Access Control (OAC)
# ------------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "aros-pacs-oac"
  description                       = "OAC for AROS PACS SPAs"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ------------------------------------------------------------------------------
# S3 Bucket Policies for OAC
# ------------------------------------------------------------------------------
resource "aws_s3_bucket_policy" "portals" {
  for_each = aws_s3_bucket.portals

  bucket = each.value.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${each.value.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.portals[each.key].arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# CloudFront Distributions
# ------------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "portals" {
  for_each = aws_s3_bucket.portals

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  origin {
    domain_name              = each.value.bucket_regional_domain_name
    origin_id                = "S3-${each.value.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${each.value.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # SPA Routing (Redirect 404 to index.html)
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }
  
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
