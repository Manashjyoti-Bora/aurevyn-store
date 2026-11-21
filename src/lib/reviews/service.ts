import { Prisma } from '@prisma/client';
import { prisma } from '../db';

/**
 * Product reviews & ratings.
 *
 * Hard rule: a review can only be written by a signed-in customer holding a
 * DELIVERED order line for that product. There is no seeding path, no import
 * path and no admin "add review" action anywhere in this codebase, so every
 * star and every testimonial rendered on the storefront is a real purchase.
 * Reviews are published immediately (they are verified purchases); the
 * `ReviewStatus` enum exists so a future moderation queue can hold or hide a
 * review without a schema change.
 */

export const REVIEW_BODY_MIN = 20;
export const REVIEW_BODY_MAX = 2000;
export const REVIEW_MAX_PHOTOS = 4;
export const REVIEW_TITLE_MAX = 120;

export type RatingBucket = 1 | 2 | 3 | 4 | 5;

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<RatingBucket, number>;
}

export const EMPTY_SUMMARY: ReviewSummary = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export type ReviewEligibilityReason =
  | 'OK'
  | 'SIGNED_OUT'
  | 'NO_DELIVERED_ORDER'
  | 'ALREADY_REVIEWED';

/** Discriminated union: `canReview: true` always carries the OK reason. */
export type ReviewEligibility =
  | { canReview: true; reason: 'OK'; orderItemId: string }
  | {
      canReview: false;
      reason: Exclude<ReviewEligibilityReason, 'OK'>;
      orderItemId: null;
    };

export class ReviewError extends Error {
  constructor(
    readonly reason: Exclude<ReviewEligibilityReason, 'OK'>,
    message: string
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export const REVIEW_MESSAGES: Record<Exclude<ReviewEligibilityReason, 'OK'>, string> = {
  SIGNED_OUT: 'Sign in to review a product you have received.',
  NO_DELIVERED_ORDER: 'Reviews are open to customers whose order has been delivered.',
  ALREADY_REVIEWED: 'You have already reviewed this product.',
};

/** Human message for an eligibility reason ('' when the customer may review). */
export function reviewMessage(reason: ReviewEligibilityReason): string {
  return reason === 'OK' ? '' : REVIEW_MESSAGES[reason];
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  photos: string[];
  videoUrl: string | null;
  verifiedPurchase: boolean;
  createdAt: Date;
}

const reviewSelect = {
  id: true,
  rating: true,
  title: true,
  body: true,
  authorName: true,
  photos: true,
  videoUrl: true,
  verifiedPurchase: true,
  createdAt: true,
} satisfies Prisma.ProductReviewSelect;

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const rows = await prisma.productReview.groupBy({
    by: ['rating'],
    where: { productId, status: 'PUBLISHED' },
    _count: { _all: true },
  });
  const distribution: Record<RatingBucket, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let weighted = 0;
  for (const row of rows) {
    const bucket = row.rating as RatingBucket;
    if (bucket >= 1 && bucket <= 5) distribution[bucket] = row._count._all;
    total += row._count._all;
    weighted += row.rating * row._count._all;
  }
  return {
    average: total === 0 ? 0 : Math.round((weighted / total) * 10) / 10,
    count: total,
    distribution,
  };
}

export async function listProductReviews(productId: string, limit = 12): Promise<PublicReview[]> {
  return prisma.productReview.findMany({
    where: { productId, status: 'PUBLISHED' },
    select: reviewSelect,
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(Math.max(limit, 1), 50),
  });
}

/**
 * Ratings for a batch of products, for shop/home cards. Returns only products
 * that actually have published reviews - a card with no rating must render no
 * stars at all rather than a fabricated "0.0 (0)".
 */
export async function ratingsForProducts(
  productIds: string[]
): Promise<Map<string, { average: number; count: number }>> {
  const out = new Map<string, { average: number; count: number }>();
  if (productIds.length === 0) return out;
  const rows = await prisma.productReview.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (row._avg.rating == null || row._count._all === 0) continue;
    out.set(row.productId, {
      average: Math.round(row._avg.rating * 10) / 10,
      count: row._count._all,
    });
  }
  return out;
}

/** Newest published reviews across the catalogue (home page social proof). */
export async function listRecentReviews(limit = 6) {
  return prisma.productReview.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      ...reviewSelect,
      product: { select: { name: true, slug: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(Math.max(limit, 1), 24),
  });
}

export async function getReviewEligibility(
  userId: string | null,
  productId: string
): Promise<ReviewEligibility> {
  if (!userId) return { canReview: false, reason: 'SIGNED_OUT', orderItemId: null };

  const existing = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  });
  if (existing) return { canReview: false, reason: 'ALREADY_REVIEWED', orderItemId: null };

  const delivered = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: 'DELIVERED' } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!delivered) return { canReview: false, reason: 'NO_DELIVERED_ORDER', orderItemId: null };

  return { canReview: true, reason: 'OK', orderItemId: delivered.id };
}

/** "Rituparna Bora" -> "Rituparna B." — never the full name, never the e-mail. */
export function displayAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Verified buyer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function sanitiseMediaUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

export interface CreateReviewInput {
  userId: string;
  productId: string;
  rating: number;
  title?: string | null;
  body: string;
  photos?: string[];
  videoUrl?: string | null;
}

export async function createProductReview(input: CreateReviewInput) {
  const rating = Math.trunc(input.rating);
  if (rating < 1 || rating > 5) throw new ReviewError('NO_DELIVERED_ORDER', 'Choose 1–5 stars.');

  const body = input.body.trim();
  if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) {
    throw new ReviewError(
      'NO_DELIVERED_ORDER',
      `Write between ${REVIEW_BODY_MIN} and ${REVIEW_BODY_MAX} characters.`
    );
  }

  const eligibility = await getReviewEligibility(input.userId, input.productId);
  if (!eligibility.canReview) {
    throw new ReviewError(eligibility.reason, REVIEW_MESSAGES[eligibility.reason]);
  }

  const [user, product] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } }),
  ]);
  if (!product) throw new ReviewError('NO_DELIVERED_ORDER', 'Product not found.');

  const photos = (input.photos ?? [])
    .map(sanitiseMediaUrl)
    .filter((v): v is string => v !== null)
    .slice(0, REVIEW_MAX_PHOTOS);
  const videoUrl = input.videoUrl ? sanitiseMediaUrl(input.videoUrl) : null;
  const title = input.title?.trim().slice(0, REVIEW_TITLE_MAX) || null;

  try {
    return await prisma.productReview.create({
      data: {
        productId: input.productId,
        userId: input.userId,
        orderItemId: eligibility.orderItemId,
        rating,
        title,
        body,
        authorName: displayAuthorName(user?.name ?? ''),
        photos,
        videoUrl,
        verifiedPurchase: true,
        status: 'PUBLISHED',
      },
      select: reviewSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ReviewError('ALREADY_REVIEWED', REVIEW_MESSAGES.ALREADY_REVIEWED);
    }
    throw error;
  }
}
