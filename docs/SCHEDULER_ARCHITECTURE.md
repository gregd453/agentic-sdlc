# Scheduler Component Architecture
## Time-Based & Event-Based Job Scheduling for Agentic SDLC Platform

**Version:** 1.0.0
**Status:** Design Document
**Created:** 2025-11-22
**Platform:** Agentic SDLC (Session #89+)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Integration Overview](#integration-overview)
3. [Architecture Design](#architecture-design)
4. [Database Schema](#database-schema)
5. [Service Layer](#service-layer)
6. [API Routes](#api-routes)
7. [Message Bus Integration](#message-bus-integration)
8. [Handler System](#handler-system)
9. [Monitoring & Observability](#monitoring--observability)
10. [Implementation Plan](#implementation-plan)
11. [Use Cases](#use-cases)

---

## Executive Summary

### Purpose

The Scheduler component extends the Agentic SDLC platform with reliable, scalable job scheduling capabilities for executing tasks at specific times, on recurring schedules, or triggered by system events.

### Key Capabilities

**Time-Based Scheduling:**
- Cron-based recurring jobs (e.g., "every 6 hours", "daily at 2 AM")
- One-time future execution (e.g., "send reminder in 24 hours")
- Recurring with limits (e.g., "3x daily for 30 days")
- Timezone-aware scheduling

**Event-Based Scheduling:**
- React to system events (workflow:completed, ticket:created, etc.)
- Chain jobs based on completion
- Conditional execution based on context

**Platform Integration:**
- Seamless integration with existing hexagonal architecture
- Platform-scoped job isolation using existing tenant model
- Redis Streams for reliable job queue management
- Prisma-based persistence with existing PostgreSQL database
- Message bus integration for event-driven triggers

### Design Principles

1. **Hexagonal Architecture Compliance** - Follows existing ports/adapters pattern
2. **Platform-Aware** - Jobs scoped to platforms for multi-tenancy
3. **Zero Schema Duplication** - Uses shared types from @agentic-sdlc/shared-types
4. **Message Bus First** - Redis Streams for durability and ACK-based reliability
5. **Observability** - Full integration with existing monitoring system
6. **Type Safety** - Leverages Zod schemas for validation

---

## Integration Overview

### Existing Platform Components

The Scheduler integrates with these platform components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agentic SDLC Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Orchestrator│  │   Platform   │  │    Agent     │        │
│  │   Service    │  │   Registry   │  │   Registry   │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                │
│                           │                                     │
│                  ┌────────▼────────┐                          │
│                  │   SCHEDULER     │ ◄─── NEW COMPONENT       │
│                  │   SERVICE       │                           │
│                  └────────┬────────┘                          │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                │
│         │                 │                 │                 │
│    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐          │
│    │ Redis   │     │ PostgreSQL│    │  Message  │          │
│    │ Streams │     │  (Prisma) │    │    Bus    │          │
│    └─────────┘     └───────────┘    └───────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

| Component | Integration | Purpose |
|-----------|------------|---------|
| **PostgreSQL** | Prisma ORM | Job metadata, execution history, event handlers |
| **Redis Streams** | Message Bus Adapter | Job queue, execution dispatch, ACK-based reliability |
| **Message Bus** | Pub/Sub | Event triggers, workflow events, notifications |
| **Platform Registry** | Service Dependency | Platform-scoped job isolation |
| **Agent Registry** | Service Dependency | Dispatch jobs to agents as handlers |
| **Monitoring System** | Alert Integration | Health checks, execution metrics, failure alerts |
| **Fastify API** | REST Routes | Job CRUD, execution history, metrics |

---

## Architecture Design

### Hexagonal Pattern

Following the existing orchestrator hexagonal architecture:

```
packages/orchestrator/src/
├── hexagonal/
│   ├── ports/
│   │   └── scheduler.port.ts          # IScheduler interface
│   ├── adapters/
│   │   ├── scheduler.adapter.ts       # Scheduler implementation
│   │   └── job-executor.adapter.ts    # Job execution engine
│   └── core/
│       └── scheduler-schemas.ts       # Zod validation schemas
├── services/
│   ├── scheduler.service.ts           # Hexagonal orchestration layer
│   ├── job-handler-registry.service.ts # Handler registration
│   └── job-executor.service.ts        # Execution coordination
├── api/
│   └── routes/
│       └── scheduler.routes.ts        # REST API endpoints
└── prisma/
    └── schema.prisma                  # Database models (extended)
```

### Service Architecture

```typescript
// Core Scheduler Service (Hexagonal Pattern)

┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Service                        │
│                   (Business Logic Layer)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • Job lifecycle management (create, update, cancel)       │
│  • Schedule validation and parsing                         │
│  • Platform-scoped job isolation                           │
│  • Execution coordination                                  │
│  • Retry logic and error handling                          │
│                                                             │
└───────┬─────────────────────────────────────────┬───────────┘
        │                                         │
        │ Uses Ports (Interfaces)                 │
        │                                         │
┌───────▼──────────┐                   ┌──────────▼──────────┐
│   IScheduler     │                   │  IJobExecutor       │
│   (Port)         │                   │  (Port)             │
└───────┬──────────┘                   └──────────┬──────────┘
        │                                         │
        │ Implemented by Adapters                 │
        │                                         │
┌───────▼──────────┐                   ┌──────────▼──────────┐
│ SchedulerAdapter │                   │ JobExecutorAdapter  │
│                  │                   │                     │
│ • Redis Streams  │                   │ • Handler Registry  │
│ • Consumer Groups│                   │ • Timeout Mgmt      │
│ • Job Queue      │                   │ • Result Capture    │
│ • ACK Management │                   │ • Error Handling    │
└───────┬──────────┘                   └──────────┬──────────┘
        │                                         │
        │                                         │
┌───────▼─────────────────────────────────────────▼───────────┐
│                    Infrastructure Layer                     │
│                                                             │
│  Redis Streams  │  PostgreSQL (Prisma)  │  Message Bus     │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No BullMQ Dependency** - Use existing Redis Streams infrastructure
2. **Platform-Scoped Jobs** - Leverage existing platform_id pattern
3. **Handler Registry Pattern** - Similar to AgentRegistry for extensibility
4. **Prisma Models** - Extend existing schema with new job tables
5. **Zod Validation** - Use existing validation patterns

---

## Database Schema

### Prisma Schema Extension

Add to `packages/orchestrator/prisma/schema.prisma`:

```prisma
// ==========================================
// SCHEDULER COMPONENT MODELS
// ==========================================

enum JobType {
  cron        // Recurring with cron schedule
  one_time    // Single future execution
  recurring   // Cron with start/end dates and limits
  event       // Triggered by events
}

enum JobStatus {
  pending     // Created but not yet active
  active      // Currently scheduled and running
  paused      // Temporarily stopped
  completed   // Finished (one-time or recurring reached limit)
  failed      // Permanently failed (exceeded retries)
  cancelled   // Manually cancelled
}

enum ExecutionStatus {
  pending     // Queued for execution
  running     // Currently executing
  success     // Completed successfully
  failed      // Failed (will retry if retries remain)
  timeout     // Exceeded timeout limit
  cancelled   // Manually cancelled
  skipped     // Skipped (e.g., overlap not allowed)
}

model ScheduledJob {
  // Primary Key
  id                  String          @id @default(uuid())

  // Basic Info
  name                String
  description         String?

  // Type & Status
  type                JobType
  status              JobStatus

  // Schedule (if applicable)
  schedule            String?         // Cron expression
  timezone            String          @default("UTC")
  next_run            DateTime?       // Next scheduled execution
  last_run            DateTime?       // Last execution time

  // Execution Limits (for recurring jobs)
  start_date          DateTime?
  end_date            DateTime?
  max_executions      Int?

  // Handler Configuration
  handler_name        String          // Name of registered handler
  handler_type        String          @default("function") // function, agent, workflow
  payload             Json?           // Handler arguments

  // Execution Configuration
  max_retries         Int             @default(3)
  retry_delay_ms      Int             @default(60000) // 1 minute
  timeout_ms          Int             @default(300000) // 5 minutes
  priority            Priority        @default(medium)
  concurrency         Int             @default(1)
  allow_overlap       Boolean         @default(false)

  // Statistics
  executions_count    Int             @default(0)
  success_count       Int             @default(0)
  failure_count       Int             @default(0)
  avg_duration_ms     Int?

  // Organization
  tags                String[]
  metadata            Json?

  // Platform-Scoped (Multi-tenancy)
  platform_id         String?
  created_by          String

  // Timestamps
  created_at          DateTime        @default(now())
  updated_at          DateTime        @updatedAt
  completed_at        DateTime?
  cancelled_at        DateTime?

  // Relationships
  platform            Platform?       @relation(fields: [platform_id], references: [id], onDelete: Cascade)
  executions          JobExecution[]

  // Indexes
  @@index([status])
  @@index([type])
  @@index([next_run])
  @@index([platform_id])
  @@index([handler_name])
  @@index([created_at])
  @@index([tags])
}

model JobExecution {
  // Primary Key
  id                  String          @id @default(uuid())

  // Foreign Key
  job_id              String

  // Status
  status              ExecutionStatus

  // Timing
  scheduled_at        DateTime        // When scheduled to run
  started_at          DateTime?       // Actual start time
  completed_at        DateTime?       // Actual completion
  duration_ms         Int?            // Execution duration

  // Results
  result              Json?           // Return value
  error               String?         // Error message
  error_stack         String?         // Stack trace

  // Retry Tracking
  retry_count         Int             @default(0)
  max_retries         Int             @default(3)
  next_retry_at       DateTime?

  // Execution Context
  worker_id           String?         // Which worker executed
  metadata            Json?

  // Distributed Tracing (integrates with existing trace system)
  trace_id            String?
  span_id             String?
  parent_span_id      String?

  // Timestamps
  created_at          DateTime        @default(now())

  // Relationships
  job                 ScheduledJob    @relation(fields: [job_id], references: [id], onDelete: Cascade)
  logs                JobExecutionLog[]

  // Indexes
  @@index([job_id])
  @@index([status])
  @@index([started_at])
  @@index([scheduled_at])
  @@index([trace_id])
  @@index([created_at])
}

model JobExecutionLog {
  // Primary Key
  id                  String          @id @default(uuid())

  // Foreign Key
  execution_id        String

  // Log Entry
  timestamp           DateTime        @default(now())
  level               String          // debug, info, warn, error
  message             String
  context             Json?

  // Relationships
  execution           JobExecution    @relation(fields: [execution_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([execution_id, timestamp])
  @@index([level])
}

model EventHandler {
  // Primary Key
  id                  String          @id @default(uuid())

  // Event
  event_name          String          // e.g., "workflow:completed", "ticket:created"
  handler_name        String          // Registered handler function name
  handler_type        String          @default("function") // function, job_creator

  // Configuration
  enabled             Boolean         @default(true)
  priority            Int             @default(5)

  // Handler Action (for job_creator type)
  action_type         String?         // create_job, trigger_workflow, dispatch_agent
  action_config       Json?           // Configuration for the action

  // Platform-Scoped
  platform_id         String?

  // Statistics
  trigger_count       Int             @default(0)
  success_count       Int             @default(0)
  failure_count       Int             @default(0)

  // Timestamps
  created_at          DateTime        @default(now())
  last_triggered      DateTime?

  // Relationships
  platform            Platform?       @relation(fields: [platform_id], references: [id], onDelete: Cascade)

  // Indexes
  @@index([event_name])
  @@index([enabled])
  @@index([platform_id])
}

// Extend existing Platform model
model Platform {
  // ... existing fields ...

  // New relationships
  scheduled_jobs      ScheduledJob[]
  event_handlers      EventHandler[]
}
```

### Migration Strategy

```bash
# Create migration
npx prisma migrate dev --name add_scheduler_tables

# Generate Prisma Client
npx prisma generate

# Migration will:
# 1. Create ScheduledJob table
# 2. Create JobExecution table
# 3. Create JobExecutionLog table
# 4. Create EventHandler table
# 5. Add foreign keys to Platform
# 6. Create indexes for performance
```

---

## Service Layer

### Core Interfaces (Ports)

**File:** `packages/orchestrator/src/hexagonal/ports/scheduler.port.ts`

```typescript
import { Priority } from '@prisma/client';

// ==========================================
// CORE TYPES
// ==========================================

export type JobType = 'cron' | 'one_time' | 'recurring' | 'event';
export type JobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled' | 'skipped';
export type HandlerType = 'function' | 'agent' | 'workflow';

// ==========================================
// JOB INPUT TYPES
// ==========================================

export interface ScheduledJobInput {
  // Identity
  id?: string;
  name: string;
  description?: string;

  // Schedule
  schedule: string;              // Cron expression
  timezone?: string;             // IANA timezone (default: UTC)

  // Handler
  handler_name: string;          // Registered handler name
  handler_type?: HandlerType;    // Type of handler
  payload?: any;                 // Data passed to handler

  // Configuration
  enabled?: boolean;
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;
  concurrency?: number;
  allow_overlap?: boolean;

  // Organization
  tags?: string[];
  metadata?: Record<string, any>;

  // Platform Context
  platform_id?: string;
  created_by: string;
}

export interface OneTimeJobInput {
  // Identity
  id?: string;
  name: string;
  description?: string;

  // Timing
  execute_at: Date;              // Exact execution time

  // Handler
  handler_name: string;
  handler_type?: HandlerType;
  payload?: any;

  // Configuration
  max_retries?: number;
  retry_delay_ms?: number;
  timeout_ms?: number;
  priority?: Priority;

  // Organization
  tags?: string[];
  metadata?: Record<string, any>;

  // Platform Context
  platform_id?: string;
  created_by: string;
}

export interface RecurringJobInput extends ScheduledJobInput {
  // Time Boundaries
  start_date: Date;
  end_date?: Date;

  // Execution Limits
  max_executions?: number;

  // Behavior
  skip_if_overdue?: boolean;
}

// ==========================================
// JOB OUTPUT TYPES
// ==========================================

export interface Job {
  id: string;
  name: string;
  description?: string;
  type: JobType;
  status: JobStatus;
  schedule?: string;
  timezone?: string;
  next_run?: Date;
  last_run?: Date;
  start_date?: Date;
  end_date?: Date;
  max_executions?: number;
  handler_name: string;
  handler_type: HandlerType;
  payload?: any;
  max_retries: number;
  retry_delay_ms: number;
  timeout_ms: number;
  priority: Priority;
  concurrency: number;
  allow_overlap: boolean;
  executions_count: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms?: number;
  tags: string[];
  metadata?: Record<string, any>;
  platform_id?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
}

export interface JobExecution {
  id: string;
  job_id: string;
  status: ExecutionStatus;
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  duration_ms?: number;
  result?: any;
  error?: string;
  error_stack?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  worker_id?: string;
  metadata?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  created_at: Date;
}

// ==========================================
// FILTER & QUERY TYPES
// ==========================================

export interface JobFilter {
  type?: JobType | JobType[];
  status?: JobStatus | JobStatus[];
  tags?: string[];
  tags_all?: string[];
  created_after?: Date;
  created_before?: Date;
  next_run_after?: Date;
  next_run_before?: Date;
  name_contains?: string;
  platform_id?: string;
  created_by?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'next_run' | 'name' | 'priority';
  sort_order?: 'asc' | 'desc';
}

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  status?: ExecutionStatus;
  since?: Date;
  until?: Date;
  include_logs?: boolean;
  sort_order?: 'asc' | 'desc';
}

// ==========================================
// METRICS TYPES
// ==========================================

export interface SchedulerMetrics {
  jobs: {
    total: number;
    active: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  executions: {
    total: number;
    successful: number;
    failed: number;
    timeout: number;
    cancelled: number;
    pending: number;
    running: number;
  };
  performance: {
    success_rate: number;
    avg_duration_ms: number;
    p50_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
  };
  queue: {
    size: number;
    processing: number;
    delayed: number;
    failed: number;
  };
  system: {
    workers: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    uptime_seconds: number;
  };
  time_range: {
    start: Date;
    end: Date;
  };
  generated_at: Date;
}

export interface JobStats {
  job_id: string;
  job_name: string;
  total_executions: number;
  successful: number;
  failed: number;
  timeout: number;
  success_rate: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  last_execution?: {
    execution_id: string;
    status: ExecutionStatus;
    started_at: Date;
    duration_ms?: number;
  };
  next_execution?: {
    scheduled_at: Date;
    estimated_duration_ms: number;
  };
  failure_patterns?: Array<{
    error_type: string;
    count: number;
    last_occurrence: Date;
  }>;
  busiest_hours: Array<{
    hour: number;
    execution_count: number;
  }>;
  generated_at: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    scheduler: {
      status: 'up' | 'down';
      message?: string;
    };
    database: {
      status: 'up' | 'down';
      latency_ms?: number;
      message?: string;
    };
    queue: {
      status: 'up' | 'down';
      message?: string;
    };
    workers: {
      status: 'up' | 'down';
      active_count: number;
      message?: string;
    };
  };
  issues?: Array<{
    component: string;
    severity: 'warning' | 'error' | 'critical';
    message: string;
    since: Date;
  }>;
  timestamp: Date;
  uptime_seconds: number;
}

// ==========================================
// SCHEDULER PORT (Interface)
// ==========================================

export interface IScheduler {
  // ==========================================
  // JOB SCHEDULING METHODS
  // ==========================================

  /**
   * Schedule a recurring job using cron expression
   */
  schedule(job: ScheduledJobInput): Promise<Job>;

  /**
   * Schedule a single execution at a specific time
   */
  scheduleOnce(job: OneTimeJobInput): Promise<Job>;

  /**
   * Schedule recurring job with start/end dates and execution limits
   */
  scheduleRecurring(job: RecurringJobInput): Promise<Job>;

  /**
   * Update the schedule of an existing job
   */
  reschedule(jobId: string, newSchedule: string): Promise<Job>;

  /**
   * Cancel and remove a scheduled job
   */
  unschedule(jobId: string): Promise<void>;

  // ==========================================
  // EVENT-BASED METHODS
  // ==========================================

  /**
   * Register handler to execute when event occurs
   */
  onEvent(event: string, handler: EventHandlerFunction, options?: EventHandlerOptions): Promise<void>;

  /**
   * Trigger an event that handlers are listening for
   */
  triggerEvent(event: string, data: any): Promise<void>;

  // ==========================================
  // JOB MANAGEMENT METHODS
  // ==========================================

  /**
   * Retrieve job details by ID
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * List jobs with optional filtering
   */
  listJobs(filter?: JobFilter): Promise<Job[]>;

  /**
   * Temporarily stop job execution
   */
  pauseJob(jobId: string): Promise<void>;

  /**
   * Resume a paused job
   */
  resumeJob(jobId: string): Promise<void>;

  /**
   * Permanently cancel a job
   */
  cancelJob(jobId: string): Promise<void>;

  // ==========================================
  // EXECUTION HISTORY METHODS
  // ==========================================

  /**
   * Get execution history for a job
   */
  getJobHistory(jobId: string, options?: HistoryOptions): Promise<JobExecution[]>;

  /**
   * Get details of a specific execution
   */
  getExecution(executionId: string): Promise<JobExecution | null>;

  /**
   * Manually retry a failed execution
   */
  retryExecution(executionId: string): Promise<JobExecution>;

  // ==========================================
  // MONITORING METHODS
  // ==========================================

  /**
   * Get scheduler performance metrics
   */
  getMetrics(start?: Date, end?: Date): Promise<SchedulerMetrics>;

  /**
   * Check if scheduler is operational
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get statistics for a specific job
   */
  getJobStats(jobId: string): Promise<JobStats>;
}

// ==========================================
// EVENT HANDLER TYPES
// ==========================================

export type EventHandlerFunction = (data: any) => Promise<void> | void;

export interface EventHandlerOptions {
  priority?: number;
  enabled?: boolean;
  platform_id?: string;
  action?: {
    type: 'create_job' | 'trigger_workflow' | 'dispatch_agent';
    config: any;
  };
}
```

### Scheduler Service Implementation

**File:** `packages/orchestrator/src/services/scheduler.service.ts`

```typescript
import { PrismaClient, Priority } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { IScheduler, ScheduledJobInput, OneTimeJobInput, RecurringJobInput, Job, JobExecution, JobFilter, HistoryOptions, SchedulerMetrics, JobStats, HealthStatus, EventHandlerFunction, EventHandlerOptions } from '../hexagonal/ports/scheduler.port';
import { IMessageBus } from '../hexagonal/ports/message-bus.port';
import { parseExpression } from 'cron-parser';

/**
 * Scheduler Service - Business Logic Layer
 *
 * Responsibilities:
 * - Job lifecycle management (create, update, cancel)
 * - Schedule validation and next run calculation
 * - Platform-scoped job isolation
 * - Integration with message bus for job dispatch
 * - Execution tracking and metrics
 *
 * Architecture:
 * - Uses Prisma for persistence
 * - Uses Redis Streams (via MessageBus) for job queue
 * - Follows hexagonal pattern (implements IScheduler port)
 */
export class SchedulerService implements IScheduler {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messageBus: IMessageBus
  ) {}

  // ==========================================
  // JOB SCHEDULING METHODS
  // ==========================================

  async schedule(input: ScheduledJobInput): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(input.schedule);

    // Calculate next run time
    const nextRun = this.calculateNextRun(input.schedule, input.timezone || 'UTC');

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'cron',
        status: input.enabled !== false ? 'active' : 'paused',
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        next_run: nextRun,
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: input.concurrency ?? 1,
        allow_overlap: input.allow_overlap ?? false,
        tags: input.tags || [],
        metadata: input.metadata || {},
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created cron job', {
      jobId: job.id,
      name: job.name,
      schedule: job.schedule,
      nextRun: job.next_run
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      schedule: job.schedule,
      next_run: job.next_run
    });

    return this.formatJob(job);
  }

  async scheduleOnce(input: OneTimeJobInput): Promise<Job> {
    // Validate execution time is in the future
    if (input.execute_at <= new Date()) {
      throw new Error('execute_at must be in the future');
    }

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'one_time',
        status: 'active',
        next_run: input.execute_at,
        timezone: 'UTC',
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: 1,
        allow_overlap: false,
        tags: input.tags || [],
        metadata: input.metadata || {},
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created one-time job', {
      jobId: job.id,
      name: job.name,
      executeAt: job.next_run
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      execute_at: job.next_run
    });

    return this.formatJob(job);
  }

  async scheduleRecurring(input: RecurringJobInput): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(input.schedule);

    // Validate date ranges
    if (input.end_date && input.end_date <= input.start_date) {
      throw new Error('end_date must be after start_date');
    }

    // Calculate next run time (considering start_date)
    const nextRun = this.calculateNextRun(
      input.schedule,
      input.timezone || 'UTC',
      input.start_date
    );

    // Create job in database
    const job = await this.prisma.scheduledJob.create({
      data: {
        id: input.id || randomUUID(),
        name: input.name,
        description: input.description,
        type: 'recurring',
        status: input.enabled !== false ? 'active' : 'paused',
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        next_run: nextRun,
        start_date: input.start_date,
        end_date: input.end_date,
        max_executions: input.max_executions,
        handler_name: input.handler_name,
        handler_type: input.handler_type || 'function',
        payload: input.payload || {},
        max_retries: input.max_retries ?? 3,
        retry_delay_ms: input.retry_delay_ms ?? 60000,
        timeout_ms: input.timeout_ms ?? 300000,
        priority: input.priority || 'medium',
        concurrency: input.concurrency ?? 1,
        allow_overlap: input.allow_overlap ?? false,
        tags: input.tags || [],
        metadata: { ...input.metadata, skip_if_overdue: input.skip_if_overdue },
        platform_id: input.platform_id,
        created_by: input.created_by
      }
    });

    logger.info('[SchedulerService] Created recurring job', {
      jobId: job.id,
      name: job.name,
      schedule: job.schedule,
      startDate: job.start_date,
      endDate: job.end_date,
      maxExecutions: job.max_executions
    });

    // Publish job created event
    await this.messageBus.publish('scheduler:job.created', {
      job_id: job.id,
      job_name: job.name,
      type: job.type,
      schedule: job.schedule,
      next_run: job.next_run,
      start_date: job.start_date,
      end_date: job.end_date
    });

    return this.formatJob(job);
  }

  async reschedule(jobId: string, newSchedule: string): Promise<Job> {
    // Validate cron expression
    this.validateCronExpression(newSchedule);

    // Get existing job
    const existingJob = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (existingJob.type !== 'cron' && existingJob.type !== 'recurring') {
      throw new Error(`Cannot reschedule ${existingJob.type} job. Only cron and recurring jobs can be rescheduled.`);
    }

    // Calculate new next run time
    const nextRun = this.calculateNextRun(
      newSchedule,
      existingJob.timezone,
      existingJob.start_date || undefined
    );

    // Update job
    const job = await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        schedule: newSchedule,
        next_run: nextRun
      }
    });

    logger.info('[SchedulerService] Rescheduled job', {
      jobId: job.id,
      oldSchedule: existingJob.schedule,
      newSchedule: newSchedule,
      nextRun: job.next_run
    });

    // Publish job updated event
    await this.messageBus.publish('scheduler:job.updated', {
      job_id: job.id,
      changes: { schedule: newSchedule, next_run: nextRun }
    });

    return this.formatJob(job);
  }

  async unschedule(jobId: string): Promise<void> {
    // Verify job exists
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Delete job (cascade will delete executions)
    await this.prisma.scheduledJob.delete({
      where: { id: jobId }
    });

    logger.info('[SchedulerService] Unscheduled job', {
      jobId,
      name: job.name
    });

    // Publish job deleted event
    await this.messageBus.publish('scheduler:job.deleted', {
      job_id: jobId,
      job_name: job.name
    });
  }

  // ==========================================
  // EVENT-BASED METHODS
  // ==========================================

  async onEvent(event: string, handler: EventHandlerFunction, options?: EventHandlerOptions): Promise<void> {
    // Register event handler in database
    const eventHandler = await this.prisma.eventHandler.create({
      data: {
        event_name: event,
        handler_name: handler.name || 'anonymous',
        handler_type: options?.action ? 'job_creator' : 'function',
        enabled: options?.enabled !== false,
        priority: options?.priority ?? 5,
        action_type: options?.action?.type,
        action_config: options?.action?.config,
        platform_id: options?.platform_id
      }
    });

    logger.info('[SchedulerService] Registered event handler', {
      eventHandlerId: eventHandler.id,
      eventName: event,
      handlerName: eventHandler.handler_name,
      platformId: options?.platform_id
    });

    // Subscribe to event on message bus
    await this.messageBus.subscribe(event, async (data) => {
      try {
        // Execute handler
        await handler(data);

        // Update statistics
        await this.prisma.eventHandler.update({
          where: { id: eventHandler.id },
          data: {
            trigger_count: { increment: 1 },
            success_count: { increment: 1 },
            last_triggered: new Date()
          }
        });

        logger.debug('[SchedulerService] Event handler executed', {
          eventName: event,
          handlerName: eventHandler.handler_name
        });
      } catch (error: any) {
        // Update failure statistics
        await this.prisma.eventHandler.update({
          where: { id: eventHandler.id },
          data: {
            trigger_count: { increment: 1 },
            failure_count: { increment: 1 },
            last_triggered: new Date()
          }
        });

        logger.error('[SchedulerService] Event handler failed', {
          eventName: event,
          handlerName: eventHandler.handler_name,
          error: error.message
        });
      }
    });
  }

  async triggerEvent(event: string, data: any): Promise<void> {
    logger.info('[SchedulerService] Triggering event', { event, data });

    // Publish event to message bus
    await this.messageBus.publish(event, data);
  }

  // ==========================================
  // JOB MANAGEMENT METHODS
  // ==========================================

  async getJob(jobId: string): Promise<Job | null> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    return job ? this.formatJob(job) : null;
  }

  async listJobs(filter?: JobFilter): Promise<Job[]> {
    const where: any = {};

    // Apply filters
    if (filter?.type) {
      where.type = Array.isArray(filter.type) ? { in: filter.type } : filter.type;
    }
    if (filter?.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter?.tags) {
      where.tags = { hasSome: filter.tags };
    }
    if (filter?.tags_all) {
      where.tags = { hasEvery: filter.tags_all };
    }
    if (filter?.created_after) {
      where.created_at = { ...where.created_at, gte: filter.created_after };
    }
    if (filter?.created_before) {
      where.created_at = { ...where.created_at, lte: filter.created_before };
    }
    if (filter?.next_run_after) {
      where.next_run = { ...where.next_run, gte: filter.next_run_after };
    }
    if (filter?.next_run_before) {
      where.next_run = { ...where.next_run, lte: filter.next_run_before };
    }
    if (filter?.name_contains) {
      where.name = { contains: filter.name_contains, mode: 'insensitive' };
    }
    if (filter?.platform_id) {
      where.platform_id = filter.platform_id;
    }
    if (filter?.created_by) {
      where.created_by = filter.created_by;
    }

    // Execute query
    const jobs = await this.prisma.scheduledJob.findMany({
      where,
      take: filter?.limit,
      skip: filter?.offset,
      orderBy: filter?.sort_by ? {
        [filter.sort_by]: filter.sort_order || 'desc'
      } : undefined
    });

    return jobs.map(job => this.formatJob(job));
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'active') {
      throw new Error(`Cannot pause job with status: ${job.status}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'paused' }
    });

    logger.info('[SchedulerService] Paused job', { jobId, name: job.name });

    // Publish job paused event
    await this.messageBus.publish('scheduler:job.paused', {
      job_id: jobId,
      job_name: job.name
    });
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== 'paused') {
      throw new Error(`Cannot resume job with status: ${job.status}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'active' }
    });

    logger.info('[SchedulerService] Resumed job', { jobId, name: job.name });

    // Publish job resumed event
    await this.messageBus.publish('scheduler:job.resumed', {
      job_id: jobId,
      job_name: job.name
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        cancelled_at: new Date()
      }
    });

    logger.info('[SchedulerService] Cancelled job', { jobId, name: job.name });

    // Publish job cancelled event
    await this.messageBus.publish('scheduler:job.cancelled', {
      job_id: jobId,
      job_name: job.name
    });
  }

  // ==========================================
  // EXECUTION HISTORY METHODS
  // ==========================================

  async getJobHistory(jobId: string, options?: HistoryOptions): Promise<JobExecution[]> {
    const where: any = { job_id: jobId };

    if (options?.status) {
      where.status = options.status;
    }
    if (options?.since) {
      where.started_at = { ...where.started_at, gte: options.since };
    }
    if (options?.until) {
      where.started_at = { ...where.started_at, lte: options.until };
    }

    const executions = await this.prisma.jobExecution.findMany({
      where,
      include: {
        logs: options?.include_logs
      },
      take: options?.limit ?? 10,
      skip: options?.offset,
      orderBy: {
        started_at: options?.sort_order || 'desc'
      }
    });

    return executions.map(exec => this.formatExecution(exec));
  }

  async getExecution(executionId: string): Promise<JobExecution | null> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { logs: true }
    });

    return execution ? this.formatExecution(execution) : null;
  }

  async retryExecution(executionId: string): Promise<JobExecution> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: { job: true }
    });

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'failed' && execution.status !== 'timeout') {
      throw new Error(`Cannot retry execution with status: ${execution.status}`);
    }

    // Create new execution
    const newExecution = await this.prisma.jobExecution.create({
      data: {
        job_id: execution.job_id,
        status: 'pending',
        scheduled_at: new Date(),
        retry_count: 0,
        max_retries: execution.max_retries,
        metadata: {
          ...execution.metadata,
          manual_retry: true,
          original_execution_id: executionId
        }
      }
    });

    logger.info('[SchedulerService] Created retry execution', {
      originalExecutionId: executionId,
      newExecutionId: newExecution.id,
      jobId: execution.job_id
    });

    // Dispatch to job queue
    await this.dispatchJobExecution(execution.job, newExecution);

    return this.formatExecution(newExecution);
  }

  // ==========================================
  // MONITORING METHODS
  // ==========================================

  async getMetrics(start?: Date, end?: Date): Promise<SchedulerMetrics> {
    const timeRange = {
      start: start || new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: 24h ago
      end: end || new Date()
    };

    // Job counts
    const [total, active, paused, completed, failed, cancelled] = await Promise.all([
      this.prisma.scheduledJob.count(),
      this.prisma.scheduledJob.count({ where: { status: 'active' } }),
      this.prisma.scheduledJob.count({ where: { status: 'paused' } }),
      this.prisma.scheduledJob.count({ where: { status: 'completed' } }),
      this.prisma.scheduledJob.count({ where: { status: 'failed' } }),
      this.prisma.scheduledJob.count({ where: { status: 'cancelled' } })
    ]);

    // Execution counts (within time range)
    const executionWhere = {
      started_at: {
        gte: timeRange.start,
        lte: timeRange.end
      }
    };

    const [totalExec, successful, failedExec, timeout, cancelledExec, pending, running] = await Promise.all([
      this.prisma.jobExecution.count({ where: executionWhere }),
      this.prisma.jobExecution.count({ where: { ...executionWhere, status: 'success' } }),
      this.prisma.jobExecution.count({ where: { ...executionWhere, status: 'failed' } }),
      this.prisma.jobExecution.count({ where: { ...executionWhere, status: 'timeout' } }),
      this.prisma.jobExecution.count({ where: { ...executionWhere, status: 'cancelled' } }),
      this.prisma.jobExecution.count({ where: { status: 'pending' } }),
      this.prisma.jobExecution.count({ where: { status: 'running' } })
    ]);

    // Performance metrics
    const durations = await this.prisma.jobExecution.findMany({
      where: {
        ...executionWhere,
        status: 'success',
        duration_ms: { not: null }
      },
      select: { duration_ms: true }
    });

    const durationValues = durations.map(d => d.duration_ms!).sort((a, b) => a - b);
    const avgDuration = durationValues.length > 0
      ? durationValues.reduce((a, b) => a + b, 0) / durationValues.length
      : 0;
    const p50 = durationValues[Math.floor(durationValues.length * 0.5)] || 0;
    const p95 = durationValues[Math.floor(durationValues.length * 0.95)] || 0;
    const p99 = durationValues[Math.floor(durationValues.length * 0.99)] || 0;

    const successRate = totalExec > 0 ? (successful / totalExec) * 100 : 0;

    return {
      jobs: {
        total,
        active,
        paused,
        completed,
        failed,
        cancelled
      },
      executions: {
        total: totalExec,
        successful,
        failed: failedExec,
        timeout,
        cancelled: cancelledExec,
        pending,
        running
      },
      performance: {
        success_rate: Math.round(successRate * 100) / 100,
        avg_duration_ms: Math.round(avgDuration),
        p50_duration_ms: p50,
        p95_duration_ms: p95,
        p99_duration_ms: p99
      },
      queue: {
        size: pending,
        processing: running,
        delayed: 0, // TODO: Implement delayed queue tracking
        failed: failedExec
      },
      system: {
        workers: 1, // TODO: Implement worker tracking
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpu_usage_percent: 0, // TODO: Implement CPU tracking
        uptime_seconds: Math.round(process.uptime())
      },
      time_range: timeRange,
      generated_at: new Date()
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    const issues: HealthStatus['issues'] = [];

    // Check database
    let dbStatus: 'up' | 'down' = 'up';
    let dbLatency = 0;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;

      if (dbLatency > 1000) {
        issues.push({
          component: 'database',
          severity: 'warning',
          message: `High database latency: ${dbLatency}ms`,
          since: new Date()
        });
      }
    } catch (error: any) {
      dbStatus = 'down';
      issues.push({
        component: 'database',
        severity: 'critical',
        message: `Database connection failed: ${error.message}`,
        since: new Date()
      });
    }

    // Check message bus
    let queueStatus: 'up' | 'down' = 'up';
    try {
      const health = await this.messageBus.health();
      if (!health.ok) {
        queueStatus = 'down';
        issues.push({
          component: 'queue',
          severity: 'critical',
          message: 'Message bus health check failed',
          since: new Date()
        });
      }
    } catch (error: any) {
      queueStatus = 'down';
      issues.push({
        component: 'queue',
        severity: 'critical',
        message: `Message bus check failed: ${error.message}`,
        since: new Date()
      });
    }

    // Determine overall status
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const status: HealthStatus['status'] =
      criticalIssues.length > 0 ? 'unhealthy' :
      issues.length > 0 ? 'degraded' :
      'healthy';

    return {
      status,
      components: {
        scheduler: {
          status: 'up'
        },
        database: {
          status: dbStatus,
          latency_ms: dbLatency
        },
        queue: {
          status: queueStatus
        },
        workers: {
          status: 'up',
          active_count: 1 // TODO: Implement worker tracking
        }
      },
      issues: issues.length > 0 ? issues : undefined,
      timestamp: new Date(),
      uptime_seconds: Math.round(process.uptime())
    };
  }

  async getJobStats(jobId: string): Promise<JobStats> {
    const job = await this.prisma.scheduledJob.findUnique({
      where: { id: jobId },
      include: {
        executions: {
          orderBy: { started_at: 'desc' },
          take: 100
        }
      }
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const executions = job.executions;
    const successful = executions.filter(e => e.status === 'success');
    const failed = executions.filter(e => e.status === 'failed');
    const timeout = executions.filter(e => e.status === 'timeout');

    const durations = successful
      .filter(e => e.duration_ms !== null)
      .map(e => e.duration_ms!);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    const successRate = executions.length > 0
      ? (successful.length / executions.length) * 100
      : 0;

    // Analyze failure patterns
    const errorMap = new Map<string, { count: number; last: Date }>();
    failed.forEach(exec => {
      if (exec.error) {
        const errorType = exec.error.split(':')[0]; // First part of error
        const existing = errorMap.get(errorType) || { count: 0, last: new Date(0) };
        errorMap.set(errorType, {
          count: existing.count + 1,
          last: exec.started_at! > existing.last ? exec.started_at! : existing.last
        });
      }
    });

    const failurePatterns = Array.from(errorMap.entries()).map(([errorType, data]) => ({
      error_type: errorType,
      count: data.count,
      last_occurrence: data.last
    }));

    // Busiest hours analysis
    const hourMap = new Map<number, number>();
    executions.forEach(exec => {
      if (exec.started_at) {
        const hour = exec.started_at.getUTCHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      }
    });

    const busiestHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, execution_count: count }))
      .sort((a, b) => b.execution_count - a.execution_count)
      .slice(0, 5);

    return {
      job_id: job.id,
      job_name: job.name,
      total_executions: executions.length,
      successful: successful.length,
      failed: failed.length,
      timeout: timeout.length,
      success_rate: Math.round(successRate * 100) / 100,
      avg_duration_ms: Math.round(avgDuration),
      min_duration_ms: minDuration,
      max_duration_ms: maxDuration,
      last_execution: executions.length > 0 ? {
        execution_id: executions[0].id,
        status: executions[0].status as any,
        started_at: executions[0].started_at!,
        duration_ms: executions[0].duration_ms || undefined
      } : undefined,
      next_execution: job.next_run ? {
        scheduled_at: job.next_run,
        estimated_duration_ms: Math.round(avgDuration)
      } : undefined,
      failure_patterns: failurePatterns.length > 0 ? failurePatterns : undefined,
      busiest_hours: busiestHours,
      generated_at: new Date()
    };
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private validateCronExpression(schedule: string): void {
    try {
      parseExpression(schedule);
    } catch (error: any) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }
  }

  private calculateNextRun(
    schedule: string,
    timezone: string,
    startDate?: Date
  ): Date {
    const options: any = {
      tz: timezone
    };

    if (startDate) {
      options.currentDate = startDate;
    }

    const interval = parseExpression(schedule, options);
    return interval.next().toDate();
  }

  private async dispatchJobExecution(job: any, execution: any): Promise<void> {
    // Publish to job execution queue (Redis Stream)
    await this.messageBus.publish('scheduler:job.dispatch', {
      job_id: job.id,
      execution_id: execution.id,
      handler_name: job.handler_name,
      handler_type: job.handler_type,
      payload: job.payload,
      timeout_ms: job.timeout_ms,
      trace_id: execution.trace_id
    }, {
      mirrorToStream: 'stream:scheduler:job.dispatch'
    });
  }

  private formatJob(job: any): Job {
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      type: job.type,
      status: job.status,
      schedule: job.schedule,
      timezone: job.timezone,
      next_run: job.next_run,
      last_run: job.last_run,
      start_date: job.start_date,
      end_date: job.end_date,
      max_executions: job.max_executions,
      handler_name: job.handler_name,
      handler_type: job.handler_type,
      payload: job.payload,
      max_retries: job.max_retries,
      retry_delay_ms: job.retry_delay_ms,
      timeout_ms: job.timeout_ms,
      priority: job.priority,
      concurrency: job.concurrency,
      allow_overlap: job.allow_overlap,
      executions_count: job.executions_count,
      success_count: job.success_count,
      failure_count: job.failure_count,
      avg_duration_ms: job.avg_duration_ms,
      tags: job.tags,
      metadata: job.metadata,
      platform_id: job.platform_id,
      created_by: job.created_by,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
      cancelled_at: job.cancelled_at
    };
  }

  private formatExecution(execution: any): JobExecution {
    return {
      id: execution.id,
      job_id: execution.job_id,
      status: execution.status,
      scheduled_at: execution.scheduled_at,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      duration_ms: execution.duration_ms,
      result: execution.result,
      error: execution.error,
      error_stack: execution.error_stack,
      retry_count: execution.retry_count,
      max_retries: execution.max_retries,
      next_retry_at: execution.next_retry_at,
      worker_id: execution.worker_id,
      metadata: execution.metadata,
      trace_id: execution.trace_id,
      span_id: execution.span_id,
      parent_span_id: execution.parent_span_id,
      created_at: execution.created_at
    };
  }
}
```

---

## API Routes

### REST Endpoints

**File:** `packages/orchestrator/src/api/routes/scheduler.routes.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SchedulerService } from '../../services/scheduler.service';
import { logger } from '../../utils/logger';

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const ScheduledJobInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  schedule: z.string(),
  timezone: z.string().optional(),
  handler_name: z.string(),
  handler_type: z.enum(['function', 'agent', 'workflow']).optional(),
  payload: z.any().optional(),
  enabled: z.boolean().optional(),
  max_retries: z.number().int().min(0).optional(),
  retry_delay_ms: z.number().int().min(0).optional(),
  timeout_ms: z.number().int().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  concurrency: z.number().int().min(1).optional(),
  allow_overlap: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  platform_id: z.string().uuid().optional()
});

const OneTimeJobInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  execute_at: z.string().datetime(),
  handler_name: z.string(),
  handler_type: z.enum(['function', 'agent', 'workflow']).optional(),
  payload: z.any().optional(),
  max_retries: z.number().int().min(0).optional(),
  retry_delay_ms: z.number().int().min(0).optional(),
  timeout_ms: z.number().int().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  platform_id: z.string().uuid().optional()
});

const RecurringJobInputSchema = ScheduledJobInputSchema.extend({
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
  max_executions: z.number().int().min(1).optional(),
  skip_if_overdue: z.boolean().optional()
});

// ==========================================
// ROUTE REGISTRATION
// ==========================================

export async function schedulerRoutes(
  fastify: FastifyInstance,
  options: { scheduler: SchedulerService }
): Promise<void> {
  const { scheduler } = options;

  // ==========================================
  // JOB SCHEDULING ENDPOINTS
  // ==========================================

  // POST /api/v1/scheduler/jobs/cron - Create cron job
  fastify.post('/api/v1/scheduler/jobs/cron', {
    schema: {
      body: zodToJsonSchema(ScheduledJobInputSchema),
      response: {
        201: zodToJsonSchema(z.any()),
        400: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply): Promise<void> => {
      try {
        const job = await scheduler.schedule({
          ...request.body,
          created_by: 'api' // TODO: Get from auth context
        });

        reply.code(201).send(job);
      } catch (error: any) {
        logger.error('[POST /api/v1/scheduler/jobs/cron] Failed', { error: error.message });
        reply.code(400).send({ error: error.message });
      }
    }
  });

  // POST /api/v1/scheduler/jobs/once - Create one-time job
  fastify.post('/api/v1/scheduler/jobs/once', {
    schema: {
      body: zodToJsonSchema(OneTimeJobInputSchema),
      response: {
        201: zodToJsonSchema(z.any()),
        400: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply): Promise<void> => {
      try {
        const job = await scheduler.scheduleOnce({
          ...request.body,
          execute_at: new Date(request.body.execute_at),
          created_by: 'api' // TODO: Get from auth context
        });

        reply.code(201).send(job);
      } catch (error: any) {
        logger.error('[POST /api/v1/scheduler/jobs/once] Failed', { error: error.message });
        reply.code(400).send({ error: error.message });
      }
    }
  });

  // POST /api/v1/scheduler/jobs/recurring - Create recurring job
  fastify.post('/api/v1/scheduler/jobs/recurring', {
    schema: {
      body: zodToJsonSchema(RecurringJobInputSchema),
      response: {
        201: zodToJsonSchema(z.any()),
        400: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply): Promise<void> => {
      try {
        const job = await scheduler.scheduleRecurring({
          ...request.body,
          start_date: new Date(request.body.start_date),
          end_date: request.body.end_date ? new Date(request.body.end_date) : undefined,
          created_by: 'api' // TODO: Get from auth context
        });

        reply.code(201).send(job);
      } catch (error: any) {
        logger.error('[POST /api/v1/scheduler/jobs/recurring] Failed', { error: error.message });
        reply.code(400).send({ error: error.message });
      }
    }
  });

  // ==========================================
  // JOB MANAGEMENT ENDPOINTS
  // ==========================================

  // GET /api/v1/scheduler/jobs - List jobs
  fastify.get('/api/v1/scheduler/jobs', {
    schema: {
      querystring: zodToJsonSchema(z.object({
        type: z.enum(['cron', 'one_time', 'recurring', 'event']).optional(),
        status: z.enum(['pending', 'active', 'paused', 'completed', 'failed', 'cancelled']).optional(),
        platform_id: z.string().uuid().optional(),
        tags: z.string().optional(), // Comma-separated
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.any()))
      }
    },
    handler: async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply): Promise<void> => {
      try {
        const filter = {
          ...request.query,
          tags: request.query.tags ? request.query.tags.split(',') : undefined
        };

        const jobs = await scheduler.listJobs(filter);
        reply.code(200).send(jobs);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/jobs] Failed', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // GET /api/v1/scheduler/jobs/:id - Get job by ID
  fastify.get('/api/v1/scheduler/jobs/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(z.any()),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const job = await scheduler.getJob(request.params.id);

        if (!job) {
          reply.code(404).send({ error: 'Job not found' });
          return;
        }

        reply.code(200).send(job);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/jobs/:id] Failed', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // PUT /api/v1/scheduler/jobs/:id/reschedule - Reschedule job
  fastify.put('/api/v1/scheduler/jobs/:id/reschedule', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      body: zodToJsonSchema(z.object({ schedule: z.string() })),
      response: {
        200: zodToJsonSchema(z.any()),
        400: zodToJsonSchema(z.object({ error: z.string() })),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string }; Body: { schedule: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const job = await scheduler.reschedule(request.params.id, request.body.schedule);
        reply.code(200).send(job);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        logger.error('[PUT /api/v1/scheduler/jobs/:id/reschedule] Failed', { error: error.message });
        reply.code(statusCode).send({ error: error.message });
      }
    }
  });

  // POST /api/v1/scheduler/jobs/:id/pause - Pause job
  fastify.post('/api/v1/scheduler/jobs/:id/pause', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        204: z.null(),
        400: zodToJsonSchema(z.object({ error: z.string() })),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        await scheduler.pauseJob(request.params.id);
        reply.code(204).send();
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        logger.error('[POST /api/v1/scheduler/jobs/:id/pause] Failed', { error: error.message });
        reply.code(statusCode).send({ error: error.message });
      }
    }
  });

  // POST /api/v1/scheduler/jobs/:id/resume - Resume job
  fastify.post('/api/v1/scheduler/jobs/:id/resume', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        204: z.null(),
        400: zodToJsonSchema(z.object({ error: z.string() })),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        await scheduler.resumeJob(request.params.id);
        reply.code(204).send();
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        logger.error('[POST /api/v1/scheduler/jobs/:id/resume] Failed', { error: error.message });
        reply.code(statusCode).send({ error: error.message });
      }
    }
  });

  // DELETE /api/v1/scheduler/jobs/:id - Cancel job
  fastify.delete('/api/v1/scheduler/jobs/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        204: z.null(),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        await scheduler.cancelJob(request.params.id);
        reply.code(204).send();
      } catch (error: any) {
        logger.error('[DELETE /api/v1/scheduler/jobs/:id] Failed', { error: error.message });
        reply.code(404).send({ error: error.message });
      }
    }
  });

  // ==========================================
  // EXECUTION HISTORY ENDPOINTS
  // ==========================================

  // GET /api/v1/scheduler/jobs/:id/executions - Get job execution history
  fastify.get('/api/v1/scheduler/jobs/:id/executions', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      querystring: zodToJsonSchema(z.object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        status: z.enum(['pending', 'running', 'success', 'failed', 'timeout', 'cancelled', 'skipped']).optional()
      })),
      response: {
        200: zodToJsonSchema(z.array(z.any()))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string }; Querystring: any }>, reply: FastifyReply): Promise<void> => {
      try {
        const executions = await scheduler.getJobHistory(request.params.id, request.query);
        reply.code(200).send(executions);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/jobs/:id/executions] Failed', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // GET /api/v1/scheduler/executions/:id - Get execution by ID
  fastify.get('/api/v1/scheduler/executions/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(z.any()),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const execution = await scheduler.getExecution(request.params.id);

        if (!execution) {
          reply.code(404).send({ error: 'Execution not found' });
          return;
        }

        reply.code(200).send(execution);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/executions/:id] Failed', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // POST /api/v1/scheduler/executions/:id/retry - Retry failed execution
  fastify.post('/api/v1/scheduler/executions/:id/retry', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        201: zodToJsonSchema(z.any()),
        400: zodToJsonSchema(z.object({ error: z.string() })),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const execution = await scheduler.retryExecution(request.params.id);
        reply.code(201).send(execution);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 400;
        logger.error('[POST /api/v1/scheduler/executions/:id/retry] Failed', { error: error.message });
        reply.code(statusCode).send({ error: error.message });
      }
    }
  });

  // ==========================================
  // MONITORING ENDPOINTS
  // ==========================================

  // GET /api/v1/scheduler/metrics - Get scheduler metrics
  fastify.get('/api/v1/scheduler/metrics', {
    schema: {
      querystring: zodToJsonSchema(z.object({
        period: z.enum(['1h', '24h', '7d', '30d']).optional()
      })),
      response: {
        200: zodToJsonSchema(z.any())
      }
    },
    handler: async (request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const period = request.query.period || '24h';
        const now = new Date();
        let start: Date;

        switch (period) {
          case '1h':
            start = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '24h':
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        const metrics = await scheduler.getMetrics(start, now);
        reply.code(200).send(metrics);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/metrics] Failed', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // GET /api/v1/scheduler/health - Health check
  fastify.get('/api/v1/scheduler/health', {
    schema: {
      response: {
        200: zodToJsonSchema(z.any())
      }
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const health = await scheduler.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        reply.code(statusCode).send(health);
      } catch (error: any) {
        logger.error('[GET /api/v1/scheduler/health] Failed', { error: error.message });
        reply.code(503).send({
          status: 'unhealthy',
          error: error.message
        });
      }
    }
  });

  // GET /api/v1/scheduler/jobs/:id/stats - Get job statistics
  fastify.get('/api/v1/scheduler/jobs/:id/stats', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: zodToJsonSchema(z.any()),
        404: zodToJsonSchema(z.object({ error: z.string() }))
      }
    },
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> => {
      try {
        const stats = await scheduler.getJobStats(request.params.id);
        reply.code(200).send(stats);
      } catch (error: any) {
        const statusCode = error.message.includes('not found') ? 404 : 500;
        logger.error('[GET /api/v1/scheduler/jobs/:id/stats] Failed', { error: error.message });
        reply.code(statusCode).send({ error: error.message });
      }
    }
  });
}
```

### API Route Registration

Add to `packages/orchestrator/src/api/server.ts`:

```typescript
// Import scheduler routes
import { schedulerRoutes } from './routes/scheduler.routes';
import { SchedulerService } from '../services/scheduler.service';

