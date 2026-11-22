/**
 * Incident management (blueprint V3 §15).
 *
 * Detection is evidence-driven: each scan records the counts it saw, the time
 * it looked and the source. Duplicate detections merge into one incident via a
 * stable fingerprint, so a persistent failure is one incident with an
 * occurrence count — not a new row every scan.
 *
 * A resolved incident is never reopened automatically; if the signal returns,
 * the owner decides whether a new incident is warranted.
 */

import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { auditLog } from '../audit';
import { logger } from '../logger';

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  SEV1: 'SEV1 — critical, customers affected',
  SEV2: 'SEV2 — major, fulfilment or money at risk',
  SEV3: 'SEV3 — degraded, workaround exists',
  SEV4: 'SEV4 — minor / informational',
};

export interface IncidentSignal {
  /** Stable identity for de-duplication. */
  fingerprint: string;
  service: string;
  title: string;
  detail: string;
  severity: IncidentSeverity;
  detectionSource: string;
  evidence: Record<string, unknown>;
}

export function incidentReference(at: Date, token: string = randomUUID()): string {
  const day = at.toISOString().slice(0, 10).replace(/-/g, '');
  return `INC-${day}-${token.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}`;
}

export function incidentFingerprint(service: string, code: string): string {
  return `${service.toLowerCase()}:${code.toLowerCase()}`;
}

export function severityRank(severity: IncidentSeverity): number {
  return Number(severity.slice(3));
}

export function sortIncidents<T extends { severity: IncidentSeverity; detectedAt: Date | string }>(
  incidents: readonly T[]
): T[] {
  return [...incidents].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}

const DAY_MS = 86_400_000;

