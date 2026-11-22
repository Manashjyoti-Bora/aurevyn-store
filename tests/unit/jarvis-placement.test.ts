import { describe, it, expect } from 'vitest';
import {
  describePlacement,
  isUsableEvidence,
  parseMeeshoReference,
  placementState,
  type PlacementRow,
} from '@/lib/orders/placement';

const row = (over: Partial<PlacementRow> = {}): PlacementRow => ({
  supplierOrderId: null,
  referenceReportedAt: null,
  referenceVerifiedAt: null,
  status: 'QUEUED',
  ...over,
});

describe('parseMeeshoReference', () => {
  it('accepts and normalises a real-looking reference', () => {
    expect(parseMeeshoReference(' meesho-123456789 ')).toBe('MEESHO-123456789');
  });

  it('rejects anything that is not the documented shape', () => {
    expect(parseMeeshoReference('123456789')).toBeNull();
    expect(parseMeeshoReference('MEESHO-1')).toBeNull();
    expect(parseMeeshoReference('AMAZON-123456')).toBeNull();
    expect(parseMeeshoReference('')).toBeNull();
    expect(parseMeeshoReference(null)).toBeNull();
    expect(parseMeeshoReference(undefined)).toBeNull();
  });
});

describe('isUsableEvidence', () => {
  it('requires a note long enough to stand behind', () => {
    expect(isUsableEvidence('ok')).toBe(false);
    expect(isUsableEvidence('         ')).toBe(false);
    expect(isUsableEvidence('Meesho shows Order Confirmed 22 Nov 14:20')).toBe(true);
  });
});

describe('placementState', () => {
  it('is NOT_PLACED until anything is recorded', () => {
    expect(placementState(row())).toBe('NOT_PLACED');
  });

  it('is REPORTED when a reference or report timestamp exists', () => {
    expect(placementState(row({ supplierOrderId: 'MEESHO-12345678' }))).toBe('REPORTED');
    expect(placementState(row({ referenceReportedAt: new Date() }))).toBe('REPORTED');
  });

  it('is VERIFIED only with a verification timestamp', () => {
    expect(
      placementState(
        row({ supplierOrderId: 'MEESHO-12345678', referenceVerifiedAt: new Date() })
      )
    ).toBe('VERIFIED');
  });

  it('reports a supplier issue for rejected or failed legs', () => {
    expect(placementState(row({ status: 'REJECTED' }))).toBe('REJECTED');
    expect(placementState(row({ status: 'FAILED' }))).toBe('REJECTED');
  });
});

describe('describePlacement', () => {
  it('never claims supplier confirmation for a reported-only reference', () => {
    const copy = describePlacement(row({ supplierOrderId: 'MEESHO-12345678' }));
    expect(copy.state).toBe('REPORTED');
    expect(copy.awaitingConfirmation).toBe(true);
    expect(copy.customerNote.toLowerCase()).toContain('pending');
    expect(copy.customerNote.toLowerCase()).not.toContain('confirmed');
  });

  it('does not promise a delivery date before placement', () => {
    const copy = describePlacement(row());
    expect(copy.awaitingConfirmation).toBe(true);
    expect(copy.customerNote.toLowerCase()).not.toContain('delivery date is');
  });

  it('is explicit once verified', () => {
    const copy = describePlacement(
      row({ supplierOrderId: 'MEESHO-12345678', referenceVerifiedAt: new Date() })
    );
    expect(copy.state).toBe('VERIFIED');
    expect(copy.awaitingConfirmation).toBe(false);
  });
});
