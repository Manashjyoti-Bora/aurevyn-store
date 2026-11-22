'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';

/**
 * Record that an entry's source was re-read. The date is the verification
 * evidence, so it is always chosen explicitly — never implied by a click.
 */
export function KnowledgeRecheckButton({ id }: { id: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function recheck() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/jarvis/knowledge/${id}/recheck`, {
        body: { verifiedOn: date },
      });
      toast('Recheck recorded', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Could not record the recheck', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`recheck-${id}`}>
        Date the source was re-read
      </label>
      <input
        id={`recheck-${id}`}
        type="date"
        value={date}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-ink-900/15 px-1.5 py-1 text-[11px]"
      />
      <button
        type="button"
        onClick={recheck}
        disabled={busy}
        className="rounded-md border border-ink-900/15 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-cream-100 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Rechecked'}
      </button>
    </span>
  );
}
