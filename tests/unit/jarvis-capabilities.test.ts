import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPABILITIES,
  CAPABILITY_STATUS_LABEL,
  capabilitySummary,
  ownerActions,
  type CapabilityStatus,
} from '@/lib/jarvis/capabilities';

const ROOT = process.cwd();
const STATUSES: CapabilityStatus[] = ['LIVE', 'PARTIAL', 'BLOCKED', 'NOT_STARTED'];

describe('capability audit', () => {
  it('has unique ids and a known status for every entry', () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAPABILITIES) expect(STATUSES).toContain(c.status);
  });

  it('points every entry at a file that actually exists', () => {
    for (const capability of CAPABILITIES) {
      expect(capability.evidence.length).toBeGreaterThan(0);
      for (const path of capability.evidence) {
        expect(existsSync(join(ROOT, path)), `${capability.id}: ${path} is missing`).toBe(true);
      }
    }
  });

  it('does not claim LIVE without evidence and a gap-free reality', () => {
    for (const capability of CAPABILITIES.filter((c) => c.status === 'LIVE')) {
      expect(capability.evidence.length).toBeGreaterThan(0);
      expect(capability.gap).toBeNull();
    }
  });

  it('names an open gap for everything that is not live', () => {
    for (const capability of CAPABILITIES.filter((c) => c.status !== 'LIVE')) {
      expect(capability.gap, capability.id).toBeTruthy();
    }
  });

  it('labels every status', () => {
    for (const status of STATUSES) expect(CAPABILITY_STATUS_LABEL[status]).toBeTruthy();
  });

  it('summarises reliably', () => {
    const summary = capabilitySummary();
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(CAPABILITIES.length);
  });

  it('marks owner actions as actionable', () => {
    for (const capability of ownerActions()) {
      expect(capability.gap).toBeTruthy();
      expect(capability.status).not.toBe('LIVE');
    }
  });
});
