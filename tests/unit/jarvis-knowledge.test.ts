import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_CATEGORIES,
  isStale,
  knowledgeBadge,
  nextReviewDate,
  reviewIntervalDays,
  slugifyKnowledgeTitle,
  validateKnowledgeDraft,
  type KnowledgeDraft,
} from '@/lib/jarvis/knowledge';

const verified: KnowledgeDraft = {
  title: 'Consumer protection response window',
  category: 'Consumer protection',
  summary: 'A written acknowledgement is required within the statutory window.',
  body: 'Record the exact rule, its source and the date it was read before relying on it.',
  sourceType: 'OFFICIAL',
  sourceUrl: 'https://consumeraffairs.nic.in/',
  sourceTitle: 'Department of Consumer Affairs',
  publishedAt: '2020-07-20',
  verifiedAt: '2026-11-20',
  confidence: 'VERIFIED',
};

describe('knowledge rules', () => {
  it('defines all twenty blueprint categories', () => {
    expect(KNOWLEDGE_CATEGORIES).toHaveLength(20);
    expect(new Set(KNOWLEDGE_CATEGORIES).size).toBe(20);
  });

  it('accepts a sourced VERIFIED entry', () => {
    expect(validateKnowledgeDraft(verified, new Date('2026-11-22T00:00:00Z'))).toEqual([]);
  });

  it('refuses VERIFIED without a source, title or date', () => {
    const noUrl = validateKnowledgeDraft({ ...verified, sourceUrl: null });
    expect(noUrl.join(' ')).toContain('source URL');

    const noTitle = validateKnowledgeDraft({ ...verified, sourceTitle: null });
    expect(noTitle.join(' ')).toContain('source title');

    const noDate = validateKnowledgeDraft({ ...verified, verifiedAt: null });
    expect(noDate.join(' ')).toContain('ISO date');
  });

  it('refuses a secondary source for VERIFIED', () => {
    const issues = validateKnowledgeDraft({ ...verified, sourceType: 'SECONDARY' });
    expect(issues.join(' ')).toContain('official or primary');
  });

  it('allows an unsourced estimate to be stored honestly', () => {
    const estimate: KnowledgeDraft = {
      ...verified,
      sourceType: 'OWNER_SUPPLIED',
      sourceUrl: null,
      sourceTitle: null,
      verifiedAt: null,
      confidence: 'ESTIMATE',
    };
    expect(validateKnowledgeDraft(estimate)).toEqual([]);
  });

  it('rejects future verification dates and impossible publication dates', () => {
    const future = validateKnowledgeDraft(
      { ...verified, verifiedAt: '2099-01-01' },
      new Date('2026-11-22T00:00:00Z')
    );
    expect(future.join(' ')).toContain('future');

    const backwards = validateKnowledgeDraft({ ...verified, publishedAt: '2026-11-21' });
    expect(backwards.join(' ')).toContain('before it was published');
  });

  it('rejects unknown categories and thin content', () => {
    expect(validateKnowledgeDraft({ ...verified, category: 'Vibes' }).join(' ')).toContain(
      'defined knowledge categories'
    );
    expect(validateKnowledgeDraft({ ...verified, body: 'too short' }).join(' ')).toContain(
      'at least 20'
    );
  });

  it('slugifies titles deterministically', () => {
    expect(slugifyKnowledgeTitle('Meesho Policy — Returns & RTO')).toBe(
      'meesho-policy-returns-rto'
    );
  });

  it('schedules rechecks sooner for fast-moving categories', () => {
    expect(reviewIntervalDays('Supplier and marketplace policies')).toBe(30);
    expect(reviewIntervalDays('E-commerce operations')).toBe(180);
    expect(nextReviewDate('2026-11-01', 'Supplier and marketplace policies')).toBe('2026-12-01');
    expect(nextReviewDate('not-a-date', 'E-commerce operations')).toBeNull();
  });

  it('marks an entry stale after its recheck date and never calls it verified', () => {
    const now = new Date('2026-11-22T00:00:00Z');
    expect(isStale({ reviewBy: '2026-11-01' }, now)).toBe(true);
    expect(isStale({ reviewBy: '2026-12-01' }, now)).toBe(false);
    expect(isStale({ reviewBy: null }, now)).toBe(true);
    expect(isStale({ reviewBy: '2026-11-01', status: 'ARCHIVED' }, now)).toBe(false);

    const staleBadge = knowledgeBadge({
      confidence: 'VERIFIED',
      status: 'CURRENT',
      reviewBy: '2026-11-01',
      verifiedAt: '2026-06-01',
    });
    expect(staleBadge.label).toBe('Needs recheck');

    const outdated = knowledgeBadge({
      confidence: 'VERIFIED',
      status: 'OUTDATED',
      reviewBy: '2027-01-01',
      verifiedAt: '2026-06-01',
    });
    expect(outdated.label).toBe('Outdated');

    const fresh = knowledgeBadge({
      confidence: 'VERIFIED',
      status: 'CURRENT',
      reviewBy: '2027-01-01',
      verifiedAt: '2026-06-01',
    });
    expect(fresh.label).toBe('Verified');
  });
});
