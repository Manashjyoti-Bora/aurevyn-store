/**
 * Release readiness (blueprint V3 §20).
 *
 * The blueprint forbids declaring the platform production-ready because code
 * was generated. A status is only VERIFIED or PRODUCTION READY when every
 * supporting check is recorded as PASSED with evidence.
 *
 * Nothing here probes the network. Callers pass the checks they actually ran;
 * the page fills them from live configuration and stored timestamps.
 */

export type ReleaseStatus =
  | 'PLANNED'
  | 'IN DEVELOPMENT'
  | 'TESTING'
  | 'BLOCKED'
  | 'VERIFIED'
  | 'PRODUCTION READY';

export const RELEASE_STATUSES: readonly ReleaseStatus[] = [
  'PLANNED',
  'IN DEVELOPMENT',
  'TESTING',
  'BLOCKED',
  'VERIFIED',
  'PRODUCTION READY',
] as const;

export type CheckState = 'PASSED' | 'FAILED' | 'UNKNOWN';

export interface ReadinessCheck {
  id: string;
  label: string;
  state: CheckState;
  /** What proves it: a route, a record, a document, a test command. */
  evidence: string;
  /** Only the owner can close this one. */
  ownerAction?: string;
}

/**
 * - Any FAILED check blocks the platform: the status is BLOCKED.
 * - All PASSED (with owner sign-off) is PRODUCTION READY; without sign-off it
 *   is VERIFIED.
 * - Some PASSED but unknowns remain is TESTING.
 * - Nothing passed yet is IN DEVELOPMENT.
 */
export function computeReleaseStatus(
  checks: readonly ReadinessCheck[],
  ownerSignedOff = false
): ReleaseStatus {
  if (checks.length === 0) return 'PLANNED';
  if (checks.some((c) => c.state === 'FAILED')) return 'BLOCKED';
  if (checks.every((c) => c.state === 'PASSED')) {
    return ownerSignedOff ? 'PRODUCTION READY' : 'VERIFIED';
  }
  if (checks.some((c) => c.state === 'PASSED')) return 'TESTING';
  return 'IN DEVELOPMENT';
}

export interface ReadinessInput {
  buildVerifiedAt: Date | null;
  testsPassedAt: Date | null;
  dbReachable: boolean;
  authTestedAt: Date | null;
  paymentConfigured: boolean;
  paymentTestedAt: Date | null;
  backupRehearsedAt: Date | null;
  cronConfigured: boolean;
  incidentsTracked: boolean;
  policiesReviewedAt: Date | null;
  integrationsDocumented: boolean;
  ownerSignedOff: boolean;
}

export function buildReadinessChecks(input: ReadinessInput): ReadinessCheck[] {
  const stamp = (value: Date | null) => (value ? `recorded ${value.toISOString().slice(0, 10)}` : 'no recorded run');

  return [
    {
      id: 'build',
      label: 'Website builds',
      state: input.buildVerifiedAt ? 'PASSED' : 'UNKNOWN',
      evidence: `next build — ${stamp(input.buildVerifiedAt)}`,
    },
    {
      id: 'tests',
      label: 'Test suite passes',
      state: input.testsPassedAt ? 'PASSED' : 'UNKNOWN',
      evidence: `npm test — ${stamp(input.testsPassedAt)}`,
    },
    {
      id: 'database',
      label: 'Database reachable and migrations applied',
      state: input.dbReachable ? 'PASSED' : 'FAILED',
      evidence: 'SELECT 1 from the application connection',
    },
    {
      id: 'auth',
      label: 'Authentication and permissions tested',
      state: input.authTestedAt ? 'PASSED' : 'UNKNOWN',
      evidence: `sign-in, sign-out and admin guard run — ${stamp(input.authTestedAt)}`,
      ownerAction: input.authTestedAt ? undefined : 'Sign in, open an admin page and confirm a customer account is refused.',
    },
    {
      id: 'payments',
      label: 'Payment path verified with real money movement',
      state: input.paymentConfigured ? (input.paymentTestedAt ? 'PASSED' : 'UNKNOWN') : 'FAILED',
      evidence: input.paymentConfigured
        ? `UPI VPA configured — ${stamp(input.paymentTestedAt)}`
        : 'no payment method configured',
      ownerAction: input.paymentConfigured
        ? input.paymentTestedAt
          ? undefined
          : 'Make one real payment and match its UTR against the bank statement.'
        : 'Set the UPI VPA in Admin → Settings → Payments.',
    },
    {
      id: 'backup',
      label: 'Backup restore rehearsed',
      state: input.backupRehearsedAt ? 'PASSED' : 'FAILED',
      evidence: `restore rehearsal — ${stamp(input.backupRehearsedAt)}`,
      ownerAction: input.backupRehearsedAt
        ? undefined
        : 'Restore a Neon branch and record the recovery time in docs/OWNER_RUNBOOK.md.',
    },
    {
      id: 'cron',
      label: 'Scheduled work configured',
      state: input.cronConfigured ? 'PASSED' : 'UNKNOWN',
      evidence: input.cronConfigured
        ? 'CRON_SECRET set; /api/cron/jobs and /api/cron/jarvis guarded'
        : 'CRON_SECRET not set, so the queue and incident scan have no schedule',
      ownerAction: input.cronConfigured
        ? undefined
        : 'Set CRON_SECRET and point the scheduler at /api/cron/jobs and /api/cron/jarvis.',
    },
    {
      id: 'monitoring',
      label: 'Incident procedure exists',
      state: input.incidentsTracked ? 'PASSED' : 'UNKNOWN',
      evidence: input.incidentsTracked
        ? 'jarvis_incidents records severity, evidence and recovery'
        : 'no incident records yet — run a detection scan',
    },
    {
      id: 'integrations',
      label: 'Integrations have documented permission',
      state: input.integrationsDocumented ? 'PASSED' : 'FAILED',
      evidence: input.integrationsDocumented
        ? 'every connector carries recorded checks; Meesho is DISABLED'
        : 'connector checks are incomplete',
    },
    {
      id: 'policies',
      label: 'Legal and policy pages reviewed',
      state: input.policiesReviewedAt ? 'PASSED' : 'UNKNOWN',
      evidence: `owner review — ${stamp(input.policiesReviewedAt)}`,
      ownerAction: input.policiesReviewedAt
        ? undefined
        : 'Read the privacy, terms, shipping and returns pages and confirm the legal entity details.',
    },
  ];
}

export function releaseStatusTone(
  status: ReleaseStatus
): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  switch (status) {
    case 'PRODUCTION READY':
    case 'VERIFIED':
      return 'green';
    case 'TESTING':
      return 'blue';
    case 'BLOCKED':
      return 'red';
    case 'IN DEVELOPMENT':
      return 'amber';
    default:
      return 'gray';
  }
}

/** One-line reason a status is not higher, so the label can never stand alone. */
export function statusBlocker(checks: readonly ReadinessCheck[]): string | null {
  const failed = checks.filter((c) => c.state === 'FAILED');
  if (failed.length > 0) return failed.map((c) => c.label).join('; ');
  const unknown = checks.filter((c) => c.state === 'UNKNOWN');
  if (unknown.length > 0) return unknown.map((c) => c.label).join('; ');
  return null;
}
