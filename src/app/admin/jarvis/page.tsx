import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { TableWrap, Th, Td } from '@/components/ui/table';
import { JarvisPauseControls } from '@/components/admin/jarvis-pause-controls';
import { describePlacement } from '@/lib/orders/placement';
import {
  CAPABILITIES,
  CAPABILITY_STATUS_LABEL,
  capabilitySummary,
  ownerActions,
  type CapabilityStatus,
} from '@/lib/jarvis/capabilities';
import { pauseState } from '@/lib/jarvis/pause';

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

export default async function JarvisPage() {
  const [settings, pauses] = await Promise.all([getSettings(), pauseState()]);

  const [awaiting, unverified, failed, pendingJobs, queue] = await Promise.all([
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
  ]);

  const summary = capabilitySummary();
  const actions = ownerActions();
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
