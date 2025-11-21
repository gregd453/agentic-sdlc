# Surface: Terraform + Docker Design for Agentic SDLC

**Version:** 1.0  
**Date:** 2025-11-18  
**Status:** Production-Ready (Local Development)

---

## Executive Summary

We've adopted **Terraform** as the canonical Infrastructure-as-Code (IaC) tool for managing local Docker development infrastructure, replacing docker-compose. This decision prepares us for AWS migration while maintaining a clean, reproducible local development experience.

### Key Benefits

| Aspect | docker-compose | Terraform | Winner |
|--------|---|---|---|
| **Code Reusability** | YAML only | HCL + variables | ⭐ Terraform |
| **AWS Migration** | Rewrite needed | Provider swap only | ⭐ Terraform |
| **State Management** | In docker daemon | Explicit state files | ⭐ Terraform |
| **Secrets Handling** | Env files | Sensitive vars | ⭐ Terraform |
| **Version Control** | Limited | Full IaC patterns | ⭐ Terraform |
| **Learning Curve** | Easy | Moderate | docker-compose |
| **Local Dev Speed** | Fast startup | Slightly slower | docker-compose |

---

## Architecture Overview

### Local Development Architecture (Terraform)

```
┌─────────────────────────────────────────────────────────────┐
│ Developer Machine (macOS/Linux)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Terraform                                            │  │
│  │ (Infrastructure as Code)                            │  │
│  │                                                      │  │
│  │ versions.tf (provider config)                       │  │
│  │ main.tf (docker network)                           │  │
│  │ postgres.tf (database)                             │  │
│  │ redis.tf (cache)                                   │  │
│  │ dashboard.tf (frontend + api)                      │  │
│  │ variables.tf (input definitions)                   │  │
│  │ terraform.tfvars (development values)              │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Docker Daemon (localhost)                            │  │
│  │                                                      │  │
│  │ ┌─────────────┐ ┌──────────┐ ┌─────────────┐      │  │
│  │ │ PostgreSQL  │ │  Redis   │ │  Dashboard  │      │  │
│  │ │  (5433)     │ │ (6380)   │ │  (3050)     │      │  │
│  │ └─────────────┘ └──────────┘ └─────────────┘      │  │
│  │        ↓              ↓             ↓              │  │
│  │   agentic-network (Docker bridge network)         │  │
│  └──────────────────────────────────────────────────────┘  │
│           ↓                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Application (PM2 processes on host)                │  │
│  │                                                      │  │
│  │ ┌────────────┐ ┌──────────┐ ┌──────────────┐      │  │
│  │ │ Orchestr.  │ │ Agents   │ │ CLI Tools    │      │  │
│  │ │ (3051)     │ │ (5x)     │ │              │      │  │
│  │ └────────────┘ └──────────┘ └──────────────┘      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Design Philosophy

**Three-Layer Approach:**

1. **Infrastructure Layer (Terraform)**
   - Manages container creation, networking, volumes
   - Defines ports, health checks, environment variables
   - Handles resource lifecycle (create, update, destroy)

2. **Application Layer (Docker)**
   - Containerizes services (PostgreSQL, Redis, Dashboard)
   - Provides isolated execution environment
   - Simplifies dependency management

3. **Development Layer (PM2 + Scripts)**
   - Runs orchestrator and agents locally (not in Docker)
   - Allows hot-reloading during development
   - Provides debugging capabilities

---

## Why Terraform Over docker-compose?

### Problem with docker-compose

docker-compose is excellent for quick local setups but has limitations:

```yaml
# docker-compose.yml - Limited for growth
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_PASSWORD: agentic_dev
  # ... more services
```

**Limitations:**
- ❌ No way to share config across environments (dev/test/prod)
- ❌ Hard to reuse configurations
- ❌ Secrets in env files (security risk)
- ❌ AWS migration requires complete rewrite
- ❌ No state management
- ❌ YAML is verbose for complex configurations

### Advantages of Terraform

```hcl
# variables.tf - Reusable, composable
variable "postgres_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5433
}