/** Read live signals. Thresholds are deliberate: one failed job is not an incident. */
export async function collectIncidentSignals(now: Date = new Date()): Promise<IncidentSignal[]> {
  const since24h = new Date(now.getTime() - DAY_MS);
  const staleBefore = new Date(now.getTime() - 30 * 60_000);

  const [failedJobs, staleJob, failedSupplierOrders, rejectedWebhooks, fatalErrors, activeSuppliers] =
    await Promise.all([
      prisma.job.count({ where: { status: 'FAILED' } }),
      prisma.job.findFirst({
        where: { status: 'PENDING', nextRunAt: { lt: staleBefore } },
        orderBy: { nextRunAt: 'asc' },
        select: { type: true, nextRunAt: true },
      }),
      prisma.supplierOrder.count({
        where: { status: { in: ['FAILED', 'REJECTED'] }, updatedAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      }),
      prisma.webhookEvent.count({
        where: { status: 'REJECTED', receivedAt: { gte: since24h } },
      }),
      prisma.errorLog.count({ where: { level: 'FATAL', createdAt: { gte: since24h } } }),
      prisma.supplier.count({ where: { isActive: true } }),
    ]);

  const signals: IncidentSignal[] = [];

  if (activeSuppliers === 0) {
    signals.push({
      fingerprint: incidentFingerprint('suppliers', 'none-active'),
      service: 'suppliers',
      title: 'No active supplier — orders cannot be fulfilled',
      detail:
        'Every customer order needs a supplier purchase. No active supplier exists, so fulfilment would stall silently.',
      severity: 'SEV2',
      detectionSource: 'CONFIG_SCAN',
      evidence: { activeSuppliers, checkedAt: now.toISOString() },
    });
  }

  if (failedJobs >= 3) {
    signals.push({
      fingerprint: incidentFingerprint('job-queue', 'failed-jobs'),
      service: 'job-queue',
      title: 'Background jobs are failing',
      detail: `${failedJobs} jobs exhausted their retries. Queued notifications or supplier work may be stuck.`,
      severity: 'SEV3',
      detectionSource: 'JOB_QUEUE',
      evidence: { failedJobs, checkedAt: now.toISOString() },
    });
  }

  if (staleJob) {
    signals.push({
      fingerprint: incidentFingerprint('job-queue', 'stale-pending'),
      service: 'job-queue',
      title: 'A due job has not run',
      detail: `The oldest pending ${staleJob.type} job was due ${staleJob.nextRunAt.toISOString()} and is still waiting. The scheduler may be offline.`,
      severity: 'SEV3',
      detectionSource: 'JOB_QUEUE',
      evidence: {
        type: staleJob.type,
        nextRunAt: staleJob.nextRunAt.toISOString(),
        checkedAt: now.toISOString(),
      },
    });
  }

  if (failedSupplierOrders > 0) {
    signals.push({
      fingerprint: incidentFingerprint('suppliers', 'failed-orders'),
      service: 'suppliers',
      title: 'Supplier fulfilment failures in the last 7 days',
      detail: `${failedSupplierOrders} supplier order legs are FAILED or REJECTED. A customer order may still be unfulfilled.`,
      severity: 'SEV2',
      detectionSource: 'SUPPLIER_ORDERS',
      evidence: { failedSupplierOrders, checkedAt: now.toISOString() },
    });
  }

  if (rejectedWebhooks > 0) {
    signals.push({
      fingerprint: incidentFingerprint('webhooks', 'rejected'),
      service: 'webhooks',
      title: 'Rejected webhook deliveries',
      detail: `${rejectedWebhooks} webhook deliveries failed signature or payload validation in the last 24 hours.`,
      severity: 'SEV3',
      detectionSource: 'WEBHOOK_LOG',
      evidence: { rejectedWebhooks, checkedAt: now.toISOString() },
    });
  }

  if (fatalErrors > 0) {
    signals.push({
      fingerprint: incidentFingerprint('application', 'fatal-errors'),
      service: 'application',
      title: 'Fatal application errors recorded',
      detail: `${fatalErrors} FATAL errors were persisted in the last 24 hours. Inspect the error log for the failing route.`,
      severity: 'SEV2',
      detectionSource: 'ERROR_LOG',
      evidence: { fatalErrors, checkedAt: now.toISOString() },
    });
  }

  return signals;
}

export interface SyncResult {
  scanned: number;
  opened: number;
  updated: number;
  skippedResolved: number;
}

/**
 * Persist newly detected signals. Safe to run repeatedly or concurrently:
 * `fingerprint` is unique, so a duplicate insert is treated as "already open".
 */
export async function syncIncidents(now: Date = new Date()): Promise<SyncResult> {
  const signals = await collectIncidentSignals(now);
  const result: SyncResult = { scanned: signals.length, opened: 0, updated: 0, skippedResolved: 0 };

  for (const signal of signals) {
    const existing = await prisma.jarvisIncident.findUnique({
      where: { fingerprint: signal.fingerprint },
      select: { id: true, status: true },
    });

    if (existing?.status === 'RESOLVED') {
      result.skippedResolved += 1;
      continue;
    }

    if (existing) {
      await prisma.jarvisIncident.update({
        where: { id: existing.id },
        data: {
          severity: signal.severity,
          detail: signal.detail,
          title: signal.title,
          evidence: signal.evidence as Prisma.InputJsonValue,
          occurrences: { increment: 1 },
          lastSeenAt: now,
        },
      });
      result.updated += 1;
      continue;
    }

    try {
      await prisma.jarvisIncident.create({
        data: {
          reference: incidentReference(now),
          fingerprint: signal.fingerprint,
          severity: signal.severity,
          service: signal.service,
          title: signal.title,
          detail: signal.detail,
          detectionSource: signal.detectionSource,
          evidence: signal.evidence as Prisma.InputJsonValue,
          detectedAt: now,
          lastSeenAt: now,
        },
      });
      result.opened += 1;
    } catch (error) {
      // Concurrent scan won the unique insert; nothing to do.
      logger.warn('Incident insert skipped', {
        fingerprint: signal.fingerprint,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (result.opened > 0) {
    await auditLog({
      action: 'jarvis.incidents.detected',
      entityType: 'JarvisIncident',
      data: { opened: result.opened, scanned: result.scanned },
    });
  }

  return result;
}

export async function acknowledgeIncident(
  id: string,
  actor: { id: string; email: string }
): Promise<void> {
  await prisma.jarvisIncident.update({
    where: { id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: actor.email },
  });
  await auditLog({
    actor,
    action: 'jarvis.incident.acknowledged',
    entityType: 'JarvisIncident',
    entityId: id,
  });
}

export async function resolveIncident(
  id: string,
  actor: { id: string; email: string },
  resolution: string,
  followUp?: string
): Promise<void> {
  await prisma.jarvisIncident.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: actor.email,
      resolution,
      followUp: followUp ?? null,
    },
  });
  await auditLog({
    actor,
    action: 'jarvis.incident.resolved',
    entityType: 'JarvisIncident',
    entityId: id,
    data: { resolution, followUp: followUp ?? null },
  });
}
