import { describe, it, expect } from 'vitest';
import {
  incidentFingerprint,
  incidentReference,
  severityRank,
  sortIncidents,
  type IncidentSeverity,
} from '@/lib/jarvis/incidents';

describe('incidents', () => {
  it('builds stable, readable references', () => {
    const ref = incidentReference(new Date('2026-11-22T10:00:00Z'), 'ab12cd34');
    expect(ref).toBe('INC-20261122-AB12');
    expect(incidentReference(new Date('2026-11-22T00:00:00Z'))).toMatch(/^INC-\d{8}-[A-Z0-9]{4}$/);
  });

  it('fingerprints case-insensitively so a persistent failure is one incident', () => {
    expect(incidentFingerprint('Job-Queue', 'FAILED-JOBS')).toBe('job-queue:failed-jobs');
    expect(incidentFingerprint('job-queue', 'failed-jobs')).toBe(
      incidentFingerprint('JOB-QUEUE', 'Failed-Jobs')
    );
  });

  it('orders SEV1 before SEV4 and newer before older within a severity', () => {
    const rows: Array<{ severity: IncidentSeverity; detectedAt: Date }> = [
      { severity: 'SEV4', detectedAt: new Date('2026-11-22T10:00:00Z') },
      { severity: 'SEV1', detectedAt: new Date('2026-11-20T10:00:00Z') },
      { severity: 'SEV2', detectedAt: new Date('2026-11-21T10:00:00Z') },
      { severity: 'SEV2', detectedAt: new Date('2026-11-22T09:00:00Z') },
    ];
    const sorted = sortIncidents(rows).map((r) => `${r.severity}:${r.detectedAt.toISOString()}`);
    expect(sorted).toEqual([
      'SEV1:2026-11-20T10:00:00.000Z',
      'SEV2:2026-11-22T09:00:00.000Z',
      'SEV2:2026-11-21T10:00:00.000Z',
      'SEV4:2026-11-22T10:00:00.000Z',
    ]);
  });

  it('ranks severities numerically for sorting', () => {
    expect(severityRank('SEV1')).toBeLessThan(severityRank('SEV4'));
  });
});
