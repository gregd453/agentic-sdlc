# ============================================================================
# Agentic SDLC - Local Docker Infrastructure
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "agentic-sdlc"
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
  default     = "dev"
}

variable "network_name" {
  description = "Docker network name"
  type        = string
  default     = "agentic-network"
}

# ============================================================================
# PostgreSQL Configuration
# ============================================================================

variable "postgres_enabled" {
  description = "Enable PostgreSQL container"
  type        = bool
  default     = true
}

variable "postgres_image" {
  description = "PostgreSQL Docker image"
  type        = string
  default     = "postgres:16-alpine"
}

variable "postgres_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5433
}

variable "postgres_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "agentic_sdlc"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "agentic"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
  default     = "agentic_dev"
}

variable "postgres_volume_size" {
  description = "PostgreSQL volume size (GB)"
  type        = number
  default     = 10
}

# ============================================================================
# Redis Configuration
# ============================================================================

variable "redis_enabled" {
  description = "Enable Redis container"
  type        = bool
  default     = true
}

variable "redis_image" {
  description = "Redis Docker image"
  type        = string
  default     = "redis:7-alpine"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6380
}

variable "redis_max_memory" {
  description = "Redis max memory (MB)"
  type        = number
  default     = 256
}

# ============================================================================
# Dashboard Configuration
# ============================================================================

variable "dashboard_enabled" {
  description = "Enable Dashboard container"
  type        = bool
  default     = true
}

variable "dashboard_image_tag" {
  description = "Dashboard Docker image tag"
  type        = string
  default     = "latest"
}

variable "dashboard_port" {
  description = "Dashboard port"
  type        = number
  default     = 3050
}

variable "dashboard_api_proxy" {
  description = "Dashboard API proxy target (for local dev, points to PM2 orchestrator)"
  type        = string
  default     = "http://host.docker.internal:3051"
}

# ============================================================================
# Logging Configuration
# ============================================================================

variable "log_level" {
  description = "Log level for services"
  type        = string
  default     = "debug"
  
  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "log_level must be one of: debug, info, warn, error"
  }
}

variable "enable_container_logs" {
  description = "Enable container logging"
  type        = bool
  default     = true
}

variable "force_rebuild" {
  description = "Force rebuild of Docker images (set to true to trigger rebuild)"
  type        = bool
  default     = false
}
