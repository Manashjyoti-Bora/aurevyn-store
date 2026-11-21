import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { buildTeamBriefings } from './briefings';
import { loadTeamSignals } from './signals';
import { TEAM_ROSTER } from './roster';
import type { AgentBriefing, AgentStatus, TeamSignals } from './types';

/**
 * The team's cycle runner.
 *
 * A cycle reads the store once, asks every agent for a briefing, and stores the
 * result. Storing matters: the owner can see what each agent thought at 03:00
 * and whether the situation changed since. Nothing in a cycle mutates business
 * records — publishing, pricing, refunds and customer replies remain owner
 * actions, which is why the team cannot quietly damage the store.
 */

export interface TeamCycleResult {
  cycleId: string;
  trigger: 'CRON' | 'OWNER';
  createdAt: string;
  counts: Record<AgentStatus, number>;
  briefings: AgentBriefing[];
  durationMs: number;
}

function countStatuses(briefings: AgentBriefing[]): Record<AgentStatus, number> {
  return briefings.reduce<Record<AgentStatus, number>>(
    (acc, briefing) => {
      acc[briefing.status] += 1;
      return acc;
    },
    { CLEAR: 0, WATCH: 0, ACT: 0 }
  );
}

export async function runTeamCycle(params: {
  trigger: 'CRON' | 'OWNER';
  now?: Date;
}): Promise<TeamCycleResult> {
  const startedAt = Date.now();
  const now = params.now ?? new Date();

  const signals = await loadTeamSignals(now);
  const briefings = buildTeamBriefings(signals);
  const counts = countStatuses(briefings);

  const cycle = await prisma.teamCycle.create({
    data: {
      trigger: params.trigger,
      agentCount: briefings.length,
      actionCount: counts.ACT,
      watchCount: counts.WATCH,
      clearCount: counts.CLEAR,
      durationMs: Date.now() - startedAt,
      briefings: {
        create: briefings.map((briefing) => ({
          agentId: briefing.agentId,
          agentName: TEAM_ROSTER.find((a) => a.id === briefing.agentId)?.name ?? briefing.agentId,
          status: briefing.status,
          headline: briefing.headline,
          summary: briefing.summary,
          findings: briefing.findings as unknown as Prisma.InputJsonValue,
          priorities: briefing.priorities as unknown as Prisma.InputJsonValue,
        })),
      },
    },
    select: { id: true, createdAt: true },
  });

  logger.info('Team cycle completed', {
    cycleId: cycle.id,
    trigger: params.trigger,
    counts,
    durationMs: Date.now() - startedAt,
  });

  return {
    cycleId: cycle.id,
    trigger: params.trigger,
    createdAt: cycle.createdAt.toISOString(),
    counts,
    briefings,
    durationMs: Date.now() - startedAt,
  };
}

export interface TeamCycleSummaryRow {
  id: string;
  trigger: string;
  createdAt: string;
  counts: Record<AgentStatus, number>;
  durationMs: number;
}

/** Recent cycles, newest first — the team's own work log. */
export async function getRecentTeamCycles(take = 8): Promise<TeamCycleSummaryRow[]> {
  const rows = await prisma.teamCycle.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(take, 1), 50),
    select: {
      id: true,
      trigger: true,
      createdAt: true,
      actionCount: true,
      watchCount: true,
      clearCount: true,
      durationMs: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    trigger: row.trigger,
    createdAt: row.createdAt.toISOString(),
    counts: { ACT: row.actionCount, WATCH: row.watchCount, CLEAR: row.clearCount },
    durationMs: row.durationMs,
  }));
}

/** Live board for the admin console: fresh briefings plus the cycle log. */
export async function getTeamBoard(now: Date = new Date()): Promise<{
  signals: TeamSignals;
  briefings: AgentBriefing[];
  counts: Record<AgentStatus, number>;
  cycles: TeamCycleSummaryRow[];
}> {
  const [signals, cycles] = await Promise.all([loadTeamSignals(now), getRecentTeamCycles()]);
  const briefings = buildTeamBriefings(signals);
  return { signals, briefings, counts: countStatuses(briefings), cycles };
}
