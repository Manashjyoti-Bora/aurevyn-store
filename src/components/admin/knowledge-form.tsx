'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CONFIDENCES,
  KNOWLEDGE_SOURCE_TYPES,
} from '@/lib/jarvis/knowledge';

const inputClass =
  'w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200';
const labelClass = 'block text-xs font-semibold text-ink-600';

const EMPTY = {
  title: '',
  category: KNOWLEDGE_CATEGORIES[0] as string,
  summary: '',
  body: '',
  sourceType: 'OFFICIAL' as string,
  sourceUrl: '',
  sourceTitle: '',
  publishedAt: '',
  verifiedAt: '',
  confidence: 'ASSUMPTION' as string,
};

/**
 * Add one knowledge entry. The API enforces the rules; the helper text here
 * states them so the owner isn't surprised by a VERIFIED rejection.
 */
export function KnowledgeForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setIssues([]);
    try {
      await apiFetch('/api/admin/jarvis/knowledge', {
        body: {
          ...form,
          sourceUrl: form.sourceUrl.trim() || null,
          sourceTitle: form.sourceTitle.trim() || null,
          publishedAt: form.publishedAt || null,
          verifiedAt: form.verifiedAt || null,
        },
      });
      toast('Knowledge entry saved', 'success');
      setForm(EMPTY);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast(err.message, 'error');
        if (Array.isArray(err.details)) {
          setIssues(
            err.details.map((d) =>
              typeof d === 'object' && d && 'message' in d ? String((d as { message: unknown }).message) : String(d)
            )
          );
        }
      } else {
        toast('Could not save the entry', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-lg bg-cream-50 px-3 py-2 text-[11px] text-ink-500">
        <strong>VERIFIED</strong> needs an official or primary source, its title and the date you
        read it. Anything else is saved as an estimate, assumption or recommendation and is shown
        that way. Fast-moving categories (law, tax, platform policy, security) are due for recheck
        after 30 days; everything else after 180.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="kb-title">
            Title
          </label>
          <input
            id="kb-title"
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={160}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-category">
            Category
          </label>
          <select
            id="kb-category"
            className={inputClass}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-confidence">
            Confidence
          </label>
          <select
            id="kb-confidence"
            className={inputClass}
            value={form.confidence}
            onChange={(e) => set('confidence', e.target.value)}
          >
            {KNOWLEDGE_CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="kb-summary">
            Summary (one line)
          </label>
          <input
            id="kb-summary"
            className={inputClass}
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            maxLength={400}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="kb-body">
            What was learned
          </label>
          <textarea
            id="kb-body"
            className={inputClass}
            rows={4}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-source-type">
            Source type
          </label>
          <select
            id="kb-source-type"
            className={inputClass}
            value={form.sourceType}
            onChange={(e) => set('sourceType', e.target.value)}
          >
            {KNOWLEDGE_SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-source-title">
            Source title
          </label>
          <input
            id="kb-source-title"
            className={inputClass}
            value={form.sourceTitle}
            onChange={(e) => set('sourceTitle', e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="kb-source-url">
            Source URL
          </label>
          <input
            id="kb-source-url"
            type="url"
            className={inputClass}
            value={form.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-published">
            Source published
          </label>
          <input
            id="kb-published"
            type="date"
            className={inputClass}
            value={form.publishedAt}
            onChange={(e) => set('publishedAt', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="kb-verified">
            Checked on
          </label>
          <input
            id="kb-verified"
            type="date"
            className={inputClass}
            value={form.verifiedAt}
            onChange={(e) => set('verifiedAt', e.target.value)}
          />
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="list-inside list-disc rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save entry'}
      </button>
    </form>
  );
}