// ... existing imports ...

// Register scheduler routes
await fastify.register(schedulerRoutes, {
  scheduler: new SchedulerService(prisma, messageBus)
});
```

---

## Message Bus Integration

### Job Dispatch Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Job Dispatch Flow                          │
└─────────────────────────────────────────────────────────────────┘

1. Scheduler Timer Tick (every minute)
   ↓
2. Query active jobs where next_run <= NOW()
   ↓
3. For each due job:
   ├─ Create JobExecution record (status: pending)
   ├─ Publish to Redis Stream: scheduler:job.dispatch
   └─ Update job.next_run to next occurrence
   ↓
4. Job Executor Worker (consuming from stream)
   ├─ Receives job dispatch message
   ├─ Update execution status: running
   ├─ Resolve handler (function, agent, workflow)
   ├─ Execute handler with timeout
   ├─ Capture result or error
   ├─ Update execution: success/failed + duration
   ├─ Update job statistics (executions_count, success_count, etc.)
   └─ ACK message in stream
   ↓
5. If failed and retries remain:
   ├─ Create new execution (retry_count + 1)
   └─ Schedule retry after retry_delay_ms
   ↓
6. Publish completion event:
   ├─ scheduler:job.completed (success)
   └─ scheduler:job.failed (failed)
```

### Event Types

