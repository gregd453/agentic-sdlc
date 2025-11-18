# ============================================================================
# Docker Network
# ============================================================================

resource "docker_network" "main" {
  name   = var.network_name
  driver = "bridge"
}

# ============================================================================
# Local Values
# ============================================================================

locals {
  container_prefix = "${var.project_name}-${var.environment}"
  
  common_labels = {
    environment = var.environment
    project     = var.project_name
    managed_by  = "terraform"
  }

  common_env = [
    "LOG_LEVEL=${var.log_level}"
  ]
}
