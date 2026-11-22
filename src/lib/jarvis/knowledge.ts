/**
 * Knowledge base rules (blueprint V3 §2).
 *
 * The rules are enforced here, in pure code, so both the API and the admin UI
 * apply the same definition of "verified":
 *
 *  - VERIFIED needs an official/primary source URL, its title and the date it
 *    was read. An owner's opinion is an ASSUMPTION until a source exists.
 *  - Every entry gets a recheck date. Legal, tax, policy and platform terms go
 *    stale after 30 days; general operational knowledge after 180.
 *  - Nothing may be marked verified in the past or future beyond today.
 *
 * This module is client-safe (no Prisma, no node:*): the admin form imports it.
 */

export const KNOWLEDGE_CATEGORIES = [
  'E-commerce operations',
  'Indian e-commerce regulations',
  'Consumer protection',
  'Product research and catalog management',
  'Supplier and marketplace policies',
  'Pricing and profit calculations',
  'Inventory and order management',
  'Website development',
  'UI/UX and accessibility',
  'SEO and content strategy',
  'Digital marketing',
  'Customer support',
  'Cybersecurity and privacy',
  'Database architecture',
  'API integration',
  'AI agent orchestration',
  'Software testing',
  'Deployment and infrastructure',
  'Analytics and reporting',
  'Business operations',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_SOURCE_TYPES = ['OFFICIAL', 'PRIMARY', 'SECONDARY', 'OWNER_SUPPLIED'] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_CONFIDENCES = ['VERIFIED', 'ESTIMATE', 'ASSUMPTION', 'RECOMMENDATION'] as const;
export type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCES)[number];

export const KNOWLEDGE_STATUSES = ['CURRENT', 'OUTDATED', 'ARCHIVED'] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_LABEL: Record<KnowledgeConfidence, string> = {
  VERIFIED: 'Verified',
  ESTIMATE: 'Estimate',
  ASSUMPTION: 'Assumption',
  RECOMMENDATION: 'Recommendation',
};

export const SOURCE_LABEL: Record<KnowledgeSourceType, string> = {
  OFFICIAL: 'Official documentation',
  PRIMARY: 'Primary source',
  SECONDARY: 'Secondary source',
  OWNER_SUPPLIED: 'Owner-supplied',
};

/** Categories whose answers change often enough to recheck monthly. */
const FAST_MOVING: readonly KnowledgeCategory[] = [
  'Indian e-commerce regulations',
  'Consumer protection',
  'Supplier and marketplace policies',
  'Pricing and profit calculations',
  'Cybersecurity and privacy',
  'API integration',
  'Deployment and infrastructure',
];

export function reviewIntervalDays(category: string): number {
  return (FAST_MOVING as readonly string[]).includes(category) ? 30 : 180;
}

export interface KnowledgeDraft {
  title: string;
  category: string;
  summary: string;
  body: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string | null;
  sourceTitle: string | null;
  publishedAt: string | null;
  verifiedAt: string | null;
  confidence: KnowledgeConfidence;
  status?: KnowledgeStatus;
}

function isIsoDate(value: string | null): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Returns human-readable problems. An empty array means the draft may be saved
 * with the confidence level it claims.
 */
export function validateKnowledgeDraft(draft: KnowledgeDraft, now: Date = new Date()): string[] {
  const issues: string[] = [];
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const body = draft.body.trim();

  if (title.length < 4 || title.length > 160) issues.push('Title must be 4–160 characters.');
  if (!(KNOWLEDGE_CATEGORIES as readonly string[]).includes(draft.category)) {
    issues.push('Choose one of the defined knowledge categories.');
  }
  if (summary.length < 1 || summary.length > 400) issues.push('Summary must be 1–400 characters.');
  if (body.length < 20) issues.push('Body must contain at least 20 characters of real content.');

  if (draft.confidence === 'VERIFIED') {
    if (draft.sourceType !== 'OFFICIAL' && draft.sourceType !== 'PRIMARY') {
      issues.push('Only an official or primary source can support a VERIFIED entry.');
    }
    if (!draft.sourceUrl || !isHttpUrl(draft.sourceUrl)) {
      issues.push('A VERIFIED entry needs a valid http(s) source URL.');
    }
    if (!draft.sourceTitle || draft.sourceTitle.trim().length < 3) {
      issues.push('A VERIFIED entry needs the source title.');
    }
    if (!isIsoDate(draft.verifiedAt)) {
      issues.push('A VERIFIED entry needs the ISO date it was checked (YYYY-MM-DD).');
    }
  }

  if (draft.sourceUrl && !isHttpUrl(draft.sourceUrl)) {
    issues.push('Source URL must start with http:// or https://.');
  }
  if (draft.verifiedAt && !isIsoDate(draft.verifiedAt)) {
    issues.push('Verification date must be YYYY-MM-DD.');
  }
  if (draft.publishedAt && !isIsoDate(draft.publishedAt)) {
    issues.push('Publication date must be YYYY-MM-DD.');
  }
  if (draft.verifiedAt && isIsoDate(draft.verifiedAt)) {
    const verified = Date.parse(`${draft.verifiedAt}T00:00:00Z`);
    if (verified > now.getTime()) issues.push('Verification date cannot be in the future.');
  }
  if (draft.publishedAt && draft.verifiedAt && isIsoDate(draft.publishedAt) && isIsoDate(draft.verifiedAt)) {
    if (Date.parse(draft.publishedAt) > Date.parse(draft.verifiedAt)) {
      issues.push('A source cannot be verified before it was published.');
    }
  }
  if (draft.status === 'OUTDATED' && draft.confidence === 'VERIFIED') {
    // Not an error — the owner may keep a verified historical record — but the
    // label is shown as OUTDATED, never VERIFIED, by knowledgeBadge().
  }
  return issues;
}

export function slugifyKnowledgeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
}

export function nextReviewDate(verifiedOn: string, category: string): string | null {
  if (!isIsoDate(verifiedOn)) return null;
  const date = new Date(`${verifiedOn}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + reviewIntervalDays(category));
  return date.toISOString().slice(0, 10);
}

export function isStale(
  entry: { reviewBy: string | null; status?: string },
  now: Date = new Date()
): boolean {
  if (entry.status === 'ARCHIVED' || entry.status === 'OUTDATED') return false;
  if (!entry.reviewBy) return true;
  return Date.parse(`${entry.reviewBy}T23:59:59Z`) < now.getTime();
}

export interface KnowledgeBadge {
  label: string;
  tone: 'green' | 'amber' | 'blue' | 'gray' | 'red';
}

/** Display label that never lets a stale entry read as current truth. */
export function knowledgeBadge(entry: {
  confidence: string;
  status: string;
  reviewBy: string | null;
  verifiedAt: string | null;
}): KnowledgeBadge {
  if (entry.status === 'ARCHIVED') return { label: 'Archived', tone: 'gray' };
  if (entry.status === 'OUTDATED') return { label: 'Outdated', tone: 'amber' };
  if (isStale(entry)) return { label: 'Needs recheck', tone: 'amber' };
  if (entry.confidence === 'VERIFIED' && entry.verifiedAt) return { label: 'Verified', tone: 'green' };
  if (entry.confidence === 'ESTIMATE') return { label: 'Estimate', tone: 'blue' };
  if (entry.confidence === 'RECOMMENDATION') return { label: 'Recommendation', tone: 'blue' };
  return { label: 'Assumption', tone: 'gray' };
}
