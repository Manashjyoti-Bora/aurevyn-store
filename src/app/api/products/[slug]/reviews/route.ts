import { z } from 'zod';
import { apiRoute, badRequest, forbidden, jsonOk, notFound, unauthorized } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/guards';
import { assertRateLimit } from '@/lib/rate-limit';
import { clientIp, readJson } from '@/lib/http';
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_MAX_PHOTOS,
  REVIEW_TITLE_MAX,
  ReviewError,
  createProductReview,
  getReviewEligibility,
  getReviewSummary,
  listProductReviews,
} from '@/lib/reviews/service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(REVIEW_TITLE_MAX).nullish(),
  body: z.string().trim().min(REVIEW_BODY_MIN).max(REVIEW_BODY_MAX),
  photos: z.array(z.string().trim().min(1).max(500)).max(REVIEW_MAX_PHOTOS).optional(),
  videoUrl: z.string().trim().max(500).nullish(),
});

async function productIdForSlug(slug: string): Promise<string | null> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: { id: true },
  });
  return product?.id ?? null;
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return apiRoute(async () => {
    const { slug } = await ctx.params;
    const productId = await productIdForSlug(slug);
    if (!productId) throw notFound('Product not found');

    const url = new URL(req.url);
    const parsedLimit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 12;

    const user = await getCurrentUser();
    const [summary, reviews, eligibility] = await Promise.all([
      getReviewSummary(productId),
      listProductReviews(productId, limit),
      getReviewEligibility(user?.id ?? null, productId),
    ]);
    return jsonOk({ summary, reviews, eligibility });
  })(req, ctx);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return apiRoute(async () => {
    const { slug } = await ctx.params;
    // A review is a rare human action: a handful per hour is plenty and keeps
    // one account (or one IP) from hammering the endpoint.
    await assertRateLimit(`review:${clientIp(req) ?? 'local'}`, {
      limit: 5,
      windowMs: 60 * 60_000,
    });

    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to review a product.');

    const productId = await productIdForSlug(slug);
    if (!productId) throw notFound('Product not found');

    const raw = (await readJson(req)) ?? {};
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) throw badRequest('Invalid review', parsed.error.flatten());

    try {
      const review = await createProductReview({
        userId: user.id,
        productId,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body,
        photos: parsed.data.photos ?? [],
        videoUrl: parsed.data.videoUrl ?? null,
      });
      const summary = await getReviewSummary(productId);
      return jsonOk({ review, summary }, { status: 201 });
    } catch (error) {
      if (error instanceof ReviewError) throw forbidden(error.message);
      throw error;
    }
  })(req, ctx);
}
