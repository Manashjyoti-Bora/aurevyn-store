-- Autonomous team: one row per cycle, one row per agent briefing.
-- Read-only with respect to business records; safe to apply at deploy time.

CREATE TABLE "team_cycles" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "agentCount" INTEGER NOT NULL,
    "actionCount" INTEGER NOT NULL,
    "watchCount" INTEGER NOT NULL,
    "clearCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_briefings" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "priorities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_briefings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_briefings_cycleId_agentId_key" ON "team_briefings"("cycleId", "agentId");
CREATE INDEX "team_briefings_agentId_createdAt_idx" ON "team_briefings"("agentId", "createdAt");
CREATE INDEX "team_cycles_createdAt_idx" ON "team_cycles"("createdAt");

ALTER TABLE "team_briefings" ADD CONSTRAINT "team_briefings_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "team_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
