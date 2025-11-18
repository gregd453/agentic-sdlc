# ============================================================================
# Redis Container
# ============================================================================

# Pull latest Redis image
resource "docker_image" "redis" {
  count = var.redis_enabled ? 1 : 0
  name  = var.redis_image
}

# Create Redis volume
resource "docker_volume" "redis" {
  count = var.redis_enabled ? 1 : 0
  name  = "${local.container_prefix}-redis-data"
}

# Redis container
resource "docker_container" "redis" {
  count = var.redis_enabled ? 1 : 0
  name  = "${local.container_prefix}-redis"
  image = docker_image.redis[0].image_id

  # Network
  networks_advanced {
    name = docker_network.main.name
  }

  # Ports
  ports {
    internal = 6379
    external = var.redis_port
  }

  # Redis command with AOF persistence
  command = [
    "redis-server",
    "--appendonly",
    "yes",
    "--maxmemory",
    "${var.redis_max_memory}mb",
    "--maxmemory-policy",
    "allkeys-lru"
  ]

  # Volumes
  volumes {
    volume_name    = docker_volume.redis[0].name
    container_path = "/data"
  }

  # Health check
  healthcheck {
    test         = ["CMD", "redis-cli", "ping"]
    interval     = "10s"
    timeout      = "5s"
    retries      = 5
    start_period = "10s"
  }

  # Restart policy
  restart = "unless-stopped"

  # Environment
  env = local.common_env

  must_run   = true
  log_driver = var.enable_container_logs ? "json-file" : "none"
}

