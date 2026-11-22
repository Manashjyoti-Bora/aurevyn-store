import { SPECIALISTS, getSpecialist, type Specialist } from './agents';

/**
 * Workflow planning for the Aurevyn team.
 *
 * The planner does the five things a real operations plan needs, in order:
 *
 *  1. Objectives  — each playbook answers one measurable business question.
 *  2. Tasks       — the objective is broken into small, finishable units.
 *  3. Dependencies— every task names what must finish before it can start.
 *  4. Ownership   — exactly one specialist owns each task.
 *  5. Resources   — each task lists the data or access it needs.
 *
 * It then sequences the graph into waves (what can run in parallel), computes
 * the critical path (what decides the finish time) and separates the tasks that
 * need the owner from the ones the team can finish alone.
 *
 * The planner is pure: no database, no clock, no network. That is what makes
 * the plan reproducible and testable.
 */

export type Gate = 'NONE' | 'OWNER';

export interface PlanTask {
  id: string;
  title: string;
  /** Specialist id from `agents.ts`. */
  ownerId: string;
  dependsOn: string[];
  /** Estimated working minutes for one specialist. */
  minutes: number;
  /** Evidence, access or data the task needs. */
  resources: string[];
  gate: Gate;
}

export interface Objective {
  id: string;
  title: string;
  /** The measurable question this playbook answers. */
  question: string;
  tasks: PlanTask[];
}

