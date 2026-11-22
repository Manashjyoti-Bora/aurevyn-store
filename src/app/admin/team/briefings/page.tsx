import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { TeamRunButton } from '@/components/admin/team-run-button';
import { getTeamBoard } from '@/lib/team/service';
import { TEAM_ROSTER } from '@/lib/team/roster';
import { AGENT_STATUS_LABELS, type AgentStatus } from '@/lib/team/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'The team — Admin', robots: { index: false } };

const STATUS_TONE: Record<AgentStatus, 'red' | 'amber' | 'green'> = {
  ACT: 'red',
  WATCH: 'amber',
  CLEAR: 'green',
};

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/**
 * The team console: eight independent agents, their current briefing and the
 * policy each one operates under. Briefings are recomputed on every page load
 * from live store data, so this page is never a stale dashboard.
 */
export default async function TeamPage() {
  const { signals, briefings, counts, cycles } = await getTeamBoard();
  const lastCycle = cycles[0] ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Autonomous team</p>
          <h1>The people who never sleep</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Eight specialists, each owning one part of {signals.store.name}. They read the store,
            rank what matters and brief you — the decisions that move money stay yours.
          </p>
        </div>
        <TeamRunButton />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Action now
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-600">{counts.ACT}</p>
          <p className="text-[11px] text-ink-500">agents with something urgent</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Watching
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{counts.WATCH}</p>
          <p className="text-[11px] text-ink-500">trending the wrong way</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            All clear
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{counts.CLEAR}</p>
          <p className="text-[11px] text-ink-500">nothing needed</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Last stored cycle
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {lastCycle ? ago(lastCycle.createdAt) : 'not yet run'}
          </p>
          <p className="text-[11px] text-ink-500">
            {lastCycle
              ? `${lastCycle.trigger.toLowerCase()} · ${lastCycle.durationMs} ms`
              : 'run one above'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {briefings.map((briefing) => {
          const agent = TEAM_ROSTER.find((entry) => entry.id === briefing.agentId);
          if (!agent) return null;
          return (
            <Card key={briefing.agentId} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-400/30 bg-cream-100 text-sm font-semibold text-accent-400">
                    {agent.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-ink-900">{agent.name}</h2>
                    <p className="truncate text-[11px] uppercase tracking-wider text-ink-400">
                      {agent.role}
                    </p>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[briefing.status]}>
                  {AGENT_STATUS_LABELS[briefing.status]}
                </Badge>
              </div>

              <p className="mt-3 text-[13px] font-semibold leading-snug text-ink-800">
                {briefing.headline}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">
                {briefing.summary}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {briefing.findings.slice(0, 6).map((finding) => (
                  <div
                    key={finding.label}
                    className="rounded-lg border border-ink-900/10 bg-cream-50 px-2.5 py-2"
                  >
                    <dt className="text-[10px] uppercase tracking-wider text-ink-400">
                      {finding.label}
                    </dt>
                    <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-ink-900">
                      {finding.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {briefing.priorities.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Next actions
                  </p>
                  <ol className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-ink-700">
                    {briefing.priorities.map((priority) => (
                      <li key={priority} className="flex gap-2">
                        <span aria-hidden="true" className="text-accent-400">
                          →
                        </span>
                        <span>{priority}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <details className="mt-3 border-t border-ink-900/10 pt-2.5">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Mandate &amp; limits
                </summary>
                <p className="mt-2 text-[12px] italic text-ink-500">“{agent.mandate}”</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Works on its own
                </p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-ink-700">
                  {agent.decides.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Reserved for the owner
                </p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-ink-500">
                  {agent.escalates.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-ink-400">
                  {agent.schedule.cadence} · cron <code>{agent.schedule.cron}</code>
                </p>
              </details>
            </Card>
          );
        })}
      </div>

      <Card
        title="Cycle log"
        action={
          <span className="text-[11px] text-ink-400">
            {signals.catalog.active} live products · {signals.orders.placedWindow} orders in{' '}
            {signals.windowDays} d
          </span>
        }
      >
        {cycles.length === 0 ? (
          <p className="text-sm text-ink-500">
            No stored cycle yet. Run the team above, or wait for the scheduled cron — the first
            cycle is stored automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-900/10 text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-4 font-semibold">When</th>
                  <th className="py-2 pr-4 font-semibold">Trigger</th>
                  <th className="py-2 pr-4 font-semibold">Action</th>
                  <th className="py-2 pr-4 font-semibold">Watch</th>
                  <th className="py-2 pr-4 font-semibold">Clear</th>
                  <th className="py-2 font-semibold">Took</th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="border-b border-ink-900/5 last:border-0">
                    <td className="py-2 pr-4 text-ink-700">{ago(cycle.createdAt)}</td>
                    <td className="py-2 pr-4 text-ink-500">{cycle.trigger.toLowerCase()}</td>
                    <td className="py-2 pr-4 tabular-nums text-red-600">{cycle.counts.ACT}</td>
                    <td className="py-2 pr-4 tabular-nums text-amber-700">{cycle.counts.WATCH}</td>
                    <td className="py-2 pr-4 tabular-nums text-emerald-700">
                      {cycle.counts.CLEAR}
                    </td>
                    <td className="py-2 tabular-nums text-ink-500">{cycle.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
