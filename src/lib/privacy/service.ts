import { prisma } from '../db';
import { auditLog } from '../audit';
import { logger } from '../logger';
import { buildRetentionPlan, type RetentionDataset } from './retention';

/**
 * Executes the retention policy in `retention.ts`.
 *
 * The sweep is deliberately narrow: it only deletes diagnostic and
 * already-closed rows. Business records (orders, payments, shipments,
 * supplier orders) are never selected here — see `NEVER_PRUNED` for why.
 *
 * Each dataset is deleted independently, so one failing table does not stop
 * the others; the result reports what actually happened per dataset.
 */

export interface RetentionSweepResult {
  ranAt: string;
  deleted: Record<RetentionDataset, number>;
  totalDeleted: number;
  failed: RetentionDataset[];
}

async function deleteDataset(dataset: RetentionDataset, before: Date): Promise<number> {
  switch (dataset) {
    case 'error_logs': {
      const res = await prisma.errorLog.deleteMany({ where: { createdAt: { lt: before } } });
      return res.count;
    }
    case 'api_logs': {
      const res = await prisma.apiLog.deleteMany({ where: { createdAt: { lt: before } } });
      return res.count;
    }
    case 'webhook_events': {
      // Signed/processed deliveries only. RECEIVED and FAILED rows stay so an
      // unresolved provider event is never silently dropped.
      const res = await prisma.webhookEvent.deleteMany({
        where: {
          receivedAt: { lt: before },
          status: { in: ['PROCESSED', 'DUPLICATE', 'REJECTED'] },
        },
      });
      return res.count;
    }
    case 'contact_messages': {
      // Explicitly resolved by the owner. NEW and READ threads are kept.
      const res = await prisma.contactMessage.deleteMany({
        where: { createdAt: { lt: before }, status: 'RESOLVED' },
      });
      return res.count;
    }
    case 'team_cycles': {
      // Briefings cascade with their cycle.
      const res = await prisma.teamCycle.deleteMany({ where: { createdAt: { lt: before } } });
      return res.count;
    }
    case 'audit_logs': {
      const res = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: before } } });
      return res.count;
    }
    default: {
      const exhaustive: never = dataset;
      throw new Error(`No retention rule for ${String(exhaustive)}`);
    }
  }
}

export async function runRetentionSweep(now: Date = new Date()): Promise<RetentionSweepResult> {
  const plan = buildRetentionPlan(now);
  const deleted = {} as Record<RetentionDataset, number>;
  const failed: RetentionDataset[] = [];

  for (const step of plan) {
    try {
      deleted[step.dataset] = await deleteDataset(step.dataset, step.deleteBefore);
    } catch (error) {
      failed.push(step.dataset);
      logger.error('Retention sweep failed for dataset', {
        dataset: step.dataset,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalDeleted = Object.values(deleted).reduce((sum, n) => sum + n, 0);

  // The sweep deletes audit rows, so it must also record that it ran.
  await auditLog({
    action: 'RETENTION_SWEEP',
    entityType: 'RetentionPolicy',
    data: { ranAt: now.toISOString(), deleted, totalDeleted, failed },
  });

  if (failed.length > 0) {
    logger.warn('Retention sweep finished with failures', { failed, deleted });
  } else {
    logger.info('Retention sweep finished', { totalDeleted });
  }

  return { ranAt: now.toISOString(), deleted, totalDeleted, failed };
}
