/**
 * Knowledge base persistence (blueprint V3 §2).
 *
 * All writes go through `validateKnowledgeDraft`, so an entry can never be
 * stored as VERIFIED without a source and a date. Every change is audited and
 * bumps `version`, which is the changelog trail for that entry.
 */

import { prisma } from '../db';
import { auditLog } from '../audit';
import { badRequest, notFound } from '../errors';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CONFIDENCES,
  KNOWLEDGE_SOURCE_TYPES,
  nextReviewDate,
  slugifyKnowledgeTitle,
  validateKnowledgeDraft,
  type KnowledgeConfidence,
  type KnowledgeDraft,
  type KnowledgeSourceType,
  type KnowledgeStatus,
} from './knowledge';

export interface KnowledgeInput {
  title: string;
  category: string;
  summary: string;
  body: string;
  sourceType: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  publishedAt?: string | null;
  verifiedAt?: string | null;
  confidence: string;
  status?: string;
}

function asIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toUtcDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function assertEnum<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw badRequest(`Unknown ${field}.`);
  }
  return value as T;
}

export async function listKnowledge(limit = 200) {
  return prisma.knowledgeEntry.findMany({
    orderBy: [{ status: 'asc' }, { category: 'asc' }, { updatedAt: 'desc' }],
    take: limit,
  });
}

export async function createKnowledgeEntry(
  input: KnowledgeInput,
  actor: { id: string; email: string }
) {
  const draft: KnowledgeDraft = {
    title: input.title,
    category: input.category,
    summary: input.summary,
    body: input.body,
    sourceType: assertEnum<KnowledgeSourceType>(
      input.sourceType,
      KNOWLEDGE_SOURCE_TYPES,
      'source type'
    ),
    sourceUrl: input.sourceUrl ?? null,
    sourceTitle: input.sourceTitle ?? null,
    publishedAt: input.publishedAt ?? null,
    verifiedAt: input.verifiedAt ?? null,
    confidence: assertEnum<KnowledgeConfidence>(
      input.confidence,
      KNOWLEDGE_CONFIDENCES,
      'confidence'
    ),
    status: (input.status as KnowledgeStatus | undefined) ?? 'CURRENT',
  };

  const issues = validateKnowledgeDraft(draft);
  if (issues.length > 0) throw badRequest(issues[0], issues);

  const base = slugifyKnowledgeTitle(draft.title) || `entry-${Date.now()}`;
  let slug = base;
  for (let attempt = 2; attempt < 20; attempt += 1) {
    const exists = await prisma.knowledgeEntry.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) break;
    slug = `${base}-${attempt}`;
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      slug,
      category: draft.category,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      body: draft.body.trim(),
      sourceType: draft.sourceType,
      sourceUrl: draft.sourceUrl,
      sourceTitle: draft.sourceTitle,
      publishedAt: toUtcDate(draft.publishedAt),
      verifiedAt: toUtcDate(draft.verifiedAt),
      verifiedBy: draft.confidence === 'VERIFIED' ? actor.email : null,
      reviewBy: draft.verifiedAt ? toUtcDate(nextReviewDate(draft.verifiedAt, draft.category)) : null,
      confidence: draft.confidence,
      status: draft.status ?? 'CURRENT',
      createdBy: actor.email,
    },
  });

  await auditLog({
    actor,
    action: 'jarvis.knowledge.created',
    entityType: 'KnowledgeEntry',
    entityId: entry.id,
    data: { slug: entry.slug, confidence: entry.confidence, category: entry.category },
  });

  return entry;
}

/** Re-verify an entry. Requires the date the source was re-read today. */
export async function recheckKnowledgeEntry(
  id: string,
  verifiedOn: string,
  actor: { id: string; email: string }
) {
  const existing = await prisma.knowledgeEntry.findUnique({ where: { id } });
  if (!existing) throw notFound('Knowledge entry not found');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedOn) || Number.isNaN(Date.parse(`${verifiedOn}T00:00:00Z`))) {
    throw badRequest('Verification date must be YYYY-MM-DD.');
  }
  if (Date.parse(`${verifiedOn}T00:00:00Z`) > Date.now()) {
    throw badRequest('Verification date cannot be in the future.');
  }
  if (existing.confidence === 'VERIFIED' && !existing.sourceUrl) {
    throw badRequest('This entry has no source URL, so it cannot be marked verified.');
  }

  const updated = await prisma.knowledgeEntry.update({
    where: { id },
    data: {
      verifiedAt: toUtcDate(verifiedOn),
      verifiedBy: actor.email,
      reviewBy: toUtcDate(nextReviewDate(verifiedOn, existing.category)),
      status: 'CURRENT',
      version: { increment: 1 },
    },
  });

  await auditLog({
    actor,
    action: 'jarvis.knowledge.rechecked',
    entityType: 'KnowledgeEntry',
    entityId: id,
    data: { verifiedOn, version: updated.version },
  });

  return updated;
}

export function knowledgeEvidence(entry: {
  verifiedAt: Date | null;
  sourceUrl: string | null;
}): string {
  const date = asIsoDate(entry.verifiedAt);
  if (entry.sourceUrl && date) return `${entry.sourceUrl} — checked ${date}`;
  if (entry.sourceUrl) return `${entry.sourceUrl} — no verified date`;
  return 'No source recorded';
}

export const KNOWLEDGE_CATEGORY_OPTIONS = KNOWLEDGE_CATEGORIES;
