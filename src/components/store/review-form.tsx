'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { cn } from '@/lib/utils';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

/**
 * Review form. Only rendered when the signed-in customer has a DELIVERED order
 * line for this product (see ProductReviews) - the server re-checks that on
 * submission, so removing the UI is not a way around it.
 */
export function ReviewForm({ slug, productName }: { slug: string; productName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-accent-400/30 bg-accent-400/[0.06] p-5">
        <p className="text-sm font-medium text-ink-900">Thank you — your review is live.</p>
        <p className="mt-1 text-xs text-ink-500">
          It published instantly because the order was delivered to you.
        </p>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (rating < 1) {
      setError('Choose a star rating first.');
      return;
    }
    if (body.trim().length < 20) {
      setError('Please write at least 20 characters so the review is useful.');
      return;
    }
    setBusy(true);
    try {
      const links = media
        .split(/[\n,]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      const videoUrl = links.find((v) => VIDEO_EXT.test(v) || /youtube\.com|youtu\.be|vimeo\.com/i.test(v));
      const photos = links.filter((v) => v !== videoUrl).slice(0, 4);
      await apiFetch(`/api/products/${slug}/reviews`, {
        method: 'POST',
        body: { rating, title: title.trim() || null, body: body.trim(), photos, videoUrl: videoUrl ?? null },
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not save the review. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-white/[0.07] bg-cream-100 p-5">
      <h3 className="text-sm font-semibold text-ink-900">Review “{productName}”</h3>
      <p className="mt-1 text-xs text-ink-500">
        Verified purchase — it publishes immediately and is marked as a verified buy.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">Rating</legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => {
            const active = value <= (hover || rating);
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                onMouseEnter={() => setHover(value)}
                onFocus={() => setHover(value)}
                onClick={() => setRating(value)}
                className="rounded-md p-1 transition-transform duration-micro hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
              >
                <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M10 1.6l2.47 5.2 5.71.78-4.18 3.98 1.03 5.66L10 14.5l-5.03 2.72 1.03-5.66L1.82 7.58l5.71-.78L10 1.6Z"
                    fill={active ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    className={active ? 'text-accent-400' : 'text-ink-300'}
                  />
                </svg>
              </button>
            );
          })}
          <span className="ml-2 text-xs text-ink-500">{RATING_LABELS[hover || rating] || ''}</span>
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">
          Headline (optional)
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Says it in one line"
          className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">Review</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          minLength={20}
          maxLength={2000}
          required
          placeholder="How does it hold up in daily use? What surprised you?"
          className="mt-1.5 w-full resize-y rounded-lg border border-white/[0.1] bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50"
        />
        <span className="mt-1 block text-[11px] tabular-nums text-ink-400">
          {body.trim().length}/2000 — minimum 20
        </span>
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-medium uppercase tracking-eyebrow text-ink-400">
          Photo or video links (optional)
        </span>
        <textarea
          value={media}
          onChange={(e) => setMedia(e.target.value)}
          rows={2}
          placeholder="https://… (one per line, up to 4 photos + 1 video)"
          className="mt-1.5 w-full resize-y rounded-lg border border-white/[0.1] bg-cream-50 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className={cn(
          'btn-press mt-4 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
        )}
      >
        {busy ? 'Publishing…' : 'Publish review'}
      </button>
    </form>
  );
}
