output "key_id" {
  value = aws_kms_key.aros_key.key_id
}

output "key_arn" {
  value = aws_kms_key.aros_key.arn
}