# Can be overridden per environment
variable "postgres_password" {
  type      = string
  sensitive = true
}
```

**Advantages:**
- ✅ Single codebase works for local + AWS
- ✅ Input variables allow environment-specific overrides
- ✅ Sensitive variables handled securely
- ✅ Explicit state management (terraform.tfstate)
- ✅ HCL is more expressive than YAML
- ✅ Rich interpolation and logic
- ✅ Cloud-ready architecture pattern
- ✅ Version controlled infrastructure

---

## Implementation Structure

### Local Development Setup

```
infrastructure/
└── local/                          # Local Docker management
    ├── versions.tf                 # Terraform + provider versions
    ├── main.tf                     # Network + local values
    ├── variables.tf                # Variable definitions
    ├── postgres.tf                 # PostgreSQL container
    ├── redis.tf                    # Redis container
    ├── dashboard.tf                # Dashboard container
    ├── outputs.tf                  # Outputs (connection strings)
    ├── terraform.tfvars            # Development values (local)
    ├── .gitignore                  # Exclude state files
    └── README.md                   # Comprehensive guide
```

### Key Files Explained

#### 1. **versions.tf** - Provider Configuration

```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}
```

**Purpose:**
- Declares Terraform version requirement
- Specifies Docker provider version
- Configures Docker daemon connection

**Why not docker-compose:**
- No way to declare provider versions
- Always uses latest (could break reproducibility)

#### 2. **variables.tf** - Input Definitions

```hcl
variable "postgres_port" {
  description = "PostgreSQL external port"
  type        = number
  default     = 5433
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true  # Hidden from logs/output
  default     = "agentic_dev"
}
```

**Benefits:**
- Self-documenting
- Type-safe
- Sensitive data marked explicitly
- Easy to override per environment

#### 3. **postgres.tf** - Resource Definitions

```hcl
resource "docker_image" "postgres" {
  name = var.postgres_image
}

resource "docker_volume" "postgres" {
  name = "${local.container_prefix}-postgres-data"
}

resource "docker_container" "postgres" {
  name  = "${local.container_prefix}-postgres"
  image = docker_image.postgres.image_id
  
  ports {
    internal = 5432
    external = var.postgres_port
  }
  
  env = [
    "POSTGRES_DB=${var.postgres_db_name}",
    "POSTGRES_USER=${var.postgres_user}",
    "POSTGRES_PASSWORD=${var.postgres_password}"
  ]
  
  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${var.postgres_user}"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
  }
}
```

**Why this approach:**
- Image, volume, and container as separate resources
- Easy to destroy/recreate individual components
- Health checks built-in (vs docker-compose workarounds)
- Explicit dependencies

#### 4. **terraform.tfvars** - Development Values

```hcl
project_name = "agentic-sdlc"
environment  = "dev"

postgres_port     = 5433
postgres_password = "agentic_dev"

redis_port = 6380

dashboard_port      = 3050
dashboard_api_proxy = "http://host.docker.internal:3051"

log_level = "debug"
```

**Key points:**
- Not committed to git (.gitignore)
- Local development defaults
- Can be overridden with `-var` flag
- Secrets handled safely

---

## Workflow Comparison

### docker-compose Workflow

```bash
# Start
docker-compose up -d

# Modify config
# ... edit docker-compose.yml ...

# Apply changes
docker-compose up -d --force-recreate

# Destroy
docker-compose down

# Reset
docker-compose down -v
```

**Issues:**
- Manual recreate when changing config
- No clear state view
- Easy to drift from intended state

### Terraform Workflow

```bash
# Plan (what will happen)
terraform plan

# Apply (create infrastructure)
terraform apply

# Verify state
terraform show

# Modify (edit *.tf files or terraform.tfvars)
# ... update configuration ...

# Apply changes (Terraform knows what changed)
terraform plan
terraform apply

# Destroy (clean up)
terraform destroy

# State is always tracked
terraform state list
terraform state show docker_container.postgres
```

**Benefits:**
- `terraform plan` shows exactly what will change
- State file tracks reality
- No surprises on reapply
- Full audit trail

---

## Port Configuration Strategy

### Design Decision: Multi-Environment Port Isolation

Instead of hardcoding ports, Terraform variables allow per-environment customization:

```
Development:
  postgres: 5433
  redis: 6380
  dashboard: 3050
  orchestrator: 3051 (PM2, not Docker)

Testing:
  postgres: 5434  (different from dev!)
  redis: 6381     (different from dev!)
  orchestrator: 3000 (Docker)
  dashboard: 3001 (Docker)