**Published Events:**

| Event | Payload | Purpose |
|-------|---------|---------|
| `scheduler:job.created` | `{ job_id, job_name, type, schedule, next_run }` | Job created notification |
| `scheduler:job.updated` | `{ job_id, changes }` | Job modified notification |
| `scheduler:job.deleted` | `{ job_id, job_name }` | Job removed notification |
| `scheduler:job.paused` | `{ job_id, job_name }` | Job paused notification |
| `scheduler:job.resumed` | `{ job_id, job_name }` | Job resumed notification |
| `scheduler:job.cancelled` | `{ job_id, job_name }` | Job cancelled notification |
| `scheduler:job.dispatch` | `{ job_id, execution_id, handler_name, payload, timeout_ms }` | Dispatch job for execution |
| `scheduler:execution.started` | `{ job_id, execution_id, started_at }` | Execution started |
| `scheduler:execution.completed` | `{ job_id, execution_id, status, duration_ms, result }` | Execution finished |
| `scheduler:execution.failed` | `{ job_id, execution_id, error, will_retry }` | Execution failed |

**Consumed Events:**

Platform events can trigger job creation via event handlers:

| Event | Handler Action | Example |
|-------|---------------|---------|
| `workflow:completed` | Create follow-up job | Send notification 1 hour after workflow completion |
| `workflow:failed` | Create escalation job | Escalate to manager if not resolved in 24h |
| `ticket:created` | Create SLA enforcement job | Check ticket status after 48h, escalate if unresolved |
| `user:signup` | Create drip campaign | Send 7-day onboarding email sequence |
| `platform:created` | Create initialization jobs | Setup platform resources on schedule |

