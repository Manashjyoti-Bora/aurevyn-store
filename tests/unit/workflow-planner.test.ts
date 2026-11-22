import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_ORDER,
  SPECIALISTS,
  SPECIALIST_COUNT,
  getSpecialist,
  specialistsByDepartment,
} from '@/lib/team/agents';
import {
  OBJECTIVES,
  WorkflowPlanError,
  formatMinutes,
  planAllObjectives,
  planWorkflow,
  validateObjective,
} from '@/lib/team/workflow';

describe('team roster', () => {
  it('has more than a hundred specialists', () => {
    expect(SPECIALIST_COUNT).toBeGreaterThan(100);
    expect(SPECIALISTS).toHaveLength(SPECIALIST_COUNT);
  });

  it('uses unique ids and callsigns', () => {
    expect(new Set(SPECIALISTS.map((s) => s.id)).size).toBe(SPECIALIST_COUNT);
    expect(new Set(SPECIALISTS.map((s) => s.callsign)).size).toBe(SPECIALIST_COUNT);
  });

  it('gives every specialist a department, a role and a question', () => {
    for (const specialist of SPECIALISTS) {
      expect(DEPARTMENT_ORDER).toContain(specialist.department);
      expect(specialist.role.length).toBeGreaterThan(2);
      expect(specialist.mandate.endsWith('?')).toBe(true);
      expect(specialist.id).not.toContain(' ');
    }
  });

  it('groups every specialist under exactly one department', () => {
    const grouped = specialistsByDepartment();
    const total = grouped.reduce((sum, group) => sum + group.agents.length, 0);
    expect(total).toBe(SPECIALIST_COUNT);
  });

  it('refuses an unknown specialist', () => {
    expect(() => getSpecialist('nobody')).toThrow(/Unknown specialist/);
  });
});

describe('workflow playbooks', () => {
  it('ships at least four objectives', () => {
    expect(OBJECTIVES.length).toBeGreaterThanOrEqual(4);
  });

  it('validates every playbook without problems', () => {
    for (const objective of OBJECTIVES) {
      expect(validateObjective(objective)).toEqual([]);
    }
  });

  it('detects a cycle instead of hanging', () => {
    const broken = {
      id: 'broken',
      title: 'Broken',
      question: 'Does the guard work?',
      tasks: [
        {
          id: 'a',
          title: 'A',
          ownerId: SPECIALISTS[0].id,
          dependsOn: ['b'],
          minutes: 5,
          resources: [],
          gate: 'NONE' as const,
        },
        {
          id: 'b',
          title: 'B',
          ownerId: SPECIALISTS[0].id,
          dependsOn: ['a'],
          minutes: 5,
          resources: [],
          gate: 'NONE' as const,
        },
      ],
    };
    expect(validateObjective(broken)).toContain('The playbook contains a dependency cycle');
  });
});

describe('planWorkflow', () => {
  it('plans every objective', () => {
    const plans = planAllObjectives();
    expect(plans).toHaveLength(OBJECTIVES.length);
    for (const plan of plans) {
      expect(plan.taskCount).toBeGreaterThan(0);
      expect(plan.waves.length).toBeGreaterThan(0);
      expect(plan.agentsUsed).toBeGreaterThan(1);
    }
  });

  it('respects dependencies in every wave', () => {
    for (const plan of planAllObjectives()) {
      const seen = new Set<string>();
      for (const wave of plan.waves) {
        for (const task of wave.tasks) {
          for (const dep of task.dependsOn) {
            expect(seen.has(dep)).toBe(true);
          }
          seen.add(task.id);
        }
      }
      expect(seen.size).toBe(plan.taskCount);
    }
  });

  it('starts every task after its dependencies finish', () => {
    const plan = planWorkflow('launch');
    const byId = new Map(plan.order.map((task) => [task.id, task]));
    for (const task of plan.order) {
      for (const dep of task.dependsOn) {
        const parent = byId.get(dep);
        expect(parent).toBeDefined();
        expect(task.startsAtMinute).toBeGreaterThanOrEqual(parent!.endsAtMinute);
      }
    }
  });

  it('never finishes before the critical path', () => {
    const plan = planWorkflow('grow');
    expect(plan.totalMinutes).toBeGreaterThanOrEqual(plan.criticalPathMinutes);
    expect(plan.criticalPath.length).toBeGreaterThan(1);
    const byId = new Map(plan.order.map((task) => [task.id, task]));
    const pathMinutes = plan.criticalPath.reduce(
      (sum, id) => sum + (byId.get(id)?.minutes ?? 0),
      0
    );
    expect(pathMinutes).toBe(plan.criticalPathMinutes);
  });

  it('separates owner decisions from team work', () => {
    for (const plan of planAllObjectives()) {
      for (const gate of plan.ownerGates) {
        expect(gate.gate).toBe('OWNER');
      }
      expect(plan.ownerGates.length).toBeLessThan(plan.taskCount);
    }
  });

  it('rejects an unknown objective', () => {
    expect(() => planWorkflow('nope')).toThrow(WorkflowPlanError);
  });

  it('formats durations in plain language', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(95)).toBe('1 h 35 min');
  });
});
