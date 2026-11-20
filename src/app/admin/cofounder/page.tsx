import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';
import { PERMISSION_LEVEL_LABELS, permissionLevelOf } from '@/lib/auth/permissions';
import { loadCofounderFacts } from '@/lib/cofounder/service';
import { formatINR } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Alert, Card, EmptyState, StatCard } from '@/components/ui/feedback';
import { CofounderChat } from '@/components/admin/cofounder-chat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AI Cofounder — Admin', robots: { index: false } };

const SEVERITY_TONE: Record<string, 'red' | 'amber' | 'blue' | 'gray'> = {
  CRITICAL: 'red',
  HIGH: 'amber',
  MEDIUM: 'blue',
  LOW: 'gray',
};

export default async function CofounderPage() {
  const session = await getSessionUser();
  const level = permissionLevelOf(session?.user ?? null);
  const loaded = await loadCofounderFacts();

  const header = (
    <header className="space-y-2">
      <p className="eyebrow">AI Cofounder · Runs on your records</p>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Ask your store anything</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-400">
        I read the same ledger, order pipeline, inventory and catalogue records as the AI CEO report,
        then answer in plain language. Every number is traceable to a record; if something cannot be
        measured I say so instead of guessing.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
        <Badge tone="gray">
          You are level {level} — {PERMISSION_LEVEL_LABELS[level]}
        </Badge>
        <Badge tone="green">Observe · on</Badge>
        <Badge tone="gray">No autonomous pricing, refunds or messages</Badge>
      </div>
    </header>
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        {header}
        <Alert tone="error" title="Verified data unavailable">
          {loaded.error}{' '}
          <Link href="/admin/health" className="underline">
            Check system health
          </Link>
          .
        </Alert>
      </div>
    );
  }

  const facts = loaded.facts;
  const stockAlerts = facts.inventory.lowStock.length + facts.inventory.outOfStock.length;

  return (
    <div className="space-y-6">
      {header}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={facts.sales.paidOrders > 0 ? formatINR(facts.sales.netRevenuePaise) : '—'}
          sub={`${facts.windowDays}-day window · ${facts.sales.paidOrders} paid order(s)`}
          tone="info"
        />
        <StatCard
          label="Carts with items"
          value={facts.carts.active}
          sub={`${facts.carts.stale} idle for 2h+`}
          tone={facts.carts.stale > 0 ? 'negative' : 'neutral'}
        />
        <StatCard
          label="Stock alerts"
          value={stockAlerts}
          sub={`${facts.inventory.outOfStock.length} sold out`}
          tone={stockAlerts > 0 ? 'negative' : 'positive'}
        />
        <StatCard
          label="Open risks"
          value={facts.risks.length}
          sub={`${facts.launchBlockers.length} launch blocker(s)`}
          tone={facts.risks.length > 0 ? 'negative' : 'positive'}
        />
      </dl>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <CofounderChat storeName={facts.storeName} headline={facts.headline} />

        <div className="space-y-4">
          <Card
            title="Today's plan"
            action={<Badge tone="gray">{facts.recommendations.length}</Badge>}
          >
            {facts.recommendations.length === 0 ? (
              <EmptyState
                title="Nothing actionable"
                description="No recommendation currently meets its evidence threshold. I will speak up when a measured issue appears."
              />
            ) : (
              <ol className="space-y-2.5">
                {facts.recommendations.slice(0, 4).map((rec, index) => (
                  <li
                    key={`${rec.issue}-${index}`}
                    className="rounded-lg border border-ink-900/10 bg-cream-50/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-eyebrow text-brand-700">
                        Priority {rec.priority}
                      </p>
                      {rec.requiresApproval && <Badge tone="amber">Your call</Badge>}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug text-ink-900">{rec.issue}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{rec.actionLabel}</p>
                    {rec.href && (
                      <Link href={rec.href} className="link-primary mt-1.5 inline-block text-xs">
                        Open the screen →
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Confirmed risks" action={<Badge tone={facts.risks.length ? 'red' : 'green'}>{facts.risks.length}</Badge>}>
            {facts.risks.length === 0 ? (
              <p className="text-sm text-ink-500">No confirmed risk is open right now.</p>
            ) : (
              <ul className="space-y-2">
                {facts.risks.slice(0, 3).map((risk) => (
                  <li key={risk.title} className="rounded-lg border border-ink-900/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">{risk.title}</p>
                      <Badge tone={SEVERITY_TONE[risk.severity] ?? 'gray'}>
                        {risk.severity.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{risk.impact}</p>
                    {risk.href && (
                      <Link href={risk.href} className="link-primary mt-1.5 inline-block text-xs">
                        Resolve →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="What I will not do">
            <p className="text-xs leading-relaxed text-ink-500">
              I do not publish products, change prices, issue refunds, move money, edit settings or
              message customers. Those stay behind the admin screens where you perform them — and the
              AI CEO action console only exposes bounded, reversible maintenance actions with a kill
              switch and daily cap.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin/ai-ceo" className="link-primary text-xs">
                Run a safe action →
              </Link>
              <Link href="/admin/ai-ceo" className="link-primary text-xs">
                Full AI CEO report →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-400">
        {facts.dataGaps.length} thing(s) this report cannot measure right now — listed on the full AI
        CEO report. Figures are shown with their evidence basis; nothing here is a forecast or a
        guarantee.
      </p>
    </div>
  );
}