### Redis Streams Configuration

**Stream Names:**
- `stream:scheduler:job.dispatch` - Job execution queue (with consumer groups)
- `stream:scheduler:events` - Event-based triggers

**Consumer Groups:**
- `scheduler-workers` - Job execution workers
- `scheduler-monitors` - Health monitoring workers

---

## Handler System

### Handler Registry

**File:** `packages/orchestrator/src/services/job-handler-registry.service.ts`

```typescript
import { logger } from '../utils/logger';
import { AgentRegistryService } from './agent-registry.service';
import { WorkflowEngine } from './workflow.service';

/**
 * Job Handler Registry
 *
 * Manages registration and resolution of job handlers.
 *
 * Handler Types:
 * 1. Function handlers - Direct TypeScript functions
 * 2. Agent handlers - Dispatch to agents via AgentRegistry
 * 3. Workflow handlers - Trigger workflow via WorkflowEngine
 */
export class JobHandlerRegistry {
  private handlers = new Map<string, JobHandler>();

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly workflowEngine: WorkflowEngine
  ) {
    this.registerBuiltInHandlers();
  }

  // ==========================================
  // REGISTRATION METHODS
  // ==========================================

  /**
   * Register a function handler
   */
  registerHandler(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
    logger.info('[JobHandlerRegistry] Registered handler', { name });
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<string, JobHandler>): void {
    Object.entries(handlers).forEach(([name, handler]) => {
      this.registerHandler(name, handler);
    });
  }

  // ==========================================
  // RESOLUTION METHODS
  // ==========================================

  /**
   * Resolve handler by name and type
   */
  async resolveHandler(
    handlerName: string,
    handlerType: 'function' | 'agent' | 'workflow'
  ): Promise<JobHandler> {
    switch (handlerType) {
      case 'function':
        return this.resolveFunctionHandler(handlerName);

      case 'agent':
        return this.resolveAgentHandler(handlerName);

      case 'workflow':
        return this.resolveWorkflowHandler(handlerName);

      default:
        throw new Error(`Unknown handler type: ${handlerType}`);
    }
  }

  // ==========================================
  // PRIVATE RESOLVER METHODS
  // ==========================================

  private resolveFunctionHandler(name: string): JobHandler {
    const handler = this.handlers.get(name);

    if (!handler) {
      throw new Error(`Handler not found: ${name}. Available: ${Array.from(this.handlers.keys()).join(', ')}`);
    }

    return handler;
  }

  private resolveAgentHandler(agentType: string): JobHandler {
    return async (payload: any) => {
      logger.info('[JobHandlerRegistry] Dispatching to agent', { agentType, payload });

      // Dispatch task to agent via registry
      const result = await this.agentRegistry.dispatchTask({
        agent_type: agentType,
        payload,
        priority: 'medium',
        timeout_ms: 300000
      });

      return result;
    };
  }

  private resolveWorkflowHandler(workflowType: string): JobHandler {
    return async (payload: any) => {
      logger.info('[JobHandlerRegistry] Triggering workflow', { workflowType, payload });

      // Start workflow via engine
      const workflow = await this.workflowEngine.startWorkflow({
        type: workflowType,
        input_data: payload,
        priority: 'medium'
      });

      return { workflow_id: workflow.id };
    };
  }

  // ==========================================
  // BUILT-IN HANDLERS
  // ==========================================

  private registerBuiltInHandlers(): void {
    // Example: Reindex knowledge base
    this.registerHandler('reindex-knowledge-base', async (payload: any) => {
      const { collection_id } = payload;
      logger.info('[Handler:reindex-knowledge-base] Starting reindex', { collection_id });

      // TODO: Integrate with knowledge base service
      // await knowledgeBase.triggerReindex(collection_id);

      return { success: true, collection_id };
    });

    // Example: Cleanup old data
    this.registerHandler('cleanup-old-data', async (payload: any) => {
      const { retention_days = 90 } = payload;
      logger.info('[Handler:cleanup-old-data] Starting cleanup', { retention_days });

      // TODO: Implement cleanup logic
      // await cleanupService.deleteOldRecords(retention_days);

      return { success: true, retention_days };
    });

    // Example: Send notification
    this.registerHandler('send-notification', async (payload: any) => {
      const { recipient, message, channel = 'email' } = payload;
      logger.info('[Handler:send-notification] Sending notification', { recipient, channel });

      // TODO: Integrate with notification service
      // await notificationService.send(channel, recipient, message);

      return { success: true, recipient, channel };
    });

    // Example: Health check
    this.registerHandler('health-check', async (payload: any) => {
      logger.info('[Handler:health-check] Running health check', { payload });

      // TODO: Implement health check logic
      // const health = await systemHealth.check();

      return { success: true, timestamp: new Date() };
    });
  }
}

// ==========================================
// TYPES
// ==========================================

export type JobHandler = (payload: any) => Promise<any>;
```

