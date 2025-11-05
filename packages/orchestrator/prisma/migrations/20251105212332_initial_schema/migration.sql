-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('app', 'feature', 'bugfix');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('initiated', 'running', 'paused', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('scaffold', 'validation', 'e2e_test', 'integration', 'deployment', 'monitoring', 'debug', 'recovery');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('online', 'busy', 'offline', 'error');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirements" TEXT,
    "status" "WorkflowStatus" NOT NULL,
    "current_stage" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "agent_id" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "timeout_ms" INTEGER NOT NULL DEFAULT 300000,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" TEXT NOT NULL,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" TEXT[],
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workflow_status_idx" ON "Workflow"("status");

-- CreateIndex
CREATE INDEX "Workflow_created_at_idx" ON "Workflow"("created_at");

-- CreateIndex
CREATE INDEX "WorkflowStage_workflow_id_idx" ON "WorkflowStage"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_task_id_key" ON "AgentTask"("task_id");

-- CreateIndex
CREATE INDEX "AgentTask_workflow_id_idx" ON "AgentTask"("workflow_id");

-- CreateIndex
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");

-- CreateIndex
CREATE INDEX "AgentTask_agent_type_idx" ON "AgentTask"("agent_type");

-- CreateIndex
CREATE INDEX "WorkflowEvent_workflow_id_idx" ON "WorkflowEvent"("workflow_id");

-- CreateIndex
CREATE INDEX "WorkflowEvent_timestamp_idx" ON "WorkflowEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_agent_id_key" ON "Agent"("agent_id");

-- CreateIndex
CREATE INDEX "Agent_type_idx" ON "Agent"("type");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- AddForeignKey
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
