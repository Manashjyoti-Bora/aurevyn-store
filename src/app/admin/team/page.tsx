import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import {
  AUTONOMY_LABELS,
  SPECIALIST_COUNT,
  specialistsByDepartment,
  type Autonomy,
} from '@/lib/team/agents';
import { TEAM_ROSTER } from '@/lib/team/roster';
import { formatMinutes, planAllObjectives } from '@/lib/team/workflow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'The team — Admin', robots: { index: false } };

const TONE: Record<Autonomy, 'green' | 'amber' | 'gray'> = {
  AUTO: 'green',
  PROPOSE: 'amber',
  OWNER: 'gray',
};

const STEPS = [
  { n: '01', label: 'Objectives', text: 'One measurable question per playbook.' },
  { n: '02', label: 'Tasks', text: 'Small units that can be finished and checked.' },
  { n: '03', label: 'Dependencies', text: 'What must finish before a task may start.' },
  { n: '04', label: 'Ownership', text: 'Exactly one specialist per task.' },
  { n: '05', label: 'Resources', text: 'The data or access the task needs.' },
];

export default function TeamPage() {
  const plans = planAllObjectives();
  const departments = specialistsByDepartment();
  const liveCount = TEAM_ROSTER.length;
  const taskCount = plans.reduce((sum, plan) => sum + plan.taskCount, 0);
  const gateCount = plans.reduce((sum, plan) => sum + plan.ownerGates.length, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Operations team</p>
          <h1>{SPECIALIST_COUNT} specialists, one plan</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">
            Every role below owns one question. The workflow planner turns a business objective into
            ordered, owned work: what runs in parallel, what waits, and which decisions stay with
            you. {liveCount} agents are on live duty and produce briefings from real store records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/team/briefings"
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
          >
            Live briefings
          </Link>
          <Link
            href="/admin/sourcing"
            className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-cream-100"
          >
            Meesho sourcing
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Specialists',
            value: SPECIALIST_COUNT,
            sub: `${departments.length} departments`,
          },
          { label: 'On live duty', value: liveCount, sub: 'briefings from real records' },
          { label: 'Planned tasks', value: taskCount, sub: 'across 4 objectives' },
          { label: 'Owner gates', value: gateCount, sub: 'decisions never delegated' },
        ].map((item) => (
          <Card key={item.label} className="p-3.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {item.label}
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{item.value}</dd>
            <p className="text-[11px] text-ink-500">{item.sub}</p>
          </Card>
        ))}
      </dl>

      <Card title="How a plan is built">
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-xl border border-ink-900/10 bg-cream-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-eyebrow text-accent-400">
                {step.n} · {step.label}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{step.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <section className="space-y-4">
        <div>
          <h2>Execution plans</h2>
          <p className="mt-1 text-sm text-ink-400">
            Each playbook is a directed graph. Wave 1 starts now; every later wave waits only for
            what it depends on.
          </p>
        </div>

        {plans.map((plan) => (
          <Card key={plan.objectiveId} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink-900">{plan.objectiveTitle}</h3>
                <p className="mt-0.5 text-[12.5px] italic text-ink-500">“{plan.question}”</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                <Badge tone="blue">{plan.taskCount} tasks</Badge>
                <Badge tone="gray">{plan.agentsUsed} agents</Badge>
                <Badge tone="amber">{plan.ownerGates.length} owner gates</Badge>
                <Badge tone="green">~{formatMinutes(plan.totalMinutes)} elapsed</Badge>
                <Badge tone="purple">critical path {formatMinutes(plan.criticalPathMinutes)}</Badge>
              </div>
            </div>

            <ol className="mt-4 space-y-3">
              {plan.waves.map((wave) => (
                <li key={wave.wave}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Wave {wave.wave}
                    </span>
                    <span className="text-[11px] text-ink-400">
                      {wave.tasks.length} {wave.tasks.length === 1 ? 'task' : 'tasks'} in parallel
                    </span>
                  </div>
                  <ul className="mt-1.5 space-y-1.5 border-l border-ink-900/10 pl-3">
                    {wave.tasks.map((task) => (
                      <li key={task.id} className="rounded-lg border border-ink-900/10 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-ink-900">{task.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {task.gate === 'OWNER' && <Badge tone="red">Your call</Badge>}
                            <Badge tone="gray">
                              {task.owner.callsign} · {task.minutes} min
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {task.owner.role} — {task.owner.mandate}
                        </p>
                        <p className="mt-1 text-[10.5px] text-ink-400">
                          Needs: {task.resources.join(' · ')}
                          {task.dependsOn.length > 0 && <> · After: {task.dependsOn.join(', ')}</>}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2>The bench</h2>
          <p className="mt-1 text-sm text-ink-400">
            {SPECIALIST_COUNT} defined roles. Autonomy is stated, never implied — nothing publishes,
            reprices, refunds or messages without you.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {departments.map((group) => (
            <Card key={group.department} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink-900">{group.department}</h3>
                <Badge tone="neutral">{group.agents.length}</Badge>
              </div>
              <ul className="mt-2 divide-y divide-ink-900/5">
                {group.agents.map((agent) => (
                  <li key={agent.id} className="flex items-start gap-2 py-1.5">
                    <span className="mt-0.5 w-14 shrink-0 text-[10px] font-bold tabular-nums text-accent-400">
                      {agent.callsign}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink-900">{agent.role}</p>
                      <p className="text-[11px] leading-snug text-ink-400">{agent.mandate}</p>
                    </div>
                    <span title={AUTONOMY_LABELS[agent.autonomy]}>
                      <Badge tone={TONE[agent.autonomy]}>{agent.autonomy}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
