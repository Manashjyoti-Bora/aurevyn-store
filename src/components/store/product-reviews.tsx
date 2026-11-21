import Link from 'next/link';
import Image from '@/components/ui/remote-image';
import { Stars } from '@/components/ui/stars';
import {
  getReviewEligibility,
  getReviewSummary,
  listProductReviews,
  reviewMessage,
} from '@/lib/reviews/service';
import { ReviewForm } from './review-form';

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Ratings & reviews for one product.
 *
 * Every number here is computed from rows in `product_reviews`, and a row can
 * only be created from a delivered order line. There is deliberately no empty
 * "4.9 from 2,300 buyers" badge when the store has no reviews: an empty state
 * is shown instead.
 */
export async function ProductReviews({
  productId,
  productSlug,
  productName,
  userId,
}: {
  productId: string;
  productSlug: string;
  productName: string;
  userId: string | null;
}) {
  const [summary, reviews, eligibility] = await Promise.all([
    getReviewSummary(productId),
    listProductReviews(productId, 12),
    getReviewEligibility(userId, productId),
  ]);

  return (
    <section id="reviews" className="mt-12 scroll-mt-24" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-eyebrow text-accent-400">
            Verified purchases only
          </p>
          <h2 id="reviews-heading" className="mt-1">
            Ratings &amp; reviews
          </h2>
        </div>
        {summary.count > 0 && (
          <p className="text-xs text-ink-400">
            {summary.count} verified review{summary.count === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {summary.count === 0 ? (
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-cream-100 p-6">
          <p className="text-sm font-medium text-ink-900">No reviews yet.</p>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-500">
            This store only publishes reviews from customers whose order was delivered — no imported
            testimonials, no seeded ratings. If you have received this item, your review appears here
            the moment you post it.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="rounded-xl border border-white/[0.07] bg-cream-100 p-5">
            <p className="text-4xl font-semibold tabular-nums leading-none text-ink-900">
              {summary.average.toFixed(1)}
            </p>
            <Stars value={summary.average} size={16} className="mt-2" />
            <p className="mt-1 text-xs text-ink-400">
              {summary.count} verified review{summary.count === 1 ? '' : 's'}
            </p>
            <ul className="mt-4 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[star as 1 | 2 | 3 | 4 | 5];
                const pct = summary.count === 0 ? 0 : Math.round((count / summary.count) * 100);
                return (
                  <li key={star} className="flex items-center gap-2 text-[11px] text-ink-400">
                    <span className="w-3 tabular-nums">{star}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-accent-400/80"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-6 text-right tabular-nums">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-white/[0.07] bg-cream-100 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={review.rating} size={13} />
                  {review.title && (
                    <p className="text-sm font-semibold text-ink-900">{review.title}</p>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                  {review.body}
                </p>
                {review.photos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {review.photos.map((photo) => (
                      <li key={photo}>
                        <Image
                          src={photo}
                          alt={`Customer photo for ${productName}`}
                          width={72}
                          height={72}
                          className="h-16 w-16 rounded-lg border border-white/[0.08] object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {review.videoUrl && (
                  <video
                    src={review.videoUrl}
                    controls
                    preload="none"
                    className="mt-3 w-full max-w-sm rounded-lg border border-white/[0.08] bg-black"
                  />
                )}
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400">
                  <span className="font-medium text-ink-600">{review.authorName}</span>
                  {review.verifiedPurchase && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-medium text-success-600">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M2 6.4 4.6 9 10 3.4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Verified purchase
                    </span>
                  )}
                  <time dateTime={review.createdAt.toISOString()}>
                    {dateFmt.format(review.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 max-w-2xl">
        {eligibility.canReview ? (
          <ReviewForm slug={productSlug} productName={productName} />
        ) : eligibility.reason === 'SIGNED_OUT' ? (
          <p className="rounded-xl border border-white/[0.07] bg-cream-100 px-4 py-3 text-xs text-ink-500">
            Received this item?{' '}
            <Link href={`/auth/login?next=/products/${productSlug}%23reviews`} className="link-primary">
              Sign in
            </Link>{' '}
            to leave a review.
          </p>
        ) : (
          <p className="rounded-xl border border-white/[0.07] bg-cream-100 px-4 py-3 text-xs text-ink-500">
            {reviewMessage(eligibility.reason)}
          </p>
        )}
      </div>
    </section>
  );
}