### Handler Examples

```typescript
// Example 1: Reindex websites every 6 hours
scheduler.schedule({
  name: 'reindex-all-websites',
  schedule: '0 */6 * * *',
  handler_name: 'reindex-knowledge-base',
  handler_type: 'function',
  payload: { collection_id: 'all' },
  created_by: 'system'
});

// Example 2: Daily cleanup at 2 AM
scheduler.schedule({
  name: 'cleanup-old-executions',
  schedule: '0 2 * * *',
  timezone: 'America/New_York',
  handler_name: 'cleanup-old-data',
  handler_type: 'function',
  payload: { retention_days: 90 },
  created_by: 'system'
});

// Example 3: Dispatch to agent
scheduler.schedule({
  name: 'daily-report-generation',
  schedule: '0 9 * * *',
  handler_name: 'report-generator', // agent type
  handler_type: 'agent',
  payload: { report_type: 'daily' },
  platform_id: 'reporting-platform',
  created_by: 'system'
});

// Example 4: Trigger workflow
scheduler.schedule({
  name: 'weekly-backup',
  schedule: '0 0 * * 0', // Sundays at midnight
  handler_name: 'backup-workflow',
  handler_type: 'workflow',
  payload: { backup_type: 'full' },
  created_by: 'system'
});

// Example 5: Event-based job creation
scheduler.onEvent('workflow:completed', async (data) => {
  // Send notification 1 hour after workflow completion
  await scheduler.scheduleOnce({
    name: `notify-completion-${data.workflow_id}`,
    execute_at: new Date(Date.now() + 60 * 60 * 1000),
    handler_name: 'send-notification',
    handler_type: 'function',
    payload: {
      recipient: data.created_by,
      message: `Workflow ${data.workflow_id} completed successfully!`,
      channel: 'email'
    },
    created_by: 'system'
  });
});
```

