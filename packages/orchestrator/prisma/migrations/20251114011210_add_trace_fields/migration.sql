-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN     "parent_span_id" TEXT,
ADD COLUMN     "span_id" TEXT,
ADD COLUMN     "trace_id" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "current_span_id" TEXT,
ADD COLUMN     "trace_id" TEXT;

-- CreateIndex
CREATE INDEX "AgentTask_trace_id_idx" ON "AgentTask"("trace_id");

-- CreateIndex
CREATE INDEX "Workflow_trace_id_idx" ON "Workflow"("trace_id");
