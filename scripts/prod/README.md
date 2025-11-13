# Production CLI Scripts

> Production-grade deployment and management scripts for Agentic SDLC

## Overview

These scripts are adapted from the development CLI for **production environments** with:
- Enhanced security (secrets management, validation)
- Deployment strategies (blue-green, rolling, canary)
- Monitoring and alerting integration
- Zero-downtime operations
- Rollback capabilities
- Health check validation gates

## Key Differences from Dev CLI

| Feature | Dev CLI | Prod CLI |
|---------|---------|----------|
| **Secrets** | Local .env | Vault/Secrets Manager |
| **Validation** | Basic health checks | Full validation gates |
| **Deployment** | docker-compose up | Orchestrated deployment |
| **Rollback** | Manual | Automatic on failure |
| **Monitoring** | Local logs | Centralized logging + metrics |
| **Alerts** | None | Slack/PagerDuty integration |
| **Safety** | Warnings | Confirmations + approvals |

## Production Scripts Structure

```
scripts/prod/
├── cli                          # Main production CLI
├── deploy/
│   ├── blue-green.sh           # Blue-green deployment
│   ├── rolling.sh              # Rolling deployment
│   ├── canary.sh               # Canary deployment
│   └── rollback.sh             # Automated rollback
├── health/
│   ├── preflight.sh            # Pre-deployment checks
│   ├── validation-gates.sh     # Validation gates
│   └── smoke-tests.sh          # Post-deployment smoke tests
├── monitoring/
│   ├── metrics.sh              # Export metrics
│   ├── alerts.sh               # Alert integration
│   └── logs.sh                 # Centralized logging
├── security/
│   ├── secrets.sh              # Secrets management
│   ├── scan.sh                 # Security scanning
│   └── compliance.sh           # Compliance checks
└── maintenance/
    ├── backup.sh               # Backup operations
    ├── restore.sh              # Restore operations
    └── drain.sh                # Graceful shutdown
```

## Quick Examples

### Deploy to Production
```bash
# Blue-green deployment (zero downtime)
prod deploy blue-green --validate --smoke-tests

# Rolling deployment (gradual rollout)
prod deploy rolling --batch-size 2 --health-checks

# Canary deployment (progressive traffic shift)
prod deploy canary --traffic-split 10,50,100
```

### Health & Validation
```bash
# Pre-deployment validation
prod preflight --environment production

# Run validation gates
prod validate --gates "security,performance,compliance"

# Smoke tests
prod smoke-test --critical-paths
```

### Monitoring
```bash
# Export metrics to Prometheus
prod metrics --export prometheus

# Check alerts
prod alerts --check

# Stream production logs
prod logs --service orchestrator --follow
```

### Rollback
```bash
# Automatic rollback on failure
prod rollback --to-version v1.2.3 --validate

# Manual rollback
prod rollback --immediate --skip-validation
```

## Implementation Status

| Script | Status | Notes |
|--------|--------|-------|
| blue-green.sh | ⏳ Template | Needs ECS/K8s integration |
| rolling.sh | ⏳ Template | Needs orchestration |
| canary.sh | ⏳ Template | Needs traffic routing |
| rollback.sh | ⏳ Template | Needs state management |
| preflight.sh | ✅ Ready | Adapted from health.sh |
| secrets.sh | ⏳ Template | Needs Vault integration |
| metrics.sh | ⏳ Template | Needs Prometheus setup |
| alerts.sh | ⏳ Template | Needs Slack/PagerDuty |

## Next Steps

See: `PRODUCTION_ADAPTATION_GUIDE.md` for detailed implementation guide.