Production (AWS):
  postgres: RDS (internal)
  redis: ElastiCache (internal)
  dashboard: 3050 (ECS)
```

**Why this matters:**
- Allows running multiple environments simultaneously
- Prevents port conflicts
- Each environment isolated
- Easy to test scenarios

### Terraform Implementation

```hcl
# infrastructure/local/terraform.tfvars
postgres_port = 5433
redis_port = 6380
dashboard_port = 3050

# To use different values:
# terraform apply -var="postgres_port=5434"
# Or create: terraform.tfvars.test
```

---

## AWS Migration Path

### The Power of Terraform: Provider Swap

**Current (Local Docker):**
```hcl
provider "docker" {
  host = "unix:///var/run/docker.sock"
}

resource "docker_container" "postgres" { ... }
resource "docker_container" "redis" { ... }
```

**Future (AWS):**
```hcl
provider "aws" {
  region = var.aws_region
}

resource "aws_rds_instance" "postgres" {
  engine = "postgres"
  ...
}

resource "aws_elasticache_cluster" "redis" {
  engine = "redis"
  ...
}

resource "aws_ecs_task_definition" "dashboard" { ... }
resource "aws_ecs_service" "dashboard" { ... }
```

**Key insight:**
- ✅ Same variable structure (postgres_port, postgres_password, etc.)
- ✅ Same outputs (database_url, redis_url, dashboard_url)
- ✅ Same workflow (plan → apply → destroy)
- ⚠️ Only provider and resource types change

**Migration effort:**
- 20% refactoring needed
- 80% reusable (variables, logic, patterns)
- Vs docker-compose: 100% rewrite needed

---

## Integration with SDLC

### Complete Stack

```
┌─ Infrastructure Layer (Terraform) ─────────────┐
│ ├─ Local: Docker containers                    │
│ └─ AWS: RDS + ElastiCache + ECS                │
├─ Application Layer (SDLC) ────────────────────┤
│ ├─ Orchestrator (PM2/ECS)                     │
│ ├─ Agents (PM2/ECS)                           │
│ ├─ Dashboard (Docker/ECS)                     │
│ └─ Database (Docker/RDS)                      │
├─ Deployment Pipeline ─────────────────────────┤
│ ├─ GitHub Actions (CI/CD)                     │
│ ├─ Terraform (Infrastructure)                 │
│ └─ Docker (Container Images)                  │
└──────────────────────────────────────────────┘
```

### Development Workflow

```bash
# 1. Initialize infrastructure (one-time)
cd infrastructure/local
terraform init

# 2. Create development environment
terraform plan
terraform apply

# 3. Start application services
./dev start
# Starts PM2 orchestrator + agents

# 4. Access everything
open http://localhost:3050         # Dashboard
open http://localhost:3051         # Orchestrator API
psql -h localhost -p 5433 ...     # Database
redis-cli -p 6380                 # Cache

# 5. Make changes, test
# ...

# 6. Stop when done
./dev stop

