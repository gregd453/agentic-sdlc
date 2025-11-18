# ============================================================================
# PostgreSQL Container
# ============================================================================

# Pull latest PostgreSQL image
resource "docker_image" "postgres" {
  count = var.postgres_enabled ? 1 : 0
  name  = var.postgres_image
}

# Create PostgreSQL volume
resource "docker_volume" "postgres" {
  count = var.postgres_enabled ? 1 : 0
  name  = "${local.container_prefix}-postgres-data"
}

# PostgreSQL container
resource "docker_container" "postgres" {
  count = var.postgres_enabled ? 1 : 0
  name  = "${local.container_prefix}-postgres"
  image = docker_image.postgres[0].image_id

  # Network
  networks_advanced {
    name = docker_network.main.name
  }

  # Ports
  ports {
    internal = 5432
    external = var.postgres_port
  }

  # Environment
  env = concat(
    local.common_env,
    [
      "POSTGRES_DB=${var.postgres_db_name}",
      "POSTGRES_USER=${var.postgres_user}",
      "POSTGRES_PASSWORD=${var.postgres_password}",
      "POSTGRES_INITDB_ARGS=-E UTF8 --locale=en_US.UTF-8"
    ]
  )

  # Volumes
  volumes {
    volume_name    = docker_volume.postgres[0].name
    container_path = "/var/lib/postgresql/data"
  }

  # Health check
  healthcheck {
    test         = ["CMD-SHELL", "pg_isready -U ${var.postgres_user} -d ${var.postgres_db_name}"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "10s"
  }

  # Restart policy
  restart = "unless-stopped"

  must_run   = true
  log_driver = var.enable_container_logs ? "json-file" : "none"
}

