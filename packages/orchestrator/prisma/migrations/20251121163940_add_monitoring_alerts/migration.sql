-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "AlertStatusType" AS ENUM ('triggered', 'acknowledged', 'resolved');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "AlertSeverity" NOT NULL,
    "condition" JSONB NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['dashboard']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "AlertStatusType" NOT NULL DEFAULT 'triggered',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_name_key" ON "AlertRule"("name");

-- CreateIndex
CREATE INDEX "AlertRule_enabled_idx" ON "AlertRule"("enabled");

-- CreateIndex
CREATE INDEX "AlertRule_severity_idx" ON "AlertRule"("severity");

-- CreateIndex
CREATE INDEX "Alert_rule_id_idx" ON "Alert"("rule_id");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_created_at_idx" ON "Alert"("created_at");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
