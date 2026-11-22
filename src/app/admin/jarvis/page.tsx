import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { loadPaymentStatus } from '@/lib/payments';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { TableWrap, Th, Td } from '@/components/ui/table';
import { JarvisPauseControls } from '@/components/admin/jarvis-pause-controls';
import { IncidentRowActions, IncidentScanButton } from '@/components/admin/incident-actions';
import { describePlacement } from '@/lib/orders/placement';
import { formatINR } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import {
  CAPABILITIES,
  CAPABILITY_STATUS_LABEL,
  capabilitySummary,
  ownerActions,
  type CapabilityStatus,
} from '@/lib/jarvis/capabilities';
import { pauseState } from '@/lib/jarvis/pause';
import { CONNECTORS, connectorActivation, connectorSummary } from '@/lib/jarvis/registry';
import { collectPendingApprovals } from '@/lib/jarvis/approvals';
import {
  INCIDENT_SEVERITY_LABEL,
  type IncidentSeverity,
} from '@/lib/jarvis/incidents';
import { isStale, knowledgeBadge } from '@/lib/jarvis/knowledge';
import { loadDailyReport } from '@/lib/jarvis/report';
import {
  buildReadinessChecks,
  computeReleaseStatus,
  releaseStatusTone,
  statusBlocker,
} from '@/lib/jarvis/readiness';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Jarvis control — Admin',
  robots: { index: false, follow: false },
};

/** The admin panel must render even while the database is unreachable. */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

const STATUS_TONE: Record<CapabilityStatus, 'green' | 'amber' | 'red' | 'gray'> = {
  LIVE: 'green',
  PARTIAL: 'amber',
  BLOCKED: 'red',
  NOT_STARTED: 'gray',
};

const INCIDENT_TONE: Record<IncidentSeverity, 'red' | 'amber' | 'blue' | 'gray'> = {
  SEV1: 'red',
  SEV2: 'red',
  SEV3: 'amber',
  SEV4: 'blue',
};

const iso = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

