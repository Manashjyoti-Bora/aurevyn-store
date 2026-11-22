'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';

/**
 * Acknowledge / resolve one incident. Resolution requires a written note, so
 * an incident can never be closed by a bare click with no explanation.
 */
export function IncidentRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(action: 'acknowledge' | 'resolve') {
    setBusy(true);
    try {
      await apiFetch('/api/admin/jarvis/incidents', {
        body:
          action === 'resolve'
            ? { action, id, resolution: note.trim() }
            : { action, id },
      });
      toast(action === 'resolve' ? 'Incident resolved' : 'Incident acknowledged', 'success');
      setOpen(false);
      setNote('');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Could not update the incident', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'RESOLVED') return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'OPEN' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => send('acknowledge')}
          className="rounded-md border border-ink-900/15 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-cream-100 disabled:opacity-50"
        >
          Acknowledge
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-ink-900/15 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-cream-100"
        aria-expanded={open}
      >
        Resolve
      </button>
      {open && (
        <div className="w-full space-y-1.5">
          <label className="block text-[11px] font-medium text-ink-500" htmlFor={`resolution-${id}`}>
            What fixed it? (required)
          </label>
          <textarea
            id={`resolution-${id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-ink-900/15 px-2 py-1 text-xs"
            placeholder="e.g. Restarted the scheduler and drained the queue; 0 jobs failed after."
          />
          <button
            type="button"
            disabled={busy || note.trim().length < 5}
            onClick={() => send('resolve')}
            className="rounded-md bg-ink-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Mark resolved'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Run the detection scan now (the same code path the cron uses). */
export function IncidentScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    try {
      const result = await apiFetch<{ opened: number; updated: number }>(
        '/api/admin/jarvis/incidents',
        { body: { action: 'sync' } }
      );
      toast(
        `Scan complete: ${result.opened} opened, ${result.updated} refreshed`,
        'success'
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : 'Scan failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={scan}
      disabled={busy}
      className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-cream-100 disabled:opacity-60"
    >
      {busy ? 'Scanning…' : 'Run detection scan'}
    </button>
  );
}
