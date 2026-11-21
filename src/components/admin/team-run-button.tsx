'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiClientError } from '@/lib/client/api';

/**
 * Owner-triggered team cycle. Runs every agent once against live data and
 * refreshes the board. The cycle never changes a product, price or order.
 */
export function TeamRunButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<{
        counts: { ACT: number; WATCH: number; CLEAR: number };
        durationMs: number;
      }>('/api/admin/team/run');
      setMessage(
        `Cycle complete — ${result.counts.ACT} action, ${result.counts.WATCH} watch, ${result.counts.CLEAR} clear in ${result.durationMs} ms.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'The team could not run. Try again.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {running ? 'Team is working…' : 'Run the team now'}
      </button>
      <p aria-live="polite" className="text-[11px] text-ink-400">
        {error ?? message ?? 'Read-only cycle · nothing is published or charged'}
      </p>
    </div>
  );
}