export default async function JarvisPage() {
  const [settings, pauses, provider, dbReachable] = await Promise.all([
    getSettings(),
    pauseState(),
    safe(loadPaymentStatus(), {
      kind: 'NONE' as const,
      label: 'not configured',
      isTest: false,
      upiVpa: null,
      issue: 'Payment status unavailable',
    }),
    safe(
      prisma.$queryRaw`SELECT 1`.then(() => true),
      false
    ),
  ]);

  const [awaiting, unverified, failed, pendingJobs, queue, approvals, incidents, knowledge, report] =
    await Promise.all([
      safe(
        prisma.supplierOrder.count({
          where: { supplierOrderId: null, status: { in: ['QUEUED', 'SENT'] } },
        }),
        0
      ),
      safe(
        prisma.supplierOrder.count({
          where: {
            supplierOrderId: { not: null },
            referenceVerifiedAt: null,
            status: { notIn: ['CANCELLED', 'DELIVERED', 'REJECTED', 'FAILED', 'RETURNED'] },
          },
        }),
        0
      ),
      safe(prisma.supplierOrder.count({ where: { status: { in: ['FAILED', 'REJECTED'] } } }), 0),
      safe(prisma.job.count({ where: { status: 'PENDING' } }), 0),
      safe(
        prisma.supplierOrder.findMany({
          where: {
            OR: [
              { supplierOrderId: null, status: { in: ['QUEUED', 'SENT'] } },
              { supplierOrderId: { not: null }, referenceVerifiedAt: null },
            ],
          },
          orderBy: { createdAt: 'asc' },
          take: 8,
          include: {
            supplier: { select: { name: true, type: true } },
            order: { select: { id: true, orderNumber: true } },
          },
        }),
        []
      ),
      safe(collectPendingApprovals(), []),
      safe(
        prisma.jarvisIncident.findMany({
          where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
          orderBy: [{ detectedAt: 'desc' }],
          take: 8,
        }),
        []
      ),
      safe(
        prisma.knowledgeEntry.findMany({
          orderBy: [{ updatedAt: 'desc' }],
          take: 5,
        }),
        []
      ),
      safe(loadDailyReport(), null),
    ]);

  const readinessChecks = buildReadinessChecks({
    buildVerifiedAt: null,
    testsPassedAt: null,
    dbReachable,
    authTestedAt: null,
    paymentConfigured: provider.kind === 'UPI',
    paymentTestedAt: null,
    backupRehearsedAt: null,
    cronConfigured: Boolean(env.CRON_SECRET),
    incidentsTracked: true,
    policiesReviewedAt: null,
    integrationsDocumented: true,
    ownerSignedOff: false,
  });
  const releaseStatus = computeReleaseStatus(readinessChecks);
  const blocker = statusBlocker(readinessChecks);

  const summary = capabilitySummary();
  const actions = ownerActions();
  const connectors = connectorSummary();
  const knowledgeNeedingRecheck = knowledge.filter((entry) =>
    isStale({ reviewBy: iso(entry.reviewBy), status: entry.status })
  ).length;

  const cards = [
    {
      label: 'Awaiting your placement',
      value: awaiting,
      hint: 'Supplier purchases not placed yet',
      href: '/admin/supplier-orders?status=QUEUED',
      tone: awaiting > 0 ? 'amber' : 'green',
    },
    {
      label: 'References unverified',
      value: unverified,
      hint: 'Pasted IDs with no confirmation evidence',
      href: '/admin/supplier-orders',
      tone: unverified > 0 ? 'amber' : 'green',
    },
    {
      label: 'Supplier issues',
      value: failed,
      hint: 'Rejected or failed fulfilment legs',
      href: '/admin/supplier-orders?status=REJECTED',
      tone: failed > 0 ? 'red' : 'green',
    },
    {
      label: 'Queued jobs',
      value: pendingJobs,
      hint: 'Durable background work waiting',
      href: '/admin/logs/jobs',
      tone: 'blue',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1>Jarvis control</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">
          One screen for the two things that must never be vague: what the store owes a customer
          right now, and exactly what this system can and cannot do. Everything below is read from
          live records — no projected numbers.
        </p>
      </header>

      <Card
        title="Platform status"
        action={
          <Badge tone={releaseStatusTone(releaseStatus)}>
            {releaseStatus}
          </Badge>
        }
      >
        <p className="text-sm text-ink-600">
          The label follows blueprint V3 §20: VERIFIED and PRODUCTION READY are only claimed when
          every check has recorded evidence. It is never inferred from the code existing.
        </p>
        {blocker && (
          <p className="mt-2 rounded-lg bg-cream-50 px-3 py-2 text-xs text-ink-600">
            <span className="font-semibold text-ink-800">Not yet passed:</span> {blocker}
          </p>
        )}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {readinessChecks
            .filter((check) => check.state !== 'PASSED')
            .map((check) => (
              <li key={check.id} className="flex items-start gap-2 text-xs">
                <Badge tone={check.state === 'FAILED' ? 'red' : 'gray'}>
                  {check.state === 'FAILED' ? 'Failed' : 'Unknown'}
                </Badge>
                <span>
                  <span className="font-semibold text-ink-800">{check.label}</span>
                  {check.ownerAction && (
                    <span className="block text-ink-500">{check.ownerAction}</span>
                  )}
                </span>
              </li>
            ))}
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-ink-900/10 bg-white p-4 transition-colors hover:border-brand-300"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">{c.value}</p>
            <p className="mt-0.5 text-xs text-ink-500">{c.hint}</p>
          </Link>
        ))}
      </div>

      <Card
        title="Today (UTC)"
        action={
          <Link href="/admin/jarvis/report" className="text-xs font-semibold text-brand-700">
            Full report →
          </Link>
        }
      >
        {report ? (
          <>
            <p className="text-sm text-ink-600">{report.headline}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">
                  Collected <span className="text-emerald-600">verified</span>
                </p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">
                  {formatINR(report.sections[0]?.metrics[0]?.value ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">
                  Estimated profit <span className="text-blue-600">estimate</span>
                </p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">
                  {formatINR(report.sections[0]?.metrics[3]?.value ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-400">
                  Waiting on your Meesho placement
                </p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{awaiting}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              Estimated profit is a projection and is never presented as income.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-400">
            The report needs the database. Nothing is estimated in its place.
          </p>
        )}
      </Card>

      <Card
        title="Approvals waiting on you"
        action={<span className="text-[11px] text-ink-400">{approvals.length} item(s)</span>}
      >
        {approvals.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing needs a human decision right now.</p>
        ) : (
          <ul className="divide-y divide-ink-900/5">
            {approvals.slice(0, 6).map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0 max-w-2xl">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {item.title}
                    <Badge tone={item.severity === 'HIGH' ? 'amber' : 'gray'}>{item.kind}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{item.detail}</p>
                  <p className="mt-0.5 text-[11px] text-ink-600">→ {item.action}</p>
                </div>
                <Link href={item.href} className="text-xs font-semibold text-brand-700">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Needs the owner"
        action={
          <Link href="/admin/supplier-orders" className="text-xs font-semibold text-brand-700">
            All supplier orders →
          </Link>
        }
        padded={false}
      >
        {queue.length === 0 ? (
          <p className="p-4 text-sm text-ink-400">
            Nothing is waiting on you. Every supplier purchase is placed and confirmed.
          </p>
        ) : (
          <TableWrap>
            <table className="table-base">
              <thead className="bg-cream-50">
                <tr>
                  <Th>Store order</Th>
                  <Th className="hidden sm:table-cell">Supplier</Th>
                  <Th>Placement</Th>
                  <Th className="text-right">Open</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {queue.map((so) => {
                  const placement = describePlacement(so);
                  return (
                    <tr key={so.id}>
                      <Td>
                        <span className="font-mono text-xs font-semibold text-ink-900">
                          {so.order.orderNumber}
                        </span>
                        {so.supplierOrderId ? (
                          <span className="ml-2 font-mono text-[11px] text-ink-400">
                            {so.supplierOrderId}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="hidden text-xs text-ink-600 sm:table-cell">
                        {so.supplier.name}
                      </Td>
                      <Td>
                        <Badge tone={placement.tone}>{placement.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/admin/supplier-orders?focus=${so.id}`}
                          className="text-xs font-semibold text-brand-700"
                        >
                          Handoff →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card
        title="Incidents"
        action={<IncidentScanButton />}
        padded={incidents.length === 0}
      >
        {incidents.length === 0 ? (
          <p className="text-sm text-ink-400">
            No open incidents. A scan only opens one when a real failure is detected — it does not
            invent health.
          </p>
        ) : (
          <ul className="divide-y divide-ink-900/5">
            {incidents.map((incident) => (
              <li key={incident.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={INCIDENT_TONE[incident.severity]}>
                    {INCIDENT_SEVERITY_LABEL[incident.severity]}
                  </Badge>
                  <span className="font-mono text-[11px] text-ink-400">{incident.reference}</span>
                  <span className="text-[11px] text-ink-400">
                    detected {formatDate(incident.detectedAt, true)}
                    {incident.occurrences > 1 ? ` · seen ${incident.occurrences}×` : ''}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink-900">{incident.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{incident.detail}</p>
                <div className="mt-2">
                  <IncidentRowActions id={incident.id} status={incident.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Emergency switches">
        <p className="mb-2 text-xs text-ink-500">
          Four independent stops. Each one is audited and takes effect on the next action.
        </p>
        <JarvisPauseControls initial={pauses} />
        {pauses.messages ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Outbound email is paused. Customers will not receive order updates until you resume.
          </p>
        ) : null}
      </Card>

      <Card
        title="Connector registry"
        action={
          <span className="text-[11px] text-ink-500">
            {connectors.ACTIVE} active · {connectors.PREPARED} prepared · {connectors.DISABLED}{' '}
            disabled
          </span>
        }
        padded={false}
      >
        <p className="border-b border-ink-900/5 px-4 py-2 text-[11px] text-ink-400">
          A connector is enabled by code review and recorded policy checks, never by a database
          flag. Meesho stays manual and disabled.
        </p>
        <TableWrap>
          <table className="table-base">
            <thead className="bg-cream-50">
              <tr>
                <Th>Connector</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Access</Th>
                <Th className="hidden lg:table-cell">Policy checks</Th>
                <Th className="hidden xl:table-cell">What is real today</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {CONNECTORS.map((connector) => {
                const activation = connectorActivation(connector);
                const passed = connector.checks.filter((c) => c.outcome === 'PASSED').length;
                return (
                  <tr key={connector.id}>
                    <Td>
                      <p className="text-sm font-semibold text-ink-900">{connector.name}</p>
                      <p className="font-mono text-[10px] text-ink-400">{connector.id}</p>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          connector.status === 'ACTIVE'
                            ? 'green'
                            : connector.status === 'PREPARED'
                              ? 'blue'
                              : 'gray'
                        }
                      >
                        {connector.status}
                      </Badge>
                    </Td>
                    <Td className="hidden text-xs text-ink-600 sm:table-cell">
                      {connector.access.replace('_', ' ')}
                    </Td>
                    <Td className="hidden text-xs text-ink-600 lg:table-cell">
                      {passed}/{connector.checks.length} passed
                      {!activation.ok && (
                        <span className="block text-[10px] text-amber-600">
                          {activation.blockers.length} blocker(s)
                        </span>
                      )}
                    </Td>
                    <Td className="hidden max-w-md text-xs text-ink-500 xl:table-cell">
                      {connector.reality}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card
        title="Knowledge base"
        action={
          <Link href="/admin/jarvis/knowledge" className="text-xs font-semibold text-brand-700">
            Open knowledge →
          </Link>
        }
      >
        {knowledge.length === 0 ? (
          <p className="text-sm text-ink-400">
            No entries yet. Add sourced knowledge so agents and the owner work from recorded facts,
            not memory.
          </p>
        ) : (
          <>
            {knowledgeNeedingRecheck > 0 && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {knowledgeNeedingRecheck} recent entr{knowledgeNeedingRecheck === 1 ? 'y is' : 'ies are'}{' '}
                past their recheck date and are labelled &quot;Needs recheck&quot;.
              </p>
            )}
            <ul className="divide-y divide-ink-900/5">
              {knowledge.map((entry) => {
                const badge = knowledgeBadge({
                  confidence: entry.confidence,
                  status: entry.status,
                  reviewBy: iso(entry.reviewBy),
                  verifiedAt: iso(entry.verifiedAt),
                });
                return (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
                      <p className="text-[11px] text-ink-400">
                        {entry.category} · checked {iso(entry.verifiedAt) ?? 'never'}
                      </p>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card
        title="Capability audit"
        action={
          <span className="text-[11px] text-ink-500">
            {summary.LIVE} live · {summary.PARTIAL} partial · {summary.BLOCKED} blocked ·{' '}
            {summary.NOT_STARTED} not started
          </span>
        }
        padded={false}
      >
        <p className="border-b border-ink-900/5 px-4 py-2 text-[11px] text-ink-400">
          A status is claimed only where code exists; the evidence paths are checked by a unit test.
        </p>
        <TableWrap>
          <table className="table-base">
            <thead className="bg-cream-50">
              <tr>
                <Th>Capability</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">What is real today</Th>
                <Th className="hidden xl:table-cell">Open gap</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/5">
              {CAPABILITIES.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="text-sm font-semibold text-ink-900">{c.title}</p>
                    <p className="font-mono text-[10px] text-ink-400">{c.section}</p>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status]}>{CAPABILITY_STATUS_LABEL[c.status]}</Badge>
                  </Td>
                  <Td className="hidden max-w-md text-xs text-ink-600 lg:table-cell">{c.reality}</Td>
                  <Td className="hidden max-w-md text-xs text-ink-500 xl:table-cell">
                    {c.gap ?? '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {actions.length > 0 && (
        <Card title="Owner actions">
          <p className="mb-2 text-xs text-ink-500">Only you can unblock these.</p>
          <ul className="space-y-2 text-sm">
            {actions.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-300">
                  ·
                </span>
                <span>
                  <span className="font-semibold text-ink-900">{c.title}:</span>{' '}
                  <span className="text-ink-600">{c.gap}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[11px] text-ink-400">
        Store: {settings.storeName}. Deployment switches apply immediately; data is never deleted by
        a pause. Full mapping and the Assamese summary live in docs/JARVIS_BLUEPRINT_STATUS.md.
      </p>
    </div>
  );
}
