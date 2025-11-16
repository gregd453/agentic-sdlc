# API Documentation Guide

Complete reference for the Agentic SDLC REST API endpoints.

## Quick Start

### Access Swagger UI

```
http://localhost:3000/docs
```

The Swagger UI provides:
- 📋 Interactive API documentation
- 🧪 Try-it-out testing in browser
- 📥 JSON schema definitions
- 💾 Request/response examples

## Core Endpoints

### Workflows API

#### Create Workflow
```http
POST /api/v1/workflows
Content-Type: application/json

{
  "name": "Build Feature",
  "type": "feature",
  "priority": "high",
  "platform_id": "web-apps",
  "description": "Build new login feature"
}
```

**Response (201 Created):**
```json
{
  "id": "workflow-123",
  "name": "Build Feature",
  "type": "feature",
  "stage": "scaffold:started",
  "progress": 0,
  "platform_id": "web-apps",
  "trace_id": "trace-abc123",
  "created_at": "2025-11-16T22:00:00Z",
  "updated_at": "2025-11-16T22:00:00Z"
}
```

#### List Workflows
```http
GET /api/v1/workflows?type=feature&limit=10&offset=0
```

**Query Parameters:**
- `type` - Filter by workflow type (app, feature, bugfix)
- `platform_id` - Filter by platform
- `status` - Filter by stage
- `limit` - Results per page (default: 10, max: 100)
- `offset` - Pagination offset (default: 0)

#### Get Workflow Details
```http
GET /api/v1/workflows/{workflow-id}
```

**Response:**
```json
{
  "id": "workflow-123",
  "name": "Build Feature",
  "type": "feature",
  "stage": "validation:completed",
  "progress": 25,
  "platform_id": "web-apps",
  "trace_id": "trace-abc123",
  "metadata": {
    "branch": "feature/login",
    "author": "john@example.com"
  },
  "created_at": "2025-11-16T22:00:00Z",
  "updated_at": "2025-11-16T22:15:00Z"
}
```

### Platforms API

#### List All Platforms
```http
GET /api/v1/platforms
```

**Response:**
```json
[
  {
    "id": "platform-123",
    "name": "web-apps",
    "layer": "APPLICATION",
    "description": "Single-page applications",
    "enabled": true,
    "config": {
      "defaultTimeout": 3600,
      "retryPolicy": "exponential"
    }
  }
]
```

#### Get Platform Details
```http
GET /api/v1/platforms/{platform-id}
```

**Response:**
```json
{
  "id": "platform-123",
  "name": "web-apps",
  "layer": "APPLICATION",
  "description": "Single-page applications",
  "enabled": true,
  "surfaces": [
    {
      "type": "REST",
      "enabled": true,
      "config": { "basePath": "/api/v1/web-apps" }
    }
  ],
  "config": { ... }
}
```

#### Get Platform Analytics
```http
GET /api/v1/platforms/{platform-id}/analytics?period=24h
```

**Query Parameters:**
- `period` - Time period: 1h, 24h, 7d, 30d (default: 24h)

**Response:**
```json
{
  "platform_id": "platform-123",
  "platform_name": "web-apps",
  "period": "24h",
  "total_workflows": 45,
  "successful_workflows": 43,
  "failed_workflows": 2,
  "success_rate": 95.6,
  "average_duration_seconds": 1800,
  "timeseries": [
    {
      "timestamp": "2025-11-16T20:00:00Z",
      "workflow_count": 10,
      "success_count": 9,
      "error_count": 1
    }
  ]
}
```

### Traces API

#### Get Trace Details
```http
GET /api/v1/traces/{trace-id}
```

**Response:**
```json
{
  "trace_id": "trace-abc123",
  "root_span_id": "span-001",
  "workflow_id": "workflow-123",
  "start_time": "2025-11-16T22:00:00Z",
  "end_time": "2025-11-16T22:30:00Z",
  "duration_ms": 1800000,
  "status": "completed",
  "spans": [
    {
      "span_id": "span-001",
      "trace_id": "trace-abc123",
      "parent_span_id": null,
      "operation": "scaffold:started",
      "start_time": "2025-11-16T22:00:00Z",
      "end_time": "2025-11-16T22:10:00Z",
      "status": "completed"
    }
  ]
}
```

#### Get Trace Spans
```http
GET /api/v1/traces/{trace-id}/spans
```

#### Get Workflows by Trace
```http
GET /api/v1/traces/{trace-id}/workflows
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of error",
  "statusCode": 400,
  "message": "Detailed error message",
  "timestamp": "2025-11-16T22:00:00Z"
}
```

### Common Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input (missing required fields)
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Example Error Response

```json
{
  "error": "Validation failed",
  "statusCode": 400,
  "message": "Workflow name is required",
  "timestamp": "2025-11-16T22:00:00Z"
}
```

## Workflow Types and Stages

### Workflow Types

| Type | Description | Typical Stages |
|------|-------------|-----------------|
| `app` | Application development | scaffold, validation, e2e, integration, deployment (5-8 stages) |
| `feature` | Feature development | scaffold, validation, e2e, integration, deployment (5 stages) |
| `bugfix` | Bug fix | scaffold, validation, deployment (3 stages) |

### Platform Layers

