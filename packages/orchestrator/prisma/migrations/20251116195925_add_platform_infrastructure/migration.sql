-- CreateEnum
CREATE TYPE "PlatformLayer" AS ENUM ('APPLICATION', 'DATA', 'INFRASTRUCTURE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SurfaceType" AS ENUM ('REST', 'WEBHOOK', 'CLI', 'DASHBOARD', 'MOBILE_API');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "platform_id" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "input_data" JSONB,
ADD COLUMN     "layer" TEXT,
ADD COLUMN     "platform_id" TEXT,
ADD COLUMN     "surface_id" TEXT,
ADD COLUMN     "workflow_definition_id" TEXT;

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layer" "PlatformLayer" NOT NULL,
    "description" TEXT,
    "config" JSONB DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSurface" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "surface_type" "SurfaceType" NOT NULL,
    "config" JSONB DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSurface_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Platform_name_key" ON "Platform"("name");

-- CreateIndex
CREATE INDEX "Platform_layer_idx" ON "Platform"("layer");

-- CreateIndex
CREATE INDEX "Platform_enabled_idx" ON "Platform"("enabled");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_platform_id_idx" ON "WorkflowDefinition"("platform_id");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_enabled_idx" ON "WorkflowDefinition"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_platform_id_name_key" ON "WorkflowDefinition"("platform_id", "name");

-- CreateIndex
CREATE INDEX "PlatformSurface_platform_id_idx" ON "PlatformSurface"("platform_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSurface_platform_id_surface_type_key" ON "PlatformSurface"("platform_id", "surface_type");

-- CreateIndex
CREATE INDEX "Agent_platform_id_idx" ON "Agent"("platform_id");

-- CreateIndex
CREATE INDEX "Workflow_platform_id_idx" ON "Workflow"("platform_id");

-- CreateIndex
CREATE INDEX "Workflow_workflow_definition_id_idx" ON "Workflow"("workflow_definition_id");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSurface" ADD CONSTRAINT "PlatformSurface_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