export const OBJECTIVES: readonly Objective[] = [
  {
    id: 'launch',
    title: 'Publish the first Meesho-sourced products',
    question: 'Can a product go from a pasted Meesho row to a live, honest listing?',
    tasks: [
      {
        id: 'launch-retire',
        title: 'Retire the old catalogue',
        ownerId: 'cat-archive',
        dependsOn: [],
        minutes: 20,
        resources: ['Admin → Products', 'archive list'],
        gate: 'OWNER',
      },
      {
        id: 'launch-intake',
        title: 'Score the pasted Meesho rows',
        ownerId: 'cat-intake',
        dependsOn: [],
        minutes: 15,
        resources: ['Admin → Meesho sourcing'],
        gate: 'NONE',
      },
      {
        id: 'launch-dedupe',
        title: 'Check for duplicates',
        ownerId: 'cat-dedupe',
        dependsOn: ['launch-intake'],
        minutes: 10,
        resources: ['sourcing candidates', 'live catalogue'],
        gate: 'NONE',
      },
      {
        id: 'launch-title',
        title: 'Clean the title and attributes',
        ownerId: 'cat-clean',
        dependsOn: ['launch-intake'],
        minutes: 20,
        resources: ['supplier row text'],
        gate: 'NONE',
      },
      {
        id: 'launch-specs',
        title: 'Build the specification sheet',
        ownerId: 'cat-specs',
        dependsOn: ['launch-intake'],
        minutes: 20,
        resources: ['supplier row text'],
        gate: 'NONE',
      },
      {
        id: 'launch-cost',
        title: 'Compute the landed cost',
        ownerId: 'price-cost',
        dependsOn: ['launch-specs'],
        minutes: 15,
        resources: ['supplier price', 'shipping', 'packaging'],
        gate: 'NONE',
      },
      {
        id: 'launch-margin',
        title: 'Check the margin floor',
        ownerId: 'price-margin',
        dependsOn: ['launch-cost'],
        minutes: 10,
        resources: ['pricing rules'],
        gate: 'NONE',
      },
      {
        id: 'launch-draft',
        title: 'Assemble a complete draft',
        ownerId: 'cat-draft',
        dependsOn: ['launch-title', 'launch-specs', 'launch-margin'],
        minutes: 15,
        resources: ['draft product'],
        gate: 'NONE',
      },
      {
        id: 'launch-quality',
        title: 'Score the listing quality',
        ownerId: 'cat-quality',
        dependsOn: ['launch-draft'],
        minutes: 10,
        resources: ['draft product'],
        gate: 'NONE',
      },
      {
        id: 'launch-images',
        title: 'Attach real photography',
        ownerId: 'cat-images',
        dependsOn: ['launch-draft'],
        minutes: 30,
        resources: ['owner photo upload'],
        gate: 'OWNER',
      },
      {
        id: 'launch-seo',
        title: 'Write the search snippet',
        ownerId: 'grow-meta',
        dependsOn: ['launch-draft'],
        minutes: 15,
        resources: ['draft product'],
        gate: 'NONE',
      },
      {
        id: 'launch-publish',
        title: 'Publish after the owner approves',
        ownerId: 'cat-publish',
        dependsOn: ['launch-quality', 'launch-images', 'launch-seo'],
        minutes: 5,
        resources: ['Admin → Products'],
        gate: 'OWNER',
      },
      {
        id: 'launch-verify',
        title: 'Verify the live page and health',
        ownerId: 'rel-health',
        dependsOn: ['launch-publish'],
        minutes: 10,
        resources: ['/api/health', 'product URL'],
        gate: 'NONE',
      },
    ],
  },
  {
    id: 'grow',
    title: 'Earn qualified search traffic',
    question: 'Can a stranger searching for this product find and trust the store?',
    tasks: [
      {
        id: 'grow-audit',
        title: 'Audit titles and descriptions',
        ownerId: 'grow-meta',
        dependsOn: [],
        minutes: 30,
        resources: ['sitemap', 'live pages'],
        gate: 'NONE',
      },
      {
        id: 'grow-schema',
        title: 'Validate structured data',
        ownerId: 'grow-schema',
        dependsOn: ['grow-audit'],
        minutes: 20,
        resources: ['product and ItemList JSON-LD'],
        gate: 'NONE',
      },
      {
        id: 'grow-sitemap',
        title: 'Rebuild and check the sitemap',
        ownerId: 'grow-sitemap',
        dependsOn: ['grow-schema'],
        minutes: 10,
        resources: ['/sitemap.xml'],
        gate: 'NONE',
      },
      {
        id: 'grow-links',
        title: 'Add internal links',
        ownerId: 'grow-links',
        dependsOn: ['grow-audit'],
        minutes: 20,
        resources: ['live pages'],
        gate: 'NONE',
      },
      {
        id: 'grow-alt',
        title: 'Write alt text',
        ownerId: 'content-alt',
        dependsOn: ['grow-audit'],
        minutes: 20,
        resources: ['product images'],
        gate: 'NONE',
      },
      {
        id: 'grow-cwv',
        title: 'Check Core Web Vitals',
        ownerId: 'grow-cwv',
        dependsOn: ['grow-sitemap'],
        minutes: 25,
        resources: ['page speed report'],
        gate: 'NONE',
      },
      {
        id: 'grow-gsc',
        title: 'Submit the sitemap in Search Console',
        ownerId: 'grow-gsc',
        dependsOn: ['grow-sitemap'],
        minutes: 15,
        resources: ['Search Console account'],
        gate: 'OWNER',
      },
      {
        id: 'grow-backlinks',
        title: 'Earn two relevant citations',
        ownerId: 'grow-backlinks',
        dependsOn: ['grow-links'],
        minutes: 30,
        resources: ['supplier or local directory listings'],
        gate: 'OWNER',
      },
      {
        id: 'grow-report',
        title: 'Brief the owner on what moved',
        ownerId: 'lead-brief',
        dependsOn: ['grow-cwv', 'grow-alt', 'grow-backlinks'],
        minutes: 10,
        resources: ['team briefings'],
        gate: 'NONE',
      },
    ],
  },
  {
    id: 'fulfil',
    title: 'Ship every paid order on time',
    question: 'Can we turn a paid order into a delivered parcel without the owner chasing it?',
    tasks: [
      {
        id: 'ful-inbox',
        title: 'Triage new orders and messages',
        ownerId: 'care-inbox',
        dependsOn: [],
        minutes: 5,
        resources: ['Admin → Orders'],
        gate: 'NONE',
      },
      {
        id: 'ful-place',
        title: 'Place the order on Meesho',
        ownerId: 'supply-meesho',
        dependsOn: ['ful-inbox'],
        minutes: 10,
        resources: ['Meesho app', 'customer address'],
        gate: 'OWNER',
      },
      {
        id: 'ful-id',
        title: 'Record the Meesho confirmation ID',
        ownerId: 'supply-id',
        dependsOn: ['ful-place'],
        minutes: 5,
        resources: ['Admin → Supplier orders'],
        gate: 'NONE',
      },
      {
        id: 'ful-track',
        title: 'Capture the tracking number',
        ownerId: 'supply-tracking',
        dependsOn: ['ful-id'],
        minutes: 10,
        resources: ['Meesho shipment'],
        gate: 'NONE',
      },
      {
        id: 'ful-sla',
        title: 'Check the dispatch SLA',
        ownerId: 'supply-dispatch-sla',
        dependsOn: ['ful-id'],
        minutes: 10,
        resources: ['order timestamps'],
        gate: 'NONE',
      },
      {
        id: 'ful-notify',
        title: 'Draft the tracking message',
        ownerId: 'care-status',
        dependsOn: ['ful-track'],
        minutes: 5,
        resources: ['tracking number'],
        gate: 'NONE',
      },
      {
        id: 'ful-close',
        title: 'Close the day’s books',
        ownerId: 'fin-close',
        dependsOn: ['ful-notify', 'ful-sla'],
        minutes: 15,
        resources: ['payments', 'payouts'],
        gate: 'NONE',
      },
    ],
  },
  {
    id: 'clean',
    title: 'Keep the store clean and honest',
    question: 'Is everything on sale accurate, priced above cost and reachable?',
    tasks: [
      {
        id: 'clean-archive',
        title: 'Approve the archive list',
        ownerId: 'cat-archive',
        dependsOn: [],
        minutes: 20,
        resources: ['Admin → Products'],
        gate: 'OWNER',
      },
      {
        id: 'clean-dedupe',
        title: 'Merge duplicates',
        ownerId: 'cat-dedupe',
        dependsOn: ['clean-archive'],
        minutes: 15,
        resources: ['live catalogue'],
        gate: 'NONE',
      },
      {
        id: 'clean-quality',
        title: 'Flag weak listings',
        ownerId: 'cat-quality',
        dependsOn: ['clean-dedupe'],
        minutes: 15,
        resources: ['product images', 'copy'],
        gate: 'NONE',
      },
      {
        id: 'clean-cost',
        title: 'Recheck below-cost prices',
        ownerId: 'price-floor',
        dependsOn: [],
        minutes: 15,
        resources: ['landed costs'],
        gate: 'NONE',
      },
      {
        id: 'clean-stock',
        title: 'Reconcile stock',
        ownerId: 'cat-stock',
        dependsOn: ['clean-dedupe'],
        minutes: 15,
        resources: ['supplier stock'],
        gate: 'NONE',
      },
      {
        id: 'clean-links',
        title: 'Sweep broken links',
        ownerId: 'grow-broken',
        dependsOn: ['clean-quality'],
        minutes: 15,
        resources: ['live pages'],
        gate: 'NONE',
      },
      {
        id: 'clean-sitemap',
        title: 'Refresh the sitemap',
        ownerId: 'grow-sitemap',
        dependsOn: ['clean-links'],
        minutes: 10,
        resources: ['/sitemap.xml'],
        gate: 'NONE',
      },
      {
        id: 'clean-report',
        title: 'Report what changed',
        ownerId: 'lead-brief',
        dependsOn: ['clean-cost', 'clean-stock', 'clean-sitemap'],
        minutes: 10,
        resources: ['team briefings'],
        gate: 'NONE',
      },
    ],
  },
];

