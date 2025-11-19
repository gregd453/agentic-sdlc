# ============================================================================
# Dashboard Container
# ============================================================================

# Note: Dashboard image is built externally (by start-infra.sh or watch-and-redeploy.sh)
# Terraform just manages the container lifecycle
#
# Built with:
#   - Production: Dockerfile.prod (multi-stage build with static assets)
#   - Development: Dockerfile (Vite dev server)

# Dashboard container
resource "docker_container" "dashboard" {
  count = var.dashboard_enabled ? 1 : 0
  name  = "${local.container_prefix}-dashboard"
  image = "agentic-sdlc-dashboard:${var.dashboard_image_tag}"

  # Network
  networks_advanced {
    name = docker_network.main.name
  }

  # Ports
  ports {
    internal = 3050
    external = var.dashboard_port
  }

  # Environment variables
  env = concat(
    local.common_env,
    [
      "NODE_ENV=development",
      "VITE_DASHBOARD_PORT=3050",
      "VITE_PROXY_TARGET=${var.dashboard_api_proxy}"
    ]
  )


  # Health check
  healthcheck {
    test         = ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3050/"]
    interval     = "30s"
    timeout      = "10s"
    retries      = 3
    start_period = "10s"
  }

  # Depends on other services
  depends_on = [
    docker_container.postgres,
    docker_container.redis
  ]

  # Restart policy
  restart = "unless-stopped"

  must_run   = true
  log_driver = var.enable_container_logs ? "json-file" : "none"
}

