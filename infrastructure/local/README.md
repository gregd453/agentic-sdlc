# Agentic SDLC - Local Docker Infrastructure (Terraform)

Infrastructure-as-Code for managing local Docker development environment using Terraform.

## Overview

This Terraform configuration manages:
- **PostgreSQL 16** - Application database
- **Redis 7** - Cache/message broker
- **Dashboard** - React UI (Vite)
- **Docker Network** - Internal communication bridge

## Prerequisites

1. **Terraform** >= 1.0
   ```bash
   brew install terraform  # macOS
   ```

2. **Docker Desktop** running
   ```bash
   docker ps  # Verify Docker is accessible
   ```

3. **Terraform Docker Provider**
   - Automatically downloaded on `terraform init`

## Quick Start

### Initialize Terraform

```bash
cd infrastructure/local
terraform init
```

This downloads the required providers and prepares the working directory.

### Plan Infrastructure

```bash
terraform plan
```

Shows what will be created/modified without making changes.

### Apply Infrastructure

```bash
terraform apply
```

Builds and starts all Docker containers.

Type `yes` when prompted to confirm.

### Verify Status

```bash
docker ps  # See running containers
```

Expected output:
```
CONTAINER ID   IMAGE                          COMMAND                  PORTS                    NAMES
...            postgres:16-alpine             ...                      0.0.0.0:5433->5432/tcp  agentic-sdlc-dev-postgres
...            redis:7-alpine                 ...                      0.0.0.0:6380->6379/tcp  agentic-sdlc-dev-redis
...            agentic-sdlc-dashboard:latest  ...                      0.0.0.0:3050->3050/tcp  agentic-sdlc-dev-dashboard
```

### View Outputs

```bash
terraform output
```

Shows:
- Connection strings
- Container names and IDs
- Access information
- Service URLs

### Access Services

After `terraform apply`, services are available at:

**Dashboard UI:**
```bash
open http://localhost:3050
```

**PostgreSQL:**
```bash
psql -h localhost -p 5433 -U agentic -d agentic_sdlc
```

**Redis:**
```bash
redis-cli -p 6380
```

## Configuration

### Variables

Edit `terraform.tfvars` to customize:

```hcl
# Change PostgreSQL port
postgres_port = 5433

# Change Redis port
redis_port = 6380

# Change Dashboard port
dashboard_port = 3050

# Disable services
postgres_enabled = false  # Don't start PostgreSQL
```

### Environment Variables

All services respect `LOG_LEVEL`:
```hcl
log_level = "debug"  # or "info", "warn", "error"
```

## Managing Infrastructure

### Stop All Containers

```bash
terraform destroy
```

Stops and removes all containers and volumes.

Type `yes` to confirm.

### Restart Services

```bash
docker restart agentic-sdlc-dev-postgres
docker restart agentic-sdlc-dev-redis
docker restart agentic-sdlc-dev-dashboard
```

### View Logs

```bash
docker logs agentic-sdlc-dev-postgres
docker logs agentic-sdlc-dev-redis
docker logs agentic-sdlc-dev-dashboard
```

### Access Database

```bash
# Connect with psql
psql -h localhost -p 5433 -U agentic -d agentic_sdlc

# Or use connection string from terraform output
export DATABASE_URL=$(terraform output -raw database_url)
psql $DATABASE_URL
```

## File Structure

```
infrastructure/local/
├── versions.tf          # Terraform and provider versions
├── main.tf              # Docker network and locals
├── variables.tf         # Input variable definitions
├── postgres.tf          # PostgreSQL container
├── redis.tf             # Redis container
├── dashboard.tf         # Dashboard container
├── outputs.tf           # Output definitions
├── terraform.tfvars     # Local development values
├── .gitignore          # Exclude state files
└── README.md           # This file
```

## State Management

### Local State (Development)

By default, state is stored locally:
```
terraform.tfstate
terraform.tfstate.backup
```

These files are:
- ✅ Git-ignored (added to .gitignore)
- ⚠️ Not shared between developers
- ⚠️ Not backed up

### Remote State (Future - AWS)

To use remote state later:

```bash
# Configure remote backend
terraform init -backend-config="bucket=my-terraform-state" ...
```

See `STRATEGIC-ARCHITECTURE.md` for cloud migration guide.

## Environment Variables

Export for use in .env files:

```bash
# Get all connection strings
terraform output -json

# Export PostgreSQL URL
export DATABASE_URL=$(terraform output -raw database_url)

# Export Redis URL  
export REDIS_URL=$(terraform output -raw redis_url)
```

## Troubleshooting

### Docker daemon not accessible

```
Error: Could not connect to Docker daemon at unix:///var/run/docker.sock
```

**Solution:** Start Docker Desktop or check Docker installation.

### Port already in use

```
Error: Port 5433 already in use
```

**Solution:** Change port in `terraform.tfvars`:
```hcl
postgres_port = 5434  # Use different port
```

### Container fails to start

```bash
# Check container logs
docker logs agentic-sdlc-dev-postgres

# Inspect container status
docker ps -a

# Remove stuck container and retry
docker rm agentic-sdlc-dev-postgres
terraform apply
```

### Terraform state conflict

```bash
# Refresh state from actual Docker containers
terraform refresh

# Reapply if needed
terraform apply -auto-approve
```

## Migration to AWS

This local Terraform setup prepares for AWS migration:

1. **Same configuration** works for AWS with provider changes
2. **No docker-compose** - pure IaC approach
3. **RDS for Postgres** - minimal changes needed
4. **ElastiCache for Redis** - minimal changes needed

See `STRATEGIC-ARCHITECTURE.md` for migration guide.

## Best Practices

1. **Always plan before applying**
   ```bash
   terraform plan  # Review changes
   terraform apply  # Apply only after review
   ```

2. **Keep terraform.tfvars out of git**
   - Already in .gitignore
   - Contains sensitive credentials

3. **Use terraform.tfvars.example for documentation**
   ```bash
   cp terraform.tfvars terraform.tfvars.example
   # Remove sensitive values before committing
   ```

4. **Version control Terraform files**
   - ✅ versions.tf
   - ✅ variables.tf
   - ✅ outputs.tf
   - ✅ postgres.tf, redis.tf, dashboard.tf
   - ❌ terraform.tfstate (git-ignored)
   - ❌ .terraform/ (git-ignored)

## Support

For issues, see:
- `PORT_CONFIGURATION.md` - Port mappings
- `AGENTIC_SDLC_RUNBOOK.md` - Operational guide
- `STRATEGIC-ARCHITECTURE.md` - Architecture overview
