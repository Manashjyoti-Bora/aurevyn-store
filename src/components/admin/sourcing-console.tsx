'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import type { SourcingCandidateRecord } from '@/lib/sourcing/types';

const PLACEHOLDER = `Cozy cotton night suit | 349 | 999 | 4.3 | 1840 | 6200 | 4 | https://www.meesho.com/cozy-cotton-night-suit/p/abc123
Stainless steel water bottle 1L | 219 | 599 | 4.1 | 920 | 3100 | 6
Kitchen storage rack | 189 | 449 | 3.8 | 210 | 480 | 11`;

const VERDICT_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  PUBLISH: 'green',
  WATCH: 'amber',
  SKIP: 'red',
};

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

export function SourcingConsole({ initial }: { initial: SourcingCandidateRecord[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Array<{ line: number; reason: string }>>([]);

  const counts = useMemo(
    () => ({
      publish: rows.filter((r) => r.verdict === 'PUBLISH').length,
      watch: rows.filter((r) => r.verdict === 'WATCH').length,
      skip: rows.filter((r) => r.verdict === 'SKIP').length,
    }),
    [rows]
  );

  async function ingest() {
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      const result = await apiFetch<{
        saved: number;
        skipped: Array<{ line: number; reason: string }>;
        candidates: SourcingCandidateRecord[];
      }>('/api/admin/sourcing', { body: { text } });
      setSkipped(result.skipped);
      setText('');
      toast(`${result.saved} listing${result.saved === 1 ? '' : 's'} scored`, 'success');
      const refreshed = await apiFetch<{ candidates: SourcingCandidateRecord[] }>(
        '/api/admin/sourcing'
      );
      setRows(refreshed.candidates);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not score these rows');
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(row: SourcingCandidateRecord) {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ productId: string; slug: string }>(
        `/api/admin/sourcing/${row.id}/draft`,
        { body: {} }
      );
      toast('Draft product created — add photos, then publish', 'success');
      setRows((previous) =>
        previous.map((item) =>
          item.id === row.id ? { ...item, status: 'DRAFTED', productId: result.productId } : item
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create the draft');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-ink-900/10 bg-white p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-semibold">Paste what Meesho shows you</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-400">
          One listing per line. Columns: name | price | mrp | rating | reviews | units sold | return %
          | Meesho link. Everything after the price is optional. Meesho has no public catalogue API,
          so these are the numbers you actually saw — the score never invents evidence.
        </p>
        <div className="mt-3">
          <Field label="Meesho rows" hint="Tip: copy a row from the Meesho app and separate columns with | or Tab">
            {(p) => (
              <Textarea
                {...p}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={7}
                maxLength={8000}
                placeholder={PLACEHOLDER}
                className="font-mono text-xs"
              />
            )}
          </Field>
        </div>
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {skipped.length > 0 && (
          <div className="mt-3">
            <Alert tone="warning" title={`${skipped.length} line(s) skipped`}>
              {skipped
                .slice(0, 4)
                .map((item) => `Line ${item.line}: ${item.reason}`)
                .join(' · ')}
            </Alert>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={ingest} loading={busy} disabled={text.trim().length === 0}>
            Score listings
          </Button>
          <span className="text-[11px] text-ink-400">
            {counts.publish} publish · {counts.watch} watch · {counts.skip} skip
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-card">
        <div className="border-b border-ink-900/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Scored shortlist</h2>
          <p className="mt-0.5 text-xs text-ink-400">Best score first. Margin is after landed cost.</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-400">
            No listings scored yet. Paste a few rows above to build your first shortlist.
          </p>
        ) : (
          <ul className="divide-y divide-ink-900/5">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={VERDICT_TONE[row.verdict] ?? 'gray'}>{row.verdict}</Badge>
                      <span className="text-[11px] font-semibold tabular-nums text-ink-500">
                        score {row.score}/100
                      </span>
                      {row.status === 'DRAFTED' && <Badge tone="blue">Draft created</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-ink-900">{row.name}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-ink-500">
                      Buy {inr(row.landedCostPaise)} → sell {inr(row.suggestedPricePaise)} · margin{' '}
                      <strong className={row.marginPercent >= 30 ? 'text-emerald-700' : 'text-amber-700'}>
                        {inr(row.marginPaise)} ({row.marginPercent}%)
                      </strong>
                    </p>
                    {row.reasons.length > 0 && (
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                        {row.reasons.join(' · ')}
                      </p>
                    )}
                    {row.flags.length > 0 && (
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                        {row.flags.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.meeshoUrl && (
                      <Link
                        href={row.meeshoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-ink-900/10 px-2.5 py-1.5 text-[11px] font-medium text-ink-600 hover:bg-cream-100"
                      >
                        Meesho
                      </Link>
                    )}
                    {row.productId ? (
                      <Link
                        href={`/admin/products/${row.productId}`}
                        className="rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-ink-800"
                      >
                        Open draft
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => createDraft(row)} loading={busy}>
                        Create draft
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
