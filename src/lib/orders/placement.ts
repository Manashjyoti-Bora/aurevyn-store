/**
 * Supplier placement provenance.
 *
 * Meesho has no ordering API, so the owner places each purchase by hand and
 * records the reference Meesho returns. That reference is **owner-provided**
 * and unverified until the owner separately confirms it with evidence
 * (blueprint §6.10–§6.11, §11). Treating the pasted string as proof would let
 * a typo silently tell a customer "supplier confirmed".
 *
 * This module is pure: it decides what a supplier-order row's placement state
 * is, and what the store is allowed to say about it. It never writes.
 */

export type PlacementState =
  /** Nothing recorded yet — the owner still has to place this purchase. */
  | 'NOT_PLACED'
  /** The owner pasted a reference. Validity is NOT established. */
  | 'REPORTED'
  /** The owner confirmed the placement with evidence. */
  | 'VERIFIED'
  /** The supplier rejected the order (recorded status). */
  | 'REJECTED';

export const MEESHO_REFERENCE_PATTERN = /^MEESHO-[A-Z0-9-]{4,40}$/;

/** Shortest accepted confirmation note; anything less is not evidence. */
export const MIN_PLACEMENT_EVIDENCE_CHARS = 10;

export interface PlacementRow {
  supplierOrderId: string | null;
  referenceReportedAt: Date | string | null;
  referenceVerifiedAt: Date | string | null;
  status: string;
}

export interface PlacementCopy {
  state: PlacementState;
  /** Admin-facing label. */
  label: string;
  /** Badge tone understood by the admin UI. */
  tone: 'gray' | 'amber' | 'green' | 'red';
  /** What the store may tell the customer. Never claims supplier confirmation. */
  customerNote: string;
  /** True while the customer page must say "confirmation pending". */
  awaitingConfirmation: boolean;
}

/** Normalise a pasted reference; returns null when it is not usable. */
export function parseMeeshoReference(input: string | null | undefined): string | null {
  if (!input) return null;
  const reference = input.trim().toUpperCase();
  return MEESHO_REFERENCE_PATTERN.test(reference) ? reference : null;
}

/** Evidence must be something the owner could stand behind later. */
export function isUsableEvidence(note: string | null | undefined): boolean {
  return (note ?? '').trim().length >= MIN_PLACEMENT_EVIDENCE_CHARS;
}

export function placementState(row: PlacementRow): PlacementState {
  if (row.status === 'REJECTED' || row.status === 'FAILED') return 'REJECTED';
  if (row.referenceVerifiedAt) return 'VERIFIED';
  if (row.referenceReportedAt || row.supplierOrderId) return 'REPORTED';
  return 'NOT_PLACED';
}

export function describePlacement(row: PlacementRow): PlacementCopy {
  const state = placementState(row);
  switch (state) {
    case 'VERIFIED':
      return {
        state,
        label: 'Supplier order confirmed',
        tone: 'green',
        customerNote: 'The supplier order is confirmed and being prepared.',
        awaitingConfirmation: false,
      };
    case 'REPORTED':
      return {
        state,
        label: 'Reference recorded — unverified',
        tone: 'amber',
        customerNote:
          'The supplier order reference is recorded. Supplier confirmation is still pending.',
        awaitingConfirmation: true,
      };
    case 'REJECTED':
      return {
        state,
        label: 'Supplier issue',
        tone: 'red',
        customerNote:
          'The supplier could not accept this order. The store is reviewing the replacement or refund options.',
        awaitingConfirmation: false,
      };
    default:
      return {
        state,
        label: 'Awaiting owner placement',
        tone: 'gray',
        customerNote:
          'Order received. The supplier purchase has not been placed yet, so delivery dates are not confirmed.',
        awaitingConfirmation: true,
      };
  }
}
