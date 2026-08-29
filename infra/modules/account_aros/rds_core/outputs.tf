output "db_endpoint" {
  value = aws_db_instance.core_db.endpoint
}

output "db_name" {
  value = aws_db_instance.core_db.db_name
}

output "db_username" {
  value = aws_db_instance.core_db.username
}

output "db_password" {
  value     = random_password.db_password.result
  sensitive = true
}
