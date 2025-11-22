-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('cron', 'one_time', 'recurring', 'event');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'timeout', 'cancelled', 'skipped');

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "schedule" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "next_run" TIMESTAMP(3),
    "last_run" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "max_executions" INTEGER,
    "handler_name" TEXT NOT NULL,
    "handler_type" TEXT NOT NULL DEFAULT 'function',
    "payload" JSONB,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_ms" INTEGER NOT NULL DEFAULT 60000,
    "timeout_ms" INTEGER NOT NULL DEFAULT 300000,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "allow_overlap" BOOLEAN NOT NULL DEFAULT false,
    "executions_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_ms" INTEGER,
    "tags" TEXT[],
    "metadata" JSONB,
    "platform_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExecution" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "error_stack" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "worker_id" TEXT,
    "metadata" JSONB,
    "trace_id" TEXT,
    "span_id" TEXT,
    "parent_span_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExecutionLog" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,

    CONSTRAINT "JobExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventHandler" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "handler_name" TEXT NOT NULL,
    "handler_type" TEXT NOT NULL DEFAULT 'function',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "action_type" TEXT,
    "action_config" JSONB,
    "platform_id" TEXT,
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_triggered" TIMESTAMP(3),

    CONSTRAINT "EventHandler_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledJob_status_idx" ON "ScheduledJob"("status");

-- CreateIndex
CREATE INDEX "ScheduledJob_type_idx" ON "ScheduledJob"("type");

-- CreateIndex
CREATE INDEX "ScheduledJob_next_run_idx" ON "ScheduledJob"("next_run");

-- CreateIndex
CREATE INDEX "ScheduledJob_platform_id_idx" ON "ScheduledJob"("platform_id");

-- CreateIndex
CREATE INDEX "ScheduledJob_handler_name_idx" ON "ScheduledJob"("handler_name");

-- CreateIndex
CREATE INDEX "ScheduledJob_created_at_idx" ON "ScheduledJob"("created_at");

-- CreateIndex
CREATE INDEX "ScheduledJob_tags_idx" ON "ScheduledJob"("tags");

-- CreateIndex
CREATE INDEX "JobExecution_job_id_idx" ON "JobExecution"("job_id");

-- CreateIndex
CREATE INDEX "JobExecution_status_idx" ON "JobExecution"("status");

-- CreateIndex
CREATE INDEX "JobExecution_started_at_idx" ON "JobExecution"("started_at");

-- CreateIndex
CREATE INDEX "JobExecution_scheduled_at_idx" ON "JobExecution"("scheduled_at");

-- CreateIndex
CREATE INDEX "JobExecution_trace_id_idx" ON "JobExecution"("trace_id");

-- CreateIndex
CREATE INDEX "JobExecution_created_at_idx" ON "JobExecution"("created_at");

-- CreateIndex
CREATE INDEX "JobExecutionLog_execution_id_timestamp_idx" ON "JobExecutionLog"("execution_id", "timestamp");

-- CreateIndex
CREATE INDEX "JobExecutionLog_level_idx" ON "JobExecutionLog"("level");

-- CreateIndex
CREATE INDEX "EventHandler_event_name_idx" ON "EventHandler"("event_name");

-- CreateIndex
CREATE INDEX "EventHandler_enabled_idx" ON "EventHandler"("enabled");

-- CreateIndex
CREATE INDEX "EventHandler_platform_id_idx" ON "EventHandler"("platform_id");

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExecution" ADD CONSTRAINT "JobExecution_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ScheduledJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExecutionLog" ADD CONSTRAINT "JobExecutionLog_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "JobExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHandler" ADD CONSTRAINT "EventHandler_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