---

## Monitoring & Observability

### Integration with Existing Monitoring System

The Scheduler integrates with your existing monitoring infrastructure:

**Alert Rules:**

```typescript
// Create alert rule for job failures
await prisma.alertRule.create({
  data: {
    name: 'scheduler-high-failure-rate',
    description: 'Alert when scheduler job failure rate exceeds 10%',
    enabled: true,
    severity: 'warning',
    condition: {
      metric: 'scheduler.failure_rate',
      operator: 'gt',
      value: 10,
      duration_ms: 300000 // 5 minutes
    },
    channels: ['dashboard', 'slack']
  }
});

// Create alert rule for execution timeouts
await prisma.alertRule.create({
  data: {
    name: 'scheduler-timeout-spike',
    description: 'Alert when execution timeouts spike',
    enabled: true,
    severity: 'critical',
    condition: {
      metric: 'scheduler.timeout_count',
      operator: 'gt',
      value: 5,
      duration_ms: 600000 // 10 minutes
    },
    channels: ['dashboard', 'slack', 'email']
  }
});
```

**Dashboard Metrics:**

The scheduler exposes metrics for the existing monitoring dashboard:

| Metric | Type | Description |
|--------|------|-------------|
| `scheduler.jobs.total` | Gauge | Total number of scheduled jobs |
| `scheduler.jobs.active` | Gauge | Number of active jobs |
| `scheduler.jobs.failed` | Gauge | Number of failed jobs |
| `scheduler.executions.rate` | Counter | Job executions per minute |
| `scheduler.executions.success_rate` | Gauge | Percentage of successful executions |
| `scheduler.executions.duration_p95` | Histogram | 95th percentile execution duration |
| `scheduler.queue.size` | Gauge | Number of pending executions |
| `scheduler.queue.processing` | Gauge | Number of running executions |

**Distributed Tracing:**

All job executions include trace context:

```typescript
// Create execution with trace context
const execution = await prisma.jobExecution.create({
  data: {
    job_id: job.id,
    status: 'pending',
    scheduled_at: new Date(),
    trace_id: generateTraceId(),
    span_id: generateSpanId(),
    parent_span_id: job.metadata?.parent_span_id
  }
});

// Execution creates span in trace
logger.info('[Execution] Starting job execution', {
  trace_id: execution.trace_id,
  span_id: execution.span_id,
  job_id: job.id,
  handler_name: job.handler_name
});
```

**Health Checks:**

The scheduler health check integrates with the platform health monitoring:

```bash
# Platform health check includes scheduler
GET /api/v1/health

{
  "status": "healthy",
  "components": {
    "orchestrator": { "status": "up" },
    "database": { "status": "up", "latency_ms": 15 },
    "cache": { "status": "up" },
    "scheduler": {  # NEW
      "status": "up",
      "active_jobs": 42,
      "pending_executions": 5,
      "queue_health": "healthy"
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Database schema and core service implementation

- [ ] **Day 1-2: Database Schema**
  - Create Prisma migration for scheduler tables
  - Add ScheduledJob, JobExecution, JobExecutionLog, EventHandler models
  - Generate Prisma client
  - Test migrations in dev environment

- [ ] **Day 3-5: Core Service**
  - Implement IScheduler port interface
  - Implement SchedulerService with schedule(), scheduleOnce(), scheduleRecurring()
  - Implement cron expression validation (cron-parser library)
  - Implement next run calculation logic
  - Write unit tests for scheduling logic

**Deliverables:**
- ✅ Database schema migration complete
- ✅ SchedulerService passing unit tests (>80% coverage)
- ✅ Job creation working (cron, one-time, recurring)

### Phase 2: Job Execution Engine (Week 2)
**Goal:** Worker process that executes scheduled jobs

- [ ] **Day 1-2: Job Executor Service**
  - Implement JobExecutorService
  - Implement handler resolution (function, agent, workflow)
  - Implement timeout handling
  - Implement retry logic with exponential backoff
  - Implement execution tracking (start, complete, fail)

- [ ] **Day 3: Job Handler Registry**
  - Implement JobHandlerRegistry
  - Register built-in handlers (reindex, cleanup, notification)
  - Implement agent handler dispatcher
  - Implement workflow handler trigger

- [ ] **Day 4-5: Scheduler Worker**
  - Implement timer-based job dispatcher (runs every minute)
  - Query due jobs (next_run <= NOW())
  - Dispatch to Redis Stream
  - Update next_run for recurring jobs
  - Write integration tests

**Deliverables:**
- ✅ Job executor service working
- ✅ Handler registry with 3+ built-in handlers
- ✅ Timer-based dispatcher running
- ✅ Jobs executing on schedule

### Phase 3: Message Bus Integration (Week 3)
**Goal:** Redis Streams queue and event-driven triggers

- [ ] **Day 1-2: Redis Streams Queue**
  - Configure consumer group: scheduler-workers
  - Implement stream consumer in job executor
  - Implement ACK-based reliability
  - Handle failed message retries (pending entries list)
  - Test queue durability (restart workers, verify execution)

- [ ] **Day 3-4: Event-Based Triggers**
  - Implement onEvent() registration
  - Store event handlers in database
  - Subscribe to platform events via message bus
  - Implement event handler execution
  - Test workflow:completed → notification job creation

- [ ] **Day 5: Error Handling**
  - Implement dead letter queue for failed jobs
  - Implement execution logging to JobExecutionLog
  - Implement error tracking and statistics
  - Test retry exhaustion and failure patterns

**Deliverables:**
- ✅ Redis Streams queue operational
- ✅ Event-based job creation working
- ✅ Error handling comprehensive
- ✅ Dead letter queue configured

### Phase 4: API Routes (Week 4)
**Goal:** REST API for job management

- [ ] **Day 1-2: Job Management Routes**
  - POST /api/v1/scheduler/jobs/cron
  - POST /api/v1/scheduler/jobs/once
  - POST /api/v1/scheduler/jobs/recurring
  - GET /api/v1/scheduler/jobs (list with filters)
  - GET /api/v1/scheduler/jobs/:id
  - PUT /api/v1/scheduler/jobs/:id/reschedule
  - DELETE /api/v1/scheduler/jobs/:id

- [ ] **Day 3: Job Control Routes**
  - POST /api/v1/scheduler/jobs/:id/pause
  - POST /api/v1/scheduler/jobs/:id/resume
  - GET /api/v1/scheduler/jobs/:id/executions
  - GET /api/v1/scheduler/executions/:id
  - POST /api/v1/scheduler/executions/:id/retry

- [ ] **Day 4-5: Monitoring Routes**
  - GET /api/v1/scheduler/metrics
  - GET /api/v1/scheduler/health
  - GET /api/v1/scheduler/jobs/:id/stats
  - Write API integration tests (>90% coverage)

**Deliverables:**
- ✅ Full CRUD API for jobs
- ✅ Execution history API
- ✅ Monitoring endpoints
- ✅ API tests passing

### Phase 5: Monitoring Integration (Week 5)
**Goal:** Integration with existing monitoring system

- [ ] **Day 1-2: Metrics Collection**
  - Implement getMetrics() with time-series aggregation
  - Implement getJobStats() with failure pattern analysis
  - Add scheduler metrics to platform health check
  - Create Grafana dashboard (optional)

- [ ] **Day 3: Alert Rules**
  - Create AlertRule for high failure rate
  - Create AlertRule for timeout spikes
  - Create AlertRule for queue size growth
  - Test alert triggering and resolution

- [ ] **Day 4-5: Distributed Tracing**
  - Add trace_id propagation to job executions
  - Integrate with existing trace visualization
  - Test trace continuity (workflow → job → agent)
  - Update TraceDetailPage to show scheduled jobs

**Deliverables:**
- ✅ Metrics dashboard operational
- ✅ Alert rules triggering correctly
- ✅ Distributed tracing working
- ✅ Scheduler visible in monitoring UI

### Phase 6: Platform Integration & Use Cases (Week 6)
**Goal:** Real-world use cases and platform integration

- [ ] **Day 1-2: Knowledge Base Integration**
  - Register reindex-knowledge-base handler
  - Create cron job for hourly reindexing
  - Test reindex execution and completion
  - Monitor reindex performance

- [ ] **Day 3: Workflow Integration**
  - Create event handler: workflow:completed → notification
  - Create event handler: workflow:failed → escalation
  - Test event-driven job creation
  - Verify notification delivery

- [ ] **Day 4: Platform Lifecycle Jobs**
  - Create platform initialization jobs
  - Create daily cleanup jobs
  - Create weekly backup jobs
  - Test platform-scoped job isolation

- [ ] **Day 5: Documentation & Examples**
  - Update SCHEDULER_ARCHITECTURE.md with implementation notes
  - Create SCHEDULER_USAGE_GUIDE.md with examples
  - Document all handler types
  - Create example job definitions

**Deliverables:**
- ✅ 3+ real-world use cases working
- ✅ Platform lifecycle jobs operational
- ✅ Documentation complete
- ✅ Example code reviewed

### Phase 7: Testing & Optimization (Week 7)
**Goal:** Production readiness

- [ ] **Day 1-2: End-to-End Testing**
  - Test full job lifecycle (create → execute → complete)
  - Test retry logic and failure recovery
  - Test concurrent job execution
  - Test platform isolation (multi-tenancy)
  - Load test with 100+ concurrent jobs

- [ ] **Day 3: Performance Optimization**
  - Add database indexes for query performance
  - Optimize next_run calculation for large job counts
  - Implement job batching for Redis Streams
  - Profile and optimize hot paths

- [ ] **Day 4: Security Audit**
  - Validate platform_id isolation
  - Audit handler access control
  - Review error message sanitization
  - Test malicious payload handling

- [ ] **Day 5: Production Deployment**
  - Update ./dev start script to include scheduler worker
  - Create Terraform configuration for scheduler
  - Deploy to staging environment
  - Run smoke tests
  - Deploy to production

**Deliverables:**
- ✅ All tests passing (unit + integration + E2E)
- ✅ Performance benchmarks met
- ✅ Security audit complete
- ✅ Production deployment successful

---

## Use Cases

### Use Case 1: Knowledge Base Reindexing

**Requirement:** Keep chatbot knowledge base current by reindexing customer websites every 6 hours

**Implementation:**

```typescript
// Register reindex handler
handlerRegistry.registerHandler('reindex-collection', async (payload: any) => {
  const { collection_id } = payload;

  logger.info('[Handler:reindex-collection] Starting reindex', { collection_id });

  // Trigger reindex via knowledge base service
  const result = await knowledgeBase.triggerReindex(collection_id);

  logger.info('[Handler:reindex-collection] Completed', {
    collection_id,
    documents_indexed: result.count,
    duration_ms: result.duration_ms
  });

  return result;
});