export interface PlannedTask extends PlanTask {
  owner: Specialist;
  /** Parallel execution wave; 1 starts immediately. */
  wave: number;
  startsAtMinute: number;
  endsAtMinute: number;
}

export interface PlanWave {
  wave: number;
  tasks: PlannedTask[];
}

export interface WorkflowPlan {
  objectiveId: string;
  objectiveTitle: string;
  question: string;
  waves: PlanWave[];
  order: PlannedTask[];
  /** Wall-clock minutes if every wave runs fully in parallel. */
  totalMinutes: number;
  /** Longest dependency chain, which decides the finish time. */
  criticalPathMinutes: number;
  criticalPath: string[];
  ownerGates: PlannedTask[];
  agentsUsed: number;
  taskCount: number;
}

export class WorkflowPlanError extends Error {}

/** Static checks a playbook must pass before it can be planned. */
export function validateObjective(objective: Objective): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const known = new Set(SPECIALISTS.map((s) => s.id));

  for (const task of objective.tasks) {
    if (ids.has(task.id)) problems.push(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!known.has(task.ownerId)) problems.push(`${task.id} has unknown owner ${task.ownerId}`);
    if (!Number.isFinite(task.minutes) || task.minutes <= 0) {
      problems.push(`${task.id} needs a positive duration`);
    }
  }

  for (const task of objective.tasks) {
    for (const dep of task.dependsOn) {
      if (!ids.has(dep)) problems.push(`${task.id} depends on missing task ${dep}`);
      if (dep === task.id) problems.push(`${task.id} depends on itself`);
    }
  }

  if (problems.length === 0) {
    // Cycle detection: Kahn's algorithm must consume every task.
    const indegree = new Map(objective.tasks.map((t) => [t.id, t.dependsOn.length]));
    const queue = objective.tasks.filter((t) => t.dependsOn.length === 0).map((t) => t.id);
    let visited = 0;
    while (queue.length > 0) {
      const id = queue.shift() as string;
      visited += 1;
      for (const task of objective.tasks) {
        if (!task.dependsOn.includes(id)) continue;
        const next = (indegree.get(task.id) ?? 0) - 1;
        indegree.set(task.id, next);
        if (next === 0) queue.push(task.id);
      }
    }
    if (visited !== objective.tasks.length)
      problems.push('The playbook contains a dependency cycle');
  }

  return problems;
}