| Layer | Description | Examples |
|-------|-------------|----------|
| `APPLICATION` | Web/mobile apps | Web Apps, Mobile Apps |
| `DATA` | Data processing | Data Pipelines, ETL |
| `INFRASTRUCTURE` | Infrastructure | Kubernetes, Cloud deployment |
| `ENTERPRISE` | Enterprise systems | ERP, CRM workflows |

## Common Requests

### Create Feature Workflow on Web Apps Platform

```bash
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Feature: Dark Mode",
    "type": "feature",
    "platform_id": "web-apps",
    "priority": "medium",
    "metadata": {
      "branch": "feature/dark-mode",
      "author": "jane@example.com"
    }
  }'
```

### Monitor Workflow Progress

```bash
# Get workflow details
curl http://localhost:3000/api/v1/workflows/{workflow-id}

# Check every 30 seconds until complete
while true; do
  curl -s http://localhost:3000/api/v1/workflows/{workflow-id} | jq '.progress, .stage'
  sleep 30
done
```

### Get Platform Statistics

```bash
# Get analytics for last 24 hours
curl "http://localhost:3000/api/v1/platforms/{platform-id}/analytics?period=24h"

# Get analytics for last 7 days
curl "http://localhost:3000/api/v1/platforms/{platform-id}/analytics?period=7d"
```

### Filter Workflows by Type

```bash
# Get all feature workflows
curl "http://localhost:3000/api/v1/workflows?type=feature"

# Get all workflows on a specific platform
curl "http://localhost:3000/api/v1/workflows?platform_id=web-apps"

# Combine filters
curl "http://localhost:3000/api/v1/workflows?type=app&platform_id=web-apps&limit=50"
```

## Pagination

All list endpoints support pagination:

```bash
# First page (default)
curl "http://localhost:3000/api/v1/workflows"

# Second page (10 items per page)
curl "http://localhost:3000/api/v1/workflows?limit=10&offset=10"

# Third page (50 items per page)
curl "http://localhost:3000/api/v1/workflows?limit=50&offset=100"
```

## Batch Operations

### Create Multiple Workflows

```bash
curl -X POST http://localhost:3000/api/v1/workflows/batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "Feature 1",
      "type": "feature",
      "platform_id": "web-apps"
    },
    {
      "name": "Feature 2",
      "type": "feature",
      "platform_id": "web-apps"
    }
  ]'
```

## Authentication

Currently, the API is open (no authentication). For production deployments, add:

```bash
# Add API key authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/workflows
```

## Rate Limiting

Current limits (subject to change):
- **Workflows API:** 1000 requests/hour per IP
- **Platforms API:** 10000 requests/hour per IP
- **Traces API:** 5000 requests/hour per IP

## SDK / Client Libraries

### JavaScript/TypeScript

```typescript
import { WorkflowClient } from '@agentic-sdlc/client'

const client = new WorkflowClient('http://localhost:3000')

// Create workflow
const workflow = await client.workflows.create({
  name: 'My Workflow',
  type: 'feature',
  platformId: 'web-apps'
})

// Get workflow
const details = await client.workflows.get(workflow.id)

// List workflows
const workflows = await client.workflows.list({ type: 'feature' })

// Get analytics
const analytics = await client.platforms.getAnalytics('web-apps', { period: '24h' })
```

### Python

```python
from agentic_sdlc import WorkflowClient

client = WorkflowClient('http://localhost:3000')

# Create workflow
workflow = client.workflows.create(
    name='My Workflow',
    type='feature',
    platform_id='web-apps'
)

# Get workflow
details = client.workflows.get(workflow.id)

# List workflows
workflows = client.workflows.list(type='feature')

# Get analytics
analytics = client.platforms.get_analytics('web-apps', period='24h')
```

## API Status & Health

### Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-16T22:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "agents": "5/5 running"
  }
}
```

## Webhooks & Callbacks

Register a webhook to be notified of workflow events:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook",
    "events": ["workflow:completed", "workflow:failed"],
    "secret": "your-secret-key"
  }'
```

Webhook events:
- `workflow:created` - Workflow created
- `workflow:progressed` - Stage completed
- `workflow:completed` - Workflow finished successfully
- `workflow:failed` - Workflow failed

## API Versioning

Current API version: **v1**

```
/api/v1/workflows    → Version 1 endpoints
/api/v2/workflows    → (Future) Version 2 endpoints
```

Backward compatibility is guaranteed within v1.

## OpenAPI / Swagger Schema

Get the complete OpenAPI schema:

```bash
curl http://localhost:3000/openapi.json
```

Use with tools like:
- **Swagger UI:** http://localhost:3000/docs
- **ReDoc:** http://localhost:3000/redoc
- **Postman:** Import from /openapi.json

## Support

- **Issues?** Check [AGENTIC_SDLC_RUNBOOK.md](../AGENTIC_SDLC_RUNBOOK.md)
- **Questions?** See [CLAUDE.md](../CLAUDE.md)
- **Examples?** Check [PLATFORM_ONBOARDING.md](./PLATFORM_ONBOARDING.md)

## References

- [Platform Onboarding Guide](./PLATFORM_ONBOARDING.md)
- [Architecture Migration Guide](./ARCHITECTURE_MIGRATION.md)
- [Strategic Architecture](../STRATEGIC-ARCHITECTURE.md)
- [System Runbook](../AGENTIC_SDLC_RUNBOOK.md)

---

**Last Updated:** 2025-11-16 | **API Version:** 1.0 | **Status:** Production Ready