// Create cron job
const job = await scheduler.schedule({
  name: 'reindex-mario-pizza-website',
  schedule: '0 */6 * * *', // Every 6 hours
  timezone: 'UTC',
  handler_name: 'reindex-collection',
  handler_type: 'function',
  payload: {
    collection_id: 'mario_pizza_website'
  },
  timeout_ms: 900000, // 15 minutes
  max_retries: 2,
  tags: ['reindex', 'knowledge-base'],
  platform_id: 'chatbot-platform',
  created_by: 'system'
});

console.log(`Created job: ${job.id}, next run: ${job.next_run}`);
```

**Monitoring:**

```typescript
// Get job statistics
const stats = await scheduler.getJobStats(job.id);
console.log(`Success rate: ${stats.success_rate}%`);
console.log(`Avg duration: ${stats.avg_duration_ms}ms`);
console.log(`Last execution: ${stats.last_execution?.status}`);

// Get execution history
const history = await scheduler.getJobHistory(job.id, { limit: 10 });
history.forEach(exec => {
  console.log(`${exec.started_at}: ${exec.status} (${exec.duration_ms}ms)`);
});
```

### Use Case 2: SLA Enforcement - Ticket Escalation

**Requirement:** Escalate tickets to manager if not resolved within 48 hours

**Implementation:**

```typescript
// Register event handler for ticket creation
await scheduler.onEvent('ticket:created', async (data: any) => {
  const { ticket_id, priority, created_by } = data;

  logger.info('[EventHandler:ticket:created] Creating escalation job', {
    ticket_id,
    priority
  });

  // Create one-time job to check ticket status in 48 hours
  await scheduler.scheduleOnce({
    name: `escalate-ticket-${ticket_id}`,
    execute_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    handler_name: 'check-and-escalate-ticket',
    handler_type: 'function',
    payload: {
      ticket_id,
      priority,
      created_by,
      sla_hours: 48
    },
    tags: ['escalation', 'sla'],
    platform_id: 'support-platform',
    created_by: 'system'
  });
});

// Register escalation handler
handlerRegistry.registerHandler('check-and-escalate-ticket', async (payload: any) => {
  const { ticket_id, priority, created_by, sla_hours } = payload;

  logger.info('[Handler:check-and-escalate-ticket] Checking ticket', { ticket_id });

  // Get current ticket status
  const ticket = await ticketService.getTicket(ticket_id);

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    logger.info('[Handler:check-and-escalate-ticket] Ticket already resolved', {
      ticket_id,
      status: ticket.status
    });
    return { action: 'none', reason: 'already_resolved' };
  }

  // Escalate ticket
  await ticketService.escalateToManager(ticket_id, {
    reason: `Ticket unresolved after ${sla_hours} hours (SLA breach)`,
    original_assignee: created_by,
    priority
  });

  // Send notification
  await notificationService.send('slack', '#support-escalations', {
    message: `⚠️ Ticket ${ticket_id} escalated (SLA: ${sla_hours}h)`,
    ticket_url: `https://support.example.com/tickets/${ticket_id}`
  });

  logger.info('[Handler:check-and-escalate-ticket] Escalated', {
    ticket_id,
    sla_hours
  });

  return { action: 'escalated', ticket_id };
});

// If ticket is resolved before 48h, cancel the escalation job
await scheduler.onEvent('ticket:resolved', async (data: any) => {
  const { ticket_id } = data;

  // Find and cancel escalation job
  const jobs = await scheduler.listJobs({
    name_contains: `escalate-ticket-${ticket_id}`,
    status: 'active'
  });

  if (jobs.length > 0) {
    await scheduler.cancelJob(jobs[0].id);
    logger.info('[EventHandler:ticket:resolved] Cancelled escalation job', {
      ticket_id,
      job_id: jobs[0].id
    });
  }
});
```

### Use Case 3: Marketing Drip Campaign

**Requirement:** Send 7-day onboarding email sequence to new users

**Implementation:**

```typescript
// Register event handler for user signup
await scheduler.onEvent('user:signup', async (data: any) => {
  const { user_id, user_email, timezone = 'America/New_York' } = data;

  logger.info('[EventHandler:user:signup] Creating drip campaign', {
    user_id,
    user_email
  });

  // Calculate start date (tomorrow at 10 AM in user timezone)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(10, 0, 0, 0);

  // Create recurring job for 7-day sequence
  await scheduler.scheduleRecurring({
    name: `onboarding-drip-${user_id}`,
    schedule: '0 10 * * *', // Daily at 10 AM
    timezone,
    start_date: startDate,
    max_executions: 7, // 7 emails
    handler_name: 'send-drip-email',
    handler_type: 'function',
    payload: {
      user_id,
      user_email,
      campaign: 'onboarding'
    },
    tags: ['drip', 'onboarding'],
    platform_id: 'marketing-platform',
    created_by: 'system'
  });

  logger.info('[EventHandler:user:signup] Drip campaign created', {
    user_id,
    start_date: startDate
  });
});

// Register drip email handler
handlerRegistry.registerHandler('send-drip-email', async (payload: any) => {
  const { user_id, user_email, campaign } = payload;

  // Get execution count to determine which email to send (day 1-7)
  const job = await scheduler.listJobs({
    name_contains: `onboarding-drip-${user_id}`,
    status: 'active'
  });

  const dayNumber = job[0]?.executions_count + 1 || 1;

  logger.info('[Handler:send-drip-email] Sending email', {
    user_id,
    campaign,
    day: dayNumber
  });

  // Send email for this day
  await emailService.send({
    to: user_email,
    template: `onboarding-day-${dayNumber}`,
    data: {
      user_id,
      day: dayNumber,
      total_days: 7
    }
  });

  // Track email sent
  await analytics.track({
    event: 'drip_email_sent',
    user_id,
    properties: {
      campaign,
      day: dayNumber,
      email: user_email
    }
  });

  return {
    success: true,
    day: dayNumber,
    user_id
  };
});
```

### Use Case 4: Daily System Maintenance

**Requirement:** Clean up old data daily to manage storage

**Implementation:**

```typescript
// Create daily cleanup job
const cleanupJob = await scheduler.schedule({
  name: 'daily-cleanup',
  schedule: '0 2 * * *', // Daily at 2 AM UTC
  timezone: 'UTC',
  handler_name: 'cleanup-old-data',
  handler_type: 'function',
  payload: {
    retention_days: 90
  },
  timeout_ms: 1800000, // 30 minutes
  max_retries: 1,
  tags: ['maintenance', 'cleanup'],
  created_by: 'system'
});

// Register cleanup handler
handlerRegistry.registerHandler('cleanup-old-data', async (payload: any) => {
  const { retention_days } = payload;
  const cutoffDate = new Date(Date.now() - retention_days * 24 * 60 * 60 * 1000);

  logger.info('[Handler:cleanup-old-data] Starting cleanup', {
    retention_days,
    cutoff_date: cutoffDate
  });

  const results: any = {};

  // 1. Clean up old job executions (keep failed for 30 days, success for 7 days)
  const successCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const deletedExecutions = await prisma.jobExecution.deleteMany({
    where: {
      OR: [
        { status: 'success', completed_at: { lt: successCutoff } },
        { status: 'failed', completed_at: { lt: failedCutoff } }
      ]
    }
  });
  results.job_executions = deletedExecutions.count;

  // 2. Clean up old workflow events
  const deletedEvents = await prisma.workflowEvent.deleteMany({
    where: {
      timestamp: { lt: cutoffDate }
    }
  });
  results.workflow_events = deletedEvents.count;

  // 3. Clean up completed one-time jobs
  const deletedJobs = await prisma.scheduledJob.deleteMany({
    where: {
      type: 'one_time',
      status: 'completed',
      completed_at: { lt: cutoffDate }
    }
  });
  results.one_time_jobs = deletedJobs.count;

  // 4. Vacuum database (PostgreSQL specific)
  await prisma.$executeRaw`VACUUM ANALYZE`;

  logger.info('[Handler:cleanup-old-data] Cleanup complete', {
    retention_days,
    results
  });

  return results;
});
```

---

## Summary

This scheduler architecture seamlessly integrates with your Agentic SDLC platform by:

✅ **Following Existing Patterns**
- Hexagonal architecture (ports/adapters)
- Platform-scoped multi-tenancy
- Redis Streams for reliability
- Prisma ORM for persistence
- Zod validation schemas

✅ **Leveraging Platform Components**
- Message bus for event-driven triggers
- Agent registry for job execution
- Workflow engine for orchestration
- Monitoring system for observability
- Distributed tracing for debugging

✅ **Providing Rich Functionality**
- Time-based scheduling (cron, one-time, recurring)
- Event-based scheduling (workflow events, ticket events)
- Flexible handler system (functions, agents, workflows)
- Comprehensive monitoring (metrics, health, statistics)
- Full REST API for management

✅ **Production Ready**
- Automatic retries with exponential backoff
- Timeout handling and cancellation
- Dead letter queue for failed jobs
- Execution history and logging
- Alert integration for failures

**Next Steps:**
1. Review this architecture document
2. Approve implementation plan
3. Start Phase 1 (Database schema)
4. Iterate through implementation phases
5. Deploy to production

The scheduler is designed to be a foundational component that enables all your products (chatbot, email, social media, support, etc.) to have reliable, scheduled background tasks.