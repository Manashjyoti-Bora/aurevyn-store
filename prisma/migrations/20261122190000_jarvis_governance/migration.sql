-- Jarvis governance: sourced knowledge entries and incident records.
-- Additive only. No existing table or enum is altered.

CREATE TYPE "KnowledgeSource" AS ENUM ('OFFICIAL', 'PRIMARY', 'SECONDARY', 'OWNER_SUPPLIED');
CREATE TYPE "KnowledgeConfidence" AS ENUM ('VERIFIED', 'ESTIMATE', 'ASSUMPTION', 'RECOMMENDATION');
CREATE TYPE "KnowledgeStatus" AS ENUM ('CURRENT', 'OUTDATED', 'ARCHIVED');
CREATE TYPE "JarvisIncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');
CREATE TYPE "JarvisIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceType" "KnowledgeSource" NOT NULL DEFAULT 'OWNER_SUPPLIED',
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "publishedAt" DATE,
    "verifiedAt" DATE,
    "verifiedBy" TEXT,
    "reviewBy" DATE,
    "confidence" "KnowledgeConfidence" NOT NULL DEFAULT 'ASSUMPTION',
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'CURRENT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_entries_slug_key" ON "knowledge_entries"("slug");
CREATE INDEX "knowledge_entries_category_status_idx" ON "knowledge_entries"("category", "status");
CREATE INDEX "knowledge_entries_reviewBy_idx" ON "knowledge_entries"("reviewBy");
CREATE INDEX "knowledge_entries_confidence_idx" ON "knowledge_entries"("confidence");

CREATE TABLE "jarvis_incidents" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" "JarvisIncidentSeverity" NOT NULL,
    "status" "JarvisIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "service" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "detectionSource" TEXT NOT NULL,
    "evidence" JSONB,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "followUp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jarvis_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jarvis_incidents_reference_key" ON "jarvis_incidents"("reference");
CREATE UNIQUE INDEX "jarvis_incidents_fingerprint_key" ON "jarvis_incidents"("fingerprint");
CREATE INDEX "jarvis_incidents_status_severity_idx" ON "jarvis_incidents"("status", "severity");
CREATE INDEX "jarvis_incidents_detectedAt_idx" ON "jarvis_incidents"("detectedAt");
