-- CreateTable for PipelineExecution
CREATE TABLE "PipelineExecution" (
    "id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'initiated',
    "current_stage" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PipelineExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for workflow_id (foreign key lookup)
CREATE INDEX "PipelineExecution_workflow_id_idx" ON "PipelineExecution"("workflow_id");

-- CreateIndex for status (common filtering)
CREATE INDEX "PipelineExecution_status_idx" ON "PipelineExecution"("status");

-- CreateIndex for created_at (common sorting)
CREATE INDEX "PipelineExecution_created_at_idx" ON "PipelineExecution"("created_at");

-- AddForeignKey to Workflow
ALTER TABLE "PipelineExecution" ADD CONSTRAINT "PipelineExecution_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