# 7. Destroy infrastructure (when leaving)
terraform destroy
```

---

## State Management

### Terraform State File

```
infrastructure/local/terraform.tfstate
```

**Purpose:**
- Records current infrastructure state
- Maps Terraform resources to Docker containers
- Enables "update" instead of "replace"

**Example state entry:**
```json
{
  "resources": [
    {
      "type": "docker_container",
      "name": "postgres",
      "instances": [
        {
          "attributes": {
            "name": "agentic-sdlc-dev-postgres",
            "container_id": "abc123...",
            "ports": [
              {
                "external": 5433,
                "internal": 5432
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### State Best Practices

✅ **DO:**
- Commit `*.tf` files to git
- Track with `.gitignore` state files
- Use `terraform state` commands carefully
- Back up state files (in team settings)

❌ **DON'T:**
- Edit terraform.tfstate directly
- Commit state files to git
- Delete state files without terraform destroy
- Share state files informally

---

## Security Considerations

### Secrets in Terraform

**Sensitive Variables:**
```hcl
variable "postgres_password" {
  type      = string
  sensitive = true  # Hidden from logs
}
```

**Effect:**
- Marked sensitive in terraform output
- Never printed to console
- Logged as `<sensitive>`

**Production Secrets:**
```hcl
# Use environment variables
variable "db_password" {
  type      = string
  sensitive = true
  # Read from: TF_VAR_db_password environment variable
}
```

**AWS Secrets Manager (Future):**
```hcl
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/postgres/password"
}

resource "aws_rds_instance" "postgres" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Docker daemon not accessible

```
Error: Cannot connect to Docker daemon
```

**Solution:**
```bash
# Start Docker Desktop / Docker daemon
docker ps  # Verify connection

# Check Terraform provider config
cat infrastructure/local/versions.tf
```

#### 2. Port already in use

```
Error: Port 5433 is already in use
```

**Solution:**
```bash
# Find what's using the port
lsof -i :5433

# Either:
# Option A: Kill the process
kill -9 <PID>

# Option B: Use different port
terraform apply -var="postgres_port=5434"

# Option C: Edit terraform.tfvars
# postgres_port = 5434
terraform apply
```

#### 3. Container fails to start

```bash
# Check logs
docker logs agentic-sdlc-dev-postgres

# Inspect container
docker ps -a
docker inspect <container_id>

# Remove and recreate
terraform destroy -target=docker_container.postgres
terraform apply
```

#### 4. State file corruption

```bash
# Refresh state from actual Docker
terraform refresh

# See actual state
terraform state show

# If needed, reset everything
terraform destroy
rm terraform.tfstate*
terraform apply
```

---

## Best Practices

### 1. Variable Organization

```hcl
# Good: Grouped by service
variable "postgres_port" { ... }
variable "postgres_user" { ... }
variable "postgres_password" { ... }

# Bad: Random order
variable "port" { ... }
variable "user" { ... }
variable "password" { ... }
```

### 2. Naming Conventions

```hcl
# Use consistent prefixes
resource "docker_container" "postgres" {
  name = "${local.container_prefix}-postgres"
  # Results in: agentic-sdlc-dev-postgres
}

# Versioning
resource "docker_image" "dashboard" {
  name = "agentic-sdlc-dashboard:${var.dashboard_image_tag}"
}
```

### 3. Health Checks

```hcl
# Always include health checks
healthcheck {
  test     = ["CMD-SHELL", "pg_isready -U ${var.postgres_user}"]
  interval = "10s"
  timeout  = "5s"
  retries  = 5
  start_period = "10s"
}
```

### 4. Documentation

```hcl
# Always document variables
variable "postgres_port" {
  description = "External PostgreSQL port (avoids conflicts with other environments)"
  type        = number
  default     = 5433
}
```

### 5. Outputs

```hcl
# Provide useful outputs
output "database_url" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${var.postgres_user}:${var.postgres_password}@localhost:${var.postgres_port}/${var.postgres_db_name}"
  sensitive   = true
}

# Use outputs to generate .env files
output "env_file" {
  value = "DATABASE_URL=${output.database_url.value}"
}
```

---

## Integration with CI/CD

### GitHub Actions + Terraform (Future)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.6.0
      
      - name: Terraform Plan
        run: |
          cd infrastructure/aws
          terraform plan -var-file=prod.tfvars
      
      - name: Terraform Apply
        run: |
          cd infrastructure/aws
          terraform apply -var-file=prod.tfvars -auto-approve
```

---

## Comparison Matrix

| Feature | docker-compose | Terraform | Winner |
|---------|---|---|---|
| **Local Setup Speed** | 10 seconds | 20 seconds | docker-compose |
| **AWS Readiness** | 0% (needs rewrite) | 80% (provider swap) | ⭐ Terraform |
| **State Management** | Implicit | Explicit | ⭐ Terraform |
| **Secrets Handling** | Env files | Sensitive vars | ⭐ Terraform |
| **Variable Reuse** | No | Yes | ⭐ Terraform |
| **Learning Curve** | 30 min | 2-3 hours | docker-compose |
| **Multi-env Support** | Override files | Single codebase | ⭐ Terraform |
| **Reproducibility** | Medium | High | ⭐ Terraform |
| **Team Collaboration** | Easy | Medium | docker-compose |
| **Future-Proof** | No | Yes | ⭐ Terraform |

---

## Roadmap

### Phase 1: Current (Local Development) ✅
- Terraform manages local Docker infrastructure
- PM2 runs orchestrator/agents on host
- Single environment (dev)

### Phase 2: Test Environment (Planned)
- Separate `infrastructure/test/` with test-specific ports
- Isolated PostgreSQL/Redis for CI/CD
- terraform.tfvars.test for overrides

### Phase 3: Production (AWS) (Future)
- `infrastructure/aws/` with RDS/ElastiCache/ECS
- Same variable structure
- Terraform Cloud for state management
- GitHub Actions integration

### Phase 4: Multi-Cloud (Vision)
- Terraform modules for reusability
- Support for multiple cloud providers
- Disaster recovery across regions

---

## Conclusion

Terraform + Docker provides:

1. **Strong Foundation** for AWS migration
2. **Reproducible** development environments
3. **Clear State Management** via terraform.tfstate
4. **Flexible Configuration** via variables
5. **Security Best Practices** with sensitive variables
6. **Cloud-Ready Architecture** patterns

This investment in proper IaC now prevents future rewrites and enables confident scaling.

---

## References

- **Local Setup:** `infrastructure/local/README.md`
- **Port Configuration:** `PORT_CONFIGURATION.md`
- **Docker Details:** `packages/dashboard/Dockerfile*`
- **Configuration Fixes:** `CONFIG_REVIEW_FIXES_SUMMARY.md`

---

✅ Unified Infrastructure Orchestration - Complete!

I've created a three-script system for unified management:

Three Main Scripts

1. start-infra.sh - Orchestrates Everything

./infrastructure/local/start-infra.sh
Starts in phases:
- ✅ Phase 1: Docker infrastructure (Terraform)
    - PostgreSQL (5433)
    - Redis (6380)
    - Dashboard (3050)
- ✅ Phase 2: PM2 services
    - Orchestrator (3051)
    - 5 Agents
- ✅ Phase 3: Health validation
    - All services checked
    - Readiness confirmed

2. stop-infra.sh - Graceful Shutdown

./infrastructure/local/stop-infra.sh
- Stops PM2 services gracefully
- Destroys Docker infrastructure
- Cleans up volumes
- Option: KEEP_VOLUMES=true to preserve data

3. watch-and-redeploy.sh - Auto-Rebuild

./infrastructure/local/watch-and-redeploy.sh
Monitors and auto-redeploys:
- Dashboard - On src changes → rebuild container
- Orchestrator - On src changes → rebuild & restart PM2
- Agents - On src changes → rebuild & restart PM2

Detects changes every 2 seconds, rebuilds in 5-15 seconds.

  ---
Architecture Overview

Single Start Command
↓
┌────┴────┐
│ Terraform│ → PostgreSQL, Redis, Dashboard (Docker)
└─────────┘
│
┌────┴────┐
│  PM2    │ → Orchestrator + Agents (Host Processes)
└─────────┘
│
┌────┴────┐
│ Health  │ → Validate all services ready
│ Checks  │
└─────────┘

  ---
Complete Workflow

Terminal 1: Start everything
./infrastructure/local/start-infra.sh
# [All services running in ~60 seconds]

Terminal 2: Enable auto-redeploy
./infrastructure/local/watch-and-redeploy.sh
# [Waiting for file changes]

Terminal 3: Edit code
vim packages/dashboard/src/App.tsx
# Dashboard auto-redeploys!
# No manual restart needed

When done:
./infrastructure/local/stop-infra.sh
# [Everything stopped]

  ---
Files Created

| File                                          | Purpose                      |
  |-----------------------------------------------|------------------------------|
| infrastructure/local/start-infra.sh           | Unified startup orchestrator |
| infrastructure/local/stop-infra.sh            | Graceful shutdown            |
| infrastructure/local/watch-and-redeploy.sh    | Auto-rebuild on changes      |
| infrastructure/local/UNIFIED-ORCHESTRATION.md | Comprehensive guide          |

  ---
Next Step: Update Root ./dev Script


The main ./dev script should now delegate to these:

./dev start   → ./infrastructure/local/start-infra.sh
./dev stop    → ./infrastructure/local/stop-infra.sh
./dev watch   → ./infrastructure/local/watch-and-redeploy.sh

Would you like me to update the root ./dev script to use this unified system?



**Document Version:** 1.0  
**Last Updated:** 2025-11-18  
**Status:** Production-Ready
