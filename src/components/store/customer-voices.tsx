import Link from 'next/link';
import { Stars } from '@/components/ui/stars';
import { listRecentReviews } from '@/lib/reviews/service';

/**
 * Home-page social proof wall.
 *
 * Renders nothing at all until the store has real published reviews - there is
 * no placeholder testimonial, no stock avatar and no invented quote. Every card
 * links to the product it was written about.
 */
export async function CustomerVoices() {
  const reviews = await listRecentReviews(3);
  if (reviews.length === 0) return null;

  return (
    <section
      className="container-store border-t border-white/[0.06] py-12 sm:py-16"
      aria-labelledby="customer-voices"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-eyebrow text-accent-400">
            Verified purchases
          </p>
          <h2 id="customer-voices" className="mt-2">
            What buyers actually said
          </h2>
        </div>
        <p className="text-xs text-ink-400">
          Written only by customers whose order was delivered.
        </p>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-col rounded-2xl border border-white/[0.07] bg-cream-100 p-5"
          >
            <Stars value={review.rating} size={13} />
            {review.title && (
              <p className="mt-3 text-sm font-semibold text-ink-900">{review.title}</p>
            )}
            <p className="mt-2 line-clamp-5 text-[13px] leading-relaxed text-ink-600">
              {review.body}
            </p>
            <div className="mt-auto pt-4 text-[11px] text-ink-400">
              <span className="font-medium text-ink-600">{review.authorName}</span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <Link
                href={`/products/${review.product.slug}#reviews`}
                className="link-primary"
              >
                {review.product.name}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
