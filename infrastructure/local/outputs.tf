# ============================================================================
# Aggregate Outputs
# ============================================================================

output "network_id" {
  description = "Docker network ID"
  value       = docker_network.main.id
}

output "network_name" {
  description = "Docker network name"
  value       = docker_network.main.name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "services_status" {
  description = "Status of all services"
  value = {
    postgres  = var.postgres_enabled ? "enabled" : "disabled"
    redis     = var.redis_enabled ? "enabled" : "disabled"
    dashboard = var.dashboard_enabled ? "enabled" : "disabled"
  }
}

output "database_url" {
  description = "Full database URL for .env files"
  value       = try("postgresql://${var.postgres_user}:${var.postgres_password}@localhost:${var.postgres_port}/${var.postgres_db_name}", null)
  sensitive   = true
}

output "redis_url" {
  description = "Redis URL for .env files"
  value       = try("redis://localhost:${var.redis_port}", null)
}

output "access_info" {
  description = "How to access services"
  value = {
    dashboard  = try("http://localhost:${var.dashboard_port}", null)
    postgres   = try("psql -h localhost -p ${var.postgres_port} -U ${var.postgres_user} -d ${var.postgres_db_name}", null)
    redis      = try("redis-cli -p ${var.redis_port}", null)
    orchestrator = "http://localhost:3051 (PM2 - start with ./dev start)"
  }
}
