import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { scoreSourcingCandidate } from './score';
import { externalKeyFor } from './meesho';
import type {
  SourcingCandidateInput,
  SourcingCandidateRecord,
  SourcingScoreOptions,
} from './types';

/**
 * Sourcing store.
 *
 * Candidates are scored at ingest time and stored with their evidence, so the
 * owner can compare today's shortlist with last week's and see what changed.
 * Turning a candidate into a product always creates a DRAFT: publishing stays
 * an owner decision, which is the same rule the rest of the admin enforces.
 */

const DEFAULT_LIMIT = 60;

function toRecord(row: {
  id: string;
  externalKey: string;
  name: string;
  meeshoUrl: string | null;
  sku: string | null;
  supplierPricePaise: number;
  shippingPaise: number;
  mrpPaise: number | null;
  rating: number | null;
  reviewCount: number | null;
  unitsSold: number | null;
  returnRatePercent: number | null;
  trendScore: number | null;
  landedCostPaise: number;
  suggestedPricePaise: number;
  marginPaise: number;
  marginPercent: number;
  score: number;
  verdict: string;
  reasons: Prisma.JsonValue;
  flags: Prisma.JsonValue;
  status: string;
  productId: string | null;
  createdAt: Date;
}): SourcingCandidateRecord {
  return {
    id: row.id,
    externalKey: row.externalKey,
    name: row.name,
    meeshoUrl: row.meeshoUrl,
    sku: row.sku,
    supplierPricePaise: row.supplierPricePaise,
    shippingPaise: row.shippingPaise,
    mrpPaise: row.mrpPaise,
    rating: row.rating,
    reviewCount: row.reviewCount,
    unitsSold: row.unitsSold,
    returnRatePercent: row.returnRatePercent,
    trendScore: row.trendScore,
    landedCostPaise: row.landedCostPaise,
    suggestedPricePaise: row.suggestedPricePaise,
    marginPaise: row.marginPaise,
    marginPercent: row.marginPercent,
    score: row.score,
    verdict: row.verdict as SourcingCandidateRecord['verdict'],
    reasons: Array.isArray(row.reasons) ? (row.reasons as string[]) : [],
    flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
    status: row.status as SourcingCandidateRecord['status'],
    productId: row.productId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function scoreOptionsFromSettings(): Promise<SourcingScoreOptions> {
  const settings = await getSettings();
  return {
    minMarginPercent: settings.pricing.minMarginPercent,
  };
}

/** Score and upsert a batch. Re-ingesting the same listing updates its evidence. */
export async function ingestSourcingCandidates(
  inputs: SourcingCandidateInput[]
): Promise<SourcingCandidateRecord[]> {
  const options = await scoreOptionsFromSettings();
  const saved: SourcingCandidateRecord[] = [];

  for (const input of inputs) {
    const score = scoreSourcingCandidate(input, options);
    const externalKey = externalKeyFor(input);
    const data = {
      name: input.name,
      meeshoUrl: input.meeshoUrl ?? null,
      sku: input.sku ?? null,
      supplierPricePaise: input.supplierPricePaise,
      shippingPaise: input.shippingPaise ?? 0,
      mrpPaise: input.mrpPaise ?? null,
      rating: input.rating ?? null,
      reviewCount: input.reviewCount ?? null,
      unitsSold: input.unitsSold ?? null,
      returnRatePercent: input.returnRatePercent ?? null,
      trendScore: input.trendScore ?? null,
      landedCostPaise: score.landedCostPaise,
      suggestedPricePaise: score.suggestedPricePaise,
      marginPaise: score.marginPaise,
      marginPercent: score.marginPercent,
      score: score.score,
      verdict: score.verdict,
      reasons: score.reasons as unknown as Prisma.InputJsonValue,
      flags: score.flags as unknown as Prisma.InputJsonValue,
    };

    const row = await prisma.sourcingCandidate.upsert({
      where: { externalKey },
      create: { externalKey, ...data },
      update: data,
    });
    saved.push(toRecord(row));
  }

  return saved;
}

export async function listSourcingCandidates(take = DEFAULT_LIMIT): Promise<SourcingCandidateRecord[]> {
  const rows = await prisma.sourcingCandidate.findMany({
    orderBy: [{ score: 'desc' }, { marginPercent: 'desc' }, { createdAt: 'desc' }],
    take: Math.min(Math.max(take, 1), 200),
  });
  return rows.map(toRecord);
}

export async function dismissSourcingCandidate(id: string): Promise<void> {
  await prisma.sourcingCandidate.update({ where: { id }, data: { status: 'DISMISSED' } });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Create a DRAFT product from a scored candidate.
 *
 * The draft carries the real landed cost and the suggested selling price, so
 * the margin is already correct when the owner adds photos and publishes. No
 * description is invented: the short description states where the product came
 * from and what still has to be filled in.
 */
export async function createDraftFromCandidate(id: string): Promise<{ productId: string; slug: string }> {
  const candidate = await prisma.sourcingCandidate.findUnique({ where: { id } });
  if (!candidate) throw new Error('Candidate not found');
  if (candidate.productId) return { productId: candidate.productId, slug: '' };

  const base = slugify(candidate.name) || 'meesho-product';
  let slug = base;
  for (let attempt = 2; attempt < 50; attempt += 1) {
    const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    slug = `${base}-${attempt}`;
  }

  const product = await prisma.product.create({
    data: {
      name: candidate.name,
      slug,
      description:
        'Sourced from Meesho. Add the real product description, specifications and photographs before publishing — the store does not invent product detail.',
      shortDescription: `Meesho-sourced · landed cost ${(candidate.landedCostPaise / 100).toFixed(0)} · suggested price ${(candidate.suggestedPricePaise / 100).toFixed(0)}`,
      status: 'DRAFT',
      supplierCost: (candidate.supplierPricePaise / 100).toFixed(2),
      supplierShippingCost: (candidate.shippingPaise / 100).toFixed(2),
      sellingPrice: (candidate.suggestedPricePaise / 100).toFixed(2),
      fixedPrice: (candidate.suggestedPricePaise / 100).toFixed(2),
      pricingMode: 'FIXED_PRICE',
      compareAtPrice: candidate.mrpPaise ? (candidate.mrpPaise / 100).toFixed(2) : null,
      stockMode: 'SUPPLIER_SYNC',
      seoTitle: candidate.name.slice(0, 70),
    },
    select: { id: true, slug: true },
  });

  await prisma.sourcingCandidate.update({
    where: { id },
    data: { productId: product.id, status: 'DRAFTED' },
  });

  return { productId: product.id, slug: product.slug };
}
