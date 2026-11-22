import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENT_TOOLS,
  CONNECTORS,
  authorizeToolCall,
  automatedConnectors,
  connectorActivation,
  connectorSummary,
  getConnector,
  getTool,
  toolsRequiringApproval,
} from '@/lib/jarvis/registry';

const ROOT = process.cwd();

describe('connector registry', () => {
  it('has unique ids and evidence files that exist', () => {
    const ids = CONNECTORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const connector of CONNECTORS) {
      expect(connector.evidence.length).toBeGreaterThan(0);
      for (const path of connector.evidence) {
        expect(existsSync(join(ROOT, path)), `${connector.id}: ${path}`).toBe(true);
      }
    }
  });

  it('keeps Meesho manual and disabled with every check still pending', () => {
    const meesho = getConnector('MEESHO');
    expect(meesho).toBeDefined();
    expect(meesho!.status).toBe('DISABLED');
    expect(meesho!.access).toBe('MANUAL_OWNER');
    expect(meesho!.checks.length).toBeGreaterThanOrEqual(6);
    for (const check of meesho!.checks) {
      expect(check.outcome).toBe('PENDING');
      expect(check.sourceUrl).toBeNull();
      expect(check.verifiedOn).toBeNull();
    }
    expect(connectorActivation(meesho!).ok).toBe(false);
  });

  it('never calls an unverified connector active', () => {
    for (const connector of CONNECTORS) {
      if (connectorActivation(connector).ok) {
        for (const check of connector.checks) {
          expect(check.outcome).toBe('PASSED');
          expect(check.sourceUrl).toBeTruthy();
          expect(check.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(check.note).toBeTruthy();
        }
      }
    }
  });

  it('lists the Meesho capability gaps explicitly instead of guessing an API', () => {
    const meesho = getConnector('MEESHO')!;
    expect(meesho.notProvided).toContain('order placement API');
    expect(meesho.notProvided).toContain('catalogue API');
    expect(automatedConnectors().some((c) => c.id === 'MEESHO')).toBe(false);
  });

  it('summarises by status without double counting', () => {
    const summary = connectorSummary();
    expect(Object.values(summary).reduce((a, b) => a + b, 0)).toBe(CONNECTORS.length);
  });
});

describe('agent tool boundary', () => {
  it('has unique tool ids', () => {
    const ids = AGENT_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('requires owner approval for every irreversible tool', () => {
    for (const tool of AGENT_TOOLS.filter((t) => t.permission === 'IRREVERSIBLE')) {
      expect(tool.requiresOwnerApproval).toBe(true);
    }
    expect(toolsRequiringApproval().map((t) => t.id)).toContain('issue-refund');
    expect(toolsRequiringApproval().map((t) => t.id)).toContain('publish-product');
  });

  it('hard-disables supplier placement and production deletion for agents', () => {
    const place = getTool('place-supplier-order')!;
    const del = getTool('delete-production-data')!;
    expect(authorizeToolCall(place, { ownerApproved: true, callsThisCycle: 0 }).allowed).toBe(false);
    expect(authorizeToolCall(del, { ownerApproved: true, callsThisCycle: 0 }).allowed).toBe(false);
  });

  it('denies unapproved writes and approvals', () => {
    const refund = getTool('issue-refund')!;
    expect(authorizeToolCall(refund, { ownerApproved: false, callsThisCycle: 0 }).allowed).toBe(
      false
    );
    expect(authorizeToolCall(refund, { ownerApproved: true, callsThisCycle: 0 }).allowed).toBe(true);
  });

  it('allows read tools within budget and stops at the budget', () => {
    const read = getTool('read-store-state')!;
    expect(authorizeToolCall(read, { ownerApproved: false, callsThisCycle: 0 }).allowed).toBe(true);
    expect(
      authorizeToolCall(read, { ownerApproved: false, callsThisCycle: read.maxCallsPerCycle })
        .allowed
    ).toBe(false);
  });
});