export function getObjective(id: string): Objective {
  const found = OBJECTIVES.find((o) => o.id === id);
  if (!found) throw new WorkflowPlanError(`Unknown objective: ${id}`);
  return found;
}

/**
 * Turn a playbook into an executable plan.
 *
 * Waves come from the longest dependency chain that reaches each task, so two
 * tasks in the same wave never depend on each other and can be handed to two
 * specialists at the same time.
 */
export function planWorkflow(objectiveId: string): WorkflowPlan {
  const objective = getObjective(objectiveId);
  const problems = validateObjective(objective);
  if (problems.length > 0) throw new WorkflowPlanError(problems.join('; '));

  const byId = new Map(objective.tasks.map((t) => [t.id, t]));
  const scheduled = new Map<string, PlannedTask>();

  const schedule = (task: PlanTask): PlannedTask => {
    const existing = scheduled.get(task.id);
    if (existing) return existing;

    const deps = task.dependsOn.map((dep) => schedule(byId.get(dep) as PlanTask));
    const startsAtMinute = deps.reduce((max, dep) => Math.max(max, dep.endsAtMinute), 0);
    const planned: PlannedTask = {
      ...task,
      owner: getSpecialist(task.ownerId),
      wave: deps.reduce((max, dep) => Math.max(max, dep.wave), 0) + 1,
      startsAtMinute,
      endsAtMinute: startsAtMinute + task.minutes,
    };
    scheduled.set(task.id, planned);
    return planned;
  };

  for (const task of objective.tasks) schedule(task);

  const order = [...scheduled.values()].sort(
    (a, b) => a.wave - b.wave || a.startsAtMinute - b.startsAtMinute || a.id.localeCompare(b.id)
  );

  const waves: PlanWave[] = [];
  for (const task of order) {
    const wave = waves.find((w) => w.wave === task.wave);
    if (wave) wave.tasks.push(task);
    else waves.push({ wave: task.wave, tasks: [task] });
  }

  const totalMinutes = order.reduce((max, task) => Math.max(max, task.endsAtMinute), 0);

  // Critical path: walk back from the last-finishing task through the
  // dependency that finishes last, so every minute on the path is real.
  let cursor = order.reduce<PlannedTask | null>(
    (slowest, task) => (!slowest || task.endsAtMinute > slowest.endsAtMinute ? task : slowest),
    null
  );
  const criticalPath: string[] = [];
  while (cursor) {
    criticalPath.unshift(cursor.id);
    const deps = cursor.dependsOn.map((dep) => scheduled.get(dep) as PlannedTask);
    cursor = deps.length
      ? deps.reduce((slowest, dep) => (dep.endsAtMinute > slowest.endsAtMinute ? dep : slowest))
      : null;
  }
  const criticalPathMinutes = criticalPath.reduce(
    (sum, id) => sum + (scheduled.get(id) as PlannedTask).minutes,
    0
  );

  return {
    objectiveId: objective.id,
    objectiveTitle: objective.title,
    question: objective.question,
    waves,
    order,
    totalMinutes,
    criticalPathMinutes,
    criticalPath,
    ownerGates: order.filter((task) => task.gate === 'OWNER'),
    agentsUsed: new Set(order.map((task) => task.ownerId)).size,
    taskCount: order.length,
  };
}

/** Every objective, planned — the board the admin console renders. */
export function planAllObjectives(): WorkflowPlan[] {
  return OBJECTIVES.map((objective) => planWorkflow(objective.id));
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
