output "cloudfront_domains" {
  value = {
    for k, v in aws_cloudfront_distribution.portals : k => v.domain_name
  }
}
