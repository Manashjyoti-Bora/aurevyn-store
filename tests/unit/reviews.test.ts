import { describe, expect, it } from 'vitest';
import { displayAuthorName, reviewMessage } from '@/lib/reviews/service';

/**
 * These are the two customer-facing strings that are easy to get wrong:
 * the masked author name (privacy) and the eligibility copy (no dead ends).
 */
describe('displayAuthorName', () => {
  it('keeps the first name and only the surname initial', () => {
    expect(displayAuthorName('Rituparna Bora')).toBe('Rituparna B.');
    expect(displayAuthorName('  Manashjyoti   Das  ')).toBe('Manashjyoti D.');
  });

  it('handles a single name without inventing a surname', () => {
    expect(displayAuthorName('Priya')).toBe('Priya');
  });

  it('falls back to a neutral label for an empty name', () => {
    expect(displayAuthorName('   ')).toBe('Verified buyer');
  });
});

describe('reviewMessage', () => {
  it('is empty when the customer may review', () => {
    expect(reviewMessage('OK')).toBe('');
  });

  it('explains every blocked state', () => {
    expect(reviewMessage('NO_DELIVERED_ORDER')).toMatch(/delivered/i);
    expect(reviewMessage('ALREADY_REVIEWED')).toMatch(/already reviewed/i);
    expect(reviewMessage('SIGNED_OUT')).toMatch(/sign in/i);
  });
});
